import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { registerAgent, findAgentProfilePda, connection } from '../api/anchorClient'

export default function RegisterProfile({ onComplete }: { onComplete?: () => void }) {
  const { publicKey, signTransaction, connected } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [checkingRegistration, setCheckingRegistration] = useState(true)

  // Form fields
  const [name, setName] = useState('')
  const [agentType, setAgentType] = useState('general')
  const [skills, setSkills] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')

  // Check if already registered on mount
  useEffect(() => {
    if (!connected || !publicKey) {
      setCheckingRegistration(false)
      return
    }

    const checkRegistration = async () => {
      try {
        const profilePda = findAgentProfilePda(publicKey)
        const accountInfo = await connection.getAccountInfo(profilePda)
        if (accountInfo !== null) {
          setAlreadyRegistered(true)
        }
      } catch (err) {
        console.error('Error checking registration:', err)
      } finally {
        setCheckingRegistration(false)
      }
    }

    checkRegistration()
  }, [connected, publicKey])

  const handleRegister = async () => {
    if (!publicKey || !signTransaction) {
      setError('请先连接钱包')
      return
    }

    if (!name.trim()) {
      setError('请输入名称')
      return
    }

    if (!skills.trim()) {
      setError('请输入技能（用逗号分隔）')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Call the real contract
      const tx = await registerAgent(
        { publicKey, signTransaction },
        name.trim(),
        agentType,  // IDL field, contract ignores but keeps for compatibility
        skills.trim(),
        0  // hourlyRate: contract ignores, pass 0
      )

      // Confirm transaction
      await connection.confirmTransaction(tx, 'confirmed')
      setSuccess(true)

      if (onComplete) {
        onComplete()
      }
    } catch (err: any) {
      console.error('Registration error:', err)
      setError(err.message || '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (!connected) {
    return (
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 text-center">
        <p className="text-gray-400 mb-4">请先连接钱包</p>
      </div>
    )
  }

  if (checkingRegistration) {
    return (
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 text-center">
        <p className="text-gray-400 mb-4">检查注册状态中...</p>
      </div>
    )
  }

  if (alreadyRegistered) {
    return (
      <div className="bg-[#111827] border border-green-500/30 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-green-400 font-semibold text-lg mb-2">已注册</h3>
        <p className="text-gray-400 text-sm">您的 Agent Profile 已存在</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="bg-[#111827] border border-green-500/30 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-green-400 font-semibold text-lg mb-2">注册成功！</h3>
        <p className="text-gray-400 text-sm">您现在可以接单和发布任务了</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-4">
      <h2 className="text-white font-semibold text-lg">注册 Agent Profile</h2>
      <p className="text-gray-400 text-sm">注册后即可参与任务接单和租赁</p>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="给你的 Agent 起个名字"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50 transition-all"
        />
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">Agent 类型</label>
        <select
          value={agentType}
          onChange={(e) => setAgentType(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#14F195]/50 transition-all"
        >
          <option value="general">General Worker</option>
          <option value="developer">Developer</option>
          <option value="designer">Designer</option>
          <option value="data">Data Analyst</option>
        </select>
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">技能（用逗号分隔）</label>
        <input
          type="text"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="solidity, rust, python, react"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50 transition-all"
        />
        <p className="text-gray-500 text-xs mt-1">示例: solidity, rust, python, react</p>
      </div>

      <div>
        <label className="block text-gray-400 text-sm mb-1.5">时薪 (SOL/hour)</label>
        <input
          type="number"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          placeholder="0"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-[#14F195]/50 transition-all"
        />
        <p className="text-gray-500 text-xs mt-1">时薪信息（仅作展示用）</p>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        onClick={handleRegister}
        disabled={loading}
        className="w-full bg-gradient-to-r from-[#14F195] to-[#06B6D4] text-gray-900 font-semibold py-3 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
      >
        {loading ? '注册中...' : '注册'}
      </button>
    </div>
  )
}
