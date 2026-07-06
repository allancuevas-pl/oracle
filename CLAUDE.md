# Oracle CRM — Development Standards

This file governs all code written for this project. Every rule here exists because we hit the problem it prevents. Follow them by default; deviate only with a comment explaining why.

---

## 0. Start here — project docs

This is the **rulebook**. The rest of the project's context lives alongside it (any AI tool can read these; `AGENTS.md` is the cross-tool entrypoint):

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the system map (stack, data model, subsystems).
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** — how to run, the exact deploy sequence, security must-nots.
- **[docs/STATE.md](docs/STATE.md)** — what's shipped / in flight / next. Read to know where we left off; **update it at the end of each session.**
- **[DESIGN.md](DESIGN.md)** — visual north-star.

@docs/ARCHITECTURE.md
@docs/WORKFLOW.md
@docs/STATE.md

---

## 1. Layout & Visual Standards

### List views (Briefs, Properties, Clients, Pipeline)
- Full-width, edge-to-edge canvas. No `max-w-*` containers.
- Consistent padding: `<div className="p-6 lg:p-8 space-y-6">`
- All list views **must** include a search bar. One-third width max, record count on the right.

### Record workspaces (BriefView, ClientView)
- Use `RecordWorkspace.jsx`. Three columns: 25% criteria / 50% pipeline / 25% pulse log.
- Sticky header: title + back button + action buttons (right-aligned).
- The `actions` prop accepts a JSX fragment of icon buttons. There is no `statusControls` prop — inline selects live in the left column.
- **`PropertyView` is the exception:** a bespoke tabbed layout (sticky header + tab bar + tab content + activity panel), not the `RecordWorkspace` shell. Match its existing structure when editing it; don't force it into the 25/50/25 shape.

### Tables
- Headers: `text-xs text-brand-100/50 uppercase bg-[#0A0A0A]/50`
- Rows: `hover:bg-brand-900/10`

### Typography & empty states
- Missing data: `<span className="text-brand-100/30 italic">Not specified</span>` — never a bare `-`
- Primary buttons: `bg-brand-500 text-brand-950 hover:scale-[1.02] active:scale-95`

### Modals
- Create/edit in a centered overlay (`max-w-2xl bg-[#0A0A0A]`), not a new route.
- Modals that query Convex must pass `'skip'` while closed: `useQuery(api.x.y, isOpen ? {} : 'skip')`

---

## 2. Convex Query Rules

Every query function must satisfy all four points:

1. **Use an index** — never `.order("asc").filter(...)` when an index exists. Add one to `schema.ts` if needed.
   ```typescript
   // Wrong
   ctx.db.query("users").filter(q => q.eq(q.field("role"), "admin")).collect()

   // Right
   ctx.db.query("users").withIndex("by_role", q => q.eq("role", "admin")).take(100)
   ```

2. **Cap every result set** — `.collect()` is banned in queries. Use `.take(n)` with a documented limit.
   | Table | Limit |
   |---|---|
   | briefs, properties, clients | 500 |
   | matches | 100 |
   | team/users | 100 |
   | dashboard aggregates | 500 |

3. **Validate all args** — use `v.` validators. Never trust raw input.

4. **No `as any`** — if TypeScript needs a cast to compile, the schema or validator is wrong. Fix it there.

---

## 3. React Query Rules

- `useQuery` with `'skip'` when the subscription should be inactive (modal closed, feature flag off, user lacks permission).
- Mutations that affect visible UI must use `.withOptimisticUpdate()` — no snap-back jank on drag/drop or status changes.
- Picker queries return projections only. `getClientSummaries` returns `{ _id, name, company }` — not the full client document. Write a dedicated lightweight query rather than over-fetching.

---

## 4. Shared Utilities

**Single source — never redefine locally.**

| Utility | Location |
|---|---|
| `formatCurrency` | `src/utils/format.js` |

Before writing a helper function, check `src/utils/` first. If it exists there, import it. If a new general-purpose helper is needed, add it to `src/utils/` so the next developer finds it.

---

## 5. Component Architecture

### Size signals
- **>300 lines** — consider splitting. A file this long almost always has two or more separable concerns.
- **Same JSX block 2× or more** — extract a component. Duplication in JSX compounds quickly.

### Where things live
```
src/
  pages/          # Route-level components only. No business logic, no inline queries.
  components/
    <domain>/     # Domain-specific (briefs/, properties/, clients/, pipeline/)
    layout/       # RecordWorkspace, Sidebar, etc.
    ui/           # Stateless, reusable primitives (TagPicker, CustomSelect, etc.)
  utils/          # Pure functions. No React, no Convex imports.
  hooks/          # Custom React hooks only.
```

### Page components
Pages own routing, loading states, and empty states. They delegate rendering to domain components. A page file should rarely exceed 150 lines.

### UI primitives (`src/components/ui/`)
Must be stateless and domain-agnostic. No Convex queries, no toast calls, no business logic. If a component needs to know what a "brief" is, it belongs in `components/briefs/`, not `components/ui/`.

---

## 6. Security Defaults

- **The four roles, and what each can reach:**
  | Role | CRM | Client portal |
  |---|---|---|
  | `admin` | ✅ + team/settings | — |
  | `staff` | ✅ | — |
  | `client` | — | ✅ (only deals shared with them) |
  | `blocked` | — | — |
- **Uninvited sign-ups default to `"blocked"`** (zero access anywhere). `users.ts` `storeUser` only grants a real role when a matching `pendingInvitations` record exists. Never default to `"client"` — that grants portal access.
- **Removing a team member sets `"blocked"`, never `"client"`.** Downgrading to `"client"` would let a removed agent back in through the portal side door (`team.ts` `removeMember`).
- **A client-portal invite must never demote a CRM user.** Creating a client record with an admin's email must not strip their access. Guarded in both `storeUser` and `upsertUserRole`.
- **Role checks in every mutation.** Use `requireStaffOrAdmin(ctx)` or `requireAdmin(ctx)` from `convex/authz.ts` (strict allowlist — `blocked`/`client` are rejected). No mutation should touch data without an explicit role check. Client-portal queries check `role === "client"` inline instead.
- **No secrets in code or `.git/config`.** API keys and tokens live in Convex environment variables or browser localStorage only. The GitHub PAT leak from May 2026 must not recur — rotate tokens immediately if found in any config file.

---

## 7. The New-File Checklist

Before merging any new Convex file (`convex/*.ts`):
- [ ] All queries use `.withIndex()` + `.take(n)`
- [ ] All args have `v.` validators
- [ ] All mutations call `requireStaffOrAdmin` or `requireAdmin`
- [ ] No `.collect()` calls
- [ ] No `as any` casts
- [ ] No new duplicate of a utility already in `src/utils/`

Before merging any new React component:
- [ ] Under 300 lines
- [ ] No repeated JSX block (extract to `ui/` if needed)
- [ ] `useQuery` uses `'skip'` where applicable
- [ ] Mutations that touch visible UI use `.withOptimisticUpdate()`
- [ ] Imports `formatCurrency` from `src/utils/format.js` — does not redefine it
