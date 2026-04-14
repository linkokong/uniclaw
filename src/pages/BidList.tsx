// ============================================================
// Claw Universe — BidList Page (src/pages/BidList.tsx)
// 竞标者列表页面：展示某任务的所有投标者，支持筛选、排序、分页
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { getTask } from '../api/task'
import { getTaskBids } from '../api/task'
import { acceptBid, rejectBid } from '../api/bid'
import { getUserByWallet } from '../api/user'
import { SkillTagList } from '../components/SkillTags'
import type { RawBid } from '../types/api'
import { BidStatus } from '../types/api'

// ─── Types ─────────────────────────────────────────────────────────────────

type SortKey = 'reputation' | 'amount'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'pending' | 'accepted' | 'rejected'

interface BidderProfile {
  wallet: string
  username: string | null
  reputation: number
  skills: string[]
  loading: boolean
}

const PAGE_SIZE = 20

// ─── Status Badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BidStatus | string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'PENDING',   bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  accepted:  { label: 'ACCEPTED',  bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  rejected:  { label: 'REJECTED', bg: 'bg-red-500/15',     text: 'text-red-400' },
  withdrawn: { label: 'WITHDRAWN',bg: 'bg-gray-500/15',   text: 'text-gray-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status.toUpperCase(), bg: 'bg-gray-500/15', text: 'text-gray-400' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ─── Reputation Badge ───────────────────────────────────────────────────────

function ReputationBadge({ score }: { score: number }) {
  const color = score >= 4.5 ? 'text-emerald-400' : score >= 3.5 ? 'text-yellow-400' : 'text-red-400'
  return (
    <span className={`text-sm font-bold ${color}`}>★ {score.toFixed(1)}</span>
  )
}

// ─── Initial Avatar ────────────────────────────────────────────────────────

function InitialAvatar({ wallet, size = 'md' }: { wallet: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = wallet.slice(0, 2).toUpperCase()
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl font-bold' : 'w-11 h-11 text-sm font-bold'
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white shrink-0`}>
      {initials}
    </div>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function BidSkeleton() {
  return (
    <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-800/60" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <div className="h-4 w-32 bg-gray-800/50 rounded" />
            <div className="h-4 w-20 bg-gray-800/50 rounded" />
          </div>
          <div className="h-3 w-48 bg-gray-800/40 rounded" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full bg-gray-800/40 rounded" />
        <div className="h-3 w-2/3 bg-gray-800/40 rounded" />
      </div>
    </div>
  )
}

// ─── Single Bid Card ───────────────────────────────────────────────────────

function BidCard({
  bid,
  profile,
  canManage,
  onAccept,
  onReject,
}: {
  bid: RawBid
  profile: BidderProfile
  canManage: boolean
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null)
  const isPending = bid.status === BidStatus.Pending

  const handleAccept = async () => {
    setActionLoading('accept')
    try { await onAccept(bid.id) } finally { setActionLoading(null) }
  }

  const handleReject = async () => {
    setActionLoading('reject')
    try { await onReject(bid.id) } finally { setActionLoading(null) }
  }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(bid.created_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  })()

  return (
    <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-5 hover:border-gray-700/70 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        {/* User info */}
        <div className="flex items-center gap-3 min-w-0">
          <InitialAvatar wallet={bid.bidder_wallet} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-sm truncate">
                {profile.loading ? (
                  <span className="inline-block w-20 h-4 bg-gray-700/50 rounded animate-pulse align-middle" />
                ) : profile.username || (
                  <span className="font-mono">{bid.bidder_wallet.slice(0, 6)}…{bid.bidder_wallet.slice(-4)}</span>
                )}
              </p>
              {!profile.loading && (
                <ReputationBadge score={profile.reputation} />
              )}
            </div>
            <p className="text-gray-500 text-xs mt-0.5">{timeAgo}</p>
          </div>
        </div>

        {/* Amount + status */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={bid.status} />
          <p className="text-[#14F195] font-bold text-lg">
            {parseFloat(bid.amount).toFixed(2)} SOL
          </p>
          <p className="text-gray-500 text-xs">{bid.estimated_duration}</p>
        </div>
      </div>

      {/* Proposal */}
      <p className="text-sm text-gray-300 leading-relaxed mb-4 line-clamp-2">{bid.proposal}</p>

      {/* Skills */}
      {!profile.loading && profile.skills.length > 0 && (
        <div className="mb-4">
          <SkillTagList skills={profile.skills.slice(0, 5)} />
        </div>
      )}

      {/* Actions */}
      {canManage && isPending && (
        <div className="flex gap-2 pt-3 border-t border-gray-800/50">
          <button
            onClick={handleAccept}
            disabled={actionLoading !== null}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              actionLoading === 'accept'
                ? 'bg-emerald-500/20 text-emerald-400 cursor-not-allowed'
                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300'
            }`}
          >
            {actionLoading === 'accept' ? 'Accepting…' : '✓ Accept'}
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading !== null}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              actionLoading === 'reject'
                ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                : 'bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300'
            }`}
          >
            {actionLoading === 'reject' ? 'Rejecting…' : '✗ Reject'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Filter Controls ───────────────────────────────────────────────────────

function FilterControls({
  sortKey, sortDir, statusFilter,
  onSortKey, onSortDir, onStatus,
}: {
  sortKey: SortKey; sortDir: SortDir; statusFilter: StatusFilter
  onSortKey: (k: SortKey) => void
  onSortDir: (d: SortDir) => void
  onStatus: (s: StatusFilter) => void
}) {
  const statusOptions: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Accepted', value: 'accepted' },
    { label: 'Rejected', value: 'rejected' },
  ]

  const sortOptions: { label: string; value: SortKey }[] = [
    { label: 'Reputation', value: 'reputation' },
    { label: 'Bid Amount', value: 'amount' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status filter pills */}
      <div className="flex gap-1.5">
        {statusOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => onStatus(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              statusFilter === opt.value
                ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-md'
                : 'bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-700/60 border border-gray-700/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-gray-500 font-medium">Sort by:</span>
        <select
          value={sortKey}
          onChange={e => onSortKey(e.target.value as SortKey)}
          className="px-3 py-1.5 bg-gray-900/70 border border-gray-700/50 rounded-lg text-sm
            text-gray-300 focus:outline-none focus:border-[#9945FF]/50 cursor-pointer"
        >
          {sortOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="p-1.5 rounded-lg bg-gray-800/60 border border-gray-700/50 text-gray-400
            hover:text-white hover:bg-gray-700/60 transition-colors text-xs"
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>
  )
}

// ─── Pagination ─────────────────────────────────────────────────────────────

function Pagination({
  page, totalPages, onPage,
}: {
  page: number; totalPages: number; onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60
          disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ‹ Prev
      </button>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
            p === page
              ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60
          disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next ›
      </button>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function BidListPage() {
  const { id: taskId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { publicKey } = useWallet()

  const [task, setTask] = useState<{ title: string; creator_wallet: string } | null>(null)
  const [bids, setBids] = useState<RawBid[]>([])
  const [profiles, setProfiles] = useState<Map<string, BidderProfile>>(new Map())

  const [loadingBids, setLoadingBids] = useState(true)
  const [taskLoaded, setTaskLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<SortKey>('reputation')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  // Load task info
  const loadTask = useCallback(async () => {
    if (!taskId) return
    try {
      const t = await getTask(taskId)
      setTask({ title: t.title, creator_wallet: (t as unknown as { creator_wallet?: string; publisher?: { address?: string } }).creator_wallet || (t as unknown as { publisher?: { address: string } }).publisher?.address || '' })
      setTaskLoaded(true)
    } catch {
      setTaskLoaded(true)
    }
  }, [taskId])

  // Load bids
  const loadBids = useCallback(async () => {
    if (!taskId) return
    setLoadingBids(true)
    setError(null)
    try {
      const data = await getTaskBids(taskId)
      setBids(data)
    } catch {
      setError('Failed to load bids. Please try again.')
    } finally {
      setLoadingBids(false)
    }
  }, [taskId])

  useEffect(() => {
    if (!taskId) return
    loadTask()
    loadBids()
  }, [taskId, loadTask, loadBids])

  // Load user profiles for each unique bidder
  useEffect(() => {
    if (bids.length === 0) return

    const wallets = [...new Set(bids.map(b => b.bidder_wallet))]
    const newProfiles = new Map(profiles)

    wallets.forEach(wallet => {
      if (!newProfiles.has(wallet)) {
        newProfiles.set(wallet, { wallet, username: null, reputation: 0, skills: [], loading: true })
        setProfiles(new Map(newProfiles))

        getUserByWallet(wallet)
          .then(user => {
            setProfiles(prev => {
              const next = new Map(prev)
              next.set(wallet, {
                wallet,
                username: user.username ?? null,
                reputation: user.reputation ?? 0,
                skills: user.skills ?? [],
                loading: false,
              })
              return next
            })
          })
          .catch(() => {
            setProfiles(prev => {
              const next = new Map(prev)
              next.set(wallet, { wallet, username: null, reputation: 0, skills: [], loading: false })
              return next
            })
          })
      }
    })
  }, [bids]) // eslint-disable-line react-hooks/exhaustive-deps

  const isCreator = publicKey && task ? publicKey.toBase58() === task.creator_wallet : false

  // ── Accept / Reject ──────────────────────────────────────────────────────
  const handleAccept = async (bidId: string) => {
    try {
      await acceptBid(bidId)
      setBids(prev => prev.map(b => b.id === bidId ? { ...b, status: BidStatus.Accepted } : b))
    } catch (err) {
      alert('Failed to accept bid: ' + String(err))
    }
  }

  const handleReject = async (bidId: string) => {
    try {
      await rejectBid(bidId)
      setBids(prev => prev.map(b => b.id === bidId ? { ...b, status: BidStatus.Rejected } : b))
    } catch (err) {
      alert('Failed to reject bid: ' + String(err))
    }
  }

  // ── Filter + Sort + Paginate ─────────────────────────────────────────────
  const filtered = bids
    .filter(b => statusFilter === 'all' || b.status === statusFilter)
    .sort((a, b) => {
      if (sortKey === 'amount') {
        const diff = parseFloat(a.amount) - parseFloat(b.amount)
        return sortDir === 'asc' ? diff : -diff
      }
      // reputation — look up from profiles
      const repA = profiles.get(a.bidder_wallet)?.reputation ?? 0
      const repB = profiles.get(b.bidder_wallet)?.reputation ?? 0
      return sortDir === 'asc' ? repA - repB : repB - repA
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 when filter/sort changes
  const handleSortKey = (k: SortKey) => { setSortKey(k); setPage(1) }
  const handleSortDir = (d: SortDir) => { setSortDir(d); setPage(1) }
  const handleStatus  = (s: StatusFilter) => { setStatusFilter(s); setPage(1) }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-gray-800/60 border border-gray-700/50 text-gray-400
            hover:text-white hover:bg-gray-700/60 transition-colors text-sm"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">
            {!taskLoaded ? (
              <span className="inline-block w-48 h-6 bg-gray-800/50 rounded animate-pulse" />
            ) : (
              task ? `Bids — ${task.title}` : 'Bids'
            )}
          </h1>
          {!loadingBids && (
            <p className="text-gray-500 text-xs mt-0.5">{filtered.length} bid{filtered.length !== 1 ? 's' : ''} found</p>
          )}
        </div>
      </div>

      {/* Filters */}
      {!loadingBids && bids.length > 0 && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-4">
          <FilterControls
            sortKey={sortKey} sortDir={sortDir} statusFilter={statusFilter}
            onSortKey={handleSortKey} onSortDir={handleSortDir} onStatus={handleStatus}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-6 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={loadBids}
            className="text-sm text-gray-400 hover:text-white underline transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loadingBids && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <BidSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loadingBids && !error && bids.length === 0 && (
        <div className="text-center py-16 bg-[#111827] border border-gray-800/60 rounded-xl space-y-2">
          <span className="text-4xl">📋</span>
          <p className="text-gray-300 font-medium">No bids yet</p>
          <p className="text-gray-600 text-sm">Be the first to place a bid!</p>
          <Link
            to={`/task/${taskId}`}
            className="inline-block mt-3 px-5 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195]
              text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            View Task
          </Link>
        </div>
      )}

      {/* No results after filter */}
      {!loadingBids && !error && bids.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 bg-[#111827] border border-gray-800/60 rounded-xl space-y-1">
          <span className="text-3xl">🔍</span>
          <p className="text-gray-400 text-sm">No bids match the current filter</p>
          <button
            onClick={() => handleStatus('all')}
            className="text-sm text-[#9945FF] hover:text-[#b366ff] underline transition-colors mt-2"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Bid cards */}
      {!loadingBids && paged.length > 0 && (
        <div className="space-y-3">
          {paged.map(bid => (
            <BidCard
              key={bid.id}
              bid={bid}
              profile={profiles.get(bid.bidder_wallet) ?? {
                wallet: bid.bidder_wallet,
                username: null,
                reputation: 0,
                skills: [],
                loading: true,
              }}
              canManage={!!isCreator}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loadingBids && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      )}
    </div>
  )
}
