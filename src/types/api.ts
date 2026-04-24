// ============================================================
// Claw Universe - API TypeScript Type Definitions
// ============================================================

// ---------- API Response Wrapper ----------
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

// ---------- Task Types ----------

/** 后端 TaskStatus 枚举 */
export enum BackendTaskStatus {
  Created = 'created',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Verified = 'verified',
  Cancelled = 'cancelled',
}

/** 前端 TaskStatus 枚举（与 mock 数据对齐） */
export type FrontendTaskStatus = 'open' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'cancelled' | 'disputed'

/** 后端原始 Task 实体（snake_case） */
export interface RawTask {
  id: string
  creator_wallet: string
  worker_wallet: string | null
  title: string
  description: string
  required_skills: string[]
  status: BackendTaskStatus
  reward: string
  verification_deadline: string
  submission_time: string | null
  verification_time: string | null
  worker_reputation_at_assignment: number | null
  created_at: string
  updated_at: string
  // 后端可选补充字段（如果已添加）
  category?: string
  bid_count?: number
  min_bid_amount?: string
  max_bid_amount?: string
  acceptance_criteria?: string
}

/** 前端 Task 类型（camelCase + 派生字段） */
export interface Task {
  id: string
  title: string
  description: string
  reward: number
  status: FrontendTaskStatus
  deadline: string
  verification_deadline?: string
  category: string
  skills: string[]
  createdAt: string
  bids: number
  bidRange: { min: number; max: number }
  publisher: TaskPublisher | null
  worker?: TaskPublisher | null  // Added for assigned worker
  acceptanceCriteria?: string[]
  paymentType?: PaymentType
  tokenMint?: string
}

export interface TaskPublisher {
  address: string
  reputation: number
  tasksCompleted: number
  tasksFailed: number
  joinedDays: number
}

/** Task 列表查询参数 */
export interface TaskListParams {
  status?: BackendTaskStatus
  skills?: string
  page?: number
  limit?: number
}

/** 创建任务请求体 */
export interface CreateTaskPayload {
  title: string
  description: string
  required_skills: string[]
  reward: string
  verification_period?: number
}

/** Task 操作请求体 */
export interface TaskAssignPayload {
  worker_wallet: string
}

export interface TaskSubmitPayload {
  submission_url?: string
}

export interface TaskVerifyPayload {
  result: 'approve' | 'reject'
  reason?: string
}

// ---------- User Types ----------

/** 后端原始 User 实体（snake_case） */
export interface RawUser {
  id: string
  wallet_address: string
  email: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  reputation: number
  tier: string
  skills: string[]
  tasks_completed: number
  tasks_failed: number
  total_earnings: string
  created_at: string
  updated_at: string
  // 后端可选补充字段
  tasks_posted_count?: number
  available_skills?: string[]
}

/** 前端 User 类型 */
export interface User {
  address: string
  reputation: number
  rank: string
  memberSince: string
  totalEarned: number
  tasksCompleted: number
  tasksFailed: number
  tasksPosted: number
  successRate: number
  bio: string | null
  skills: string[]
  avatarUrl: string | null
  username: string | null
}

/** 更新用户资料请求体 */
export interface UpdateUserPayload {
  username?: string
  bio?: string
  skills?: string[]
}

/** 排行榜条目 */
export interface LeaderboardEntry {
  rank: number
  wallet_address: string
  username: string | null
  avatar_url: string | null
  reputation: number
  tier: string
  tasks_completed: number
  total_earnings: string
}

// ---------- Bid Types ----------

/** 后端原始 Bid 实体（snake_case） */
export interface RawBid {
  id: string
  task_id: string
  bidder_wallet: string
  amount: string
  proposal: string
  estimated_duration: string
  status: BidStatus
  created_at: string
  updated_at: string
}

export enum BidStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn',
}

/** 前端 Bid 类型 */
export interface Bid {
  id: string
  taskId: string
  bidderAddress: string
  bidAmount: number
  proposal: string
  estimatedDuration: string
  status: BidStatus
  createdAt: string
}

/** 创建投标请求体 */
export interface CreateBidPayload {
  task_id: string
  amount: string
  proposal: string
  estimated_duration: string
}

// ---------- Wallet Types ----------

export interface WalletBalance {
  wallet_address: string
  balance: string
  escrow_balance: string
}

export interface Transaction {
  id: string
  type: 'transfer_in' | 'transfer_out' | 'escrow_deposit' | 'escrow_release' | 'escrow_refund'
  amount: string
  counterparty: string
  tx_signature: string
  timestamp: string
  memo?: string
}

// ---------- Chain-onchain Types ----------

/** Raw Task account as returned by Anchor */
export type PaymentType = 'sol' | 'token'

export interface ChainTask {
  creator: string
  worker: string
  escrow: string
  title: string
  description: string
  reward: string
  status: number
  deadline: string
  verificationDeadline: string
  submissionTime?: string
  verificationTime?: string
  skillsRequired: string
  category: string
  submissionUri: string
  bump: number
  paymentType?: PaymentType
  tokenMint?: string
}

/** Status enum mapping (matches contract lib.rs TaskStatus) */
export const CHAIN_TASK_STATUS: Record<number, FrontendTaskStatus> = {
  0: 'open',        // Created
  1: 'assigned',    // Assigned
  2: 'in_progress', // InProgress
  3: 'submitted',   // Submitted
  4: 'completed',   // Completed / Verified
  5: 'completed',   // Verified (alias)
  6: 'cancelled',   // Cancelled
  7: 'disputed',    // Disputed
}

/** Convert raw chain Task → frontend Task */
export function chainTaskToTask(pda: string, t: ChainTask): Task {
  const rewardU64 = typeof t.reward === 'string' ? t.reward : String(t.reward ?? 0)
  const isToken = t.paymentType === 'token'
  // Convert lamports/raw to human-readable (preserve decimals)
  const rewardNum = Number(rewardU64) / 1e9
  const statusNum = typeof t.status === 'number' ? t.status : parseInt(String(t.status), 10)
  const status: FrontendTaskStatus = CHAIN_TASK_STATUS[statusNum] ?? 'open'

  // Parse skills — could be comma-separated string or array
  let skills: string[] = []
  if (Array.isArray((t as any).requiredSkills)) {
    skills = (t as any).requiredSkills.filter((s: string) => s && s.trim())
  } else if (t.skillsRequired) {
    skills = t.skillsRequired.split(',').map(s => s.trim()).filter(Boolean)
  }

  const verDeadlineMs = Number(t.verificationDeadline) * 1000
  const createdAtMs = (t as any).createdAt ? Number((t as any).createdAt) * 1000 : Date.now()

  return {
    id: pda,
    title: t.title,
    description: t.description,
    reward: rewardNum,
    status,
    deadline: new Date(verDeadlineMs).toISOString().slice(0, 10),
    verification_deadline: verDeadlineMs
      ? new Date(verDeadlineMs).toISOString().slice(0, 10)
      : undefined,
    category: t.category || 'General',
    skills,
    createdAt: new Date(createdAtMs).toISOString().slice(0, 10),
    bids: 0,
    bidRange: { min: rewardNum * 0.8, max: rewardNum * 1.2 },
    publisher: t.creator ? { address: t.creator, reputation: 0, tasksCompleted: 0, tasksFailed: 0, joinedDays: 0 } : null,
    worker: t.worker && t.worker !== '11111111111111111111111111111111'
      ? { address: t.worker, reputation: 0, tasksCompleted: 0, tasksFailed: 0, joinedDays: 0 }
      : undefined,
    paymentType: isToken ? 'token' : 'sol',
    tokenMint: t.tokenMint,
  }
}

// ---------- Error Types ----------

export class ApiError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}
