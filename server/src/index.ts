import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import path from 'path'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { config } from './config/index.js'
import { initializeDatabase, closeConnections } from './models/index.js'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { apiLimiter, authLimiter } from './middleware/rateLimit.js'

const app = express()

// Security middleware — relaxed in dev for Vite proxy + Solana RPC
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://api.devnet.solana.com",
        "https://api.mainnet-beta.solana.com",
        "wss://api.devnet.solana.com",
        "wss://api.mainnet-beta.solana.com",
        "https://explorer-api.walletconnect.com",
        "https://relay.walletconnect.com",
        "https://phantom.app",
      ],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    }
  } : false,  // Disable CSP in dev (Vite injects inline scripts)
  crossOriginEmbedderPolicy: false,
}))
app.use(compression())

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rate limiting
app.use(`${config.apiPrefix}/auth`, authLimiter)
app.use(config.apiPrefix, apiLimiter)

// API routes
app.use(config.apiPrefix, routes)

// ── Frontend serving ─────────────────────────────────────────────────────
if (config.nodeEnv === 'production') {
  // Production: serve built static files from dist/
  const distPath = path.resolve(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get('*', (_, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  // Development: reverse proxy to Vite dev server (port 5173)
  // This allows tunnel (cloudflare/ngrok) on port 3001 with full HMR support
  const VITE_PORT = process.env.VITE_PORT || '5173'
  const viteProxy = createProxyMiddleware({
    target: `http://localhost:${VITE_PORT}`,
    changeOrigin: true,
    ws: true,  // Proxy WebSocket for Vite HMR
    logLevel: 'warn',
  })
  app.use(viteProxy)
}

// Error handling (only reached if no proxy/static match)
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

// Start
async function main() {
  try {
    await initializeDatabase()
    app.listen(config.port, () => {
      console.log(`🚀 Claw Universe API running on port ${config.port}`)
      console.log(`📍 API prefix: ${config.apiPrefix}`)
      console.log(`🌍 Environment: ${config.nodeEnv}`)
      if (config.nodeEnv !== 'production') {
        console.log(`🔀 Dev proxy: non-API requests → http://localhost:${process.env.VITE_PORT || '5173'} (Vite HMR)`)
      }
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

main()
