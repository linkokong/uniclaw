// ============================================================
// Claw Universe — BidList Component (Enhanced)
// 投标列表：展示某任务的所有投标，支持筛选、展开详情、实时更新
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Connection } from '@solana/web3.js'
import { getTaskBids } from '../api/task'
import { getUserByWallet } from '../api/user'
import { acceptBid, rejectBid } from '../api/bid'
import {
  acceptBidOnChain,
  rejectBidOnChain,
  deriveTaskPdaFromCreator,
  deriveBidPda,
  deriveWorkerProfilePda,
} from '../utils/anchor'
import type { RawBid } from '../types/api'
import { BidStatus } from '../types/api'
import { SkillTag } from './SkillTags'

const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C')
const RPC_ENDPOINT = 'https://api.devnet.solana.com'

// Check if a string looks like a Solana address (base58, 32-44 chars)
function isSolanaAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
}

// Fetch bids from chain for a given task PDA
async function fetchBidsFromChain(taskPda: string): Promise<RawBid[]> {
  try {
    const { struct, u8, u64, publicKey, str } = await import('@coral-xyz/borsh')
    const conn = new Connection(RPC_ENDPOINT, 'confirmed')

    // Bid accounts have a specific layout — filter by program and look for task reference
    const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 200 }, // Approximate bid account size
      ],
    })

    // Also try other common sizes
    const accounts2 = await conn.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 250 },
      ],
    }).catch(() => [])

    const allAccounts = [...accounts, ...accounts2]

    const BID_SCHEMA = struct([
      publicKey('bidder'),
      publicKey('task'),
      str('proposal'),
      u64('deposit'),
      u8('status'),
      u8('bump'),
    ])

    const bids: RawBid[] = []
    for (const { pubkey, account } of allAccounts) {
      try {
        const raw = BID_SCHEMA.decode(account.data)
        if (!raw || !raw.task) continue
        const taskAddr = raw.task.toBase58 ? raw.task.toBase58() : String(raw.task)
        if (taskAddr !== taskPda) continue

        const bidderAddr = raw.bidder.toBase58 ? raw.bidder.toBase58() : String(raw.bidder)
        const depositBN = raw.deposit && typeof raw.deposit === 'object' && (raw.deposit as any)._bn !== undefined
          ? (raw.deposit as any).toString()
          : String(raw.deposit ?? 0)
        const depositSol = (Number(BigInt(depositBN)) / 1e9).toFixed(4)

        const statusMap: Record<number, BidStatus> = {
          0: BidStatus.Pending,
          1: BidStatus.Accepted,
          2: BidStatus.Rejected,
          3: BidStatus.Withdrawn,
        }

        bids.push({
          id: pubkey.toBase58(),
          task_id: taskPda,
          bidder_wallet: bidderAddr,
          amount: depositSol,
          proposal: raw.proposal || '',
          estimated_duration: '1 week',
          status: statusMap[raw.status] ?? BidStatus.Pending,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Skip accounts that don't match bid schema
      }
    }
    return bids
  } catch (err) {
    console.error('[BidList] fetchBidsFromChain error:', err)
    return []
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'reputation' | 'amount' | 'duration' | 'newest'

interface BidderProfile {
  wallet: string
  username: string | null
  avatarUrl: string | null
  reputation: number
  tier: string
  tasksCompleted: number
  tasksFailed: number
  bio: string | null
  skills: string[]
}

// EnrichedBid reserved for future bidder profile enrichment
// interface EnrichedBid extends RawBid {
//   profile?: BidderProfile
// }

interface BidListProps {
  taskId: string
  taskPda?: string  // Direct PDA address (preferred)
  taskTitle?: string // For PDA derivation if taskPda not provided
  creatorWallet?: string
  initialBids?: RawBid[]
  /** 外部触发刷新（如投标成功后） */
  refreshTrigger?: unknown
}

// ─── Polling interval (ms) ─────────────────────────────────────────────────
const POLL_INTERVAL = 8000

// ─── Helpers ────────────────────────────────────────────────────────────────

function tierColor(tier: string): { bg: string; text: string; border: string } {
  const t = tier?.toLowerCase() ?? ''
  if (t === 'diamond') return { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' }
  if (t === 'gold')   return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' }
  if (t === 'silver') return { bg: 'bg-gray-400/15', text: 'text-gray-300', border: 'border-gray-400/30' }
  if (t === 'bronze') return { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' }
  return { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-600/30' }
}

function tierLabel(tier: string): string {
  const labels: Record<string, string> = {
    diamond: '◆ Diamond', gold: '◆ Gold', silver: '◆ Silver', bronze: '◆ Bronze',
  }
  return labels[tier?.toLowerCase()] ?? tier
}

function formatReputation(r: number): string {
  if (r >= 1000) return `${(r / 1000).toFixed(1)}k`
  return String(r)
}

function durationToDays(d: string): number {
  const match = String(d).match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

function formatDuration(d: string): string {
  const n = durationToDays(d)
  if (!n) return d
  return n === 1 ? '1 day' : `${n} days`
}

// ─── Reputation Stars ───────────────────────────────────────────────────────

function ReputationStars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const stars = Math.round(value / 20) // 0-5 stars
  const cls = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <span className={`${cls} text-yellow-400 tracking-tight`}>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

// ─── Sort Icon ─────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-[10px] ${active ? 'text-[#14F195]' : 'text-gray-600'}`}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )
}

// ─── Bid Status Badge ───────────────────────────────────────────────────────

function BidStatusBadge({ status }: { status: BidStatus }) {
  const cfg: Record<string, { label: string; bg: string; text: string }> = {
    [BidStatus.Pending]:   { label: 'PENDING',   bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
    [BidStatus.Accepted]:  { label: 'ACCEPTED',  bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    [BidStatus.Rejected]: { label: 'REJECTED',  bg: 'bg-red-500/15', text: 'text-red-400' },
    [BidStatus.Withdrawn]: { label: 'WITHDRAWN', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  }
  const c = cfg[status] ?? { label: status, bg: 'bg-gray-500/15', text: 'text-gray-400' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

// ─── Loading Skeleton ───────────────────────────────────────────────────────

function BidSkeleton() {
  return (
    <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-4 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="flex gap-2.5 items-center">
          <div className="w-10 h-10 rounded-full bg-gray-800/70" />
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-gray-800/60 rounded" />
            <div className="h-2 w-20 bg-gray-800/40 rounded" />
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="h-5 w-20 bg-gray-800/60 rounded ml-auto" />
          <div className="h-2 w-14 bg-gray-800/40 rounded ml-auto" />
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="h-3 w-full bg-gray-800/40 rounded" />
        <div className="h-3 w-4/5 bg-gray-800/40 rounded" />
        <div className="h-3 w-2/3 bg-gray-800/40 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-gray-800/40 rounded-lg" />
        <div className="h-8 w-20 bg-gray-800/40 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Expanded Bid Detail ────────────────────────────────────────────────────

function BidDetailPanel({ wallet, profile }: { wallet: string; profile?: BidderProfile }) {
  const [loading, setLoading] = useState(!profile)
  const [data, setData] = useState<BidderProfile | null>(profile ?? null)

  useEffect(() => {
    if (profile) return
    setLoading(true)
    getUserByWallet(wallet)
      .then(u => setData({
        wallet: u.address,
        username: u.username,
        avatarUrl: u.avatarUrl,
        reputation: u.reputation,
        tier: u.rank,
        tasksCompleted: u.tasksCompleted,
        tasksFailed: u.tasksFailed,
        bio: u.bio,
        skills: u.skills,
      }))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [wallet, profile])

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-800/40 space-y-2">
        <div className="h-3 w-32 bg-gray-800/40 rounded animate-pulse" />
        <div className="h-3 w-full bg-gray-800/30 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-gray-800/30 rounded animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-800/40">
        <p className="text-gray-500 text-xs">Failed to load profile.</p>
      </div>
    )
  }

  const tc = tierColor(data.tier)
  const successRate = data.tasksCompleted + data.tasksFailed > 0
    ? Math.round((data.tasksCompleted / (data.tasksCompleted + data.tasksFailed)) * 100)
    : 0

  return (
    <div className="mt-3 pt-3 border-t border-gray-800/40 space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-900/50 rounded-lg p-2.5">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Reputation</p>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-bold text-base">{formatReputation(data.reputation)}</span>
            <ReputationStars value={data.reputation} />
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2.5">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Tasks Done</p>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-bold text-base">{data.tasksCompleted}</span>
            {successRate > 0 && (
              <span className="text-[10px] text-gray-500">{successRate}% success</span>
            )}
          </div>
        </div>
      </div>

      {/* Tier badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${tc.bg} ${tc.text} border ${tc.border}`}>
          {tierLabel(data.tier)}
        </span>
        {data.username && (
          <span className="text-gray-300 text-sm font-medium">{data.username}</span>
        )}
        <span className="text-gray-600 text-xs font-mono ml-auto">
          {wallet.slice(0, 6)}...{wallet.slice(-4)}
        </span>
      </div>

      {/* Bio */}
      {data.bio && (
        <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{data.bio}</p>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.skills.slice(0, 8).map(s => (
            <SkillTag key={s} label={s} />
          ))}
          {data.skills.length > 8 && (
            <span className="text-gray-600 text-xs self-center">+{data.skills.length - 8} more</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Single Bid Row ─────────────────────────────────────────────────────────

function BidRow({
  bid,
  enriched,
  canManage,
  onAccept,
  onReject,
  defaultExpanded,
}: {
  bid: RawBid
  enriched: Record<string, BidderProfile>
  canManage: boolean
  onAccept: (id: string) => void
  onReject: (id: string) => void
  defaultExpanded?: boolean
}) {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null)
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const isPending = bid.status === BidStatus.Pending

  const profile = enriched[bid.bidder_wallet]
  const avatarLetter = profile?.username
    ? profile.username[0].toUpperCase()
    : bid.bidder_wallet.slice(0, 2).toUpperCase()

  const handleAccept = async () => {
    setLoading('accept')
    try { await onAccept(bid.id) } finally { setLoading(null) }
  }
  const handleReject = async () => {
    setLoading('reject')
    try { await onReject(bid.id) } finally { setLoading(null) }
  }

  return (
    <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-4 hover:border-gray-700/80 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        {/* Bidder identity */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity min-w-0"
          title={expanded ? 'Collapse detail' : 'Expand detail'}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white text-sm font-bold shrink-0">
            {avatarLetter}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-medium truncate max-w-[140px]">
                {profile?.username ?? profile?.wallet.slice(0, 8)}
              </p>
              {profile && <ReputationStars value={profile.reputation} size="sm" />}
            </div>
            <p className="text-gray-500 text-xs">
              {profile ? `${profile.tasksCompleted} tasks` : bid.bidder_wallet.slice(0, 8)}...{bid.bidder_wallet.slice(-4)}
            </p>
          </div>
        </button>

        {/* Right: status + price */}
        <div className="flex items-center gap-3 shrink-0">
          <BidStatusBadge status={bid.status} />
          <div className="text-right">
            <p className="text-lg font-bold text-[#14F195]">{parseFloat(bid.amount).toFixed(2)} SOL</p>
            <p className="text-xs text-gray-500">{formatDuration(bid.estimated_duration)}</p>
          </div>
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gray-600 hover:text-gray-300 text-xs transition-colors px-1"
            title={expanded ? 'Collapse' : 'View profile'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Proposal */}
      <p className="text-sm text-gray-300 leading-relaxed line-clamp-2 mb-2">{bid.proposal}</p>

      {/* Expanded detail */}
      {expanded && (
        <BidDetailPanel wallet={bid.bidder_wallet} profile={profile} />
      )}

      {/* Actions — creator only, pending bids */}
      {canManage && isPending && (
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-800/40">
          <button
            onClick={handleAccept}
            disabled={loading !== null}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              loading === 'accept'
                ? 'bg-emerald-500/20 text-emerald-400 cursor-wait'
                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300 active:scale-[0.98]'
            }`}
          >
            {loading === 'accept' ? 'Accepting…' : '✓ Accept Bid'}
          </button>
          <button
            onClick={handleReject}
            disabled={loading !== null}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              loading === 'reject'
                ? 'bg-red-500/20 text-red-400 cursor-wait'
                : 'bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300 active:scale-[0.98]'
            }`}
          >
            {loading === 'reject' ? 'Rejecting…' : '✗ Reject'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main BidList ───────────────────────────────────────────────────────────

export default function BidList({ taskId, taskPda, taskTitle, creatorWallet, initialBids, refreshTrigger }: BidListProps) {
  const { publicKey, signTransaction } = useWallet()

  const [bids, setBids] = useState<RawBid[] | null>(initialBids ?? null)
  const [enriched, setEnriched] = useState<Record<string, BidderProfile>>({})
  const [loading, setLoading] = useState(!initialBids)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [actionMode, setActionMode] = useState<'api' | 'onchain'>(isSolanaAddress(taskId) ? 'onchain' : 'api')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevBidCount = useRef<number | null>(null)

  // ── Load bids from API or chain ──────────────────────────────────────────
  const loadBids = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      let data: RawBid[]
      // If taskId looks like a Solana address (PDA), load from chain
      if (isSolanaAddress(taskId) && taskId.length >= 32) {
        data = await fetchBidsFromChain(taskId)
      } else {
        data = await getTaskBids(taskId)
      }
      setBids(data)
      if (prevBidCount.current !== null && data.length > prevBidCount.current) {
        // New bid arrived
      }
      prevBidCount.current = data.length
    } catch (err) {
      if (!silent) setError('Failed to load bids.')
      console.error(err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [taskId])

  // ── Enrich bidder profiles ────────────────────────────────────────────
  const enrichBids = useCallback(async (bidList: RawBid[]) => {
    const unknown = bidList.filter(b => !enriched[b.bidder_wallet])
    if (unknown.length === 0) return

    await Promise.allSettled(
      unknown.map(async b => {
        try {
          const u = await getUserByWallet(b.bidder_wallet)
          setEnriched(prev => ({
            ...prev,
            [b.bidder_wallet]: {
              wallet: u.address,
              username: u.username,
              avatarUrl: u.avatarUrl,
              reputation: u.reputation,
              tier: u.rank,
              tasksCompleted: u.tasksCompleted,
              tasksFailed: u.tasksFailed,
              bio: u.bio,
              skills: u.skills,
            },
          }))
        } catch { /* silent — profile optional */ }
      })
    )
  }, [enriched])

  // ── Initial load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (bids === null) {
      loadBids(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-enrich when bids change ─────────────────────────────────────────
  useEffect(() => {
    if (bids) enrichBids(bids)
  }, [bids, enrichBids])

  // ── Polling for real-time updates ──────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => loadBids(true), POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadBids])

  // ── External refresh trigger ────────────────────────────────────────────
  useEffect(() => {
    loadBids(true)
  }, [refreshTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sort ────────────────────────────────────────────────────────────────
  const sortedBids = (() => {
    if (!bids) return []
    const copy = [...bids]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'reputation': {
          const ra = enriched[a.bidder_wallet]?.reputation ?? 0
          const rb = enriched[b.bidder_wallet]?.reputation ?? 0
          cmp = ra - rb
          break
        }
        case 'amount':
          cmp = parseFloat(a.amount) - parseFloat(b.amount)
          break
        case 'duration':
          cmp = durationToDays(a.estimated_duration) - durationToDays(b.estimated_duration)
          break
        case 'newest':
        default:
          cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  })()

  const isCreator = publicKey ? publicKey.toBase58() === creatorWallet : false

  // ── Accept / Reject handlers ────────────────────────────────────────────
  const handleAccept = async (bidId: string) => {
    try {
      if (actionMode === 'onchain' && publicKey) {
        const resolvedTaskPda = taskPda ? new PublicKey(taskPda) : 
          (taskTitle && creatorWallet) ? deriveTaskPdaFromCreator(creatorWallet, taskTitle) :
          undefined
        if (!resolvedTaskPda) throw new Error('Task PDA required for on-chain operations')
        const bidderWallet = bids?.find(b => b.id === bidId)?.bidder_wallet
        if (!bidderWallet) throw new Error('Bid not found')
        const bidPda = deriveBidPda(resolvedTaskPda, bidderWallet)
        const workerProfile = deriveWorkerProfilePda(bidderWallet)
        await acceptBidOnChain(
          { publicKey, signTransaction: signTransaction as never, signAllTransactions: undefined },
          bidPda,
          resolvedTaskPda,
          workerProfile,
        )
      } else {
        await acceptBid(bidId)
      }
      setBids(prev => prev?.map(b =>
        b.id === bidId ? { ...b, status: BidStatus.Accepted } : b
      ) ?? null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      let displayMsg = '操作失败'
      if (msg.includes('INSUFFICIENT_BALANCE') || msg.includes('insufficient')) {
        displayMsg = '余额不足，无法完成交易'
      } else if (msg.includes('WALLET_NOT_CONNECTED')) {
        displayMsg = '请先连接钱包'
      } else if (msg.includes('BID_ALREADY_ACCEPTED') || msg.includes('already accepted') || msg.includes('0x1')) {
        displayMsg = '该投标已被接受'
      } else if (msg.includes('ACCOUNT_NOT_FOUND')) {
        displayMsg = '账户不存在，请刷新页面后重试'
      } else {
        displayMsg = `交易失败: ${msg.slice(0, 100)}`
      }
      setError(displayMsg)
      console.error('[BidList] acceptBid error:', err)
    }
  }

  const handleReject = async (bidId: string) => {
    try {
      if (actionMode === 'onchain' && publicKey) {
        const bid = bids?.find(b => b.id === bidId)
        if (!bid) throw new Error('Bid not found')
        const resolvedTaskPda = taskPda ? new PublicKey(taskPda) : 
          (taskTitle && creatorWallet) ? deriveTaskPdaFromCreator(creatorWallet, taskTitle) :
          undefined
        if (!resolvedTaskPda) throw new Error('Task PDA required for on-chain operations')
        const bidPda = deriveBidPda(resolvedTaskPda, bid.bidder_wallet)
        await rejectBidOnChain(
          { publicKey, signTransaction: signTransaction as never, signAllTransactions: undefined },
          bidPda,
          resolvedTaskPda,
          new PublicKey(bid.bidder_wallet),
        )
      } else {
        await rejectBid(bidId)
      }
      setBids(prev => prev?.map(b =>
        b.id === bidId ? { ...b, status: BidStatus.Rejected } : b
      ) ?? null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      let displayMsg = '操作失败'
      if (msg.includes('INSUFFICIENT_BALANCE') || msg.includes('insufficient')) {
        displayMsg = '余额不足，无法完成交易'
      } else if (msg.includes('WALLET_NOT_CONNECTED')) {
        displayMsg = '请先连接钱包'
      } else if (msg.includes('BID_ALREADY_ACCEPTED') || msg.includes('already accepted') || msg.includes('0x1')) {
        displayMsg = '该投标已被接受'
      } else if (msg.includes('ACCOUNT_NOT_FOUND')) {
        displayMsg = '账户不存在，请刷新页面后重试'
      } else {
        displayMsg = `交易失败: ${msg.slice(0, 100)}`
      }
      setError(displayMsg)
      console.error('[BidList] rejectBid error:', err)
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-36 bg-gray-800/50 rounded animate-pulse" />
        {[1, 2, 3].map(i => <BidSkeleton key={i} />)}
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button
          onClick={() => loadBids(false)}
          className="text-sm text-gray-400 hover:text-white underline transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Empty ───────────────────────────────────────────────────────────────
  if (!bids || bids.length === 0) {
    return (
      <div className="text-center py-10 bg-[#111827] border border-gray-800/60 rounded-xl">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="text-gray-400 text-sm font-medium">No bids yet</p>
        <p className="text-gray-600 text-xs mt-1">Be the first to place a bid!</p>
      </div>
    )
  }

  const pendingBids = sortedBids.filter(b => b.status === BidStatus.Pending)
  const resolvedBids = sortedBids.filter(b => b.status !== BidStatus.Pending)

  return (
    <div className="space-y-4">
      {/* Header + Sort Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Bids
          </h3>
          <span className="inline-flex px-2 py-0.5 bg-[#9945FF]/15 text-[#9945FF] rounded-full text-xs font-medium">
            {bids.length}
          </span>
          {/* On-chain action toggle (creator only) */}
          {isCreator && (
            <div className="flex rounded-md overflow-hidden border border-gray-700/50 text-[10px]">
              <button
                type="button"
                onClick={() => setActionMode('api')}
                className={`px-2 py-1 transition-colors ${
                  actionMode === 'api'
                    ? 'bg-[#9945FF]/20 text-[#9945FF] font-medium'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                API
              </button>
              <button
                type="button"
                onClick={() => setActionMode('onchain')}
                className={`px-2 py-1 transition-colors ${
                  actionMode === 'onchain'
                    ? 'bg-[#14F195]/15 text-[#14F195] font-medium'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                ⚡ On-chain
              </button>
            </div>
          )}
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-600 mr-1 uppercase tracking-wider">Sort:</span>
          {(
            [
              { key: 'reputation' as SortKey, label: 'Rep' },
              { key: 'amount' as SortKey, label: 'Amount' },
              { key: 'duration' as SortKey, label: 'Time' },
              { key: 'newest' as SortKey, label: 'New' },
            ]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`px-2 py-1 rounded-md text-xs transition-all ${
                sortKey === key
                  ? 'bg-[#9945FF]/20 text-[#9945FF]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {label}<SortIcon active={sortKey === key} dir={sortDir} />
            </button>
          ))}
        </div>
      </div>

      {/* Polling indicator */}
      {pollRef.current && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-pulse" />
          Live updates enabled
        </div>
      )}

      {/* Pending bids */}
      {pendingBids.length > 0 ? (
        <div className="space-y-2.5">
          {pendingBids.map(bid => (
            <BidRow
              key={bid.id}
              bid={bid}
              enriched={enriched}
              canManage={isCreator}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-5 bg-[#111827]/50 border border-gray-800/40 rounded-xl">
          <p className="text-gray-500 text-sm">No pending bids</p>
        </div>
      )}

      {/* Resolved bids (collapsed) */}
      {resolvedBids.length > 0 && (
        <details className="group">
          <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-400 list-none flex items-center gap-1.5 py-1">
            <span className="transition-transform group-open:rotate-90 text-[10px]">▶</span>
            Resolved ({resolvedBids.length})
          </summary>
          <div className="mt-2 space-y-2.5">
            {resolvedBids.map(bid => (
              <BidRow
                key={bid.id}
                bid={bid}
                enriched={enriched}
                canManage={false}
                onAccept={handleAccept}
                onReject={handleReject}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
