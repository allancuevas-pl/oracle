"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_ORACLE_MODEL } from "./settings";

// Comp scanner: extract a batch of comparables from an agent-supplied data
// table (PDF / image screenshot / pasted text) into our comps shape. Stateless
// — returns the normalized comps for the client to review, then bulk-insert via
// comps.createComps. Mirrors the IM scanner (imExtractionAction) but for comps.

const EXTRACT_SYSTEM = `You are an extraction assistant for commercial-property COMPARABLES ("comps"). Agents send tables of recent lease or sale evidence. Read the input (a PDF, an image of a table, or pasted text) and return structured JSON.

Return ONLY valid JSON of the form: { "comps": [ { ...comp }, ... ] }
One object per comparable row. No markdown fences, no commentary. Use null when a value is genuinely absent. NEVER invent values.

Each comp object may include these fields (omit or null when not present):
- type: "lease" or "sale" — REQUIRED. A row with rent is a lease comp; a row with a sale price / cap rate is a sale comp. If a whole table is clearly one kind, use that.
- address: street address string
- suburb: suburb / locality
- state: Australian state, 2-3 letters uppercase (NSW, VIC, QLD, WA, SA, TAS, NT, ACT)
- postcode: 4-digit string
- assetType: one of Industrial, Retail, Office, Hybrid, Other
- grade: building grade — one of "Prime", "A", "B", "C" — only if stated
- nlaSqm: Net Lettable Area in sqm (number)
- landAreaSqm: land area in sqm (number)
- LEASE fields: tenant (name), rentPa (annual rent in whole dollars — convert if monthly), rentPerSqm (annual $/sqm if that's all that's given), leaseType (Net/Gross/Semi-Gross), leaseDate ("YYYY-MM-DD"), leaseExpiry ("YYYY-MM-DD"), leaseTerm (e.g. "5yr", "3 + 3yr"), incentives (text), incentivePct (number), reviewType (CPI/Fixed %/Market), reviewRate (number, e.g. 3.5)
- SALE fields: salePrice (whole dollars), capRate (number percent, e.g. 6.5), saleDate ("YYYY-MM-DD")
- agentName, agentPhone, agentCompany: the selling/leasing agent if shown
- notes: brief free text for anything useful that doesn't fit a field

Rules: dollars are whole numbers (e.g. 1250000, not "$1.25M"). Percentages are plain numbers (6.5 not "6.5%"). Dates are "YYYY-MM-DD" or null. If only $/sqm rent is given (no total), set rentPerSqm and leave rentPa null.`;

const EXTRACT_USER =
  "Extract every comparable from this data into the JSON schema in your instructions. Return ONLY the JSON object.";

const GRADES = new Set(["Prime", "A", "B", "C"]);
const num = (x: any) => {
  if (x === null || x === undefined || x === "") return undefined;
  const n = typeof x === "number" ? x : Number(String(x).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const str = (x: any) => {
  if (x === null || x === undefined) return undefined;
  const s = String(x).trim();
  return s ? s : undefined;
};

function normalize(raw: any) {
  const type = raw?.type === "lease" || raw?.type === "sale"
    ? raw.type
    : (num(raw?.rentPa) || num(raw?.rentPerSqm) ? "lease" : "sale");
  const comp: Record<string, any> = {
    type,
    address: str(raw?.address) ?? "",
    suburb: str(raw?.suburb) ?? "",
    source: "comp_scan",
  };
  const state = str(raw?.state);
  if (state) comp.state = state.toUpperCase().slice(0, 3);
  const put = (k: string, val: any) => { if (val !== undefined) comp[k] = val; };
  put("postcode", str(raw?.postcode));
  put("assetType", str(raw?.assetType));
  const grade = str(raw?.grade);
  if (grade && GRADES.has(grade)) comp.grade = grade;
  put("nlaSqm", num(raw?.nlaSqm));
  put("landAreaSqm", num(raw?.landAreaSqm));
  // lease
  put("tenant", str(raw?.tenant));
  put("rentPa", num(raw?.rentPa));
  put("rentPerSqm", num(raw?.rentPerSqm));
  put("leaseType", str(raw?.leaseType));
  put("leaseDate", str(raw?.leaseDate));
  put("leaseExpiry", str(raw?.leaseExpiry));
  put("leaseTerm", str(raw?.leaseTerm));
  put("incentives", str(raw?.incentives));
  put("incentivePct", num(raw?.incentivePct));
  put("reviewType", str(raw?.reviewType));
  put("reviewRate", num(raw?.reviewRate));
  // sale
  put("salePrice", num(raw?.salePrice));
  put("capRate", num(raw?.capRate));
  put("saleDate", str(raw?.saleDate));
  // agent
  put("agentName", str(raw?.agentName));
  put("agentPhone", str(raw?.agentPhone));
  put("agentCompany", str(raw?.agentCompany));
  put("notes", str(raw?.notes));
  return comp;
}

export const extractComps = action({
  args: {
    storageId: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      throw new Error("Only staff or admins can scan comps");
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in Convex environment variables.");
    if (!args.storageId && !(args.text && args.text.trim())) {
      throw new Error("Provide a file or pasted text to scan.");
    }

    const content: any[] = [];
    if (args.text && args.text.trim()) {
      content.push({ type: "text", text: `Comp data table:\n\n${args.text.trim()}` });
    }
    if (args.storageId) {
      const url = await ctx.storage.getUrl(args.storageId as any);
      if (!url) throw new Error("Uploaded file not found in storage.");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch file: HTTP ${res.status}`);
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      const mt = args.mediaType || "application/pdf";
      if (mt === "application/pdf") {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
      } else if (mt.startsWith("image/")) {
        content.push({ type: "image", source: { type: "base64", media_type: mt, data: b64 } });
      } else {
        throw new Error(`Unsupported file type: ${mt}. Use PDF, an image, or paste the text.`);
      }
    }
    content.push({ type: "text", text: EXTRACT_USER });

    const modelFromDb = await ctx.runQuery(api.settings.getOracleModel, {});
    const model = modelFromDb || process.env.CLAUDE_MODEL || DEFAULT_ORACLE_MODEL;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content }],
    });

    const block = response.content.find((b: any) => b.type === "text") as any;
    let jsonText = (block?.text ?? "").trim();
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error("Could not parse the extraction. Try a clearer table or paste the text.");
    }
    const rows: any[] = Array.isArray(parsed) ? parsed : parsed?.comps ?? [];
    const comps = rows.map(normalize).filter((c) => c.address || c.suburb || c.salePrice || c.rentPa || c.rentPerSqm);

    return { comps, count: comps.length, model: response.model };
  },
});
