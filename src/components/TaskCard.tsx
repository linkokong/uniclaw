import { Link } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import type { Task } from '../types/api'

// ─── Status Badge ─────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: Task['status'] }) {
  const config = {
    open:       { label: 'OPEN',       bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    assigned:   { label: 'ASSIGNED',   bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400' },
    in_progress:{ label: 'WORKING',   bg: 'bg-yellow-500/15',   text: 'text-yellow-400',  dot: 'bg-yellow-400' },
    submitted:  { label: 'SUBMITTED',  bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-400' },
    completed:  { label: 'COMPLETED', bg: 'bg-gray-500/15',    text: 'text-gray-400',     dot: 'bg-gray-400' },
    cancelled:  { label: 'CANCELLED', bg: 'bg-red-500/15',     text: 'text-red-400',     dot: 'bg-red-400' },
    disputed:   { label: 'DISPUTED',  bg: 'bg-orange-500/15',  text: 'text-orange-400',  dot: 'bg-orange-400' },
  }[status] ?? { label: 'UNKNOWN', bg: '', text: '', dot: '' }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

// ─── Skill Tag ────────────────────────────────────────────────────────────
export function SkillTag({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 bg-[#9945FF]/10 border border-[#9945FF]/20 rounded text-xs text-[#9945FF]">
      {label}
    </span>
  )
}

// ─── Category Badge ────────────────────────────────────────────────────────
export function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 bg-gray-800/60 border border-gray-700/50 rounded-lg text-xs text-gray-400">
      {label}
    </span>
  )
}

// ─── Task Card ─────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task
  /** Override the default link target (e.g. when already on detail page) */
  linkTo?: string
}

export function TaskCard({ task, linkTo }: TaskCardProps) {
  const { connected } = useWallet()
  const isOpen = task.status === 'open'
  const href = linkTo ?? `/tasks/${task.id}`

  const daysLeft = Math.ceil(
    (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const deadlineColor =
    daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-400'

  return (
    <Link to={href}>
      <article className="group bg-[#111827] border border-gray-800/70 rounded-2xl p-5
        hover:border-[#9945FF]/40 hover:bg-[#1a2235]
        hover:shadow-xl hover:shadow-purple-500/5
        transition-all duration-250 cursor-pointer">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <CategoryBadge label={task.category} />
              <StatusBadge status={task.status} />
            </div>
            <h3 className="text-base font-semibold text-white group-hover:text-[#14F195] transition-colors leading-snug">
              {task.title}
            </h3>
          </div>

          {/* Reward */}
          <div className="ml-4 text-right shrink-0">
            <p className="text-lg font-bold text-[#14F195]">{task.reward} SOL</p>
            <p className={`text-xs ${deadlineColor}`}>
              {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Due today' : 'Expired'}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
          {task.description}
        </p>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {task.skills.slice(0, 5).map((s) => (
            <SkillTag key={s} label={s} />
          ))}
          {task.skills.length > 5 && (
            <span className="px-2 py-0.5 text-xs text-gray-500">+{task.skills.length - 5}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span>👥</span> {task.bids} bid{task.bids !== 1 ? 's' : ''}
            </span>
            <span className="hidden sm:inline text-gray-700">•</span>
            <span className="hidden sm:inline flex items-center gap-1">
              <span>📅</span> {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          <button
            disabled={!connected || !isOpen}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              connected && isOpen
                ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 active:scale-95'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isOpen ? 'View Details →' : 'Unavailable'}
          </button>
        </div>
      </article>
    </Link>
  )
}
