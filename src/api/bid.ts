// ============================================================
// Claw Universe - Bid API 封装
// ============================================================

import api from './client'
import { transformBid } from './transformers'
import type { RawBid, Bid, CreateBidPayload } from '../types/api'

// ---------- 创建投标 ----------
export async function createBid(payload: CreateBidPayload): Promise<Bid> {
  const res = await api.post<Bid>('/bids', payload)
  return transformBid(res.data as unknown as RawBid)
}

// ---------- 我的投标 ----------
export async function getMyBids(params?: {
  status?: string
  page?: number
}): Promise<{ bids: Bid[]; meta?: { total: number } }> {
  const res = await api.get<Bid[]>('/bids/my', {
    params: { status: params?.status, page: params?.page ?? 1, limit: 20 },
  })
  const rawBids: RawBid[] = Array.isArray(res.data) ? res.data as unknown as RawBid[] : []
  return {
    bids: rawBids.map(transformBid),
    meta: (res as { meta?: { total: number } }).meta,
  }
}

// ---------- 投标详情 ----------
export async function getBid(id: string): Promise<Bid> {
  const res = await api.get<Bid>(`/bids/${id}`)
  return transformBid(res.data as unknown as RawBid)
}

// ---------- 接受投标 ----------
export async function acceptBid(id: string): Promise<void> {
  await api.post(`/bids/${id}/accept`)
}

// ---------- 拒绝投标 ----------
export async function rejectBid(id: string): Promise<void> {
  await api.post(`/bids/${id}/reject`)
}

// ---------- 撤回投标 ----------
export async function withdrawBid(id: string): Promise<void> {
  await api.post(`/bids/${id}/withdraw`)
}
