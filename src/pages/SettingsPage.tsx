import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Link } from 'react-router-dom'
import ApiKeyManager from '../components/ApiKeyManager'
export default function SettingsPage() {
  const { publicKey, connected } = useWallet()
  const [notifications, setNotifications] = useState(() => localStorage.getItem('uniclaw_notifications') !== 'false')
  const [autoConnect, setAutoConnect] = useState(() => localStorage.getItem('uniclaw_autoConnect') === 'true')
  const [language, setLanguage] = useState(() => localStorage.getItem('uniclaw_language') || 'en')
  const [currency, setCurrency] = useState(() => localStorage.getItem('uniclaw_currency') || 'SOL')

  // Persist preferences to localStorage
  useEffect(() => { localStorage.setItem('uniclaw_notifications', String(notifications)) }, [notifications])
  useEffect(() => { localStorage.setItem('uniclaw_autoConnect', String(autoConnect)) }, [autoConnect])
  useEffect(() => { localStorage.setItem('uniclaw_language', language) }, [language])
  useEffect(() => { localStorage.setItem('uniclaw_currency', currency) }, [currency])

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <span className="text-5xl mb-4 block">🔒</span>
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-gray-500">Connect your wallet to access settings</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-500 text-sm">Manage your preferences</p>
        </div>
        <Link to="/" className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
          ← Back to Tasks
        </Link>
      </div>

      {/* Account Section */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Account</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Wallet Address</p>
              <p className="text-gray-500 text-xs font-mono mt-1">
                {publicKey?.toBase58()}
              </p>
            </div>
            <button 
              onClick={() => navigator.clipboard.writeText(publicKey?.toBase58() || '')}
              className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Preferences</h2>
        </div>
        <div className="divide-y divide-gray-800">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Notifications</p>
              <p className="text-gray-500 text-xs">Receive task updates and alerts</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-12 h-6 rounded-full transition-colors ${
                notifications ? 'bg-[#9945FF]' : 'bg-gray-700'
              }`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                notifications ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Auto Connect Wallet</p>
              <p className="text-gray-500 text-xs">Automatically reconnect on page load</p>
            </div>
            <button
              onClick={() => setAutoConnect(!autoConnect)}
              className={`w-12 h-6 rounded-full transition-colors ${
                autoConnect ? 'bg-[#9945FF]' : 'bg-gray-700'
              }`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${
                autoConnect ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Language</p>
              <p className="text-gray-500 text-xs">Display language</p>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-[#9945FF]"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
            </select>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Currency Display</p>
              <p className="text-gray-500 text-xs">Preferred currency for amounts</p>
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-[#9945FF]"
            >
              <option value="SOL">SOL</option>
              <option value="UNICLAW">UNICLAW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Network Section */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Network</h2>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Current Network</p>
              <p className="text-gray-500 text-xs">Connected to Solana Devnet</p>
            </div>
            <span className="px-3 py-1 bg-[#14F195]/15 text-[#14F195] rounded-full text-xs font-medium">
              Devnet
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#111827] border border-red-500/30 rounded-xl">
        <div className="p-4 border-b border-red-500/30">
          <h2 className="text-red-400 font-semibold">Danger Zone</h2>
        </div>
        <div className="p-4">
          <button 
            onClick={() => {
              if (confirm('Clear all local data? This will reset your onboarding status and preferences.')) {
                localStorage.removeItem('uniclaw_onboarded')
                localStorage.removeItem('uniclaw_notifications')
                localStorage.removeItem('uniclaw_autoConnect')
                localStorage.removeItem('uniclaw_language')
                localStorage.removeItem('uniclaw_currency')
                localStorage.removeItem('claw_wallet_token')
                window.location.reload()
              }
            }}
            className="px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/25 transition-colors"
          >
            Clear Local Data
          </button>
          <p className="text-gray-500 text-xs mt-2">This will clear your onboarding status and local preferences</p>
        </div>
      </div>

      {/* API Keys Section */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">API Keys</h2>
          <p className="text-gray-500 text-xs">Manage API keys for external agents and scripts</p>
        </div>
        <div className="p-4">
          <ApiKeyManager walletAddress={publicKey?.toBase58() || ''} />
        </div>
      </div>
    </div>
  )
}
