/**
 * Claw Universe - Anchor Client
 * Direct Solana blockchain client for task_contract program on Devnet
 *
 * Program ID: EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C
 * Network:     devnet
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { Program, Idl, AnchorProvider, Provider, Wallet } from '@coral-xyz/anchor'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import BN from 'bn.js'
import idlRaw from './idl.json'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVNET_RPC = 'https://api.devnet.solana.com'
export const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C')

// ─── Connection & Program ─────────────────────────────────────────────────────

export const connection = new Connection(DEVNET_RPC, 'confirmed')

/** Anchor IDL cast through unknown to satisfy TypeScript strictness */
const idl = idlRaw as unknown as Idl

/**
 * Shared read-only provider (used for account fetching without a signer).
 * Memoised so it is created only once.
 */
let _readOnlyProvider: Provider | null = null
function getReadOnlyProvider(): Provider {
  if (!_readOnlyProvider) {
    // Uses a no-op keypair as the signer — safe for read-only calls
    _readOnlyProvider = new AnchorProvider(connection, {
      publicKey: PublicKey.default,
      signTransaction: async <T extends Transaction>(tx: T) => tx,
      signAllTransactions: async <T extends Transaction>(txs: T[]) => txs,
    } as never, { commitment: 'confirmed' })
  }
  return _readOnlyProvider
}

/**
 * Build a Program instance from an optional wallet.
 * If no wallet is provided, returns a read-only program instance.
 *
 * wallet must implement the Wallet interface from @solana/wallet-adapter
 * (e.g. Phantom, Solflare, etc.)
 */
export function getProgram(
  wallet?: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    signAllTransactions?: <T extends Transaction>(txs: T[]) => Promise<T[]>
    publicKey: PublicKey
  } | null,
) {
  // ─── structuredClone proxy ─────────────────────────────────────────────────
  // Anchor SDK 0.32+ calls structuredClone internally in new Program().
  // The IDL object contains BigInt values which fail structuredClone.
  // We intercept the clone call for the IDL specifically and return it as-is
  // (Anchor SDK just needs the object shape, not a deep clone for reading).
  const _origClone = globalThis.structuredClone
  globalThis.structuredClone = <T,>(obj: T): T => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && (obj as unknown as Record<string, unknown>)['version'] === '0.1.0') {
      // IDL object — return as-is, bypass structuredClone entirely
      return obj
    }
    try {
      return _origClone(obj)
    } catch {
      // For non-IDL objects (e.g. AnchorProvider/wallet) that contain
      // functions, return undefined so Anchor SDK skips the path that fails
      return undefined as unknown as T
    }
  }

  try {
    if (!wallet) {
      return new Program(idl, getReadOnlyProvider())
    }
    const anchorWallet = wallet as unknown as Wallet
    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    })
    return new Program(idl, provider)
  } finally {
    globalThis.structuredClone = _origClone
  }
}

// ─── Standardised Chain Error Classifier (H4 fix) ──────────────────────────

/**
 * Classifies raw Anchor/Solana errors into user-friendly messages with error codes.
 * Used by all 13 chain-operation functions to provide consistent error feedback.
 */
export function classifyChainError(err: unknown): { userMsg: string; code: string } {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('INSUFFICIENT_BALANCE') || msg.includes('insufficient') || msg.includes('not enough sol') || msg.includes('balance too low')) {
    return { userMsg: '余额不足，请先领取 SOL 空投', code: 'INSUFFICIENT_BALANCE' }
  }
  if (msg.includes('WALLET_NOT_CONNECTED') || msg.includes('wallet not connected') || msg.includes('missing signer')) {
    return { userMsg: '请先连接钱包', code: 'WALLET_NOT_CONNECTED' }
  }
  if (msg.includes('User rejected') || msg.includes('user rejected') || msg.includes('Transaction rejected')) {
    return { userMsg: '交易已取消', code: 'USER_REJECTED' }
  }
  if (msg.includes('timeout') || msg.includes('Timed out')) {
    return { userMsg: '交易超时，请重试', code: 'TIMEOUT' }
  }
  if (msg.includes('0x1') || msg.includes('already')) {
    return { userMsg: '该任务标题已存在（链上 PDA 重复），请更换标题后重试', code: 'ALREADY_EXECUTED' }
  }
  return { userMsg: `交易失败: ${msg.slice(0, 80)}`, code: 'UNKNOWN' }
}

// ─── PDA Derivation Helpers ───────────────────────────────────────────────────

/** Platform treasury PDA: seeds = [platform_treasury] */
export function findTreasuryPda(): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync([Buffer.from('platform_treasury')], PROGRAM_ID)
  if (bump === undefined) throw new Error('Treasury PDA derivation failed')
  return pda
}

/** Agent profile PDA: seeds = [agent_profile, owner] */
export function findAgentProfilePda(owner: PublicKey): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent_profile'), owner.toBuffer()],
    PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('AgentProfile PDA derivation failed')
  return pda
}

/** Task PDA: seeds = [task, creator, title_hash[0..8]] */
import { sha256 } from '@noble/hashes/sha2.js'

function hashTitle(title: string): Buffer {
  const hash = sha256(new TextEncoder().encode(title))
  return Buffer.from(hash).slice(0, 8)
}

export function findTaskPda(creator: PublicKey, title: string): PublicKey {
  const titleHash = hashTitle(title)
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('task'), creator.toBuffer(), titleHash],
    PROGRAM_ID,
  )
  return pda
}

export function getTaskBump(creator: PublicKey, title: string): number {
  const titleHash = hashTitle(title)
  const [, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('task'), creator.toBuffer(), titleHash],
    PROGRAM_ID,
  )
  return bump
}

/** Task escrow PDA: seeds = [escrow, task] */
export function findEscrowPda(task: PublicKey): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), task.toBuffer()],
    PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('Escrow PDA derivation failed')
  return pda
}

/** Bid PDA: seeds = [bid, task, bidder] */
export function findBidPda(task: PublicKey, bidder: PublicKey): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('bid'), task.toBuffer(), bidder.toBuffer()],
    PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('Bid PDA derivation failed')
  return pda
}

/** Token escrow PDA: seeds = [token_escrow, task] */
export function findTokenEscrowPda(task: PublicKey): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_escrow'), task.toBuffer()],
    PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('TokenEscrow PDA derivation failed')
  return pda
}

/** Escrow token account (ATA of token_escrow PDA): seeds = [token_escrow, task, "token"] */
export function findEscrowTokenAccountPda(task: PublicKey): { pda: PublicKey; bump: number } {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_escrow'), task.toBuffer(), Buffer.from('token')],
    PROGRAM_ID,
  )
  return { pda, bump }
}

// ─── Instruction Callers ───────────────────────────────────────────────────────

/**
 * initialize_platform — one-time call to bootstrap the platform treasury.
 */
export async function initializePlatform(wallet: {
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
  publicKey: PublicKey
}): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const treasury = findTreasuryPda()
  try {
    return await program.methods.initializePlatform().accounts({
      authority: wallet.publicKey,
      treasury,
      systemProgram: PublicKey.default,
    } as never).rpc()
  } catch (err) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] initialize error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * initializeWorkerProfile — create an agent profile for the signing wallet.
 * Contract instruction: initialize_worker_profile (no args).
 * Profile stores reputation, tier, skills, earnings on-chain.
 * Name/skills metadata stored locally in localStorage.
 */
export async function initializeWorkerProfile(wallet: {
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>
  publicKey: PublicKey
}): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const workerProfile = findAgentProfilePda(wallet.publicKey)
  try {
    return await program.methods.initializeWorkerProfile().accounts({
      owner: wallet.publicKey,
      workerProfile,
      systemProgram: PublicKey.default,
    } as never).rpc()
  } catch (err) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] initializeWorkerProfile error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * create_task — create a new task and fund its escrow atomically.
 *
 * @param title               Task title (max 100 chars)
 * @param description         Task description (max 1000 chars)
 * @param requiredSkills      List of required skill tags (max 10)
 * @param reward              Reward in lamports (must be > 0)
 * @param verificationPeriod  Seconds from now until verification deadline
 *                            (min 7 days / 604800, max 30 days / 2592000)
 */
export async function createTask(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  title: string,
  description: string,
  requiredSkills: string[],
  reward: number,
  verificationPeriod: number,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  if (!reward || reward <= 0) throw new Error('INVALID_AMOUNT')
  const program = getProgram(wallet)
  const task = findTaskPda(wallet.publicKey, title)
  const escrow = findEscrowPda(task)
  try {
    return await program.methods
      .createTask(title, description, requiredSkills, new BN(reward), new BN(verificationPeriod))
      .accounts({
        creator: wallet.publicKey,
        task,
        escrow,
        clock: new PublicKey('SysvarC1ock11111111111111111111111111111111'),
        systemProgram: PublicKey.default,
      } as never)
      .rpc()
  } catch (err) {
    // Log transaction simulation details if available
    if (err && typeof err === 'object' && 'transactionLogs' in err) {
      console.error('[anchorClient] createTask simulation logs:', (err as any).transactionLogs)
    }
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] createTask error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * create_task_token — create a new task with SPL Token (UNICLAW) reward.
 * Uses TokenEscrow PDA instead of SOL escrow.
 *
 * @param title               Task title (max 100 chars)
 * @param description         Task description (max 1000 chars)
 * @param requiredSkills      List of required skill tags (max 10)
 * @param reward              Reward in token smallest unit (must be > 0)
 * @param verificationPeriod  Seconds from now until verification deadline
 * @param tokenMint           SPL Token mint address (UNICLAW)
 */
export async function createTaskToken(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  title: string,
  description: string,
  requiredSkills: string[],
  reward: number,
  verificationPeriod: number,
  tokenMint: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  if (!reward || reward <= 0) throw new Error('INVALID_AMOUNT')
  const program = getProgram(wallet)
  const task = findTaskPda(wallet.publicKey, title)

  // Token escrow PDA: seeds = [token_escrow, task]
  const [tokenEscrow] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_escrow'), task.toBuffer()],
    PROGRAM_ID,
  )

  // Escrow token account PDA: seeds = [token_escrow, task, "token"]
  const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_escrow'), task.toBuffer(), Buffer.from('token')],
    PROGRAM_ID,
  )

  // Get creator's associated token account for the UNICLAW mint
  const { getAssociatedTokenAddressSync } = await import('@solana/spl-token')
  const creatorTokenAccount = getAssociatedTokenAddressSync(tokenMint, wallet.publicKey)

  try {
    return await program.methods
      .createTaskToken(title, description, requiredSkills, new BN(reward), new BN(verificationPeriod), tokenMint)
      .accounts({
        creator: wallet.publicKey,
        task,
        tokenEscrow,
        creatorTokenAccount,
        escrowTokenAccount,
        tokenMint,
        tokenProgram: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
        clock: new PublicKey('SysvarC1ock11111111111111111111111111111111'),
        systemProgram: PublicKey.default,
        rent: PublicKey.default,
      } as never)
      .rpc()
  } catch (err) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] createTaskToken error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * assign_task — manually assign a worker (bypasses the bid flow).
 * Worker must sign the transaction to consent.
 */
export async function assignTask(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
  worker: PublicKey,
  workerProfile: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  try {
    return await program.methods.assignTask().accounts({
      creator: wallet.publicKey,
      worker,
      workerProfile,
      task,
    } as never).rpc()
  } catch (err) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] assignTask error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * submit_bid — worker places a bid on an open task with a deposit.
 *
 * @param proposal  Cover letter / bid proposal (max 500 chars)
 * @param deposit   Good-faith deposit in lamports (min 100_000 = 0.0001 SOL)
 */
export async function submitBid(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
  proposal: string,
  deposit: number,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  if (!deposit || deposit <= 0) throw new Error('INVALID_AMOUNT')
  const program = getProgram(wallet)
  const bid = findBidPda(task, wallet.publicKey)
  const [bidEscrow, bidEscrowBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('bid_escrow'), bid.toBuffer()],
    PROGRAM_ID,
  )
  if (bidEscrowBump === undefined) throw new Error('BidEscrow PDA derivation failed')
  try {
    return await program.methods.submitBid(proposal, new BN(deposit)).accounts({
      bidder: wallet.publicKey,
      bid,
      bidEscrow,
      task,
      systemProgram: PublicKey.default,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] submitBid error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * withdraw_bid — cancel an active bid and reclaim the deposit.
 */
export async function withdrawBid(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const bid = findBidPda(task, wallet.publicKey)
  const [bidEscrow, withdrawBidEscrowBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('bid_escrow'), bid.toBuffer()],
    PROGRAM_ID,
  )
  if (withdrawBidEscrowBump === undefined) throw new Error('BidEscrow PDA derivation failed')
  try {
    return await program.methods.withdrawBid().accounts({
      bidder: wallet.publicKey,
      bid,
      task,
      bidEscrow,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] withdrawBid error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * accept_bid — creator accepts a bid. Winning deposit is transferred to treasury as a
 * performance guarantee. Refunded (方案A) when worker completes task or wins dispute.
 */
export async function acceptBid(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  bid: PublicKey,
  task: PublicKey,
  workerProfile: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const treasury = findTreasuryPda()
  const [bidEscrow, acceptBidEscrowBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('bid_escrow'), bid.toBuffer()],
    PROGRAM_ID,
  )
  if (acceptBidEscrowBump === undefined) throw new Error('BidEscrow PDA derivation failed')
  try {
    return await program.methods.acceptBid().accounts({
      creator: wallet.publicKey,
      bid,
      task,
      treasury,
      workerProfile,
      bidEscrow,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] acceptBid error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * reject_bid — creator rejects a specific bid. Deposit returned to bidder.
 */
export async function rejectBid(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  bid: PublicKey,
  task: PublicKey,
  bidder: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const [bidEscrow, rejectBidEscrowBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('bid_escrow'), bid.toBuffer()],
    PROGRAM_ID,
  )
  if (rejectBidEscrowBump === undefined) throw new Error('BidEscrow PDA derivation failed')
  try {
    return await program.methods.rejectBid().accounts({
      creator: wallet.publicKey,
      bid,
      bidder,
      task,
      bidEscrow,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] rejectBid error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * start_task — worker signals they are beginning work.
 * Task must be in Assigned state.
 */
export async function startTask(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  try {
    return await program.methods.startTask().accounts({
      worker: wallet.publicKey,
      task,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] startTask error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * submit_task — worker submits deliverables.
 * Task moves to Completed state, starting the verification countdown.
 */
export async function submitTask(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  try {
    return await program.methods.submitTask().accounts({
      worker: wallet.publicKey,
      task,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] submitTask error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * verify_task — creator approves or rejects submitted work.
 *
 * @param approved true  → pay worker, task verified
 *                 false → return task to InProgress (worker can resubmit)
 */
export async function verifyTask(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
  worker: PublicKey,
  workerProfile: PublicKey,
  approved: boolean,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const escrow = findEscrowPda(task)
  const treasury = findTreasuryPda()
  try {
    return await program.methods.verifyTask(approved).accounts({
      creator: wallet.publicKey,
      worker,
      task,
      escrow,
      treasury,
      workerProfile,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] verifyTask error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * verify_task_token — verify a task with SPL Token (UNICLAW) reward.
 * Transfers reward tokens to worker and fee to treasury.
 *
 * @param approved true  → pay worker in UNICLAW, task verified
 *                 false → return task to InProgress
 */
export async function verifyTaskToken(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
  worker: PublicKey,
  workerProfile: PublicKey,
  tokenMint: PublicKey,
  approved: boolean,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const treasury = findTreasuryPda()

  // Token escrow PDA
  const [tokenEscrow] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_escrow'), task.toBuffer()],
    PROGRAM_ID,
  )

  // Escrow token account PDA
  const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_escrow'), task.toBuffer(), Buffer.from('token')],
    PROGRAM_ID,
  )

  // Worker & Treasury token accounts
  const { getAssociatedTokenAddressSync } = await import('@solana/spl-token')
  const workerTokenAccount = getAssociatedTokenAddressSync(tokenMint, worker)
  const treasuryTokenAccount = getAssociatedTokenAddressSync(tokenMint, treasury, true)

  try {
    return await program.methods
      .verifyTaskToken(approved)
      .accounts({
        creator: wallet.publicKey,
        worker,
        task,
        tokenEscrow,
        escrowTokenAccount,
        workerTokenAccount,
        treasuryTokenAccount,
        treasury,
        workerProfile,
        tokenProgram: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
      } as never)
      .rpc()
  } catch (err) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] verifyTaskToken error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * cancel_task — creator cancels a Created or Assigned task.
 * Any escrowed funds are returned to the creator.
 */
export async function cancelTask(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const escrow = findEscrowPda(task)
  try {
    return await program.methods.cancelTask().accounts({
      creator: wallet.publicKey,
      task,
      escrow,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] cancelTask error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * dispute_task — worker claims reward after verification deadline expires
 * without creator action. Task must be Completed and past deadline.
 */
export async function disputeTask(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
  workerProfile: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const escrow = findEscrowPda(task)
  try {
    return await program.methods.disputeTask().accounts({
      worker: wallet.publicKey,
      task,
      escrow,
      workerProfile,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] disputeTask error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

export async function cancelTaskToken(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
  tokenMint: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const tokenEscrow = findTokenEscrowPda(task)
  const escrowTokenAccount = findEscrowTokenAccountPda(task).pda
  const creatorTokenAccount = getAssociatedTokenAddressSync(tokenMint, wallet.publicKey)
  try {
    return await program.methods.cancelTaskToken().accounts({
      creator: wallet.publicKey,
      task,
      tokenEscrow,
      escrowTokenAccount,
      creatorTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] cancelTaskToken error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

export async function disputeTaskToken(
  wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  },
  task: PublicKey,
  worker: PublicKey,
  tokenMint: PublicKey,
  workerProfile: PublicKey,
): Promise<string> {
  if (!wallet?.publicKey) throw new Error('WALLET_NOT_CONNECTED')
  const program = getProgram(wallet)
  const tokenEscrow = findTokenEscrowPda(task)
  const escrowTokenAccount = findEscrowTokenAccountPda(task).pda
  const workerTokenAccount = getAssociatedTokenAddressSync(tokenMint, worker)
  const treasuryPda = findTreasuryPda()
  const treasuryTokenAccount = getAssociatedTokenAddressSync(tokenMint, treasuryPda, true)
  try {
    return await program.methods.disputeTaskToken().accounts({
      worker: wallet.publicKey,
      task,
      tokenEscrow,
      escrowTokenAccount,
      workerTokenAccount,
      treasuryTokenAccount,
      treasury: treasuryPda,
      workerProfile,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as never).rpc()
  } catch (err: unknown) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] disputeTaskToken error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

// ─── Account Fetch Helpers ───────────────────────────────────────────────────

// Access accounts via [key as keyof Program['account']] to avoid
// TypeScript not inferring the account namespace from the Idl generic.
// All these functions are read-only and do NOT require a signer.

/** Fetch a Task account */
export async function fetchTask(task: PublicKey) {
  const program = getProgram()
  const acc = program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>
  return acc.task.fetch(task)
}

/** Fetch an AgentProfile account */
export async function fetchAgentProfile(profile: PublicKey) {
  const program = getProgram()
  const acc = program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>
  return acc.agentProfile.fetch(profile)
}

/** Fetch a Bid account */
export async function fetchBid(bid: PublicKey) {
  const program = getProgram()
  const acc = program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>
  return acc.bid.fetch(bid)
}

/** Fetch a TaskEscrow account */
export async function fetchEscrow(escrow: PublicKey) {
  const program = getProgram()
  const acc = program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>
  return acc.taskEscrow.fetch(escrow)
}

/** Fetch the PlatformTreasury account */
export async function fetchTreasury(treasury: PublicKey) {
  const program = getProgram()
  const acc = program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>
  return acc.platformTreasury.fetch(treasury)
}

/** Fetch ALL Bid accounts for a specific bidder via getProgramAccounts (bypasses Anchor SDK structuredClone) */
export async function fetchBidsByBidder(bidderPk: PublicKey): Promise<Array<{ pubkey: string; data: Record<string, unknown> }>> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: 200 },
      { memcmp: { offset: 41, bytes: bidderPk.toBase58() } }, // bidder at offset 41 (8 disc + 32 pubkey)
    ],
  })
  // Manual Borsh layout for bid account (matches IDL)
  const { struct, u64, u8, i64, publicKey, str } = await import('@coral-xyz/borsh')
  const BID_LAYOUT = struct([
    publicKey('task'),
    publicKey('bidder'),
    str('proposal'),
    u64('deposit'),
    u8('status'),
    i64('createdAt'),
    u8('bump'),
  ])
  const results = []
  for (const { pubkey, account } of accounts) {
    try {
      const raw = BID_LAYOUT.decode(account.data.slice(8))
      const decoded: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw)) {
        decoded[k] = (v && typeof v === 'object' && typeof (v as any).toString === 'function' && (v as any)._bn !== undefined)
          ? (v as any).toString()
          : v
      }
      results.push({ pubkey: pubkey.toBase58(), data: decoded })
    } catch { /* skip invalid accounts */ }
  }
  return results
}

/** Fetch ALL Task accounts from the program (devnet scan) */
export async function fetchAllTasks(): Promise<unknown[]> {
  const program = getProgram()
  const acc = program.account as Record<string, { fetch: (pk: PublicKey) => Promise<unknown> }>
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: 800 }],
  })
  const results = await Promise.allSettled(
    accounts.map(({ pubkey }) => acc.task.fetch(pubkey))
  )
  return results
    .filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled')
    .map(r => r.value)
}

// ─── Event Listeners ─────────────────────────────────────────────────────────

export function addTaskCreatedListener(
  callback: (event: { task: PublicKey; creator: PublicKey; reward: number; title: string }) => void,
) {
  const program = getProgram()
  return program.addEventListener('TaskCreated' as never, callback as never)
}

export function addBidEventListener(
  callback: (event: { bid: PublicKey; task: PublicKey; bidder: PublicKey; deposit: number }) => void,
) {
  const program = getProgram()
  return program.addEventListener('BidSubmitted' as never, callback as never)
}

export function addTaskVerifiedListener(
  callback: (event: { task: PublicKey; worker: PublicKey; approved: boolean }) => void,
) {
  const program = getProgram()
  return program.addEventListener('TaskVerified' as never, callback as never)
}
