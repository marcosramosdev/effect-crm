import type { RegisterRequest, AuthSession } from '../../types/auth'

export interface RegisterDeps {
  adminClient: {
    auth: {
      admin: {
        createUser(opts: {
          email: string
          password: string
          email_confirm: boolean
        }): Promise<{
          data: { user: { id: string } | null }
          error: { message: string } | null
        }>
        deleteUser(id: string): Promise<{ error: unknown }>
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbClient: { from(table: string): any }
  anonClient: {
    auth: {
      signInWithPassword(creds: { email: string; password: string }): Promise<{
        data: {
          session: {
            access_token: string
            refresh_token: string
            expires_at: number
          } | null
        }
        error: { message: string } | null
      }>
    }
  }
}

export async function registerOwner(
  input: RegisterRequest,
  deps: RegisterDeps,
): Promise<AuthSession> {
  const { email, password, tenantName } = input
  const { adminClient, dbClient, anonClient } = deps

  const trimmedName = tenantName.trim()
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    throw new Error('tenant_name_invalid')
  }

  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (userError || !userData.user) {
    throw new Error(userError?.message ?? 'create_user_failed')
  }

  const userId = userData.user.id

  let tenantId: string
  try {
    const { data: tenantData, error: tenantError } = await dbClient
      .from('tenants')
      .insert({ name: trimmedName })
      .select('id')
      .single()

    if (tenantError || !tenantData) {
      throw new Error((tenantError as { message?: string } | null)?.message ?? 'tenant_insert_failed')
    }
    tenantId = (tenantData as { id: string }).id
  } catch (err) {
    await adminClient.auth.admin.deleteUser(userId)
    throw err
  }

  try {
    const { data: memberData, error: memberError } = await dbClient
      .from('tenant_members')
      .insert({ user_id: userId, tenant_id: tenantId, role: 'owner' })
      .select()
      .single()

    if (memberError || !memberData) {
      throw new Error(
        (memberError as { message?: string } | null)?.message ?? 'member_insert_failed',
      )
    }
  } catch (err) {
    await adminClient.auth.admin.deleteUser(userId)
    await dbClient.from('tenants').delete().eq('id', tenantId)
    throw err
  }

  // Seed default custom fields for the new tenant
  try {
    const now = new Date().toISOString()
    await dbClient.from('lead_custom_fields').insert([
      { tenant_id: tenantId, key: 'email', label: 'Email', type: 'email', order: 0, created_at: now },
      { tenant_id: tenantId, key: 'instagram', label: 'Instagram', type: 'instagram', order: 1, created_at: now },
      { tenant_id: tenantId, key: 'appointmentDate', label: 'Data do compromisso', type: 'date', order: 2, created_at: now },
    ])
  } catch {
    // Non-critical: seeding failure should not block registration
  }

  const { data: sessionData, error: sessionError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })

  if (sessionError || !sessionData.session) {
    throw new Error(sessionError?.message ?? 'sign_in_failed')
  }

  const { access_token, refresh_token, expires_at } = sessionData.session
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: expires_at,
  }
}
