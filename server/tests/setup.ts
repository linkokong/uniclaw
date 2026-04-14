import { config } from '../src/config/index.js'
import { pool, redis, initializeDatabase, closeConnections } from '../src/models/index.js'
import { vi, beforeAll, beforeEach, afterAll } from 'vitest'

// 测试环境配置
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/claw_universe_test'
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only'

// 全局测试超时
vi.setConfig({ testTimeout: 30000 })

// 测试数据库连接配置
export const testDbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'claw_universe_test',
  user: 'postgres',
  password: 'postgres',
}

// 测试前初始化
beforeAll(async () => {
  try {
    // 初始化数据库连接和表结构
    await initializeDatabase()
    console.log('✅ Test database initialized')
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error)
    throw error
  }
})

// 每个测试前清理数据
beforeEach(async () => {
  try {
    // 清理测试数据（保持表结构）
    await pool.query(`
      TRUNCATE TABLE 
        refresh_tokens, 
        auth_nonces, 
        transactions, 
        bids, 
        tasks, 
        users 
      RESTART IDENTITY CASCADE
    `)
    
    // 清理 Redis 测试数据
    const keys = await redis.keys('test:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
    
    // 清理 session 数据
    const sessionKeys = await redis.keys('session:*')
    if (sessionKeys.length > 0) {
      await redis.del(...sessionKeys)
    }
  } catch (error) {
    console.error('❌ Failed to clean test data:', error)
    throw error
  }
})

// 所有测试完成后关闭连接
afterAll(async () => {
  try {
    await closeConnections()
    console.log('✅ Test connections closed')
  } catch (error) {
    console.error('❌ Failed to close test connections:', error)
    throw error
  }
})

// 测试辅助函数

/**
 * 创建测试用户
 */
export async function createTestUser(walletAddress: string, overrides: Partial<{
  email: string
  username: string
  reputation: number
  tier: string
}> = {}) {
  const result = await pool.query(
    `INSERT INTO users (wallet_address, email, username, reputation, tier, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [
      walletAddress,
      overrides.email || `${walletAddress.slice(0, 8)}@test.com`,
      overrides.username || `user_${walletAddress.slice(0, 8)}`,
      overrides.reputation || 100,
      overrides.tier || 'bronze'
    ]
  )
  return result.rows[0]
}

/**
 * 创建测试任务
 */
export async function createTestTask(creatorWallet: string, overrides: Partial<{
  title: string
  description: string
  reward: string
  status: string
}> = {}) {
  const result = await pool.query(
    `INSERT INTO tasks (creator_wallet, title, description, reward, status, verification_deadline, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days', NOW(), NOW())
     RETURNING *`,
    [
      creatorWallet,
      overrides.title || 'Test Task',
      overrides.description || 'This is a test task',
      overrides.reward || '1000000000',
      overrides.status || 'created'
    ]
  )
  return result.rows[0]
}

/**
 * 创建测试 nonce
 */
export async function createTestNonce(walletAddress: string, nonce: string, expiresInMinutes: number = 5) {
  await pool.query(
    `INSERT INTO auth_nonces (wallet_address, nonce, expires_at, created_at)
     VALUES ($1, $2, NOW() + INTERVAL '${expiresInMinutes} minutes', NOW())
     ON CONFLICT (wallet_address) DO UPDATE SET
       nonce = EXCLUDED.nonce,
       expires_at = EXCLUDED.expires_at,
       created_at = EXCLUDED.created_at`,
    [walletAddress, nonce]
  )
  return { walletAddress, nonce }
}

/**
 * 生成有效的 Solana 钱包地址格式
 */
export function generateTestWalletAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let result = ''
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 模拟钱包签名
 */
export function mockWalletSignature(walletAddress: string, message: string): string {
  // 模拟签名格式：base64 编码的字符串
  const signatureData = `${walletAddress}:${message}:${Date.now()}`
  return Buffer.from(signatureData).toString('base64')
}

// 导出供测试使用
export { pool, redis, config }
