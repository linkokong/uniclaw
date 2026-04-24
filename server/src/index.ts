import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import path from 'path'
import { config } from './config/index.js'
import { initializeDatabase, closeConnections } from './models/index.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { apiLimiter, authLimiter } from './middleware/rateLimit.js'

const app = express()

// Security middleware - configure helmet to allow Solana RPC connections
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://api.devnet.solana.com",
        "https://api.mainnet-beta.solana.com",
        "https://solana-api.projectserum.com",
        "wss://api.devnet.solana.com",
        "wss://api.mainnet-beta.solana.com",
        "https://explorer-api.walletconnect.com",
        "https://relay.walletconnect.com",
        "https://phantom.app"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}))
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

// Serve built frontend (production only)
const distPath = path.resolve(__dirname, '../../dist')
if (config.nodeEnv === 'production') {
  app.use(express.static(distPath))
  app.get('*', (_, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

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
