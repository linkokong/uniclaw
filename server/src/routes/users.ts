import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { userController } from '../controllers/userController.js'
import { authenticateJWT, optionalAuth } from '../middleware/auth.js'

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

// GET /users/nonce - 获取认证nonce（无需认证）
router.get('/nonce', userController.getNonce)

// GET /users/leaderboard - 获取排行榜（可选认证）
router.get('/leaderboard',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100'),
    query('tier')
      .optional()
      .isIn(['bronze', 'silver', 'gold', 'platinum'])
      .withMessage('Invalid tier filter'),
    handleValidationErrors
  ],
  optionalAuth,
  userController.getLeaderboard
)

// 以下路由需要认证（必须在 /:wallet 之前注册，否则 /me 被当成钱包地址）
router.use(authenticateJWT)

// GET /users/me - 获取当前用户信息
router.get('/me', userController.getMe)

// GET /users/:wallet - 根据钱包地址获取用户信息（需要认证）
router.get('/:wallet',
  [
    param('wallet')
      .matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
      .withMessage('Invalid Solana wallet address'),
    handleValidationErrors
  ],
  userController.getByWallet
)

// GET /users/id/:id - 根据用户ID获取用户信息（需要认证）
router.get('/id/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('User ID must be a positive integer'),
    handleValidationErrors
  ],
  userController.getById
)

// PATCH /users/me - 更新当前用户资料
router.patch('/me',
  [
    body('nickname')
      .optional()
      .trim()
      .isLength({ min: 1, max: 128 })
      .withMessage('Nickname must be between 1 and 128 characters'),
    body('avatar_url')
      .optional()
      .trim()
      .isURL()
      .withMessage('Avatar URL must be a valid URL'),
    body('skills')
      .optional()
      .isArray({ max: 50 })
      .withMessage('Skills must be an array with max 50 items'),
    body('skill_stack')
      .optional()
      .trim()
      .isLength({ max: 512 })
      .withMessage('Skill stack must be max 512 characters'),
    handleValidationErrors
  ],
  userController.updateProfile
)

// PUT /users/:id - 更新指定用户资料（管理员或本人）
router.put('/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('User ID must be a positive integer'),
    body('nickname')
      .optional()
      .trim()
      .isLength({ min: 1, max: 128 })
      .withMessage('Nickname must be between 1 and 128 characters'),
    body('avatar_url')
      .optional()
      .trim()
      .isURL()
      .withMessage('Avatar URL must be a valid URL'),
    body('skills')
      .optional()
      .isArray({ max: 50 })
      .withMessage('Skills must be an array with max 50 items'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Bio must be max 1000 characters'),
    handleValidationErrors
  ],
  userController.updateById
)

// GET /users/:wallet/balance - 获取用户余额
router.get('/:wallet/balance',
  [
    param('wallet')
      .matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
      .withMessage('Invalid Solana wallet address'),
    handleValidationErrors
  ],
  userController.getBalance
)

// GET /users/:wallet/transactions - 获取用户交易历史
router.get('/:wallet/transactions',
  [
    param('wallet')
      .matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
      .withMessage('Invalid Solana wallet address'),
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
  userController.getTransactions
)

export default router
