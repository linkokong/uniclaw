import { Response } from 'express'
import { solanaService } from '../services/solana.js'
import { asyncHandler } from '../middleware/error.js'
import type { AuthRequest } from '../middleware/auth.js'

export const walletController = {
  // GET /wallet/balance
  getBalance: asyncHandler(async (req: AuthRequest, res: Response) => {
    const walletAddress = req.query.wallet as string || req.user!.walletAddress
    const balance = await solanaService.getBalance(walletAddress)
    res.json({ success: true, data: { balance, wallet: walletAddress } })
  }),

  // GET /wallet/transactions
  getTransactions: asyncHandler(async (req: AuthRequest, res: Response) => {
    const walletAddress = req.query.wallet as string || req.user!.walletAddress
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const transactions = await solanaService.getTransactionHistory(walletAddress, limit)
    res.json({ success: true, data: transactions })
  }),

  // POST /wallet/transfer
  transfer: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { to, amount } = req.body
    const unsignedTx = await solanaService.transfer(req.user!.walletAddress, to, amount)
    res.json({
      success: true,
      data: {
        transaction: unsignedTx,
        message: 'Please sign and submit this transaction'
      }
    })
  }),

  // GET /wallet/escrow/:taskId
  getEscrowBalance: asyncHandler(async (req: AuthRequest, res: Response) => {
    const balance = await solanaService.getEscrowBalance(req.params.taskId as string)
    res.json({ success: true, data: { balance } })
  })
}
