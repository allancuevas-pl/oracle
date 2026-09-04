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

// Copy the master template into the Shared Drive, then overwrite the subject
// property + comparable-evidence cells. Everything else (Feasibility, Cashflow,
// formatting, cross-sheet formulas) is inherited from the template untouched.
async function cloneAndFill(token: string, templateId: string, sharedDriveId: string, property: any, comps: any[], feaso?: any) {
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const title = `FEASO — ${property.address}${property.suburb ? `, ${property.suburb}` : ""}`;

  // 1. Clone the template (stays inside the Shared Drive).
  const copyRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${templateId}/copy?supportsAllDrives=true&fields=id,webViewLink`,
    { method: "POST", headers: auth, body: JSON.stringify({ name: title, parents: [sharedDriveId] }) }
  );
  if (!copyRes.ok) throw new Error(`Template copy failed (${copyRes.status}): ${await copyRes.text()}`);
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

  const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
  if (!writeRes.ok) throw new Error(`Sheet populate failed (${writeRes.status}): ${await writeRes.text()}`);

  return { id, url };
}

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


