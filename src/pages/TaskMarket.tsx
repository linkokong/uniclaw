import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { getTasks } from '../api/task'
import { BackendTaskStatus } from '../types/api'
import type { Task } from '../types/api'
import { TaskCard } from '../components/TaskCard'
import { FilterBar, WalletBanner } from '../components/FilterBar'
import type { FilterState, BudgetRange, SortOption } from '../components/FilterBar'
import { createTaskOnChain, ANCHOR_PROGRAM_ID } from '../utils/anchor'

// ─── Default filter state ─────────────────────────────────────────────────
const DEFAULT_FILTERS: FilterState = {
  typeFilter:   'open',
  budgetFilter: 'all',
  sortBy:       'newest',
  searchQuery:  '',
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function matchesBudget(reward: number, range: BudgetRange): boolean {
  if (range === 'all') return true
  if (range === '10+')  return reward >= 10
  const [min, max] = range.split('-').map(Number)
  return reward >= min && reward <= max
}

function matchesType(task: Task, type: FilterState['typeFilter']): boolean {
  if (type === 'all')       return true
  if (type === 'open')      return task.status === 'open'
  if (type === 'in_progress') return task.status === 'in_progress'
  return true
}

function matchesSearch(task: Task, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.toLowerCase()
  return (
    task.title.toLowerCase().includes(lower) ||
    task.description.toLowerCase().includes(lower) ||
    task.skills.some((s) => s.toLowerCase().includes(lower))
  )
}

function sortTasks(tasks: Task[], sortBy: SortOption): Task[] {
  return [...tasks].sort((a, b) => {
    if (sortBy === 'deadline') {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    }
    if (sortBy === 'reward') return b.reward - a.reward
    if (sortBy === 'bids')   return b.bids - a.bids
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() // newest
  })
}

// ─── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-16 bg-[#111827] border border-gray-800/70 rounded-2xl">
      <span className="text-4xl mb-4 block">🔍</span>
      <p className="text-gray-400 font-medium">
        {hasFilters ? 'No tasks match your filters' : 'No tasks available'}
      </p>
      <p className="text-gray-600 text-sm mt-1">
        {hasFilters ? 'Try adjusting your search or filters' : 'Check back soon for new tasks'}
      </p>
    </div>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 animate-pulse"
        >
          <div className="flex justify-between mb-3">
            <div className="space-y-2 flex-1">
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-gray-700/50 rounded" />
                <div className="h-5 w-24 bg-gray-700/50 rounded" />
              </div>
              <div className="h-5 w-3/4 bg-gray-700/50 rounded" />
            </div>
            <div className="h-8 w-16 bg-gray-700/50 rounded" />
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-3 w-full bg-gray-700/50 rounded" />
            <div className="h-3 w-2/3 bg-gray-700/50 rounded" />
          </div>
          <div className="flex gap-2 mb-4">
            <div className="h-5 w-16 bg-gray-700/50 rounded" />
            <div className="h-5 w-20 bg-gray-700/50 rounded" />
            <div className="h-5 w-14 bg-gray-700/50 rounded" />
          </div>
          <div className="flex justify-between pt-3 border-t border-gray-800/50">
            <div className="h-3 w-24 bg-gray-700/50 rounded" />
            <div className="h-8 w-28 bg-gray-700/50 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Error State ───────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-16 bg-[#111827] border border-red-900/40 rounded-2xl">
      <span className="text-4xl mb-4 block">⚠️</span>
      <p className="text-red-400 font-medium">Failed to load tasks</p>
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
export default function TaskMarket() {
  const { connected, publicKey, signTransaction } = useWallet()

  const [tasks, setTasks]         = useState<Task[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [filters, setFilters]     = useState<FilterState>(DEFAULT_FILTERS)
  const [page, setPage]           = useState(1)
  const [showOnChainModal, setShowOnChainModal] = useState(false)
  const [ocTitle, setOcTitle]     = useState('')
  const [ocDesc, setOcDesc]       = useState('')
  const [ocReward, setOcReward]   = useState('')
  const [ocSkills, setOcSkills]   = useState('')
  const [ocDeadline, setOcDeadline] = useState('')
  const [ocLoading, setOcLoading] = useState(false)
  const [ocError, setOcError]     = useState<string | null>(null)
  const [ocSuccess, setOcSuccess] = useState(false)
  const PAGE_SIZE = 20

  // ── Fetch tasks ─────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async (pageNum = 1) => {
    setLoading(true)
    setError(null)
    try {
      // Only request open tasks from API; type filter is client-side
      const { tasks: fetched } = await getTasks({ status: BackendTaskStatus.Created, page: pageNum, limit: PAGE_SIZE })
      setTasks(fetched)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks(1)
  }, [fetchTasks])

  // ── Client-side filter + sort ───────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    const base = tasks.filter(
      (t) => matchesType(t, filters.typeFilter)
         && matchesBudget(t.reward, filters.budgetFilter)
         && matchesSearch(t, filters.searchQuery)
    )
    return sortTasks(base, filters.sortBy)
  }, [tasks, filters])

  const openCount = tasks.filter((t) => t.status === 'open').length

  // ── Page header ─────────────────────────────────────────────────────────
  const hasActiveFilters =
    filters.typeFilter !== DEFAULT_FILTERS.typeFilter ||
    filters.budgetFilter !== DEFAULT_FILTERS.budgetFilter ||
    filters.sortBy !== DEFAULT_FILTERS.sortBy ||
    filters.searchQuery !== ''

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Square</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading
              ? 'Loading…'
              : `${openCount} open tasks · Powered by Solana`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnChainModal(true)}
            disabled={!connected}
            title={connected ? 'Create task directly on-chain' : 'Connect wallet to create on-chain task'}
            className="flex items-center gap-2 px-4 py-2.5
              bg-gradient-to-r from-[#14F195]/80 to-[#14F195]
              rounded-xl text-sm font-semibold text-black
              hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-base leading-none">⚡</span>
            On-chain
          </button>
          <button
            onClick={() => fetchTasks(page)}
            className="flex items-center gap-2 px-4 py-2.5
              bg-[#1f2937] border border-gray-600
              rounded-xl text-sm font-medium text-gray-300
              hover:border-[#9945FF]/50 hover:text-white transition-all"
            title="Refresh"
          >
            ↻
          </button>
          <Link
            to="/create-task"
            className="flex items-center gap-2 px-5 py-2.5
              bg-gradient-to-r from-[#9945FF] to-[#14F195]
              rounded-xl text-sm font-semibold text-white
              hover:opacity-90 transition-opacity"
          >
            <span className="text-base leading-none">+</span>
            Post Task
          </Link>
        </div>
      </div>

      {/* ── Wallet Banner ── */}
      {!connected && <WalletBanner />}

      {/* ── Filter Bar ── */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={tasks.length}
        filteredCount={filteredTasks.length}
      />

      {/* ── Task List ── */}
      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => fetchTasks(page)} />
      )}

      {!loading && !error && filteredTasks.length === 0 && (
        <EmptyState hasFilters={hasActiveFilters} />
      )}

      {!loading && !error && filteredTasks.length > 0 && (
        <div className="grid gap-4">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && tasks.length >= PAGE_SIZE && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => { setPage((p) => Math.max(1, p - 1)); fetchTasks(page - 1) }}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40
              disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-gray-500 text-sm">
            Page {page}
          </span>
          <button
            onClick={() => { setPage((p) => p + 1); fetchTasks(page + 1) }}
            disabled={filteredTasks.length < PAGE_SIZE}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40
              disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── On-chain Task Creation Modal ── */}
      {showOnChainModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowOnChainModal(false) }}
        >
          <div className="bg-[#111827] border border-[#14F195]/30 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white">Create On-chain Task</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  via Anchor · {ANCHOR_PROGRAM_ID.toBase58().slice(0, 12)}…
                </p>
              </div>
              <button
                onClick={() => setShowOnChainModal(false)}
                className="text-gray-500 hover:text-white text-2xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Success state */}
            {ocSuccess && (
              <div className="text-center py-6 space-y-3">
                <span className="text-4xl">✅</span>
                <p className="text-emerald-400 font-semibold">Task Created On-chain!</p>
                <p className="text-gray-500 text-xs">Your task is now stored permanently on Solana.</p>
                <button
                  onClick={() => {
                    setShowOnChainModal(false)
                    setOcSuccess(false)
                    setOcTitle(''); setOcDesc(''); setOcReward(''); setOcSkills(''); setOcDeadline('')
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Form */}
            {!ocSuccess && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Task Title</label>
                  <input
                    type="text"
                    value={ocTitle}
                    onChange={(e) => setOcTitle(e.target.value)}
                    placeholder="e.g. Build a React dashboard"
                    maxLength={100}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Description</label>
                  <textarea
                    value={ocDesc}
                    onChange={(e) => setOcDesc(e.target.value)}
                    placeholder="Describe the task…"
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#14F195]/50 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Reward (SOL)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={ocReward}
                        onChange={(e) => setOcReward(e.target.value)}
                        placeholder="1.0"
                        min="0.01"
                        step="0.1"
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">SOL</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Skills (comma-sep)</label>
                    <input
                      type="text"
                      value={ocSkills}
                      onChange={(e) => setOcSkills(e.target.value)}
                      placeholder="React, Solidity"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Verification Period (days)</label>
                  <input
                    type="number"
                    value={ocDeadline}
                    onChange={(e) => setOcDeadline(e.target.value)}
                    placeholder="7"
                    min="1"
                    max="90"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50 transition-all"
                  />
                </div>

                {/* Warning */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
                  <p className="text-yellow-400 text-xs font-medium">
                    ⚠ Funds will be escrowed immediately (SOL)
                  </p>
                  <p className="text-yellow-500/70 text-[10px] mt-0.5">
                    Min 7-day verification period · Reward in lamports
                  </p>
                </div>

                {/* Error */}
                {ocError && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {ocError}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowOnChainModal(false); setOcTitle(''); setOcDesc(''); setOcReward(''); setOcSkills(''); setOcDeadline('') }}
                    className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const numReward = parseFloat(ocReward)
                      if (!ocTitle.trim() || !ocReward || isNaN(numReward) || numReward <= 0) {
                        setOcError('请输入有效的奖励金额')
                        return
                      }
                      const days = parseInt(ocDeadline || '7', 10)
                      if (isNaN(days) || days < 1 || days > 90) {
                        setOcError('验证期限需在 1-90 天之间')
                        return
                      }
                      if (!publicKey) {
                        setOcError('请连接钱包')
                        return
                      }
                      setOcLoading(true)
                      setOcError(null)
                      try {
                        const rewardLamports = Math.round(numReward * 1e9)
                        if (isNaN(rewardLamports) || rewardLamports <= 0) {
                          setOcError('奖励金额计算错误')
                          return
                        }
                        const skills = ocSkills
                          .split(',')
                          .map(s => s.trim())
                          .filter(Boolean)
                        const verificationPeriodSec = days * 24 * 60 * 60
                        await createTaskOnChain(
                          { publicKey, signTransaction: signTransaction as never, signAllTransactions: undefined },
                          ocTitle.trim(),
                          ocDesc.trim(),
                          skills,
                          rewardLamports,
                          verificationPeriodSec,
                        )
                        setOcSuccess(true)
                      } catch (err: any) {
                        setOcError(err?.message ?? 'Transaction failed')
                      } finally {
                        setOcLoading(false)
                      }
                    }}
                    disabled={ocLoading || !ocTitle.trim() || !ocReward}
                    className="flex-1 py-2.5 bg-[#14F195] hover:bg-[#14F195]/90 text-black font-semibold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ocLoading ? 'Creating…' : '⚡ Create On-chain'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
