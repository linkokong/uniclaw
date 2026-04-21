import { Response } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { verifySiweMessage } from '../middleware/auth.js'
import { generateAccessToken } from '../middleware/auth.js'
import { userService } from '../services/user.js'
import type { AuthRequest } from '../middleware/auth.js'

// POST /auth/wallet - 钱包签名登录，换取 JWT
export const walletLogin = asyncHandler(async (req: AuthRequest, res: Response) => {
  const walletAddress = req.headers['x-wallet-address'] as string
  const signature = req.headers['x-signature'] as string
  // signMessage comes from body (JSON), not headers, to preserve newlines
  const body = req.body as { signMessage?: string }
  const signMessage = body?.signMessage

  console.log('[walletLogin] headers:')
  console.log('  wallet:', walletAddress)
  console.log('  signature:', signature?.substring(0, 20), '... (len:', signature?.length, ')')
  console.log('  signMessage (from body):', signMessage ? JSON.stringify(signMessage) : 'MISSING')

  if (!walletAddress || !signature) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing wallet address or signature' }
    })
  }

  if (!signMessage) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing signMessage in request body' }
    })
  }

  // 从 signMessage 中提取 nonce（格式: "... Nonce: xxxxxx"）
  let nonce: string | undefined
  const match = signMessage.match(/Nonce:\s*(\S+)/)
  nonce = match?.[1]

  console.log('[walletLogin] extracted nonce:', nonce)

  if (!nonce) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Could not extract nonce from sign message' }
    })
  }

  // 验证签名
  const isValid = await verifySiweMessage(
    { address: walletAddress, nonce, signMessage },
    signature
  )

  console.log('[walletLogin] verify result:', isValid)

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' }
    })
  }

  // 获取或创建用户
  const user = await userService.upsertFromWallet(walletAddress)

  // 生成 JWT
  const token = await generateAccessToken(walletAddress, String(user.id))

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        wallet_address: user.wallet_address,
        username: user.username,
        reputation: user.reputation,
        tier: user.tier
      }
    }
  })
})
