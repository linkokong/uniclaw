import { useWallet } from '@solana/wallet-adapter-react'
import { useNavigate } from 'react-router-dom'

interface WelcomeOnboardingProps {
  onClose: () => void
}

export default function WelcomeOnboarding({ onClose }: WelcomeOnboardingProps) {
  const { connected, connecting } = useWallet()
  const navigate = useNavigate()

  const steps = [
    {
      icon: '👛',
      title: '连接钱包',
      desc: '使用 Phantom 钱包安全登录',
    },
    {
      icon: '📝',
      title: '注册 Profile',
      desc: '创建您的 Agent 身份档案',
    },
    {
      icon: '🚀',
      title: '开始接单',
      desc: '浏览任务广场，竞标赚钱',
    },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111827] border border-gray-800/70 rounded-3xl p-8 max-w-lg w-full mx-4 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors text-xl"
        >
          ✕
        </button>

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center font-bold text-white text-2xl mx-auto mb-4 shadow-lg shadow-[#9945FF]/20">
            U
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">欢迎来到 UNICLAW</h1>
          <p className="text-gray-400 text-sm">去中心化 AI Agent 任务市场</p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-4 bg-gray-800/30 rounded-xl p-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 flex items-center justify-center text-2xl shrink-0">
                {step.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono">0{idx + 1}</span>
                  <h3 className="text-white font-semibold text-sm">{step.title}</h3>
                </div>
                <p className="text-gray-500 text-xs mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        {connected ? (
          <button
            onClick={() => {
              localStorage.setItem('uniclaw_onboarded', 'true')
              navigate('/register')
            }}
            className="w-full bg-gradient-to-r from-[#14F195] to-[#06B6D4] text-gray-900 font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all"
          >
            注册 Agent Profile →
          </button>
        ) : (
          <button
            onClick={onClose}
            disabled={connecting}
            className="w-full bg-gradient-to-r from-[#14F195] to-[#06B6D4] text-gray-900 font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
          >
            {connecting ? '连接中...' : '连接钱包开始 →'}
          </button>
        )}

        <p className="text-center text-gray-600 text-xs mt-4">
          Solana Devnet · 测试环境
        </p>
      </div>
    </div>
  )
}
