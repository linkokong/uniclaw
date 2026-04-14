/**
 * Claw Universe - Anchor Client
 * Direct Solana blockchain client for task_contract program on Devnet
 *
 * Program ID: EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C
 * Network:     devnet
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { Program, Idl, AnchorProvider, Provider, Wallet } from '@coral-xyz/anchor'
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
  if (!wallet) {
    return new Program({ idl, provider: getReadOnlyProvider() })
  }
  // AnchorProvider expects its own Wallet type; cast through unknown to satisfy TS
  const anchorWallet = wallet as unknown as Wallet
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  return new Program({ idl, provider })
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
    return { userMsg: '操作已被执行，请刷新页面', code: 'ALREADY_EXECUTED' }
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

/** Task PDA: seeds = [task, creator] */
export function findTaskPda(creator: PublicKey): PublicKey {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('task'), creator.toBuffer()],
    PROGRAM_ID,
  )
  if (bump === undefined) throw new Error('Task PDA derivation failed')
  return pda
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
  try {
    return await program.methods.initializePlatform().rpc()
  } catch (err) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] initializePlatform error [${code}]:`, err)
    throw new Error(userMsg)
  }
}

/**
 * initialize_worker_profile — create an agent profile for the signing wallet.
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
  const task = findTaskPda(wallet.publicKey)
  const escrow = findEscrowPda(task)
  try {
    return await program.methods
      .createTask(title, description, requiredSkills, reward, verificationPeriod)
      .accounts({
        creator: wallet.publicKey,
        task,
        escrow,
        systemProgram: PublicKey.default,
      } as never)
      .rpc()
  } catch (err) {
    const { userMsg, code } = classifyChainError(err)
    console.error(`[anchorClient] createTask error [${code}]:`, err)
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
    return await program.methods.submitBid(proposal, deposit).accounts({
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
