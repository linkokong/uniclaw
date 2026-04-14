import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import type { AuthRequest } from '../middleware/auth.js'

// Mock task service
const mockTaskService = {
  create: async (wallet: string, data: any) => ({ id: Date.now(), employer_wallet: wallet, ...data, status: 'open' }),
  list: async (filters: any) => ({ tasks: [], total: 0 }),
  getById: async (id: string) => ({ id: parseInt(id), title: 'Mock Task', status: 'open' }),
  update: async (id: string, wallet: string, data: any) => ({ id: parseInt(id), ...data, updated_at: new Date() }),
  assign: async (id: string, workerId: number) => ({ id: parseInt(id), worker_id: workerId }),
  start: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'in_progress' }),
  submit: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'completed' }),
  verify: async (id: string, wallet: string, approved: boolean) => ({ id: parseInt(id), status: approved ? 'completed' : 'disputed' }),
  cancel: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'cancelled' }),
  getBids: async (taskId: string) => []
}

export const taskController = {
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const task = await mockTaskService.create(req.user!.walletAddress, req.body)
    res.status(201).json({ success: true, data: task })
  }),

  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await mockTaskService.list(req.query)
    res.json({ success: true, data: result.tasks, meta: { total: result.total } })
  }),

  myTasks: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const result = await mockTaskService.list({ ...req.query, page, limit })
    res.json({ success: true, data: result.tasks, meta: { page, limit, total: result.total } })
  }),

  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.getById(id)
    res.json({ success: true, data: task })
  }),

  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.update(id, req.user!.walletAddress, req.body)
    res.json({ success: true, data: task })
  }),

  assign: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.assign(id, req.body.worker_id)
    res.json({ success: true, data: task })
  }),

  start: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.start(id, req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  submit: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.submit(id, req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  verify: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.verify(id, req.user!.walletAddress, req.body.approved)
    res.json({ success: true, data: task })
  }),

  cancel: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.cancel(id, req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  getBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.taskId as string
    const bids = await mockTaskService.getBids(taskId)
    res.json({ success: true, data: bids })
  })
}
