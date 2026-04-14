import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface Task {
  id: string
  title: string
  description: string
  reward: number
  status: 'open' | 'in_progress' | 'completed'
  deadline: string
  category: string
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'AI Article Writer Agent',
    description: 'Create a React agent that writes tech articles on Solana ecosystem',
    reward: 5,
    status: 'open',
    deadline: '2026-04-15',
    category: 'Content Creation',
  },
  {
    id: '2',
    title: 'DeFi Analytics Dashboard',
    description: 'Build a dashboard for tracking DeFi protocols on Solana',
    reward: 10,
    status: 'open',
    deadline: '2026-04-20',
    category: 'Development',
  },
  {
    id: '3',
    title: 'Social Media Bot',
    description: 'Automated Twitter bot for crypto news aggregation',
    reward: 3,
    status: 'in_progress',
    deadline: '2026-04-10',
    category: 'Automation',
  },
]

export default function TasksPage() {
  const { connected } = useWallet()
  const [filter, setFilter] = useState<'all' | 'open' | 'my_tasks'>('all')

  const filteredTasks = mockTasks.filter((task) => {
    if (filter === 'open') return task.status === 'open'
    return true
  })

  const statusColors = {
    open: 'bg-[#14F195]/20 text-[#14F195]',
    in_progress: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Task Square</h1>
        <div className="flex gap-2">
          {(['all', 'open', 'my_tasks'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                filter === f
                  ? 'bg-[#9945FF] text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All Tasks' : f === 'open' ? 'Open' : 'My Tasks'}
            </button>
          ))}
        </div>
      </div>

      {!connected && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400">
          Please connect your wallet to browse and accept tasks
        </div>
      )}

      <div className="grid gap-4">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-[#9945FF]/30 transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold mb-1">{task.title}</h3>
                <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400">
                  {task.category}
                </span>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#14F195]">{task.reward} SOL</p>
                <p className="text-xs text-gray-500">Deadline: {task.deadline}</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">{task.description}</p>
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
                {task.status.replace('_', ' ').toUpperCase()}
              </span>
              <button
                disabled={!connected || task.status !== 'open'}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  connected && task.status === 'open'
                    ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {task.status === 'open' ? 'Accept Task' : 'Unavailable'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
