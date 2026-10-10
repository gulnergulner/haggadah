import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [{
    name: 'local-server-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'TELEGRAM_WEBHOOK_SECRET',
        'TELEGRAM_ADMIN_IDS', 'HAGGADAH_SUPABASE_URL', 'HAGGADAH_SUPABASE_SERVICE_ROLE_KEY']) {
        if (!process.env[key] && env[key]) process.env[key] = env[key]
      }
      for (const [route, load] of [
        ['/api/leaderboard', () => import('./api/leaderboard.js')],
        ['/api/telegram-webhook', () => import('./api/telegram-webhook.js')],
      ]) {
        server.middlewares.use(route, async (req, res) => {
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(data))
          }
          if (req.method === 'POST') {
            try {
              const chunks = []
              for await (const chunk of req) chunks.push(chunk)
              req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            } catch {
              return res.status(400).json({ error: 'invalid JSON' })
            }
          }
          try {
            const { default: handler } = await load()
            await handler(req, res)
          } catch {
            res.status(500).json({ error: 'local API failed' })
          }
        })
      }
    },
  }],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
})
