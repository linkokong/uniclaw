import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Task Square', icon: '📋' },
  { path: '/agents', label: 'Agent Market', icon: '🤖' },
  { path: '/my-tasks', label: 'My Tasks', icon: '📁' },
  { path: '/earnings', label: 'Earnings', icon: '💰' },
  { path: '/profile', label: 'My Profile', icon: '👤' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#0a0a1a] border-r border-gray-800/70 z-40">
      <nav className="p-4 space-y-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
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

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800/60">
        <div className="px-4 py-3 bg-gray-800/40 rounded-xl">
          <p className="text-xs text-gray-500 mb-0.5 font-medium">Network</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-sm text-emerald-400 font-medium">Solana Mainnet</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
