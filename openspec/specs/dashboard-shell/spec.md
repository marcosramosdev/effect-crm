### Requirement: Persistent dashboard shell wraps authenticated routes

The application SHALL render a persistent dashboard shell composed of a left sidebar, a top app bar, and a content surface for every route under `/app/*`. The shell MUST be visible on all child routes without remount on navigation between siblings.

#### Scenario: Shell renders on every authenticated route
- **WHEN** an authenticated user navigates to any route matching `/app/*` (e.g. `/app/dashboard`, `/app/inbox`, `/app/pipeline`)
- **THEN** the page renders the sidebar on the left, the app bar across the top of the content area, and the route content inside the content surface
- **AND** the sidebar and app bar remain mounted (no flicker) when navigating between two `/app/*` routes

#### Scenario: Shell is not used on unauthenticated routes
- **WHEN** an unauthenticated user visits `/auth/login` or `/auth/register`
- **THEN** the dashboard shell MUST NOT render

### Requirement: Sidebar exposes role-aware navigation

The sidebar SHALL list primary navigation items with an icon and a label. Items marked owner-only MUST be hidden when `useAuth()` returns a role other than `owner`. The currently active route MUST be visually highlighted.

#### Scenario: Owner sees all nav items
- **WHEN** the authenticated user has role `owner`
- **THEN** the sidebar shows Dashboard, Inbox, Pipeline, Conectar, and Configurar entries

#### Scenario: Non-owner role hides owner-only items
- **WHEN** the authenticated user has role other than `owner` (e.g. `agent`)
- **THEN** the sidebar MUST NOT render the Conectar or Configurar entries
- **AND** Dashboard, Inbox, and Pipeline remain visible

#### Scenario: Active route is highlighted
- **WHEN** the user is on `/app/pipeline`
- **THEN** the Pipeline entry has an `aria-current="page"` attribute and a visually distinct active style
- **AND** no other entry has `aria-current`

### Requirement: App bar accepts per-route configuration

The app bar SHALL accept a `title`, optional `filters` (label + count + active flag), and optional right-aligned `actions`. Filters MUST render as pill buttons with a visible counter badge. The user menu MUST appear in the right action slot on every page.

#### Scenario: Route declares title and filters
- **WHEN** a route renders `<DashboardLayout title="Pipeline" filters={[{label:'Pending',count:4},{label:'Assigned',count:15,active:true}]} />`
- **THEN** the app bar displays the heading "Pipeline"
- **AND** the app bar renders two filter pills with counters `4` and `15` respectively
- **AND** the pill marked `active: true` carries an `aria-pressed="true"` attribute

#### Scenario: User menu always present
- **WHEN** any authenticated route renders the shell
- **THEN** the existing `UserMenu` component appears in the app bar's right slot

### Requirement: Mocked dashboard landing page

The route `/app/dashboard` SHALL render a mocked overview composed of KPI tiles, a three-column kanban-style preview of leads, and a promotional card. The page MUST source its data from a typed mock module (no network calls).

#### Scenario: Dashboard renders mocked sections
- **WHEN** an authenticated user visits `/app/dashboard`
- **THEN** the page renders at least one KPI tile, three kanban columns each with one or more lead cards, and a single promo card
- **AND** no fetch / XHR / WebSocket is initiated by the page itself

#### Scenario: Mock data is the single source
- **WHEN** the dashboard page mounts
- **THEN** all rendered values are sourced from `features/shell/mockData.ts`

### Requirement: Authenticated landing redirect targets the dashboard

When an authenticated owner with a connected WhatsApp session visits `/app`, the router SHALL redirect to `/app/dashboard`. Disconnected owners continue to be redirected to `/app/connect`. Non-owner roles continue to be redirected to `/app/inbox`.

#### Scenario: Connected owner lands on dashboard
- **WHEN** an `owner` with `connection.status === 'connected'` visits `/app`
- **THEN** they are redirected to `/app/dashboard`

#### Scenario: Disconnected owner still goes to connect
- **WHEN** an `owner` with `connection.status !== 'connected'` visits `/app`
- **THEN** they are redirected to `/app/connect`

#### Scenario: Non-owner still goes to inbox
- **WHEN** the authenticated user has role other than `owner`
- **THEN** visiting `/app` redirects to `/app/inbox`

### Requirement: Shell exposes reusable visual primitives

The implementation SHALL provide a set of reusable presentational components consumable by any feature page: `Card`, `FilterPills`, `MetricBadge`, `PromoCard`, and `EmptyState`. These primitives MUST NOT depend on the router or auth.

#### Scenario: Primitives are router-agnostic
- **WHEN** any of `Card`, `FilterPills`, `MetricBadge`, `PromoCard`, `EmptyState` is rendered in isolation in a unit test (no router context)
- **THEN** the component renders without throwing

#### Scenario: Pipeline page consumes the Card primitive
- **WHEN** the `/app/pipeline` page renders a lead card
- **THEN** the rendered DOM uses the shared `Card` primitive
- **AND** the existing `PipelineBoard` drag-and-drop behaviour is preserved (drag a card to another column triggers the existing `moveMutation`)
