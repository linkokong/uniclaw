import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import type { AuthRequest } from '../middleware/auth.js'

// Mock bid service
const mockBidService = {
  create: async (wallet: string, data: any) => ({ id: Date.now(), bidder_wallet: wallet, ...data, status: 'pending' }),
  listByBidder: async (wallet: string, page: number, limit: number) => ({ bids: [], total: 0 }),
  listByTask: async (taskId: string, page: number, limit: number) => ({ bids: [], total: 0 }),
  getById: async (id: string) => ({ id: parseInt(id), amount: '100.00', status: 'pending' }),
  accept: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'accepted' }),
  reject: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'rejected' }),
  withdraw: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'withdrawn' })
}

export const bidController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const bid = await mockBidService.create(req.user!.walletAddress, req.body)
    res.status(201).json({ success: true, data: bid })
  }),

  myBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const result = await mockBidService.listByBidder(req.user!.walletAddress, page, limit)
    res.json({ success: true, data: result.bids, meta: { page, limit, total: result.total } })
  }),

  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.getById(id)
    res.json({ success: true, data: bid })
  }),

  listByTask: asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.taskId as string
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const result = await mockBidService.listByTask(taskId, page, limit)
    res.json({ success: true, data: result.bids, meta: { page, limit, total: result.total } })
  }),

  accept: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.accept(id, req.user!.walletAddress)
    res.json({ success: true, data: bid })
  }),

  reject: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.reject(id, req.user!.walletAddress)
    res.json({ success: true, data: bid })
  }),

  withdraw: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const bid = await mockBidService.withdraw(id, req.user!.walletAddress)
    res.json({ success: true, data: bid })
  })
}
