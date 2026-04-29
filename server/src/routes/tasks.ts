import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { taskController } from '../controllers/taskController.js'
import { authenticateJWT, optionalAuth } from '../middleware/auth.js'

const router = Router()

const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: errors.array() }
    })
  }
  next()
}

// ── Public endpoints (no auth required) ──────────────────────────────────

// GET /tasks - 任务列表（公开）
router.get('/',
  [
    query('status').optional().isIn(['open', 'created', 'assigned', 'in_progress', 'completed', 'cancelled']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidationErrors
  ],
  taskController.list
)

// GET /tasks/my - 我的任务（必须在 /:id 之前，否则被截获）
router.get('/my', taskController.myTasks)

// GET /tasks/:taskId/bids - 获取任务投标（公开）
router.get('/:taskId/bids', taskController.getBids)

// GET /tasks/:id - 获取单个任务（公开，支持 UUID 和 PDA 地址）
router.get('/:id', taskController.getById)

// ── Authenticated endpoints ──────────────────────────────────────────────

// POST /tasks/sync - 链上交易成功后同步到 DB（需要钱包签名认证）
router.post('/sync',
  optionalAuth,
  [
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('description').trim().isLength({ min: 1, max: 5000 }),
    body('reward').isString(),
    body('tx_signature').isString(),
    body('task_pda').isString(),
    body('creator_wallet').isString(),
    handleValidationErrors
  ],
  taskController.syncFromChain
)

router.use(authenticateJWT)

// POST /tasks - 创建任务
router.post('/',
  [
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('description').trim().isLength({ min: 1, max: 5000 }),
    body('required_skills').optional().isArray({ max: 20 }),
    body('reward').optional().isDecimal({ decimal_digits: '0,9' }),
    body('verification_period').optional().isInt({ min: 604800, max: 2592000 }),
    handleValidationErrors
  ],
  taskController.create
)

// POST /tasks/:id/start
router.post('/:id/start', taskController.start)

// POST /tasks/:id/submit
router.post('/:id/submit', taskController.submit)

// POST /tasks/:id/verify
router.post('/:id/verify',
  [body('approved').isBoolean(), handleValidationErrors],
  taskController.verify
)

// POST /tasks/:id/cancel
router.post('/:id/cancel', taskController.cancel)

export default router
