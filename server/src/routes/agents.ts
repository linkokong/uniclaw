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
// SECURITY FIX (C#1): 改用 authenticateJWT 强制认证，owner_wallet 从 JWT 提取而非客户端传入
router.post('/',
  authenticateJWT,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('capabilities').optional().isArray({ max: 20 }),
    body('skills').optional().isArray({ max: 20 }), // MCP alias for capabilities
    body('hourly_rate').optional().isFloat({ min: 0 }),
    body('hourlyRate').optional().isFloat({ min: 0 }), // MCP alias
    body('monthly_rate').optional().isFloat({ min: 0 }),
    body('currency').optional().isIn(['SOL', 'UNICLAW', 'USDGO']),
    // REMOVED: body('owner_wallet') - 不再接受客户端传入，从 JWT 提取
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, capabilities, skills, hourly_rate, hourlyRate, monthly_rate, currency } = req.body
    
    // SECURITY: owner_wallet 从认证主体提取，防止身份伪造
    if (!req.user?.walletAddress) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Wallet authentication required' }
      })
      return
    }
    const owner_wallet = req.user.walletAddress

    // Normalize: MCP sends camelCase, DB uses snake_case
    const caps = capabilities || skills || []
    const rate = hourly_rate ?? hourlyRate ?? 0

    const result = await pool.query(
      `INSERT INTO agents (owner_wallet, name, description, capabilities, hourly_rate, monthly_rate, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [owner_wallet, name, description || '', caps, rate, monthly_rate || 0, currency || 'SOL']
    )

    res.status(201).json({ success: true, data: result.rows[0] })
  })
)

// PUT /agents/me - 更新当前用户的 Agent Profile（MCP Server 兼容端点）
router.put('/me', authenticateJWT,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, capabilities, skills, hourly_rate, hourlyRate, monthly_rate, available } = req.body as any

    if (!req.user?.walletAddress) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Wallet authentication required' }
      })
      return
    }

    // Normalize field names: MCP sends camelCase, DB uses snake_case
    const caps = capabilities || skills || []
    const rate = hourly_rate ?? hourlyRate

    const result = await pool.query(
      `UPDATE agents SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        capabilities = COALESCE($4, capabilities),
        hourly_rate = COALESCE($5, hourly_rate),
        monthly_rate = COALESCE($6, monthly_rate),
        available = COALESCE($7, available),
        updated_at = NOW()
       WHERE owner_wallet = $1
       RETURNING *`,
      [req.user.walletAddress, name, description, caps, rate, monthly_rate, available]
    )

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent profile not found' } })
      return
    }
    res.json({ success: true, data: result.rows[0] })
  })
)

// PUT /agents/:id - 更新 Agent 信息
// SECURITY FIX (C#2): 添加所有权校验，只有 owner 才能更新自己的 Agent
router.put('/:id', authenticateJWT,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, capabilities, hourly_rate, monthly_rate, available } = req.body
    
    // SECURITY: 所有权校验 - WHERE 条件同时检查 id 和 owner_wallet
    if (!req.user?.walletAddress) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Wallet authentication required' }
      })
      return
    }
    
    const result = await pool.query(
      `UPDATE agents SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        capabilities = COALESCE($4, capabilities),
        hourly_rate = COALESCE($5, hourly_rate),
        monthly_rate = COALESCE($6, monthly_rate),
        available = COALESCE($7, available),
        updated_at = NOW()
       WHERE id = $1 AND owner_wallet = $8
       RETURNING *`,
      [req.params.id, name, description, capabilities, hourly_rate, monthly_rate, available, req.user.walletAddress]
    )
    
    if (result.rows.length === 0) {
      // 返回 404 而非 403，避免信息泄露（攻击者不知道 Agent 是否存在）
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } })
      return
    }
    res.json({ success: true, data: result.rows[0] })
  })
)

// GET /agents/me - 获取当前用户的 Agent Profile
router.get('/me', authenticateJWT,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.walletAddress) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Wallet authentication required' }
      })
      return
    }

    const result = await pool.query(
      'SELECT * FROM agents WHERE owner_wallet = $1',
      [req.user.walletAddress]
    )

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent profile not found' }
      })
      return
    }

    res.json({ success: true, data: result.rows[0] })
  })
)

// GET /agents/:id - 公开查看单个 Agent 详情
router.get('/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      'SELECT * FROM agents WHERE id = $1',
      [req.params.id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' }
      })
      return
    }

    res.json({ success: true, data: result.rows[0] })
  })
)

// GET /agents/:id/reputation - 获取 Agent 信誉统计
router.get('/:id/reputation',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      `SELECT 
        id,
        name,
        rating,
        total_jobs,
        completed_jobs,
        failed_jobs,
        total_earnings,
        owner_wallet
       FROM agents WHERE id = $1`,
      [req.params.id]
    )

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' }
      })
      return
    }

    const agent = result.rows[0]
    res.json({
      success: true,
      data: {
        agent_id: agent.id,
        name: agent.name,
        rating: agent.rating,
        total_jobs: parseInt(agent.total_jobs),
        completed_jobs: parseInt(agent.completed_jobs),
        failed_jobs: parseInt(agent.failed_jobs),
        success_rate: agent.total_jobs > 0 
          ? (agent.completed_jobs / agent.total_jobs * 100).toFixed(2) + '%'
          : '0%',
        total_earnings: agent.total_earnings
      }
    })
  })
)

export default router
