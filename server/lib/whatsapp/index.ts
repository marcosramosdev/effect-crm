export { createInstance, connect, disconnect, sendText, configureWebhook } from './uazapi-client'
export { consume as rateLimit } from './rate-limiter'

// stub — filled in US1..US3
export async function handleWebhookEvent(_payload: unknown): Promise<void> {}
