
// ─── Filter Types ──────────────────────────────────────────────────────────
export type TaskTypeFilter = 'all' | 'open' | 'in_progress'
export type BudgetRange     = 'all' | '0-3' | '3-5' | '5-10' | '10+'
export type SortOption       = 'newest' | 'deadline' | 'reward' | 'bids'

export interface FilterState {
  typeFilter:   TaskTypeFilter
  budgetFilter: BudgetRange
  sortBy:       SortOption
  searchQuery:  string
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FilterPill({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
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

function SelectFilter<T extends string>({
  value, onChange, options, label,
}: {
  value: T
  onChange: (v: T) => void
  options: { label: string; value: T }[]
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-500 font-medium">{label}:</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-sm
          text-gray-300 focus:outline-none focus:border-[#9945FF]/50
          hover:bg-gray-800/70 transition-colors cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: '28px',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function SearchInput({
  value, onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tasks by title, description, or skill…"
        className="w-full pl-10 pr-10 py-2.5 bg-gray-900/70 border border-gray-700/50 rounded-xl
          text-sm text-white placeholder-gray-500
          focus:outline-none focus:border-[#9945FF]/50 focus:ring-2 focus:ring-[#9945FF]/20
          transition-all"
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
      <span className="px-4 py-2 bg-amber-500/20 border border-amber-500/30
        text-amber-400 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed">
        Connect
      </span>
    </div>
  )
}

// ─── Budget Options ───────────────────────────────────────────────────────
const BUDGET_OPTIONS: { label: string; value: BudgetRange }[] = [
  { label: 'All Budgets', value: 'all' },
  { label: '0–3 SOL',    value: '0-3' },
  { label: '3–5 SOL',    value: '3-5' },
  { label: '5–10 SOL',   value: '5-10' },
  { label: '10+ SOL',    value: '10+' },
]

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: 'Newest First',    value: 'newest'   },
  { label: 'Deadline Soon',   value: 'deadline' },
  { label: 'Highest Reward',   value: 'reward'   },
  { label: 'Most Bids',       value: 'bids'     },
]

// ─── FilterBar ─────────────────────────────────────────────────────────────
interface FilterBarProps {
  filters:       FilterState
  onFiltersChange: (f: FilterState) => void
  totalCount:    number
  filteredCount: number
}

export function FilterBar({ filters, onFiltersChange, totalCount, filteredCount }: FilterBarProps) {


  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    onFiltersChange({ ...filters, [key]: value })

  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-4 space-y-4">

      {/* Search */}
      <SearchInput
        value={filters.searchQuery}
        onChange={(v) => set('searchQuery', v)}
      />

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Type filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Type:</span>
          <div className="flex gap-2">
            {(['all', 'open', 'in_progress'] as TaskTypeFilter[]).map((f) => (
              <FilterPill
                key={f}
                active={filters.typeFilter === f}
                onClick={() => set('typeFilter', f)}
              >
                {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'In Progress'}
              </FilterPill>
            ))}
          </div>
        </div>

        <span className="hidden sm:inline text-gray-700">|</span>

        {/* Budget */}
        <SelectFilter
          label="Budget:"
          value={filters.budgetFilter}
          onChange={(v) => set('budgetFilter', v)}
          options={BUDGET_OPTIONS}
        />

        <span className="hidden sm:inline text-gray-700">|</span>

        {/* Sort */}
        <SelectFilter
          label="Sort:"
          value={filters.sortBy}
          onChange={(v) => set('sortBy', v)}
          options={SORT_OPTIONS}
        />

        {/* Result count */}
        <span className="ml-auto text-xs text-gray-500">
          {filteredCount === totalCount
            ? `${totalCount} task${totalCount !== 1 ? 's' : ''}`
            : `${filteredCount} of ${totalCount}`}
        </span>
      </div>
    </div>
  )
}

// ─── Exports for direct use ───────────────────────────────────────────────
export { WalletBanner }
