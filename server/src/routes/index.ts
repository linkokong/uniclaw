import { Router } from 'express'
import authRoutes from './auth.js'
import userRoutes from './users.js'
import taskRoutes from './tasks.js'
import bidRoutes from './bids.js'
import walletRoutes from './wallet.js'
import agentRoutes from './agents.js'
import apiKeyRoutes from './apiKeys.js'

// 路由注册表
// /api/users - 用户相关路由
// /api/tasks - 任务相关路由
// /api/bids - 投标相关路由
// /api/wallet - 钱包相关路由

const router = Router()

// API路由
router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/tasks', taskRoutes)
router.use('/bids', bidRoutes)
router.use('/wallet', walletRoutes)
router.use('/agents', agentRoutes)
router.use('/api-keys', apiKeyRoutes)

// 健康检查
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default router
