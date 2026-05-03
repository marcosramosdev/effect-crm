## MODIFIED Requirements

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

### Requirement: Shell exposes reusable visual primitives

The implementation SHALL provide a set of reusable presentational components consumable by any feature page: `Card`, `FilterPills`, `MetricBadge`, `PromoCard`, `EmptyState`, and `ViewTabs`. These primitives MUST NOT depend on the router or auth.

#### Scenario: Primitives are router-agnostic
- **WHEN** any of `Card`, `FilterPills`, `MetricBadge`, `PromoCard`, `EmptyState`, `ViewTabs` is rendered in isolation in a unit test (no router context)
- **THEN** the component renders without throwing

#### Scenario: Pipeline page consumes the Card primitive
- **WHEN** the `/app/pipeline` page renders a lead card
- **THEN** the rendered DOM uses the shared `Card` primitive (or a thin wrapper extending it)
- **AND** the pipeline drag-and-drop behaviour from the `pipeline-board` capability is preserved

## ADDED Requirements

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
