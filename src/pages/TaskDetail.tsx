// ============================================================
// Claw Universe — TaskDetail Page
// 任务详情页：直接从链上加载任务数据 + 完整生命周期操作按钮
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Connection } from '@solana/web3.js'
import { struct, u64, u8, u32, i64, publicKey, str, vec, option } from '@coral-xyz/borsh'
import type { Task, FrontendTaskStatus } from '../types/api'
import { chainTaskToTask } from '../types/api'
import BidList from '../components/BidList'
import BidForm from '../components/BidForm'
import {
  startTaskOnChain,
  submitTaskOnChain,
  verifyTaskOnChain,
  verifyTaskTokenOnChain,
  cancelTaskOnChain,
  disputeTaskOnChain,
  deriveWorkerProfilePda,
} from '../utils/anchor'

const RPC_ENDPOINT = 'https://api.devnet.solana.com'
const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C')

// Borsh schema matching the on-chain Task account
const TASK_SCHEMA = struct([
  publicKey('creator'),
  publicKey('worker'),
  str('title'),
  str('description'),
  vec(str(), 'requiredSkills'),
  u8('status'),
  u64('reward'),
  u8('paymentType'),
  publicKey('tokenMint'),
  i64('verificationDeadline'),
  option(i64(), 'submissionTime'),
  option(i64(), 'verificationTime'),
  u8('bump'),
  i64('createdAt'),
  u32('workerReputationAtAssignment'),
  u64('acceptedBidDeposit'),
])

// ─── Status Badge ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<FrontendTaskStatus, { label: string; bg: string; text: string; dot: string }> = {
  open:        { label: 'OPEN',        bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  assigned:    { label: 'ASSIGNED',    bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  in_progress: { label: 'WORKING',     bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
  submitted:   { label: 'SUBMITTED',   bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-400' },
  completed:   { label: 'COMPLETED',   bg: 'bg-gray-500/15',    text: 'text-gray-400',    dot: 'bg-gray-400' },
  cancelled:   { label: 'CANCELLED',   bg: 'bg-red-500/15',     text: 'text-red-400',     dot: 'bg-red-400' },
  disputed:    { label: 'DISPUTED',    bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-400' },
}

// ─── Action Panel: lifecycle buttons based on role + status ───────────────
function TaskActions({
  task,
  taskPda,
  wallet,
  onRefresh,
}: {
  task: Task
  taskPda: string
  wallet: ReturnType<typeof useWallet>
  onRefresh: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const myAddress = wallet.publicKey?.toBase58()
  const isCreator = myAddress === task.publisher?.address
  const isWorker = myAddress === task.worker?.address
  const taskPdaKey = new PublicKey(taskPda)

  const exec = async (label: string, fn: () => Promise<unknown>) => {
    setLoading(label)
    setError(null)
    setSuccess(null)
    try {
      await fn()
      setSuccess(`${label} successful!`)
      setTimeout(() => onRefresh(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(null)
    }
  }

  const walletAdapter = wallet as never

  // Determine which buttons to show
  const buttons: { label: string; icon: string; color: string; action: () => void; show: boolean }[] = [
    // Worker: Start Task (status = assigned)
    {
      label: 'Start Task',
      icon: '▶',
      color: 'from-blue-500 to-cyan-400',
      show: isWorker && task.status === 'assigned',
      action: () => exec('Start Task', () => startTaskOnChain(walletAdapter, taskPdaKey)),
    },
    // Worker: Submit Task (status = in_progress)
    {
      label: 'Submit Task',
      icon: '📤',
      color: 'from-orange-500 to-yellow-400',
      show: isWorker && task.status === 'in_progress',
      action: () => exec('Submit Task', () => submitTaskOnChain(walletAdapter, taskPdaKey)),
    },
    // Creator: Verify (Approve) (status = submitted)
    {
      label: 'Approve & Pay',
      icon: '✅',
      color: 'from-emerald-500 to-green-400',
      show: isCreator && task.status === 'submitted',
      action: () => {
        const workerAddr = task.worker?.address
        if (!workerAddr) return
        const workerPk = new PublicKey(workerAddr)
        const workerProfile = new PublicKey(deriveWorkerProfilePda(workerAddr))
        if (task.paymentType === 'token') {
          exec('Approve & Pay', () => verifyTaskTokenOnChain(walletAdapter, taskPdaKey, workerPk, workerProfile, true))
        } else {
          exec('Approve & Pay', () => verifyTaskOnChain(walletAdapter, taskPdaKey, workerPk, workerProfile, true))
        }
      },
    },
    // Creator: Reject (status = submitted)
    {
      label: 'Reject Submission',
      icon: '❌',
      color: 'from-red-500 to-pink-400',
      show: isCreator && task.status === 'submitted',
      action: () => {
        const workerAddr = task.worker?.address
        if (!workerAddr) return
        const workerPk = new PublicKey(workerAddr)
        const workerProfile = new PublicKey(deriveWorkerProfilePda(workerAddr))
        if (task.paymentType === 'token') {
          exec('Reject', () => verifyTaskTokenOnChain(walletAdapter, taskPdaKey, workerPk, workerProfile, false))
        } else {
          exec('Reject', () => verifyTaskOnChain(walletAdapter, taskPdaKey, workerPk, workerProfile, false))
        }
      },
    },
    // Creator: Cancel Task (status = open or assigned)
    {
      label: 'Cancel Task',
      icon: '🚫',
      color: 'from-gray-500 to-gray-400',
      show: isCreator && (task.status === 'open' || task.status === 'assigned'),
      action: () => exec('Cancel Task', () => cancelTaskOnChain(walletAdapter, taskPdaKey)),
    },
    // Worker: Dispute (status = submitted, deadline passed)
    {
      label: 'Dispute (Auto-resolve)',
      icon: '⚖️',
      color: 'from-amber-500 to-orange-400',
      show: isWorker && task.status === 'submitted' && task.verification_deadline
        ? new Date(task.verification_deadline).getTime() < Date.now()
        : false,
      action: () => {
        if (!myAddress) return
        const workerProfile = new PublicKey(deriveWorkerProfilePda(myAddress))
        exec('Dispute', () => disputeTaskOnChain(walletAdapter, taskPdaKey, workerProfile))
      },
    },
  ]

  const visibleButtons = buttons.filter(b => b.show)
  if (!wallet.connected || visibleButtons.length === 0) return null

  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</h3>
      {visibleButtons.map(btn => (
        <button
          key={btn.label}
          onClick={btn.action}
          disabled={loading !== null}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
            loading === btn.label
              ? 'bg-gray-700/50 text-gray-400 cursor-wait'
              : `bg-gradient-to-r ${btn.color} text-white hover:opacity-90 hover:shadow-lg active:scale-[0.98]`
          }`}
        >
          {loading === btn.label ? `${btn.icon} Processing...` : `${btn.icon} ${btn.label}`}
        </button>
      ))}
      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
          <p className="text-red-400 text-xs break-all">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
          <p className="text-emerald-400 text-xs">{success}</p>
        </div>
      )}
    </div>
  )
}

// ─── Publisher Card ───────────────────────────────────────────────────────
function PublisherCard({ publisher, label }: { publisher: NonNullable<Task['publisher']>; label?: string }) {
  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{label ?? 'Publisher'}</h3>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white font-bold text-sm shrink-0">
          {publisher.address.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xs text-white truncate">{publisher.address}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {publisher.address.slice(0, 8)}...{publisher.address.slice(-4)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────
function TaskDetailSkeleton() {
  return (
    <div className="max-w-4xl space-y-6 animate-pulse">
      <div className="h-5 w-36 bg-gray-800/50 rounded" />
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-4">
        <div className="h-8 w-2/3 bg-gray-800/60 rounded" />
        <div className="flex gap-4">
          <div className="h-4 w-24 bg-gray-800/50 rounded" />
          <div className="h-4 w-20 bg-gray-800/50 rounded" />
        </div>
        <div className="space-y-2 pt-2">
          {[1,2,3].map(i => <div key={i} className="h-3 bg-gray-800/40 rounded" style={{ width: `${100 - i * 10}%` }} />)}
        </div>
      </div>
    </div>
  )
}

// ─── Fetch single task from chain by PDA ──────────────────────────────────
async function fetchTaskFromChain(pda: string): Promise<Task | null> {
  try {
    const conn = new Connection(RPC_ENDPOINT, 'confirmed')
    const pubkey = new PublicKey(pda)
    const accountInfo = await conn.getAccountInfo(pubkey)
    if (!accountInfo) return null

    // Verify it belongs to our program
    if (!accountInfo.owner.equals(PROGRAM_ID)) return null

    const raw = TASK_SCHEMA.decode(accountInfo.data.slice(8))
    if (!raw) return null

    // Convert BN objects to strings
    const decoded: Record<string, any> = {}
    for (const [k, v] of Object.entries(raw)) {
      decoded[k] = (v && typeof v === 'object' && typeof (v as any).toString === 'function' && (v as any)._bn !== undefined)
        ? (v as any).toString()
        : v
    }
    return chainTaskToTask(pda, decoded as any)
  } catch (err) {
    console.error('[TaskDetail] fetchTaskFromChain error:', err)
    return null
  }
}

// ─── Page Component ──────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const wallet = useWallet()

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const chainTask = await fetchTaskFromChain(id)
      if (chainTask) {
        setTask(chainTask)
      } else {
        setError('Task not found on chain. It may have been deleted or the address is invalid.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData, refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  // ── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-4xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors group">
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
        </button>
        <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-8 text-center">
          <span className="text-4xl mb-3 block">⚠️</span>
          <h3 className="text-red-400 font-semibold mb-2">Failed to load task</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={loadData} className="px-5 py-2 bg-[#9945FF]/20 border border-[#9945FF]/40 rounded-xl text-sm text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (loading || !task) return <TaskDetailSkeleton />

  const statusConfig = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.open
  const daysLeft = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const deadlineColor = daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-400'
  const myAddress = wallet.publicKey?.toBase58()
  const isCreator = myAddress === task.publisher?.address
  const isWorker = myAddress === task.worker?.address

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back navigation */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors group">
        <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Task Square
      </button>

      {/* ── Title + Meta ── */}
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-3 py-1 bg-gray-800/60 border border-gray-700/50 rounded-lg text-xs text-gray-400">
            {task.category}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>
          <span className={`text-xs ${deadlineColor}`}>
            📅 {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : 'Deadline passed'}
          </span>
          {task.status === 'submitted' && task.verification_deadline && (
            <span className="text-xs text-orange-400">
              ⏱ Verify by {new Date(task.verification_deadline).toLocaleDateString()}
            </span>
          )}
          {task.paymentType === 'token' && (
            <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">TOKEN</span>
          )}
          {isCreator && <span className="text-[10px] font-medium bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">YOU: CREATOR</span>}
          {isWorker && <span className="text-[10px] font-medium bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded">YOU: WORKER</span>}
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Reward</span>
            <span className="text-xl font-bold text-[#14F195]">{task.reward} {task.paymentType === 'token' ? 'UNIC' : 'SOL'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Deadline</span>
            <span className="text-white font-medium">{task.deadline}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Posted</span>
            <span className="text-white font-medium">{task.createdAt}</span>
          </div>
          <button onClick={handleRefresh} className="text-xs text-gray-500 hover:text-white transition-colors">↻ Refresh</button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Description</h2>
            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{task.description}</div>
          </div>

          {/* Skills */}
          {task.skills.length > 0 && (
            <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Required Skills</h2>
              <div className="flex flex-wrap gap-2">
                {task.skills.map(skill => (
                  <span key={skill} className="px-3 py-1.5 bg-[#9945FF]/10 border border-[#9945FF]/25 rounded-lg text-sm text-[#9945FF]">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Worker info (if assigned) */}
          {task.worker && (
            <div className="bg-[#111827] border border-blue-500/20 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">Assigned Worker</h2>
              <p className="font-mono text-sm text-white">{task.worker.address}</p>
              <p className="text-gray-500 text-xs mt-1">
                {task.worker.address.slice(0, 8)}...{task.worker.address.slice(-4)}
              </p>
            </div>
          )}

          {/* Bids section (mobile) */}
          <div className="lg:hidden space-y-4">
            {task.status === 'open' && id && (
              <BidForm
                taskId={id}
                taskPda={id}
                taskTitle={task.title}
                creatorWallet={task.publisher?.address}
                bidRange={task.bidRange}
                onSuccess={handleRefresh}
              />
            )}
            {id && (
              <BidList
                taskId={id}
                taskPda={id}
                taskTitle={task.title}
                creatorWallet={task.publisher?.address}
              />
            )}
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="hidden lg:block space-y-4">
          {/* Action buttons */}
          {id && <TaskActions task={task} taskPda={id} wallet={wallet} onRefresh={handleRefresh} />}

          {/* Bid form (open tasks only) */}
          {task.status === 'open' && id && (
            <BidForm
              taskId={id}
              taskPda={id}
              taskTitle={task.title}
              creatorWallet={task.publisher?.address}
              bidRange={task.bidRange}
              onSuccess={handleRefresh}
            />
          )}

          {/* Reward teaser */}
          {task.status === 'open' && (
            <div className="bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/10 border border-[#9945FF]/20 rounded-2xl p-5 text-center">
              <p className="text-white font-semibold mb-1">Ready to work?</p>
              <p className="text-gray-400 text-xs mb-4">Place your bid and get started</p>
              <div className="text-2xl font-bold text-[#14F195] mb-1">{task.reward} {task.paymentType === 'token' ? 'UNIC' : 'SOL'}</div>
              <p className="text-gray-600 text-xs">available reward</p>
            </div>
          )}

          {/* Bid list */}
          {id && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Bids</h3>
              <BidList
                taskId={id}
                taskPda={id}
                taskTitle={task.title}
                creatorWallet={task.publisher?.address}
              />
            </div>
          )}

          {/* Publisher card */}
          {task.publisher && <PublisherCard publisher={task.publisher} label="Creator" />}
          {task.worker && <PublisherCard publisher={task.worker} label="Worker" />}
        </div>
      </div>
    </div>
  )
}
