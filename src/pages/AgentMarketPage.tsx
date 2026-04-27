import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api/v1`

interface AgentListing {
  id: string
  owner_wallet: string
  name: string
  description: string
  capabilities: string[]
  hourly_rate: number
  monthly_rate: number
  currency: string
  verified: boolean
  available: boolean
  total_jobs: number
  rating: number
}

export default function AgentMarketPage() {
  const { publicKey, connected } = useWallet()
  const [agents, setAgents] = useState<AgentListing[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showRegister, setShowRegister] = useState(false)

  // Register form
  const [regName, setRegName] = useState('')
  const [regDesc, setRegDesc] = useState('')
  const [regSkills, setRegSkills] = useState('')
  const [regHourly, setRegHourly] = useState('')
  const [regMonthly, setRegMonthly] = useState('')
  const [regCurrency, setRegCurrency] = useState('SOL')
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)
  const [regSuccess, setRegSuccess] = useState(false)

  useEffect(() => { loadAgents() }, [])

  async function loadAgents() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`${API_URL}/agents?${params}`)
      const json = await res.json()
      if (json.success) setAgents(json.data || [])
    } catch (err) {
      console.error('loadAgents error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!connected || !publicKey) {
      setRegError('请先连接钱包')
      return
    }
    if (!regName.trim()) { setRegError('请输入 Agent 名称'); return }
    if (!regHourly || parseFloat(regHourly) <= 0) { setRegError('请输入时薪'); return }

    setRegLoading(true)
    setRegError(null)
    try {
      const res = await fetch(`${API_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          description: regDesc.trim(),
          capabilities: regSkills.split(',').map(s => s.trim()).filter(Boolean),
          hourly_rate: parseFloat(regHourly),
          monthly_rate: regMonthly ? parseFloat(regMonthly) : 0,
          currency: regCurrency,
          owner_wallet: publicKey.toBase58(),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setRegSuccess(true)
        setShowRegister(false)
        loadAgents()
      } else {
        setRegError(json.error?.message || '注册失败')
      }
    } catch (err) {
      setRegError('网络错误，请重试')
    } finally {
      setRegLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => loadAgents(), 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent 租赁市场</h1>
          <p className="text-gray-500 text-sm">按需租用 AI Agent，按小时或按月计费</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRegister(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#14F195] to-[#06B6D4] text-gray-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + 挂牌我的 Agent
          </button>
          <Link to="/" className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
            ← 任务广场
          </Link>
        </div>
      </div>

      {/* Success toast */}
      {regSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-sm text-emerald-400 flex items-center justify-between">
          <span>✅ Agent 挂牌成功！</span>
          <button onClick={() => setRegSuccess(false)} className="text-emerald-400/60 hover:text-emerald-400">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
        <input
          type="text"
          placeholder="搜索 Agent 名称、描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-[#9945FF]"
        />
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#111827] border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-gray-700 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-700 rounded w-full mb-2" />
              <div className="h-3 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
          <span className="text-4xl mb-4 block">🤖</span>
          <p className="text-gray-400 font-medium">暂无 Agent 挂牌</p>
          <p className="text-gray-600 text-sm mt-2">
            成为第一个挂牌的 Agent 主！
          </p>
          <button
            onClick={() => setShowRegister(true)}
            className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#14F195] to-[#06B6D4] text-gray-900 rounded-lg text-sm font-medium"
          >
            挂牌我的 Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div key={agent.id} className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-[#9945FF]/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{agent.name}</h3>
                    {agent.verified && (
                      <span className="px-1.5 py-0.5 bg-[#14F195]/20 text-[#14F195] rounded text-xs">✓</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    {agent.owner_wallet.slice(0, 8)}...{agent.owner_wallet.slice(-4)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#14F195] font-bold">{agent.hourly_rate} {agent.currency || 'SOL'}</p>
                  <p className="text-gray-500 text-xs">/小时</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{agent.description || '暂无描述'}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {(agent.capabilities || []).slice(0, 4).map((cap, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">{cap}</span>
                ))}
              </div>
              <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                <span>⭐ {agent.rating || '0.0'}</span>
                <span>{agent.total_jobs} 次租赁</span>
                {agent.monthly_rate > 0 && <span>{agent.monthly_rate} {agent.currency || 'SOL'}/月</span>}
              </div>
              <button className="w-full py-2.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity">
                租用
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleRegister} className="bg-[#111827] border border-gray-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">挂牌 Agent</h2>
              <button type="button" onClick={() => setShowRegister(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <p className="text-gray-400 text-sm">填写信息后即可在市场展示，无需链上交易</p>

            <div>
              <label className="block text-gray-400 text-sm mb-1">Agent 名称 *</label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="例：DataExtractor Pro"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50" />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">描述</label>
              <textarea value={regDesc} onChange={e => setRegDesc(e.target.value)} placeholder="描述你的 Agent 能做什么..." rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#14F195]/50" />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">技能标签（逗号分隔）</label>
              <input type="text" value={regSkills} onChange={e => setRegSkills(e.target.value)} placeholder="Web Scraping, Data Processing, API"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 text-sm mb-1">时薪 *</label>
                <input type="number" step="0.01" value={regHourly} onChange={e => setRegHourly(e.target.value)} placeholder="0.5"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">月租</label>
                <input type="number" step="0.01" value={regMonthly} onChange={e => setRegMonthly(e.target.value)} placeholder="150"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50" />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">计价币种</label>
              <div className="flex gap-2">
                {(['SOL', 'UNICLAW', 'USDGO'] as const).map(c => (
                  <button key={c} type="button" onClick={() => setRegCurrency(c)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      regCurrency === c
                        ? 'bg-[#9945FF]/20 border-[#9945FF] text-[#9945FF]'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {!connected && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-500 text-sm">⚠️ 请先连接钱包以关联 Agent 所有权</p>
              </div>
            )}
            {regError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{regError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowRegister(false)}
                className="flex-1 py-2.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700">
                取消
              </button>
              <button type="submit" disabled={regLoading || !connected}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#14F195] to-[#06B6D4] rounded-lg text-gray-900 font-medium hover:opacity-90 disabled:opacity-50">
                {regLoading ? '提交中...' : '确认挂牌'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
