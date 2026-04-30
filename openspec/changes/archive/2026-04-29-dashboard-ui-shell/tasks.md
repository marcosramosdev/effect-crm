## 1. Visual primitives (`client/src/components/`)

- [x] 1.1 Add `client/src/components/icons.tsx` with inline SVG components: `HomeIcon`, `InboxIcon`, `BoardIcon`, `PlugIcon`, `CogIcon`, `CalendarIcon`, `SunIcon`, `FilterIcon`. Match the stroke style used by the existing chevron in `UserMenu.tsx`.
- [x] 1.2 Add `client/src/components/Card.tsx` exporting `Card`, `CardHeader`, `CardBody`, `CardFooter`. Built on DaisyUI `card` + Tailwind utilities; accepts `className`, `as` (default `'div'`).
- [x] 1.3 Add `client/src/components/FilterPills.tsx` rendering an array of `{label, count, active?}` as a horizontal pill group. Active pill has `aria-pressed="true"` + DaisyUI accent fill; inactive uses outline. Counter rendered as a DaisyUI `badge` inside each pill.
- [x] 1.4 Add `client/src/components/MetricBadge.tsx` for sidebar/app-bar counters (number + tiny dot). Pure presentational.
- [x] 1.5 Add `client/src/components/PromoCard.tsx` — coloured card with title, body, CTA button, and an illustration slot (defaults to a neutral placeholder).
- [x] 1.6 Add `client/src/components/EmptyState.tsx` (icon + heading + body + optional action) for use by feature pages.
- [x] 1.7 Write Vitest unit tests for each primitive (1.2–1.6) verifying rendering, prop wiring, and `aria-pressed` on the active filter pill. Tests live in `client/src/components/__tests__/`.

## 2. Shell composition (`client/src/features/shell/`)

- [x] 2.1 Add `client/src/features/shell/Sidebar.tsx`. Hard-code a typed `NAV_ITEMS` array (see design §3). Use `useAuth()` to filter `ownerOnly` items. Use TanStack Router's `useRouterState` (or `useMatchRoute`) to mark the matching item with `aria-current="page"`. Render brand mark at top, items in middle, theme/sun icon button at bottom (no-op `onClick`).
- [x] 2.2 Add `client/src/features/shell/AppBar.tsx`. Props: `title: string`, `filters?: FilterPill[]`, `actions?: React.ReactNode`. Render title left, `FilterPills` centred, `actions` + `<UserMenu />` right.
- [x] 2.3 Add `client/src/features/shell/DashboardLayout.tsx`. Props: `title`, `filters?`, `actions?`, `children`. Composes `<Sidebar />`, `<AppBar />`, and a content surface (`<main className="bg-base-200 flex-1 overflow-auto p-6">{children}</main>`).
- [x] 2.4 Add unit tests:
  - `Sidebar.test.tsx` covering: owner sees all items, non-owner hides owner-only, active route highlight (mock `useRouterState`).
  - `AppBar.test.tsx` covering: title renders, pills render with counts, active pill has `aria-pressed="true"`, `UserMenu` rendered.

## 3. Mock data + dashboard route

- [x] 3.1 Add `client/src/features/shell/mockData.ts` exporting:
  - `MOCK_KPIS: { id, label, value, delta }[]` — 4 KPIs (e.g. Pending, Responded, Assigned, Completed).
  - `MOCK_KANBAN_COLUMNS: { id, label, dot, leads: { id, code, city, assignedTo, expAt, status }[] }[]` — 3 columns (Picked up / In transit / Delivered analogues mapped to CRM: New / Contacted / Won).
  - `MOCK_PROMO: { title, body, ctaLabel }`.
- [x] 3.2 Add `client/src/routes/app/dashboard/index.tsx`. Route: `/app/dashboard`. Component renders `<DashboardLayout title="Dashboard" filters={...derived from MOCK_KPIS}>` with three sections: KPI grid, kanban preview, promo card. No `beforeLoad` — `/app` parent guard already covers auth.
- [x] 3.3 Add `client/src/routes/app/dashboard/__tests__/dashboard.test.tsx` verifying: dashboard renders ≥1 KPI tile, 3 kanban columns, 1 promo card, and **no fetch call** is made (assert `globalThis.fetch` is not invoked, or use MSW unmatched-handler error mode).

## 4. Wire shell into authenticated routes

- [x] 4.1 Replace the body of `client/src/routes/app.tsx` to render `<DashboardLayout>` around the `<Outlet />`. Keep the existing `beforeLoad` auth guard untouched. Provide a default `title` (e.g. derived from current pathname) for routes that don't pass one explicitly — simplest approach is to delete the title fallback and require each child route to set its own.
- [x] 4.2 Update `client/src/routes/app/index.tsx`: change the connected-owner redirect target from `/app/inbox` to `/app/dashboard`. Keep the disconnected-owner → `/app/connect` and non-owner → `/app/inbox` paths.
- [x] 4.3 Re-skin `client/src/routes/app/inbox/index.tsx` so the inbox renders inside `<DashboardLayout title="Inbox" />`. Keep `InboxList` + `<Outlet />` as the body. Confirm `InboxList.test.tsx` still passes (assertions are on text/`aria-label`, not classnames).
- [x] 4.4 Re-skin `client/src/routes/app/pipeline/index.tsx` to render inside `<DashboardLayout title="Pipeline" />` and host `<PipelineBoard />` as the body. Confirm `PipelineBoard.test.tsx` still passes.
- [x] 4.5 Refactor `client/src/features/pipeline/PipelineBoard.tsx` lead cards to use the shared `Card` primitive. Preserve drag-and-drop handlers, `draggable` prop, and `role="list"` / `aria-label={stage.name}` so existing tests stay green.
- [x] 4.6 Re-skin `client/src/routes/app/connect.tsx` (and `client/src/features/whatsapp/ConnectScreen.tsx` only if the route can't pass props through) inside `<DashboardLayout title="Conectar WhatsApp" />`. Verify `ConnectScreen.test.tsx`.

## 5. Cleanup

- [x] 5.1 Delete `client/src/components/NavMenu.tsx` (unused after sidebar lands; verify by `grep -r NavMenu client/src` returning no results).
- [x] 5.2 Update `client/src/routes/__tests__/guard.test.tsx` so any assertion about the connected-owner redirect target points at `/app/dashboard`.
- [x] 5.3 Run `cd client && bun run test` — 70/72 pass; 2 pre-existing auth mutation failures (present on base branch, not from this change).
- [x] 5.4 Run `cd client && bun --bun run lint` and `bun --bun run check` — zero errors.

## 6. Manual verification

- [x] 6.1 `cd client && bun --bun run dev` and sign in as an owner. Confirm: lands on `/app/dashboard`, sidebar highlights Dashboard, switching to Inbox/Pipeline keeps the shell mounted (no full-page flash), `UserMenu` works, logout still works.
- [x] 6.2 Sign in as a non-owner role (or stub `useAuth`). Confirm: `/app` redirects to `/app/inbox`, sidebar hides Conectar + Configurar.
- [x] 6.3 Resize the browser narrow (~768px). Confirm sidebar collapses to icon-only without breaking layout, app bar wraps gracefully, kanban columns scroll horizontally.
