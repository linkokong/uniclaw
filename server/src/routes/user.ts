import { Router } from 'express'
import { userController } from '../controllers/user.js'
import { authenticateJWT } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validation.js'

const router = Router()

// All routes require authentication
router.use(authenticateJWT)

// GET /users/me - Get current user
router.get('/me', userController.getMe)

// PATCH /users/me - Update current user profile
router.patch('/me', validate(schemas.updateProfile), userController.updateProfile)

// GET /users/leaderboard - Get top users by reputation
router.get('/leaderboard', userController.getLeaderboard)

// GET /users/nonce - Get nonce for EIP-4361 authentication
router.get('/nonce', userController.getNonce)

// GET /users/:wallet - Get user by wallet address
router.get('/:wallet', userController.getByWallet)

// GET /users/:wallet/balance - Get SOL balance
router.get('/:wallet/balance', userController.getBalance)

// GET /users/:wallet/transactions - Get transaction history
router.get('/:wallet/transactions', userController.getTransactions)

export default router
