// ============================================================
// Claw Universe - Task API 封装
// ============================================================

import api from './client'
import { transformTask } from './transformers'
import type {
  RawTask, RawBid, Task, TaskPublisher,
  TaskListParams,
  CreateTaskPayload,
  TaskAssignPayload,
  TaskSubmitPayload,
  TaskVerifyPayload,
} from '../types/api'

// ---------- Task 列表 ----------
export async function getTasks(params: TaskListParams = {}): Promise<{ tasks: Task[]; meta?: unknown }> {
  const res = await api.get('/tasks', { params }) as { data: RawTask[]; meta?: unknown }
  return {
    tasks: res.data.map((raw) => transformTask(raw)),
    meta: res.meta,
  }
}

// ---------- 当前用户任务 ----------
export async function getMyTasks(params?: { role?: 'creator' | 'worker'; page?: number }): Promise<{ tasks: Task[]; meta?: unknown }> {
  const res = await api.get('/tasks/my', {
    params: { role: params?.role ?? 'creator', page: params?.page ?? 1, limit: 20 },
  }) as { data: RawTask[]; meta?: unknown }
  return {
    tasks: res.data.map((raw) => transformTask(raw)),
    meta: res.meta,
  }
}

// ---------- 任务详情 ----------
export async function getTask(id: string): Promise<Task> {
  const res = await api.get(`/tasks/${id}`) as { data: RawTask }
  return transformTask(res.data)
}

// ---------- 任务详情 + 投标列表（并行） ----------
export async function getTaskDetail(id: string, publisher?: TaskPublisher): Promise<{ task: Task; bids: RawBid[] }> {
  const [taskRes, bidsRes] = await Promise.all([
    api.get(`/tasks/${id}`) as Promise<{ data: RawTask }>,
    api.get(`/tasks/${id}/bids`) as Promise<{ data: RawBid[] }>,
  ])
  return {
    task: transformTask(taskRes.data, publisher),
    bids: bidsRes.data,
  }
}

// ---------- 创建任务 ----------
export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const res = await api.post('/tasks', payload) as { data: RawTask }
  return transformTask(res.data)
}

// ---------- 分配/开始/提交/验收/取消 ----------
export async function assignTask(id: string, payload: TaskAssignPayload): Promise<void> {
  await api.post(`/tasks/${id}/assign`, payload)
}
export async function startTask(id: string): Promise<void> {
  await api.post(`/tasks/${id}/start`)
}
export async function submitTask(id: string, payload?: TaskSubmitPayload): Promise<void> {
  await api.post(`/tasks/${id}/submit`, payload ?? {})
}
export async function verifyTask(id: string, payload: TaskVerifyPayload): Promise<void> {
  await api.post(`/tasks/${id}/verify`, payload)
}
export async function cancelTask(id: string): Promise<void> {
  await api.post(`/tasks/${id}/cancel`)
}

// ---------- 任务投标列表 ----------
export async function getTaskBids(id: string): Promise<RawBid[]> {
  const res = await api.get(`/tasks/${id}/bids`) as { data: RawBid[] }
  return res.data ?? []
}
// Re-export from bid.ts for backwards compatibility
export { createBid } from './bid'
