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
