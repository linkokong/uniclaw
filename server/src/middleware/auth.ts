import { Request, Response, NextFunction } from 'express'
import { jwtVerify, SignJWT } from 'jose'
import { redis, pool } from '../models/index.js'
import { config } from '../config/index.js'
import { SessionData } from '../types/index.js'

const JWT_SECRET = new TextEncoder().encode(config.jwt.secret)

export interface AuthRequest extends Request {
  user?: {
    walletAddress: string
    userId?: string
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
        userId: payload.userId as string | undefined
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
      // Check Redis for session
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

// Solana wallet signature verification (EIP-4361 style)
// FIX: removed broken TextEncoder().encode() interpolation
import { PublicKey } from '@solana/web3.js'
import { verify } from '@noble/ed25519'

export async function verifySiweMessage(
  message: { address: string; nonce: string; signMessage?: string },
  signature: string
): Promise<boolean> {
  try {
    // Verify nonce exists and is not expired
    const nonceData = await pool.query(
      'SELECT expires_at FROM auth_nonces WHERE wallet_address = $1 AND nonce = $2',
      [message.address, message.nonce]
    )

    if (nonceData.rows.length === 0) return false
    const expiresAt = new Date(nonceData.rows[0].expires_at)
    if (expiresAt < new Date()) return false

    // Decode signature (base64 or hex)
    let signatureBytes: Uint8Array
    try {
      signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
    } catch {
      signatureBytes = Uint8Array.from(Buffer.from(signature, 'hex'))
    }

    // Use signMessage if provided (from frontend), otherwise reconstruct from nonce
    let signMessage: string
    if (message.signMessage) {
      signMessage = message.signMessage
    } else {
      // Fallback: reconstruct generic sign message (frontend uses window.location.host)
      signMessage = `localhost wants you to sign in with your Solana account.\n\nSign this message to authenticate with Claw Universe.\n\nNonce: ${message.nonce}`
    }
    const messageBytes = new TextEncoder().encode(signMessage)
    const publicKeyBytes = new PublicKey(message.address).toBytes()

    // Real Ed25519 signature verification
    const isValid = await verify(signatureBytes, messageBytes, publicKeyBytes)

    // Delete nonce after successful verification
    if (isValid) {
      await pool.query(
        'DELETE FROM auth_nonces WHERE wallet_address = $1 AND nonce = $2',
        [message.address, message.nonce]
      )
    }
    return isValid
  } catch (error) {
    console.error('Signature verification error:', error)
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
