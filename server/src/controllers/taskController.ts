import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import type { AuthRequest } from '../middleware/auth.js'

// 模拟任务服务，实际项目中应该从services导入
const mockTaskService = {
  create: async (wallet: string, data: any) => ({ id: 1, ...data, employer_id: 1 }),
  list: async (filters: any) => ({ tasks: [], total: 0 }),
  getById: async (id: string) => ({ id: parseInt(id), title: 'Mock Task' }),
  update: async (id: string, wallet: string, data: any) => ({ id: parseInt(id), ...data, updated_at: new Date() }),
  assign: async (id: string, workerId: number) => ({ id: parseInt(id), worker_id: workerId }),
  start: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'in_progress' }),
  submit: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'completed' }),
  verify: async (id: string, wallet: string, approved: boolean) => ({ id: parseInt(id), status: approved ? 'completed' : 'disputed' }),
  cancel: async (id: string, wallet: string) => ({ id: parseInt(id), status: 'cancelled' }),
  getBids: async (taskId: string) => []
}

export const taskController = {
  // POST /tasks - 创建任务
  create: asyncHandler(async (req: AuthRequest, res: Response) => {
    const task = await mockTaskService.create(req.user!.walletAddress, req.body)
    res.status(201).json({ success: true, data: task })
  }),

  // GET /tasks - 任务列表
  list: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = req.query.page as unknown as number || 1
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    
    const result = await mockTaskService.list({
      status: req.query.status,
      category: req.query.category,
      priority: req.query.priority,
      min_budget: req.query.min_budget,
      max_budget: req.query.max_budget,
      page,
      limit
    })

    res.json({
      success: true,
      data: result.tasks,
      meta: { page, limit, total: result.total }
    })
  }),

  // GET /tasks/my - 我的任务
  myTasks: asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = req.query.page as unknown as number || 1
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    const role = (req.query.role as string) || 'all'

    const result = await mockTaskService.list({
      employer_wallet: role === 'employer' || role === 'all' ? req.user!.walletAddress : undefined,
      worker_wallet: role === 'worker' || role === 'all' ? req.user!.walletAddress : undefined,
      page,
      limit
    })

    res.json({
      success: true,
      data: result.tasks,
      meta: { page, limit, total: result.total }
    })
  }),

  // GET /tasks/:id - 获取单个任务
  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.getById(id)
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Task not found' }
      })
    }
    res.json({ success: true, data: task })
  }),

  // PUT /tasks/:id - 更新任务
  update: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.update(id, req.user!.walletAddress, req.body)
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/assign - 分配任务
  assign: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const { worker_id } = req.body
    const task = await mockTaskService.assign(id, worker_id)
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/start - 开始任务
  start: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.start(id, req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/submit - 提交任务
  submit: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.submit(id, req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/verify - 验证任务
  verify: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const { approved } = req.body
    const task = await mockTaskService.verify(id, req.user!.walletAddress, approved)
    res.json({ success: true, data: task })
  }),

  // POST /tasks/:id/cancel - 取消任务
  cancel: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const task = await mockTaskService.cancel(id, req.user!.walletAddress)
    res.json({ success: true, data: task })
  }),

  // GET /tasks/:taskId/bids - 获取任务投标
  getBids: asyncHandler(async (req: AuthRequest, res: Response) => {
    const taskId = req.params.taskId as string
    const bids = await mockTaskService.getBids(taskId)
    res.json({ success: true, data: bids })
  })
}
