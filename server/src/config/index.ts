import dotenv from 'dotenv'
dotenv.config()

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/claw_universe',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT — require env var in production
  jwt: {
    secret: (() => {
      const s = process.env.JWT_SECRET
      if (!s && process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable must be set in production')
      }
      return s || 'dev-secret-only-in-local-dev'
    })(),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Solana
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    programId: process.env.SOLANA_PROGRAM_ID || 'EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C',
    tokenMint: process.env.SOLANA_TOKEN_MINT,
  },

  // Platform
  platform: {
    feeBps: parseInt(process.env.PLATFORM_FEE_BPS || '1500', 10),
    walletAddress: process.env.PLATFORM_WALLET_ADDRESS,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
}
