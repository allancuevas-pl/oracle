# Oracle — Current State (living handoff)

> **This is the only doc that changes often. Update it at the end of every working session** so the next agent — in any tool — can start cold. Keep it a snapshot of *now*, not a changelog: prune what's no longer true. For rules see [../CLAUDE.md](../CLAUDE.md), the map [ARCHITECTURE.md](ARCHITECTURE.md), the runbook [WORKFLOW.md](WORKFLOW.md).

**Last updated:** 2026-07-08 · branch `claude-code/main`

## Shipped & live

- **CRM Spine** — clients, briefs, properties, matches pipeline, activity feed, record workspaces. (Stage 1+.)
- **Comp database** — ~262k comps loaded to both deployments. 4,531 hand-curated (team) comps are the default view; Arealytics (~258k) and historical imports behind a `source` dropdown. Paginated browse + address search index. Importer: `AG-ORACLE/comp-importer/` (Python).
- **IM scanner** — upload IM PDF → Claude extraction → create property. Browser-side photo extraction from the IM (pdf.js) with hard-won reliability fixes.
- **Property photos** — extract-from-IM, plus manual **add / delete**, hero+thumbnail gallery, keyboard lightbox, and "Pull from IM" backfill. On property detail + scan result; first photo shows as a list thumbnail. (2026-06-16)
- **Property videos** — new **Videos tab**: hosted links (YouTube/Vimeo/Loom, embedded) + file uploads, add/delete. Surfaced to clients as a "Walkthrough" section in the deal portal. (2026-07-06)
- **Client portal** — token-gated deal reports; clients see only their shared deals and can approve/decline.
- **Feaso & Reports** — feasibility model + branded report send-to-client flow.

## In flight / next up

- **Client portal — branded login `/portal` (built + DEPLOYED live 2026-07-08).** Pixel-perfect build of the Property Lions design handoff (`AG-ORACLE/design_handoff_client_portal_login/`): ceremonial navy (`#0A1220`) / gold (`#D9A82E`) single-column, Marcellus title + Jost body, logo at `public/property-lions-logo.png` (pulled from the PL marketing site — swap for the official asset if they send one). New `src/pages/client/ClientPortalLogin.jsx` wired to Clerk **`useSignIn()`** (custom email+password flow, not the Clerk `<SignIn>` card) + a working forgot-password reset (reset_password_email_code) + "Request access" mailto. Routing: new `/portal` route (`ClientPortalEntry` — signed-out shows login, signed-in → `/client/dashboard`); logged-out `/client/*` now redirects to `/portal` (was the staff ORACLE login); client Clerk invites now use `redirect_url=.../portal`. Verified signed-out in preview (screenshot + computed-style checks all match spec; `:focus` gold border wired but unverifiable headless). **BLOCKER to actually authenticate (screen is live, sign-in is not yet functional): the Clerk instance must have PASSWORD sign-in enabled and invited clients must have a password set — currently DEV keys, prod Clerk instance still pending. If password isn't enabled, the form shows Clerk's error inline; swap to email-code strategy if preferred.** Fonts Marcellus+Jost added to `index.html`.
- **Client portal — AML compliance documents (built + DEPLOYED live 2026-07-08).** Will asked the team to upload AML/compliance docs per client (property access comes later). Staff upload/list/delete on the client record (ClientView center column, `components/clients/ClientDocuments.jsx`); client sees a read-only "Compliance documents" section in their portal (`ClientDashboard`, alongside deals — both surfaces kept). Backend: new `clientDocuments` table + `convex/clientDocuments.ts` (staff CRUD, `v.id("_storage")` files, `shapeDocsWithUrls` helper); client read is `clientPortal.getMyDocuments` (email-scoped, allowlisted in `check-authz.js`). Portal-invite management (invite / **revoke & resend** / revoke-active-access) consolidated into `components/clients/ClientPortalAccess.jsx` (left column), backed by new `team.getClientPortalStatus` + `team.resendPortalInvite`; the old header "Invite to Portal" button was removed. **Deploy status: `convex codegen` pushed schema+functions to `colorless-condor-502` only (additive, backward-compatible). Still TODO to go live: `npx convex deploy --yes` (prod Convex) → `vercel --prod` → alias.** Not yet visually verified behind Clerk auth (no client login creds in the build harness); build + typecheck + authz gate all green.
- **Feaso Cashflow tab** — the standout unbuilt core feature. Likely the next big piece.
- **Arealytics comp import polish** — loaded, but lease $/sqm not computed (source building-size ≠ leased area); revisit if needed.
- **Quick wins:** staff portal invites; lease-expiry column in the property evidence table; `CustomSelect` `aria-labelledby` a11y; video count/thumbnail on the property list rows.

## Known gotchas / tech debt (don't regress)

- **Photo extraction** (`utils/pdfPhotos.js`): per-image decode needs a mandatory ~2s timeout (pdf.js never fires the callback for undecodable images → silent infinite hang); rank candidates by JPEG byte size not pixel area; reject blank/near-white images; bounded work (≤12 photos, ≤50 images, ≤25 pages).
- **Photo/video delete orphans the storage file** — delete only drops the id from the array; the underlying Convex file remains (deliberate, avoids breaking refs shared between an extraction and its property). A cleanup pass could reclaim these later.
- **Two Convex deployments** — always deploy to both (see WORKFLOW.md). `colorless-condor-502` is the one Vercel prod actually reads.
- **Deploys are manual; the live site can lag the repo.** No Git auto-deploy — production only updates when someone runs `vercel --prod` + moves the alias (WORKFLOW.md → Deploy). **Deployed 2026-07-08** (deployment `oracle-3plr5nfes`, aliased to `oracle-psi-beryl.vercel.app`): this session's work + the prior ~10-day backlog are now live.

## Outstanding — user actions (not code)

- **Rotate the leaked GitHub PAT** at github.com/settings/tokens (still compromised until done). After rotating, clear the stale keychain entry so git re-prompts.
- **Clerk production instance** — app still runs on Clerk DEV keys; needs a prod instance before real external users.
- **Invoices** — Stage 2+3 ($12k) are user-side billing actions.

## Pointers

- Backlog / meeting notes: `AG-ORACLE/BACKLOG.md`, `AG-ORACLE/meetings/` (outside the repo).
- Deep architecture history: `AG-ORACLE/oracle-architecture-summary.md` (dated 2026-05-22; this doc set supersedes it for current truth).
