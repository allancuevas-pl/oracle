# Oracle — Google Sheets (FISO export) setup

> One-time setup so Oracle can generate a **FISO Google Sheet** in your Google
> Drive from a property's data. Companion to the code in
> `convex/googleSheets.ts`. Your part is the Google Cloud service account + the
> two Convex env vars; the agent wires and tests the rest.

## What Oracle does with this
A Convex action authenticates as a **service account**, **clones the master PL
FEASO template** (a Google Sheet in the Shared Drive), and fills in the cells
Oracle knows — report date, the subject-property summary row, and the linked
comparable leasing + sales evidence. Because it clones the real template, the
output inherits **every PL formula, cross-sheet reference, and format 1:1**
(Property Assessment, Project Feasibility, Cashflow Inputs & Analysis, Outgoings)
— it comes out looking like a hand-built PL FEASO, ~60% pre-filled, with the
analyst-judgment cells (adopted rents, refurb costs, cap-rate assumptions) ready
to complete. The sheet lands in the Shared Drive; the URL is saved on the property.

### The master template (`GOOGLE_FISO_TEMPLATE_ID`)
The template that gets cloned is a Google Sheet named **"PL FEASO Template
(master — do not edit)"** living in the `ORACLE FEASO` Shared Drive
(id `1o-q-vucFVKL0S5byTnPX9fU9FEoiKU1SdS5TIi6VXPI`, set as env var
`GOOGLE_FISO_TEMPLATE_ID` on both deployments). It's a cleaned copy of
`AG-ORACLE/Feaso Template.xlsx` (junk tabs stripped, 4 core tabs kept). **To
change the FEASO layout/formulas, edit that master sheet** — or upload a new
one and update `GOOGLE_FISO_TEMPLATE_ID`; the code does not hard-code the layout
beyond the fixed cell addresses it fills (subject row 8; leasing rows 12-31;
sales rows 34-57 on the `Property Assessment ` tab — note the trailing space).

## Your steps (Google Cloud)

You can reuse the **same Google Cloud project** you made for the Clerk OAuth app.

1. [console.cloud.google.com](https://console.cloud.google.com) → select that project.
2. **APIs & Services → Library** → enable **Google Sheets API** AND **Google Drive API** (both).
3. **APIs & Services → Credentials → Create credentials → Service account.**
   - Name: `oracle-fiso-sheets`. Skip the optional role grants. Create.
4. Open the new service account → **Keys → Add key → Create new key → JSON.**
   A `.json` file downloads. Open it — you need two values:
   - `client_email` (looks like `oracle-fiso-sheets@<project>.iam.gserviceaccount.com`)
   - `private_key` (a long `-----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY-----` block)
5. **Set two Convex env vars** (dashboard → deployment `colorless-condor-502`
   → Settings → Environment Variables). Do it on the **prod** deployment
   (`incredible-peccary-695`) too, for parity:
   - `GOOGLE_SA_CLIENT_EMAIL` = the `client_email`
   - `GOOGLE_SA_PRIVATE_KEY` = the full `private_key`, **including** the
     `-----BEGIN/END-----` lines. Paste it exactly as it appears in the JSON
     (with the `\n` sequences intact — the code converts them to real newlines).

That's it on your side. Hand the agent nothing secret — the key goes straight
into the Convex dashboard.

## Where sheets live — a Shared Drive (required)

Google removed service accounts' personal Drive storage, so the service account
cannot own files. Generated sheets must live in a **Shared Drive** the service
account is a member of:

1. [Google Drive](https://drive.google.com) → **Shared drives → New** → name it e.g. `Oracle FISO`.
2. Open it → **Manage members** → add the service-account email
   (`client_email` from step 4 above) as **Content manager**.
3. Copy the Shared Drive **ID** from its URL:
   `https://drive.google.com/drive/folders/<ID>` — the part after `/folders/`.
4. Set a third Convex env var (both deployments):
   - `GOOGLE_SHARED_DRIVE_ID` = that ID.

Sheets are created in this Shared Drive, so everyone with access to it sees +
edits them. This also survives staff changes (team-owned, not one person's Drive).

## After you've set the env vars
Tell the agent — it will run an end-to-end test (generate a sheet from a real
property, confirm the URL opens and the tabs are populated) and report back.
