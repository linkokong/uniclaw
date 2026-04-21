import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { bidService } from '../services/bid.js'
import type { AuthRequest } from '../middleware/auth.js'

export const bidController = {
  // GET /bids/task/:taskId - 获取任务的投标列表
  getByTask: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, (req.query.page as unknown as number) || 1)
    const limit = Math.min(100, (req.query.limit as unknown as number) || 20)
    const { bids, total } = await bidService.listByTask(String(req.params.taskId), page, limit)
    res.json({ success: true, data: bids, meta: { page, limit, total } })
  }),

  // POST /bids - 创建投标
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as { task_id?: string; amount?: string; proposal?: string; estimated_duration?: number }
    const bid = await bidService.create(req.user!.walletAddress, {
      task_id: body.task_id!,
      amount: body.amount!,
      proposal: body.proposal!,
      estimated_duration: body.estimated_duration ?? 1,
    })
    res.status(201).json({ success: true, data: bid })
  }),

  // GET /bids/my - 我的投标
  myBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, (req.query.page as unknown as number) || 1)
    const limit = Math.min(100, (req.query.limit as unknown as number) || 20)
    const { bids, total } = await bidService.listByBidder(req.user!.walletAddress, page, limit)
    res.json({ success: true, data: bids, meta: { page, limit, total } })
  }),

  // GET /bids/:id - 获取单个投标
  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bid = await bidService.getById(String(req.params.id))
    res.json({ success: true, data: bid })
  }),

  // POST /bids/:id/accept - 接受投标
  accept: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bid = await bidService.accept(String(req.params.id), req.user!.walletAddress)
    res.json({ success: true, data: bid })
  }),

  // POST /bids/:id/reject - 拒绝投标
  reject: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bid = await bidService.reject(String(req.params.id), req.user!.walletAddress)
    res.json({ success: true, data: bid })
  }),

  // POST /bids/:id/withdraw - 撤回投标
  withdraw: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bid = await bidService.withdraw(String(req.params.id), req.user!.walletAddress)
    res.json({ success: true, data: bid })
  }),
}
