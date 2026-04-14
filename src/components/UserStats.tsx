// ============================================================
// UserStats - 统计卡片组件
// 显示：完成任务数、信誉分、收入
// ============================================================

interface UserStatsProps {
  tasksCompleted: number
  reputation: number
  totalEarned: number
  tasksPosted?: number
  successRate?: number
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
}

// ─── 单个统计卡片 ───────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  unit,
  highlight,
}: {
  label: string
  value: string | number
  unit?: string
  highlight?: 'green' | 'purple' | 'default'
}) {
  const colorMap = {
    green: 'text-[#14F195]',
    purple: 'text-[#9945FF]',
    default: 'text-white',
  }
  const color = highlight ? colorMap[highlight] : colorMap.default

  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 text-center hover:border-gray-700/60 transition-colors">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
    </div>
  )
}

// ─── 信誉分环形图 ───────────────────────────────────────────────────────────
function ReputationRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 5) * circumference
  const color = score >= 4.5 ? '#14F195' : score >= 3.5 ? '#eab308' : '#ef4444'

  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 flex flex-col items-center justify-center hover:border-gray-700/60 transition-colors">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Reputation</p>
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#1f2937" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-gray-600">/ 5.0</span>
          {score >= 4.0 && <span className="text-xs text-yellow-400 mt-1">🏆 Gold</span>}
          {score >= 3.0 && score < 4.0 && <span className="text-xs text-gray-400 mt-1">🥈 Silver</span>}
          {score < 3.0 && <span className="text-xs text-orange-400 mt-1">🥉 Bronze</span>}
        </div>
      </div>
    </div>
  )
}

// ─── 主要统计网格 ────────────────────────────────────────────────────────────
export function UserStatsGrid({ tasksCompleted, totalEarned, tasksPosted = 0, successRate = 0 }: UserStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard
        label="Total Earned"
        value={totalEarned}
        unit="SOL"
        highlight="green"
      />
      <StatCard
        label="Tasks Done"
        value={tasksCompleted}
        unit="完成"
      />
      <StatCard
        label="Tasks Posted"
        value={tasksPosted}
        unit="发布"
      />
      <StatCard
        label="Success Rate"
        value={`${successRate}%`}
        highlight="green"
      />
    </div>
  )
}

export function ReputationScore({ score }: { score: number }) {
  return <ReputationRing score={score} />
}

export default UserStatsGrid
