/**
 * Claw Universe - E2E Smoke Test
 * 端到端烟雾测试：验证完整的任务生命周期
 * 
 * 使用 @solana/web3.js 直接调用 RPC，不依赖前端框架
 * 
 * 运行方式：
 *   npx tsx scripts/smoke-test.ts
 * 
 * 环境要求：
 *   - 配置好的 devnet keypair: ~/.config/solana/devnet-keypair.json
 *   - 足够的 devnet SOL (可运行 solana airdrop 5 获取)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  TransactionInstruction,
  SystemProgram,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import * as crypto from 'crypto'
import * as fs from 'fs'

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  RPC_URL: 'https://api.devnet.solana.com',
  PROGRAM_ID: 'EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C',
  KEYPAIR_PATH: process.env.HOME + '/.config/solana/devnet-keypair.json',
  TEST_TASK: {
    title: 'Smoke Test Task',
    description: 'This is an automated smoke test task',
    skills: ['rust', 'solana', 'testing'],
    reward: 1_000_000_000, // 1 SOL
    bidDeposit: 100_000_000, // 0.1 SOL
    proposal: 'I can complete this test in 1 second',
    verificationPeriod: 604800, // 7 days
  },
}

// ─── PDA Seeds ───────────────────────────────────────────────────────────────

const SEEDS = {
  PLATFORM_TREASURY: 'platform_treasury',
  TASK: 'task',
  ESCROW: 'escrow',
  AGENT_PROFILE: 'agent_profile',
  BID: 'bid',
  BID_ESCROW: 'bid_escrow',
}

// ─── Encoding Helpers ─────────────────────────────────────────────────────────

function getDiscriminator(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8)
}

function encodeString(s: string): Buffer {
  const buf = Buffer.from(s, 'utf8')
  const len = Buffer.alloc(4)
  len.writeUInt32LE(buf.length)
  return Buffer.concat([len, buf])
}

function encodeVecString(arr: string[]): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32LE(arr.length)
  return Buffer.concat([len, ...arr.map(s => encodeString(s))])
}

function encodeU64(n: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(n))
  return buf
}

function encodeI64(n: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigInt64LE(BigInt(n))
  return buf
}

function encodeU32(n: number): Buffer {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(n)
  return buf
}

function encodeBool(b: boolean): Buffer {
  return Buffer.from([b ? 1 : 0])
}

// ─── Transaction Sender ──────────────────────────────────────────────────────

async function sendTransaction(
  conn: Connection,
  payer: Keypair,
  name: string,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  data: Buffer,
  programId: PublicKey,
): Promise<string> {
  try {
    const ix = new TransactionInstruction({ keys, programId, data })
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
    const msg = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message()
    const tx = new VersionedTransaction(msg)
    tx.sign([payer])
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true })
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight })
    console.log(`✅ ${name}: ${sig.slice(0, 44)}...`)
    return sig
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`❌ ${name}: ${msg.slice(0, 200)}`)
    throw e
  }
}

// ─── Task Status Parser ──────────────────────────────────────────────────────

const TASK_STATUS = ['Created', 'Assigned', 'InProgress', 'Completed', 'Verified', 'Cancelled']

async function getTaskStatus(conn: Connection, taskPda: PublicKey): Promise<number | null> {
  const acct = await conn.getAccountInfo(taskPda)
  if (!acct) return null
  
  const data = acct.data
  let offset = 8 + 32 + 32 // disc + creator + worker
  
  // Skip title
  const titleLen = data.readUInt32LE(offset)
  offset += 4 + titleLen
  
  // Skip description
  const descLen = data.readUInt32LE(offset)
  offset += 4 + descLen
  
  // Skip skills vector
  const skillsCount = data.readUInt32LE(offset)
  offset += 4
  for (let i = 0; i < skillsCount; i++) {
    const skillLen = data.readUInt32LE(offset)
    offset += 4 + skillLen
  }
  
  return data[offset]
}

// ─── Profile Stats Parser ────────────────────────────────────────────────────

async function getProfileStats(
  conn: Connection,
  profilePda: PublicKey,
): Promise<{ reputation: number; tasksCompleted: number } | null> {
  const acct = await conn.getAccountInfo(profilePda)
  if (!acct) return null
  
  const data = acct.data
  // authority (32) + name (4+len) + agentType (4+len) + skills (4+len) + hourlyRate (8) + available (1)
  // Then: totalRentals (4), reputation (4)
  
  let offset = 8 + 32 // disc + authority
  offset += 4 + data.readUInt32LE(offset) // name
  offset += 4 + data.readUInt32LE(offset) // agentType
  offset += 4 + data.readUInt32LE(offset) // skills
  offset += 8 // hourlyRate
  offset += 1 // available
  offset += 4 // totalRentals
  
  const reputation = data.readUInt32LE(offset)
  const tasksCompleted = data.readUInt32LE(offset + 4)
  
  return { reputation, tasksCompleted }
}

// ─── Main Smoke Test ─────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Claw Universe - E2E Smoke Test')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Load wallet
  console.log('[Setup] Loading wallet...')
  const keydata = JSON.parse(fs.readFileSync(CONFIG.KEYPAIR_PATH, 'utf8'))
  const payer = Keypair.fromSecretKey(new Uint8Array(keydata))
  console.log(`  Wallet: ${payer.publicKey.toBase58()}\n`)

  // 2. Connect to Solana
  const conn = new Connection(CONFIG.RPC_URL, 'confirmed')
  const PID = new PublicKey(CONFIG.PROGRAM_ID)

  // 3. Check balance
  const balance = await conn.getBalance(payer.publicKey)
  console.log(`[Setup] Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`)
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log('⚠️  Low balance! Run: solana airdrop 5')
    process.exit(1)
  }

  // 4. Derive PDAs
  console.log('\n[Setup] Deriving PDAs...')
  const [treasuryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PLATFORM_TREASURY)],
    PID,
  )
  const [taskPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.TASK), payer.publicKey.toBuffer()],
    PID,
  )
  const [escrowPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.ESCROW), taskPDA.toBuffer()],
    PID,
  )
  const [profilePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.AGENT_PROFILE), payer.publicKey.toBuffer()],
    PID,
  )
  const [bidPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.BID), taskPDA.toBuffer(), payer.publicKey.toBuffer()],
    PID,
  )
  const [bidEscrowPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.BID_ESCROW), bidPDA.toBuffer()],
    PID,
  )

  console.log(`  Task: ${taskPDA.toBase58()}`)
  console.log(`  Profile: ${profilePDA.toBase58()}`)
  console.log(`  Treasury: ${treasuryPDA.toBase58()}\n`)

  // 5. Check existing task state
  const existingStatus = await getTaskStatus(conn, taskPDA)
  if (existingStatus !== null && existingStatus !== 0) {
    console.log(`⚠️  Existing task status: ${TASK_STATUS[existingStatus]}`)
    console.log('   Cannot proceed - each wallet can only have one task due to PDA constraint.')
    console.log('   Use a different wallet or reset the task.\n')
    process.exit(0)
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Initialize Agent Profile (if needed)
  // ═══════════════════════════════════════════════════════════════
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Step 1: Initialize Agent Profile')
  console.log('───────────────────────────────────────────────────────────────')

  const profileAcct = await conn.getAccountInfo(profilePDA)
  if (profileAcct) {
    console.log('✅ Profile already exists, skipping initialization\n')
  } else {
    await sendTransaction(
      conn,
      payer,
      'register_agent',
      [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      Buffer.concat([
        getDiscriminator('register_agent'),
        encodeString('Test Agent'),
        encodeString('developer'),
        encodeString('rust,solana,testing'),
        encodeU64(100_000_000), // hourly rate
      ]),
      PID,
    )
    console.log('')
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Create Task
  // ═══════════════════════════════════════════════════════════════
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Step 2: Create Task')
  console.log('───────────────────────────────────────────────────────────────')

  if (existingStatus === 0) {
    console.log('✅ Task already exists (Created), skipping creation\n')
  } else {
    await sendTransaction(
      conn,
      payer,
      'create_task',
      [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: taskPDA, isSigner: false, isWritable: true },
        { pubkey: escrowPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      Buffer.concat([
        getDiscriminator('create_task'),
        encodeString(CONFIG.TEST_TASK.title),
        encodeString(CONFIG.TEST_TASK.description),
        encodeU64(CONFIG.TEST_TASK.reward),
        encodeI64(Math.floor(Date.now() / 1000) + CONFIG.TEST_TASK.verificationPeriod),
        encodeVecString(CONFIG.TEST_TASK.skills),
        encodeString('development'),
      ]),
      PID,
    )
    console.log('')
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Submit Bid
  // ═══════════════════════════════════════════════════════════════
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Step 3: Submit Bid')
  console.log('───────────────────────────────────────────────────────────────')

  await sendTransaction(
    conn,
    payer,
    'submit_bid',
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: taskPDA, isSigner: false, isWritable: true },
      { pubkey: bidPDA, isSigner: false, isWritable: true },
      { pubkey: bidEscrowPDA, isSigner: false, isWritable: true },
      { pubkey: profilePDA, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    Buffer.concat([
      getDiscriminator('submit_bid'),
      encodeU64(CONFIG.TEST_TASK.bidDeposit),
      encodeString(CONFIG.TEST_TASK.proposal),
    ]),
    PID,
  )
  console.log('')

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Accept Bid
  // ═══════════════════════════════════════════════════════════════
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Step 4: Accept Bid')
  console.log('───────────────────────────────────────────────────────────────')

  await sendTransaction(
    conn,
    payer,
    'accept_bid',
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // creator
      { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // worker
      { pubkey: taskPDA, isSigner: false, isWritable: true },
      { pubkey: bidPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: bidEscrowPDA, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: profilePDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    getDiscriminator('accept_bid'),
    PID,
  )
  console.log('')

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Start Task
  // ═══════════════════════════════════════════════════════════════
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Step 5: Start Task')
  console.log('───────────────────────────────────────────────────────────────')

  await sendTransaction(
    conn,
    payer,
    'start_task',
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // worker
      { pubkey: taskPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: false },
    ],
    getDiscriminator('start_task'),
    PID,
  )
  console.log('')

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Submit Task
  // ═══════════════════════════════════════════════════════════════
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Step 6: Submit Task')
  console.log('───────────────────────────────────────────────────────────────')

  await sendTransaction(
    conn,
    payer,
    'submit_task',
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // worker
      { pubkey: taskPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: false },
    ],
    Buffer.concat([
      getDiscriminator('submit_task'),
      encodeString('https://github.com/example/submission'),
    ]),
    PID,
  )
  console.log('')

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: Verify Task
  // ═══════════════════════════════════════════════════════════════
  console.log('───────────────────────────────────────────────────────────────')
  console.log('  Step 7: Verify Task (Approved)')
  console.log('───────────────────────────────────────────────────────────────')

  await sendTransaction(
    conn,
    payer,
    'verify_task',
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // creator
      { pubkey: payer.publicKey, isSigner: false, isWritable: true }, // worker
      { pubkey: taskPDA, isSigner: false, isWritable: true },
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: profilePDA, isSigner: false, isWritable: true },
    ],
    Buffer.concat([getDiscriminator('verify_task'), encodeBool(true)]),
    PID,
  )
  console.log('')

  // ═══════════════════════════════════════════════════════════════
  // Final State Verification
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Final State')
  console.log('═══════════════════════════════════════════════════════════════')

  const finalStatus = await getTaskStatus(conn, taskPDA)
  console.log(`  Task Status: ${finalStatus !== null ? TASK_STATUS[finalStatus] : 'N/A'}`)

  const stats = await getProfileStats(conn, profilePDA)
  if (stats) {
    console.log(`  Profile Reputation: ${stats.reputation}`)
    console.log(`  Tasks Completed: ${stats.tasksCompleted}`)
  }

  const finalBalance = await conn.getBalance(payer.publicKey)
  console.log(`  Final Balance: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  ✅ Smoke Test Passed!')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

// Run
main().catch((err) => {
  console.error('\n❌ Smoke Test Failed:', err)
  process.exit(1)
})
