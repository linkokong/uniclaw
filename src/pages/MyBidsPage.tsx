// ============================================================
// Claw Universe — MyBidsPage (src/pages/MyBidsPage.tsx)
// 我的投标页面：展示当前用户发出的所有投标，支持撤回
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { getMyBids, withdrawBid } from '../api/bid'
import type { Bid } from '../types/api'
import { BidStatus } from '../types/api'

// ─── Status Badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: '待接受',   bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  accepted:  { label: '已接受',   bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  rejected:  { label: '已拒绝',   bg: 'bg-red-500/15',     text: 'text-red-400' },
  withdrawn: { label: '已撤回',   bg: 'bg-gray-500/15',   text: 'text-gray-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-500/15', text: 'text-gray-400' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function BidSkeleton() {
  return (
    <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 w-40 bg-gray-800/50 rounded" />
        <div className="h-5 w-16 bg-gray-800/50 rounded" />
      </div>
      <div className="h-3 w-full bg-gray-800/40 rounded mb-2" />
      <div className="h-3 w-2/3 bg-gray-800/40 rounded" />
    </div>
  )
}

// ─── Single Bid Row ────────────────────────────────────────────────────────

function BidRow({
  bid,
  onWithdraw,
}: {
  bid: Bid
  onWithdraw: (id: string) => void
}) {
  const [withdrawing, setWithdrawing] = useState(false)
  const isPending = bid.status === BidStatus.Pending

  const handleWithdraw = async () => {
    if (!confirm('确定撤回此投标？')) return
    setWithdrawing(true)
    try { await onWithdraw(bid.id) } finally { setWithdrawing(false) }
  }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(bid.createdAt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}小时前`
    return `${Math.floor(hrs / 24)}天前`
  })()

  return (
    <div className="bg-[#111827] border border-gray-800/60 rounded-xl p-5 hover:border-gray-700/70 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <Link
            to={`/task/${bid.taskId}`}
            className="text-white font-semibold text-sm hover:text-[#14F195] transition-colors truncate block"
          >
            投标任务 #{bid.taskId.slice(0, 8)}
          </Link>
          <p className="text-gray-500 text-xs mt-0.5">{timeAgo}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={bid.status} />
          <p className="text-[#14F195] font-bold text-lg">
            {bid.bidAmount.toFixed(2)} SOL
          </p>
          <p className="text-gray-500 text-xs">{bid.estimatedDuration}</p>
        </div>
      </div>

      {/* Proposal */}
      <p className="text-sm text-gray-300 leading-relaxed mb-4 line-clamp-2">
        {bid.proposal}
      </p>

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2 pt-3 border-t border-gray-800/50">
          <Link
            to={`/task/${bid.taskId}`}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-center bg-gray-800/60 text-gray-300 hover:bg-gray-700/60 hover:text-white transition-all"
          >
            查看任务
          </Link>
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {withdrawing ? '撤回中…' : '撤回投标'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function MyBidsPage() {
  const navigate = useNavigate()
  const { publicKey } = useWallet()

  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | BidStatus>('all')

  const loadBids = useCallback(async () => {
    if (!publicKey) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const res = await getMyBids()
      setBids(res.bids)
    } catch {
      setError('加载投标失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [publicKey])

  useEffect(() => { loadBids() }, [loadBids])

  const handleWithdraw = async (bidId: string) => {
    try {
      await withdrawBid(bidId)
      setBids(prev => prev.map(b => b.id === bidId ? { ...b, status: BidStatus.Withdrawn } : b))
    } catch (err) {
      alert('撤回失败：' + String(err))
    }
  }

  const filtered = filter === 'all' ? bids : bids.filter(b => b.status === filter)

  const filterOptions: { label: string; value: 'all' | BidStatus }[] = [
    { label: '全部', value: 'all' },
    { label: '待接受', value: BidStatus.Pending },
    { label: '已接受', value: BidStatus.Accepted },
    { label: '已拒绝', value: BidStatus.Rejected },
    { label: '已撤回', value: BidStatus.Withdrawn },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors text-sm"
        >
          ← 返回
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">我的投标</h1>
          {!loading && (
            <p className="text-gray-500 text-xs mt-0.5">{filtered.length} 个投标</p>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      {!loading && bids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                filter === opt.value
                  ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-md'
                  : 'bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-700/60 border border-gray-700/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
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
            重试
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <BidSkeleton key={i} />)}
        </div>
      )}

      {/* Empty — not connected */}
      {!loading && !publicKey && (
        <div className="text-center py-16 bg-[#111827] border border-gray-800/60 rounded-xl space-y-2">
          <span className="text-4xl">🔗</span>
          <p className="text-gray-300 font-medium">请先连接钱包</p>
          <p className="text-gray-600 text-sm">连接钱包后查看您的投标</p>
        </div>
      )}

      {/* Empty — no bids */}
      {!loading && publicKey && bids.length === 0 && !error && (
        <div className="text-center py-16 bg-[#111827] border border-gray-800/60 rounded-xl space-y-2">
          <span className="text-4xl">📋</span>
          <p className="text-gray-300 font-medium">暂无投标</p>
          <p className="text-gray-600 text-sm">去任务广场寻找适合您的任务吧</p>
          <Link
            to="/market"
            className="inline-block mt-3 px-5 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            任务广场
          </Link>
        </div>
      )}

      {/* No results after filter */}
      {!loading && bids.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 bg-[#111827] border border-gray-800/60 rounded-xl space-y-1">
          <span className="text-3xl">🔍</span>
          <p className="text-gray-400 text-sm">没有符合条件的投标</p>
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-[#9945FF] hover:text-[#b366ff] underline transition-colors mt-2"
          >
            清除筛选
          </button>
        </div>
      )}

      {/* Bid list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(bid => (
            <BidRow key={bid.id} bid={bid} onWithdraw={handleWithdraw} />
          ))}
        </div>
      )}
    </div>
  )
}
