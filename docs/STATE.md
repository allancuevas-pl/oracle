# Oracle — Current State (living handoff)

> **This is the only doc that changes often. Update it at the end of every working session** so the next agent — in any tool — can start cold. Keep it a snapshot of *now*, not a changelog: prune what's no longer true. For rules see [../CLAUDE.md](../CLAUDE.md), the map [ARCHITECTURE.md](ARCHITECTURE.md), the runbook [WORKFLOW.md](WORKFLOW.md).

**Last updated:** 2026-07-23 · branch `claude-code/main`

## Shipped & live

- **CRM Spine** — clients, briefs, properties, matches pipeline, activity feed, record workspaces. (Stage 1+.)
- **Comp database** — ~262k comps loaded to both deployments. 4,531 hand-curated (team) comps are the default view; Arealytics (~258k) and historical imports behind a `source` dropdown. Paginated browse + address search index. Importer: `AG-ORACLE/comp-importer/` (Python).
- **IM scanner** — upload IM PDF → Claude extraction → create property. Browser-side photo extraction from the IM (pdf.js) with hard-won reliability fixes.
- **Property photos** — extract-from-IM, plus manual add / delete, hero+thumbnail gallery, keyboard lightbox, "Pull from IM" backfill. (2026-06-16)
- **Property videos** — Videos tab: hosted links (YouTube/Vimeo/Loom) + uploads; surfaced to clients as a "Walkthrough" in the deal portal. (2026-07-06)
- **Client portal** — token-gated deal reports; clients see only their shared deals and can approve/decline.
- **Client portal — branded `/portal` login** — ceremonial navy/gold single-column (Marcellus + Jost), `src/pages/client/ClientPortalLogin.jsx` on Clerk `useSignIn()`: **email+password, Google, and forgot-password reset all now functional** on the prod Clerk instance. Signed-out `/client/*` redirects to `/portal`. (2026-07-08; unblocked by the prod-Clerk cutover 2026-07-23.)
- **Client portal — AML compliance documents** — staff upload/list/delete per client (`components/clients/ClientDocuments.jsx`); client sees a read-only "Compliance documents" section (`ClientDashboard`). Backend: `clientDocuments` table + `convex/clientDocuments.ts`; client read `clientPortal.getMyDocuments` (email-scoped). Portal-invite management (invite / revoke & resend / revoke access) in `components/clients/ClientPortalAccess.jsx`. Live on both deployments. (2026-07-08)
- **Feaso & Reports** — feasibility model + branded report send-to-client flow.
- **🚀 PRODUCTION LAUNCH — live on `oracle.propertylions.com.au` behind Clerk PRODUCTION (2026-07-23).** One host: staff CRM at the root, client portal at `/portal`. DNS on **GoDaddy** (6 CNAMEs, verified). Own Google OAuth, password + email-code, waitlist off, `convex` JWT template present. Invite URLs + JWT issuer are now env-driven (`convex/team.ts` `inviteRedirectUrl()`, `convex/auth.config.ts`). The empty-prod-Clerk-DB lockout was prevented by `convex/migrations.ts` `seedInvitationsForClerkCutover` (ran: 4 users seeded). **Verified end-to-end incl. a real admin sign-in.** Full runbook, env inventory, rollback, and deploy gotchas: **[CLERK_PRODUCTION.md](CLERK_PRODUCTION.md)**.
- **Favicon** — Property Lions gold lion crest on navy (was the scaffolded Convex logo). `public/favicon.ico` + `favicon-16/32/192.png` + `apple-touch-icon.png`, generated from `public/property-lions-logo.png` (crest only). (2026-07-23)

## In flight / next up

- **Feaso Cashflow tab** — the standout unbuilt core feature. **The next big piece.** (Property tabs are wired inline in `src/pages/PropertyView.jsx`; see ARCHITECTURE.md "Common change: add a property-detail tab".)
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
- **Deploys are manual; the live site can lag the repo.** Latest prod deploy: **`oracle-kzuskxurb`** (2026-07-23, favicon), both domains aliased.

## Outstanding — user actions (not code)

- **Rotate the leaked GitHub PAT** at github.com/settings/tokens (still compromised until done). After rotating, clear the stale keychain entry so git re-prompts.
- **Invoices** — Stage 2+3 ($12k) are user-side billing actions.
- **Bump GoDaddy DNS TTLs back up** — dropped to 600s/1800s during the launch for fast validation; raise now that DNS is stable. Minor.

## Pointers

- Production launch runbook: [CLERK_PRODUCTION.md](CLERK_PRODUCTION.md).
- Backlog / meeting notes: `AG-ORACLE/BACKLOG.md`, `AG-ORACLE/meetings/` (outside the repo).
- Deep architecture history: `AG-ORACLE/oracle-architecture-summary.md` (dated 2026-05-22; this doc set supersedes it for current truth).
