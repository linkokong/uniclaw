import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'
import { getProgram, fetchTreasury, findTreasuryPda } from '../api/anchorClient'

interface UserStats {
  tasksCreated: number
  tasksCompleted: number
  tasksWorking: number
  totalEarned: number
  totalSpent: number
  reputation: number
  tier: string
}

export default function UserProfilePage() {
  const { publicKey, connected } = useWallet()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!connected || !publicKey) {
      setLoading(false)
      return
    }
    loadUserData()
  }, [connected, publicKey])

  async function loadUserData() {
    if (!publicKey) return
    setLoading(true)
    try {
      const program = getProgram()
      const acc = program.account as Record<string, { all: (filters?: any[]) => Promise<Array<{ account: any }>> }>
      
      // Fetch all tasks created by this user
      const createdTasks = await acc.task.all([
        { memcmp: { offset: 8, bytes: publicKey.toBase58() } }
      ])
      
      // Fetch all tasks where this user is worker
      const workingTasks = await acc.task.all([
        { memcmp: { offset: 40, bytes: publicKey.toBase58() } }
      ])
      
      // Calculate stats
      const completed = workingTasks.filter(t => t.account.status === 4).length
      const inProgress = workingTasks.filter(t => t.account.status === 2).length
      
      setStats({
        tasksCreated: createdTasks.length,
        tasksCompleted: completed,
        tasksWorking: inProgress,
        totalEarned: 0, // TODO: calculate from chain
        totalSpent: 0,  // TODO: calculate from chain
        reputation: 0,  // TODO: fetch from worker profile
        tier: 'Bronze'
      })
      
      // Fetch treasury for display
      const treasury = await fetchTreasury(findTreasuryPda())
      setTreasuryBalance((treasury as any).balance / 1e9)
    } catch (err) {
      console.error('loadUserData error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <span className="text-5xl mb-4 block">🔒</span>
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-gray-500">Connect your wallet to view your profile</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 border border-[#9945FF]/30 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#9945FF] to-[#14F195] rounded-full flex items-center justify-center text-2xl font-bold text-white">
            {publicKey?.toBase58().slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">My Profile</h1>
            <p className="text-gray-400 text-sm font-mono">
              {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
            </p>
            <span className="inline-block mt-2 px-3 py-1 bg-[#9945FF]/20 text-[#9945FF] rounded-full text-xs font-medium">
              {stats?.tier || 'Bronze'} Tier
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#111827] border border-gray-800 rounded-xl p-4 animate-pulse">
              <div className="h-8 bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Created" value={stats?.tasksCreated || 0} icon="📋" />
          <StatCard label="Completed" value={stats?.tasksCompleted || 0} icon="✅" />
          <StatCard label="Working" value={stats?.tasksWorking || 0} icon="🔨" />
          <StatCard label="Reputation" value={stats?.reputation || 0} icon="⭐" />
        </div>
      )}

      {/* Treasury Info */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3">Platform Treasury</h3>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Total Locked</span>
          <span className="text-[#14F195] font-bold">{treasuryBalance.toFixed(4)} SOL</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/my-tasks" className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-[#9945FF]/30 transition-colors">
          <span className="text-2xl mb-2 block">📋</span>
          <h3 className="text-white font-medium">My Tasks</h3>
          <p className="text-gray-500 text-sm">View created tasks</p>
        </Link>
        <Link to="/my-bids" className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-[#9945FF]/30 transition-colors">
          <span className="text-2xl mb-2 block">📝</span>
          <h3 className="text-white font-medium">My Bids</h3>
          <p className="text-gray-500 text-sm">View active bids</p>
        </Link>
      </div>

      {/* Worker Profile */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Worker Profile</h3>
          <Link to="/register" className="text-[#9945FF] text-sm hover:underline">
            Edit →
          </Link>
        </div>
        <p className="text-gray-500 text-sm">
          Register as a worker to start bidding on tasks and earning SOL.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
      <span className="text-2xl mb-2 block">{icon}</span>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  )
}
