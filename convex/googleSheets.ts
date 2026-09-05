"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { JWT } from "google-auth-library";

// Generate a FEASO Google Sheet by CLONING the Property Lions master template
// (a Google Sheet living in the Shared Drive) and populating the cells Oracle
// knows — date, subject property, and the linked comparable evidence. Cloning
// preserves every PL formula, cross-sheet reference, and format 1:1, so the
// output looks exactly like a hand-built PL FEASO. One-time setup + the master
// template id (GOOGLE_FEASO_TEMPLATE_ID) are documented in GOOGLE_SHEETS_SETUP.md.

const ASSESS = "Property Assessment "; // NB: trailing space in the sheet title
const FEAS   = "Project Feasibility";

// Cell map for the Project Feasibility tab, read off the master template.
// Row 4 is LAND and row 5 is BUILD — the reverse of the order these fields
// appear in our schema, so don't reorder these without re-reading the sheet.
const PF = {
  rentLow:   "B3",  rentHigh:   "C3",   // "Market rent (net)"            $/sqm
  landLow:   "B4",  landHigh:   "C4",   // "Market sale price based on land"
  buildLow:  "B5",  buildHigh:  "C5",   // "Market sale price based on build"
  offerPrice: "C8",                     // B8 is a formula off page 1 (asking)
  projectYears: "C25",                  // "Project time" ... "Years"
  tenancyRows: [14, 15, 16, 17, 18],    // Unit | Tenant | Size | ... | Current Rent
};
const CASH   = "Cashflow Inputs & Analysis";
const OUT    = "Outgoings";

/**
 * Cell maps for the two tabs the generator used to leave completely untouched.
 *
 * Both inherited the master template's contents verbatim, which means every
 * FEASO ever generated shipped with whatever deal the master was last saved
 * from — the same failure as the "AH Beard" tenancy block, just one tab over.
 * Outgoings carried $10k council rates / $5k water / $50k land tax / $5k
 * insurance; Cashflow carried a 2025-2034 year row, a 50% year-one vacancy and
 * two 20% rent-growth spikes in years 4 and 8.
 */
const OUTGOINGS = {
  firstRow: 2,
  lastRow: 8,          // A2:C8 is the table body; A9/B9 is the Total line
  total: "B9",
};

const CF = {
  ltv: "G12",                    // "LTV Ratio"
  years: "C24:L24",              // the Cash Flow Analysis year header
  rentGrowth: "D20:L20",         // years 2-10 rent growth
  vacancyByYear: "C21:L21",      // years 1-10 vacancy
};

/**
 * Rent growth Oracle cannot know. The master holds 4% in seven of the nine
 * cells and 20% in two — those two are a previous deal's reletting events, so
 * the tab is flattened to the template's OWN base rate rather than cleared:
 * a blank would silently model 0% growth, and another client's spike is not an
 * option. The analyst overrides it in the sheet.
 */
const CF_BASE_RENT_GROWTH = 0.04;

export type OutgoingItem = { category?: string; amount?: number; recoverable?: boolean };

/**
 * The Outgoings tab body, as rows of [Item, Amount, Recoverable].
 *
 * With no outgoings recorded we clear ONLY the amounts: the item labels are the
 * template's own prompts (Council Rates, Water Rates, Land Tax, ...) and are
 * worth keeping for the analyst, but the dollar figures belong to another deal.
 */
export function outgoingsRows(items: OutgoingItem[] | undefined): {
  rows: Array<Array<string | number>> | null;
  amountsOnly: Array<[number | ""]> | null;
} {
  const capacity = OUTGOINGS.lastRow - OUTGOINGS.firstRow + 1;
  const list = (items ?? []).filter((i) => i && (i.category || num(i.amount) !== null));

  if (list.length === 0) {
    return { rows: null, amountsOnly: Array.from({ length: capacity }, () => [""] as [""]) };
  }

  const rows: Array<Array<string | number>> = [];
  for (let i = 0; i < capacity; i++) {
    const item = list[i];
    if (!item) { rows.push(["", "", ""]); continue; }
    rows.push([
      item.category ?? "",
      num(item.amount) ?? "",
      item.recoverable === true ? "yes" : item.recoverable === false ? "no" : "",
    ]);
  }
  return { rows, amountsOnly: null };
}

/** Anything past the 7 template rows can't be written — say so rather than drop it. */
export function outgoingsOverflow(items: OutgoingItem[] | undefined): number {
  const capacity = OUTGOINGS.lastRow - OUTGOINGS.firstRow + 1;
  return Math.max(0, (items ?? []).length - capacity);
}

/** The ten-year header, starting from the year the sheet is generated. */
export function cashflowYears(startYear: number): number[] {
  return Array.from({ length: 10 }, (_, i) => startYear + i);
}

/**
 * Year-one vacancy as a fraction of the year, from the feaso's vacancy
 * allowance in months. The master's 50% is exactly six months of a previous
 * deal. Years 2-10 are 0 — an ongoing vacancy assumption is the analyst's call.
 */
export function vacancyByYear(vacancyMonths: number | undefined | null): Array<number | ""> {
  const m = num(vacancyMonths);
  const yearOne = m === null ? "" : Math.min(1, Math.max(0, m / 12));
  return [yearOne, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

const num = (x: any): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

async function saToken(scopes: string[]) {
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error("Google service account not configured (GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY).");
  const jwt = new JWT({ email, key: rawKey.replace(/\\n/g, "\n"), scopes });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Could not authenticate with Google. Check the service-account key.");
  return token;
}

export const generateFeasoSheet = action({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }): Promise<{ url: string }> => {
    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      throw new Error("Only staff or admins can generate FEASO sheets");
    }
    const templateId = process.env.GOOGLE_FEASO_TEMPLATE_ID;
    const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;
    if (!templateId) throw new Error("GOOGLE_FEASO_TEMPLATE_ID is not set (the master PL FEASO template). See docs/GOOGLE_SHEETS_SETUP.md.");
    if (!sharedDriveId) throw new Error("GOOGLE_SHARED_DRIVE_ID is not set. See docs/GOOGLE_SHEETS_SETUP.md.");

    const [property, comps, feaso] = await Promise.all([
      ctx.runQuery(api.properties.getProperty, { id: propertyId }),
      ctx.runQuery(api.comps.getCompsByProperty, { propertyId }),
      ctx.runQuery(api.feasos.getFeasoForProperty, { propertyId }),
    ]);
    if (!property) throw new Error("Property not found.");

    const token = await saToken(["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]);
    const { id, url } = await cloneAndFill(token, templateId, sharedDriveId, property, comps || [], feaso);
    await ctx.runMutation(internal.properties.setFeasoSheet, { id: propertyId, url, sheetId: id });
    return { url };
  },
});


/**
 * Is a failed Drive/Sheets response worth retrying?
 *
 * Drive returns 403 for BOTH "you may not do this" and "you are going too
 * fast" — only the `reason` distinguishes them. Regenerating a FEASO twice in
 * a couple of minutes is enough to trip the per-user limit, which surfaced as
 * a hard failure with a raw stack trace in the UI (seen live 2026-09-04).
 * A permissions 403 must NOT be retried; a rate-limit one should.
 */
export function isRetryableGoogleError(status: number, body: string): boolean {
  if (status === 429 || status >= 500) return true;
  if (status !== 403) return false;
  return /rateLimitExceeded|userRateLimitExceeded|backendError|quotaExceeded/i.test(body);
}

/** Fetch with backoff on Google's transient failures. */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 4,
): Promise<{ res: Response; body: string }> {
  let lastBody = "";
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.ok) return { res, body: "" };
    lastBody = await res.text();
    if (i === attempts - 1 || !isRetryableGoogleError(res.status, lastBody)) {
      return { res, body: lastBody };
    }
    // 1s, 2s, 4s — Drive's user rate limit is per 100s but usually clears fast.
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error("unreachable");
}

/** Turn a Google API failure into something a person can act on. */
function googleErrorMessage(status: number, body: string): string {
  if (isRetryableGoogleError(status, body)) {
    return "Google is rate-limiting us right now. Wait a minute and try again — nothing was lost.";
  }
  if (status === 403) {
    return "Google refused the request (403). Check the service account is still a member of the ORACLE FEASO Shared Drive.";
  }
  if (status === 404) {
    return "The FEASO master template wasn't found. Check GOOGLE_FEASO_TEMPLATE_ID.";
  }
  return `Google Sheets error (${status}). ${body.slice(0, 200)}`;
}

// Copy the master template into the Shared Drive, then overwrite the subject
// property + comparable-evidence cells. Everything else (Feasibility, Cashflow,
// formatting, cross-sheet formulas) is inherited from the template untouched.
async function cloneAndFill(token: string, templateId: string, sharedDriveId: string, property: any, comps: any[], feaso?: any) {
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const title = `FEASO — ${property.address}${property.suburb ? `, ${property.suburb}` : ""}`;

  // 1. Clone the template (stays inside the Shared Drive).
  const { res: copyRes, body: copyBody } = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files/${templateId}/copy?supportsAllDrives=true&fields=id,webViewLink`,
    { method: "POST", headers: auth, body: JSON.stringify({ name: title, parents: [sharedDriveId] }) }
  );
  if (!copyRes.ok) throw new Error(googleErrorMessage(copyRes.status, copyBody));
  const file = await copyRes.json();
  const id = file.id as string;
  const url = file.webViewLink || `https://docs.google.com/spreadsheets/d/${id}/edit`;

  // 2. Clear the template's example evidence rows so no stale comps remain.
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchClear`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ ranges: [`'${ASSESS}'!A12:K31`, `'${ASSESS}'!A34:K57`] }),
  });

  // 3. Build the value writes.
  const rentTotal = (property.tenants || []).reduce((s: number, t: any) => s + (Number(t.netFaceRent) || 0), 0);
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd, parsed as a date

  const data: any[] = [
    { range: `'${ASSESS}'!B4`, values: [[today]] },
    { range: `'${ASSESS}'!B5`, values: [[`Property Assessment - ${property.address}`]] },
    // Subject row 8: A address, B NLA, C land, D rent, then F asking — written
    // separately so E8 (Rent/sqm) and G/H/I (Yield, $/sqm) keep their template formulas.
    { range: `'${ASSESS}'!A8:D8`, values: [[
      property.address ?? "",
      num(property.buildingArea) ?? "",
      num(property.landArea) ?? "",
      rentTotal > 0 ? rentTotal : "-",
    ]] },
    { range: `'${ASSESS}'!F8`, values: [[num(property.askingPrice) ?? ""]] },
  ];

  // Leasing evidence → rows 12+ (cols A=addr B=NLA C=land D=rent E=rent/sqm(formula) H=notes)
  const leases = comps.filter((c) => c.type === "lease").slice(0, 20);
  leases.forEach((c, i) => {
    const r = 12 + i;
    const nla = num(c.nlaSqm), rent = num(c.rentPa);
    const notes = [c.grade, c.leaseType, c.tenant].filter(Boolean).join(" · ");
    data.push({ range: `'${ASSESS}'!A${r}:H${r}`, values: [[
      c.address ?? "", nla ?? "", num(c.landAreaSqm) ?? "", rent ?? "",
      nla && rent ? `=D${r}/B${r}` : "", "", "", notes,
    ]] });
  });

  // Sales evidence → rows 34+ (A addr B build C land D price E $/sqm-build F $/sqm-land
  //                            G sold-date H notes I rent J rent/sqm K yield)
  const sales = comps.filter((c) => c.type === "sale").slice(0, 24);
  sales.forEach((c, i) => {
    const r = 34 + i;
    const build = num(c.nlaSqm), land = num(c.landAreaSqm), price = num(c.salePrice), rent = num(c.rentPa);
    const notes = [c.grade, c.assetType].filter(Boolean).join(" · ");
    data.push({ range: `'${ASSESS}'!A${r}:K${r}`, values: [[
      c.address ?? "",
      build ?? "", land ?? "", price ?? "",
      build && price ? `=D${r}/B${r}` : "",
      land && price ? `=D${r}/C${r}` : "",
      c.saleDate ?? "", notes, rent ?? "",
      build && rent ? `=I${r}/B${r}` : "",
      price && rent ? `=I${r}/D${r}` : "",
    ]] });
  });

  // 4. Write everything (USER_ENTERED so dates + formulas evaluate).
  // ── Project Feasibility tab ────────────────────────────────────────────────
  // The generator used to write ONLY the Property Assessment tab, so tabs 2-4
  // kept whatever the master template held — which is a PREVIOUS DEAL's figures
  // and, in the tenancy block, a previous client's tenant names. Will spotted
  // the stale min/max rents on 2026-09-02 ("that's from a previous campaign").
  // Anything Oracle actually knows is now written; anything it doesn't is
  // cleared rather than left showing another deal's numbers.
  const tenants: any[] = Array.isArray(property.tenants) ? property.tenants : [];

  if (feaso) {
    const pf: Array<[string, any]> = [
      [PF.rentLow,      num(feaso.marketRentLow)],
      [PF.rentHigh,     num(feaso.marketRentHigh)],
      [PF.landLow,      num(feaso.salePricePerSqmLandLow)],
      [PF.landHigh,     num(feaso.salePricePerSqmLandHigh)],
      [PF.buildLow,     num(feaso.salePricePerSqmBuildLow)],
      [PF.buildHigh,    num(feaso.salePricePerSqmBuildHigh)],
      [PF.offerPrice,   num(feaso.offerPrice)],
      [PF.projectYears, num(feaso.projectDurationYears)],
    ];
    // Write "" for anything unset — an empty cell is honest, a stale one isn't.
    for (const [cell, value] of pf) {
      data.push({ range: `'${FEAS}'!${cell}`, values: [[value ?? ""]] });
    }
  }

  // Tenancy schedule. Columns I / J / L are template formulas and are left
  // alone; only the literal columns are touched.
  PF.tenancyRows.forEach((row, i) => {
    const t = tenants[i];
    data.push({
      range: `'${FEAS}'!A${row}:H${row}`,
      values: [[
        t?.suite ?? "",
        t?.tenantName ?? "",
        num(t?.lettableArea) ?? "",
        "",                        // D "Site" — not modelled in Oracle
        t?.leaseEnd ?? "",
        t?.options ?? "",
        t?.reviewType ? `${t.reviewType}${t.reviewRate ? ` ${t.reviewRate}%` : ""}` : "",
        num(t?.netFaceRent) ?? "",
      ]],
    });
    // K / M are the per-tenancy market-rent assumptions ($/sqm) that drive the
    // J and L formulas. Feed them from the adopted range so the block is live.
    data.push({ range: `'${FEAS}'!K${row}`, values: [[feaso ? num(feaso.marketRentLow) ?? "" : ""]] });
    data.push({ range: `'${FEAS}'!M${row}`, values: [[feaso ? num(feaso.marketRentHigh) ?? "" : ""]] });
  });

  // ── Outgoings tab ─────────────────────────────────────────────────────────
  // Previously inherited from the master verbatim, so every generated FEASO
  // carried $10k council rates / $5k water / $50k land tax / $5k insurance from
  // whichever deal the template was last saved from.
  const outgoings = Array.isArray(property.outgoings) ? property.outgoings : [];
  const og = outgoingsRows(outgoings);
  if (og.rows) {
    data.push({
      range: `'${OUT}'!A${OUTGOINGS.firstRow}:C${OUTGOINGS.lastRow}`,
      values: og.rows,
    });
  } else if (og.amountsOnly) {
    // No outgoings recorded: clear the money, keep the template's item prompts.
    data.push({
      range: `'${OUT}'!B${OUTGOINGS.firstRow}:B${OUTGOINGS.lastRow}`,
      values: og.amountsOnly,
    });
  }
  // The master totals =SUM(B2:B5) — only the first four of its seven rows, so
  // anything written to rows 6-8 was silently excluded. Widen it in the copy.
  data.push({
    range: `'${OUT}'!${OUTGOINGS.total}`,
    values: [[`=SUM(B${OUTGOINGS.firstRow}:B${OUTGOINGS.lastRow})`]],
  });

  // ── Cashflow Inputs & Analysis ────────────────────────────────────────────
  // The year header was hardcoded 2025-2034 in the master, so every FEASO
  // claimed the model started in 2025 no matter when it was generated.
  data.push({ range: `'${CASH}'!${CF.years}`, values: [cashflowYears(new Date().getUTCFullYear())] });

  // Year-one vacancy: the master's 50% is six months of a previous deal.
  data.push({ range: `'${CASH}'!${CF.vacancyByYear}`, values: [vacancyByYear(feaso?.vacancyMonths)] });

  // Rent growth: flatten the previous deal's two 20% spikes to the template's
  // own base rate. See CF_BASE_RENT_GROWTH.
  data.push({
    range: `'${CASH}'!${CF.rentGrowth}`,
    values: [Array.from({ length: 9 }, () => CF_BASE_RENT_GROWTH)],
  });

  if (feaso && num(feaso.ltvRatio) !== null) {
    data.push({ range: `'${CASH}'!${CF.ltv}`, values: [[num(feaso.ltvRatio)]] });
  }

  const { res: writeRes, body: writeBody } = await fetchWithRetry(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
  if (!writeRes.ok) throw new Error(googleErrorMessage(writeRes.status, writeBody));

  return { id, url };
}

/**
 * VERIFICATION tool: generate a FEASO from real data without touching the
 * property's live sheet link. Internal.
 *
 * Deliberately does NOT call setFeasoSheet — a verification run must not
 * replace the sheet the team is actually using. The generated file lands in
 * the Shared Drive and the service account cannot delete it, so trash it by
 * hand afterwards (same caveat as every previous verification run).
 *
 *   npx convex run --prod googleSheets:testGenerateFeaso '{"propertyId":"..."}'
 */
export const testGenerateFeaso = internalAction({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }): Promise<{ url: string; id: string }> => {
    const templateId = process.env.GOOGLE_FEASO_TEMPLATE_ID;
    const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;
    if (!templateId || !sharedDriveId) throw new Error("FEASO template / shared drive not configured.");

    const bundle: any = await ctx.runQuery(internal.testing.feasoBundle, { propertyId });
    const token = await saToken([
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ]);
    return await cloneAndFill(token, templateId, sharedDriveId, bundle.property, bundle.comps ?? [], bundle.feaso);
  },
});

/**
 * READ-ONLY maintenance tool: dump a FEASO sheet's structure.
 *
 * Needed to map Oracle's `feasos` fields onto the Project Feasibility tab.
 * `generateFeasoSheet` currently writes ONLY the Property Assessment tab, so
 * tabs 2-4 keep whatever the template holds — which Will found to be a prior
 * deal's numbers (2026-09-02). This reports, per tab, which cells carry a
 * literal value versus a formula, so we can tell what must be written by
 * Oracle and what recalculates on its own.
 *
 * Reads only. Keep it — re-run it whenever the master template's layout
 * changes, to re-derive the PF cell map above.
 */
export const inspectFeasoTemplate = internalAction({
  args: { tab: v.optional(v.string()), spreadsheetId: v.optional(v.string()) },
  handler: async (_ctx, args): Promise<any> => {
    const templateId = args.spreadsheetId ?? process.env.GOOGLE_FEASO_TEMPLATE_ID;
    if (!templateId) throw new Error("GOOGLE_FEASO_TEMPLATE_ID is not set.");
    const token = await saToken(["https://www.googleapis.com/auth/spreadsheets.readonly"]);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${templateId}` +
        `?includeGridData=true` +
        `&fields=sheets(properties(title,gridProperties),data(rowData(values(userEnteredValue,formattedValue))))`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Sheets read failed: ${res.status} ${await res.text()}`);
    const doc = await res.json();

    const col = (i: number) => String.fromCharCode(65 + (i % 26));
    const out: any[] = [];
    for (const sheet of doc.sheets ?? []) {
      const title = sheet.properties?.title ?? "?";
      const rows = sheet.data?.[0]?.rowData ?? [];
      let literals = 0, formulas = 0;
      const sample: string[] = [];
      rows.forEach((row: any, r: number) => {
        (row.values ?? []).forEach((cell: any, c: number) => {
          const uev = cell.userEnteredValue;
          if (!uev) return;
          const ref = `${col(c)}${r + 1}`;
          if (uev.formulaValue) {
            formulas++;
            if (sample.length < 200) sample.push(`${ref} FORMULA ${String(uev.formulaValue).slice(0, 44)}`);
          } else {
            const val = uev.numberValue ?? uev.stringValue ?? uev.boolValue;
            // Numeric literals are the dangerous ones — a prior deal's figures.
            if (typeof uev.numberValue === "number") {
              literals++;
              if (sample.length < 200) sample.push(`${ref} NUM ${val}  (${cell.formattedValue ?? ""})`);
            } else if (typeof uev.stringValue === "string" && uev.stringValue.trim()) {
              // Labels — needed to know which row is which before writing values.
              if (sample.length < 200) sample.push(`${ref} TEXT "${uev.stringValue.slice(0, 46)}"`);
            }
          }
        });
      });
      out.push({ tab: title, numericLiterals: literals, formulas, sample });
    }
    return out;
  },
});


