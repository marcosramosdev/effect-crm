# Auth Contracts

O login e a gestão de sessão são feitos directamente pelo Supabase Auth a partir do **client** (`@supabase/supabase-js`). O server **não** expõe endpoints de `sign-in`/`sign-out` — essa responsabilidade pertence ao SDK do Supabase.

O server expõe apenas um endpoint de "quem sou eu + em que tenant estou" para a UI resolver o seu estado inicial.

---

## `GET /api/auth/me`

Devolve o utilizador autenticado, o tenant a que pertence, e o papel.

**Auth**: obrigatória.

**Response 200**

```ts
MeResponseSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  role: z.enum(['owner', 'agent']),
})
```

**Response 401**: JWT ausente/inválido.
**Response 403**: JWT válido mas o user não está associado a nenhum tenant (erro de provisionamento — orientar o utilizador a contactar a agência).

---

## Nota sobre convites

Owners convidam novos membros via `POST /api/pipeline/team/invite` — ver `pipeline.md` (co-localizado porque "team" vive dentro de settings). O server chama `auth.admin.inviteUserByEmail` do Supabase com service-role, e depois insere em `tenant_members` com o `role` escolhido.
