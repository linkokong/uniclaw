/**
 * API Key Authentication Middleware
 * Sprint 2 W2: Identity Layer + API Key + RBAC
 * 
 * Supports three authentication modes:
 * 1. JWT (wallet signature) - for browser users
 * 2. API Key - for external agents/scripts
 * 3. Agent Certificate - for deep SDK integration (Phase 2)
 */

import { Request, Response, NextFunction } from 'express'
import { pool, redis } from '../models/index.js'
import bcrypt from 'bcryptjs'

// 13-Scope RBAC definitions
export const SCOPES = {
  // Read-only
  'read:profile': 'Read own profile',
  'read:tasks': 'View available tasks',
  'read:agents': 'Browse agents',
  'read:wallet': 'View wallet balance',
  
  // Task operations
  'write:tasks': 'Create and manage own tasks',
  'bid:tasks': 'Bid on tasks',
  'accept:tasks': 'Accept task assignments',
  'submit:tasks': 'Submit task results',
  
  // Agent operations
  'register:agent': 'Register new agent',
  'manage:agent': 'Update own agent profile',
  
  // Financial
  'withdraw:funds': 'Withdraw escrow funds',
  
  // Admin
  'admin:all': 'Full admin access',
} as const

export type Scope = keyof typeof SCOPES

export interface ApiKeyInfo {
  id: string
  userId: string
  walletAddress: string
  keyPrefix: string
  name: string
  scopes: Scope[]
  active: boolean
}

export interface AuthRequest extends Request {
  user?: {
    walletAddress: string
    userId?: string
    scopes?: Scope[]
    authType: 'jwt' | 'api_key' | 'agent_cert'
  }
  session?: any
  apiKey?: ApiKeyInfo
}

// Scope hierarchy: admin:all includes all other scopes
const SCOPE_HIERARCHY: Record<Scope, Scope[]> = {
  'admin:all': Object.keys(SCOPES).filter(s => s !== 'admin:all') as Scope[],
  'read:profile': ['read:profile'],
  'read:tasks': ['read:tasks'],
  'read:agents': ['read:agents'],
  'read:wallet': ['read:wallet'],
  'write:tasks': ['write:tasks'],
  'bid:tasks': ['bid:tasks'],
  'accept:tasks': ['accept:tasks'],
  'submit:tasks': ['submit:tasks'],
  'register:agent': ['register:agent'],
  'manage:agent': ['manage:agent'],
  'withdraw:funds': ['withdraw:funds'],
}

/**
 * API Key Authentication Middleware
 * Validates uniclaw_sk_<random> keys and loads scopes
 */
export async function authenticateApiKey(
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer uniclaw_sk_')) {
      // Not an API key, skip to next auth method
      next()
      return
    }
    
    const providedKey = authHeader.substring(7) // Remove 'Bearer '
    const keyPrefix = providedKey.substring(0, 12) // uniclaw_sk_xxx
    
    // Check rate limit (100 req/min per key)
    const rateKey = `ratelimit:${keyPrefix}`
    const currentCount = await redis.incr(rateKey)
    
    if (currentCount === 1) {
      await redis.expire(rateKey, 60) // 1 minute window
    }
    
    if (currentCount > 100) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Max 100/min.' }
      })
      return
    }
    
    // Look up key by prefix
    const result = await pool.query(
      `SELECT id, user_id, wallet_address, key_hash, key_prefix, name, scopes, active, expires_at
       FROM api_keys 
       WHERE key_prefix = $1 AND active = true`,
      [keyPrefix]
    )
    
    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'API key not found or inactive' }
      })
      return
    }
    
    const keyRow = result.rows[0]
    
    // Check expiration
    if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
      res.status(401).json({
        success: false,
        error: { code: 'API_KEY_EXPIRED', message: 'API key has expired' }
      })
      return
    }
    
    // Verify key hash
    const isValid = await bcrypt.compare(providedKey, keyRow.key_hash)
    
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid API key' }
      })
      return
    }
    
    // Update last_used_at (async, don't wait)
    pool.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [keyRow.id]
    ).catch(err => console.error('[api_key] Failed to update last_used_at:', err))
    
    // Attach to request
    req.user = {
      walletAddress: keyRow.wallet_address,
      userId: keyRow.user_id,
      scopes: keyRow.scopes || [],
      authType: 'api_key'
    }
    req.apiKey = {
      id: keyRow.id,
      userId: keyRow.user_id,
      walletAddress: keyRow.wallet_address,
      keyPrefix: keyRow.key_prefix,
      name: keyRow.name,
      scopes: keyRow.scopes || [],
      active: keyRow.active
    }
    
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Unified authentication middleware
 * Tries API Key first, then JWT
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No authentication provided' }
    })
    return
  }
  
  const token = authHeader.substring(7)
  
  // Check if it's an API key
  if (token.startsWith('uniclaw_sk_')) {
    // Use API key auth
    await authenticateApiKey(req, res, next)
    return
  }
  
  // Otherwise, use JWT auth
  const { jwtVerify } = await import('jose')
  const { config } = await import('../config/index.js')
  const JWT_SECRET = new TextEncoder().encode(config.jwt.secret)
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    req.user = {
      walletAddress: payload.walletAddress as string,
      userId: payload.userId as string | undefined,
      authType: 'jwt'
    }
    next()
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' }
    })
  }
}

/**
 * Require specific scope(s)
 * Usage: router.post('/tasks', requireScope('write:tasks'), handler)
 */
export function requireScope(...requiredScopes: Scope[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
      return
    }
    
    const userScopes = req.user.scopes || []
    
    // Check if user has admin:all (includes all scopes)
    if (userScopes.includes('admin:all')) {
      next()
      return
    }
    
    // Check if user has any of the required scopes
    const hasScope = requiredScopes.some(scope => {
      const effectiveScopes = SCOPE_HIERARCHY[scope] || [scope]
      return effectiveScopes.some(s => userScopes.includes(s))
    })
    
    if (!hasScope) {
      res.status(403).json({
        success: false,
        error: { 
          code: 'INSUFFICIENT_SCOPE', 
          message: `Required scope: ${requiredScopes.join(' or ')}`,
          required: requiredScopes,
          provided: userScopes
        }
      })
      return
    }
    
    next()
  }
}

/**
 * Require ownership of a resource
 * Usage: router.put('/agents/:id', requireOwnership('agent'), handler)
 */
export function requireOwnership(resourceType: 'agent' | 'task' | 'bid') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.walletAddress) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
      return
    }
    
    const resourceId = req.params.id
    const walletAddress = req.user.walletAddress
    
    let query: string
    let values: any[]
    
    switch (resourceType) {
      case 'agent':
        query = 'SELECT owner_wallet FROM agents WHERE id = $1'
        values = [resourceId]
        break
      case 'task':
        query = 'SELECT creator_wallet FROM tasks WHERE id = $1'
        values = [resourceId]
        break
      case 'bid':
        query = 'SELECT bidder_wallet FROM bids WHERE id = $1'
        values = [resourceId]
        break
      default:
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_RESOURCE', message: 'Unknown resource type' }
        })
        return
    }
    
    try {
      const result = await pool.query(query, values)
      
      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `${resourceType} not found` }
        })
        return
      }
      
      const ownerField = resourceType === 'task' ? 'creator_wallet' : 
                         resourceType === 'bid' ? 'bidder_wallet' : 'owner_wallet'
      const owner = result.rows[0][ownerField]
      
      if (owner !== walletAddress) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `${resourceType} not found` }
        })
        return
      }
      
      next()
    } catch (error) {
      next(error)
    }
  }
}
