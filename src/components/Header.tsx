import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import WalletConnect from './WalletConnect'

interface HeaderProps {
  onToggleSidebar?: () => void
}

const mainNav = [
  { path: '/', label: '任务广场' },
  { path: '/task/create', label: '发布任务' },
  { path: '/agents', label: 'Agent 市场' },
]

const profileMenu = [
  { path: '/profile', label: '个人中心', icon: '👤' },
  { path: '/my-tasks', label: '我的任务', icon: '📁' },
  { path: '/my-bids', label: '我的竞标', icon: '📝' },
  { path: '/earnings', label: '收益', icon: '💰' },
  { path: '/wallet', label: '钱包', icon: '👛' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

export default function Header({ onToggleSidebar }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { connected, publicKey, disconnect } = useWallet()
  const [profileOpen, setProfileOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  // Close on route change
  useEffect(() => { setProfileOpen(false) }, [location.pathname])

  const shortAddr = publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : ''

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-bg-base/95 backdrop-blur-sm border-b border-border z-50 flex items-center justify-between px-4 lg:px-6">
      {/* Left: Hamburger (mobile) + Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="md:hidden text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link to="/" className="shrink-0">
          <img src="/logo-header.png" alt="Uniclaw" className="h-7 hover:opacity-90 transition-opacity" />
        </Link>
      </div>

      {/* Right: Nav + Profile + Wallet */}
      <div className="flex items-center gap-1">
        {/* Main nav — desktop */}
        <nav className="hidden md:flex items-center gap-1 mr-3">
          {mainNav.map((link) => {
            const isActive = link.path === '/' ? location.pathname === '/' : location.pathname.startsWith(link.path)
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#9945FF]/15 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Profile dropdown — only when wallet connected */}
        {connected && (
          <div ref={dropdownRef} className="relative hidden md:block">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                profileOpen || profileMenu.some(m => location.pathname === m.path)
                  ? 'bg-[#9945FF]/15 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-[10px] font-bold text-white">
                {shortAddr.slice(0, 1).toUpperCase()}
              </div>
              <span>{shortAddr}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${profileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#111827] border border-gray-800 rounded-xl shadow-2xl shadow-black/40 py-1.5 z-50">
                {profileMenu.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                      location.pathname === item.path
                        ? 'text-white bg-[#9945FF]/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
                <div className="border-t border-gray-800 my-1.5" />
                <button
                  onClick={() => { disconnect(); setProfileOpen(false); navigate('/') }}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full transition-colors"
                >
                  <span>🔌</span>
                  <span>断开钱包</span>
                </button>
              </div>
            )}
          </div>
        )}

        <WalletConnect />
      </div>
    </header>
  )
}
