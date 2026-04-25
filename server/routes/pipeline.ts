import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createServiceSupabase, createUserSupabase } from '../db/client'
import type { AuthVariables } from '../middlewares/auth'
import { ListLeadsQuerySchema, MoveLeadRequestSchema } from '../types/pipeline'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export function createPipelineRouter(
  getUserSupabase: (jwt: string) => AnyClient = createUserSupabase,
  getServiceClient: () => AnyClient = createServiceSupabase,
) {
  const router = new Hono<{ Variables: AuthVariables }>()

  router.get('/stages', async (c) => {
    const { jwt } = c.var
    const userDb = getUserSupabase(jwt)
    const { data: stages, error } = await userDb
      .from('pipeline_stages')
      .select('id, name, order, is_default_entry')
      .order('order', { ascending: true })

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao buscar etapas' } }, 500)
    }

    return c.json({
      stages: (stages ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        isDefaultEntry: s.is_default_entry,
      })),
    })
  })

  router.get('/leads', zValidator('query', ListLeadsQuerySchema), async (c) => {
    const { jwt } = c.var
    const { stageId, search, cursor, limit } = c.req.valid('query')
    const userDb = getUserSupabase(jwt)

    let query = userDb
      .from('leads')
      .select('id, phone_number, display_name, stage_id, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit + 1)

    if (stageId) {
      query = query.eq('stage_id', stageId)
    }

    if (search) {
      query = query.or(`display_name.ilike.%${search}%,phone_number.ilike.%${search}%`)
    }

    if (cursor) {
      query = query.lt('updated_at', cursor)
    }

    const { data: rows, error } = await query

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao buscar leads' } }, 500)
    }

    const leads = (rows ?? []) as Record<string, unknown>[]
    const hasMore = leads.length > limit
    const page = hasMore ? leads.slice(0, limit) : leads
    const nextCursor = hasMore ? (page[page.length - 1].updated_at as string) : null

    return c.json({
      leads: page.map((l) => ({
        id: l.id,
        displayName: l.display_name,
        phoneNumber: l.phone_number,
        stageId: l.stage_id,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      })),
      nextCursor,
    })
  })

  router.patch(
    '/leads/:leadId/stage',
    zValidator('json', MoveLeadRequestSchema),
    async (c) => {
      const { tenantId, userId } = c.var
      const leadId = c.req.param('leadId')
      const { stageId: toStageId } = c.req.valid('json')

      const serviceDb = getServiceClient()

      const { data: lead } = await serviceDb
        .from('leads')
        .select('id, stage_id, phone_number, display_name, created_at, updated_at')
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (!lead) {
        return c.json(
          { error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } },
          404,
        )
      }

      const typedLead = lead as Record<string, unknown>
      const fromStageId = typedLead.stage_id
      const updatedAt = new Date().toISOString()

      const { error: updateError } = await serviceDb
        .from('leads')
        .update({ stage_id: toStageId, updated_at: updatedAt })
        .eq('id', leadId)
        .eq('tenant_id', tenantId)

      if (updateError) {
        return c.json(
          { error: { code: 'INTERNAL', message: 'Erro ao mover lead' } },
          500,
        )
      }

      await serviceDb.from('stage_transitions').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        lead_id: leadId,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        moved_by_user_id: userId,
        created_at: updatedAt,
      })

      return c.json({
        lead: {
          id: typedLead.id,
          displayName: typedLead.display_name,
          phoneNumber: typedLead.phone_number,
          stageId: toStageId,
          createdAt: typedLead.created_at,
          updatedAt,
        },
      })
    },
  )

  return router
}

export const pipelineRouter = createPipelineRouter()
