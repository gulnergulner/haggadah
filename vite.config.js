import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [{
    name: 'local-leaderboard-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      for (const key of ['DATABASE_URL', 'SESSION_SECRET']) {
        if (!process.env[key] && env[key]) process.env[key] = env[key]
      }
      server.middlewares.use('/api/leaderboard', async (req, res) => {
        const { default: handler } = await import('./api/leaderboard.js')
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(data))
        }
        await handler(req, res)
      })
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
