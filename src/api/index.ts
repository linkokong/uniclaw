// ============================================================
// Claw Universe - API Client 层导出
// ============================================================

// 类型导出（供全项目使用）
export type {
  ApiResponse,
  RawTask,
  RawUser,
  RawBid,
  Task,
  User,
  Bid,
  TaskPublisher,
  TaskListParams,
  CreateTaskPayload,
  TaskAssignPayload,
  TaskSubmitPayload,
  TaskVerifyPayload,
  UpdateUserPayload,
  CreateBidPayload,
  LeaderboardEntry,
  WalletBalance,
  Transaction,
  ApiError,
} from '../types/api'

export { BackendTaskStatus, BidStatus } from '../types/api'

// API 封装导出
export { default as api, registerWallet, BASE_URL } from './client'

// Task API
export * as taskApi from './task'

// User API
export * as userApi from './user'

// Bid API
export * as bidApi from './bid'

// 转换工具（供页面组件直接使用）
export {
  toCamelCase,
  toSnakeCase,
  transformTask,
  transformUser,
  transformBid,
  transformTaskToPayload,
  mapBackendStatusToFrontend,
  mapFrontendStatusToBackend,
  getTierLabel,
  parseApiError,
} from './transformers'
