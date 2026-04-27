/**
 * API Key Service
 * Sprint 2 W2: Identity Layer + API Key + RBAC
 * 
 * CRUD operations for API keys with secure key generation
 */

import { randomUUID } from 'node:crypto'
import { pool } from '../models/index.js'
import bcrypt from 'bcryptjs'
import type { Scope } from '../middleware/apiKeyAuth.js'

export interface CreateApiKeyOptions {
  userId: string
  walletAddress: string
  name: string
  scopes: Scope[]
  expiresInDays?: number // Optional expiration
}

export interface ApiKey {
  id: string
  userId: string
  walletAddress: string
  keyPrefix: string
  name: string
  scopes: Scope[]
  active: boolean
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export class ApiKeyService {
  /**
   * Generate a new API key
   * Format: uniclaw_sk_<32 random chars>
   */
  async createKey(options: CreateApiKeyOptions): Promise<{ key: string; info: ApiKey }> {
    // Generate random key
    const randomBytes = new Uint8Array(24)
    crypto.getRandomValues(randomBytes)
    const randomPart = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 32)
    
    const key = `uniclaw_sk_${randomPart}`
    const keyPrefix = key.substring(0, 12) // uniclaw_sk_xxx
    
    // Hash the key for storage
    const keyHash = await bcrypt.hash(key, 10)
    
    // Calculate expiration
    let expiresAt: Date | null = null
    if (options.expiresInDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + options.expiresInDays)
    }
    
    // Insert into database
    const result = await pool.query(
      `INSERT INTO api_keys (user_id, wallet_address, key_hash, key_prefix, name, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, wallet_address, key_prefix, name, scopes, active, last_used_at, expires_at, created_at`,
      [
        options.userId,
        options.walletAddress,
        keyHash,
        keyPrefix,
        options.name,
        options.scopes,
        expiresAt
      ]
    )
    
    const row = result.rows[0]
    
    return {
      key, // Return plain key ONCE (never stored)
      info: this.mapRowToApiKey(row)
    }
  }
  
  /**
   * List all API keys for a user
   */
  async listByUser(userId: string): Promise<ApiKey[]> {
    const result = await pool.query(
      `SELECT id, user_id, wallet_address, key_prefix, name, scopes, active, last_used_at, expires_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    )
    
    return result.rows.map(row => this.mapRowToApiKey(row))
  }
  
  /**
   * Get a specific API key by ID
   */
  async getById(id: string, userId: string): Promise<ApiKey | null> {
    const result = await pool.query(
      `SELECT id, user_id, wallet_address, key_prefix, name, scopes, active, last_used_at, expires_at, created_at
       FROM api_keys
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    return this.mapRowToApiKey(result.rows[0])
  }
  
  /**
   * Update API key scopes
   */
  async updateScopes(id: string, userId: string, scopes: Scope[]): Promise<ApiKey | null> {
    const result = await pool.query(
      `UPDATE api_keys
       SET scopes = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, wallet_address, key_prefix, name, scopes, active, last_used_at, expires_at, created_at`,
      [id, userId, scopes]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    return this.mapRowToApiKey(result.rows[0])
  }
  
  /**
   * Deactivate an API key
   */
  async deactivate(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE api_keys
       SET active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )
    
    return (result.rowCount ?? 0) > 0
  }
  
  /**
   * Delete an API key permanently
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
      [id, userId]
    )
    
    return (result.rowCount ?? 0) > 0
  }
  
  private mapRowToApiKey(row: any): ApiKey {
    return {
      id: row.id,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      keyPrefix: row.key_prefix,
      name: row.name,
      scopes: row.scopes || [],
      active: row.active,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    }
  }
}

export const apiKeyService = new ApiKeyService()
