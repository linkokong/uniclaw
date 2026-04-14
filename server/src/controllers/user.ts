import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import type { AuthRequest } from '../middleware/auth.js'

const mockUserService = {
  getByWallet: async (wallet: string) => ({ id: 1, wallet_address: wallet, nickname: 'Test User', reputation: 100 }),
  getById: async (id: string) => ({ id: parseInt(id), wallet_address: 'MockWallet', nickname: 'User ' + id, reputation: 100 }),
  updateProfile: async (wallet: string, data: any) => ({ wallet_address: wallet, ...data }),
  updateById: async (id: string, data: any) => ({ id: parseInt(id), ...data }),
  getLeaderboard: async (limit: number, _tier?: string) => [],
  generateNonce: async (wallet: string) => Math.random().toString(36).substring(2)
}

const mockSolanaService = {
  getBalance: async (wallet: string) => '10.5',
  getTransactions: async (wallet: string, limit: number) => []
}

export const userController = {
  getNonce: asyncHandler(async (_req: AuthRequest, res: Response) => {
    const wallet = _req.query.wallet as string
    if (!wallet) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Wallet required' } })
    }
    const nonce = await mockUserService.generateNonce(wallet)
    res.json({ success: true, data: { nonce } })
  }),

  getByWallet: asyncHandler(async (req: AuthRequest, res: Response) => {
    const wallet = req.params.wallet as string
    const user = await mockUserService.getByWallet(wallet)
    res.json({ success: true, data: user })
  }),

  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const user = await mockUserService.getById(id)
    res.json({ success: true, data: user })
  }),

  getMe: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await mockUserService.getByWallet(req.user!.walletAddress)
    res.json({ success: true, data: user })
  }),

  updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await mockUserService.updateProfile(req.user!.walletAddress, req.body)
    res.json({ success: true, data: user })
  }),

  updateById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string
    const user = await mockUserService.updateById(id, req.body)
    res.json({ success: true, data: user })
  }),

  getLeaderboard: asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const tier = req.query.tier as string | undefined
    const users = await mockUserService.getLeaderboard(limit, tier)
    res.json({ success: true, data: users })
  }),

  getBalance: asyncHandler(async (req: AuthRequest, res: Response) => {
    const wallet = req.params.wallet as string
    const balance = await mockSolanaService.getBalance(wallet)
    res.json({ success: true, data: { balance } })
  }),

  getTransactions: asyncHandler(async (req: AuthRequest, res: Response) => {
    const wallet = req.params.wallet as string
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const transactions = await mockSolanaService.getTransactions(wallet, limit)
    res.json({ success: true, data: transactions })
  })
}
