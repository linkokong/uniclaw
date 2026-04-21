import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'
import { getProgram } from '../api/anchorClient'

interface TaskInfo {
  pda: string
  title: string
  reward: number
  status: string
  worker: string
}

export default function MyTasksPage() {
  const { publicKey, connected } = useWallet()
  const [activeTab, setActiveTab] = useState<'created' | 'assigned'>('created')
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<TaskInfo[]>([])

  useEffect(() => {
    if (!connected || !publicKey) {
      setLoading(false)
      return
    }
    fetchTasks()
  }, [connected, publicKey, activeTab])

  async function fetchTasks() {
    if (!publicKey) return
    setLoading(true)
    try {
      const program = getProgram()
      const acc = program.account as Record<string, { all: (filters?: any[]) => Promise<Array<{ publicKey: any; account: any }>> }>
      
      let allTasks: TaskInfo[] = []
      
      if (activeTab === 'created') {
        // Fetch tasks created by this user
        const createdTasks = await acc.task.all([
          { memcmp: { offset: 8, bytes: publicKey.toBase58() } }
        ])
        allTasks = createdTasks.map(({ publicKey: pda, account: task }) => ({
          pda: pda.toBase58(),
          title: task.title || 'Untitled',
          reward: (task.reward || 0) / 1e9,
          status: getTaskStatusName(task.status),
          worker: task.worker?.toBase58?.() || ''
        }))
      } else {
        // Fetch tasks assigned to this user
        const assignedTasks = await acc.task.all([
          { memcmp: { offset: 40, bytes: publicKey.toBase58() } }
        ])
        allTasks = assignedTasks.map(({ publicKey: pda, account: task }) => ({
          pda: pda.toBase58(),
          title: task.title || 'Untitled',
          reward: (task.reward || 0) / 1e9,
          status: getTaskStatusName(task.status),
          worker: task.worker?.toBase58?.() || ''
        }))
      }
      
      setTasks(allTasks)
    } catch (err) {
      console.error('Error fetching tasks:', err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  function getTaskStatusName(status: number): string {
    const names = ['Open', 'Assigned', 'InProgress', 'Submitted', 'Verified', 'Cancelled', 'Disputed']
    return names[status] || 'Unknown'
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'Open': return 'bg-emerald-500/15 text-emerald-400'
      case 'Assigned': return 'bg-blue-500/15 text-blue-400'
      case 'InProgress': return 'bg-yellow-500/15 text-yellow-400'
      case 'Submitted': return 'bg-purple-500/15 text-purple-400'
      case 'Verified': return 'bg-[#14F195]/15 text-[#14F195]'
      case 'Cancelled': return 'bg-red-500/15 text-red-400'
      case 'Disputed': return 'bg-orange-500/15 text-orange-400'
      default: return 'bg-gray-500/15 text-gray-400'
    }
  }

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <span className="text-5xl mb-4 block">🔒</span>
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-gray-500">Connect your wallet to view your tasks</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Tasks</h1>
          <p className="text-gray-500 text-sm">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/task/create" className="px-4 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg text-white text-sm font-medium">
          + New Task
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('created')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'created'
              ? 'bg-[#9945FF]/20 text-[#9945FF] border border-[#9945FF]/50'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Created
        </button>
        <button
          onClick={() => setActiveTab('assigned')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'assigned'
              ? 'bg-[#9945FF]/20 text-[#9945FF] border border-[#9945FF]/50'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Assigned to Me
        </button>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#111827] border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
          <span className="text-4xl mb-4 block">📋</span>
          <p className="text-gray-400 font-medium">No tasks found</p>
          <p className="text-gray-600 text-sm mt-1">
            {activeTab === 'created' ? 'Create your first task to get started' : 'No tasks assigned to you yet'}
          </p>
          {activeTab === 'created' && (
            <Link to="/task/create" className="inline-block mt-4 px-5 py-2.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg text-white text-sm font-medium">
              Create Task
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <Link
              key={task.pda}
              to={`/tasks/${task.pda}`}
              className="block bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-[#9945FF]/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{task.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">Reward: {task.reward.toFixed(4)} SOL</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
              </div>
              
              {task.worker && (
                <p className="text-gray-500 text-xs mt-2">
                  Worker: {task.worker.slice(0, 8)}...{task.worker.slice(-8)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
