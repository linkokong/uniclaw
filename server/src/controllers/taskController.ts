import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { taskService } from '../services/task.js'
import { bidService } from '../services/bid.js'
import { solanaService } from '../services/solana.js'
import { config } from '../config/index.js'
import type { AuthRequest } from '../middleware/auth.js'
import type { TaskStatus } from '../types/index.js'

// Mapping from human-readable status in routes to service enum
function mapStatusQuery(raw?: string): TaskStatus | undefined {
  if (!raw) return undefined
  const map: Record<string, TaskStatus> = {
    open: 'created' as TaskStatus,
    in_progress: 'in_progress' as TaskStatus,
    completed: 'completed' as TaskStatus,
    cancelled: 'cancelled' as TaskStatus,
  }
  return map[raw]
}

export const taskController = {
  // POST /tasks - 创建任务（relay signed tx from frontend Phantom wallet）
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      title?: string
      description?: string
      required_skills?: string[]
      reward?: string
      category?: string
      verification_period?: number
      signed_tx?: string   // base64 encoded signed transaction from Phantom
    }

    const creatorWallet = req.user!.walletAddress

    // If frontend sends a signed tx, relay it to Solana
    if (body.signed_tx) {
      const txSignature = await solanaService.relayTransaction(body.signed_tx)
      // Also record in DB for indexing
      const task = await taskService.create(creatorWallet, {
        title: body.title!,
        description: body.description!,
        required_skills: body.required_skills ?? [],
        reward: body.reward ?? '0',
        verification_period: body.verification_period ?? 7 * 24 * 3600,
      })
      res.status(201).json({
        success: true,
        data: { ...task, txSignature },
      })
      return
    }

    // Fallback: DB-only (for simple testing without Phantom)
    const task = await taskService.create(creatorWallet, {
      title: body.title!,
      description: body.description!,
      required_skills: body.required_skills ?? [],
      reward: body.reward ?? '0',
      verification_period: body.verification_period ?? 7 * 24 * 3600,
    })
    res.status(201).json({ success: true, data: task })
  }),

  // GET /tasks - 任务列表（从 PostgreSQL 读）
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, (req.query.page as unknown as number) || 1)
    const limit = Math.min(100, (req.query.limit as unknown as number) || 20)

    const result = await taskService.list({
      status: mapStatusQuery(req.query.status as string),
      skills: req.query.skills
        ? String(req.query.skills).split(',').map((s: string) => s.trim())
        : undefined,
      page,
      limit,
    })

    res.json({
      success: true,
      data: result.tasks,
      meta: { page, limit, total: result.total },
    })
  }),

  // GET /tasks/my - 我的任务
  myTasks: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    }

    const page = Math.max(1, (req.query.page as unknown as number) || 1)
    const limit = Math.min(100, (req.query.limit as unknown as number) || 20)
    const role = (req.query.role as string) || 'all'

    const result = await taskService.list({
      creator_wallet: role === 'employer' || role === 'all' ? req.user!.walletAddress : undefined,
      worker_wallet: role === 'worker' || role === 'all' ? req.user!.walletAddress : undefined,
      page,
      limit,
    })

    res.json({
      success: true,
      data: result.tasks,
      meta: { page, limit, total: result.total },
    })
  }),

  // GET /tasks/:id - 获取单个任务（支持 UUID 和链上 PDA 地址）
  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id || req.params.taskId)
    // Try UUID first, then PDA
    try {
      const task = await taskService.getById(id)
      res.json({ success: true, data: task })
    } catch {
      // Try by PDA address
      const task = await taskService.getByPda(id)
      if (task) {
        res.json({ success: true, data: task })
      } else {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } })
      }
    }
  }),

  // POST /tasks/:id/start - 开始任务
  start: asyncHandler(async (req: AuthRequest, res: Response) => {
    const task = await taskService.start(String(req.params.id), req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/submit - 提交任务结果
  submit: asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
      resultUrl?: string
      resultDescription?: string
      attachments?: string[]
    }
    const task = await taskService.submit(
      String(req.params.id),
      req.user!.walletAddress,
      body
    )
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/verify - 验收（通过/拒绝）
  verify: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { approved } = req.body as { approved?: boolean }
    if (typeof approved !== 'boolean') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'approved must be boolean' } })
      return
    }
    const task = await taskService.verify(String(req.params.id), req.user!.walletAddress, approved)
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/cancel - 取消任务
  cancel: asyncHandler(async (req: AuthRequest, res: Response) => {
    const task = await taskService.cancel(String(req.params.id), req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  // GET /tasks/:taskId/bids - 获取任务投标
  getBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, (req.query.page as unknown as number) || 1)
    const limit = Math.min(100, (req.query.limit as unknown as number) || 20)
    const taskId = String(req.params.taskId || req.params.id)
    const { bids, total } = await bidService.listByTask(taskId, page, limit)
    res.json({ success: true, data: bids, meta: { page, limit, total } })
  }),

  // POST /tasks/sync - 链上交易成功后同步到 DB
  syncFromChain: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, required_skills, reward, verification_period,
            tx_signature, task_pda, creator_wallet, category } = req.body as {
      title: string
      description: string
      required_skills?: string[]
      reward: string
      verification_period?: number
      tx_signature: string
      task_pda: string
      creator_wallet: string
      category?: string
    }

    const task = await taskService.syncFromChain({
      title,
      description,
      required_skills: required_skills ?? [],
      reward,
      verification_period: verification_period ?? 604800,
      tx_signature,
      task_pda,
      creator_wallet,
      category,
    })

    res.status(201).json({ success: true, data: task })
  }),
}
