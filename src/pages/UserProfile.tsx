// ============================================================
// UserProfile - 用户资料页面
// 使用 src/api/user 的真实接口
// ============================================================

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getCurrentUser, updateProfile } from '../api/user'
import type { User } from '../types/api'
import { UserStatsGrid, ReputationScore } from '../components/UserStats'
import { SkillTagList, SkillSelectorModal } from '../components/SkillTags'

// ─── 等级徽章 ────────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: string }) {
  const config: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    'Bronze Worker': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', icon: '🥉' },
    'Silver Worker': { bg: 'bg-gray-400/10', text: 'text-gray-300', border: 'border-gray-500/30', icon: '🥈' },
    'Gold Worker': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: '🥇' },
    'Platinum Worker': { bg: 'bg-slate-400/10', text: 'text-slate-300', border: 'border-slate-400/30', icon: '💠' },
    'Diamond Worker': { bg: 'bg-blue-400/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: '💎' },
  }
  const c = config[rank] || config['Bronze Worker']
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span>{c.icon}</span>{rank}
    </span>
  )
}

// ─── 星星评分 ────────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-gray-600 text-xs">No rating</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star} className={`text-xs ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-700'}`}>
          ★
        </span>
      ))}
      <span className="text-xs text-gray-400 ml-1">{rating}</span>
    </div>
  )
}

// ─── 历史记录行 ─────────────────────────────────────────────────────────────
interface HistoryItem {
  id: string
  title: string
  reward: number
  status: 'completed' | 'in_progress' | 'disputed'
  date: string
  rating: number | null
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const statusConfig = {
    completed: { label: 'Completed', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    in_progress: { label: 'In Progress', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
    disputed: { label: 'Disputed', bg: 'bg-red-500/15', text: 'text-red-400' },
  }[item.status]

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-[#111827]/60 hover:bg-[#1a2235]/60 border border-gray-800/40 hover:border-gray-700/50 rounded-xl transition-all duration-200 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white group-hover:text-[#14F195] transition-colors truncate">
          {item.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{item.date}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
          {statusConfig.label}
        </span>
        <div className="text-right">
          <p className="text-sm font-bold text-[#14F195]">{item.reward} SOL</p>
          <StarRating rating={item.rating} />
        </div>
      </div>
    </div>
  )
}

// ─── 标签按钮 ────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-md'
          : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
      }`}
    >
      {children}
    </button>
  )
}

// ─── 历史记录（Mock，真实接口需要后端支持） ─────────────────────────────────
const mockHistory: HistoryItem[] = [
  { id: 'h1', title: 'AI Article Writer Agent', reward: 5, status: 'completed', date: '2026-04-03', rating: 5 },
  { id: 'h2', title: 'DeFi Analytics Dashboard', reward: 10, status: 'completed', date: '2026-03-28', rating: 4.5 },
  { id: 'h3', title: 'NFT Marketplace Frontend', reward: 8, status: 'in_progress', date: '2026-03-20', rating: null },
  { id: 'h4', title: 'Trading Bot Integration', reward: 4, status: 'completed', date: '2026-03-10', rating: 5 },
  { id: 'h5', title: 'Social Media Bot', reward: 3, status: 'disputed', date: '2026-02-28', rating: null },
  { id: 'h6', title: 'Wallet Tracker Extension', reward: 6, status: 'completed', date: '2026-02-15', rating: 4 },
]

// ─── 默认技能列表 ────────────────────────────────────────────────────────────
const DEFAULT_AVAILABLE_SKILLS = [
  'React', 'TypeScript', 'Rust', 'Python', 'Go',
  'Solidity', 'Web3', 'DeFi', 'IPFS', 'AI/ML',
  'Docker', 'AWS', 'Solana SDK', 'Node.js',
]

// ─── 主页面组件 ───────────────────────────────────────────────────────────────
export default function UserProfile() {
  const { publicKey } = useWallet()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'history' | 'skills' | 'settings'>('history')
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [skills, setSkills] = useState<string[]>([])
  const [editMode, setEditMode] = useState(false)
  const [bio, setBio] = useState('')
  const [_error, setError] = useState<string | null>(null)

  // 加载用户数据
  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true)
        setError(null)
        const data = await getCurrentUser()
        setUser(data)
        setSkills(data.skills.length > 0 ? data.skills : [])
        setBio(data.bio || '')
      } catch (err) {
        console.error('Failed to load user profile:', err)
        setError('Failed to load profile. Using demo data.')
        // Mock fallback
        setSkills(['React', 'TypeScript', 'Solana SDK', 'Rust', 'Node.js', 'Python', 'Web3', 'DeFi'])
        setBio('Full-stack developer specializing in Web3, DeFi protocols, and React applications.')
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-4)}`
    : user?.address
      ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
      : 'Not connected'

  const removeSkill = (s: string) => setSkills(prev => prev.filter(x => x !== s))
  const addSkill = async (skill: string) => {
    const newSkills = [...skills, skill]
    setSkills(newSkills)
    try {
      await updateProfile({ skills: newSkills })
      setUser(prev => prev ? { ...prev, skills: newSkills } : null)
    } catch (err) {
      console.error('Failed to update skills:', err)
    }
  }

  const saveBio = async () => {
    setEditMode(false)
    try {
      await updateProfile({ bio })
      setUser(prev => prev ? { ...prev, bio } : null)
    } catch (err) {
      console.error('Failed to update bio:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Profile Header ── */}
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center text-white font-bold text-3xl shrink-0 shadow-lg shadow-purple-500/20">
            {shortAddress.slice(0, 2).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-white">{shortAddress}</h1>
              {user && <RankBadge rank={user.rank} />}
            </div>
            <p className="text-gray-500 text-sm mb-3">
              Member since {user?.memberSince?.split('T')[0] || '—'} · {user?.tasksCompleted || 0} tasks completed
            </p>

            {/* Editable Bio */}
            {editMode ? (
              <div className="space-y-2">
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-900/70 border border-gray-700/50 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-[#9945FF]/50 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveBio}
                    className="px-3 py-1 bg-[#9945FF] text-white rounded-lg text-xs font-medium hover:opacity-90 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setBio(user?.bio || '') }}
                    className="px-3 py-1 bg-gray-700 text-gray-300 rounded-lg text-xs hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-gray-400 text-sm">{bio || 'No bio yet.'}</p>
                <button
                  onClick={() => setEditMode(true)}
                  className="text-xs text-gray-600 hover:text-[#9945FF] transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Reputation Score */}
          <div className="flex flex-col items-center">
            <ReputationScore score={user?.reputation || 0} />
            <p className="text-xs text-gray-500 mt-2">Reputation Score</p>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <UserStatsGrid
        tasksCompleted={user?.tasksCompleted || 0}
        reputation={user?.reputation || 0}
        totalEarned={user?.totalEarned || 0}
        tasksPosted={user?.tasksPosted || 0}
        successRate={user?.successRate || 0}
      />

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          📋 History
        </TabBtn>
        <TabBtn active={activeTab === 'skills'} onClick={() => setActiveTab('skills')}>
          🛠️ Skills
        </TabBtn>
        <TabBtn active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings
        </TabBtn>
      </div>

      {/* ── Tab Content ── */}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{mockHistory.length} tasks</p>
          </div>
          {mockHistory.map(item => (
            <HistoryRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold mb-0.5">My Skills</h3>
              <p className="text-gray-500 text-xs">{skills.length} skills added</p>
            </div>
            <button
              onClick={() => setShowSkillModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              + Add Skill
            </button>
          </div>

          <SkillTagList
            skills={skills}
            onRemove={removeSkill}
            emptyMessage="No skills added yet. Click Add Skill to get started."
          />
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-semibold mb-1">Account Settings</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-800/40">
              <div>
                <p className="text-sm text-white">Email Notifications</p>
                <p className="text-xs text-gray-500">Receive updates about new tasks and bids</p>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#9945FF]" />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-800/40">
              <div>
                <p className="text-sm text-white">Push Notifications</p>
                <p className="text-xs text-gray-500">Browser notifications for urgent updates</p>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#9945FF]" />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-800/40">
              <div>
                <p className="text-sm text-white">Auto-accept Bids</p>
                <p className="text-xs text-gray-500">Automatically accept bids above threshold</p>
              </div>
              <input type="checkbox" className="w-4 h-4 accent-[#9945FF]" />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-white">Solana Network</p>
                <p className="text-xs text-gray-500">Mainnet Beta</p>
              </div>
              <span className="text-sm text-emerald-400 font-medium">Connected</span>
            </div>
          </div>
        </div>
      )}

      {/* Skill Modal */}
      {showSkillModal && (
        <SkillSelectorModal
          availableSkills={DEFAULT_AVAILABLE_SKILLS}
          selectedSkills={skills}
          onAdd={addSkill}
          onClose={() => setShowSkillModal(false)}
        />
      )}
    </div>
  )
}
