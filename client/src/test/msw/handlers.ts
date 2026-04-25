import { http, HttpResponse } from 'msw'
import type { RequestHandler } from 'msw'

export const handlers: RequestHandler[] = [
  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'agent@test.example',
      tenantId: '00000000-0000-0000-0000-000000000002',
      tenantName: 'Test Tenant',
      role: 'agent',
    })
  }),
]
