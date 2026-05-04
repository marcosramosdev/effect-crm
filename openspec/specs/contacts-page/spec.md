### Requirement: Contacts page header with title and subtitle

The page formerly known as Pipeline SHALL render with the title "Contatos" and a descriptive subtitle text. The route alias `/app/contacts` MUST resolve to the same page; the legacy `/app/pipeline` MUST continue to resolve via redirect to preserve back-links.

#### Scenario: Title and subtitle render in the app bar
- **WHEN** an authenticated user navigates to `/app/contacts`
- **THEN** the app bar displays the heading "Contatos"
- **AND** the app bar displays the subtitle "Centralize e organize todos os seus leads em um só lugar"

#### Scenario: Legacy route redirects to /app/contacts
- **WHEN** an authenticated user navigates to `/app/pipeline`
- **THEN** the router redirects to `/app/contacts`
- **AND** the page renders the contacts header

### Requirement: View tabs limited to Board and List

The contacts page SHALL expose exactly two view tabs: `Board` (default) and `List`. The previous disabled tabs (`Gantt`, `Calendar`, `Table`) MUST NOT render. The active tab SHALL persist in the URL query string as `?view=board` or `?view=list`.

#### Scenario: Default view is Board
- **WHEN** the user visits `/app/contacts` with no `view` param
- **THEN** the Board view renders
- **AND** the `Board` tab carries `aria-selected="true"`

#### Scenario: Switching to List updates URL and renders table
- **WHEN** the user clicks the `List` tab
- **THEN** the URL becomes `/app/contacts?view=list`
- **AND** the page renders the List view (table) instead of the board

#### Scenario: Disabled legacy tabs are absent
- **WHEN** the contacts page renders
- **THEN** the DOM MUST NOT contain elements labelled `Gantt`, `Calendar`, or `Table`

### Requirement: List view renders leads as a sortable table

The List view SHALL render leads in a virtualised table with columns: stage badge, display name, phone, email (if present), Instagram (if present), appointment date (if present), and time-in-stage. Clicking a row MUST open the same lead detail modal used by the Board view. Column headers for `displayName`, `appointmentDate`, and `timeInStage` MUST be sortable (asc/desc toggle).

#### Scenario: Row click opens the lead detail modal
- **WHEN** the user clicks any row in the List view
- **THEN** the lead detail modal opens loaded with that lead

#### Scenario: Sorting by appointment date
- **WHEN** the user clicks the `Data do compromisso` column header twice
- **THEN** the rows are reordered descending by `appointmentDate`
- **AND** the header carries `aria-sort="descending"`

#### Scenario: Stage badge shows stage color
- **WHEN** the List view renders a row whose lead is in a stage with `color="#22c55e"`
- **THEN** the stage badge in that row uses `#22c55e` as its accent color

### Requirement: Modern visual style for contacts surface

The contacts page SHALL use a modern flat surface style implemented with DaisyUI component classes and semantic color tokens so the page renders consistently under any registered DaisyUI theme. Surfaces MUST use rounded corners (DaisyUI's default `rounded-box` / `rounded-lg`), `border-base-300` borders, and no heavy box-shadows. Icons SHALL be monochrome `lucide-react` components inheriting `text-base-content/60` for muted states. Color accents SHALL be driven only by user-defined stage `color` hex (inline-styled, not via theme tokens). The board background SHALL use `bg-base-100`. Column surfaces SHALL use `bg-base-200` (or `bg-base-100` with a `border-base-300` separator) — no literal `bg-white`. Lead cards SHALL be built from DaisyUI `card` and `card-body`. The "Adicionar lead" header button SHALL use `btn btn-primary`. The Campos / settings trigger SHALL use `btn btn-ghost`. Tabs (`Board`/`List`) SHALL use the DaisyUI `tabs` / `tab` classes (or compose on top of them).

#### Scenario: Card uses DaisyUI classes and theme tokens
- **WHEN** any lead card renders on the Board view
- **THEN** the card root has the DaisyUI `card` class
- **AND** the card has `border` + `border-base-300` (no `border-base-200` or raw color)
- **AND** the card has no `shadow-md` / `shadow-lg` class
- **AND** the card has no literal `bg-white` class

#### Scenario: Board background uses base-100 token
- **WHEN** the `/app/contacts` route renders the board view
- **THEN** the board background element has `bg-base-100` (or a class that resolves via DaisyUI to the same token)
- **AND** no element inside the board uses `bg-white`

#### Scenario: Theme switch recolors the contacts surface
- **WHEN** the user switches `data-theme` to a different DaisyUI theme
- **THEN** every surface on `/app/contacts` (header, tabs, board background, columns, cards, list rows) adopts the new theme's tokens
- **AND** stage color accents (column strip, stage badges) keep their user-defined hex
