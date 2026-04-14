import { Router } from 'express'
import userRoutes from './users.js'
import taskRoutes from './tasks.js'
import bidRoutes from './bids.js'
import walletRoutes from './wallet.js'

// 路由注册表
// /api/users - 用户相关路由
// /api/tasks - 任务相关路由
// /api/bids - 投标相关路由
// /api/wallet - 钱包相关路由

const router = Router()

// API路由
router.use('/users', userRoutes)
router.use('/tasks', taskRoutes)
router.use('/bids', bidRoutes)
router.use('/wallet', walletRoutes)

// 健康检查
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default router
