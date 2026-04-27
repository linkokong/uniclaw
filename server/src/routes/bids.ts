import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { bidController } from '../controllers/bidController.js'
import { authenticateJWT } from '../middleware/auth.js'

const router = Router()

// 验证结果处理中间件
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array()
      }
    })
  }
  next()
}

// 所有路由需要认证
router.use(authenticateJWT)

// GET /bids - List user's bids (alias for /bids/my, MCP compatible)
router.get('/',
  [
    query('status')
      .optional()
      .isIn(['pending', 'accepted', 'rejected', 'withdrawn'])
      .withMessage('Invalid status filter'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt(),
    handleValidationErrors
  ],
  bidController.myBids
)

// GET /bids/task/:taskId - 获取指定任务的投标列表
router.get('/task/:taskId',
  [
    param('taskId')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    query('status')
      .optional()
      .isIn(['pending', 'accepted', 'rejected', 'withdrawn'])
      .withMessage('Invalid status filter'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt(),
    handleValidationErrors
  ],
  bidController.getByTask
)

// POST /bids - 创建投标
router.post('/',
  [
    body('task_id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    body('amount')
      .isDecimal({ decimal_digits: '0,4' })
      .withMessage('Amount must be a valid decimal number'),
    body('message')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Message must be max 5000 characters'),
    body('estimated_time')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Estimated time must be a positive integer (hours)'),
    handleValidationErrors
  ],
  bidController.create
)

// GET /bids/my - 获取当前用户的投标
router.get('/my',
  [
    query('status')
      .optional()
      .isIn(['pending', 'accepted', 'rejected', 'withdrawn'])
      .withMessage('Invalid status filter'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt(),
    handleValidationErrors
  ],
  bidController.myBids
)

// GET /bids/:id - 获取单个投标详情
router.get('/:id',
  [
    param('id')
      .custom((value: string) => {
        // Support both UUID and integer ID formats
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^\d+$/.test(value);
      })
      .withMessage('Bid ID must be a valid UUID or positive integer'),
    handleValidationErrors
  ],
  bidController.getById
)

// POST /bids/:id/accept - 接受投标（任务发布者）
router.post('/:id/accept',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Bid ID must be a positive integer'),
    handleValidationErrors
  ],
  bidController.accept
)

// POST /bids/:id/reject - 拒绝投标（任务发布者）
router.post('/:id/reject',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Bid ID must be a positive integer'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Reason must be max 1000 characters'),
    handleValidationErrors
  ],
  bidController.reject
)

// POST /bids/:id/withdraw - 撤回投标（投标者）
router.post('/:id/withdraw',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Bid ID must be a positive integer'),
    handleValidationErrors
  ],
  bidController.withdraw
)

export default router
