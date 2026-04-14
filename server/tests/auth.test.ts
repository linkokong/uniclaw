import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals'
import { jest } from '@jest/globals'
import { generateAccessToken, generateRefreshToken, verifySiweMessage, authenticateJWT } from '../src/middleware/auth.js'
import { pool, redis } from '../src/models/index.js'
import { createTestUser, createTestNonce, generateTestWalletAddress, createTestTask } from './setup.js'
import { Request, Response } from 'express'

// Jest 全局配置
jest.setTimeout(30000)

describe('钱包签名验证', () => {
  const testWallet = generateTestWalletAddress()
  const testNonce = 'test_nonce_12345678901234567890'

  beforeAll(async () => {
    await createTestNonce(testWallet, testNonce, 10)
  })

  describe('verifySiweMessage', () => {
    test('✅ 有效的 nonce 应该验证成功', async () => {
      const result = await verifySiweMessage(
        { address: testWallet, nonce: testNonce },
        'mock_signature'
      )
      expect(result).toBe(true)
    })

    test('❌ 错误的 nonce 应该验证失败', async () => {
      const result = await verifySiweMessage(
        { address: testWallet, nonce: 'wrong_nonce' },
        'mock_signature'
      )
      expect(result).toBe(false)
    })

    test('❌ 过期的 nonce 应该验证失败', async () => {
      // 创建一个已过期的 nonce
      await pool.query(
        `INSERT INTO auth_nonces (wallet_address, nonce, expires_at, created_at)
         VALUES ($1, $2, NOW() - INTERVAL '1 minute', NOW())
         ON CONFLICT (wallet_address) DO UPDATE SET
           nonce = EXCLUDED.nonce,
           expires_at = EXCLUDED.expires_at,
           created_at = EXCLUDED.created_at`,
        [testWallet, 'expired_nonce']
      )

      const result = await verifySiweMessage(
        { address: testWallet, nonce: 'expired_nonce' },
        'mock_signature'
      )
      expect(result).toBe(false)
    })

    test('❌ 不存在的钱包地址应该验证失败', async () => {
      const result = await verifySiweMessage(
        { address: 'non_existent_wallet_address_12345678901', nonce: testNonce },
        'mock_signature'
      )
      expect(result).toBe(false)
    })
  })

  describe('Nonce 管理', () => {
    test('✅ 应该能够创建新的 nonce', async () => {
      const newWallet = generateTestWalletAddress()
      const nonce = 'new_test_nonce_123456789012345'

      await createTestNonce(newWallet, nonce, 5)

      const result = await pool.query(
        'SELECT * FROM auth_nonces WHERE wallet_address = $1 AND nonce = $2',
        [newWallet, nonce]
      )

      expect(result.rows.length).toBe(1)
      expect(result.rows[0].wallet_address).toBe(newWallet)
      expect(result.rows[0].nonce).toBe(nonce)
    })

    test('✅ nonce 应该有过期时间', async () => {
      const result = await pool.query(
        'SELECT expires_at FROM auth_nonces WHERE wallet_address = $1',
        [testWallet]
      )

      expect(result.rows.length).toBe(1)
      expect(new Date(result.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now())
    })
  })
})

describe('JWT Token', () => {
  const testWallet = generateTestWalletAddress()
  let testUser: any

  beforeAll(async () => {
    testUser = await createTestUser(testWallet, {
      email: 'jwt-test@example.com',
      username: 'jwt_test_user'
    })
  })

  describe('generateAccessToken', () => {
    test('✅ 应该能够生成有效的 access token', async () => {
      const token = await generateAccessToken(testWallet, testUser.id)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3) // JWT 格式: header.payload.signature
    })

    test('✅ token 应该包含正确的 payload', async () => {
      const token = await generateAccessToken(testWallet, testUser.id)
      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

      expect(payload.walletAddress).toBe(testWallet)
      expect(payload.userId).toBe(testUser.id)
      expect(payload.exp).toBeDefined()
      expect(payload.iat).toBeDefined()
    })

    test('❌ 没有 userId 时也应该能生成 token', async () => {
      const token = await generateAccessToken(testWallet)
      
      expect(token).toBeDefined()
      const parts = token.split('.')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      
      expect(payload.walletAddress).toBe(testWallet)
      expect(payload.userId).toBeUndefined()
    })
  })

  describe('generateRefreshToken', () => {
    test('✅ 应该能够生成刷新令牌', async () => {
      const refreshToken = await generateRefreshToken()
      
      expect(refreshToken).toBeDefined()
      expect(typeof refreshToken).toBe('string')
      expect(refreshToken.length).toBe(64) // 32 bytes = 64 hex characters
    })

    test('✅ 每次调用应该生成不同的 token', async () => {
      const token1 = await generateRefreshToken()
      const token2 = await generateRefreshToken()
      
      expect(token1).not.toBe(token2)
    })
  })

  describe('authenticateJWT middleware', () => {
    test('✅ 有效的 token 应该通过认证', async () => {
      const token = await generateAccessToken(testWallet, testUser.id)
      
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      } as unknown as Request
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response
      
      let nextCalled = false
      const next = (error?: any) => {
        nextCalled = true
        if (error) throw error
      }

      await authenticateJWT(req, res as Response, next as any)

      expect(nextCalled).toBe(true)
      expect((req as any).user).toBeDefined()
      expect((req as any).user.walletAddress).toBe(testWallet)
      expect((req as any).user.userId).toBe(testUser.id)
    })

    test('❌ 没有 authorization header 应该返回 401', async () => {
      const req = {
        headers: {}
      } as unknown as Request
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response
      
      let nextCalled = false
      const next = (error?: any) => {
        nextCalled = true
      }

      await authenticateJWT(req, res as Response, next as any)

      expect(nextCalled).toBe(false)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided'
        }
      })
    })

    test('❌ 无效的 token 应该返回 401', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid.token.here'
        }
      } as unknown as Request
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response
      
      let nextCalled = false
      const next = (error?: any) => {
        nextCalled = true
      }

      await authenticateJWT(req, res as Response, next as any)

      expect(nextCalled).toBe(false)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      })
    })

    test('❌ 没有 Bearer 前缀应该返回 401', async () => {
      const token = await generateAccessToken(testWallet, testUser.id)
      
      const req = {
        headers: {
          authorization: token // 没有 'Bearer ' 前缀
        }
      } as unknown as Request
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response
      
      let nextCalled = false
      const next = (error?: any) => {
        nextCalled = true
      }

      await authenticateJWT(req, res as Response, next as any)

      expect(nextCalled).toBe(false)
      expect(res.status).toHaveBeenCalledWith(401)
    })
  })

  describe('Refresh Token 存储', () => {
    test('✅ 应该能够存储 refresh token', async () => {
      const refreshToken = await generateRefreshToken()
      const tokenHash = Buffer.from(refreshToken).toString('sha256').slice(0, 64)
      
      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days', NOW())`,
        [testUser.id, tokenHash]
      )

      const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2',
        [testUser.id, tokenHash]
      )

      expect(result.rows.length).toBe(1)
      expect(result.rows[0].user_id).toBe(testUser.id)
      expect(result.rows[0].revoked_at).toBeNull()
    })

    test('✅ 应该能够撤销 refresh token', async () => {
      const refreshToken = await generateRefreshToken()
      const tokenHash = Buffer.from(refreshToken).toString('sha256').slice(0, 64)
      
      // 插入 token
      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days', NOW())`,
        [testUser.id, tokenHash]
      )

      // 撤销 token
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      )

      const result = await pool.query(
        'SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1',
        [tokenHash]
      )

      expect(result.rows[0].revoked_at).not.toBeNull()
    })
  })
})

describe('钱包地址验证', () => {
  test('✅ 应该接受有效的 Solana 钱包地址格式', async () => {
    // 标准 Solana 地址长度是 32-44 字符
    const validAddress = '7xKXtg2CW87d97TXJSDpbD5iBkchHpJ4m7se6UTMtGT'
    
    const user = await createTestUser(validAddress)
    
    expect(user.wallet_address).toBe(validAddress)
    expect(user.reputation).toBe(100)
  })

  test('✅ 不同的钱包地址应该能创建不同用户', async () => {
    const wallet1 = generateTestWalletAddress()
    const wallet2 = generateTestWalletAddress()
    
    const user1 = await createTestUser(wallet1, { username: 'user1' })
    const user2 = await createTestUser(wallet2, { username: 'user2' })
    
    expect(user1.id).not.toBe(user2.id)
    expect(user1.wallet_address).not.toBe(user2.wallet_address)
  })

  test('❌ 重复的钱包地址应该失败（违反唯一约束）', async () => {
    const wallet = generateTestWalletAddress()
    
    // 第一次创建应该成功
    await createTestUser(wallet, { username: 'first_user' })
    
    // 第二次创建应该失败
    await expect(createTestUser(wallet, { username: 'second_user' }))
      .rejects.toThrow()
  })
})
