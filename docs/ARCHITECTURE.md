# Oracle — Architecture Map

> The **map**: what Oracle is, how it's built, where things live. For coding rules see [../CLAUDE.md](../CLAUDE.md); for how to run/deploy see [WORKFLOW.md](WORKFLOW.md); for current status see [STATE.md](STATE.md).

## What Oracle is

Oracle is a custom commercial-property **deal-management platform** for **Property Lions** (a boutique Australian buyers' agency; director Will Tong). Contract: $24k AUD, delivery-gated stages over 12 weeks. Originally scaffolded in Google Antigravity, now built in Claude Code.

Three product pillars:
1. **The Spine** — CRM / pipeline management (clients, briefs, properties, matches, activity feed).
2. **Oracle** — drop an IM (Information Memorandum) PDF, get a structured extraction + matched comps + cap-rate signals. The headline "unlock" feature.
3. **Feaso & Reports** — feasibility calculator + branded, shareable client deal reports.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind, Framer Motion, React Hook Form + Zod |
| Backend | **Convex** (real-time DB + serverless functions + file storage) |
| Auth | **Clerk** — **PRODUCTION** instance on `clerk.propertylions.com.au` (live 2026-07-23; see docs/CLERK_PRODUCTION.md). Preview/PR builds still use the dev instance. |
| Hosting | **Vercel** (frontend), Convex Cloud (backend) |
| Fonts | Schibsted Grotesk (Google Fonts) |

Brand tokens: gold/brass `brand-500 = #D4AF37`, `brand-black #0A0A0A`, cream `brand-100 #F9F3E6`. Dark theme throughout. Design north-star ("The Private Deal Room") lives in [../DESIGN.md](../DESIGN.md).

## Repo layout

The **git repository root is `oracle-app/`** (repo: `github.com/allancuevas-pl/oracle`). Everything an agent needs is inside it.

Planning/source material lives one level up in `AG-ORACLE/` (parent of the repo, **not** version-controlled): `BACKLOG.md`, `oracle-architecture-summary.md` (older deep-dive), `oracle-antigravity-brief.md` (original doctrine), `meetings/` (client meeting PDFs), `IMs/` (sample IMs), `comp-importer/` (the Python comp importer). Reference these for history, but the repo docs here are the current source of truth.

```
oracle-app/                 # git root
  convex/                   # backend: schema + queries/mutations/actions
  src/
    pages/                  # route-level components (thin: routing + loading + empty states)
    components/
      <domain>/             # briefs/ properties/ clients/ pipeline/ reports/ oracle/
      layout/               # RecordWorkspace, Sidebar, Header, ClientLayout
      ui/                   # stateless primitives (IconButton, CustomSelect, Loading…)
    utils/                  # pure helpers (format.js, pdfPhotos.js, videoEmbed.js)
    hooks/                  # custom React hooks
  docs/                     # ARCHITECTURE / WORKFLOW / STATE (this set)
  CLAUDE.md  AGENTS.md  DESIGN.md  README.md  UI_STANDARDS.md
```

## Deployment topology

Two Convex deployments — **both must be kept in sync** (see [WORKFLOW.md](WORKFLOW.md)):
- **`colorless-condor-502`** — the "dev" deployment, but it is what **Vercel production actually points at** (via `VITE_CONVEX_URL`). Changes here go live.
- **`incredible-peccary-695`** — the "prod" Convex deployment (`npx convex deploy`).

Frontend: Vercel project **`oracle-app`** (Vercel team `property-lions`, so deploy URLs look like `oracle-<hash>-property-lions.vercel.app`; linkage in `.vercel/project.json`). Production domains (alias **both** on every deploy): the client-facing **`oracle.propertylions.com.au`** and the stable **`oracle-psi-beryl.vercel.app`**. **Deploys are manual** (`vercel --prod` from a machine) — there is no Git auto-deploy, so a `git push` alone does not update the live site (see [WORKFLOW.md](WORKFLOW.md) → Deploy). Convex is on the **Pro plan** under a *separate* team (`allan-cuevas`, per `.env.local`) — the Vercel team and the Convex team are different accounts; don't conflate them.

## Data model (Convex tables)

| Table | Holds |
|---|---|
| `users` | Clerk-linked users + role (`admin` / `staff` / `client` / `blocked`) |
| `pendingInvitations` | Gate that grants a real role on first sign-in (else `blocked`) |
| `clients` | Buyer clients (portal access keyed by email) |
| `briefs` | Client acquisition briefs (criteria) |
| `properties` | The core asset record — incl. `tenants`, `outgoings`, `photoIds`, `videos`, feaso link |
| `comps` | Sales/lease comparables (~262k rows; `source`: curated / arealytics / historical_import / im_scan) |
| `matches` | Junction: brief ↔ property with pipeline stage |
| `imExtractions` | One IM scan: storage id, Claude extraction result, `photoIds` |
| `dealReports` | Branded report shared to a client (token-gated), decision capture |
| `feasos` | Feasibility model per property |
| `activities` | Pulse/activity log per record |
| `settings`, `idCounters` | App settings + human-readable id sequences (e.g. `ORC-P0001`) |

## Key subsystems

- **IM scanner + photo pipeline** — `OracleScanner.jsx` uploads an IM → `imExtractionAction.ts` runs Claude extraction; browser-side `utils/pdfPhotos.js` extracts embedded photos (pdf.js) → Convex storage. See [../CLAUDE.md](../CLAUDE.md) and STATE.md for the hard-won gotchas (per-image timeout, blank/size filtering). Display: `PropertyPhotos.jsx` (add/delete/lightbox/backfill).
- **Property videos** — `PropertyVideos.jsx` + `utils/videoEmbed.js`: hosted links (YouTube/Vimeo/Loom, embedded) or uploaded files, on `properties.videos`. Surfaced to clients in the deal portal.
- **Comps at scale** — ~262k rows. Browse via `usePaginatedQuery` (infinite scroll) + a `search_address` search index; a `source` dropdown defaults to "Curated (team)" so the 4,531 hand-curated comps stay front-and-centre. Property-detail matching is suburb-indexed.
- **Client portal** — separate surface (`ClientLayout`, `pages/client/`). `role === "client"` users see only deals shared with them, via `clientPortal.ts` (token-gated `getMyReport`). Guard rails around role assignment are in [../CLAUDE.md](../CLAUDE.md) §6.
- **Record workspaces** — `BriefView` and `ClientView` use `RecordWorkspace.jsx` (the 25/50/25 three-column shell). **`PropertyView` is bespoke** — its own sticky header + tab bar + tab content + activity panel (imports `PulseFeed` directly), *not* the `RecordWorkspace` shell. Match the file you're editing, not the generic rule.

## Common change: add a property-detail tab

The property tabs are wired inline in [`src/pages/PropertyView.jsx`](../src/pages/PropertyView.jsx). To add one:

1. Build the tab component in `src/components/properties/tabs/<Name>Tab.jsx` (or `src/components/properties/` for a larger standalone, e.g. `PropertyVideos.jsx`).
2. In `PropertyView.jsx`: add its `import`; add `{ id, label }` to the `TABS` array; add the render line `{activeTab === '<id>' && <YourTab property={property} />}` in the tab-content block.
3. Backend, if needed: add index-backed queries/mutations to `convex/properties.ts` — every mutation calls `requireStaffOrAdmin`, all args use `v.` validators, queries use `.withIndex()` + `.take(n)` (see [../CLAUDE.md](../CLAUDE.md) §2).

This is exactly how the Videos tab was added — a good reference commit.
