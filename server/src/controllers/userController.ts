import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import type { AuthRequest } from '../middleware/auth.js'

// 模拟用户服务
const mockUserService = {
  getByWallet: async (wallet: string) => ({
    id: 1,
    did: `did:claw:sol:${wallet}:agent1`,
    wallet_address: wallet,
    agent_id: 'agent1',
    nickname: 'Test User',
    reputation: 100,
    tier: 'gold',
    status: 'active'
  }),
  getById: async (id: string) => ({
    id: parseInt(id),
    did: `did:claw:sol:user${id}:agent1`,
    wallet_address: 'MockWalletAddress' + id,
    agent_id: 'agent1',
    nickname: 'Test User ' + id,
    reputation: 100,
    tier: 'gold',
    status: 'active'
  }),
  updateProfile: async (wallet: string, data: any) => ({ wallet_address: wallet, ...data }),
  updateById: async (id: string, data: any) => ({ id: parseInt(id), ...data, updated_at: new Date() }),
  getLeaderboard: async (limit: number, tier?: string) => [],
  generateNonce: async (wallet: string) => Math.random().toString(36).substring(2)
}

// 模拟Solana服务
const mockSolanaService = {
  getBalance: async (wallet: string) => '10.5',
  getTransactionHistory: async (wallet: string, limit: number) => []
}

export const userController = {
  // GET /users/me - 获取当前用户
  getMe: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await mockUserService.getByWallet(req.user!.walletAddress)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      })
    }
    res.json({ success: true, data: user })
  }),

  // GET /users/:wallet - 根据钱包获取用户
  getByWallet: asyncHandler(async (req: AuthRequest, res: Response) => {
    const wallet = req.params.wallet as string
    const user = await mockUserService.getByWallet(wallet)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      })
    }
    res.json({ success: true, data: user })
  }),

  // GET /users/id/:id - 根据用户ID获取用户
  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const user = await mockUserService.getById(id)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      })
    }
    res.json({ success: true, data: user })
  }),

  // PATCH /users/me - 更新当前用户资料
  updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await mockUserService.updateProfile(req.user!.walletAddress, req.body)
    res.json({ success: true, data: user })
  }),

  // PUT /users/:id - 更新指定用户资料
  updateById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const user = await mockUserService.updateById(id, req.body)
    res.json({ success: true, data: user })
  }),

  // GET /users/leaderboard - 排行榜
  getLeaderboard: asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    const tier = req.query.tier as string | undefined
    const users = await mockUserService.getLeaderboard(limit, tier)
    res.json({ success: true, data: users })
  }),

  // GET /users/nonce - 获取nonce
  getNonce: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const wallet = _req.query.wallet as string
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Wallet address required' }
      })
    }
    const nonce = await mockUserService.generateNonce(wallet)
    res.json({ success: true, data: { nonce } })
  }),

  // GET /users/:wallet/balance - 获取余额
  getBalance: asyncHandler(async (req: AuthRequest, res: Response) => {
    const wallet = req.params.wallet as string
    const balance = await mockSolanaService.getBalance(wallet)
    res.json({ success: true, data: { balance } })
  }),

  // GET /users/:wallet/transactions - 获取交易历史
  getTransactions: asyncHandler(async (req: AuthRequest, res: Response) => {
    const wallet = req.params.wallet as string
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    const transactions = await mockSolanaService.getTransactionHistory(wallet, limit)
    res.json({ success: true, data: transactions })
  })
}
