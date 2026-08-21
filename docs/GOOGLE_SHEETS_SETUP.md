# Oracle — Google Sheets (FISO export) setup

> One-time setup so Oracle can generate a **FISO Google Sheet** in your Google
> Drive from a property's data. Companion to the code in
> `convex/googleSheets.ts`. Your part is the Google Cloud service account + the
> two Convex env vars; the agent wires and tests the rest.

## What Oracle does with this
A Convex action authenticates as a **service account**, creates a Google Sheet
(tabs: Property Assessment, Comps, Feasibility, Cashflow) pre-filled from the
property + tenancy + linked comps + feaso inputs, shares it to your team, and
returns the live URL. You then download / customize the sheet as usual.

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

## Sharing model (default)
Generated sheets are **owned by the service account** and shared **editor
access to the `propertylions.com.au` domain**, so any signed-in team member can
open + edit via the link. They appear under Drive → "Shared with me", not each
person's own Drive.

- To have sheets created *inside* a specific person's own Drive instead, that
  needs **domain-wide delegation** (a Workspace-admin step authorizing the
  service account's client ID for the Sheets + Drive scopes). Deferred — ask if
  you want it.
- **Storage note:** a service account has limited Drive storage. FISO sheets are
  tiny, so this is fine for a long time; if it ever fills, old sheets can be
  pruned or we move to domain-wide delegation (which uses the user's storage).

## After you've set the env vars
Tell the agent — it will run an end-to-end test (generate a sheet from a real
property, confirm the URL opens and the tabs are populated) and report back.
