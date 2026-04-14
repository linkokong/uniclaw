import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { taskController } from '../controllers/taskController.js'
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

// POST /tasks - 创建任务
router.post('/',
  [
    body('title')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title must be between 1 and 255 characters'),
    body('description')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Description must be between 1 and 5000 characters'),
    body('required_skills')
      .optional()
      .isArray({ max: 20 })
      .withMessage('Skills must be an array with max 20 items'),
    body('budget')
      .isDecimal({ decimal_digits: '0,4' })
      .withMessage('Budget must be a valid decimal number'),
    body('category')
      .optional()
      .isLength({ max: 64 })
      .withMessage('Category must be max 64 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be one of: low, medium, high, urgent'),
    body('deadline')
      .optional()
      .isISO8601()
      .withMessage('Deadline must be a valid ISO8601 date'),
    handleValidationErrors
  ],
  taskController.create
)

// GET /tasks - 任务列表（支持筛选）
router.get('/',
  [
    query('status')
      .optional()
      .isIn(['open', 'in_progress', 'completed', 'cancelled', 'disputed'])
      .withMessage('Invalid status filter'),
    query('category')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 64 }),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent']),
    query('min_budget')
      .optional()
      .isDecimal(),
    query('max_budget')
      .optional()
      .isDecimal(),
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
  taskController.list
)

// GET /tasks/my - 获取当前用户的任务
router.get('/my', taskController.myTasks)

// GET /tasks/:id - 获取单个任务
router.get('/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    handleValidationErrors
  ],
  taskController.getById
)

// POST /tasks/:id/assign - 分配任务给工作者
router.post('/:id/assign',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    body('worker_id')
      .isInt({ min: 1 })
      .withMessage('Worker ID must be a positive integer'),
    handleValidationErrors
  ],
  taskController.assign
)

// POST /tasks/:id/start - 工作者开始任务
router.post('/:id/start',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    handleValidationErrors
  ],
  taskController.start
)

// POST /tasks/:id/submit - 提交完成的任务
router.post('/:id/submit',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a a positive integer'),
    body('result_hash')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Result hash is required'),
    handleValidationErrors
  ],
  taskController.submit
)

// POST /tasks/:id/verify - 验证完成的任务
router.post('/:id/verify',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    body('approved')
      .isBoolean()
      .withMessage('Approved must be a boolean'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Feedback must be max 2000 characters'),
    handleValidationErrors
  ],
  taskController.verify
)

// PUT /tasks/:id - 更新任务
router.put('/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title must be between 1 and 255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Description must be between 1 and 5000 characters'),
    body('required_skills')
      .optional()
      .isArray({ max: 20 })
      .withMessage('Skills must be an array with max 20 items'),
    body('budget')
      .optional()
      .isDecimal({ decimal_digits: '0,4' })
      .withMessage('Budget must be a valid decimal number'),
    body('category')
      .optional()
      .isLength({ max: 64 })
      .withMessage('Category must be max 64 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priority must be one of: low, medium, high, urgent'),
    body('deadline')
      .optional()
      .isISO8601()
      .withMessage('Deadline must be a valid ISO8601 date'),
    handleValidationErrors
  ],
  taskController.update
)

// POST /tasks/:id/cancel - 取消任务
router.post('/:id/cancel',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    handleValidationErrors
  ],
  taskController.cancel
)

// GET /tasks/:taskId/bids - 获取任务的投标列表
router.get('/:taskId/bids',
  [
    param('taskId')
      .isInt({ min: 1 })
      .withMessage('Task ID must be a positive integer'),
    handleValidationErrors
  ],
  taskController.getBids
)

export default router
