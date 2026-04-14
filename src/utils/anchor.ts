/**
 * Claw Universe — Anchor Utilities
 * High-level wrappers around the generated Anchor client.
 * All functions expect a wallet-adapter wallet object.
 */

import { PublicKey } from '@solana/web3.js'
import {
  createTask as anchorCreateTask,
  submitBid as anchorSubmitBid,
  acceptBid as anchorAcceptBid,
  rejectBid as anchorRejectBid,
  withdrawBid as anchorWithdrawBid,
  startTask as anchorStartTask,
  submitTask as anchorSubmitTask,
  verifyTask as anchorVerifyTask,
  cancelTask as anchorCancelTask,
  disputeTask as anchorDisputeTask,
  fetchTask,
  fetchBid,
  fetchAgentProfile,
  fetchEscrow,
  fetchTreasury,
  findTaskPda,
  findBidPda,
  findEscrowPda,
  findAgentProfilePda,
  findTreasuryPda,
} from '../api/anchorClient'

export { findTaskPda, findBidPda, findEscrowPda, findAgentProfilePda, findTreasuryPda, fetchTask, fetchBid, fetchAgentProfile, fetchEscrow, fetchTreasury }

/** Canonical on-chain program ID */
export const ANCHOR_PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C')

// ─── Wallet type accepted by all functions ──────────────────────────────────
type WalletAdapter = {
  publicKey: PublicKey
  signTransaction: <T extends { signTransaction: (tx: unknown) => Promise<unknown> }>(tx: T) => Promise<T>
  signAllTransactions?: <T extends { signAllTransactions: (txs: T[]) => Promise<T[]> }>(txs: T[]) => Promise<T[]>
} | null

// ─── Create Task ─────────────────────────────────────────────────────────
/**
 * Create a new on-chain task.
 *
 * @param wallet    - Connected wallet adapter
 * @param title     - Task title (≤ 100 chars)
 * @param description - Task description (≤ 1000 chars)
 * @param requiredSkills - Up to 10 skill tags
 * @param rewardLamports - Reward in lamports (1 SOL = 1e9 lamports)
 * @param verificationPeriodSec - Seconds from now (min 7 days / 604800)
 */
export async function createTaskOnChain(
  wallet: WalletAdapter,
  title: string,
  description: string,
  requiredSkills: string[],
  rewardLamports: number,
  verificationPeriodSec: number,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorCreateTask(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    title.slice(0, 100),
    description.slice(0, 1000),
    requiredSkills.slice(0, 10),
    rewardLamports,
    verificationPeriodSec,
  )
}

// ─── Submit Bid ────────────────────────────────────────────────────────────
/**
 * Place an on-chain bid on a task.
 * Deposit is in lamports (min 100_000 lamports = 0.0001 SOL).
 *
 * @param wallet   - Bidder's wallet
 * @param taskPda - Task PDA (derived from creator + task seeds)
 * @param proposal - Cover letter (≤ 500 chars)
 * @param depositLamports - Bid deposit in lamports
 */
export async function submitBidOnChain(
  wallet: WalletAdapter,
  taskPda: PublicKey,
  proposal: string,
  depositLamports: number,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorSubmitBid(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    taskPda,
    proposal.slice(0, 500),
    depositLamports,
  )
}

// ─── Accept Bid ────────────────────────────────────────────────────────────
/**
 * Creator accepts a bid. Winning deposit is transferred to treasury as a performance
 * guarantee — it is fully refunded when the worker successfully completes the task
 * (verify_task approved=true) or wins a dispute (dispute_task).
 *
 * @param wallet        - Creator's wallet
 * @param bidPda        - Bid PDA
 * @param taskPda       - Task PDA
 * @param workerProfile - Worker profile PDA
 */
export async function acceptBidOnChain(
  wallet: WalletAdapter,
  bidPda: PublicKey,
  taskPda: PublicKey,
  workerProfile: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorAcceptBid(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    bidPda,
    taskPda,
    workerProfile,
  )
}

// ─── Reject Bid ────────────────────────────────────────────────────────────
export async function rejectBidOnChain(
  wallet: WalletAdapter,
  bidPda: PublicKey,
  taskPda: PublicKey,
  bidder: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorRejectBid(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    bidPda,
    taskPda,
    bidder,
  )
}

// ─── Withdraw Bid ─────────────────────────────────────────────────────────
export async function withdrawBidOnChain(
  wallet: WalletAdapter,
  taskPda: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorWithdrawBid(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    taskPda,
  )
}

// ─── Start Task ────────────────────────────────────────────────────────────
export async function startTaskOnChain(
  wallet: WalletAdapter,
  taskPda: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorStartTask(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    taskPda,
  )
}

// ─── Submit Task ──────────────────────────────────────────────────────────
export async function submitTaskOnChain(
  wallet: WalletAdapter,
  taskPda: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorSubmitTask(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    taskPda,
  )
}

// ─── Verify Task ───────────────────────────────────────────────────────────
export async function verifyTaskOnChain(
  wallet: WalletAdapter,
  taskPda: PublicKey,
  worker: PublicKey,
  workerProfile: PublicKey,
  approved: boolean,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorVerifyTask(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    taskPda,
    worker,
    workerProfile,
    approved,
  )
}

// ─── Cancel Task ───────────────────────────────────────────────────────────
export async function cancelTaskOnChain(
  wallet: WalletAdapter,
  taskPda: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorCancelTask(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    taskPda,
  )
}

// ─── Dispute Task ─────────────────────────────────────────────────────────
export async function disputeTaskOnChain(
  wallet: WalletAdapter,
  taskPda: PublicKey,
  workerProfile: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('Wallet not connected')
  return anchorDisputeTask(
    { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey },
    taskPda,
    workerProfile,
  )
}

// ─── Derive PDAs from task ID / creator address ───────────────────────────
/**
 * Given a creator's base58 address and a task ID (index/nonce),
 * derive the on-chain task PDA.
 *
 * For now, derive from creator pubkey — pass the task index as nonce.
 * If you track taskIndex per creator in your backend, pass it here.
 */
export function deriveTaskPda(creatorAddress: string, _taskIndex: number = 0): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('task'), new PublicKey(creatorAddress).toBuffer()],
    ANCHOR_PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('Task PDA derivation failed')
  return pda
}

/**
 * Given a task PDA and a bidder's address, derive the bid PDA.
 */
export function deriveBidPda(taskPda: PublicKey, bidderAddress: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bid'), taskPda.toBuffer(), new PublicKey(bidderAddress).toBuffer()],
    ANCHOR_PROGRAM_ID,
  )[0]
}

/**
 * Given a task creator's address, derive the task PDA (no index needed
 * for PDA — the nonce is embedded in the PDA itself).
 */
export function deriveTaskPdaFromCreator(creatorAddress: string): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('task'), new PublicKey(creatorAddress).toBuffer()],
    ANCHOR_PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('Task PDA derivation failed')
  return pda
}

/**
 * Derive a worker's agent profile PDA.
 */
export function deriveWorkerProfilePda(workerAddress: string): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent_profile'), new PublicKey(workerAddress).toBuffer()],
    ANCHOR_PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('Worker Profile PDA derivation failed')
  return pda
}

// ─── On-chain task status enum (matches IDL) ──────────────────────────────
export enum OnChainTaskStatus {
  Created   = 0,
  Assigned  = 1,
  InProgress = 2,
  Submitted = 3,
  Completed = 4,
  Verified  = 5,
  Cancelled = 6,
  Disputed  = 7,
}

export function onChainStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    [OnChainTaskStatus.Created]:   'Open',
    [OnChainTaskStatus.Assigned]:  'Assigned',
    [OnChainTaskStatus.InProgress]: 'In Progress',
    [OnChainTaskStatus.Submitted]: 'Submitted',
    [OnChainTaskStatus.Completed]: 'Completed',
    [OnChainTaskStatus.Verified]:  'Verified',
    [OnChainTaskStatus.Cancelled]: 'Cancelled',
    [OnChainTaskStatus.Disputed]:  'Disputed',
  }
  return labels[status] ?? `Unknown (${status})`
}
