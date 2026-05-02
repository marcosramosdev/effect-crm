### Requirement: User profile settings route

The route `/app/settings/profile` SHALL render a profile settings page allowing the authenticated user to view and update their own `displayName`, `email` (read-only when sourced from Supabase Auth), and `avatarUrl`, and to change their password. The previous pipeline settings UI MUST NOT render at any settings route.

#### Scenario: Profile route renders form
- **WHEN** an authenticated user visits `/app/settings/profile`
- **THEN** the page renders editable fields for `displayName` and `avatarUrl`
- **AND** the email field renders disabled with the user's current email
- **AND** a "Alterar senha" button is visible

#### Scenario: Display name update persists
- **WHEN** the user edits `displayName` to "Maria" and clicks Save
- **THEN** a `PATCH /api/auth/me` request is sent with `{displayName:"Maria"}`
- **AND** the new name is reflected in the sidebar profile block on success

#### Scenario: Password change opens dedicated flow
- **WHEN** the user clicks "Alterar senha"
- **THEN** a modal opens with current-password, new-password, and confirm-password fields
- **AND** submitting calls Supabase Auth's password update method

### Requirement: Legacy pipeline settings route removed

The route `/app/settings/pipeline` SHALL no longer render the stage/custom-field management UI. Visiting `/app/settings/pipeline` MUST redirect to `/app/settings/profile`.

#### Scenario: Legacy settings route redirects
- **WHEN** an authenticated owner visits `/app/settings/pipeline`
- **THEN** the router redirects to `/app/settings/profile`

#### Scenario: Stage CRUD UI absent from settings
- **WHEN** the `/app/settings/profile` page renders
- **THEN** the DOM MUST NOT contain the strings "Etapas" or "Campos personalizados"
