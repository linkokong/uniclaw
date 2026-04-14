// ============================================================
// Claw Universe - 字段转换工具
// snake_case ↔ camelCase 自动转换 + Status 枚举映射
// ============================================================

import type {
  RawTask,
  RawUser,
  RawBid,
  Task,
  User,
  Bid,
  TaskPublisher,
} from '../types/api'
import { BackendTaskStatus, FrontendTaskStatus } from '../types/api'

// Re-export all types so api files can import from ./transformers
export type { RawTask, RawUser, RawBid, Task, User, Bid, TaskPublisher }
export type { BackendTaskStatus, FrontendTaskStatus }

// ---------- snake_case → camelCase 通用工具 ----------

function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/**
 * 深度递归：将后端 snake_case 对象转换为前端 camelCase 对象
 */
export function toCamelCase<T>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase<T>(item)) as T
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[toCamel(key)] = toCamelCase(value)
    }
    return result as T
  }
  return obj as T
}

/**
 * 深度递归：将前端 camelCase 对象转换为后端 snake_case 对象
 * 忽略以大写字母开头的 key（保留为原始 key，如 WalletAddress）
 */
export function toSnakeCase<T>(obj: unknown, pascalKeys: Set<string> = new Set()): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase<T>(item, pascalKeys)) as T
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      // 如果 key 首字母大写或已在 pascalKeys 中，保留原样
      if (pascalKeys.has(key) || /^[A-Z]/.test(key)) {
        result[key] = toSnakeCase(value, pascalKeys)
      } else {
        result[toSnake(key)] = toSnakeCase(value, pascalKeys)
      }
    }
    return result as T
  }
  return obj as T
}

// ---------- Status 枚举映射 ----------

const BACKEND_TO_FRONTEND_STATUS: Record<BackendTaskStatus, FrontendTaskStatus> = {
  [BackendTaskStatus.Created]: 'open',
  [BackendTaskStatus.Assigned]: 'in_progress',
  [BackendTaskStatus.InProgress]: 'in_progress',
  [BackendTaskStatus.Completed]: 'in_progress', // 后端 completed=已提交，前端无此状态
  [BackendTaskStatus.Verified]: 'completed',
  [BackendTaskStatus.Cancelled]: 'cancelled',
}

const FRONTEND_TO_BACKEND_STATUS: Record<FrontendTaskStatus, BackendTaskStatus> = {
  open: BackendTaskStatus.Created,
  in_progress: BackendTaskStatus.InProgress,
  completed: BackendTaskStatus.Verified,
  cancelled: BackendTaskStatus.Cancelled,
}

export function mapBackendStatusToFrontend(status: string): FrontendTaskStatus {
  return BACKEND_TO_FRONTEND_STATUS[status as BackendTaskStatus] ?? (status as FrontendTaskStatus)
}

export function mapFrontendStatusToBackend(status: FrontendTaskStatus): BackendTaskStatus {
  return FRONTEND_TO_BACKEND_STATUS[status]
}

// ---------- Tier 本地化映射 ----------
const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze Worker',
  silver: 'Silver Worker',
  gold: 'Gold Worker',
  platinum: 'Platinum Worker',
  diamond: 'Diamond Worker',
}

export function getTierLabel(tier: string): string {
  return TIER_LABELS[tier.toLowerCase()] ?? tier
}

// ---------- RawTask → Task 转换 ----------
export function transformTask(raw: RawTask, publisher?: Task['publisher']): Task {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    reward: parseFloat(raw.reward),
    status: mapBackendStatusToFrontend(raw.status),
    deadline: raw.verification_deadline,
    category: raw.category ?? 'Uncategorized',
    skills: raw.required_skills ?? [],
    createdAt: raw.created_at,
    bids: raw.bid_count ?? 0,
    bidRange: {
      min: raw.min_bid_amount ? parseFloat(raw.min_bid_amount) : 0,
      max: raw.max_bid_amount ? parseFloat(raw.max_bid_amount) : 0,
    },
    publisher: publisher ?? null,
    acceptanceCriteria: raw.acceptance_criteria ? [raw.acceptance_criteria] : [],
  }
}

// ---------- Task (前端) → API 请求体 ----------
export function transformTaskToPayload(task: Partial<Task>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if (task.title !== undefined) payload.title = task.title
  if (task.description !== undefined) payload.description = task.description
  if (task.skills !== undefined) payload.required_skills = task.skills
  if (task.reward !== undefined) payload.reward = String(task.reward)
  if (task.category !== undefined) payload.category = task.category
  if (task.acceptanceCriteria !== undefined) payload.acceptance_criteria = task.acceptanceCriteria

  // verification_period 默认 7 天
  if (!payload.verification_period) payload.verification_period = 604800

  return payload
}

// ---------- RawUser → User 转换 ----------
export function transformUser(raw: RawUser): User {
  const totalCompleted = raw.tasks_completed
  const totalFailed = raw.tasks_failed
  const successRate =
    totalCompleted + totalFailed > 0
      ? Math.round((totalCompleted / (totalCompleted + totalFailed)) * 100)
      : 0


  return {
    address: raw.wallet_address,
    reputation: raw.reputation,
    rank: getTierLabel(raw.tier),
    memberSince: raw.created_at,
    totalEarned: parseFloat(raw.total_earnings),
    tasksCompleted: totalCompleted,
    tasksPosted: raw.tasks_posted_count ?? 0,
    tasksFailed: totalFailed,
    successRate,
    bio: raw.bio,
    skills: raw.skills ?? [],
    avatarUrl: raw.avatar_url,
    username: raw.username,
  }
}

// ---------- RawBid → Bid 转换 ----------
export function transformBid(raw: RawBid): Bid {
  return {
    id: raw.id,
    taskId: raw.task_id,
    bidderAddress: raw.bidder_wallet,
    bidAmount: parseFloat(raw.amount),
    proposal: raw.proposal,
    estimatedDuration: raw.estimated_duration,
    status: raw.status,
    createdAt: raw.created_at,
  }
}

// ---------- 响应拦截转换（axios interceptor 内部使用） ----------
/**
 * 将 axios 响应 data 递归转换：snake_case → camelCase
 * 适用于 { success, data: { ... } } 格式
 */
export function transformResponse<T>(response: unknown): T {
  if (Array.isArray(response)) {
    return response.map((item) => transformResponse(item)) as T
  }
  if (response !== null && typeof response === 'object') {
    const obj = response as Record<string, unknown>
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      // 特殊处理嵌套 data 字段
      if (key === 'data' && typeof value === 'object' && value !== null) {
        result[toCamel(key)] = transformResponse(value)
      } else {
        result[toCamel(key)] = toCamelCase(value)
      }
    }
    return result as T
  }
  return response as T
}

// ---------- API Error 解析 ----------
export function parseApiError(error: unknown): { code: string; message: string; status: number } {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { error?: { code?: string; message?: string } }; status?: number } }
    const resp = axiosError.response
    if (resp?.data?.error) {
      return {
        code: resp.data.error.code ?? 'UNKNOWN_ERROR',
        message: resp.data.error.message ?? 'An unknown error occurred',
        status: resp.status ?? 0,
      }
    }
    if (resp?.status) {
      return { code: 'HTTP_ERROR', message: `HTTP ${resp.status}`, status: resp.status }
    }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return { code: 'NETWORK_ERROR', message: String((error as { message: unknown }).message), status: 0 }
  }
  return { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred', status: 0 }
}
