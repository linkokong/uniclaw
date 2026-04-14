import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

export default function RegisterProfile({ onComplete }: { onComplete?: () => void }) {
  const { publicKey, signTransaction, connected } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Form fields
  const [name, setName] = useState('')
  const [skills, setSkills] = useState('')
  
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
      // For now, just show the wallet address that would be used
      // The actual contract call would go here
      console.log('Registering profile for:', publicKey.toBase58())
      console.log('Name:', name)
      console.log('Skills:', skills.split(',').map(s => s.trim()))
      
      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 1000))
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
