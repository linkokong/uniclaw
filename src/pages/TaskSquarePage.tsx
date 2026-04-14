import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'

// ─── Mock Data ────────────────────────────────────────────────────────────
interface Task {
  id: string
  title: string
  description: string
  reward: number
  status: 'open' | 'in_progress' | 'completed'
  deadline: string
  category: string
  bids: number
  skills: string[]
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'AI Article Writer Agent',
    description: 'Create a React agent that writes tech articles on Solana ecosystem. Must integrate with GPT-4 and support markdown export.',
    reward: 5,
    status: 'open',
    deadline: '2026-04-15',
    category: 'AI Agent',
    bids: 3,
    skills: ['React', 'TypeScript', 'OpenAI API'],
  },
  {
    id: '2',
    title: 'DeFi Analytics Dashboard',
    description: 'Build a real-time dashboard for tracking DeFi protocols on Solana with portfolio tracking and yield comparisons.',
    reward: 10,
    status: 'open',
    deadline: '2026-04-20',
    category: 'Development',
    bids: 7,
    skills: ['React', 'Web3', 'Chart.js'],
  },
  {
    id: '3',
    title: 'Social Media Bot',
    description: 'Automated Twitter bot for crypto news aggregation with sentiment analysis and auto-post capabilities.',
    reward: 3,
    status: 'in_progress',
    deadline: '2026-04-10',
    category: 'Automation',
    bids: 5,
    skills: ['Python', 'Twitter API', 'NLP'],
  },
  {
    id: '4',
    title: 'NFT Marketplace Frontend',
    description: 'Design and build a modern NFT marketplace UI with wallet integration and lazy minting support.',
    reward: 8,
    status: 'open',
    deadline: '2026-04-25',
    category: 'Development',
    bids: 12,
    skills: ['React', 'Solana SDK', 'CSS'],
  },
  {
    id: '5',
    title: 'Trading Signal Bot',
    description: 'Build an automated bot that monitors DEX pools and sends trading signals to a Discord channel.',
    reward: 6,
    status: 'open',
    deadline: '2026-04-18',
    category: 'Automation',
    bids: 4,
    skills: ['Python', 'Solana RPC', 'Discord API'],
  },
]

// ─── Filter Types ─────────────────────────────────────────────────────────
type TaskType = 'all' | 'open' | 'in_progress'
type BudgetRange = 'all' | '0-3' | '3-5' | '5-10' | '10+'
type SortBy = 'newest' | 'deadline' | 'reward' | 'bids'

// ─── Status Badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Task['status'] }) {
  const config = {
    open: { label: 'OPEN', bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    in_progress: { label: 'IN PROGRESS', bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400' },
    completed: { label: 'COMPLETED', bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400' },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

// ─── Skill Tag ────────────────────────────────────────────────────────────
function SkillTag({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 bg-[#9945FF]/10 border border-[#9945FF]/20 rounded text-xs text-[#9945FF]">
      {label}
    </span>
  )
}

// ─── Category Badge ───────────────────────────────────────────────────────
function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 bg-gray-800/60 border border-gray-700/50 rounded-lg text-xs text-gray-400">
      {label}
    </span>
  )
}

// ─── Filter Pill ──────────────────────────────────────────────────────────
function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-md'
          : 'bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-700/60 border border-gray-700/50'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Primary Button ───────────────────────────────────────────────────────
function PrimaryBtn({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        disabled
          ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
          : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 active:scale-95'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Wallet Connect Banner ────────────────────────────────────────────────
function WalletBanner() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔒</span>
        <div>
          <p className="text-amber-400 font-medium text-sm">Wallet not connected</p>
          <p className="text-amber-400/60 text-xs">Connect your wallet to browse tasks and place bids</p>
        </div>
      </div>
      <span className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed">
        Connect
      </span>
    </div>
  )
}

// ─── Search Input ────────────────────────────────────────────────────────
function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tasks by title, description, or skill..."
        className="w-full pl-10 pr-4 py-2.5 bg-gray-900/70 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF]/50 focus:ring-2 focus:ring-[#9945FF]/20 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── Budget Filter Dropdown ───────────────────────────────────────────────
function BudgetFilter({ value, onChange }: { value: BudgetRange; onChange: (v: BudgetRange) => void }) {
  const options: { label: string; value: BudgetRange }[] = [
    { label: 'All Budgets', value: 'all' },
    { label: '0–3 SOL', value: '0-3' },
    { label: '3–5 SOL', value: '3-5' },
    { label: '5–10 SOL', value: '5-10' },
    { label: '10+ SOL', value: '10+' },
  ]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as BudgetRange)}
      className="px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#9945FF]/50 cursor-pointer hover:bg-gray-800/70 transition-colors appearance-none"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '28px' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ─── Sort Dropdown ────────────────────────────────────────────────────────
function SortFilter({ value, onChange }: { value: SortBy; onChange: (v: SortBy) => void }) {
  const options: { label: string; value: SortBy }[] = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Deadline Soon', value: 'deadline' },
    { label: 'Highest Reward', value: 'reward' },
    { label: 'Most Bids', value: 'bids' },
  ]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortBy)}
      className="px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#9945FF]/50 cursor-pointer hover:bg-gray-800/70 transition-colors"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '28px' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────
function TaskCard({ task }: { task: Task }) {
  const { connected } = useWallet()
  const isOpen = task.status === 'open'

  const daysLeft = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const deadlineColor = daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-400'

  return (
    <Link to={`/tasks/${task.id}`}>
      <article className="group bg-[#111827] border border-gray-800/70 rounded-2xl p-5 hover:border-[#9945FF]/40 hover:bg-[#1a2235] hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-250 cursor-pointer">
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
              {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
          {task.description}
        </p>

        {/* Skills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {task.skills.map((s) => <SkillTag key={s} label={s} />)}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span>👥</span> {task.bids} bids
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline flex items-center gap-1">
              <span>📅</span> {task.deadline}
            </span>
          </div>
          <PrimaryBtn disabled={!connected || !isOpen}>
            {isOpen ? 'View Details →' : 'Unavailable'}
          </PrimaryBtn>
        </div>
      </article>
    </Link>
  )
}

// ─── Page Component ────────────────────────────────────────────────────────
export default function TaskSquarePage() {
  const { connected } = useWallet()
  const [typeFilter, setTypeFilter] = useState<TaskType>('open')
  const [budgetFilter, setBudgetFilter] = useState<BudgetRange>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = mockTasks
    .filter((t) => {
      if (typeFilter !== 'all' && t.status !== typeFilter) return false
      if (budgetFilter !== 'all') {
        const [min, max] = budgetFilter.split('-').map(Number)
        if (budgetFilter === '10+') { if (t.reward < 10) return false }
        else { if (t.reward < min || t.reward > max) return false }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q) && !t.skills.some(s => s.toLowerCase().includes(q))) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      if (sortBy === 'reward') return b.reward - a.reward
      if (sortBy === 'bids') return b.bids - a.bids
      return 0 // newest = default order
    })

  const openCount = mockTasks.filter(t => t.status === 'open').length

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Square</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {openCount} open tasks · Powered by Solana
          </p>
        </div>
        <Link
          to="/create-task"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <span className="text-base">+</span>
          Post Task
        </Link>
      </div>

      {/* ── Wallet Banner ── */}
      {!connected && <WalletBanner />}

      {/* ── Filters Row ── */}
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-4 space-y-4">
        {/* Search */}
        <SearchInput value={searchQuery} onChange={setSearchQuery} />

        {/* Filter Pills + Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Type:</span>
            <div className="flex gap-2">
              {(['all', 'open', 'in_progress'] as TaskType[]).map((f) => (
                <FilterPill key={f} active={typeFilter === f} onClick={() => setTypeFilter(f)}>
                  {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'In Progress'}
                </FilterPill>
              ))}
            </div>
          </div>

          <span className="hidden sm:inline text-gray-700">|</span>

          {/* Budget */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Budget:</span>
            <BudgetFilter value={budgetFilter} onChange={setBudgetFilter} />
          </div>

          <span className="hidden sm:inline text-gray-700">|</span>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Sort:</span>
            <SortFilter value={sortBy} onChange={setSortBy} />
          </div>

          {/* Result count */}
          <span className="ml-auto text-xs text-gray-500">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Task List ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-[#111827] border border-gray-800/70 rounded-2xl">
          <span className="text-4xl mb-4 block">🔍</span>
          <p className="text-gray-400 font-medium">No tasks found</p>
          <p className="text-gray-600 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
