import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { config } from './config/index.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

/**
 * Express app factory for testing
 * Creates an Express app without starting the server
 */
export function createApp() {
  const app = express()

  // Security middleware
  app.use(helmet())
  app.use(compression())

  // CORS
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true
  }))

  // Body parsing
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // API routes
  app.use(config.apiPrefix, routes)

  // Error handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export default createApp()
