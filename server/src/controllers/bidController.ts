import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import type { AuthRequest } from '../middleware/auth.js'

// 模拟投标服务
const mockBidService = {
  create: async (wallet: string, data: any) => ({ id: 1, bidder_wallet: wallet, ...data, status: 'pending' }),
  listByBidder: async (wallet: string, page: number, limit: number) => ({ bids: [], total: 0 }),
  listByTask: async (taskId: string, page: number, limit: number, status?: string) => ({ 
    bids: [
      { id: 1, task_id: parseInt(taskId), bidder_wallet: 'Wallet1', amount: '100.00', status: 'pending' },
      { id: 2, task_id: parseInt(taskId), bidder_wallet: 'Wallet2', amount: '150.00', status: 'pending' }
    ], 
    total: 2 
  }),
  getById: async (id: string) => ({ id: parseInt(id), amount: '100.00', status: 'pending' }),
  accept: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'accepted' }),
  reject: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'rejected' }),
  withdraw: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'withdrawn' })
}

export const bidController = {
  // GET /bids/task/:taskId - 获取任务的投标列表
  getByTask: asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.taskId as string
    const page = (req.query.page as unknown as number) || 1
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    const status = req.query.status as string | undefined

    const result = await mockBidService.listByTask(taskId, page, limit, status)

    res.json({
      success: true,
      data: result.bids,
      meta: { page, limit, total: result.total }
    })
  }),

  // POST /bids - 创建投标
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bid = await mockBidService.create(req.user!.walletAddress, req.body)
    res.status(201).json({ success: true, data: bid })
  }),

  // GET /bids/my - 我的投标
  myBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = (req.query.page as unknown as number) || 1
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    const status = req.query.status as string | undefined

    const result = await mockBidService.listByBidder(req.user!.walletAddress, page, limit)

    res.json({
      success: true,
      data: result.bids,
      meta: { page, limit, total: result.total }
    })
  }),

  // GET /bids/:id - 获取单个投标
  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.getById(id)
    if (!bid) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Bid not found' }
      })
    }
    res.json({ success: true, data: bid })
  }),

  // POST /bids/:id/accept - 接受投标
  accept: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.accept(id, req.user!.walletAddress)
    res.json({ success: true, data: bid })
  }),

  // POST /bids/:id/reject - 拒绝投标
  reject: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.reject(id, req.user!.walletAddress)
    res.json({ success: true, data: bid })
  }),

  // POST /bids/:id/withdraw - 撤回投标
  withdraw: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.withdraw(id, req.user!.walletAddress)
    res.json({ success: true, data: bid })
  })
}
