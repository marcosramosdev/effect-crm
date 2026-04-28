import { describe, it, expect, mock } from 'bun:test'
import { registerOwner } from './register'

const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function makeChain(
  singleResult: { data: unknown; error: unknown } = { data: null, error: null },
  thenResult: { error: unknown } = { error: null },
) {
  const chain: Record<string, unknown> = {
    insert: () => chain,
    delete: () => chain,
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(singleResult),
    then: <R>(resolve: (v: unknown) => R, reject?: (r: unknown) => R) =>
      Promise.resolve(thenResult).then(resolve, reject),
  }
  return chain
}

describe('registerOwner', () => {
  it('happy path: cria user+tenant+member e devolve AuthSession', async () => {
    const deleteUser = mock(async () => ({ error: null }))
    const adminClient = {
      auth: {
        admin: {
          createUser: mock(async () => ({ data: { user: { id: USER_ID } }, error: null })),
          deleteUser,
        },
      },
    }
    const dbClient = {
      from: (table: string) => {
        if (table === 'tenants') return makeChain({ data: { id: TENANT_ID }, error: null })
        return makeChain({ data: {}, error: null })
      },
    }
    const anonClient = {
      auth: {
        signInWithPassword: mock(async () => ({
          data: {
            session: { access_token: 'tok_a', refresh_token: 'tok_r', expires_at: 9999999999 },
          },
          error: null,
        })),
      },
    }

    const result = await registerOwner(
      { email: 'owner@example.com', password: 'password123', tenantName: 'Acme Corp' },
      { adminClient, dbClient, anonClient },
    )

    expect(result).toMatchObject({
      accessToken: 'tok_a',
      refreshToken: 'tok_r',
      expiresAt: 9999999999,
    })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('falha em insert tenants → user removido, sem tenant', async () => {
    const deleteUser = mock(async () => ({ error: null }))
    const adminClient = {
      auth: {
        admin: {
          createUser: mock(async () => ({ data: { user: { id: USER_ID } }, error: null })),
          deleteUser,
        },
      },
    }
    const dbClient = {
      from: (table: string) => {
        if (table === 'tenants') return makeChain({ data: null, error: { message: 'insert failed' } })
        return makeChain({ data: {}, error: null })
      },
    }
    const anonClient = {
      auth: { signInWithPassword: mock(async () => ({ data: { session: null }, error: null })) },
    }

    await expect(
      registerOwner(
        { email: 'owner@example.com', password: 'password123', tenantName: 'Acme Corp' },
        { adminClient, dbClient, anonClient },
      ),
    ).rejects.toThrow()

    expect(deleteUser).toHaveBeenCalledWith(USER_ID)
  })

  it('falha em insert tenant_members → user e tenant removidos', async () => {
    const deleteUser = mock(async () => ({ error: null }))
    const tenantDeleteCalled = { value: false }

    const adminClient = {
      auth: {
        admin: {
          createUser: mock(async () => ({ data: { user: { id: USER_ID } }, error: null })),
          deleteUser,
        },
      },
    }

    const tenantsChain: Record<string, unknown> = {
      insert: () => tenantsChain,
      delete: () => {
        tenantDeleteCalled.value = true
        return tenantsChain
      },
      select: () => tenantsChain,
      eq: () => tenantsChain,
      single: () => Promise.resolve({ data: { id: TENANT_ID }, error: null }),
      then: <R>(resolve: (v: unknown) => R, reject?: (r: unknown) => R) =>
        Promise.resolve({ error: null }).then(resolve, reject),
    }

    const dbClient = {
      from: (table: string) => {
        if (table === 'tenants') return tenantsChain
        if (table === 'tenant_members') return makeChain({ data: null, error: { message: 'insert failed' } })
        return makeChain({ data: {}, error: null })
      },
    }
    const anonClient = {
      auth: { signInWithPassword: mock(async () => ({ data: { session: null }, error: null })) },
    }

    await expect(
      registerOwner(
        { email: 'owner@example.com', password: 'password123', tenantName: 'Acme Corp' },
        { adminClient, dbClient, anonClient },
      ),
    ).rejects.toThrow()

    expect(deleteUser).toHaveBeenCalledWith(USER_ID)
    expect(tenantDeleteCalled.value).toBe(true)
  })

  it('email duplicado → lança email_exists sem side-effects em tenant', async () => {
    const deleteUser = mock(async () => ({ error: null }))
    const adminClient = {
      auth: {
        admin: {
          createUser: mock(async () => ({ data: { user: null }, error: { message: 'email_exists' } })),
          deleteUser,
        },
      },
    }
    const tenantInsertCalled = { value: false }
    const dbClient = {
      from: (table: string) => {
        const chain: Record<string, unknown> = {
          insert: () => {
            if (table === 'tenants') tenantInsertCalled.value = true
            return chain
          },
          select: () => chain,
          eq: () => chain,
          single: () => Promise.resolve({ data: null, error: null }),
          then: <R>(resolve: (v: unknown) => R, reject?: (r: unknown) => R) =>
            Promise.resolve({ error: null }).then(resolve, reject),
        }
        return chain
      },
    }
    const anonClient = {
      auth: { signInWithPassword: mock(async () => ({ data: { session: null }, error: null })) },
    }

    await expect(
      registerOwner(
        { email: 'dup@example.com', password: 'password123', tenantName: 'Acme Corp' },
        { adminClient, dbClient, anonClient },
      ),
    ).rejects.toMatchObject({ message: 'email_exists' })

    expect(tenantInsertCalled.value).toBe(false)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('tenantName inválido → lança sem chamar Supabase', async () => {
    const createUser = mock(async () => ({ data: { user: { id: USER_ID } }, error: null }))
    const adminClient = {
      auth: { admin: { createUser, deleteUser: mock(async () => ({ error: null })) } },
    }
    const dbClient = { from: mock(() => makeChain()) }
    const anonClient = {
      auth: { signInWithPassword: mock(async () => ({ data: { session: null }, error: null })) },
    }

    await expect(
      registerOwner(
        { email: 'owner@example.com', password: 'password123', tenantName: 'x' },
        { adminClient, dbClient, anonClient },
      ),
    ).rejects.toMatchObject({ message: 'tenant_name_invalid' })

    expect(createUser).not.toHaveBeenCalled()
  })
})
