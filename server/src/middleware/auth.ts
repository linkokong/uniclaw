import { Request, Response, NextFunction } from 'express'
import { jwtVerify, SignJWT } from 'jose'
import { redis, pool } from '../models/index.js'
import { config } from '../config/index.js'
import { SessionData } from '../types/index.js'
import { PublicKey } from '@solana/web3.js'
import { randomUUID } from 'node:crypto'

const JWT_SECRET = new TextEncoder().encode(config.jwt.secret)

export interface AuthRequest extends Request {
  user?: {
    walletAddress: string
    userId?: string
    scopes?: string[]
    authType?: 'jwt' | 'api_key' | 'agent_cert'
  }
  session?: SessionData
}

// Generate JWT access token
export async function generateAccessToken(walletAddress: string, userId?: string): Promise<string> {
  return new SignJWT({ walletAddress, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.jwt.accessExpiresIn)
    .sign(JWT_SECRET)
}

// Generate refresh token
export async function generateRefreshToken(): Promise<string> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// JWT Authentication middleware
export async function authenticateJWT(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'No token provided' }
      })
      return
    }

    const token = authHeader.substring(7)

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
  } catch (error) {
    next(error)
  }
}

// Session-based authentication (stored in Redis)
export async function authenticateSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.headers['x-session-id'] as string
    const walletSignature = req.headers['x-wallet-signature'] as string

    if (!sessionId && !walletSignature) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session ID or wallet signature required' }
      })
      return
    }

    if (sessionId) {
      const sessionData = await redis.get(`session:${sessionId}`)
      if (!sessionData) {
        res.status(401).json({
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'Session has expired' }
        })
        return
      }

      const session = JSON.parse(sessionData)
      req.session = session
      req.user = {
        walletAddress: session.walletAddress,
        userId: session.userId
      }
    }

    next()
  } catch (error) {
    next(error)
  }
}

// --- Solana EIP-4361 wallet signature verification ---

export async function verifySiweMessage(
  message: { address: string; nonce: string; signMessage?: string },
  signature: string
): Promise<boolean> {
  try {
    // SECURITY FIX (C#3): Nonce 从 PostgreSQL 迁移到 Redis，带 5 分钟 TTL
    // 1. Verify nonce exists in Redis (auto-expires via TTL)
    // Try wallet-bound nonce first, then anonymous nonce
    let nonceKey = `nonce:${message.address}:${message.nonce}`
    let storedNonce = await redis.get(nonceKey)
    if (!storedNonce) {
      // Fallback: check if it was stored as anonymous nonce
      nonceKey = `nonce:anonymous:${message.nonce}`
      storedNonce = await redis.get(nonceKey)
    }

    if (!storedNonce) {
      console.error('[verify] Nonce not found or expired in Redis:', message.nonce, 'for', message.address)
      return false
    }

    // 2. Decode signature (base64 from Phantom, hex as fallback)
    let signatureBytes: Uint8Array
    try {
      signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'))
      if (signatureBytes.length !== 64) throw new Error('base64 sig not 64 bytes')
    } catch {
      try {
        signatureBytes = Uint8Array.from(Buffer.from(signature, 'hex'))
        if (signatureBytes.length !== 64) throw new Error('hex sig not 64 bytes')
      } catch {
        console.error('[verify] Failed to decode signature (not base64 or hex):', signature.substring(0, 20))
        return false
      }
    }

    // 3. Use signMessage from body (JSON, preserves newlines)
    // Note: message.signMessage is the exact string Phantom signed over
    const reconstructedMessage = message.signMessage
    const messageBytes = new TextEncoder().encode(reconstructedMessage)
    const publicKeyBytes = new Uint8Array(new PublicKey(message.address).toBytes())

    console.log('[verify] sig len:', signatureBytes.length, '| msg len:', messageBytes.length, '| pk len:', publicKeyBytes.length)
    console.log('[verify] signMessage bytes:', Buffer.from(messageBytes).toString('hex').substring(0, 80))
    console.log('[verify] signMessage (str):', JSON.stringify(reconstructedMessage))
    console.log('[verify] pk hex:', Buffer.from(publicKeyBytes).toString('hex'))

    // 4. Ed25519 verify using @noble/ed25519 with dynamic ESM import
    // This ensures proper WASM initialization in the ESM context used by tsx
    const { verifyAsync } = await import('@noble/ed25519')
    const isValid = await verifyAsync(signatureBytes, messageBytes, publicKeyBytes)

    console.log('[verify] noble result:', isValid)

    // 5. Delete nonce after verification attempt (atomic, prevents replay)
    await redis.del(nonceKey)

    return isValid
  } catch (error) {
    console.error('[verify] Unexpected error:', error)
    return false
  }
}

// Optional authentication (doesn't fail if no token)
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next()
    return
  }

  authenticateJWT(req, res, next)
}

// Generate nonce for wallet authentication
export async function generateNonce(walletAddress?: string): Promise<string> {
  const nonce = randomUUID().replace(/-/g, '').substring(0, 16)
  // Store with wallet address if provided, otherwise anonymous
  // verifySiweMessage looks up by nonce:${address}:${nonce}
  const nonceKey = walletAddress ? `nonce:${walletAddress}:${nonce}` : `nonce:anonymous:${nonce}`
  await redis.set(nonceKey, nonce, 'EX', 300) // 5 minutes TTL
  return nonce
}
