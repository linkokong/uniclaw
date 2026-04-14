// ============================================================
// Claw Universe — UserProfilePage
// 用户 Profile 页面：展示/编辑个人信息、技能、任务历史
// 使用 getCurrentUser / updateProfile API
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getCurrentUser, updateProfile } from '../api/user'
import { getMyTasks } from '../api/task'
import type { User, Task } from '../types/api'

// ─── Reputation Score ──────────────────────────────────────────────────────
function ReputationScore({ score }: { score: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 5) * circumference
  const color = score >= 4.5 ? '#14F195' : score >= 3.5 ? '#eab308' : '#ef4444'

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#1f2937" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{score.toFixed(1)}</span>
        <span className="text-xs text-gray-500">/ 5.0</span>
      </div>
    </div>
  )
}

// ─── Rank Badge ────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: string }) {
  const config: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    'Bronze Worker':    { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', icon: '🥉' },
    'Silver Worker':    { bg: 'bg-gray-400/10',   text: 'text-gray-300',   border: 'border-gray-500/30',  icon: '🥈' },
    'Gold Worker':      { bg: 'bg-yellow-500/10',  text: 'text-yellow-400', border: 'border-yellow-500/30', icon: '🥇' },
    'Platinum Worker':  { bg: 'bg-blue-400/10',   text: 'text-blue-400',   border: 'border-blue-500/30',  icon: '💠' },
    'Diamond Worker':   { bg: 'bg-blue-400/10',   text: 'text-blue-400',   border: 'border-blue-500/30',  icon: '💎' },
  }
  const c = config[rank] ?? { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30', icon: '⬜' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span>{c.icon}</span>{rank}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 text-center hover:border-gray-700/60 transition-colors">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Tab Button ────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-md'
          : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Skill Tag ─────────────────────────────────────────────────────────────
function SkillTag({ label, removable, onRemove }: { label: string; removable?: boolean; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#9945FF]/10 border border-[#9945FF]/25 rounded-lg text-sm text-[#9945FF] hover:bg-[#9945FF]/20 hover:border-[#9945FF]/40 transition-colors group">
      {label}
      {removable && (
        <button
          onClick={onRemove}
          className="ml-0.5 text-[#9945FF]/50 hover:text-[#9945FF] text-xs transition-colors"
        >
          ×
        </button>
      )}
    </span>
  )
}

// ─── Skill Selector Modal ──────────────────────────────────────────────────
const ALL_SKILLS = [
  'React', 'TypeScript', 'Rust', 'Python', 'Go', 'Solidity',
  'Web3', 'DeFi', 'IPFS', 'AI/ML', 'Docker', 'AWS',
  'Solana SDK', 'Node.js', 'GraphQL', 'PostgreSQL', 'Redis',
  'Smart Contracts', '前端开发', '后端开发', '区块链安全',
]

function SkillSelectorModal({
  selected, onAdd, onClose,
}: {
  selected: string[]
  onAdd: (s: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = ALL_SKILLS.filter(s => !selected.includes(s) && s.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-[#111827] border border-gray-700/60 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Add Skill</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">×</button>
        </div>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search skills..."
          className="w-full px-4 py-2.5 bg-gray-900/70 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-600 mb-4 focus:outline-none focus:border-[#9945FF]/50 transition-all"
        />
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">No matching skills found</p>
          ) : (
            filtered.map(s => (
              <button
                key={s}
                onClick={() => { onAdd(s); onClose() }}
                className="px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-300 hover:bg-[#9945FF]/20 hover:border-[#9945FF]/40 hover:text-[#9945FF] transition-all"
              >
                + {s}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div className="max-w-4xl space-y-6 animate-pulse">
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gray-800/60 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-40 bg-gray-800/60 rounded" />
            <div className="h-3 w-56 bg-gray-800/40 rounded" />
            <div className="h-3 w-full bg-gray-800/40 rounded" />
          </div>
          <div className="w-24 h-24 bg-gray-800/60 rounded-full shrink-0" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 h-24" />)}
      </div>
    </div>
  )
}

// ─── Page Component ────────────────────────────────────────────────────────
export default function UserProfilePage() {
  const { publicKey, connected } = useWallet()

  const [user, setUser]           = useState<User | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [activeTab, setActiveTab]   = useState<'skills' | 'settings' | 'history'>('skills')
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [skills, setSkills]         = useState<string[]>([])
  const [bio, setBio]               = useState('')
  const [editMode, setEditMode]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [history, setHistory]       = useState<(Task & { role: "creator" | "worker" })[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── 加载用户数据 ───────────────────────────────────────────────────
  const loadUser = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const u = await getCurrentUser()
      setUser(u)
      setSkills(u.skills)
      setBio(u.bio ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  // ── 加载历史记录 ───────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const [creatorRes, workerRes] = await Promise.all([
        getMyTasks({ role: 'creator' }),
        getMyTasks({ role: 'worker' }),
      ])
      const merged: Array<Task & { role: 'creator' | 'worker' }> = [
        ...creatorRes.tasks.map(t => ({ ...t, role: 'creator' as const })),
        ...workerRes.tasks.map(t => ({ ...t, role: 'worker' as const })),
      ]
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setHistory(merged)
    } catch {
      // non-fatal
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'history' && history.length === 0) loadHistory()
  }, [activeTab])

  // ── 加载任务历史（并行获取 creator + worker） ───────────────────────
  useEffect(() => {
    if (!user) return
    setHistoryLoading(true)
    Promise.all([getMyTasks({ role: 'creator' }), getMyTasks({ role: 'worker' })])
      .then(([creatorResult, workerResult]) => {
        // 合并两个列表，按 createdAt 倒序
        const merged: (Task & { role: 'creator' | 'worker' })[] = [...creatorResult.tasks.map(t => ({ ...t, role: 'creator' as const })), ...workerResult.tasks.map(t => ({ ...t, role: 'worker' as const }))].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setHistory(merged)
      })
      .catch(() => { /* 历史加载失败不影响主流程 */ })
      .finally(() => setHistoryLoading(false))
  }, [user])

  // ── 保存资料 ───────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateProfile({ username: user?.username ?? undefined, bio, skills })
      setUser(updated)
      setSkills(updated.skills)
      setEditMode(false)
    } catch (err) {
      alert('Failed to save: ' + String(err))
    } finally {
      setSaving(false)
    }
  }

  const addSkill = (s: string) => setSkills(prev => [...prev, s])
  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s))

  // ── 派生值 ─────────────────────────────────────────────────────────
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-4)}`
    : user?.address
    ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
    : '—'

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) return <ProfileSkeleton />

  // ── Error ──────────────────────────────────────────────────────────
  if (error || !user) {
    return (
      <div className="max-w-4xl">
        <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-8 text-center">
          <span className="text-4xl mb-3 block">⚠️</span>
          <h3 className="text-red-400 font-semibold mb-2">Failed to load profile</h3>
          <p className="text-gray-400 text-sm mb-4">{error ?? 'Unknown error'}</p>
          <button
            onClick={loadUser}
            className="px-5 py-2 bg-[#9945FF]/20 border border-[#9945FF]/40 rounded-xl text-sm text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Profile Header ── */}
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white font-bold text-3xl shrink-0 shadow-lg shadow-purple-500/20">
            {shortAddress.slice(0, 2).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-white">
                {user.username ?? shortAddress}
              </h1>
              <RankBadge rank={user.rank} />
            </div>
            <p className="text-gray-500 text-sm mb-3">
              Member since {new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {user.tasksCompleted} tasks completed
            </p>

            {/* Editable Bio */}
            {editMode ? (
              <div className="space-y-2">
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={2}
                  maxLength={280}
                  className="w-full px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-[#9945FF]/50 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setBio(user.bio ?? ''); setSkills(user.skills) }}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-gray-400 text-sm">
                  {bio || 'No bio yet — click Edit to add one.'}
                </p>
                <button
                  onClick={() => setEditMode(true)}
                  className="text-xs text-gray-600 hover:text-[#9945FF] transition-colors shrink-0"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Reputation Score */}
          <ReputationScore score={user.reputation} />
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Earned"
          value={`${user.totalEarned.toFixed(2)}`}
          sub="SOL"
          color="text-[#14F195]"
        />
        <StatCard
          label="Tasks Done"
          value={String(user.tasksCompleted)}
          sub="completed"
        />
        <StatCard
          label="Tasks Posted"
          value={String(user.tasksPosted)}
          sub="created"
        />
        <StatCard
          label="Success Rate"
          value={`${user.successRate}%`}
          sub="on-time delivery"
          color="text-emerald-400"
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')}>
          🛠️ Skills
        </TabBtn>
        <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          📋 History
        </TabBtn>
        <TabBtn active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings
        </TabBtn>
      </div>

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/70 flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Task History</h3>
              <p className="text-gray-500 text-xs mt-0.5">{history.length} total tasks</p>
            </div>
          </div>

          {historyLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-900/40 rounded-xl p-4 animate-pulse flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-800/60 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-gray-800/60 rounded" />
                    <div className="h-3 w-32 bg-gray-800/40 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <span className="text-4xl mb-3 block">📋</span>
              <p>No task history yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/70">
                  <th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-6 py-3.5">Task</th>
                  <th className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5">Role</th>
                  <th className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5">Status</th>
                  <th className="text-right text-xs text-gray-500 font-medium uppercase tracking-wider px-6 py-3.5">Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const roleTag = item.role === 'creator'
                    ? { label: '雇主', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' }
                    : { label: 'Agent', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' }
                  const statusCfg: Record<string, { bg: string; text: string }> = {
                    open:       { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
                    in_progress:{ bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
                    completed:  { bg: 'bg-gray-500/10',   text: 'text-gray-400' },
                  }
                  const sc = statusCfg[item.status] ?? { bg: 'bg-gray-500/10', text: 'text-gray-400' }
                  return (
                    <tr key={item.id} className="border-t border-gray-800/40 hover:bg-gray-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-white text-sm font-medium">{item.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5">💰 {item.reward.toFixed(2)} SOL</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${roleTag.bg} ${roleTag.text} ${roleTag.border}`}>
                          {roleTag.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-gray-500 text-xs">
                          {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Skills Tab ── */}
      {activeTab === 'skills' && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold mb-0.5">My Skills</h3>
              <p className="text-gray-500 text-xs">{skills.length} skills added</p>
            </div>
            <button
              onClick={() => setShowSkillModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Add Skill
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {skills.map(skill => (
              <SkillTag key={skill} label={skill} removable onRemove={() => removeSkill(skill)} />
            ))}
          </div>

          {skills.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No skills added yet. Click "Add Skill" to get started.
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold mb-0.5">Task History</h3>
              <p className="text-gray-500 text-xs">{history.length} total tasks</p>
            </div>
          </div>

          {historyLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-800/40 rounded-xl" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              No task history yet
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(task => {
                // 判断当前用户在此任务中是什么角色（creator_wallet === user.address → 雇主）
                const role = task.publisher?.address === user.address ? 'creator' : 'worker'
                const roleLabel = role === 'creator' ? '👤 雇主' : '🤖 Agent'
                const statusColor: Record<string, string> = {
                  open: 'text-[#14F195]',
                  in_progress: 'text-yellow-400',
                  completed: 'text-gray-500',
                }
                const statusBg: Record<string, string> = {
                  open: 'bg-[#14F195]/10',
                  in_progress: 'bg-yellow-400/10',
                  completed: 'bg-gray-500/10',
                }
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 bg-[#0a0a1a] border border-gray-800/50 rounded-xl p-4 hover:border-gray-700/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{task.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {roleLabel} · {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBg[task.status] ?? statusBg.completed} ${statusColor[task.status] ?? statusColor.completed}`}>
                      {task.status.replace('_', ' ')}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[#9945FF] text-sm font-bold">{task.reward.toFixed(2)}</p>
                      <p className="text-gray-600 text-xs">SOL</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ── */}
      {activeTab === 'settings' && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-semibold mb-1">Account Settings</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-800/40">
              <div>
                <p className="text-sm text-white">Email Notifications</p>
                <p className="text-xs text-gray-500">Receive updates about new tasks and bids</p>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#9945FF]" />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-800/40">
              <div>
                <p className="text-sm text-white">Push Notifications</p>
                <p className="text-xs text-gray-500">Browser notifications for urgent updates</p>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#9945FF]" />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-800/40">
              <div>
                <p className="text-sm text-white">Auto-accept Bids</p>
                <p className="text-xs text-gray-500">Automatically accept bids above threshold</p>
              </div>
              <input type="checkbox" className="w-4 h-4 accent-[#9945FF]" />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-white">Solana Network</p>
                <p className="text-xs text-gray-500">Mainnet Beta</p>
              </div>
              <span className={`text-sm font-medium ${connected ? 'text-emerald-400' : 'text-gray-500'}`}>
                {connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-white">Wallet Address</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{shortAddress}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skill Modal */}
      {showSkillModal && (
        <SkillSelectorModal
          selected={skills}
          onAdd={addSkill}
          onClose={() => setShowSkillModal(false)}
        />
      )}
    </div>
  )
}
