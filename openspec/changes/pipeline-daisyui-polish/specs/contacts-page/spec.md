## MODIFIED Requirements

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
