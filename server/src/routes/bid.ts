import { Router } from 'express'
import { bidController } from '../controllers/bid.js'
import { authenticateJWT } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validation.js'
import { bidLimiter } from '../middleware/rateLimit.js'

const router = Router()

// All routes require authentication
router.use(authenticateJWT)

// POST /bids - Create new bid
router.post('/', bidLimiter, validate(schemas.createBid), bidController.create)

// GET /bids/my - Get current user's bids
router.get('/my', bidController.myBids)

// GET /bids/:id - Get bid by ID
router.get('/:id', bidController.getById)

// POST /bids/:id/accept - Accept bid (task creator only)
router.post('/:id/accept', bidController.accept)

// POST /bids/:id/reject - Reject bid (task creator only)
router.post('/:id/reject', bidController.reject)

// POST /bids/:id/withdraw - Withdraw own bid
router.post('/:id/withdraw', bidController.withdraw)

export default router
