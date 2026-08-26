"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { JWT } from "google-auth-library";

// Generate a FISO Google Sheet by CLONING the Property Lions master template
// (a Google Sheet living in the Shared Drive) and populating the cells Oracle
// knows — date, subject property, and the linked comparable evidence. Cloning
// preserves every PL formula, cross-sheet reference, and format 1:1, so the
// output looks exactly like a hand-built PL FEASO. One-time setup + the master
// template id (GOOGLE_FISO_TEMPLATE_ID) are documented in GOOGLE_SHEETS_SETUP.md.

const ASSESS = "Property Assessment "; // NB: trailing space in the sheet title
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

export const generateFisoSheet = action({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }): Promise<{ url: string }> => {
    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      throw new Error("Only staff or admins can generate FISO sheets");
    }
    const templateId = process.env.GOOGLE_FISO_TEMPLATE_ID;
    const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;
    if (!templateId) throw new Error("GOOGLE_FISO_TEMPLATE_ID is not set (the master PL FEASO template). See docs/GOOGLE_SHEETS_SETUP.md.");
    if (!sharedDriveId) throw new Error("GOOGLE_SHARED_DRIVE_ID is not set. See docs/GOOGLE_SHEETS_SETUP.md.");

    const [property, comps] = await Promise.all([
      ctx.runQuery(api.properties.getProperty, { id: propertyId }),
      ctx.runQuery(api.comps.getCompsByProperty, { propertyId }),
    ]);
    if (!property) throw new Error("Property not found.");

    const token = await saToken(["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]);
    const { id, url } = await cloneAndFill(token, templateId, sharedDriveId, property, comps || []);
    await ctx.runMutation(internal.properties.setFisoSheet, { id: propertyId, url, sheetId: id });
    return { url };
  },
});

// Copy the master template into the Shared Drive, then overwrite the subject
// property + comparable-evidence cells. Everything else (Feasibility, Cashflow,
// formatting, cross-sheet formulas) is inherited from the template untouched.
async function cloneAndFill(token: string, templateId: string, sharedDriveId: string, property: any, comps: any[]) {
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const title = `FISO — ${property.address}${property.suburb ? `, ${property.suburb}` : ""}`;

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
  const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
  if (!writeRes.ok) throw new Error(`Sheet populate failed (${writeRes.status}): ${await writeRes.text()}`);

  return { id, url };
}
