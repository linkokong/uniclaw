import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { userService } from '../services/user.js'
import { solanaService } from '../services/solana.js'
import { config } from '../config/index.js'
import type { AuthRequest } from '../middleware/auth.js'

export const userController = {
  // GET /users/me - 获取当前用户（从 DB 读）
  getMe: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await userService.getByWallet(req.user!.walletAddress)
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
    const user = await userService.getByWallet(String(req.params.wallet))
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      })
    }
    res.json({ success: true, data: user })
  }),

  // GET /users/id/:id - 根据 ID 获取用户
  getById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await userService.getById(String(req.params.id))
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      })
    }
    res.json({ success: true, data: user })
  }),

  // PUT /users/:id - 更新指定用户资料
  updateById: asyncHandler(async (req: AuthRequest, res: Response) => {
    // Only allow users to update their own profile (by wallet match)
    const targetUser = await userService.getById(String(req.params.id))
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      })
    }
    if (targetUser.wallet_address !== req.user!.walletAddress) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot update another user\'s profile' }
      })
    }
    const user = await userService.updateProfile(targetUser.wallet_address, req.body)
    res.json({ success: true, data: user })
  }),

  // PATCH /users/me - 更新当前用户资料
  updateProfile: asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await userService.updateProfile(req.user!.walletAddress, req.body)
    res.json({ success: true, data: user })
  }),

  // GET /users/leaderboard - 排行榜
  getLeaderboard: asyncHandler(async (req: AuthRequest, res: Response) => {
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    const users = await userService.getLeaderboard(limit)
    res.json({ success: true, data: users })
  }),

  // GET /users/nonce - 获取 nonce（用于钱包签名登录）
  getNonce: asyncHandler(async (req: any, res: Response) => {
    const wallet = req.query.wallet as string
    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Wallet address required' }
      })
    }
    const nonce = await userService.generateNonce(wallet)
    res.json({ success: true, data: { nonce } })
  }),

  // GET /users/:wallet/balance - 获取用户 SOL + UNIC 余额
  getBalance: asyncHandler(async (req: any, res: Response) => {
    const wallet = req.params.wallet as string
    const [solBalance, unicBalance] = await Promise.all([
      solanaService.getBalance(wallet),
      solanaService.getUnicBalance(wallet, config.solana.tokenMint),
    ])
    res.json({
      success: true,
      data: { sol: solBalance, unic: unicBalance, wallet },
    })
  }),

  // GET /users/:wallet/transactions - 获取交易历史
  getTransactions: asyncHandler(async (req: any, res: Response) => {
    const wallet = req.params.wallet as string
    const limit = Math.min((req.query.limit as unknown as number) || 20, 100)
    const transactions = await solanaService.getTransactionHistory(wallet, limit)
    res.json({ success: true, data: transactions })
  }),
}
