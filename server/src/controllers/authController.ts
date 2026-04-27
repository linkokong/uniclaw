import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { asyncHandler } from '../middleware/error.js'
import { verifySiweMessage, generateAccessToken } from '../middleware/auth.js'
import { userService } from '../services/user.js'
import { pool, redis } from '../models/index.js'
import type { AuthRequest } from '../middleware/auth.js'
import { verifyMessageSignature } from '../utils/solana.js'

// POST /auth/wallet - 钱包签名登录，换取 JWT
export const walletLogin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const walletAddress = req.headers['x-wallet-address'] as string
  const signature = req.headers['x-signature'] as string
  // signMessage comes from body (JSON), not headers, to preserve newlines
  const body = req.body as { signMessage?: string }
  const signMessage = body?.signMessage

  console.log('[walletLogin] headers:')
  console.log('  wallet:', walletAddress)
  console.log('  signature:', signature?.substring(0, 20), '... (len:', signature?.length, ')')
  console.log('  signMessage (from body):', signMessage ? JSON.stringify(signMessage) : 'MISSING')

  if (!walletAddress || !signature) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing wallet address or signature' }
    })
  }

  if (!signMessage) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing signMessage in request body' }
    })
  }

  // 从 signMessage 中提取 nonce（格式: "... Nonce: xxxxxx"）
  let nonce: string | undefined
  const match = signMessage.match(/Nonce:\s*(\S+)/)
  nonce = match?.[1]

  console.log('[walletLogin] extracted nonce:', nonce)

  if (!nonce) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Could not extract nonce from sign message' }
    })
  }

  // 验证签名
  const isValid = await verifySiweMessage(
    { address: walletAddress, nonce, signMessage },
    signature
  )

  console.log('[walletLogin] verify result:', isValid)

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' }
    })
  }

  // 获取或创建用户
  const user = await userService.upsertFromWallet(walletAddress)

  // 生成 JWT
  const token = await generateAccessToken(walletAddress, String(user.id))

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        wallet_address: user.wallet_address,
        username: user.username,
        reputation: user.reputation,
        tier: user.tier
      }
    }
  })
})

// POST /auth/verify - MCP Server 专用认证端点
// 接受 JSON body: { message, signature, publicKey }
export const walletVerify = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { message, signature, publicKey } = req.body

  console.log('[walletVerify] request:')
  console.log('  publicKey:', publicKey)
  console.log('  message:', message?.substring(0, 50), '...')
  console.log('  signature:', signature?.substring(0, 20), '...')

  if (!message || !signature || !publicKey) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing message, signature, or publicKey' }
    })
  }

  // 验证签名
  const isValid = await verifyMessageSignature(publicKey, message, signature)

  console.log('[walletVerify] verify result:', isValid)

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' }
    })
  }

  // 获取或创建用户
  const user = await userService.upsertFromWallet(publicKey)

  // 生成 JWT
  const token = await generateAccessToken(publicKey, String(user.id))

  res.json({
    success: true,
    data: {
      token,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      user: {
        id: user.id,
        wallet_address: user.wallet_address,
        username: user.username,
        reputation: user.reputation,
        tier: user.tier
      }
    }
  })
})

// POST /auth/verify-api-key - MCP Server 专用：验证 API Key 并返回 scopes
// 接受 body: { apiKey: "uniclaw_sk_xxx" }
export const verifyApiKey = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { apiKey } = req.body as { apiKey?: string }

  if (!apiKey || !apiKey.startsWith('uniclaw_sk_')) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid API key format' }
    })
  }

  const keyPrefix = apiKey.substring(0, 12)

  // Rate limit check (100 req/min per key)
  const rateKey = `ratelimit:${keyPrefix}`
  const currentCount = await redis.incr(rateKey)
  if (currentCount === 1) {
    await redis.expire(rateKey, 60)
  }
  if (currentCount > 100) {
    return res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Max 100/min.' }
    })
  }

  // Look up key by prefix
  const result = await pool.query(
    `SELECT id, user_id, wallet_address, key_hash, scopes, active, expires_at
     FROM api_keys 
     WHERE key_prefix = $1 AND active = true`,
    [keyPrefix]
  )

  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'API key not found or inactive' }
    })
  }

  const keyRow = result.rows[0]

  // Check expiration
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return res.status(401).json({
      success: false,
      error: { code: 'API_KEY_EXPIRED', message: 'API key has expired' }
    })
  }

  // Verify key hash
  const isValid = await bcrypt.compare(apiKey, keyRow.key_hash)

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid API key' }
    })
  }

  // Update last_used_at (async)
  pool.query(
    'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
    [keyRow.id]
  ).catch(err => console.error('[verifyApiKey] Failed to update last_used_at:', err))

  res.json({
    success: true,
    valid: true,
    scopes: keyRow.scopes || [],
    keyId: keyRow.id
  })
})
