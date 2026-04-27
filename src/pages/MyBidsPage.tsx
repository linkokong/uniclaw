import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'
import { withdrawBid, classifyChainError, fetchBidsByBidder, fetchTask } from '../api/anchorClient'
import { PublicKey } from '@solana/web3.js'

interface MyBid {
  pda: string
  taskPda: string
  amount: number
  taskTitle: string
  taskReward: number
  taskStatus: string
}

export default function MyBidsPage() {
  const { publicKey, connected, signTransaction } = useWallet()
  const [bids, setBids] = useState<MyBid[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected || !publicKey) {
      setLoading(false)
      return
    }
    loadMyBids()
  }, [connected, publicKey])

  async function loadMyBids() {
    if (!publicKey) return
    setLoading(true)
    setError(null)
    try {
      const bids = await fetchBidsByBidder(publicKey)

      const bidsWithTasks = await Promise.all(
        bids.map(async ({ pubkey: bidPda, data: bid }) => {
          try {
            const task = await fetchTask(bid.task as PublicKey) as any
            const taskData = (task && typeof task === 'object') ? task : {}
            return {
              pda: bidPda,
              taskPda: (bid.task as PublicKey).toBase58(),
              amount: Number(bid.deposit) / 1e9,
              taskTitle: taskData.title || 'Untitled',
              taskReward: (taskData.reward || 0) / 1e9,
              taskStatus: getTaskStatusName(taskData.status)
            }
          } catch {
            return null
          }
        })
      )

      setBids(bidsWithTasks.filter((b): b is MyBid => b !== null))
    } catch (err) {
      console.error('loadMyBids error:', err)
      setError('Failed to load bids from chain')
    } finally {
      setLoading(false)
    }
  }

  function getTaskStatusName(status: number): string {
    const names = ['Open', 'Assigned', 'InProgress', 'Submitted', 'Verified', 'Cancelled', 'Disputed']
    return names[status] || 'Unknown'
  }

  async function handleCancelBid(bidPda: string, taskPda: string) {
    if (!publicKey || !signTransaction) return
    setCancelling(bidPda)
    try {
      const wallet = { publicKey, signTransaction }
      const sig = await withdrawBid(wallet, new PublicKey(taskPda))
      console.log('Bid cancelled:', sig)
      await loadMyBids()
    } catch (err: any) {
      const classified = classifyChainError(err)
      setError(classified.userMsg)
      console.error('Cancel bid error:', err)
    } finally {
      setCancelling(null)
    }
  }

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <span className="text-5xl mb-4 block">🔒</span>
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-gray-500">Connect your wallet to view your bids</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Bids</h1>
          <p className="text-gray-500 text-sm">{bids.length} active bid{bids.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/" className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
          ← Back to Tasks
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-3 text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#111827] border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : bids.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
          <span className="text-4xl mb-4 block">📝</span>
          <p className="text-gray-400 font-medium">No active bids</p>
          <p className="text-gray-600 text-sm mt-1">Browse tasks and place your first bid</p>
          <Link to="/" className="inline-block mt-4 px-5 py-2.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg text-white text-sm font-medium">
            Browse Tasks
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bids.map(bid => (
            <div key={bid.pda} className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-[#9945FF]/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Link to={`/tasks/${bid.taskPda}`} className="text-lg font-semibold text-white hover:text-[#14F195] transition-colors">
                    {bid.taskTitle}
                  </Link>
                  <p className="text-gray-500 text-sm mt-1">Task reward: {bid.taskReward.toFixed(3)} SOL</p>
                </div>
                <div className="text-right">
                  <p className="text-[#14F195] font-bold">{bid.amount.toFixed(3)} SOL</p>
                  <p className="text-xs text-gray-500">Your bid</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  bid.taskStatus === 'Open' ? 'bg-emerald-500/15 text-emerald-400' :
                  bid.taskStatus === 'Assigned' ? 'bg-blue-500/15 text-blue-400' :
                  'bg-gray-500/15 text-gray-400'
                }`}>
                  {bid.taskStatus}
                </span>

                {bid.taskStatus === 'Open' && (
                  <button
                    onClick={() => handleCancelBid(bid.pda, bid.taskPda)}
                    disabled={cancelling === bid.pda}
                    className="px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/25 transition-colors disabled:opacity-50"
                  >
                    {cancelling === bid.pda ? 'Cancelling...' : 'Cancel Bid'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
