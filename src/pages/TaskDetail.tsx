// ============================================================
// Claw Universe — TaskDetail Page
// 任务详情页：使用 getTaskDetail API，并行加载任务 + 投标列表
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTaskDetail } from '../api/task'
import type { Task, RawBid } from '../types/api'
import type { FrontendTaskStatus } from '../api/transformers'
import BidList from '../components/BidList'
import BidForm from '../components/BidForm'

// ─── Status Badge ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<FrontendTaskStatus, { label: string; bg: string; text: string; dot: string }> = {
  open:        { label: 'OPEN',        bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  assigned:    { label: 'ASSIGNED',    bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  in_progress: { label: 'WORKING',   bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
  submitted:   { label: 'SUBMITTED', bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-400' },
  completed:   { label: 'COMPLETED',  bg: 'bg-gray-500/15',    text: 'text-gray-400',     dot: 'bg-gray-400' },
  cancelled:   { label: 'CANCELLED',  bg: 'bg-red-500/15',     text: 'text-red-400',      dot: 'bg-red-400' },
  disputed:    { label: 'DISPUTED',   bg: 'bg-orange-500/15',   text: 'text-orange-400',   dot: 'bg-orange-400' },
}

// ─── Criteria Row ────────────────────────────────────────────────────────
interface Criteria {
  id?: number
  text: string
  done?: boolean
}

function CriteriaRow({ text, index, done }: { text: string; index: number; done?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-gray-800/40 last:border-0">
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
        done
          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
          : 'bg-gray-800/50 border-gray-700 text-gray-600'
      }`}>
        {done ? (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <span className="text-xs">{index + 1}</span>
        )}
      </div>
      <span className={`text-sm leading-relaxed ${done ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
        {text}
      </span>
    </li>
  )
}

// ─── Publisher Card ───────────────────────────────────────────────────────
function PublisherCard({ publisher }: { publisher: NonNullable<Task['publisher']> }) {
  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Publisher</h3>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white font-bold text-lg shrink-0">
          {publisher.address.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm text-white truncate">{publisher.address}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-yellow-400 text-sm">★</span>
            <span className="text-gray-300 text-sm font-medium">{publisher.reputation}</span>
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
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-4">
          <div className="h-4 w-24 bg-gray-800/60 rounded" />
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-3 bg-gray-800/40 rounded" style={{ width: `${95 - i * 3}%` }} />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 h-48" />
          <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 h-64" />
        </div>
      </div>
    </div>
  )
}

// ─── Page Component ──────────────────────────────────────────────────────
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()


  const [task, setTask]             = useState<Task | null>(null)
  const [bids, setBids]             = useState<RawBid[] | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  // 并行加载任务详情 + 投标列表
  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { task: loadedTask, bids: loadedBids } = await getTaskDetail(id)
      setTask(loadedTask)
      setBids(loadedBids)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load task details'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  // ── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-4xl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors group">
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back
        </button>
        <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-8 text-center">
          <span className="text-4xl mb-3 block">⚠️</span>
          <h3 className="text-red-400 font-semibold mb-2">Failed to load task</h3>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-5 py-2 bg-[#9945FF]/20 border border-[#9945FF]/40 rounded-xl text-sm text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ── Loading state ───────────────────────────────────────────────────
  if (loading || !task) {
    return <TaskDetailSkeleton />
  }

  // ── Derived values ──────────────────────────────────────────────────
  const statusConfig = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.open
  const daysLeft = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const deadlineColor = daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-400'

  // 如果 API 没有返回 acceptanceCriteria，生成默认值
  const criteria: Criteria[] = task.acceptanceCriteria
    ? task.acceptanceCriteria.map((c, i) => (typeof c === 'string' ? { text: c, done: false, id: i } : c))
    : task.description
        .split(/[•·]\s/)
        .filter(l => l.trim().length > 20)
        .slice(0, 5)
        .map((text, i) => ({ text: text.trim(), done: false, id: i }))

  const doneCount = criteria.filter(c => c.done).length

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-6">

      {/* Back navigation */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors group"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span>
        Back to Task Square
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
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">{task.title}</h1>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Reward</span>
            <span className="text-xl font-bold text-[#14F195]">{task.reward} SOL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Bids</span>
            <span className="text-white font-medium">{bids?.length ?? task.bids}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Deadline</span>
            <span className="text-white font-medium">{task.deadline}</span>
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

        {/* Left Column (2/3) */}
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
              {task.skills.map(skill => (
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
          {criteria.length > 0 && (
            <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Acceptance Criteria</h2>
                <span className="text-xs text-gray-500">{doneCount}/{criteria.length} completed</span>
              </div>
              <ul>
                {criteria.map((c, i) => (
                  <CriteriaRow key={c.id ?? i} text={c.text} index={i} done={c.done} />
                ))}
              </ul>
            </div>
          )}

          {/* Bids List (mobile / full-width) */}
          <div className="lg:hidden space-y-4">
            {task.status === 'open' && (
              <BidForm
                taskId={task.id}
                bidRange={task.bidRange}
                onSuccess={loadData}
              />
            )}
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Bids ({bids?.length ?? 0})
              </h2>
              <BidList
                taskId={task.id}
                creatorWallet={task.publisher?.address}
                initialBids={bids ?? undefined}
              />
            </div>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="hidden lg:block space-y-4">

          {/* Quick action teaser */}
          {task.status === 'open' && (
            <div className="bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/10 border border-[#9945FF]/20 rounded-2xl p-5 text-center">
              <p className="text-white font-semibold mb-1">Ready to work?</p>
              <p className="text-gray-400 text-xs mb-4">Place your bid and get started</p>
              <div className="text-2xl font-bold text-[#14F195] mb-1">{task.reward} SOL</div>
              <p className="text-gray-600 text-xs">available reward</p>
            </div>
          )}

          {/* Bid form */}
          {task.status === 'open' && (
            <BidForm
              taskId={task.id}
              bidRange={task.bidRange}
              onSuccess={loadData}
            />
          )}

          {/* Bid list */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Bids ({bids?.length ?? 0})
            </h3>
            <BidList
              taskId={task.id}
              creatorWallet={task.publisher?.address}
              initialBids={bids ?? undefined}
            />
          </div>

          {/* Publisher card */}
          {task.publisher && <PublisherCard publisher={task.publisher} />}
        </div>
      </div>
    </div>
  )
}
