# client/src/CLAUDE.md

Notas de organização e padrões para o código dentro de `client/src/`.

## Organização de pastas

- `routes/`: páginas/rotas (TanStack Router file-based)
- `features/`: módulos por domínio (ex.: leads, pipeline, inbox)
- `components/`: UI reutilizável (preferir componentes pequenos e composáveis)
- `hooks/`: hooks partilhados (ex.: auth, org/tenant, permissões)

## Padrões recomendados

- Componentes de rota devem orquestrar e delegar para `features/*`.
- Leitura/escrita remota deve passar por React Query (queries/mutations).
- Validações de formulários e payloads: Zod (idealmente o mesmo schema serve UI e requests).

## Pipeline / Board

- Usar `@hello-pangea/dnd` para drag-and-drop entre colunas.
- `PipelineBoard` delega DnD para `PipelineBoardDnd` (wrapper em `features/pipeline/dnd-pangea/`).
- `PipelineBoardDnd` usa `DragDropContext` + `Droppable` + `Draggable`; calcula `position` com midpoint strategy no `onDragEnd`.
- `framer-motion` mantido apenas para `Reorder.Group` nos painéis de settings (etapas/campos).
- Mockar `@hello-pangea/dnd` em testes (Vitest) para simplificar assertions de DOM.

## Imports / aliases

- Preferir `@/` ou `#/*` para imports dentro de `src`.
- Os aliases `@components/*`, `@features/*`, `@hooks/*`, `@routes/*` existem no `vite.config.ts`.
- Se o TypeScript não reconhecer um alias, alinhar `paths` no `client/tsconfig.json` (não só no Vite).
