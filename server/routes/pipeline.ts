import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createServiceSupabase, createUserSupabase } from '../db/client'
import type { AuthVariables } from '../middlewares/auth'
import {
  ListLeadsQuerySchema,
  MoveLeadRequestSchema,
  CreateLeadRequestSchema,
  UpdateLeadRequestSchema,
  CreateStageRequestSchema,
  UpdateStageRequestSchema,
  DeleteStageQuerySchema,
  ReorderStagesRequestSchema,
  CreateCustomFieldRequestSchema,
  UpdateCustomFieldRequestSchema,
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
      .select('id, name, order, is_default_entry, color, description')
      .order('order', { ascending: true })

    if (error) {
      console.error('[pipeline] GET /stages', error)
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao buscar etapas' } }, 500)
    }

    return c.json({
      stages: (stages ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        isDefaultEntry: s.is_default_entry,
        color: s.color,
        description: s.description,
      })),
    })
  })

  router.get('/leads', zValidator('query', ListLeadsQuerySchema), async (c) => {
    const { jwt } = c.var
    const { stageId, search, cursor, limit } = c.req.valid('query')
    const userDb = getUserSupabase(jwt)

    let query = userDb
      .from('leads')
      .select('id, phone_number, display_name, stage_id, created_at, updated_at, lead_custom_values(field_id, value_text, value_number, value_date)')
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
      console.error('[pipeline] GET /leads', error)
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao buscar leads' } }, 500)
    }

    const leads = (rows ?? []) as Record<string, unknown>[]
    const hasMore = leads.length > limit
    const page = hasMore ? leads.slice(0, limit) : leads
    const nextCursor = hasMore ? (page[page.length - 1].updated_at as string) : null

    return c.json({
      leads: page.map((l) => {
        const customVals = (l.lead_custom_values ?? []) as Array<Record<string, unknown>>
        const customValues: Record<string, string | null> = {}
        for (const cv of customVals) {
          const val = (cv.value_text as string) ?? (cv.value_number as number)?.toString() ?? (cv.value_date as string)
          customValues[cv.field_id as string] = val ?? null
        }

        return {
          id: l.id,
          displayName: l.display_name,
          phoneNumber: l.phone_number,
          stageId: l.stage_id,
          createdAt: l.created_at,
          updatedAt: l.updated_at,
          customValues: Object.keys(customValues).length > 0 ? customValues : null,
        }
      }),
      nextCursor,
    })
  })

  // POST /leads — any role
  router.post('/leads', zValidator('json', CreateLeadRequestSchema), async (c) => {
    const { tenantId } = c.var
    const body = c.req.valid('json')
    const serviceDb = getServiceClient()

    const phoneNumber = body.phoneNumber?.trim() || `manual:${crypto.randomUUID()}`
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const { error: insertError } = await serviceDb.from('leads').insert({
      id,
      tenant_id: tenantId,
      phone_number: phoneNumber,
      display_name: body.displayName ?? null,
      stage_id: body.stageId,
      created_at: now,
      updated_at: now,
    })

    if (insertError) {
      if (insertError.message?.includes('unique') || insertError.code === '23505') {
        return c.json({ error: { code: 'LEAD_PHONE_EXISTS', message: 'Número de telefone já existe para este tenant' } }, 409)
      }
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao criar lead' } }, 500)
    }

    // Insert custom values if provided
    if (body.customValues && Object.keys(body.customValues).length > 0) {
      const { data: fields } = await serviceDb
        .from('lead_custom_fields')
        .select('id, type')
        .eq('tenant_id', tenantId)
        .in('id', Object.keys(body.customValues))

      const fieldMap = new Map((fields ?? []).map((f: Record<string, unknown>) => [f.id as string, f.type as string]))

      const valueRows = Object.entries(body.customValues)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([fieldId, value]) => {
          const type = fieldMap.get(fieldId)
          return {
            lead_id: id,
            field_id: fieldId,
            value_text: type === 'text' || type === 'url' || type === 'select' ? (value as string) : null,
            value_number: type === 'number' ? Number(value) : null,
            value_date: type === 'date' ? (value as string) : null,
          }
        })

      if (valueRows.length > 0) {
        await serviceDb.from('lead_custom_values').insert(valueRows)
      }
    }

    return c.json({
      lead: {
        id,
        displayName: body.displayName ?? null,
        phoneNumber,
        stageId: body.stageId,
        createdAt: now,
        updatedAt: now,
        customValues: body.customValues ?? null,
      },
    }, 201)
  })

  // PATCH /leads/:leadId — any role
  router.patch('/leads/:leadId', zValidator('json', UpdateLeadRequestSchema), async (c) => {
    const { tenantId } = c.var
    const leadId = c.req.param('leadId')
    const updates = c.req.valid('json')
    const serviceDb = getServiceClient()

    const { data: lead } = await serviceDb
      .from('leads')
      .select('id, phone_number, display_name, stage_id, created_at, updated_at')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!lead) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } }, 404)
    }

    const typedLead = lead as Record<string, unknown>
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.displayName !== undefined) updateData.display_name = updates.displayName
    if (updates.phoneNumber !== undefined) updateData.phone_number = updates.phoneNumber
    if (updates.stageId !== undefined) updateData.stage_id = updates.stageId

    const { error: updateError } = await serviceDb
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('tenant_id', tenantId)

    if (updateError) {
      if (updateError.message?.includes('unique') || updateError.code === '23505') {
        return c.json({ error: { code: 'LEAD_PHONE_EXISTS', message: 'Número de telefone já existe para este tenant' } }, 409)
      }
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao actualizar lead' } }, 500)
    }

    // Upsert/delete custom values
    if (updates.customValues) {
      const { data: fields } = await serviceDb
        .from('lead_custom_fields')
        .select('id, type')
        .eq('tenant_id', tenantId)
        .in('id', Object.keys(updates.customValues))

      const fieldMap = new Map((fields ?? []).map((f: Record<string, unknown>) => [f.id as string, f.type as string]))

      const toInsert: Array<Record<string, unknown>> = []
      const toDelete: string[] = []

      for (const [fieldId, value] of Object.entries(updates.customValues)) {
        if (value === null || value === undefined) {
          toDelete.push(fieldId)
        } else {
          const type = fieldMap.get(fieldId)
          toInsert.push({
            lead_id: leadId,
            field_id: fieldId,
            value_text: type === 'text' || type === 'url' || type === 'select' ? (value as string) : null,
            value_number: type === 'number' ? Number(value) : null,
            value_date: type === 'date' ? (value as string) : null,
          })
        }
      }

      if (toDelete.length > 0) {
        await serviceDb.from('lead_custom_values').delete().eq('lead_id', leadId).in('field_id', toDelete)
      }

      if (toInsert.length > 0) {
        await serviceDb.from('lead_custom_values').upsert(toInsert, { onConflict: 'lead_id,field_id' })
      }
    }

    const { data: updatedLead } = await serviceDb
      .from('leads')
      .select('id, phone_number, display_name, stage_id, created_at, updated_at, lead_custom_values(field_id, value_text, value_number, value_date)')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single()

    const typedUpdated = updatedLead as Record<string, unknown>
    const customVals = (typedUpdated.lead_custom_values ?? []) as Array<Record<string, unknown>>
    const customValues: Record<string, string | null> = {}
    for (const cv of customVals) {
      const val = (cv.value_text as string) ?? (cv.value_number as number)?.toString() ?? (cv.value_date as string)
      customValues[cv.field_id as string] = val ?? null
    }

    return c.json({
      lead: {
        id: typedUpdated.id,
        displayName: typedUpdated.display_name,
        phoneNumber: typedUpdated.phone_number,
        stageId: typedUpdated.stage_id,
        createdAt: typedUpdated.created_at,
        updatedAt: typedUpdated.updated_at,
        customValues: Object.keys(customValues).length > 0 ? customValues : null,
      },
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

  // DELETE /leads/:leadId — owner only; cascade via DB FKs
  router.delete('/leads/:leadId', requireOwner, async (c) => {
    const { tenantId } = c.var
    const leadId = c.req.param('leadId')
    const serviceDb = getServiceClient()

    const { data: lead } = await serviceDb
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!lead) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Lead não encontrado' } }, 404)
    }

    await serviceDb
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('tenant_id', tenantId)

    return c.json({ deletedLeadId: leadId })
  })

  // GET /custom-fields — any role
  router.get('/custom-fields', async (c) => {
    const { jwt } = c.var
    const userDb = getUserSupabase(jwt)
    const { data: fields, error } = await userDb
      .from('lead_custom_fields')
      .select('id, tenant_id, key, label, type, options, order, created_at')
      .order('order', { ascending: true })

    if (error) {
      console.error('[pipeline] GET /custom-fields', error)
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao buscar campos personalizados' } }, 500)
    }

    return c.json({
      fields: (fields ?? []).map((f: Record<string, unknown>) => ({
        id: f.id,
        tenantId: f.tenant_id,
        key: f.key,
        label: f.label,
        type: f.type,
        options: f.options,
        order: f.order,
        createdAt: f.created_at,
      })),
    })
  })

  // POST /custom-fields — owner only
  router.post('/custom-fields', requireOwner, zValidator('json', CreateCustomFieldRequestSchema), async (c) => {
    const { tenantId } = c.var
    const body = c.req.valid('json')
    const serviceDb = getServiceClient()

    const { data: existingCount } = await serviceDb
      .from('lead_custom_fields')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if ((existingCount as number ?? 0) >= 20) {
      return c.json({ error: { code: 'CUSTOM_FIELDS_LIMIT', message: 'Limite de 20 campos personalizados atingido' } }, 409)
    }

    const { data: maxOrderRow } = await serviceDb
      .from('lead_custom_fields')
      .select('order')
      .eq('tenant_id', tenantId)
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const newOrder = (maxOrderRow?.order as number ?? 0) + 1
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const { error } = await serviceDb.from('lead_custom_fields').insert({
      id,
      tenant_id: tenantId,
      key: body.key,
      label: body.label,
      type: body.type,
      options: body.options ?? null,
      order: newOrder,
      created_at: now,
    })

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao criar campo personalizado' } }, 500)
    }

    return c.json({
      field: {
        id,
        tenantId,
        key: body.key,
        label: body.label,
        type: body.type,
        options: body.options ?? null,
        order: newOrder,
        createdAt: now,
      },
    }, 201)
  })

  // PATCH /custom-fields/:fieldId — owner only
  router.patch('/custom-fields/:fieldId', requireOwner, zValidator('json', UpdateCustomFieldRequestSchema), async (c) => {
    const { tenantId } = c.var
    const fieldId = c.req.param('fieldId')
    const updates = c.req.valid('json')
    const serviceDb = getServiceClient()

    const { data: field } = await serviceDb
      .from('lead_custom_fields')
      .select('id, tenant_id, key, label, type, options, order, created_at')
      .eq('id', fieldId)
      .eq('tenant_id', tenantId)
      .single()

    if (!field) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Campo personalizado não encontrado' } }, 404)
    }

    const updateData: Record<string, unknown> = {}
    if (updates.label !== undefined) updateData.label = updates.label
    if (updates.order !== undefined) updateData.order = updates.order
    if (updates.options !== undefined) updateData.options = updates.options

    const { error } = await serviceDb
      .from('lead_custom_fields')
      .update(updateData)
      .eq('id', fieldId)
      .eq('tenant_id', tenantId)

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao actualizar campo personalizado' } }, 500)
    }

    const typedField = field as Record<string, unknown>
    return c.json({
      field: {
        id: typedField.id,
        tenantId: typedField.tenant_id,
        key: typedField.key,
        label: updates.label ?? typedField.label,
        type: typedField.type,
        options: updates.options ?? typedField.options,
        order: updates.order ?? typedField.order,
        createdAt: typedField.created_at,
      },
    })
  })

  // DELETE /custom-fields/:fieldId — owner only
  router.delete('/custom-fields/:fieldId', requireOwner, async (c) => {
    const { tenantId } = c.var
    const fieldId = c.req.param('fieldId')
    const serviceDb = getServiceClient()

    const { data: field } = await serviceDb
      .from('lead_custom_fields')
      .select('id')
      .eq('id', fieldId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!field) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Campo personalizado não encontrado' } }, 404)
    }

    await serviceDb
      .from('lead_custom_fields')
      .delete()
      .eq('id', fieldId)
      .eq('tenant_id', tenantId)

    return new Response(null, { status: 204 })
  })

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
      color: '#64748b',
      created_at: new Date().toISOString(),
    })

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao criar etapa' } }, 500)
    }

    return c.json({ stage: { id, name, order: newOrder, isDefaultEntry: false, color: '#64748b', description: null } }, 201)
  })

  // PATCH /stages/reorder — owner only
  router.patch('/stages/reorder', requireOwner, zValidator('json', ReorderStagesRequestSchema), async (c) => {
    const { tenantId } = c.var
    const { stages: reorder } = c.req.valid('json')
    const serviceDb = getServiceClient()

    // Atomic two-pass swap: negative orders first, then real orders
    const { error: negError } = await serviceDb.rpc('reorder_stages', {
      p_tenant_id: tenantId,
      p_stages: reorder.map((s) => ({ id: s.id, order: -s.order })),
    })

    if (negError) {
      // Fallback: manual transaction if RPC not available
      for (const s of reorder) {
        await serviceDb.from('pipeline_stages').update({ order: -s.order }).eq('id', s.id).eq('tenant_id', tenantId)
      }
      for (const s of reorder) {
        await serviceDb.from('pipeline_stages').update({ order: s.order }).eq('id', s.id).eq('tenant_id', tenantId)
      }
    }

    const { data: stages } = await serviceDb
      .from('pipeline_stages')
      .select('id, name, order, is_default_entry, color, description')
      .eq('tenant_id', tenantId)
      .order('order', { ascending: true })

    return c.json({
      stages: (stages ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        isDefaultEntry: s.is_default_entry,
        color: s.color,
        description: s.description,
      })),
    })
  })

  // PATCH /stages/:stageId — owner only
  router.patch('/stages/:stageId', requireOwner, zValidator('json', UpdateStageRequestSchema), async (c) => {
    const { tenantId } = c.var
    const stageId = c.req.param('stageId')
    const updates = c.req.valid('json')
    const serviceDb = getServiceClient()

    const { data: stage } = await serviceDb
      .from('pipeline_stages')
      .select('id, name, order, is_default_entry, color, description')
      .eq('id', stageId)
      .eq('tenant_id', tenantId)
      .single()

    if (!stage) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Etapa não encontrada' } }, 404)
    }

    const typedStage = stage as Record<string, unknown>
    const updateData: Record<string, unknown> = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.order !== undefined) updateData.order = updates.order
    if (updates.color !== undefined) updateData.color = updates.color
    if (updates.description !== undefined) updateData.description = updates.description || null

    const { error } = await serviceDb
      .from('pipeline_stages')
      .update(updateData)
      .eq('id', stageId)
      .eq('tenant_id', tenantId)

    if (error) {
      return c.json({ error: { code: 'INTERNAL', message: 'Erro ao actualizar etapa' } }, 500)
    }

    return c.json({
      stage: {
        id: typedStage.id,
        name: updates.name ?? typedStage.name,
        order: updates.order ?? typedStage.order,
        isDefaultEntry: typedStage.is_default_entry,
        color: updates.color ?? typedStage.color,
        description: updates.description !== undefined ? (updates.description || null) : typedStage.description,
      },
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
