import { createClient } from '@supabase/supabase-js'

export function createUserSupabase(jwt: string) {
  const url = process.env.SUPABASE_URL!
  const anonKey = process.env.SUPABASE_ANON_KEY!
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })
}

let _serviceClient: ReturnType<typeof createClient> | null = null

export function createServiceSupabase() {
  if (_serviceClient) return _serviceClient
  const url = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  _serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _serviceClient
}
