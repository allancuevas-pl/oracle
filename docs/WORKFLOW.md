# Oracle — Workflow & Runbook

> The **operational runbook**: git policy, how to run locally, how to deploy, environment, and the security must-nots. For coding rules see [../CLAUDE.md](../CLAUDE.md); for the system map see [ARCHITECTURE.md](ARCHITECTURE.md).

## Git policy

- Work on **`claude-code/main`**. This is the active build branch.
- **`main`** is production on Vercel — **do not push to it without explicit approval.**
- `backup/pre-claude-code-2026-05-22` (commit `d850b8e`) is a frozen rollback snapshot of the Antigravity handoff state. `git diff` against it shows everything that's drifted since.
- Commit / push only when the user asks.

## Run locally

```bash
npm install
npm run dev            # Vite dev server (port 5173)
npx convex dev         # backend in watch mode (syncs functions to the dev deployment)
npm run lint           # ESLint
npm test               # vitest (unit tests, incl. convex/authz.test.ts)
```

Preview verification (in this harness): use the **`oracle-dev`** config in `.claude/launch.json` (**port 5173**) with the preview tools, not raw shell servers.

## Deploy (the exact sequence)

Both Convex deployments must be updated, then Vercel, then re-aliased. **Run all four, in order:**

```bash
# 1. Push schema + functions to the dev deployment (the one Vercel prod reads)
npx convex dev --once

# 2. Push schema + functions to the prod Convex deployment
npx convex deploy --yes

# 3. Deploy the frontend to Vercel (build runs `security:check` first — see below)
vercel --prod --yes
# → note the printed https://oracle-<hash>-property-lions.vercel.app URL

# 4. Point the stable production domain at the new deployment
vercel alias <that-url> oracle-psi-beryl.vercel.app
```

Skipping step 1 is the classic mistake: the live app reads `colorless-condor-502`, so a schema/function change that only went to `convex deploy` won't be live. Skipping step 4 leaves the change deployed but not on the production domain.

`npm run build` runs `npm run security:check` (`scripts/check-authz.js`) before `vite build` — an authz gate. If the build fails there, a mutation is missing a role check; fix it rather than bypassing.

## Environment variables

Live in `.env.local` (untracked) and in the Convex/Vercel dashboards — **never in code or git**. Names only:

| Var | Purpose |
|---|---|
| `VITE_CONVEX_URL` | Convex deployment the frontend talks to (`colorless-condor-502`) |
| `VITE_CONVEX_SITE_URL` | Convex site URL (auth/webhooks) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk (currently a **DEV** key — prod instance pending) |
| `CONVEX_DEPLOYMENT` | Local Convex CLI target |

Server-side secrets (e.g. the Claude API key for extraction) live in **Convex environment variables**, set via the Convex dashboard — not in the repo.

## Security must-nots (non-negotiable)

- **No secrets in code, commits, or `.git/config`.** A GitHub PAT was leaked in `.git/config` (May 2026); config is now clean and uses the macOS keychain. The exposed token value **still needs rotating** at github.com/settings/tokens — treat as compromised until confirmed. If you ever find a token in a tracked file, stop and flag it.
- **Every mutation calls a role check** — `requireStaffOrAdmin(ctx)` or `requireAdmin(ctx)` (`convex/authz.ts`). Client-portal queries check `role === "client"` inline. Uninvited sign-ups default to `blocked`. Full rules in [../CLAUDE.md](../CLAUDE.md) §6 — read them before touching auth/roles.
- **Always deploy to BOTH Convex deployments** (see above). A schema change on only one causes validation mismatches.
- **Remove any test IM from `public/` before deploying.** Browser photo-extraction testing sometimes stages a large PDF at `public/__test_im.pdf`; Vercel's build copies `public/` verbatim, so it must be deleted before `vercel --prod`.

## Verify before you claim done

- **Previewable UI change** → run it via the preview tools and confirm behavior (console/network/snapshot), don't ask the user to check manually.
- **Pure logic (utils)** → a quick `node` check is cheap and reliable (see `videoEmbed.js` / `pdfPhotos.js` history).
- **Auth logic** → `convex/authz.test.ts`; run `npm test` (vitest) and keep it green.
- **Lint** → `npm run lint` before shipping.
- Report outcomes faithfully — if something is untested or skipped, say so.
