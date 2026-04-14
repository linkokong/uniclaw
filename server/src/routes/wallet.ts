import { Router } from 'express'
import { walletController } from '../controllers/wallet.js'
import { authenticateJWT, optionalAuth } from '../middleware/auth.js'
import { transactionLimiter } from '../middleware/rateLimit.js'

const router = Router()

// GET /wallet/balance - Get wallet balance (optional auth)
router.get('/balance', optionalAuth, walletController.getBalance)

// GET /wallet/transactions - Get transaction history
router.get('/transactions', optionalAuth, walletController.getTransactions)

// POST /wallet/transfer - Create transfer transaction
router.post('/transfer', authenticateJWT, transactionLimiter, walletController.transfer)

// GET /wallet/escrow/:taskId - Get task escrow balance
router.get('/escrow/:taskId', walletController.getEscrowBalance)

export default router
