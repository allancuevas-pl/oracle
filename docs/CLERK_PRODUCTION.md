# Oracle — Clerk Production Cutover Runbook

> Step-by-step for moving Oracle from the Clerk **development** instance to a
> **production** instance on `oracle.propertylions.com.au`.
> Companion to [WORKFLOW.md](WORKFLOW.md) (deploy) and [STATE.md](STATE.md) (status).
>
> **Target domain:** `oracle.propertylions.com.au` — one host, staff CRM at the
> root, client portal at `/portal`. **DNS host:** GoDaddy.

## Before you start — the four traps

Read these first. Each one silently breaks auth, and two of them are hard to
diagnose after the fact.

1. **The `convex` JWT template.** `convex/auth.config.ts` sets
   `applicationID: "convex"`. That must match a JWT template named **exactly**
   `convex` in the Clerk instance. A production instance created *without*
   cloning development will not have it, and every Convex call will fail
   authentication. → **Clone from development in Step 1**, then verify in Step 7.
2. **Everyone gets locked out on the issuer flip.** A prod instance has an empty
   user database. See the lockout section in [STATE.md](STATE.md) — the agent
   must run `migrations:seedInvitationsForClerkCutover` **before** the flip.
3. **Clerk's setup checklist defaults to Next.js — Oracle is React + Vite.**
   The checklist's "Set up environment variables" panel shows
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Oracle reads
   **`VITE_CLERK_PUBLISHABLE_KEY`** (`src/main.jsx:9`). Switch the framework
   dropdown to React/Vite, or copy only the *values* and ignore Clerk's variable
   names. Pasting that snippet verbatim makes the app throw
   "Missing Publishable Key" at boot.
4. **`VITE_` env vars are baked in at build time.** `src/main.jsx` reads
   `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY`, which Vite inlines into the
   bundle during `vite build`. Changing it in the Vercel dashboard does nothing
   until a **fresh `vercel --prod` build**. Changing it and only moving the alias
   will leave the old dev key live.

---

## Step 1 — Create the production instance

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) → select the
   **ORACLE** application.
2. Click **"Go to prod"** — the purple button in the **top right** of the
   header. (Not *Configure → Domains*: that page belongs to the Development
   instance and only ever shows `model-redbird-53.clerk.accounts.dev`. The
   instance switcher beside the app name, reading *"Development"*, is how you
   move between the two once production exists.)
3. A **Create production instance** modal appears asking for the **Application
   domain**. The field already has a fixed `https://` prefix, so enter the bare
   domain — `oracle.propertylions.com.au` — and click **Create Instance**.
   (This is also Step 2; the modal collects the domain up front.)
4. The modal then asks **Primary application or Secondary application** for
   `propertylions.com.au`. **Choose Primary** (the default). DECIDED 2026-07-23.
   - **Why:** the portal is client-facing. Primary sends verification and
     password-reset email from `@propertylions.com.au` — the domain buyers
     recognise, with existing sending reputation. Secondary would send from
     `@oracle.propertylions.com.au`, a brand-new subdomain with no reputation
     (spam risk) and an internal project name clients do not recognise.
   - Primary hosts Clerk's API at `clerk.propertylions.com.au`; Secondary would
     nest it at `clerk.oracle.propertylions.com.au` and prefix every DNS record
     name with `.oracle`. The record names in Step 3 assume **Primary**.
   - Clerk's DKIM selectors (`clk._domainkey`, `clk2._domainkey`) do not collide
     with Google Workspace or Microsoft 365 selectors, and `clkmail` is a
     separate subdomain — so this does not disturb PL's existing email. The apex
     DKIM records are what make DMARC alignment pass when sending as
     `@propertylions.com.au`.
5. **There is no "clone from development" option** — Clerk copies the dev
   instance's configuration automatically. Because you cannot request it
   explicitly, treat **Step 7 (verify the `convex` JWT template) as mandatory**,
   not a formality. Social-login credentials do *not* carry over; that is Step 5.

> **Plan note:** the app sits in a **Personal workspace** on the **Hobby** (free)
> plan. That is sufficient here — one *primary* domain is included. **Satellites**
> is Pro-gated, and satellites are what running two domains (`app.` + `portal.`)
> off one Clerk instance would require. The single-host decision
> (`oracle.propertylions.com.au`, staff at root + clients at `/portal`) avoids
> that cost. If anyone later proposes splitting the surfaces onto separate
> domains, that is a paid-plan change, not just a DNS change.

## Step 2 — Set the production domain

The "Go to prod" flow usually asks for the domain as part of creation. If it
does, enter it there and skip to Step 3. Otherwise:

1. Confirm the instance switcher now reads **Production**, then go to
   *Configure → Domains* (the same page as the dev one, but for this instance).
2. Enter: `oracle.propertylions.com.au`
3. Clerk generates a set of DNS records and shows them with a verification
   status. Leave this page open — Step 3 uses it.

## Step 3 — Add the DNS records in GoDaddy ✅ DONE 2026-07-23

> All six records were added and **verified live** against the authoritative
> nameserver (`dig @pdns09.domaincontrol.com … CNAME`), and Clerk's own
> **DNS configuration now reads "Verified" (5/5)**. Existing records
> confirmed untouched: Google Workspace MX, all three apex A records, `www`,
> and the apex SPF. Mailgun's SPF/MX correctly live on `mg.propertylions.com.au`.
>
> Notes for next time: GoDaddy hides native `<select>` elements
> (`#dnsRecordIdDropdown`, `#ttl`) under a custom skin, so clicks on the visible
> control do nothing. GoDaddy's TTL dropdown has **no 600s option** — minimum is
> 1800s (1/2 Hour) unless you pick "custom"; 1800 was used. Saving 6 records
> triggered an **SMS 2FA challenge** to the account holder's phone.



GoDaddy → **My Products** → `propertylions.com.au` → **DNS** → **Manage Zones**
→ *Add New Record*.

> **GoDaddy gotcha — the Name field is relative.** Enter `oracle`, **not**
> `oracle.propertylions.com.au`. Pasting the full name produces
> `oracle.propertylions.com.au.propertylions.com.au`. This is the single most
> common mistake here.
>
> Set **TTL to 600 seconds** (1 hour is the default) while validating so failed
> attempts retry quickly. Raise it once everything is green.

Add all six records. **Actual values for this instance** (hash `sm3z3obqho51`,
read from the Clerk dashboard 2026-07-23) — all type **CNAME**:

| Type | Name | Value | Purpose |
|---|---|---|---|
| CNAME | `oracle` | `cname.vercel-dns.com` | Vercel — serves the app |
| CNAME | `clerk` | `frontend-api.clerk.services` | Clerk Frontend API |
| CNAME | `accounts` | `accounts.clerk.services` | Clerk hosted account pages |
| CNAME | `clkmail` | `mail.sm3z3obqho51.clerk.services` | Clerk transactional email |
| CNAME | `clk._domainkey` | `dkim1.sm3z3obqho51.clerk.services` | DKIM signing |
| CNAME | `clk2._domainkey` | `dkim2.sm3z3obqho51.clerk.services` | DKIM signing |

The `sm3z3obqho51` hash is **instance-specific** — if the instance is ever
recreated, re-read these from the dashboard rather than reusing the table.

Notes:
- `clk._domainkey` / `clk2._domainkey` contain a leading underscore in the
  middle segment. Enter them exactly. GoDaddy accepts underscores in CNAME
  names; if a record refuses to save, that is the first thing to suspect.
- **The marketing site and email are safe.** All six are *subdomain* CNAMEs —
  none touches the apex `propertylions.com.au` A record or the MX records.
- Skip Clerk's **Download zone file**: GoDaddy's standard UI has no zone-file
  import. Manual entry only. Ignore **Proxy configuration** (optional, unused).
- Check none of these names already exist before adding.

**Your existing email is safe.** Every Clerk record above is a *subdomain
CNAME*. None of them touch the `propertylions.com.au` MX records, so Property
Lions' mail keeps working untouched.

Back in Clerk, click **Verify**. Propagation is usually minutes but can take
longer; the page will keep showing pending until it resolves.

## Step 4 — Add the domain in Vercel

1. Vercel → team **property-lions** → project **oracle-app** → **Settings** →
   **Domains**.
2. Add `oracle.propertylions.com.au`.
3. Vercel will confirm the `CNAME` from Step 3 and issue a TLS certificate
   automatically. Wait for *Valid Configuration*.

## Step 5 — Your own Google OAuth app

Production Clerk cannot use Clerk's shared development Google credentials, so
"Continue with Google" on `/portal` will break until this is done.

1. [console.cloud.google.com](https://console.cloud.google.com) → select (or
   create) a project for Property Lions.
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in app
   name, support email, and the `propertylions.com.au` authorised domain.
   Publish it (in *Testing* mode only allowlisted accounts can sign in).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type **Web application**.
4. For **Authorised redirect URIs**, paste the callback URL that Clerk shows on
   its Google provider page (Step 6). With Primary selected this is
   `https://clerk.propertylions.com.au/v1/oauth_callback` — but confirm against
   Clerk's displayed value rather than typing it from here.
5. Copy the **Client ID** and **Client Secret**.

## Step 6 — Enable sign-in methods in Clerk

In the **production** instance:

1. **User & Authentication → Social Connections → Google**: enable it, turn
   **off** "Use shared credentials" (label may read *Use custom credentials*),
   and paste the Client ID + Secret from Step 5. This page also shows the exact
   redirect URI needed for Step 5.4.
2. **User & Authentication → Email, Phone, Username**:
   - Email address: **enabled**, and set as a sign-in identifier.
   - Under authentication strategies, enable **Password**.
   - Also enable **Email verification code**.

   Password is what unblocks the email+password form and the forgot-password
   reset flow on `/portal` (both are already built — see STATE.md).

## Step 7 — Verify the `convex` JWT template ✅ DONE 2026-07-23

> Confirmed present in the production instance (template `convex`, id
> `jtmp_3GtIkeiRC7YhOqX9PyeBKzeCVg1`, created 2026-07-23 — i.e. Clerk did carry
> it over on instance creation). Trap #1 cleared.

**Do not skip.** This is trap #1.

1. Production instance → **JWT Templates**.
2. Confirm a template named exactly **`convex`** exists (lowercase). If cloning
   carried it over, it will be there. If not, create it: **New template** →
   choose the **Convex** preset → save without renaming.
3. Open it and copy the **Issuer** value. With Primary selected this is
   **`https://clerk.propertylions.com.au`** — already corroborated by the
   `pk_live_` key, which base64-decodes to `clerk.propertyl…`.
   **This is what goes into `CLERK_JWT_ISSUER_DOMAIN`.**

## Step 8 — Collect the keys and hand them over

Production instance → **API Keys**:

| Value | Looks like | Destination |
|---|---|---|
| Publishable key | `pk_live_…` | Vercel env `VITE_CLERK_PUBLISHABLE_KEY` |
| Secret key | `sk_live_…` | Convex env `CLERK_SECRET_KEY` |
| JWT issuer (Step 7) | `https://clerk.oracle…` | Convex env `CLERK_JWT_ISSUER_DOMAIN` |

The secret key is a credential — hand it over through the Convex dashboard
directly rather than pasting it into a repo file or a chat log.

---

## Then — the agent's cutover sequence

Handled in code once the above is green. Order matters:

1. Set `APP_URL = https://oracle.propertylions.com.au` in Convex
   `colorless-condor-502`. (Only this one is needed — `PORTAL_URL` falls back to
   it, and client invites resolve to `APP_URL + /portal`.)
2. **Run `migrations:seedInvitationsForClerkCutover` with `{ dryRun: true }`,
   review the output, then run it for real.** This must happen *before* step 3
   or everyone, including every admin, is locked out.
3. Set `CLERK_SECRET_KEY` and `CLERK_JWT_ISSUER_DOMAIN` in Convex.
4. Set `VITE_CLERK_PUBLISHABLE_KEY` in Vercel.
5. Full 4-step deploy per [WORKFLOW.md](WORKFLOW.md) — `npx convex dev --once`
   → `npx convex deploy --yes` → `vercel --prod --yes` → `vercel alias …`.
   The Vercel build is mandatory here, not optional (trap #3).
   - **Convex auth-config gotcha:** Convex statically requires any env var
     referenced in `auth.config.ts` to be *set* at deploy time — the JS
     `|| fallback` does NOT satisfy it. So `CLERK_JWT_ISSUER_DOMAIN` must be set
     (to the dev value first, if you want a no-op push) before `convex dev --once`
     will succeed. Set it on **both** deployments (`--prod` for 695).
   - **Vercel custom-domain gotcha:** `vercel --prod` moved `oracle-psi-beryl`
     but did NOT auto-move the custom domain `oracle.propertylions.com.au` — it
     stayed on an older deployment (root 200 but `/portal` 404, i.e. a build
     predating `vercel.json`'s SPA rewrite). Fix: explicitly
     `vercel alias <new-deployment> oracle.propertylions.com.au`. **Every future
     deploy must alias BOTH** `oracle-psi-beryl.vercel.app` AND
     `oracle.propertylions.com.au` to the new deployment.
6. Verify end to end: sign in at `oracle.propertylions.com.au`, confirm the
   staff role survived, then invite a test client and confirm the email links to
   `oracle.propertylions.com.au/portal`.

## Rollback

Unset `CLERK_JWT_ISSUER_DOMAIN` and `APP_URL` in Convex, restore the dev
`pk_test_…` in Vercel, redeploy, and run
`migrations:undoSeedInvitationsForClerkCutover`. Both code paths fall back to
the dev instance and `oracle-psi-beryl.vercel.app`, so the old setup returns
intact. The rollback matches on a sentinel, so genuine admin-issued invitations
are left alone.
