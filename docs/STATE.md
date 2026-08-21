# Oracle — Current State (living handoff)

> **This is the only doc that changes often. Update it at the end of every working session** so the next agent — in any tool — can start cold. Keep it a snapshot of *now*, not a changelog: prune what's no longer true. For rules see [../CLAUDE.md](../CLAUDE.md), the map [ARCHITECTURE.md](ARCHITECTURE.md), the runbook [WORKFLOW.md](WORKFLOW.md).

**Last updated:** 2026-08-21 · branch `claude-code/main`

## Shipped & live

- **CRM Spine** — clients, briefs, properties, matches pipeline, activity feed, record workspaces. (Stage 1+.)
- **Comp database** — ~262k comps loaded to both deployments. 4,531 hand-curated (team) comps are the default view; Arealytics (~258k) and historical imports behind a `source` dropdown. Paginated browse + address search index. Importer: `AG-ORACLE/comp-importer/` (Python).
- **IM scanner** — upload IM PDF → Claude extraction → create property. Browser-side photo extraction from the IM (pdf.js) with hard-won reliability fixes.
- **Property photos** — extract-from-IM, plus manual add / delete, hero+thumbnail gallery, keyboard lightbox, "Pull from IM" backfill. (2026-06-16)
- **Property videos** — Videos tab: hosted links (YouTube/Vimeo/Loom) + uploads; surfaced to clients as a "Walkthrough" in the deal portal. (2026-07-06)
- **Client portal** — token-gated deal reports; clients see only their shared deals and can approve/decline.
- **Client portal — branded `/portal` login** — ceremonial navy/gold single-column (Marcellus + Jost), `src/pages/client/ClientPortalLogin.jsx`: **email+password, Google, forgot-password reset, AND first-time invitation accept all functional** on the prod Clerk instance. The invite-accept flow ('accept' mode) consumes Clerk's `__clerk_ticket` via `useSignUp()` and shows a branded "Set Your Password" step — without it invited clients hit "can't find account" (fixed 2026-07-23). Signed-out `/client/*` redirects to `/portal`. (2026-07-08; unblocked by the prod-Clerk cutover 2026-07-23.)
- **Client portal — AML compliance documents** — staff upload/list/delete per client (`components/clients/ClientDocuments.jsx`); client sees a read-only "Compliance documents" section (`ClientDashboard`). Backend: `clientDocuments` table + `convex/clientDocuments.ts`; client read `clientPortal.getMyDocuments` (email-scoped). Portal-invite management (invite / revoke & resend / revoke access) in `components/clients/ClientPortalAccess.jsx`. (2026-07-08) **Enhanced 2026-07-23:** the panel now shows the TRUE Clerk invitation status (Not invited / Invited·pending / Accepted / Active / Revoked / Expired) with dates, via new `team.getPortalInviteDetail` action (reads Clerk's REST invitations API; validated against live data). Local-table status was misleading (pending row deleted on sign-in + seeded during cutover); Clerk is now the source of truth, with graceful fallback to local if the fetch fails.
- **Feaso & Reports** — feasibility model + branded report send-to-client flow.
- **🚀 PRODUCTION LAUNCH — live on `oracle.propertylions.com.au` behind Clerk PRODUCTION (2026-07-23).** One host: staff CRM at the root, client portal at `/portal`. DNS on **GoDaddy** (6 CNAMEs, verified). Own Google OAuth, password + email-code, waitlist off, `convex` JWT template present. Invite URLs + JWT issuer are now env-driven (`convex/team.ts` `inviteRedirectUrl()`, `convex/auth.config.ts`). The empty-prod-Clerk-DB lockout was prevented by `convex/migrations.ts` `seedInvitationsForClerkCutover` (ran: 4 users seeded). **Verified end-to-end incl. a real admin sign-in.** Full runbook, env inventory, rollback, and deploy gotchas: **[CLERK_PRODUCTION.md](CLERK_PRODUCTION.md)**.
- **Favicon** — Property Lions gold lion crest on navy (was the scaffolded Convex logo). `public/favicon.ico` + `favicon-16/32/192.png` + `apple-touch-icon.png`, generated from `public/property-lions-logo.png` (crest only). (2026-07-23)

## In flight / next up

- **Directory tab — BUILT + DEPLOYED live (2026-08-21).** Will's Jul-31 request: one searchable place for clients + agents + contractors/inspectors + solicitors + brokers, filter by category + state. New `contacts` table + `convex/contacts.ts` (CRUD, indexed); `src/pages/Directory.jsx` (aggregates live clients + the new contacts store) + `components/directory/ContactModal.jsx`; `/directory` route + Sidebar item. Live on both Convex deployments + both Vercel domains (deployment `oracle-ntwf8e5o6`). `/directory` serves 200 on the custom domain. **Not yet visually verified behind CRM auth** (build/lint/authz-gate/query-guard all green; app boots clean).
- **Comp Scanner — BUILT + DEPLOYED live (2026-08-21).** Will's Aug-21 request ("comps scanner like the IM scanner"). "Scan Comps" on the Comps page: upload an agent's comp table (PDF/screenshot) or paste text → `compExtractionAction.extractComps` (Claude, Node action) parses to our comps shape → review table → bulk import via `comps.createComps`. New `comp_scan` source. Verified end-to-end vs the live model (mixed sale+lease table extracted cleanly). `components/comps/CompScannerModal.jsx`.
- **Meeting backlog (from Will, cross-checked 2026-07-23/08-21 vs live).** Still unbuilt, roughly in Will's priority order: (1) **DD task-management / pipeline checklist** — task assignment, client-visible progress, contract important-dates, email reminders (Will's Jul-31 #1; he saw it in Allan's *other* system, not Oracle). (2) ~~Directory~~ ✅ built above. ~~(3) Building-grade field~~ ✅ (Prime/A/B/C on comps — form + list column, 2026-08-21). ~~(4) Comps summary State column~~ ✅ (added 2026-08-21). (5) **Feaso Cashflow (10-yr model)** — the Cashflow sub-tab is a placeholder stub. (6) **FEASO next**: per Aug-21 Will wants FISO → an editable **Google Sheet** export (AI pre-fills comps/tenancy/cashflow), NOT a full in-app 10-yr calculator. Also new from Aug-21: **deal-vault access restrictions**, **email automations**, **lease-stock calculator** (property tab, low priority, pending Nick), **custom dropdown component** (native selects show white-on-white on PC — affects new Grade/State/Category selects), and ~10 minor updates pending a Loom from Will (client-profile fields, "Other" property type in briefs). Deferred/agreed-non-essential: **map view for comps**, **Aerolytics API** (Will to re-evaluate vendor first). Provenance: `AG-ORACLE/Google Meet Notes/` (Jun-26, Jul-03, Jul-31 PDFs).
- **Feaso Cashflow tab** — only the **Cashflow** sub-tab is a stub ("Coming in the next phase"); Property Assessment + Project Feasibility are already built. (Property tabs wired inline in `src/pages/PropertyView.jsx`; see ARCHITECTURE.md "Common change: add a property-detail tab".)
- **Invite a real client through the live portal** — the plumbing is verified end-to-end, but no genuine external client has been onboarded on prod yet. Good first confidence check next session.
- **Arealytics comp import polish** — loaded, but lease $/sqm not computed (source building-size ≠ leased area); revisit if needed.
- **Quick wins:** staff portal invites; lease-expiry column in the property evidence table; `CustomSelect` `aria-labelledby` a11y; video count/thumbnail on the property list rows.

## Known gotchas / tech debt (don't regress)

- **Deploy aliases BOTH domains.** `vercel --prod` does NOT auto-move the custom domain `oracle.propertylions.com.au` — alias both it AND `oracle-psi-beryl.vercel.app` to the new deployment every time, then verify a deep link (`/portal`) returns 200 on the custom domain, not just `/`. (WORKFLOW.md step 4.)
- **`CLERK_JWT_ISSUER_DOMAIN` must stay set on both Convex deployments.** `auth.config.ts` references it, and Convex statically requires any referenced env var to be *set* at deploy time — the `|| fallback` does NOT satisfy the check, so `convex dev --once` / `convex deploy` fail if it's ever unset. (CLERK_PRODUCTION.md.)
- **Clerk instance swap logs everyone out once** — expected on any dev→prod cutover (old sessions carry dev tokens). Not a bug.
- **Photo extraction** (`utils/pdfPhotos.js`): per-image decode needs a mandatory ~2s timeout (pdf.js never fires the callback for undecodable images → silent infinite hang); rank candidates by JPEG byte size not pixel area; reject blank/near-white images; bounded work (≤12 photos, ≤50 images, ≤25 pages).
- **Photo/video delete orphans the storage file** — delete only drops the id from the array; the underlying Convex file remains (deliberate, avoids breaking shared refs). A cleanup pass could reclaim these later.
- **Two Convex deployments** — always deploy to both (see WORKFLOW.md). `colorless-condor-502` is the one Vercel prod actually reads.
- **Deploys are manual; the live site can lag the repo.** Latest prod deploy: **`oracle-aepi64jbq`** (2026-08-21, comp scanner), both domains aliased.

## Outstanding — user actions (not code)

- **Rotate the leaked GitHub PAT** at github.com/settings/tokens (still compromised until done). After rotating, clear the stale keychain entry so git re-prompts.
- **Invoices** — Stage 2+3 ($12k) are user-side billing actions.
- **Bump GoDaddy DNS TTLs back up** — dropped to 600s/1800s during the launch for fast validation; raise now that DNS is stable. Minor.

## Pointers

- Production launch runbook: [CLERK_PRODUCTION.md](CLERK_PRODUCTION.md).
- Backlog / meeting notes: `AG-ORACLE/BACKLOG.md`, `AG-ORACLE/meetings/` (outside the repo).
- Deep architecture history: `AG-ORACLE/oracle-architecture-summary.md` (dated 2026-05-22; this doc set supersedes it for current truth).
