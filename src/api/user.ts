// ============================================================
// Claw Universe - User API 封装
// ============================================================

import api from './client'
import { transformUser } from './transformers'
import type { RawUser, User, UpdateUserPayload, LeaderboardEntry } from '../types/api'

// ---------- 当前用户信息 ----------
export async function getCurrentUser(): Promise<User> {
  const res = await api.get<User>('/users/me')
  return transformUser(res.data as unknown as RawUser)
}

// ---------- 更新个人资料 ----------
export async function updateProfile(payload: UpdateUserPayload): Promise<User> {
  const res = await api.patch<User>('/users/me', payload)
  return transformUser(res.data as unknown as RawUser)
}

// ---------- 按钱包查询用户 ----------
export async function getUserByWallet(wallet: string): Promise<User> {
  const res = await api.get<User>(`/users/${wallet}`)
  return transformUser(res.data as unknown as RawUser)
}

// ---------- 获取 nonce ----------
export async function getNonce(wallet: string): Promise<string> {
  const res = await api.get<{ nonce: string }>('/users/nonce', { params: { wallet } })
  return (res.data as { nonce: string }).nonce ?? ''
}

// ---------- 排行榜 ----------
export async function getLeaderboard(params?: { page?: number; limit?: number }): Promise<{ entries: LeaderboardEntry[]; meta?: unknown }> {
  const res = await api.get<LeaderboardEntry[]>('/users/leaderboard', {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
  })
  const entries: LeaderboardEntry[] = Array.isArray(res.data) ? res.data : []
  return { entries, meta: (res as { meta?: unknown }).meta }
}

// ---------- SOL 余额 ----------
export async function getSolBalance(wallet: string): Promise<{ balance: number; escrow: number }> {
  const res = await api.get<{ balance: string; escrow_balance: string }>(`/users/${wallet}/balance`)
  const raw = res.data as { balance: string; escrow_balance: string }
  return {
    balance: parseFloat(raw?.balance ?? '0'),
    escrow: parseFloat(raw?.escrow_balance ?? '0'),
  }
}

// ---------- 交易历史 ----------
export async function getTransactions(wallet: string, params?: { page?: number; limit?: number }): Promise<{ transactions: unknown[]; meta?: unknown }> {
  const res = await api.get<unknown[]>(`/users/${wallet}/transactions`, {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 50 },
  })
  return {
    transactions: Array.isArray(res.data) ? res.data : [],
    meta: (res as { meta?: unknown }).meta,
  }
}
