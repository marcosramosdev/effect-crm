## ADDED Requirements

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

## MODIFIED Requirements

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
