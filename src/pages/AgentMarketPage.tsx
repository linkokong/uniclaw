import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'


interface AgentListing {
  pda: string
  name: string
  description: string
  owner: string
  hourlyRate: number
  monthlyRate: number
  capabilities: string[]
  rating: number
  totalJobs: number
  verified: boolean
}

export default function AgentMarketPage() {
  const { connected } = useWallet()
  const [agents, setAgents] = useState<AgentListing[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    type: 'all',
    priceRange: 'all',
    verified: false
  })
  const [search, setSearch] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<AgentListing | null>(null)
  const [rentDuration, setRentDuration] = useState<'hourly' | 'monthly'>('hourly')

  useEffect(() => {
    loadAgents()
  }, [])

  async function loadAgents() {
    setLoading(true)
    try {
      // TODO: Replace with real chain data when Agent Profile PDA is implemented
      // Mock data for now
      const mockAgents: AgentListing[] = [
        {
          pda: 'agent1',
          name: 'DataExtractor Pro',
          description: 'Specialized in web scraping, data extraction, and API integration. Fast and reliable for large-scale data tasks.',
          owner: '7xKXtg2CW87d97TXJSDpbD5jBkheWrrsY',
          hourlyRate: 0.5,
          monthlyRate: 150,
          capabilities: ['Web Scraping', 'Data Processing', 'API Integration'],
          rating: 4.8,
          totalJobs: 127,
          verified: true
        },
        {
          pda: 'agent2',
          name: 'ReportGenerator',
          description: 'Creates professional reports from raw data. Supports PDF, Excel, and PowerPoint outputs.',
          owner: '9WzDXwZ4DmbftkgwvzSYP2J1Wq4J3TAK',
          hourlyRate: 0.3,
          monthlyRate: 80,
          capabilities: ['Report Generation', 'Data Visualization', 'PDF Export'],
          rating: 4.5,
          totalJobs: 89,
          verified: true
        },
        {
          pda: 'agent3',
          name: 'AITranslator',
          description: 'Multi-language translation with context awareness. Supports 50+ languages.',
          owner: '5G45h2W3BnXmKpLqRsT7Yz',
          hourlyRate: 0.4,
          monthlyRate: 100,
          capabilities: ['Translation', 'Localization', 'Content Review'],
          rating: 4.6,
          totalJobs: 203,
          verified: false
        },
        {
          pda: 'agent4',
          name: 'CodeReviewer',
          description: 'Automated code review with security analysis. Supports Python, JavaScript, Rust, and Go.',
          owner: '3H8kLzA9BmXpQrWtY',
          hourlyRate: 1.0,
          monthlyRate: 300,
          capabilities: ['Code Review', 'Security Audit', 'Performance Analysis'],
          rating: 4.9,
          totalJobs: 56,
          verified: true
        }
      ]
      setAgents(mockAgents)
    } catch (err) {
      console.error('loadAgents error:', err)
    } finally {
      setLoading(false)
    }
  }

  function filterAgents() {
    let filtered = agents
    
    if (search) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    if (filter.verified) {
      filtered = filtered.filter(a => a.verified)
    }
    
    if (filter.priceRange !== 'all') {
      const [min, max] = {
        'low': [0, 0.4],
        'medium': [0.4, 0.7],
        'high': [0.7, Infinity]
      }[filter.priceRange] || [0, Infinity]
      filtered = filtered.filter(a => a.hourlyRate >= min && a.hourlyRate <= max)
    }
    
    if (filter.type !== 'all') {
      filtered = filtered.filter(a => 
        a.capabilities.some(c => c.toLowerCase().includes(filter.type.toLowerCase()))
      )
    }
    
    return filtered
  }

  function handleRent(agent: AgentListing) {
    if (!connected) {
      alert('Please connect your wallet first')
      return
    }
    setSelectedAgent(agent)
  }

  function confirmRent() {
    if (!selectedAgent) return
    // TODO: Call rent_agent instruction when contract supports it
    alert(`Renting ${selectedAgent.name} for ${rentDuration === 'hourly' ? selectedAgent.hourlyRate + ' SOL/hour' : selectedAgent.monthlyRate + ' SOL/month'}\n\nThis feature will be implemented in Phase 2`)
    setSelectedAgent(null)
  }

  const filteredAgents = filterAgents()

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Market</h1>
          <p className="text-gray-500 text-sm">Hire AI Agents for your tasks</p>
        </div>
        <Link to="/" className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
          ← Back to Tasks
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-[#9945FF]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-[#9945FF]"
            >
              <option value="all">All Types</option>
              <option value="data">Data</option>
              <option value="code">Code</option>
              <option value="translation">Translation</option>
            </select>
            <select
              value={filter.priceRange}
              onChange={(e) => setFilter({ ...filter, priceRange: e.target.value })}
              className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-[#9945FF]"
            >
              <option value="all">All Prices</option>
              <option value="low">Low (0-0.4 SOL/hr)</option>
              <option value="medium">Medium (0.4-0.7 SOL/hr)</option>
              <option value="high">High (0.7+ SOL/hr)</option>
            </select>
            <button
              onClick={() => setFilter({ ...filter, verified: !filter.verified })}
              className={`px-3 py-2 rounded-lg border transition-colors ${
                filter.verified 
                  ? 'bg-[#14F195]/20 border-[#14F195]/50 text-[#14F195]' 
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}
            >
              Verified Only
            </button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-gray-500 text-sm">
        Showing {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
      </p>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-[#111827] border border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-gray-700 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-700 rounded w-full mb-2" />
              <div className="h-3 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-12 text-center">
          <span className="text-4xl mb-4 block">🤖</span>
          <p className="text-gray-400 font-medium">No agents found</p>
          <p className="text-gray-600 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map(agent => (
            <div 
              key={agent.pda}
              className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-[#9945FF]/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{agent.name}</h3>
                    {agent.verified && (
                      <span className="px-1.5 py-0.5 bg-[#14F195]/20 text-[#14F195] rounded text-xs">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    by {agent.owner.slice(0, 8)}...{agent.owner.slice(-8)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[#14F195] font-bold">{agent.hourlyRate} SOL</p>
                  <p className="text-gray-500 text-xs">/hour</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{agent.description}</p>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {agent.capabilities.slice(0, 3).map((cap, i) => (
                  <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">
                    {cap}
                  </span>
                ))}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                <span>⭐ {agent.rating}</span>
                <span>{agent.totalJobs} jobs</span>
                <span>{agent.monthlyRate} SOL/mo</span>
              </div>

              {/* Action */}
              <button
                onClick={() => handleRent(agent)}
                className="w-full py-2.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Rent Now
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Rent Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4">Rent {selectedAgent.name}</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-gray-400 text-sm mb-2">Select Duration</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRentDuration('hourly')}
                    className={`flex-1 py-3 rounded-lg border transition-colors ${
                      rentDuration === 'hourly'
                        ? 'bg-[#9945FF]/20 border-[#9945FF] text-[#9945FF]'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    Hourly
                    <br />
                    <span className="text-lg font-bold">{selectedAgent.hourlyRate} SOL</span>
                  </button>
                  <button
                    onClick={() => setRentDuration('monthly')}
                    className={`flex-1 py-3 rounded-lg border transition-colors ${
                      rentDuration === 'monthly'
                        ? 'bg-[#9945FF]/20 border-[#9945FF] text-[#9945FF]'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    Monthly
                    <br />
                    <span className="text-lg font-bold">{selectedAgent.monthlyRate} SOL</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-xs">You will be charged</p>
                <p className="text-white text-lg font-bold">
                  {rentDuration === 'hourly' ? selectedAgent.hourlyRate : selectedAgent.monthlyRate} SOL
                </p>
              </div>

              {!connected && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-500 text-sm">⚠️ Please connect your wallet to rent</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedAgent(null)}
                className="flex-1 py-2.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmRent}
                disabled={!connected}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                Confirm Rent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
