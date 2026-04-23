const INSTANCE = 'inst-test-001'
const CHATID = '5511999999999@s.whatsapp.net'
const MSG_ID = '3EB0C4F5A8D94E1B2C3D'

// messages — text (conversation)
export const inboundTextMessage = {
  event: 'messages' as const,
  instance: INSTANCE,
  data: {
    id: MSG_ID,
    chatid: CHATID,
    fromMe: false,
    messageType: 'conversation',
    text: 'Olá, quero saber mais sobre os vossos serviços',
    pushName: 'Maria Santos',
    timestamp: 1700000000,
  },
}

// messages — unsupported type (imageMessage)
export const inboundUnsupportedMessage = {
  event: 'messages' as const,
  instance: INSTANCE,
  data: {
    id: '3EB0C4F5A8D94E1B2C3E',
    chatid: CHATID,
    fromMe: false,
    messageType: 'imageMessage',
    text: null,
    pushName: 'Maria Santos',
    timestamp: 1700000005,
  },
}

// messages_update — each delivery status
const baseUpdate = {
  event: 'messages_update' as const,
  instance: INSTANCE,
  data: { id: MSG_ID, chatid: CHATID },
}

export const messageUpdatePending = { ...baseUpdate, data: { ...baseUpdate.data, status: 'PENDING' } }
export const messageUpdateServerAck = { ...baseUpdate, data: { ...baseUpdate.data, status: 'SERVER_ACK' } }
export const messageUpdateDeliveryAck = { ...baseUpdate, data: { ...baseUpdate.data, status: 'DELIVERY_ACK' } }
export const messageUpdateRead = { ...baseUpdate, data: { ...baseUpdate.data, status: 'READ' } }
export const messageUpdateFailed = { ...baseUpdate, data: { ...baseUpdate.data, status: 'FAILED' } }

export const allMessageUpdates = [
  messageUpdatePending,
  messageUpdateServerAck,
  messageUpdateDeliveryAck,
  messageUpdateRead,
  messageUpdateFailed,
]

// connection — each state
export const connectionConnected = {
  event: 'connection' as const,
  instance: INSTANCE,
  data: { state: 'connected', phoneNumber: '5511999999999' },
}

export const connectionConnecting = {
  event: 'connection' as const,
  instance: INSTANCE,
  data: { state: 'connecting' },
}

export const connectionDisconnected = {
  event: 'connection' as const,
  instance: INSTANCE,
  data: { state: 'disconnected', reason: 'manual disconnect' },
}

export const allConnectionStates = [connectionConnected, connectionConnecting, connectionDisconnected]
