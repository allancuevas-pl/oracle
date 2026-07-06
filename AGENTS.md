# AGENTS.md — Oracle

You are working on **Oracle**, a commercial-property deal platform for Property Lions (React + Vite + Tailwind + Convex + Clerk, hosted on Vercel). This file is the shared entrypoint for **any** AI coding tool (Claude Code, Codex, Antigravity, Cursor, …).

## Read these first, in order

1. **[CLAUDE.md](CLAUDE.md)** — the rulebook. Layout standards, Convex query rules, React rules, security defaults, the new-file checklist. **Follow it exactly.**
2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the system map: stack, data model, subsystems.
3. **[docs/WORKFLOW.md](docs/WORKFLOW.md)** — how to run, deploy, and the security must-nots.
4. **[docs/STATE.md](docs/STATE.md)** — what's shipped, in flight, and next. **Read this to know where we left off.**
5. **[DESIGN.md](DESIGN.md)** — visual north-star ("The Private Deal Room").

## Golden rules (the guard rails — never violate)

- **Branch:** work on `claude-code/main`. **Never push to `main`** (production) without explicit approval. Commit/push only when asked.
- **Deploy = 4 steps, in order:** `npx convex dev --once` → `npx convex deploy --yes` → `vercel --prod --yes` → `vercel alias <url> oracle-psi-beryl.vercel.app`. Both Convex deployments, every time. (Details in WORKFLOW.md.)
- **Security:** every Convex mutation calls `requireStaffOrAdmin`/`requireAdmin`; uninvited users default to `blocked`; no secrets in code or git. (CLAUDE.md §6.)
- **Convex queries:** always `.withIndex()` + `.take(n)`; never `.collect()`; validate args with `v.`; no `as any`. (CLAUDE.md §2.)
- **Verify before claiming done** — run previewable changes, `node`-check pure logic; report outcomes honestly.
- **Copy:** no em dashes. Missing data renders as *"Not specified"*, never a bare `-`.

## When you finish a session

Update **docs/STATE.md** — what you shipped, what's now next, any new gotcha. That single habit is what lets the next chat (in any tool) pick up without losing context or quality.
