import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import handoverRoutes from './routes/handover.routes.js'
import { requestContext, accessLog } from './middleware/requestContext.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp(): express.Application {
  const app = express()

  app.use(helmet())
  app.use(cors())
  app.use(express.json({ limit: '2mb' }))
  app.use(requestContext)
  app.use(accessLog)

  app.use(handoverRoutes)

  app.use(errorHandler)

  return app
}
