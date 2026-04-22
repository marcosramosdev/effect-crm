# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Two **independent** workspaces with their own `package.json` and `bun.lock` — there is no monorepo tool (no pnpm workspaces, no Turbo). `bun install` at the repo root only installs server deps; to work on the frontend you must `cd client && bun install` separately.

- **Root** (`server/`, root `package.json`) — a [Hono](https://hono.dev/) server. Root `tsconfig.json` sets `jsxImportSource: "hono/jsx"`, so any JSX in `server/` is Hono JSX (NOT React). Entry point: `server/index.ts`.
- **`client/`** — a React 19 SPA using [TanStack Router](https://tanstack.com/router) (file-based routing) + Vite 8 + Tailwind 4. Entry: `client/src/main.tsx` → `RouterProvider` with a generated `routeTree.gen.ts`.

Bun is the package manager **and** the server runtime. The client uses Vite/Node tooling but is still installed with `bun install`.

## Commands

Run root-level commands from the repo root; client commands from `client/`.

**Server (root):**
```sh
bun install
bun run dev            # bun --hot server/index.ts, listens on :3000
```

**Client (`cd client`):**
```sh
bun install
bun --bun run dev      # vite dev on :3000 (conflicts with server — don't run both)
bun --bun run build    # vite build
bun --bun run test     # vitest run (jsdom env, one-shot)
bun --bun run lint     # eslint
bun --bun run format   # prettier --check .
bun --bun run check    # prettier --write . && eslint --fix
```

Both `dev` scripts bind port 3000. If you need them running concurrently, change one port (`vite dev --port <N>` or edit the root script).

**Single test:** `bun --bun run test -- <file-or-pattern>` (Vitest pattern matching), or `bun --bun run test -- -t "<test name>"`.

## Client architecture notes

- **Routing is file-based.** Adding a file under `client/src/routes/` produces a route; the TanStack router plugin regenerates `client/src/routeTree.gen.ts` automatically on `vite dev`/`vite build`. Do **not** hand-edit `routeTree.gen.ts`. The root layout is `routes/__root.tsx`.
- **Two routers exist:** `src/main.tsx` instantiates one via `createRouter`, and `src/router.tsx` exports `getRouter()` (TanStack Start convention). Only `main.tsx` is wired in the SPA entry; `router.tsx` is scaffolding that can be used if/when server rendering is added.
- **Path aliases:** tsconfig declares `#/*` and `@/*` → `./src/*`. `vite.config.ts` additionally declares `@components/*`, `@features/*`, `@hooks/*`, `@routes/*` — these resolve at bundle time but are **not** in tsconfig paths, so TS won't know about them. Add them to `client/tsconfig.json` `paths` if you start using them (the `components/`, `features/`, `hooks/` dirs are currently empty scaffolding).
- **Styling:** Tailwind 4 via `@tailwindcss/vite`. Global CSS is `src/styles.css` (imported once from `__root.tsx`).
- **Devtools** (`TanStackDevtools` in `__root.tsx`) render in dev; leave them in unless explicitly removing.

## Conventions

- **Prettier** (from `client/prettier.config.js`): no semicolons, single quotes, trailing commas everywhere. Applies to the client workspace; match this style if touching server code too.
- **ESLint** extends `@tanstack/eslint-config` with these overrides turned off: `import/no-cycle`, `import/order`, `sort-imports`, `@typescript-eslint/array-type`, `@typescript-eslint/require-await`, `pnpm/json-enforce-catalog`. Don't re-enable them without reason.
- **TS is strict** in both workspaces. Client additionally sets `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax` — so type-only imports must use `import type`, and unused symbols are hard errors.

## Not yet wired

As of this writing, the server (Hono) and client (TanStack Router SPA) are not connected — no proxy config, no shared types package, no API calls from client to server. The project is early scaffolding; when adding cross-workspace features, decide explicitly whether to add a Vite dev proxy, co-locate via TanStack Start server functions, or keep them fully separate.
