## Why

The authenticated `/app` area uses a thin top navbar and ad-hoc per-page chrome. As pipeline, inbox, and (future) WhatsApp/analytics views grow, navigation becomes cramped and the product looks more like a sequence of forms than a CRM dashboard. We want a dashboard-style shell — fixed sidebar, persistent header, content area with consistent metric/filter primitives — modelled on the logistics-style reference UI, populated with mock data so we can iterate on look-and-feel before wiring everything to live data.

## What Changes

- Replace the current `/app` layout (top-only navbar) with a dashboard shell composed of:
  - Left **sidebar** with brand mark, primary nav (Home, Inbox, Pipeline, Connect, Calendar, Settings) and a bottom "theme toggle" slot. Active route highlighted; collapses to icons on narrow widths.
  - Top **app bar** with page title, status filter pills (e.g. Pending / Responded / Assigned / Completed for leads), counter badges, and right-aligned actions (filter button + `UserMenu`).
  - Main **content surface** with a soft neutral background and reusable card primitives (`Card`, `CardHeader`, `MetricBadge`, `FilterPills`, `EmptyState`, `PromoCard`).
- New `/app` landing page (`/app/dashboard`) that renders a mocked overview: KPI tiles, three-column kanban-style preview of leads, and a "Premium" promo card. Driven entirely by a `mockData.ts` module — no API calls.
- Refresh the `/app/pipeline` and `/app/inbox` pages to consume the new shell + card primitives without changing their data flow.
- Move the `NavMenu` component's responsibilities into the new sidebar; legacy `NavMenu.tsx` is deleted.
- The `/app` redirect logic in `routes/app/index.tsx` (owner → connect/inbox) is rerouted to the new `/app/dashboard` route once the user is connected, so non-owners and connected owners both land on the dashboard.

## Capabilities

### New Capabilities

- `dashboard-shell`: layout primitives (sidebar, app bar, content surface), mocked dashboard landing page, and the visual primitives (`Card`, `FilterPills`, `MetricBadge`, `PromoCard`, `EmptyState`) that the shell exposes to feature pages.

### Modified Capabilities

(None — there are no existing specs in `openspec/specs/`. Pipeline and inbox pages are visually refreshed but their behaviour and data contracts are unchanged.)

## Impact

- **Code**:
  - `client/src/routes/app.tsx` — swapped from navbar layout to shell composition.
  - `client/src/routes/app/index.tsx` — redirect target changes to `/app/dashboard` (owners) for the connected case; non-connected owners still go to `/app/connect`.
  - New: `client/src/routes/app/dashboard/index.tsx`.
  - New: `client/src/features/shell/{Sidebar,AppBar,DashboardLayout}.tsx`, `client/src/features/shell/mockData.ts`.
  - New primitives in `client/src/components/{Card,FilterPills,MetricBadge,PromoCard,EmptyState}.tsx`.
  - `client/src/routes/app/inbox/index.tsx` and `client/src/routes/app/pipeline/index.tsx` — adopt new card/app-bar primitives.
  - `client/src/components/NavMenu.tsx` — deleted; superseded by sidebar.
- **Tests**:
  - New unit tests for `Sidebar` (active route, role-gated items), `AppBar` (renders title + filters), and dashboard route (renders mocked sections).
  - Existing route guard tests in `client/src/routes/__tests__/guard.test.tsx` updated for new `/app/dashboard` redirect target.
- **Dependencies**: no new packages. Continue with Tailwind 4 + DaisyUI.
- **APIs**: none. Mock data only for the new dashboard page; pipeline/inbox keep current React Query hooks.
- **Out of scope**: real analytics/metrics endpoints, premium upsell logic, theme switching wiring (UI slot only), mobile drawer animation polish.
