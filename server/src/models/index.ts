import { Pool } from 'pg'
import Redis from 'ioredis'
import { config } from '../config/index.js'

// PostgreSQL connection pool
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err)
})

// Redis client
export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis connection error', err)
})

redis.on('connect', () => {
  console.log('Connected to Redis')
})

// Initialize database
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect()
  try {
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    
    // Create tables
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        wallet_address VARCHAR(44) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        username VARCHAR(50) UNIQUE,
        avatar_url TEXT,
        bio TEXT,
        reputation INTEGER DEFAULT 100,
        tier VARCHAR(20) DEFAULT 'bronze',
        skills TEXT[] DEFAULT '{}',
        tasks_completed BIGINT DEFAULT 0,
        tasks_failed BIGINT DEFAULT 0,
        total_earnings VARCHAR(50) DEFAULT '0',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        creator_wallet VARCHAR(44) NOT NULL,
        worker_wallet VARCHAR(44),
        title VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        required_skills TEXT[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'created',
        reward VARCHAR(50) NOT NULL,
        verification_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
        submission_time TIMESTAMP WITH TIME ZONE,
        verification_time TIMESTAMP WITH TIME ZONE,
        worker_reputation_at_assignment INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Bids table
      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
        bidder_wallet VARCHAR(44) NOT NULL,
        amount VARCHAR(50) NOT NULL,
        proposal TEXT NOT NULL,
        estimated_duration INTEGER DEFAULT 1,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Transactions table
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        signature VARCHAR(100) UNIQUE NOT NULL,
        from_address VARCHAR(44) NOT NULL,
        to_address VARCHAR(44) NOT NULL,
        amount VARCHAR(50) NOT NULL,
        type VARCHAR(30) NOT NULL,
        task_id UUID REFERENCES tasks(id),
        status VARCHAR(20) DEFAULT 'pending',
        block_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Nonce table for EIP-4361
      CREATE TABLE IF NOT EXISTS auth_nonces (
        wallet_address VARCHAR(44) PRIMARY KEY,
        nonce VARCHAR(32) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Refresh tokens table
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_tasks_worker ON tasks(worker_wallet);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_bids_task ON bids(task_id);
      CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids(bidder_wallet);
      CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);
      CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);
      CREATE INDEX IF NOT EXISTS idx_transactions_task ON transactions(task_id);
    `)

    console.log('Database initialized successfully')
  } finally {
    client.release()
  }
}

export async function closeConnections(): Promise<void> {
  await pool.end()
  await redis.quit()
}
