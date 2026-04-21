import { randomUUID } from 'node:crypto'
import { pool, redis } from '../models/index.js'
import { NotFoundError, ConflictError } from '../middleware/error.js'
import type { User, AgentTier } from '../types/index.js'
import bcrypt from 'bcryptjs'

const SESSION_TTL = 7 * 24 * 60 * 60 // 7 days

export class UserService {
  // Create or update user from wallet
  async upsertFromWallet(walletAddress: string): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (wallet_address, reputation, tier)
       VALUES ($1, 100, 'bronze')
       ON CONFLICT (wallet_address) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [walletAddress]
    )
    return this.mapUser(result.rows[0])
  }

  // Get user by wallet address
  async getByWallet(walletAddress: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress]
    )
    if (result.rows.length === 0) {
      return null
    }
    return this.mapUser(result.rows[0])
  }

  // Get user by ID
  async getById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) {
      return null
    }
    return this.mapUser(result.rows[0])
  }

  // Update user profile
  async updateProfile(
    walletAddress: string,
    data: {
      username?: string
      email?: string
      avatar_url?: string
      bio?: string
      skills?: string[]
    }
  ): Promise<User> {
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (data.username !== undefined) {
      updates.push(`username = $${paramIndex++}`)
      values.push(data.username)
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      values.push(data.email)
    }
    if (data.avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`)
      values.push(data.avatar_url)
    }
    if (data.bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`)
      values.push(data.bio)
    }
    if (data.skills !== undefined) {
      updates.push(`skills = $${paramIndex++}`)
      values.push(data.skills)
    }

    updates.push('updated_at = NOW()')
    values.push(walletAddress)

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE wallet_address = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      throw new NotFoundError('User')
    }

    return this.mapUser(result.rows[0])
  }

  // Update reputation and tier
  async updateReputation(walletAddress: string, change: number): Promise<User> {
    const result = await pool.query(
      `UPDATE users SET
         reputation = GREATEST(0, LEAST(1000, reputation + $2)),
         tier = CASE
           WHEN reputation + $2 <= 200 THEN 'bronze'
           WHEN reputation + $2 <= 500 THEN 'silver'
           WHEN reputation + $2 <= 800 THEN 'gold'
           ELSE 'platinum'
         END,
         updated_at = NOW()
       WHERE wallet_address = $1
       RETURNING *`,
      [walletAddress, change]
    )

    return this.mapUser(result.rows[0])
  }

  // Get leaderboard
  async getLeaderboard(limit = 20): Promise<User[]> {
    const result = await pool.query(
      `SELECT * FROM users
       ORDER BY reputation DESC, tasks_completed DESC
       LIMIT $1`,
      [limit]
    )
    return result.rows.map(row => this.mapUser(row))
  }

  // Create session
  async createSession(
    userId: string,
    walletAddress: string,
    refreshTokenId: string
  ): Promise<string> {
    const sessionId = randomUUID()
    const ttl = SESSION_TTL

    await redis.setex(
      `session:${sessionId}`,
      ttl,
      JSON.stringify({
        userId,
        walletAddress,
        refreshTokenId,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl * 1000
      })
    )

    return sessionId
  }

  // Revoke session
  async revokeSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`)
  }

  // Generate nonce for EIP-4361
  async generateNonce(walletAddress: string): Promise<string> {
    const nonce = randomUUID().replace(/-/g, '').substring(0, 16)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    await pool.query(
      `INSERT INTO auth_nonces (wallet_address, nonce, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address) DO UPDATE
       SET nonce = $2, expires_at = $3`,
      [walletAddress, nonce, expiresAt]
    )

    return nonce
  }

  // Verify and consume nonce
  async verifyNonce(walletAddress: string, nonce: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM auth_nonces
       WHERE wallet_address = $1 AND nonce = $2 AND expires_at > NOW()
       RETURNING id`,
      [walletAddress, nonce]
    )
    return result.rows.length > 0
  }

  private mapUser(row: any): User {
    return {
      id: row.id,
      wallet_address: row.wallet_address,
      email: row.email,
      username: row.username,
      avatar_url: row.avatar_url,
      bio: row.bio,
      reputation: row.reputation,
      tier: row.tier as AgentTier,
      skills: row.skills || [],
      tasks_completed: parseInt(row.tasks_completed),
      tasks_failed: parseInt(row.tasks_failed),
      total_earnings: row.total_earnings,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }
}

export const userService = new UserService()
