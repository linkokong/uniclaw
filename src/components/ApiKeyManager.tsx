/**
 * API Key Management Component
 * Sprint 2 W2: Identity Layer + API Key + RBAC
 */

import { useState, useEffect } from 'react'

interface ApiKey {
  id: string
  keyPrefix: string
  name: string
  scopes: string[]
  active: boolean
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface Props {
  walletAddress: string
}

const SCOPE_LABELS: Record<string, string> = {
  'read:profile': 'Read Profile',
  'read:tasks': 'View Tasks',
  'read:agents': 'Browse Agents',
  'read:wallet': 'View Wallet',
  'write:tasks': 'Manage Tasks',
  'bid:tasks': 'Bid on Tasks',
  'accept:tasks': 'Accept Assignments',
  'submit:tasks': 'Submit Results',
  'register:agent': 'Register Agent',
  'manage:agent': 'Manage Agent',
  'withdraw:funds': 'Withdraw Funds',
  'admin:all': 'Admin (All Access)',
}

export default function ApiKeyManager({ walletAddress }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    scopes: [] as string[],
    expiresInDays: 365,
  })

  useEffect(() => {
    fetchKeys()
  }, [walletAddress])

  const fetchKeys = async () => {
    try {
      const token = localStorage.getItem('claw_wallet_token')
      const res = await fetch('/api/v1/api-keys', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setKeys(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    } finally {
      setLoading(false)
    }
  }

  const createKey = async () => {
    try {
      const token = localStorage.getItem('claw_wallet_token')
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      })
      const data = await res.json()
      if (data.success) {
        setNewKey(data.data.key)
        setShowCreateModal(false)
        fetchKeys()
      } else {
        alert(data.error?.message || 'Failed to create key')
      }
    } catch (err) {
      console.error('Failed to create API key:', err)
      alert('Failed to create API key')
    }
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return
    
    try {
      const token = localStorage.getItem('claw_wallet_token')
      const res = await fetch(`/api/v1/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        fetchKeys()
      }
    } catch (err) {
      console.error('Failed to delete API key:', err)
    }
  }

  const toggleScope = (scope: string) => {
    setCreateForm(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }))
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading API keys...</div>
  }

  return (
    <div className="space-y-4">
      {/* New Key Display Modal */}
      {newKey && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-white font-semibold mb-2">API Key Created</h3>
            <p className="text-gray-400 text-sm mb-4">
              ⚠️ Save this key securely. It will not be shown again.
            </p>
            <div className="bg-gray-900 p-3 rounded font-mono text-xs text-green-400 break-all mb-4">
              {newKey}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKey)
                  alert('Copied!')
                }}
                className="flex-1 px-4 py-2 bg-[#9945FF] text-white rounded-lg hover:bg-[#8030dd] transition-colors"
              >
                Copy Key
              </button>
              <button
                onClick={() => setNewKey(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-white font-semibold mb-4">Create API Key</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., Hermes Bot"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-2 block">Scopes</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
                    <label
                      key={scope}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                        createForm.scopes.includes(scope)
                          ? 'bg-[#9945FF]/20 border border-[#9945FF]'
                          : 'bg-gray-900 border border-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={createForm.scopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        className="hidden"
                      />
                      <span className={createForm.scopes.includes(scope) ? 'text-white' : 'text-gray-400'}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Expires In (days)</label>
                <input
                  type="number"
                  value={createForm.expiresInDays}
                  onChange={(e) => setCreateForm({ ...createForm, expiresInDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={createKey}
                disabled={!createForm.name || createForm.scopes.length === 0}
                className="flex-1 px-4 py-2 bg-[#9945FF] text-white rounded-lg hover:bg-[#8030dd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key List */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">API Keys</h3>
        <button
          onClick={() => {
            setCreateForm({ name: '', scopes: [], expiresInDays: 365 })
            setShowCreateModal(true)
          }}
          className="px-4 py-2 bg-[#9945FF] text-white rounded-lg hover:bg-[#8030dd] transition-colors text-sm"
        >
          + Create Key
        </button>
      </div>

      {keys.length === 0 ? (
        <div className="text-gray-500 text-sm text-center py-8 border border-gray-800 rounded-lg">
          No API keys yet. Create one to access the platform programmatically.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="p-4 bg-gray-900 border border-gray-800 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{key.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      key.active ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {key.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-gray-500 text-xs font-mono mt-1">{key.keyPrefix}...</div>
                </div>
                <button
                  onClick={() => deleteKey(key.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {key.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded"
                  >
                    {SCOPE_LABELS[scope] || scope}
                  </span>
                ))}
              </div>
              <div className="text-gray-600 text-xs mt-2">
                Created: {new Date(key.createdAt).toLocaleDateString()}
                {key.lastUsedAt && ` • Last used: ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                {key.expiresAt && ` • Expires: ${new Date(key.expiresAt).toLocaleDateString()}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
