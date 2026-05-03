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

The sidebar SHALL list primary navigation items with an icon and a label. Items marked owner-only MUST be hidden when `useAuth()` returns a role other than `owner`. The currently active route MUST be visually highlighted. The `Pipeline` entry SHALL be renamed to `Contatos` and its `to` prop SHALL target `/app/contacts`. The `Configurar` entry SHALL target `/app/settings/profile`.

#### Scenario: Owner sees all nav items with new labels
- **WHEN** the authenticated user has role `owner`
- **THEN** the sidebar shows Dashboard, Inbox, Contatos, Conectar, and Configurar entries
- **AND** the Contatos entry links to `/app/contacts`
- **AND** the Configurar entry links to `/app/settings/profile`

#### Scenario: Non-owner role hides owner-only items
- **WHEN** the authenticated user has role other than `owner` (e.g. `agent`)
- **THEN** the sidebar MUST NOT render the Conectar or Configurar entries
- **AND** Dashboard, Inbox, and Contatos remain visible

#### Scenario: Active route is highlighted
- **WHEN** the user is on `/app/contacts`
- **THEN** the Contatos entry has an `aria-current="page"` attribute and a visually distinct active style
- **AND** no other entry has `aria-current`

### Requirement: App bar accepts per-route configuration

The app bar SHALL accept a `title`, an optional `viewTabs` (an ordered list of view-mode tabs with a label and an active flag), optional `filters` (label + count + active flag), and an optional right-aligned `actions` slot. View tabs MUST render as a horizontal segmented tab strip immediately after the title; tabs whose `disabled` flag is `true` MUST be rendered with a disabled visual state and MUST NOT be focusable. Filters MUST render as pill buttons with a visible counter badge. The user menu MUST appear in the right action slot on every page.

#### Scenario: Route declares title, view tabs, and actions
- **WHEN** a route renders `<DashboardLayout title="Pipeline" viewTabs={[{label:'Board',active:true},{label:'List',disabled:true},{label:'Gantt',disabled:true},{label:'Calendar',disabled:true},{label:'Table',disabled:true}]} actions={<AddLeadButton />} />`
- **THEN** the app bar displays the heading "Pipeline"
- **AND** five tab buttons are rendered after the title in the listed order
- **AND** the tab labelled `Board` carries `aria-pressed="true"`
- **AND** the four disabled tabs carry `aria-disabled="true"` and are not focusable via Tab
- **AND** the `AddLeadButton` is rendered in the right action slot, before the user menu

#### Scenario: Route declares title and filters
- **WHEN** a route renders `<DashboardLayout title="Inbox" filters={[{label:'Pending',count:4},{label:'Assigned',count:15,active:true}]} />`
- **THEN** the app bar displays the heading "Inbox"
- **AND** the app bar renders two filter pills with counters `4` and `15` respectively
- **AND** the pill marked `active: true` carries an `aria-pressed="true"` attribute

#### Scenario: User menu always present
- **WHEN** any authenticated route renders the shell
- **THEN** the existing `UserMenu` component appears in the app bar's right slot

### Requirement: App bar accepts an optional subtitle

The `DashboardLayout` and `AppBar` SHALL accept an optional `subtitle?: string` prop. When provided, the subtitle MUST render directly below the title in a smaller, muted style (e.g. `text-sm text-base-content/60`).

#### Scenario: Route declares title and subtitle
- **WHEN** a route renders `<DashboardLayout title="Contatos" subtitle="Centralize e organize todos os seus leads em um só lugar" />`
- **THEN** the app bar displays "Contatos" as the heading
- **AND** the app bar displays the subtitle below the heading

#### Scenario: Subtitle is omitted when not provided
- **WHEN** a route renders `<DashboardLayout title="Inbox" />` with no subtitle
- **THEN** the app bar renders the heading only
- **AND** no empty subtitle node is rendered

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

The implementation SHALL provide a set of reusable presentational components consumable by any feature page: `Card`, `FilterPills`, `MetricBadge`, `PromoCard`, `EmptyState`, and `ViewTabs`. These primitives MUST NOT depend on the router or auth.

#### Scenario: Primitives are router-agnostic
- **WHEN** any of `Card`, `FilterPills`, `MetricBadge`, `PromoCard`, `EmptyState`, `ViewTabs` is rendered in isolation in a unit test (no router context)
- **THEN** the component renders without throwing

#### Scenario: Pipeline page consumes the Card primitive
- **WHEN** the `/app/pipeline` page renders a lead card
- **THEN** the rendered DOM uses the shared `Card` primitive (or a thin wrapper extending it)
- **AND** the pipeline drag-and-drop behaviour from the `pipeline-board` capability is preserved

### Requirement: Sidebar includes support widget above the user profile

The sidebar SHALL render a "support" block above the user profile area containing a heading (e.g. "Need support?"), a short subtitle, and a primary call-to-action button (e.g. "Contact us"). The block MUST be visible to all authenticated users regardless of role. Activating the CTA MUST open a contact channel (email link, external chat, or a placeholder modal — the exact target is configurable but a working link is required).

#### Scenario: Support block renders for every authenticated user
- **WHEN** any authenticated user views any `/app/*` route
- **THEN** the sidebar renders the support heading, subtitle, and CTA button
- **AND** the block sits visually between the navigation list and the user profile

#### Scenario: CTA opens a contact channel
- **WHEN** the user clicks the support CTA
- **THEN** the application opens the configured contact target (e.g. `mailto:` link, external URL, or a contact modal)
- **AND** the action is observable (navigation event or modal opens)

### Requirement: Visual style follows the light-surface design system

The shell SHALL use a near-white board background (token: `bg-base-100` or equivalent), white card surfaces with a 1px neutral border (token: `border-base-200`), and MUST NOT apply heavy drop shadows to cards by default. Hover affordances MUST use a subtle ring or background tint, not a shadow elevation change.

#### Scenario: Card surfaces use border instead of shadow
- **WHEN** any page renders a `Card` primitive at rest
- **THEN** the card has a 1px neutral border and no `shadow-md`/`shadow-lg` class applied
- **AND** on hover the card gains a subtle background tint or 1px ring (no elevation shift)

#### Scenario: Board background is a neutral light tone
- **WHEN** the `/app/pipeline` route renders
- **THEN** the area behind the columns uses `bg-base-100` (or the design-token equivalent for the lightest neutral surface)
