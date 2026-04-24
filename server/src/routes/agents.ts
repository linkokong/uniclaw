import { Router, Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import { pool } from '../models/index.js'
import { authenticateJWT, optionalAuth, type AuthRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'

const router = Router()

const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() }
    })
  }
  next()
}

// GET /agents - 公开浏览 Agent 列表
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString(),
    query('verified').optional().isIn(['true', 'false']),
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, (req.query.page as unknown as number) || 1)
    const limit = Math.min(100, (req.query.limit as unknown as number) || 20)
    const offset = (page - 1) * limit
    const search = req.query.search as string | undefined
    const verified = req.query.verified === 'true' ? true : undefined

    const conditions: string[] = ['available = true']
    const values: any[] = []
    let idx = 1

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`)
      values.push(`%${search}%`)
      idx++
    }
    if (verified !== undefined) {
      conditions.push(`verified = $${idx}`)
      values.push(verified)
      idx++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countRes = await pool.query(`SELECT COUNT(*) FROM agents ${where}`, values)
    const total = parseInt(countRes.rows[0].count)

    values.push(limit, offset)
    const result = await pool.query(
      `SELECT * FROM agents ${where} ORDER BY rating DESC, total_jobs DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      values
    )

    res.json({ success: true, data: result.rows, meta: { page, limit, total } })
  })
)

// POST /agents - 注册/挂牌 Agent（需要钱包认证）
router.post('/',
  optionalAuth,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('capabilities').optional().isArray({ max: 20 }),
    body('hourly_rate').isFloat({ min: 0 }),
    body('monthly_rate').optional().isFloat({ min: 0 }),
    body('currency').optional().isIn(['SOL', 'UNICLAW', 'USDGO']),
    body('owner_wallet').isString(),
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, capabilities, hourly_rate, monthly_rate, currency, owner_wallet } = req.body

    const result = await pool.query(
      `INSERT INTO agents (owner_wallet, name, description, capabilities, hourly_rate, monthly_rate, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [owner_wallet, name, description || '', capabilities || [], hourly_rate, monthly_rate || 0, currency || 'SOL']
    )

    res.status(201).json({ success: true, data: result.rows[0] })
  })
)

// PUT /agents/:id - 更新 Agent 信息
router.put('/:id', authenticateJWT,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, capabilities, hourly_rate, monthly_rate, available } = req.body
    const result = await pool.query(
      `UPDATE agents SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        capabilities = COALESCE($4, capabilities),
        hourly_rate = COALESCE($5, hourly_rate),
        monthly_rate = COALESCE($6, monthly_rate),
        available = COALESCE($7, available),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, description, capabilities, hourly_rate, monthly_rate, available]
    )
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } })
      return
    }
    res.json({ success: true, data: result.rows[0] })
  })
)

export default router
