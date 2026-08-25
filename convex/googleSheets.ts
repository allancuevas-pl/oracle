"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { JWT } from "google-auth-library";

// Generate a FISO Google Sheet in Drive from a property's data (assessment,
// tenancy, linked comps, feaso inputs) via a service account. See
// docs/GOOGLE_SHEETS_SETUP.md for the one-time Google Cloud setup.

const round = (n: number) => Math.round(n * 100) / 100;
const numOr = (x: any, d: any = "") => (typeof x === "number" && Number.isFinite(x) ? x : d);

function assessmentTab(p: any) {
  const tenants = p.tenants || [];
  const rows: any[][] = [
    ["PROPERTY ASSESSMENT"],
    [],
    ["Property ID", p.propertyId ?? ""],
    ["Address", p.address ?? ""],
    ["Suburb", p.suburb ?? ""],
    ["State", p.location ?? ""],
    ["Asset Type", p.assetType ?? ""],
    ["Status", p.status ?? ""],
    ["Land Area (sqm)", numOr(p.landArea)],
    ["Building Area / NLA (sqm)", numOr(p.buildingArea)],
    ["WALE (yrs)", numOr(p.wales)],
    ["Asking Price ($)", numOr(p.askingPrice)],
    ["Estimated Yield (%)", numOr(p.estimatedYield)],
    [],
    ["TENANCY SCHEDULE"],
    ["Tenant", "Suite", "Area (sqm)", "Lease Start", "Lease End", "Net Face Rent $/pa", "$/sqm", "Lease Type", "Review", "Options"],
  ];
  let totArea = 0, totRent = 0;
  for (const t of tenants) {
    const area = numOr(t.lettableArea, 0), rent = numOr(t.netFaceRent, 0);
    totArea += Number(area) || 0; totRent += Number(rent) || 0;
    rows.push([
      t.tenantName ?? "", t.suite ?? "", numOr(t.lettableArea), t.leaseStart ?? "", t.leaseEnd ?? "",
      numOr(t.netFaceRent), area && rent ? round(Number(rent) / Number(area)) : "",
      t.leaseType ?? "", t.reviewType ? `${t.reviewType} ${t.reviewRate ?? ""}`.trim() : "", t.options ?? "",
    ]);
  }
  if (tenants.length) rows.push(["TOTAL", "", totArea || "", "", "", totRent || "", "", "", "", ""]);
  return rows;
}

function compsTab(comps: any[]) {
  const sales = comps.filter((c) => c.type === "sale");
  const leases = comps.filter((c) => c.type === "lease");
  const rows: any[][] = [["SALE EVIDENCE"], ["Address", "Suburb", "State", "Asset", "Grade", "NLA (sqm)", "Land (sqm)", "Sale Price", "$/sqm build", "Cap Rate %", "Date", "Agent"]];
  for (const c of sales) rows.push([c.address ?? "", c.suburb ?? "", c.state ?? "", c.assetType ?? "", c.grade ?? "", numOr(c.nlaSqm), numOr(c.landAreaSqm), numOr(c.salePrice), numOr(c.pricePerSqmBuild), numOr(c.capRate), c.saleDate ?? "", c.agentName ?? c.agentCompany ?? ""]);
  if (!sales.length) rows.push(["No sale comps linked", "", "", "", "", "", "", "", "", "", "", ""]);
  rows.push([], ["LEASE EVIDENCE"], ["Address", "Suburb", "State", "Asset", "Grade", "NLA (sqm)", "Net Rent $/pa", "$/sqm", "Lease Type", "Term", "Date", "Tenant"]);
  for (const c of leases) rows.push([c.address ?? "", c.suburb ?? "", c.state ?? "", c.assetType ?? "", c.grade ?? "", numOr(c.nlaSqm), numOr(c.rentPa), numOr(c.rentPerSqm), c.leaseType ?? "", c.leaseTerm ?? "", c.leaseDate ?? "", c.tenant ?? ""]);
  if (!leases.length) rows.push(["No lease comps linked", "", "", "", "", "", "", "", "", "", "", ""]);
  return rows;
}

function feasibilityTab(p: any, f: any) {
  const nla = numOr(p.buildingArea, 0);
  const currentRent = (p.tenants || []).reduce((s: number, t: any) => s + (Number(t.netFaceRent) || 0), 0);
  const offerPrice = numOr(f?.offerPrice, numOr(p.askingPrice, ""));
  const marketRentPa = f?.marketRentLow && f?.marketRentHigh && nla
    ? round(((f.marketRentLow + f.marketRentHigh) / 2) * Number(nla))
    : currentRent || "";
  // Inputs occupy col B, rows 4-13. Outputs (rows 16-22) reference them by formula.
  return [
    ["PROJECT FEASIBILITY"],
    [],
    ["Inputs", ""],
    ["Offer / Buy Price ($)", offerPrice],
    ["Current Net Rent ($/pa)", currentRent || ""],
    ["Adopted Market Rent ($/pa)", marketRentPa],
    ["Adopted Cap Rate (%)", numOr(f?.adoptedCapRate)],
    ["Stamp Duty (%)", numOr(f?.stampDutyPct)],
    ["Buyers Agent Fee (%)", numOr(f?.baFeePct)],
    ["Closing Costs ($)", numOr(f?.closingCosts, 0)],
    ["Works / Capex ($)", numOr(f?.works, 0)],
    ["LTV Ratio (0-1)", numOr(f?.ltvRatio, 0.5)],
    ["Interest Rate (%)", numOr(f?.interestRatePct)],
    [],
    ["Outputs", ""],
    ["Purchase Costs (stamp + BA + closing)", "=B4*B8/100 + B4*B9/100 + B10"],
    ["Total Acquisition Cost", "=B4 + B16 + B11"],
    ["New Value (market rent / cap rate)", "=IF(B7>0, B6/(B7/100), 0)"],
    ["Net Profit", "=B18 - B17"],
    ["Profit Margin (%)", "=IF(B17>0, B19/B17*100, 0)"],
    ["Equity (Total Acq - Loan)", "=B17 - B4*B12"],
    ["Return on Equity (%)", "=IF(B21>0, B19/B21*100, 0)"],
  ];
}

function cashflowTab(p: any, f: any) {
  const currentRent = (p.tenants || []).reduce((s: number, t: any) => s + (Number(t.netFaceRent) || 0), 0);
  const offerPrice = numOr(f?.offerPrice, numOr(p.askingPrice, 0));
  const ltv = numOr(f?.ltvRatio, 0.5);
  const rows: any[][] = [
    ["10-YEAR CASHFLOW (indicative — adjust inputs)"],
    [],
    ["Inputs", ""],
    ["Year 1 Net Rent ($/pa)", currentRent || ""],
    ["Rent Growth (% p.a.)", 3],
    ["Vacancy Allowance (%)", 5],
    ["Loan Amount ($)", offerPrice ? Math.round(Number(offerPrice) * Number(ltv)) : ""],
    ["Interest Rate (%)", numOr(f?.interestRatePct, 6.5)],
    [],
    ["Year", "Gross Rent", "Vacancy", "NOI", "Interest", "Net Cashflow"],
  ];
  for (let n = 1; n <= 10; n++) {
    const r = 10 + n; // sheet row
    rows.push([
      n,
      `=$B$4*(1+$B$5/100)^(A${r}-1)`,
      `=-B${r}*$B$6/100`,
      `=B${r}+C${r}`,
      `=-$B$7*$B$8/100`,
      `=D${r}+E${r}`,
    ]);
  }
  return rows;
}

export const generateFisoSheet = action({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      throw new Error("Only staff or admins can generate FISO sheets");
    }
    const email = process.env.GOOGLE_SA_CLIENT_EMAIL;
    const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
    if (!email || !rawKey) {
      throw new Error("Google service account not configured. Set GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY in the Convex dashboard (see docs/GOOGLE_SHEETS_SETUP.md).");
    }
    const key = rawKey.replace(/\\n/g, "\n");

    const [property, comps, feaso] = await Promise.all([
      ctx.runQuery(api.properties.getProperty, { id: propertyId }),
      ctx.runQuery(api.comps.getCompsByProperty, { propertyId }),
      ctx.runQuery(api.feasos.getFeasoForProperty, { propertyId }),
    ]);
    if (!property) throw new Error("Property not found.");

    const jwt = new JWT({
      email, key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
    });
    const { token } = await jwt.getAccessToken();
    if (!token) throw new Error("Could not authenticate with Google. Check the service-account key.");
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;
    if (!sharedDriveId) {
      throw new Error("GOOGLE_SHARED_DRIVE_ID is not set. Create a Shared Drive, add the service account as Content Manager, and set its ID in Convex (see docs/GOOGLE_SHEETS_SETUP.md).");
    }
    const url = await buildSheet(auth, sharedDriveId, property, comps || [], feaso);
    await ctx.runMutation(internal.properties.setFisoSheet, { id: propertyId, url: url.url, sheetId: url.id });
    return { url: url.url };
  },
});

// Create a FISO spreadsheet inside a Shared Drive and populate its four tabs.
// Service accounts have no personal Drive storage, so we create the file via
// the Drive API into a Shared Drive rather than Sheets `spreadsheets.create`.
async function buildSheet(auth: any, sharedDriveId: string, property: any, comps: any[], feaso: any) {
  const title = `FISO — ${property.address}${property.suburb ? `, ${property.suburb}` : ""}`;

  // 1. Blank spreadsheet in the Shared Drive.
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,webViewLink",
    { method: "POST", headers: auth, body: JSON.stringify({ name: title, mimeType: "application/vnd.google-apps.spreadsheet", parents: [sharedDriveId] }) }
  );
  if (!createRes.ok) throw new Error(`Drive create failed (${createRes.status}): ${await createRes.text()}`);
  const file = await createRes.json();
  const id = file.id as string;
  const url = file.webViewLink || `https://docs.google.com/spreadsheets/d/${id}/edit`;

  // 2. Name the four tabs (a new sheet starts with one default tab).
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties(sheetId,title)`, { headers: auth });
  const firstSheetId = (await metaRes.json())?.sheets?.[0]?.properties?.sheetId ?? 0;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ requests: [
      { updateSheetProperties: { properties: { sheetId: firstSheetId, title: "Property Assessment" }, fields: "title" } },
      { addSheet: { properties: { title: "Comps" } } },
      { addSheet: { properties: { title: "Feasibility" } } },
      { addSheet: { properties: { title: "Cashflow" } } },
    ] }),
  });

  // 3. Populate (USER_ENTERED so formulas evaluate).
  const valuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: [
      { range: "'Property Assessment'!A1", values: assessmentTab(property) },
      { range: "'Comps'!A1", values: compsTab(comps) },
      { range: "'Feasibility'!A1", values: feasibilityTab(property, feaso) },
      { range: "'Cashflow'!A1", values: cashflowTab(property, feaso) },
    ] }),
  });
  if (!valuesRes.ok) throw new Error(`Sheets populate failed (${valuesRes.status}): ${await valuesRes.text()}`);

  return { url, id };
}
