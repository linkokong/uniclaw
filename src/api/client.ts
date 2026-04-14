// ============================================================
// Claw Universe - API Client
// Axios 实例 + 请求/响应拦截器 + EIP-4361 钱包签名认证
// ============================================================

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { parseApiError } from './transformers'
import type { ApiResponse } from '../types/api'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const TIMEOUT = 10000

// ---------- Wallet Singleton ----------
// 在 React 上下文外访问 wallet 状态
let walletState: {
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null
  publicKey: { toBase58: () => string } | null
} = {
  signMessage: null,
  publicKey: null,
}

/**
 * 在 WalletContextProvider 初始化后调用此函数注册 wallet 实例
 * 用于在 Axios 拦截器中获取签名能力
 */
export function registerWallet(
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null,
  publicKey: { toBase58: () => string } | null
) {
  walletState = { signMessage, publicKey }
}

// ---------- Axios 实例 ----------
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ---------- 请求拦截器 ----------
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const { signMessage, publicKey } = walletState

    if (publicKey && signMessage) {
      const walletAddress = publicKey.toBase58()

      try {
        // Step 1: 获取 nonce
        const nonceRes = await axios.get(`${BASE_URL}/users/nonce`, {
          params: { wallet: walletAddress },
        })
        const nonce = (nonceRes.data as ApiResponse<{ nonce: string }>).data.nonce

        // Step 2: 构造 EIP-4361 消息
        const domain = window.location.host
        const statement = 'Sign this message to authenticate with Claw Universe.'
        const message = `${domain} wants you to sign in with your Solana account.\n\n${statement}\n\nNonce: ${nonce}`

        // Step 3: 签名
        const encodedMessage = new TextEncoder().encode(message)
        const signature = await signMessage(encodedMessage)
        const signatureBase64 = Buffer.from(signature).toString('base64')

        // Step 4: 添加认证头
        config.headers.set('X-Wallet-Address', walletAddress)
        config.headers.set('X-Signature', signatureBase64)
        config.headers.set('X-Sign-Message', message)
      } catch (err) {
        // CRITICAL FIX: reject instead of silently continuing — auth failure must not be swallowed
        return Promise.reject(new Error('Wallet authentication failed: signing was denied or unavailable'))
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ---------- 响应拦截器 ----------
api.interceptors.response.use(
  (response) => {
    // 解包 { success, data, meta } 格式
    const payload = response.data as ApiResponse<unknown>

    // 如果后端返回标准格式，把 data 提升到根级，方便调用方直接访问
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      if (!payload.success && payload.error) {
        const parsed = parseApiError({ response: { data: payload, status: response.status } })
        return Promise.reject(
          Object.assign(new Error(parsed.message), {
            code: parsed.code,
            status: parsed.status,
          })
        )
      }
      // 成功时直接返回 data 部分
      return { ...response, data: payload.data, meta: payload.meta }
    }

    return response
  },
  (error) => {
    const parsed = parseApiError(error)
    return Promise.reject(
      Object.assign(new Error(parsed.message), {
        code: parsed.code,
        status: parsed.status,
      })
    )
  }
)

// ---------- 导出 ----------
export default api
export { BASE_URL }
