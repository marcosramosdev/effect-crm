To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

## WhatsApp connection flow (`/app/connect`)

1. Criar instância (nome default = nome do tenant)
2. Conectar e gerar QR
3. Escanear QR no WhatsApp Business
4. Acompanhar status até `Connected`

### Webhook público em desenvolvimento (ngrok)

Para receber eventos da UAZAPI localmente, exponha o backend e configure `PUBLIC_WEBHOOK_BASE_URL`:

```sh
ngrok http 3000
```

Depois use a URL HTTPS gerada (ex.: `https://xxxx.ngrok-free.app`) em:

```env
PUBLIC_WEBHOOK_BASE_URL=https://xxxx.ngrok-free.app
```
