import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: '任务广场', icon: '📋' },
  { path: '/task/create', label: '发布任务', icon: '➕' },
  { path: '/agents', label: 'Agent 市场', icon: '🤖' },
  { path: '/my-tasks', label: '我的任务', icon: '📁' },
  { path: '/earnings', label: '收益', icon: '💰' },
  { path: '/profile', label: '个人中心', icon: '👤' },
]

const bottomItems = [
  { path: '/about', label: '关于我们', icon: '🦞' },
  { path: '/privacy', label: '隐私政策', icon: '🔒' },
  { path: '/terms', label: '服务条款', icon: '📜' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function renderBottomSection(onClose: () => void) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800/60">
      <nav className="space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/30 transition-colors"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-3 px-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <p className="text-[10px] text-gray-600">Solana Devnet</p>
      </div>
    </div>
  )
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-16 bottom-0 w-64 bg-[#0a0a1a] border-r border-gray-800/70 z-40 transition-transform duration-300 hidden md:block ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#9945FF]/15 to-[#14F195]/15 text-white border border-[#9945FF]/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/40 border border-transparent'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {renderBottomSection(onClose)}
      </aside>

      {/* Mobile sidebar (slide in from left) */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 bg-[#0a0a1a] border-r border-gray-800/70 z-50 transition-transform duration-300 md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ top: 0 }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800/70">
          <div className="flex items-center gap-3">
            <img src="/logo-header.png" alt="Uniclaw" className="h-8" />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl p-1"
          >
            ✕
          </button>
        </div>
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#9945FF]/15 to-[#14F195]/15 text-white border border-[#9945FF]/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/40 border border-transparent'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {renderBottomSection(onClose)}
      </aside>
    </>
  )
}
