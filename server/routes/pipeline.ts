import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createServiceSupabase, createUserSupabase } from '../db/client'
import type { AuthVariables } from '../middlewares/auth'
import {
  ListLeadsQuerySchema,
  MoveLeadRequestSchema,
  CreateStageRequestSchema,
  UpdateStageRequestSchema,
  DeleteStageQuerySchema,
} from '../types/pipeline'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any
type PipelineEnv = { Variables: AuthVariables }

async function requireOwner(c: Context<PipelineEnv>, next: () => Promise<void>) {
  if (c.var.role !== 'owner') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Apenas owners podem efectuar esta acção' } }, 403)
  }
  await next()
}

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

  // POST /stages — owner only
  router.post('/stages', requireOwner, zValidator('json', CreateStageRequestSchema), async (c) => {
    const { tenantId } = c.var
    const { name } = c.req.valid('json')
    const serviceDb = getServiceClient()

    const { data: existing } = await serviceDb
      .from('pipeline_stages')
      .select('order')
      .eq('tenant_id', tenantId)

    const rows = existing as Array<{ order: number }> ?? []
    const maxOrder = rows.length > 0 ? Math.max(...rows.map((s) => s.order)) : 0
    const newOrder = maxOrder + 1
    const id = crypto.randomUUID()

    const { error } = await serviceDb.from('pipeline_stages').insert({
      id,
      tenant_id: tenantId,
      name,
      order: newOrder,
      is_default_entry: false,
      created_at: new Date().toISOString(),
    })

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao criar etapa' } }, 500)
    }

    return c.json({ stage: { id, name, order: newOrder, isDefaultEntry: false } }, 201)
  })

  // PATCH /stages/:stageId — owner only
  router.patch('/stages/:stageId', requireOwner, zValidator('json', UpdateStageRequestSchema), async (c) => {
    const { tenantId } = c.var
    const stageId = c.req.param('stageId')
    const updates = c.req.valid('json')
    const serviceDb = getServiceClient()

    const { data: stage } = await serviceDb
      .from('pipeline_stages')
      .select('id, name, order, is_default_entry')
      .eq('id', stageId)
      .eq('tenant_id', tenantId)
      .single()

    if (!stage) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Etapa não encontrada' } }, 404)
    }

    const typedStage = stage as Record<string, unknown>
    const updatedName = updates.name ?? (typedStage.name as string)
    const updatedOrder = updates.order ?? (typedStage.order as number)

    const { error } = await serviceDb
      .from('pipeline_stages')
      .update({ name: updatedName, order: updatedOrder })
      .eq('id', stageId)
      .eq('tenant_id', tenantId)

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao actualizar etapa' } }, 500)
    }

    return c.json({
      stage: { id: typedStage.id, name: updatedName, order: updatedOrder, isDefaultEntry: typedStage.is_default_entry },
    })
  })

  // DELETE /stages/:stageId — owner only
  router.delete('/stages/:stageId', requireOwner, zValidator('query', DeleteStageQuerySchema), async (c) => {
    const { tenantId, userId } = c.var
    const stageId = c.req.param('stageId')
    const { destinationStageId } = c.req.valid('query')
    const serviceDb = getServiceClient()

    const { data: stage } = await serviceDb
      .from('pipeline_stages')
      .select('id, name, order, is_default_entry')
      .eq('id', stageId)
      .eq('tenant_id', tenantId)
      .single()

    if (!stage) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Etapa não encontrada' } }, 404)
    }

    const typedStage = stage as Record<string, unknown>

    if (typedStage.is_default_entry) {
      const { data: allStages } = await serviceDb
        .from('pipeline_stages')
        .select('id, is_default_entry')
        .eq('tenant_id', tenantId)

      const defaultCount = (allStages as Array<{ is_default_entry: boolean }> ?? [])
        .filter((s) => s.is_default_entry).length

      if (defaultCount <= 1) {
        return c.json(
          { error: { code: 'LAST_DEFAULT_STAGE', message: 'Não é possível apagar a única etapa de entrada' } },
          409,
        )
      }
    }

    const { data: affectedLeads } = await serviceDb
      .from('leads')
      .select('id')
      .eq('stage_id', stageId)
      .eq('tenant_id', tenantId)

    const leadsCount = (affectedLeads as Array<{ id: string }> ?? []).length

    if (leadsCount > 0 && !destinationStageId) {
      return c.json(
        {
          error: {
            code: 'STAGE_HAS_LEADS',
            message: 'A etapa tem leads. Escolha uma etapa de destino.',
            details: { leadsAffected: leadsCount },
          },
        },
        409,
      )
    }

    if (leadsCount > 0 && destinationStageId) {
      const now = new Date().toISOString()
      await serviceDb
        .from('leads')
        .update({ stage_id: destinationStageId, updated_at: now })
        .eq('stage_id', stageId)
        .eq('tenant_id', tenantId)

      const transitions = (affectedLeads as Array<{ id: string }>).map((lead) => ({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        lead_id: lead.id,
        from_stage_id: stageId,
        to_stage_id: destinationStageId,
        moved_by_user_id: userId,
        created_at: now,
      }))
      await serviceDb.from('stage_transitions').insert(transitions)
    }

    await serviceDb.from('pipeline_stages').delete().eq('id', stageId).eq('tenant_id', tenantId)

    return new Response(null, { status: 204 })
  })

  return router
}

export const pipelineRouter = createPipelineRouter()
