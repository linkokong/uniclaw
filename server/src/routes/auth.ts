import { Router } from 'express'
import { walletLogin, walletVerify, verifyApiKey } from '../controllers/authController.js'
import { generateNonce } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'

const router = Router()

// POST /auth/wallet - 钱包签名登录，换取 JWT（无需认证）
router.post('/wallet', walletLogin)

// POST /auth/verify - MCP Server 专用：验证签名返回 JWT
router.post('/verify', walletVerify)

// POST /auth/verify-api-key - MCP Server 专用：验证 API Key 返回 scopes
router.post('/verify-api-key', verifyApiKey)

// GET /auth/nonce - 获取 nonce 用于签名（无认证）
// Accepts optional wallet query param to bind nonce to a specific wallet
router.get('/nonce', asyncHandler(async (req, res) => {
  const wallet = (req.query.wallet || req.query.publicKey) as string | undefined
  const nonce = await generateNonce(wallet)
  res.json({ nonce, expiresIn: 300 })
}))

export default router
