import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createApp } from './app.js'
import { rootLogger } from './lib/logger.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(__dirname, '../../..')

dotenv.config({ path: path.join(monorepoRoot, '.env') })

const port = Number(process.env['PORT'] ?? 3001)
const app = createApp()

const server = app.listen(port, () => {
  rootLogger.info('server.started', {
    event: 'server.started',
    port,
    env: process.env['NODE_ENV'] ?? 'development',
  })
})

function shutdown(signal: string): void {
  rootLogger.info('server.shutdown', { event: 'server.shutdown', signal })
  server.close(() => {
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
