import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { getTaskDetail } from '../api/task'
import { fetchTask, verifyTask, startTask, submitTask, disputeTask, acceptBid, rejectBid, submitBid } from '../api/anchorClient'
import type { Task, RawBid } from '../types/api'
import { BidStatus } from '../types/api'

const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C')

// ─── Status Badge ─────────────────────────────────────────────────────────
// Reserved for inline status display in future UI iterations
// Re-exported for external use
export function _StatusBadge({ status }: { status: Task['status'] }) {
  const cfg: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    open:        { label: 'OPEN',        bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    assigned:    { label: 'ASSIGNED',    bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400' },
    in_progress: { label: 'WORKING',    bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
    submitted:   { label: 'SUBMITTED',  bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-400' },
    completed:   { label: 'COMPLETED',   bg: 'bg-gray-500/15',    text: 'text-gray-400',     dot: 'bg-gray-400' },
    cancelled:   { label: 'CANCELLED',  bg: 'bg-red-500/15',     text: 'text-red-400',      dot: 'bg-red-400' },
  }
  const c = cfg[status] ?? { label: 'UNKNOWN', bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400' }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ─── Publisher Card ────────────────────────────────────────────────────────
function PublisherCard({ publisher }: { publisher: NonNullable<Task['publisher']> }) {
  const shortAddr = publisher.address
    ? `${publisher.address.slice(0, 6)}…${publisher.address.slice(-4)}`
    : '—'

  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Publisher</h3>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white font-bold text-lg shrink-0">
          {shortAddr.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm text-white truncate">{shortAddr}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-yellow-400 text-sm">★</span>
            <span className="text-gray-300 text-sm font-medium">{publisher.reputation.toFixed(1)}</span>
            <span className="text-gray-600 text-xs">({publisher.tasksCompleted} tasks)</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/40 rounded-lg p-3 text-center">
          <p className="text-white font-semibold text-lg">{publisher.tasksCompleted}</p>
          <p className="text-gray-500 text-xs">Completed</p>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-3 text-center">
          <p className="text-white font-semibold text-lg">{publisher.joinedDays}</p>
          <p className="text-gray-500 text-xs">Days Active</p>
        </div>
      </div>
    </div>
  )
}

// ─── Bid Row ───────────────────────────────────────────────────────────────
const BID_STATUS_CONFIG: Record<BidStatus, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   bg: 'bg-gray-500/15',    text: 'text-gray-400' },
  accepted:  { label: 'Accepted',  bg: 'bg-emerald-500/15',  text: 'text-emerald-400' },
  rejected:  { label: 'Rejected', bg: 'bg-red-500/15',      text: 'text-red-400' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-gray-700/15',    text: 'text-gray-500' },
}

function BidRow({ bid, isOwner, onAction }: { bid: RawBid; isOwner: boolean; onAction: () => void }) {
  const wallet = useWallet()
  const [actionLoading, setActionLoading] = useState(false)
  const cfg = BID_STATUS_CONFIG[bid.status] ?? BID_STATUS_CONFIG.pending
  const shortAddr = bid.bidder_wallet
    ? `${bid.bidder_wallet.slice(0, 6)}…${bid.bidder_wallet.slice(-4)}`
    : '—'

  const handleAccept = async () => {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) return
    setActionLoading(true)
    try {
      const taskPDA = new PublicKey(bid.task_id || '')
      const bidderPubkey = new PublicKey(bid.bidder_wallet || '')
      const workerProfile = PublicKey.findProgramAddressSync(
        [Buffer.from('agent_profile'), bidderPubkey.toBuffer()],
        PROGRAM_ID
      )[0]
      // bid PDA: derive from bidder + task
      const [bidPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bid'), bidderPubkey.toBuffer(), taskPDA.toBuffer()],
        PROGRAM_ID
      )
      await acceptBid(
        { signTransaction: wallet.signTransaction, publicKey: wallet.publicKey },
        bidPda,
        taskPDA,
        workerProfile
      )
      onAction()
    } catch (err: any) {
      alert(err.message || 'Accept bid failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) return
    setActionLoading(true)
    try {
      const taskPDA = new PublicKey(bid.task_id || '')
      const bidderPubkey = new PublicKey(bid.bidder_wallet || '')
      // bid PDA: derive from bidder + task
      const [bidPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bid'), bidderPubkey.toBuffer(), taskPDA.toBuffer()],
        PROGRAM_ID
      )
      await rejectBid(
        { signTransaction: wallet.signTransaction, publicKey: wallet.publicKey },
        bidPda,
        taskPDA,
        bidderPubkey
      )
      onAction()
    } catch (err: any) {
      alert(err.message || 'Reject bid failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800/40 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-mono shrink-0">
          {shortAddr.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white font-mono truncate">{shortAddr}</p>
          <p className="text-xs text-gray-500 truncate">{bid.proposal}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 ml-4 shrink-0">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
        <span className="text-sm font-semibold text-[#14F195]">{parseFloat(bid.amount)} SOL</span>
        {isOwner && bid.status === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
            >
              {actionLoading ? '...' : 'Accept'}
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {actionLoading ? '...' : 'Reject'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bids Section ─────────────────────────────────────────────────────────
function BidsSection({ bids, isOwner, onAction }: { bids: RawBid[]; isOwner: boolean; onAction: () => void }) {
  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Bids</h3>
        <span className="text-xs text-gray-500">{bids.length} bid{bids.length !== 1 ? 's' : ''}</span>
      </div>
      {bids.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">No bids yet</p>
      ) : (
        <div>
          {bids.map((bid) => (
            <BidRow key={bid.id} bid={bid} isOwner={isOwner} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Place Bid Form ───────────────────────────────────────────────────────
function PlaceBidForm({ taskId, reward, bidRange, onSuccess, connected }: {
  connected: boolean
  taskId: string
  reward: number
  bidRange: { min: number; max: number }
  onSuccess: () => void
}) {
  const wallet = useWallet()
  const [amount, setAmount] = useState('')
  const [proposal, setProposal] = useState('')
  const [duration, setDuration] = useState('3')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !proposal) return
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const depositLamports = Math.round(parseFloat(amount) * 1_000_000_000)
      await submitBid(
        { signTransaction: wallet.signTransaction, publicKey: wallet.publicKey },
        new PublicKey(taskId),
        proposal,
        depositLamports
      )
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid')
    } finally {
      setLoading(false)
    }
  }

  if (!connected) {
    return (
      <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-6 text-center">
        <span className="text-3xl mb-3 block">🔒</span>
        <h3 className="text-white font-medium mb-1">Connect Your Wallet</h3>
        <p className="text-gray-500 text-sm">Connect your Solana wallet to place a bid</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Place Your Bid</h3>
        <span className="text-xs text-gray-500">Typical: {bidRange.min}–{bidRange.max} SOL</span>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Your Bid (SOL)</label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(reward)}
            min="0.1"
            step="0.1"
            className="w-full px-4 py-2.5 bg-gray-900/70 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9945FF]/50 focus:ring-2 focus:ring-[#9945FF]/20 transition-all"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">SOL</span>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Estimated Duration</label>
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full px-4 py-2.5 bg-gray-900/70 border border-gray-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-[#9945FF]/50 transition-all"
        >
          {['1','2','3','5','7','14','30'].map((d) => (
            <option key={d} value={d}>{d} day{d !== '1' ? 's' : ''}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Your Proposal</label>
        <textarea
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          placeholder="Describe your approach, relevant experience, and why you're the right fit…"
          rows={4}
          className="w-full px-4 py-3 bg-gray-900/70 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#9945FF]/50 focus:ring-2 focus:ring-[#9945FF]/20 transition-all"
        />
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !amount || !proposal}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
          !loading && amount && proposal
            ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 active:scale-98'
            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Submitting…' : 'Submit Bid'}
      </button>

      <p className="text-center text-xs text-gray-600">
        By submitting, you agree to escrow your bid amount until task completion
      </p>
    </form>
  )
}

// ─── Acceptance Criteria ─────────────────────────────────────────────────
function AcceptanceCriteria({ criteria }: { criteria: string[] }) {
  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Acceptance Criteria</h2>
      <ul className="space-y-0">
        {criteria.map((c, i) => (
          <li key={i} className="flex items-start gap-3 py-3 border-b border-gray-800/40 last:border-0">
            <div className="w-5 h-5 rounded-md border-2 border-gray-700 flex items-center justify-center mt-0.5 shrink-0">
              <span className="text-gray-600 text-xs">{i + 1}</span>
            </div>
            <span className="text-sm text-gray-300 leading-relaxed">{c}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="max-w-4xl space-y-6 animate-pulse">
      <div className="h-4 w-32 bg-gray-800/50 rounded" />
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-gray-800/50 rounded" />
          <div className="h-6 w-24 bg-gray-800/50 rounded" />
        </div>
        <div className="h-8 w-3/4 bg-gray-800/50 rounded" />
        <div className="flex gap-6">
          <div className="h-5 w-24 bg-gray-800/50 rounded" />
          <div className="h-5 w-16 bg-gray-800/50 rounded" />
          <div className="h-5 w-28 bg-gray-800/50 rounded" />
        </div>
      </div>
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
        <div className="h-4 w-24 bg-gray-800/50 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-gray-800/50 rounded" />
          <div className="h-3 w-2/3 bg-gray-800/50 rounded" />
        </div>
      </div>
    </div>
  )
}

// ─── Error State ───────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="max-w-4xl text-center py-16 bg-[#111827] border border-red-900/40 rounded-2xl">
      <span className="text-4xl mb-4 block">⚠️</span>
      <p className="text-red-400 font-medium">Failed to load task</p>
      <p className="text-gray-500 text-sm mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}

// ─── Page Component ────────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const wallet = useWallet()
  const publicKey = wallet.publicKey
  const walletConnected = wallet.connected

  const [task, setTask] = useState<Task | null>(null)
  const [bids, setBids] = useState<RawBid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // bidSubmitted removed

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { task: t, bids: b } = await getTaskDetail(id)
      setTask(t)
      setBids(b)
      
      // Fetch on-chain status for verification
      if (t.publisher?.address) {
        try {
          const [taskPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('task'), new PublicKey(t.publisher.address).toBuffer()],
            PROGRAM_ID
          )
          await fetchTask(taskPDA)
        } catch {
          // Ignore chain errors - API is primary
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <LoadingSkeleton />
  if (error || !task) return <ErrorState message={error ?? 'Task not found'} onRetry={fetchData} />

  const isOwner = publicKey?.toBase58() === task.publisher?.address
  const isOpen = task.status === 'open'

  const daysLeft = Math.ceil(
    (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const deadlineColor =
    daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-400'

  const statusConfig: Record<string, any> = {
    open:        { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'OPEN' },
    assigned:    { bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400',    label: 'ASSIGNED' },
    in_progress: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400', label: 'WORKING' },
    submitted:   { bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-400', label: 'SUBMITTED' },
    completed:   { bg: 'bg-gray-500/15',   text: 'text-gray-400',    dot: 'bg-gray-400',    label: 'COMPLETED' },
    cancelled:   { bg: 'bg-red-500/15',    text: 'text-red-400',     dot: 'bg-red-400',     label: 'CANCELLED' },
    disputed:    { bg: 'bg-orange-500/15', text: 'text-orange-400',  dot: 'bg-orange-400',  label: 'DISPUTED' },
  }[task.status] ?? { bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400', label: 'UNKNOWN' }

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Back Navigation ── */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors group"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span>
        Back to Task Square
      </button>

      {/* ── Title + Meta Card ── */}
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
          {task.verification_deadline && (
            <span className="text-xs text-purple-400">
              ⏰ Review by {new Date(task.verification_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.status === 'completed' && (
            <span className="text-xs text-yellow-400">
              ⏳ Review before dispute
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">{task.title}</h1>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Reward</span>
            <span className="text-xl font-bold text-[#14F195]">{task.reward} SOL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Bids</span>
            <span className="text-white font-medium">{task.bids}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Deadline</span>
            <span className="text-white font-medium">
              {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Posted</span>
            <span className="text-white font-medium">
              {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Description</h2>
            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
              {task.description}
            </div>
          </div>

          {/* Skills */}
          <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {task.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 bg-[#9945FF]/10 border border-[#9945FF]/25 rounded-lg text-sm text-[#9945FF] hover:bg-[#9945FF]/20 hover:border-[#9945FF]/40 transition-colors cursor-default"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Acceptance Criteria */}
          {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
            <AcceptanceCriteria criteria={task.acceptanceCriteria} />
          )}

          {/* Bids */}
          <BidsSection bids={bids} isOwner={!!isOwner} onAction={fetchData} />
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">

          {/* Start Working Button - worker accepts assignment */}
          {task.status === 'assigned' && wallet.connected && (
            <button
              onClick={async () => {
                if (!wallet.connected || !wallet.publicKey) return
                try {
                  const taskPDA = new PublicKey(task.id)
                  await startTask(
                    { signTransaction: wallet.signTransaction!, publicKey: wallet.publicKey! },
                    taskPDA
                  )
                  fetchData()
                  alert('Task started!')
                } catch (err: any) {
                  alert(err.message || 'Start failed')
                }
              }}
              className="w-full bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all"
            >
              🚀 Start Working
            </button>
          )}

          {/* Submit Task Button - worker submits completed work */}
          {task.status === 'in_progress' && wallet.connected && (
            <button
              onClick={async () => {
                if (!wallet.connected || !wallet.publicKey) return
                try {
                  const taskPDA = new PublicKey(task.id)
                  await submitTask(
                    { signTransaction: wallet.signTransaction!, publicKey: wallet.publicKey! },
                    taskPDA
                  )
                  fetchData()
                  alert('Task submitted for review!')
                } catch (err: any) {
                  alert(err.message || 'Submit failed')
                }
              }}
              className="w-full bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-all"
            >
              📤 Submit for Review
            </button>
          )}

          {/* Creator Verify Buttons - only when worker submitted (awaiting verification) */}
          {task.status === 'submitted' && isOwner && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!wallet.connected || !wallet.publicKey) return
                  const workerAddr = task.worker?.address
                  if (!workerAddr) { alert('No worker assigned'); return }
                  try {
                    const taskPDA = new PublicKey(task.id)
                    const workerPubkey = new PublicKey(workerAddr)
                    await verifyTask(
                      { signTransaction: wallet.signTransaction!, publicKey: wallet.publicKey! },
                      taskPDA,
                      workerPubkey,
                      PublicKey.findProgramAddressSync(
                        [Buffer.from('agent_profile'), workerPubkey.toBuffer()],
                        PROGRAM_ID
                      )[0],
                      true
                    )
                    fetchData()
                  } catch (err: any) {
                    alert(err.message || 'Approve failed')
                  }
                }}
                className="flex-1 bg-green-500/20 text-green-400 font-semibold py-3 rounded-xl hover:bg-green-500/30 transition-all"
              >
                ✅ Approve
              </button>
              <button
                onClick={async () => {
                  if (!wallet.connected || !wallet.publicKey) return
                  const workerAddr = task.worker?.address
                  if (!workerAddr) { alert('No worker assigned'); return }
                  try {
                    const taskPDA = new PublicKey(task.id)
                    const workerPubkey = new PublicKey(workerAddr)
                    await verifyTask(
                      { signTransaction: wallet.signTransaction!, publicKey: wallet.publicKey! },
                      taskPDA,
                      workerPubkey,
                      PublicKey.findProgramAddressSync(
                        [Buffer.from('agent_profile'), workerPubkey.toBuffer()],
                        PROGRAM_ID
                      )[0],
                      false
                    )
                    fetchData()
                  } catch (err: any) {
                    alert(err.message || 'Reject failed')
                  }
                }}
                className="flex-1 bg-red-500/20 text-red-400 font-semibold py-3 rounded-xl hover:bg-red-500/30 transition-all"
              >
                ❌ Reject
              </button>
            </div>
          )}

          {/* Dispute Button - show when submitted and deadline passed */}
          {task.status === 'submitted' && task.verification_deadline && new Date(task.verification_deadline).getTime() < Date.now() && wallet.connected && (
            <button
              onClick={async () => {
                if (!wallet.connected || !wallet.publicKey) return
                if (!confirm('Start dispute? This will involve platform arbitration.')) return
                try {
                  const taskPDA = new PublicKey(task.id)
                  const workerProfile = PublicKey.findProgramAddressSync(
                    [Buffer.from('agent_profile'), wallet.publicKey.toBuffer()],
                    PROGRAM_ID
                  )[0]
                  await disputeTask(
                    { signTransaction: wallet.signTransaction!, publicKey: wallet.publicKey! },
                    taskPDA,
                    workerProfile
                  )
                  fetchData()
                  alert('Dispute submitted!')
                } catch (err: any) {
                  alert(err.message || 'Dispute failed')
                }
              }}
              className="w-full bg-orange-500/20 text-orange-400 font-semibold py-3 rounded-xl hover:bg-orange-500/30 transition-all"
            >
              ⚠️ Start Dispute
            </button>
          )}

          {/* Quick Action Banner */}
          {isOpen && (
            <div className="bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/10 border border-[#9945FF]/20 rounded-2xl p-5 text-center">
              <p className="text-white font-semibold mb-1">Ready to work?</p>
              <p className="text-gray-400 text-xs mb-4">Place your bid and get started</p>
              <div className="text-2xl font-bold text-[#14F195] mb-1">{task.reward} SOL</div>
              <p className="text-gray-600 text-xs">available reward</p>
            </div>
          )}

          {/* Place Bid Form */}
          {isOpen && (
            <PlaceBidForm
              taskId={task.id}
              reward={task.reward}
              bidRange={task.bidRange}
              connected={walletConnected}
              onSuccess={() => {
                // bid submitted
                fetchData()
              }}
            />
          )}

          {/* Publisher Card */}
          {task.publisher && <PublisherCard publisher={task.publisher} />}
        </div>
      </div>
    </div>
  )
}