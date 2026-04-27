# Auth Contract — client ↔ server (Spec 002)

Detalha o contrato entre o frontend e o backend que **não** é puramente HTTP/JSON. Cobre: storage de tokens, ciclo de vida da sessão, e como TanStack Router/Query interagem com isto.

---

## Princípio orientador

> O server é o **único** ponto de chamada para operações de auth com efeito-colateral em tenant data (registo, login, logout). O Supabase Auth é a fonte de verdade para identidade e tokens; o server proxia, não substitui.

---

## Storage de tokens no client

- Os tokens (`access_token`, `refresh_token`) devolvidos por `/api/auth/login` e `/api/auth/register` são entregues ao Supabase JS via `supabase.auth.setSession({ access_token, refresh_token })`.
- O Supabase JS persiste em `localStorage` (chave `sb-<project-ref>-auth-token`) e gere refresh automático.
- **O client não inventa storage adicional.** Não guarda email/role/tenantId em estado próprio — esses vêm sempre de `['auth','me']` cache.

### `apiFetch` e header `Authorization`

`client/src/lib/api.ts` (existente) já lê `supabase.auth.getSession()` e injecta `Bearer`. Sem alteração de comportamento.

### Comportamento em 401

- Antes (feature 001): chama `supabase.auth.signOut()`.
- **Depois (esta feature)**: chama uma função local `clearSession()` que faz `supabase.auth.signOut({ scope: 'local' })` — limpa storage local sem chamada de rede ao Supabase.
- Lança `Error('Unauthorized')` para o React Query → o `beforeLoad` do `/app/*` redirecciona para `/auth/login` no próximo navigate.

---

## Ciclo de vida — sequência canónica

### Registo

```text
1. user submete <RegisterScreen> form (email, password, tenantName)
2. useRegisterMutation.mutate({...})
   └─ apiFetch('/auth/register', POST)
      └─ servidor: cria user + tenant + member, devolve AuthSession
3. onSuccess:
   ├─ supabase.auth.setSession({ access_token, refresh_token })
   ├─ queryClient.invalidateQueries({ queryKey: ['auth','me'] })
   └─ router.navigate({ to: '/app' })
4. /app.tsx beforeLoad executa, ensureQueryData('me') resolve com 200, render do app
```

### Login (com return-to)

```text
1. user anónimo abre /app/inbox
2. /app.tsx beforeLoad → ensureQueryData('me') falha (401)
3. throw redirect({ to: '/auth/login', search: { redirect: '/app/inbox' } })
4. user submete <LoginScreen>
5. useLoginMutation.mutate({email, password})
   └─ apiFetch('/auth/login', POST) → AuthSession
6. onSuccess:
   ├─ supabase.auth.setSession(...)
   ├─ queryClient.invalidateQueries({ queryKey: ['auth','me'] })
   └─ router.navigate({ to: search.redirect ?? '/app' })
```

### Logout

```text
1. user clica "Sair" em <UserMenu>
2. useLogoutMutation.mutate()
   └─ apiFetch('/auth/logout', POST)  // 204
3. onSuccess (executa mesmo se 401 — logout é idempotente):
   ├─ supabase.auth.signOut({ scope: 'local' })
   ├─ queryClient.clear()
   └─ router.navigate({ to: '/' })
4. / index.tsx beforeLoad → ensureQueryData('me') falha → renderiza HomePage
```

### Sessão expira durante navegação

```text
1. user em /app/pipeline, faz mutate (ex.: mover lead)
2. apiFetch chama /api/pipeline/leads/:id (Bearer expirado)
3. Supabase JS já tinha tentado refresh — falhou (refresh expirado também)
4. servidor responde 401
5. apiFetch chama clearSession() → supabase.auth.signOut({ scope: 'local' })
6. apiFetch lança Error('Unauthorized')
7. React Query mutation onError → toast genérico
8. próximo navigate (ou refetch automático de 'me') invoca beforeLoad de /app.tsx
9. ensureQueryData('me') falha → redirect /auth/login com search.redirect=/app/pipeline
```

---

## TanStack Router — guards (versão final)

```ts
// client/src/routes/app.tsx (NOVO)
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions)
    } catch {
      throw redirect({
        to: '/auth/login',
        search: { redirect: location.href },
      })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="min-h-screen">
      <AppShell />
      <Outlet />
    </div>
  )
}
```

```ts
// client/src/routes/auth.tsx (NOVO)
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'

export const Route = createFileRoute('/auth')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions)
      throw redirect({ to: '/app' })   // já autenticado → fora daqui
    } catch (err) {
      // se err é um redirect, propaga; se é falha de auth ('me' 401), deixa cair para children
      if (err instanceof Error && 'to' in err) throw err
    }
  },
  component: AuthLayout,
})
```

```ts
// client/src/routes/index.tsx (REESCRITO — homepage pública)
import { createFileRoute, redirect } from '@tanstack/react-router'
import { authQueryOptions } from '../hooks/useAuth'
import { HomePage } from '../features/auth/HomePage'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions)
      throw redirect({ to: '/app' })
    } catch (err) {
      if (err instanceof Error && 'to' in err) throw err
      // sem sessão → renderiza HomePage
    }
  },
  component: HomePage,
})
```

---

## Search params — `?redirect=...`

`/auth/login` aceita `?redirect=<pathname>` para suportar return-to. TanStack Router validation:

```ts
// client/src/routes/auth/login.tsx
import { z } from 'zod'

export const Route = createFileRoute('/auth/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginScreen,
})
```

`useLoginMutation.onSuccess` lê `Route.useSearch().redirect` e passa-o a `router.navigate`.

---

## TDD — cobertura prevista

| Comportamento | Local do teste |
|---|---|
| 401 do server → `apiFetch` chama `clearSession` (não `Supabase.signOut` de rede) | `client/src/lib/__tests__/api.test.ts` (criar se ainda não existir) |
| Login mutation onSuccess invoca `setSession` + invalidate + navigate | `client/src/features/auth/__tests__/useLoginMutation.test.ts` |
| Login com `redirect` query — navega para a URL preservada | mesmo ficheiro |
| Register mutation envia tenantName no body | `useRegisterMutation.test.ts` |
| Logout mutation é idempotente — onError com 401 ainda limpa client | `useLogoutMutation.test.ts` |
| `/app/*` sem sessão → redirect para `/auth/login` com search.redirect | `routes/__tests__/guard.test.tsx` |
| `/auth/login` com sessão → redirect para `/app` | mesmo ficheiro |
| `/` sem sessão → renderiza `HomePage` | mesmo ficheiro |
| `/` com sessão → redirect para `/app` | mesmo ficheiro |
