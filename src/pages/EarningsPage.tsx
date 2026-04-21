import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'
import { getProgram } from '../api/anchorClient'

interface EarningRecord {
  taskId: string
  taskTitle: string
  amount: number
  type: 'earned' | 'spent' | 'withdrawn'
  timestamp: string
}

export default function EarningsPage() {
  const { publicKey, connected } = useWallet()
  const [totalEarned, setTotalEarned] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [availableBalance, setAvailableBalance] = useState(0)
  const [records, setRecords] = useState<EarningRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!connected || !publicKey) {
      setLoading(false)
      return
    }
    loadEarnings()
  }, [connected, publicKey])

  async function loadEarnings() {
    if (!publicKey) return
    setLoading(true)
    try {
      const program = getProgram()
      const acc = program.account as Record<string, { all: (filters?: any[]) => Promise<Array<{ publicKey: any; account: any }>> }>
      
      // Fetch tasks where user is worker (earned from completed tasks)
      const workerTasks = await acc.task.all([
        { memcmp: { offset: 40, bytes: publicKey.toBase58() } }
      ])
      
      // Fetch tasks where user is creator (spent on tasks)
      const creatorTasks = await acc.task.all([
        { memcmp: { offset: 8, bytes: publicKey.toBase58() } }
      ])
      
      let earned = 0
      let spent = 0
      const recs: EarningRecord[] = []
      
      // Calculate earned from verified tasks
      workerTasks.forEach(({ account: task }) => {
        if (task.status === 4) { // Verified
          earned += (task.reward || 0) / 1e9
          recs.push({
            taskId: task.id?.toBase58?.() || 'unknown',
            taskTitle: task.title || 'Untitled',
            amount: (task.reward || 0) / 1e9,
            type: 'earned',
            timestamp: new Date().toISOString() // TODO: use actual timestamp
          })
        }
      })
      
      // Calculate spent on assigned/verified tasks
      creatorTasks.forEach(({ account: task }) => {
        if (task.status >= 1) { // Assigned or later
          spent += (task.reward || 0) / 1e9
          recs.push({
            taskId: task.id?.toBase58?.() || 'unknown',
            taskTitle: task.title || 'Untitled',
            amount: (task.reward || 0) / 1e9,
            type: 'spent',
            timestamp: new Date().toISOString()
          })
        }
      })
      
      setTotalEarned(earned)
      setTotalSpent(spent)
      setAvailableBalance(earned - spent)
      setRecords(recs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)))
    } catch (err) {
      console.error('loadEarnings error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <span className="text-5xl mb-4 block">🔒</span>
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-gray-500">Connect your wallet to view your earnings</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Earnings</h1>
          <p className="text-gray-500 text-sm">Track your earnings and spending</p>
        </div>
        <Link to="/" className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
          ← Back to Tasks
        </Link>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#111827] border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-8 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-[#14F195]/20 to-[#14F195]/5 border border-[#14F195]/30 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-[#14F195]">{totalEarned.toFixed(4)} SOL</p>
          </div>
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-white">{totalSpent.toFixed(4)} SOL</p>
          </div>
          <div className="bg-gradient-to-br from-[#9945FF]/20 to-[#9945FF]/5 border border-[#9945FF]/30 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Available Balance</p>
            <p className="text-2xl font-bold text-[#9945FF]">{availableBalance.toFixed(4)} SOL</p>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Transaction History</h2>
        </div>
        
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-3xl mb-2 block">📊</span>
            <p className="text-gray-500">No transactions yet</p>
            <p className="text-gray-600 text-sm mt-1">Complete tasks to start earning</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {records.map((rec, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    rec.type === 'earned' ? 'bg-[#14F195]/20 text-[#14F195]' :
                    'bg-[#9945FF]/20 text-[#9945FF]'
                  }`}>
                    {rec.type === 'earned' ? '↓' : '↑'}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{rec.taskTitle}</p>
                    <p className="text-gray-500 text-xs">{rec.type}</p>
                  </div>
                </div>
                <p className={`font-mono font-medium ${
                  rec.type === 'earned' ? 'text-[#14F195]' : 'text-gray-400'
                }`}>
                  {rec.type === 'earned' ? '+' : '-'}{rec.amount.toFixed(4)} SOL
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
