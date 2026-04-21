import { Router } from 'express'
import { walletLogin } from '../controllers/authController.js'

const router = Router()

// POST /auth/wallet - 钱包签名登录，换取 JWT（无需认证）
router.post('/wallet', walletLogin)

export default router
