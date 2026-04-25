import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createServiceSupabase } from '../db/client'
import type { AuthVariables } from '../middlewares/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any
type TeamEnv = { Variables: AuthVariables }

const InviteRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'agent']).default('agent'),
})

async function requireOwner(c: Context<TeamEnv>, next: () => Promise<void>) {
  if (c.var.role !== 'owner') {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Apenas owners podem efectuar esta acção' } },
      403,
    )
  }
  await next()
}

export function createTeamRouter(
  getServiceClient: () => AnyClient = createServiceSupabase,
) {
  const router = new Hono<TeamEnv>()

  router.get('/', requireOwner, async (c) => {
    const { tenantId } = c.var
    const serviceDb = getServiceClient()

    const { data: members, error } = await serviceDb
      .from('tenant_members')
      .select('user_id, role, created_at')
      .eq('tenant_id', tenantId)

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao listar membros' } }, 500)
    }

    return c.json({
      members: (members ?? []).map((m: Record<string, unknown>) => ({
        userId: m.user_id,
        role: m.role,
        createdAt: m.created_at,
      })),
    })
  })

  router.post('/invite', requireOwner, zValidator('json', InviteRequestSchema), async (c) => {
    const { tenantId } = c.var
    const { email, role } = c.req.valid('json')
    const serviceDb = getServiceClient()

    const { data: inviteData, error: inviteError } = await serviceDb.auth.admin.inviteUserByEmail(
      email,
      { data: { tenant_id: tenantId, role } },
    )

    if (inviteError || !inviteData?.user) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao convidar utilizador' } }, 500)
    }

    const { error: insertError } = await serviceDb.from('tenant_members').insert({
      tenant_id: tenantId,
      user_id: inviteData.user.id,
      role,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao adicionar membro' } }, 500)
    }

    return c.json({ member: { userId: inviteData.user.id, email, role } })
  })

  router.delete('/:userId', requireOwner, async (c) => {
    const { tenantId } = c.var
    const targetUserId = c.req.param('userId')
    const serviceDb = getServiceClient()

    const { data: members } = await serviceDb
      .from('tenant_members')
      .select('user_id, role')
      .eq('tenant_id', tenantId)

    const memberList = (members as Array<{ user_id: string; role: string }> ?? [])
    const target = memberList.find((m) => m.user_id === targetUserId)

    if (!target) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Membro não encontrado' } }, 404)
    }

    const owners = memberList.filter((m) => m.role === 'owner')
    if (target.role === 'owner' && owners.length <= 1) {
      return c.json(
        { error: { code: 'LAST_OWNER', message: 'Não é possível remover o único owner' } },
        409,
      )
    }

    await serviceDb
      .from('tenant_members')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', targetUserId)

    return new Response(null, { status: 204 })
  })

  return router
}

export const teamRouter = createTeamRouter()
