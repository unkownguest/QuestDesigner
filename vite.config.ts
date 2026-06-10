import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'questdesigner-ai-endpoint',
      configureServer(server) {
        server.middlewares.use('/api/generate-quest', async (req, res, next) => {
          if (req.method !== 'POST' && req.method !== 'OPTIONS') {
            return next()
          }

          const chunks: Buffer[] = []
          req.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
          })

          req.on('end', async () => {
            try {
              const raw = Buffer.concat(chunks).toString('utf8')
              if (raw) {
                try {
                  ;(req as import('http').IncomingMessage & { body?: unknown }).body = JSON.parse(raw)
                } catch {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Invalid JSON body.' }))
                  return
                }
              }

              const handler = (await import('./api/generate-quest.js')).default
              await handler(req as any, {
                setHeader: (...args: [string, string][]) => {
                  res.setHeader(...args)
                },
                status(code: number) {
                  res.statusCode = code
                  return this
                },
                json(payload: unknown) {
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(payload))
                },
                end() {
                  res.end()
                },
              })
            } catch {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'AI endpoint handler failed to execute.' }))
            }
          })
        })
      },
    },
  ],
})
