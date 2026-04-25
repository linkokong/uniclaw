import { Link, useLocation } from 'react-router-dom'
import WalletConnect from './WalletConnect'

interface HeaderProps {
  onToggleSidebar?: () => void
  isMobile?: boolean
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const location = useLocation()

  // Header 只保留核心入口，避免和侧边栏重复
  const navLinks = [
    { path: '/', label: '任务广场' },
    { path: '/task/create', label: '发布任务' },
    { path: '/agents', label: 'Agent 市场' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-bg-base/95 backdrop-blur-sm border-b border-border z-50 flex items-center justify-between px-4 md:px-6">
      {/* Left: Hamburger + Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="Toggle Sidebar"
          aria-label="Toggle sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-2 group">
          <img src="/logo-header.jpeg" alt="Uniclaw" className="h-8 group-hover:opacity-90 transition-opacity" />
        </Link>
      </div>

      {/* Navigation — 核心入口（不与侧边栏重复） */}
      <nav className="hidden md:flex items-center gap-6">
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`text-sm font-medium transition-colors ${
              location.pathname === link.path
                ? 'text-solana-gradient'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Wallet Connect */}
      <WalletConnect />
    </header>
  )
}
