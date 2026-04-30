## Context

The current `/app` layout (`client/src/routes/app.tsx`) is a single horizontal navbar with a `UserMenu` and an `<Outlet />`. Each feature page (inbox, pipeline, connect) renders its own `h-screen` container with a small header. The legacy `client/src/components/NavMenu.tsx` is unused by any rendered page (its links point to `/inbox`, `/pipeline` — not the `/app/*` routes), so removing it is a no-op visually.

Routing is TanStack Router file-based; the existing guard pattern (`beforeLoad` calling `authQueryOptions`) on `/app` already protects everything underneath, and `routes/app/index.tsx` resolves owners to `/app/connect` or `/app/inbox` depending on WhatsApp connection state. Styling is Tailwind 4 + DaisyUI; the project does not yet use any CSS-in-JS or icon library.

Reference UI: a logistics dashboard with an icon-only left rail, a content header containing page title + filter pill group with counters + an action button, and a 3-column kanban of cards. Cards have an icon, title (city), subtitle (ID), and a status pill plus a metadata footer. The right column also hosts a "Premium" promotional card.

We need a CRM-flavoured translation of that look while keeping the existing data hooks (`useAuth`, `stagesQueryOptions`, `leadsQueryOptions`, conversation hooks) untouched.

## Goals / Non-Goals

**Goals:**
- Persistent shell (sidebar + app bar) that wraps every authenticated route.
- Reusable visual primitives (`Card`, `FilterPills`, `MetricBadge`, `PromoCard`, `EmptyState`) so feature pages stop hand-rolling cards.
- A new mocked `/app/dashboard` landing page that demonstrates the look — KPI tiles, kanban preview, promo card.
- Visual refresh of `/app/inbox` and `/app/pipeline` using the new primitives, **without** changing data flow or component contracts.
- Sidebar items hidden by role where appropriate (e.g. "Configurar Pipeline" stays owner-only).

**Non-Goals:**
- Real metrics/analytics endpoints. The dashboard is mock-data only.
- Mobile drawer animation / gesture polish. We provide a responsive collapse to icons but no off-canvas drawer.
- Theme switching wiring (icon slot only — clicking it is a no-op for now).
- Premium upsell logic. Promo card is static.
- Touching server code (`server/`).

## Decisions

### 1. Shell composition lives in `features/shell/`, primitives in `components/`

`features/shell/{Sidebar,AppBar,DashboardLayout}.tsx` orchestrate the layout and know about routes/auth. `components/{Card,FilterPills,...}.tsx` are dumb presentational primitives that don't import router or auth. This matches `client/src/CLAUDE.md`: features hold domain logic, `components/` holds reusable UI.

**Alternative considered:** put everything under `components/`. Rejected because the sidebar needs `useAuth` for role gating and `Link`/`useMatchRoute` for active state — that's domain logic, not pure UI.

### 2. App bar contract is configured per-route, not auto-derived

The app bar accepts `title`, `filters?`, `actions?` props. Each route renders `<DashboardLayout title="…" filters={…}>` so it can declare its own filter pills. We avoid a context/store for header config — explicit props keep TanStack Router file routes self-describing.

**Alternative considered:** a `useAppBar({...})` hook that mutates a Zustand store. Rejected as over-engineered for a single shell consumer; props compose better with React Query's loading states inside each route.

### 3. Sidebar nav is a static array gated by role

```ts
const NAV_ITEMS: NavItem[] = [
  { to: '/app/dashboard', icon: HomeIcon, label: 'Dashboard' },
  { to: '/app/inbox',     icon: InboxIcon, label: 'Inbox' },
  { to: '/app/pipeline',  icon: BoardIcon, label: 'Pipeline' },
  { to: '/app/connect',   icon: PlugIcon,  label: 'Conectar', ownerOnly: true },
  { to: '/app/settings/pipeline', icon: CogIcon, label: 'Configurar', ownerOnly: true },
]
```

Role check uses existing `useAuth()`. Active state derived via TanStack Router's `useMatchRoute`/`useRouterState`. Icons are inline SVGs to avoid adding a dependency (matches the existing pattern in `UserMenu.tsx`).

**Alternative considered:** a per-route `meta` field exporting nav config. Rejected — TanStack Router's file-based routes don't expose a clean `meta` plumbing today and centralising the array is easier to reason about.

### 4. Dashboard data lives in a single `mockData.ts` module

`features/shell/mockData.ts` exports typed fixtures: `MOCK_KPIS`, `MOCK_KANBAN_COLUMNS`, `MOCK_PROMO`. The dashboard route imports them directly — no React Query, no async. This keeps the mock obvious and easy to delete when wiring real data.

**Alternative considered:** seed an MSW handler so the dashboard goes through React Query like other pages. Rejected: adds friction (handlers, types, query keys) for something explicitly flagged as a visual mock.

### 5. `routes/app/index.tsx` owner happy-path retargets to `/app/dashboard`

Currently: connected owner → `/app/inbox`. New: connected owner → `/app/dashboard`. Non-owner still routes to `/app/inbox`; disconnected owner still routes to `/app/connect`. This makes the dashboard the default landing and matches the "see the dashboard first" goal.

**Alternative considered:** route everyone to `/app/dashboard` regardless of role. Rejected because non-owners likely care more about the inbox queue than aggregate metrics — keep their flow short.

### 6. Visual refresh of inbox/pipeline keeps existing data hooks

The inbox `InboxList`, `ConversationView`, and `PipelineBoard` keep their current structure and React Query hooks. We only change their wrapping: each route uses `DashboardLayout` with `title="Inbox"` / `title="Pipeline"`. Internal kanban cards in `PipelineBoard` get re-skinned with the new `Card` primitive (same drag-drop logic, same DOM structure for tests).

**Risk:** existing tests rely on specific class names or structure. Audited `PipelineBoard.test.tsx` + `InboxList.test.tsx` — they assert on text and `role`/`aria-label`, not classnames, so a visual reskin is safe.

## Risks / Trade-offs

- **Mock data drift** → A mocked dashboard can diverge from real domain shapes. Mitigation: type `MOCK_KANBAN_COLUMNS` against a local `DashboardKanbanColumn` type co-located in `mockData.ts`; when real data lands we replace the source, not the consumer.
- **Sidebar route churn** → Hard-coded nav array means adding a new route requires editing two places (the file route + the array). Acceptable for now (5 items); revisit if it grows past ~10.
- **Icon set inline** → Inline SVGs scale poorly past ~10 icons. Mitigation: collect them in `components/icons.tsx` so swapping to `lucide-react` later is a one-import change.
- **Redirect change** is a behaviour change: connected owners who had `/app/inbox` bookmarked will now land on `/app/dashboard`. Mitigation: still a single click away via sidebar; mention in PR description.
- **Active-route highlighting** in TanStack Router requires `useRouterState` reads on every render. Cheap, but be aware if profiling shows churn.

## Migration Plan

No data migration. Order of work:

1. Build primitives (`components/*`) with their unit tests — pure UI, no router, fastest feedback.
2. Build `Sidebar`, `AppBar`, `DashboardLayout` in `features/shell/`.
3. Add `mockData.ts` and the `/app/dashboard` route. Verify visually.
4. Swap `routes/app.tsx` to use `DashboardLayout`. Update `routes/app/index.tsx` redirect.
5. Re-skin `routes/app/inbox/index.tsx` and `routes/app/pipeline/index.tsx` to use the new layout.
6. Delete `client/src/components/NavMenu.tsx`.
7. Update `client/src/routes/__tests__/guard.test.tsx` for the new redirect target.

Rollback is a straight `git revert` of the merge commit — no schema or API changes.

## Open Questions

- Sidebar copy: keep Portuguese labels (matching existing `UserMenu` "Sair", "A sair…")? Confirmed yes — the codebase uses PT-PT throughout.
- Should the dashboard kanban preview be clickable through to `/app/pipeline`? Default: yes, the entire promo + KPI cards are non-interactive but the kanban column header links to pipeline. Worth confirming on review.
