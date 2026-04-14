// ============================================================
// Claw Universe — LeaderboardPage
// 排行榜页面：展示用户排名、CLAW 余额、完成任务数、Tier
// API: GET /users/leaderboard (via getLeaderboard in api/user.ts)
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { getLeaderboard } from '../api/user'
import type { LeaderboardEntry } from '../types/api'

// ─── Tier Config ────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Bronze:   { bg: 'bg-orange-500/10',   text: 'text-orange-400',   border: 'border-orange-500/30', icon: '🥉' },
  Silver:   { bg: 'bg-gray-400/10',     text: 'text-gray-300',     border: 'border-gray-500/30',  icon: '🥈' },
  Gold:     { bg: 'bg-yellow-500/10',   text: 'text-yellow-400',   border: 'border-yellow-500/30', icon: '🥇' },
  Platinum: { bg: 'bg-blue-400/10',     text: 'text-blue-400',     border: 'border-blue-500/30',  icon: '💠' },
  Diamond:  { bg: 'bg-sky-400/10',      text: 'text-sky-400',      border: 'border-sky-400/30',   icon: '💎' },
  default:  { bg: 'bg-gray-500/10',     text: 'text-gray-400',     border: 'border-gray-500/30',  icon: '⬜' },
}

function tierConfig(tier: string) {
  const clean = tier.replace(' Worker', '')
  return TIER_CONFIG[clean] ?? TIER_CONFIG.default
}

// ─── Rank Medal ─────────────────────────────────────────────────────────────
function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>
  if (rank === 2) return <span className="text-2xl">🥈</span>
  if (rank === 3) return <span className="text-2xl">🥉</span>
  return <span className="text-sm font-mono text-gray-500 w-7 text-center">{rank}</span>
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gray-800/60 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-800/60 rounded" />
            <div className="h-3 w-20 bg-gray-800/40 rounded" />
          </div>
          <div className="space-y-2 text-right">
            <div className="h-4 w-16 bg-gray-800/60 rounded" />
            <div className="h-3 w-12 bg-gray-800/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page Component ─────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { entries: data } = await getLeaderboard({ limit: 50 })
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="max-w-4xl space-y-4">
      <div className="h-8 w-48 bg-gray-800/40 rounded animate-pulse" />
      <LeaderboardSkeleton />
    </div>
  )

  if (error) return (
    <div className="max-w-4xl">
      <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-8 text-center">
        <span className="text-4xl mb-3 block">⚠️</span>
        <h3 className="text-red-400 font-semibold mb-2">Failed to load leaderboard</h3>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={load}
          className="px-5 py-2 bg-[#9945FF]/20 border border-[#9945FF]/40 rounded-xl text-sm text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors">
          Try Again
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🏆 Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-1">Top performers in the Claw Universe</p>
        </div>
        <button onClick={load}
          className="px-4 py-2 bg-[#111827] border border-gray-700/50 rounded-xl text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-all">
          ↻ Refresh
        </button>
      </div>

      {/* ── Top 3 Spotlight ── */}
      {entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[entries[1], entries[0], entries[2]].map((entry, i) => {
            const tc = tierConfig(entry.tier)
            const medals = ['🥈', '🥇', '🥉']
            return (
              <div key={entry.wallet_address}
                className={`relative bg-[#111827] border rounded-2xl p-5 text-center flex flex-col items-center gap-3
                  ${i === 1 ? 'border-[#9945FF]/40 shadow-lg shadow-purple-500/10 scale-105' : 'border-gray-800/70'}`}>
                <div className="absolute -top-3 text-2xl">{medals[i]}</div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {(entry.username ?? entry.wallet_address.slice(0, 2)).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{entry.username ?? entry.wallet_address.slice(0, 8) + '...'}</p>
                  <p className={`text-xs font-medium ${tc.text}`}>{entry.tier}</p>
                </div>
                <div className="w-full grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-900/60 rounded-lg py-2">
                    <p className="text-gray-500">Tasks</p>
                    <p className="text-white font-bold">{entry.tasks_completed}</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-lg py-2">
                    <p className="text-gray-500">CLAW</p>
                    <p className="text-[#14F195] font-bold">{parseFloat(entry.total_earnings).toFixed(1)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Full Rankings Table ── */}
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800/70">
              <th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5">#</th>
              <th className="text-left text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5">User</th>
              <th className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5 hidden sm:table-cell">Tier</th>
              <th className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5">Tasks</th>
              <th className="text-right text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5">CLAW Earned</th>
              <th className="text-center text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3.5 hidden md:table-cell">Reputation</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const tc = tierConfig(entry.tier)
              return (
                <tr key={entry.wallet_address}
                  className="border-t border-gray-800/40 hover:bg-gray-900/40 transition-colors group">
                  <td className="px-5 py-4">
                    <RankMedal rank={entry.rank} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9945FF]/60 to-[#14F195]/60 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(entry.username ?? entry.wallet_address.slice(0, 2)).toUpperCase().slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{entry.username ?? 'Anonymous'}</p>
                        <p className="text-gray-500 text-xs font-mono truncate">{entry.wallet_address.slice(0, 12)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${tc.bg} ${tc.text} ${tc.border}`}>
                      {tc.icon} {entry.tier}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-white text-sm font-medium">{entry.tasks_completed}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-[#14F195] text-sm font-bold">{parseFloat(entry.total_earnings).toFixed(2)}</span>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-yellow-400 text-sm">★</span>
                      <span className="text-white text-sm font-medium">{entry.reputation.toFixed(1)}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {entries.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <span className="text-4xl mb-3 block">📭</span>
            <p>No leaderboard data yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
