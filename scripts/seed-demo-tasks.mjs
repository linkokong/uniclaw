/**
 * Seed demo tasks on Solana devnet — pure @solana/web3.js (no Anchor SDK).
 * Usage: node scripts/seed-demo-tasks.mjs
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C')
const DEVNET_RPC = 'https://api.devnet.solana.com'

// Load keypair
const keypairPath = join(process.env.HOME, '.config/solana/devnet-keypair.json')
const keypairData = JSON.parse(readFileSync(keypairPath, 'utf-8'))
const payer = Keypair.fromSecretKey(new Uint8Array(keypairData))
console.log('🔑 Payer:', payer.publicKey.toBase58())

const connection = new Connection(DEVNET_RPC, 'confirmed')

// ─── Anchor discriminator ──────────────────────────────────────────────────
// sha256('global:createTask')[0..8]
const CREATE_TASK_DISCRIMINATOR = Buffer.from([0x8c, 0x87, 0x5d, 0x22, 0x59, 0x0e, 0xf9, 0xdd])

// ─── Borsh serialization helpers ────────────────────────────────────────────

function encodeString(str) {
  const buf = Buffer.from(str, 'utf-8')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32LE(buf.length)
  return Buffer.concat([lenBuf, buf])
}

function encodeVecString(arr) {
  const parts = [Buffer.alloc(4)]
  parts[0].writeUInt32LE(arr.length)
  for (const s of arr) {
    parts.push(encodeString(s))
  }
  return Buffer.concat(parts)
}

function encodeU64(val) {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(val)
  return buf
}

function encodeI64(val) {
  const buf = Buffer.alloc(8)
  buf.writeBigInt64LE(val)
  return buf
}

// ─── PDA derivation ─────────────────────────────────────────────────────────

// Hash title the same way the on-chain contract does: sha256(title).slice(0, 8)
function hashTitle(title) {
  const hash = sha256(new TextEncoder().encode(title))
  return Buffer.from(hash).slice(0, 8)
}

function findTaskPda(creator, title) {
  const titleHash = hashTitle(title)
  return PublicKey.findProgramAddressSync(
    [Buffer.from('task'), creator.toBuffer(), titleHash],
    PROGRAM_ID,
  )
}

function findEscrowPda(task) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), task.toBuffer()],
    PROGRAM_ID,
  )
}

// ─── Build createTask instruction ───────────────────────────────────────────

function buildCreateTaskIx(creator, title, description, requiredSkills, rewardLamports, verificationPeriod) {
  const [taskPda] = findTaskPda(creator, title)
  const [escrowPda] = findEscrowPda(taskPda)

  const data = Buffer.concat([
    CREATE_TASK_DISCRIMINATOR,
    encodeString(title),
    encodeString(description),
    encodeVecString(requiredSkills),
    encodeU64(rewardLamports),
    encodeI64(verificationPeriod),
  ])

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: taskPda, isSigner: false, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: new PublicKey('SysvarC1ock11111111111111111111111111111111'), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  })

  return { ix, taskPda, escrowPda }
}

// ─── Demo Task Data ─────────────────────────────────────────────────────────

const DEMO_TASKS = [
  {
    title: 'DeFi Yield Aggregator Smart Contract',
    description: 'Develop a Solana-based yield aggregator that automatically optimizes LP positions across multiple DEXs. Must include risk management, auto-compounding, and emergency withdrawal mechanisms.',
    requiredSkills: ['Rust', 'Solana', 'DeFi', 'Anchor'],
    rewardSol: 2.5,
    verificationPeriodDays: 14,
  },
  {
    title: 'NFT Marketplace Backend API',
    description: 'Build a RESTful API service for an NFT marketplace supporting SPL token listings, bids, escrow, and royalties. Must integrate with Phantom wallet authentication and handle metadata upload to Arweave.',
    requiredSkills: ['Node.js', 'Solana', 'REST API', 'Arweave'],
    rewardSol: 1.8,
    verificationPeriodDays: 10,
  },
  {
    title: 'Cross-chain Bridge Security Audit',
    description: 'Perform a comprehensive security audit of a Solana-Ethereum bridge smart contract. Focus on replay attacks, signature verification, and fund drainage vectors. Deliver written report with severity ratings.',
    requiredSkills: ['Security Audit', 'Solana', 'Ethereum', 'Cryptography'],
    rewardSol: 5.0,
    verificationPeriodDays: 21,
  },
  {
    title: 'Real-time Trading Dashboard UI',
    description: 'Create a responsive React dashboard displaying live Solana DEX trading data with candlestick charts, order book visualization, and portfolio tracking. WebSocket integration required for real-time updates.',
    requiredSkills: ['React', 'TypeScript', 'WebSocket', 'Chart.js'],
    rewardSol: 1.2,
    verificationPeriodDays: 7,
  },
  {
    title: 'DAO Governance Module',
    description: 'Implement an on-chain DAO governance system with proposal creation, token-weighted voting, quorum requirements, and automatic execution of passed proposals. Must support both simple and multi-option proposals.',
    requiredSkills: ['Rust', 'Anchor', 'Governance', 'Solana'],
    rewardSol: 3.0,
    verificationPeriodDays: 14,
  },
  {
    title: 'Mobile Wallet Integration SDK',
    description: 'Develop a lightweight TypeScript SDK for mobile apps to interact with Solana wallets (Phantom, Solflare). Support transaction signing, message encryption, and dApp connection via deep links.',
    requiredSkills: ['TypeScript', 'Mobile', 'Solana', 'SDK Design'],
    rewardSol: 2.0,
    verificationPeriodDays: 10,
  },
  {
    title: 'On-chain Random Number Oracle',
    description: 'Build a verifiable randomness oracle on Solana using commit-reveal scheme with slot hash. Must be tamper-proof and support callback mechanism for consumer programs.',
    requiredSkills: ['Rust', 'Anchor', 'Cryptography', 'Oracle'],
    rewardSol: 1.5,
    verificationPeriodDays: 7,
  },
  {
    title: 'Token Vesting Contract with Cliff',
    description: 'Create a flexible token vesting contract supporting linear vesting with cliff periods, multiple beneficiaries, and revocable schedules. Admin should be able to add vesting schedules in batch.',
    requiredSkills: ['Rust', 'Anchor', 'SPL Token', 'Solana'],
    rewardSol: 1.0,
    verificationPeriodDays: 7,
  },
]

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const balance = await connection.getBalance(payer.publicKey)
  console.log('💰 Balance:', (balance / 1e9).toFixed(4), 'SOL\n')

  let created = 0
  let skipped = 0

  for (const task of DEMO_TASKS) {
    const [taskPda] = findTaskPda(payer.publicKey, task.title)

    // Check if task already exists
    try {
      const existing = await connection.getAccountInfo(taskPda)
      if (existing) {
        console.log('⏭️  Skipped (exists):', task.title)
        skipped++
        continue
      }
    } catch {
      // Account doesn't exist, proceed
    }

    const rewardLamports = BigInt(Math.round(task.rewardSol * 1e9))
    const verificationPeriod = BigInt(task.verificationPeriodDays * 24 * 3600)

    console.log('📝 Creating:', task.title, `(${task.rewardSol} SOL)`)

    try {
      const { ix } = buildCreateTaskIx(
        payer.publicKey,
        task.title,
        task.description,
        task.requiredSkills,
        rewardLamports,
        verificationPeriod,
      )

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      const tx = new Transaction({ blockhash, lastValidBlockHeight })
      tx.add(ix)
      tx.sign(payer)

      const txSig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })

      // Confirm transaction
      await connection.confirmTransaction({
        signature: txSig,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed')

      console.log('   ✅ TX:', txSig)
      created++
    } catch (err) {
      const msg = err.message || String(err)
      console.error('   ❌ Failed:', msg.slice(0, 200))
      // Log more details for debugging
      if (err.logs) {
        console.error('   📋 Logs:', err.logs.slice(-3).join('\n         '))
      }
    }

    // Rate limit: wait 1.5s between transactions
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log('\n🎉 Done! Created:', created, ', Skipped:', skipped)

  // Verify: fetch all task accounts
  console.log('\n📊 Verifying task accounts...')
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: 800 }],
  })
  console.log('   Total task accounts on-chain:', accounts.length)
}

main().catch(console.error)
