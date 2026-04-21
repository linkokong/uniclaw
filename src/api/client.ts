// ============================================================
// Claw Universe - API Client
// Axios 实例 + 请求/响应拦截器 + EIP-4361 钱包签名认证
// ============================================================

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { parseApiError } from './transformers'
import type { ApiResponse } from '../types/api'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const TIMEOUT = 10000
const TOKEN_KEY = 'claw_wallet_token'

// ---------- Wallet Singleton ----------
let walletState: {
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null
  publicKey: { toBase58: () => string } | null
} = {
  signMessage: null,
  publicKey: null,
}

/**
 * 在 WalletContextProvider 初始化后调用此函数注册 wallet 实例
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

// ---------- Token 管理 ----------
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ---------- 钱包登录：签名 → 换 JWT ----------
export async function walletLogin(): Promise<string | null> {
  const { signMessage, publicKey } = walletState
  if (!publicKey || !signMessage) return null

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

    // Step 4: 调用 /auth/wallet 换取 JWT
    // Note: signMessage 放在 body 而不是 header，因为 header 会破坏换行符
    const loginRes = await axios.post(
      `${BASE_URL}/auth/wallet`,
      {
        signMessage: message,
      },
      {
        headers: {
          'X-Wallet-Address': walletAddress,
          'X-Signature': signatureBase64,
        },
      }
    )

    const token = (loginRes.data as ApiResponse<{ token: string }>).data.token
    setToken(token)
    return token
  } catch (err) {
    const axiosErr = err as any
    console.error('[api/client] Wallet login failed:', {
      message: axiosErr.message,
      status: axiosErr.response?.status,
      code: axiosErr.response?.data?.error?.code,
    })
    return null
  }
}

// ---------- 请求拦截器：带 JWT ----------
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 如果已有 token，直接用
    const token = getToken()
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
      return config
    }

    // 没有 token 但有钱包 → 尝试钱包登录
    const { signMessage, publicKey } = walletState
    if (publicKey && signMessage) {
      const token = await walletLogin()
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`)
        return config
      } else {
        console.error('[api/client] walletLogin() returned null — proceeding without auth')
      }
    } else {
      console.error('[api/client] No wallet connected — proceeding without auth')
    }

    // 无 token 无钱包 → 放行让后端返回明确错误（部分路由支持）
    return config
  },
  (error) => Promise.reject(error)
)

// ---------- 响应拦截器 ----------
api.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiResponse<unknown>

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
