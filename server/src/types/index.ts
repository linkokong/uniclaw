import { PublicKey } from '@solana/web3.js'

// User types
export interface User {
  id: string
  wallet_address: string
  email?: string
  username?: string
  avatar_url?: string
  bio?: string
  reputation: number
  tier: AgentTier
  skills: string[]
  tasks_completed: number
  tasks_failed: number
  total_earnings: string
  created_at: Date
  updated_at: Date
}

export enum AgentTier {
  Bronze = 'bronze',
  Silver = 'silver',
  Gold = 'gold',
  Platinum = 'platinum',
}

// Task types
export interface Task {
  id: string
  creator_wallet: string
  worker_wallet?: string
  title: string
  description: string
  required_skills: string[]
  status: TaskStatus
  reward: string
  verification_deadline: Date
  submission_time?: Date
  verification_time?: Date
  worker_reputation_at_assignment: number
  task_pda?: string
  tx_signature?: string
  result_url?: string
  result_description?: string
  result_attachments?: string[]
  acceptance_criteria?: string
  category?: string
  created_at: Date
  updated_at: Date
}

export enum TaskStatus {
  Created = 'created',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Verified = 'verified',
  Cancelled = 'cancelled',
}

// Bid types
export interface Bid {
  id: string
  task_id: string
  bidder_wallet: string
  amount: string
  proposal: string
  estimated_duration: number
  status: BidStatus
  created_at: Date
  updated_at: Date
}

export enum BidStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn',
}

// Transaction types
export interface Transaction {
  id: string
  signature: string
  from_address: string
  to_address: string
  amount: string
  type: TransactionType
  task_id?: string
  status: TransactionStatus
  block_time: Date
  created_at: Date
}

export enum TransactionType {
  TaskReward = 'task_reward',
  PlatformFee = 'platform_fee',
  EscrowDeposit = 'escrow_deposit',
  EscrowRefund = 'escrow_refund',
  BidDeposit = 'bid_deposit',
  Withdrawal = 'withdrawal',
}

export enum TransactionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

// Session types for Redis
export interface SessionData {
  userId: string
  walletAddress: string
  refreshTokenId: string
  createdAt: number
  expiresAt: number
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

// EIP-4361 Auth types
export interface SiweMessage {
  domain: string
  address: string
  statement?: string
  uri: string
  version: string
  chain_id: number
  nonce: string
  issued_at: string
  expiration_time?: string
}

export interface SiweSession {
  walletAddress: string
  nonce: string
  issuedAt: Date
  expiresAt: Date
}
