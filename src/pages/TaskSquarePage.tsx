import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'
// fetchAllTasks removed — using fetchAllTasksWithPdas directly
import { chainTaskToTask, Task } from '../types/api'

// ─── Auto-refresh interval (2 minutes — avoid Devnet RPC rate limits) ───
const TASK_REFRESH_INTERVAL = 120000 // ms

// ─── Filter Types ─────────────────────────────────────────────────────────
type TaskType = 'all' | 'open' | 'assigned' | 'in_progress' | 'submitted'
type BudgetRange = 'all' | '0-3' | '3-5' | '5-10' | '10+'
type SortBy = 'newest' | 'deadline' | 'reward' | 'bids'

// ─── Status Badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Task['status'] }) {
  const config: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    open:       { label: 'OPEN',        bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    assigned:   { label: 'ASSIGNED',    bg: 'bg-blue-500/15',    text: 'text-blue-400',    dot: 'bg-blue-400' },
    in_progress:{ label: 'IN PROGRESS', bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
    submitted:  { label: 'SUBMITTED',   bg: 'bg-blue-500/15',     text: 'text-blue-400',     dot: 'bg-blue-400' },
    completed:  { label: 'COMPLETED',   bg: 'bg-gray-500/15',    text: 'text-gray-400',     dot: 'bg-gray-400' },
    cancelled:  { label: 'CANCELLED',   bg: 'bg-gray-500/15',    text: 'text-gray-500',     dot: 'bg-gray-500' },
    disputed:   { label: 'DISPUTED',    bg: 'bg-red-500/15',     text: 'text-red-400',      dot: 'bg-red-400' },
  }
  const c = config[status] ?? { label: status.toUpperCase(), bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
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
      {label || 'General'}
    </span>
  )
}

// ─── Filter Pill ──────────────────────────────────────────────────────────
function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
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
function PrimaryBtn({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <span className={`inline-block px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
      disabled
        ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
        : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white opacity-90'
    }`}>
      {children}
    </span>
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
      className="px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#9945FF]/50 cursor-pointer hover:bg-gray-800/70 transition-colors appearance-none"
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
  const deadlineDate = new Date(task.deadline)
  const daysLeft = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const deadlineColor = daysLeft <= 3 ? 'text-red-400' : daysLeft <= 7 ? 'text-yellow-400' : 'text-gray-400'

  return (
    <Link to={`/tasks/${task.id}`}>
      <article className="group bg-[#111827] border border-gray-800/70 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 hover:border-[#9945FF]/40 hover:bg-[#1a2235] hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-250 cursor-pointer">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <CategoryBadge label={task.category} />
              <StatusBadge status={task.status} />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-[#14F195] transition-colors leading-snug line-clamp-1">
              {task.title || 'Untitled Task'}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm sm:text-lg font-bold text-[#14F195]">{task.reward} {task.paymentType === 'token' ? 'UNIC' : 'SOL'}</p>
            <p className={`text-[10px] sm:text-xs ${deadlineColor}`}>
              {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Today' : 'Expired'}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-3 line-clamp-2">
          {task.description || 'No description provided'}
        </p>

        {/* Skills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(task.skills ?? []).slice(0, 4).map((s, i) => <SkillTag key={i} label={s} />)}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-800/50">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
            <span>👥 {task.bids ?? 0} bids</span>
            <span className="hidden sm:inline">• 📅 {task.deadline}</span>
          </div>
          <PrimaryBtn disabled={!connected || !isOpen}>
            {isOpen ? 'Details →' : 'N/A'}
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const cancelledRef = useRef(false)

  // Load tasks: DB first (fast), chain only on manual refresh to avoid 429
  const loadTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api/v1`
      const dbRes = await fetch(`${API_URL}/tasks?limit=100`).then(r => r.json()).catch(() => null)

      if (dbRes?.success && dbRes.data?.length > 0) {
        const dbTasks: Task[] = dbRes.data.map((raw: any) => ({
          id: raw.task_pda || raw.id,
          title: raw.title,
          description: raw.description,
          reward: parseFloat(raw.reward) || 0,
          status: raw.status === 'created' ? 'open' as const : raw.status,
          deadline: raw.verification_deadline ? new Date(raw.verification_deadline).toISOString().slice(0, 10) : '',
          category: raw.category || 'General',
          skills: raw.required_skills || [],
          createdAt: raw.created_at ? new Date(raw.created_at).toISOString().slice(0, 10) : '',
          bids: 0,
          bidRange: { min: 0, max: 0 },
          publisher: raw.creator_wallet ? { address: raw.creator_wallet, reputation: 0, tasksCompleted: 0, tasksFailed: 0, joinedDays: 0 } : null,
          paymentType: 'sol' as const,
        }))
        if (!cancelledRef.current) {
          setTasks(dbTasks)
          setError(null)
        }
      }

      // Only fetch from chain on manual refresh (button click) to avoid 429
      if (isRefresh || !(dbRes?.success && dbRes.data?.length > 0)) {
        const chainTasks = await fetchAllTasksWithPdas()
        if (!cancelledRef.current && chainTasks.length > 0) {
          // Merge with DB tasks
          const merged = new Map<string, Task>()
          for (const t of chainTasks) merged.set(t.id, t)
          // DB tasks that aren't on chain (shouldn't happen, but safe)
          if (dbRes?.data) {
            for (const t of (dbRes.data as any[])) {
              const key = t.task_pda || t.id
              if (!merged.has(key)) {
                merged.set(key, {
                  id: key, title: t.title, description: t.description,
                  reward: parseFloat(t.reward) || 0,
                  status: t.status === 'created' ? 'open' : t.status,
                  deadline: t.verification_deadline ? new Date(t.verification_deadline).toISOString().slice(0, 10) : '',
                  category: 'General', skills: t.required_skills || [], createdAt: '',
                  bids: 0, bidRange: { min: 0, max: 0 }, publisher: null, paymentType: 'sol',
                })
              }
            }
          }
          setTasks(Array.from(merged.values()))
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        console.error('[TaskSquare] load error:', err)
        setError('Failed to load tasks')
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false)
        if (isRefresh) setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    loadTasks()

    // Auto-refresh polling every 30 seconds
    const intervalId = setInterval(() => {
      loadTasks()
    }, TASK_REFRESH_INTERVAL)

    return () => {
      cancelledRef.current = true
      clearInterval(intervalId)
    }
  }, [loadTasks])

  const filtered = tasks
    .filter((t) => {
      if (typeFilter !== 'all' && t.status !== typeFilter) return false
      if (budgetFilter !== 'all') {
        const parts = budgetFilter.split('-').map(Number)
        if (budgetFilter === '10+') { if (t.reward < 10) return false }
        else { if (t.reward < parts[0] || t.reward > parts[1]) return false }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchTitle = (t.title ?? '').toLowerCase().includes(q)
        const matchDesc  = (t.description ?? '').toLowerCase().includes(q)
        const matchSkill = (t.skills ?? []).some(s => s.toLowerCase().includes(q))
        if (!matchTitle && !matchDesc && !matchSkill) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'deadline') return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      if (sortBy === 'reward')    return b.reward - a.reward
      if (sortBy === 'bids')      return (b.bids ?? 0) - (a.bids ?? 0)
      return 0
    })

  const openCount = tasks.filter(t => t.status === 'open').length

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Task Square</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {loading
              ? 'Loading from chain...'
              : error
                ? `${openCount} open · using demo data`
                : `${openCount} open · ${tasks.length} total · Solana Devnet`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/create-task"
            className="flex items-center gap-1.5 px-3 sm:px-5 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <span>+</span> Post Task
          </Link>
          <button
            onClick={() => loadTasks(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-xs sm:text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
          >
            <span className={refreshing ? 'animate-spin' : ''}>↻</span>
            <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Wallet Banner ── */}
      {!connected && <WalletBanner />}

      {/* ── Filters ── */}
      <div className="bg-[#111827] border border-gray-800/70 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] sm:text-xs text-gray-500">Type:</span>
            {(['all', 'open', 'assigned', 'in_progress', 'submitted'] as TaskType[]).map((f) => (
              <FilterPill key={f} active={typeFilter === f} onClick={() => setTypeFilter(f)}>
                {f === 'all' ? 'All' : f === 'open' ? 'Open' : f === 'assigned' ? 'Assigned' : f === 'in_progress' ? 'Active' : f === 'submitted' ? 'Submitted' : f}
              </FilterPill>
            ))}
          </div>
          <span className="text-gray-800 shrink-0">|</span>
          <BudgetFilter value={budgetFilter} onChange={setBudgetFilter} />
          <SortFilter value={sortBy} onChange={setSortBy} />
          <span className="ml-auto text-[10px] sm:text-xs text-gray-500 shrink-0">
            {loading ? '...' : `${filtered.length}`}
          </span>
        </div>
      </div>

      {/* ── Task List ── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-700 rounded w-20" />
                  <div className="h-4 bg-gray-700 rounded w-3/4" />
                </div>
                <div className="h-6 bg-gray-700 rounded w-16" />
              </div>
              <div className="h-3 bg-gray-700 rounded w-full mb-2" />
              <div className="h-3 bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-sm text-amber-400 text-center">
          ⚠️ {error}
        </div>
      ) : filtered.length === 0 ? (
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

// ─── Internal: fetch tasks directly via connection with manual Borsh decoding ───
async function fetchAllTasksWithPdas(): Promise<Task[]> {
  const { PublicKey, Connection } = await import('@solana/web3.js')
  const { struct, u64, u8, u32, i64, publicKey, str, vec, option } = await import('@coral-xyz/borsh')
  
  const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C')
  const RPC_ENDPOINT = 'https://api.devnet.solana.com'
  
  // Manual Borsh schema for Task account (matches IDL)
  // IMPORTANT: struct() from buffer-layout expects Layout instances with property names,
  // NOT [name, Layout] tuples!
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
  
  try {
    const conn = new Connection(RPC_ENDPOINT, 'confirmed')
    
    const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: 1341 }]
    })
    
    const tasks: Task[] = []
    for (const { pubkey, account } of accounts) {
      try {
        // Skip 8-byte Anchor discriminator prefix
        const data = account.data.slice(8)
        const raw = TASK_SCHEMA.decode(data)
        if (!raw) continue
        // Borsh u64/i64 decode to BN objects — convert to string for chainTaskToTask
        const decoded: Record<string, any> = {}
        for (const [k, v] of Object.entries(raw)) {
          decoded[k] = (v && typeof v === 'object' && typeof (v as any).toString === 'function' && (v as any)._bn !== undefined)
            ? (v as any).toString()
            : v
        }
        tasks.push(chainTaskToTask(pubkey.toBase58(), decoded as any))
      } catch (decodeErr) {
        console.warn('[TaskSquare] Failed to decode account:', pubkey.toBase58(), decodeErr)
      }
    }
    
    return tasks
  } catch (err) {
    console.error('[TaskSquare] fetchAllTasksWithPdas error:', err)
    return []
  }
}
