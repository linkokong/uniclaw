import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { config } from './config/index.js'
import { initializeDatabase, closeConnections } from './models/index.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { apiLimiter, authLimiter } from './middleware/rateLimit.js'

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

// Rate limiting for auth endpoints
app.use(`${config.apiPrefix}/auth`, authLimiter)

// General API rate limiting
app.use(config.apiPrefix, apiLimiter)

// API routes
app.use(config.apiPrefix, routes)

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...')
  await closeConnections()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Start server
async function main() {
  try {
    // Initialize database
    await initializeDatabase()
    
    app.listen(config.port, () => {
      console.log(`🚀 Claw Universe API running on port ${config.port}`)
      console.log(`📍 API prefix: ${config.apiPrefix}`)
      console.log(`🌍 Environment: ${config.nodeEnv}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

main()
