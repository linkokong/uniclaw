import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { taskController } from '../controllers/taskController.js'
import { bidController } from '../controllers/bidController.js'
import { authenticateJWT } from '../middleware/auth.js'

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

router.use(authenticateJWT)

// POST /tasks - 创建任务
router.post('/',
  [
    body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title required, max 255 chars'),
    body('description').trim().isLength({ min: 1, max: 5000 }).withMessage('Description required, max 5000 chars'),
    body('required_skills').optional().isArray({ max: 20 }),
    body('reward').optional().isDecimal({ decimal_digits: '0,9' }),
    body('verification_period').optional().isInt({ min: 604800, max: 2592000 }),
    body('signed_tx').optional().isString(),
    handleValidationErrors
  ],
  taskController.create
)

// GET /tasks - 任务列表
router.get('/',
  [
    query('status').optional().isIn(['open', 'in_progress', 'completed', 'cancelled']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidationErrors
  ],
  taskController.list
)

// GET /tasks/my - 我的任务
router.get('/my', taskController.myTasks)

// GET /tasks/:id - 获取单个任务
router.get('/:id',
  [param('id').isUUID().withMessage('Task ID must be a valid UUID'), handleValidationErrors],
  taskController.getById
)

// POST /tasks/:id/start - 开始任务
router.post('/:id/start',
  [param('id').isUUID(), handleValidationErrors],
  taskController.start
)

// POST /tasks/:id/submit - 提交任务
router.post('/:id/submit',
  [param('id').isUUID(), handleValidationErrors],
  taskController.submit
)

// POST /tasks/:id/verify - 验收（通过/拒绝）
router.post('/:id/verify',
  [
    param('id').isUUID(),
    body('approved').isBoolean().withMessage('approved must be boolean'),
    handleValidationErrors
  ],
  taskController.verify
)

// POST /tasks/:id/cancel - 取消任务
router.post('/:id/cancel',
  [param('id').isUUID(), handleValidationErrors],
  taskController.cancel
)

// GET /tasks/:taskId/bids - 获取任务投标
router.get('/:taskId/bids',
  [param('taskId').isUUID(), handleValidationErrors],
  taskController.getBids
)

export default router
