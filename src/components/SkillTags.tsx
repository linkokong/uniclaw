// ============================================================
// SkillTags - 技能标签组件
// 支持：普通标签、可移除标签、添加技能弹窗
// ============================================================

import { useState } from 'react'

// ─── 技能标签 ────────────────────────────────────────────────────────────────
interface SkillTagProps {
  label: string
  removable?: boolean
  onRemove?: () => void
}

export function SkillTag({ label, removable, onRemove }: SkillTagProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#9945FF]/10 border border-[#9945FF]/25 rounded-lg text-sm text-[#9945FF] hover:bg-[#9945FF]/20 hover:border-[#9945FF]/40 transition-colors">
      {label}
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 text-[#9945FF]/50 hover:text-[#9945FF] text-base leading-none transition-colors"
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  )
}

// ─── 技能标签组 ─────────────────────────────────────────────────────────────
interface SkillTagListProps {
  skills: string[]
  onRemove?: (skill: string) => void
  emptyMessage?: string
}

export function SkillTagList({ skills, onRemove, emptyMessage = 'No skills added yet.' }: SkillTagListProps) {
  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map(skill => (
        <SkillTag
          key={skill}
          label={skill}
          removable={!!onRemove}
          onRemove={onRemove ? () => onRemove(skill) : undefined}
        />
      ))}
    </div>
  )
}

// ─── 技能选择弹窗 ─────────────────────────────────────────────────────────────
interface SkillSelectorModalProps {
  availableSkills: string[]
  selectedSkills: string[]
  onAdd: (skill: string) => void
  onClose: () => void
}

export function SkillSelectorModal({ availableSkills, selectedSkills, onAdd, onClose }: SkillSelectorModalProps) {
  const [query, setQuery] = useState('')

  const filtered = availableSkills.filter(
    s => !selectedSkills.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#111827] border border-gray-700/60 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Add Skill</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-2xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search skills..."
          className="w-full px-4 py-2.5 bg-gray-900/70 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-600 mb-4 focus:outline-none focus:border-[#9945FF]/50 transition-all"
        />

        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">No skills found</p>
          ) : (
            filtered.map(skill => (
              <button
                key={skill}
                onClick={() => { onAdd(skill); onClose() }}
                className="px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-300 hover:bg-[#9945FF]/20 hover:border-[#9945FF]/40 hover:text-[#9945FF] transition-all"
              >
                + {skill}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 技能管理面板 ────────────────────────────────────────────────────────────
interface SkillManagerProps {
  skills: string[]
  availableSkills: string[]
  onAdd: (skill: string) => void
  onRemove: (skill: string) => void
}

export function SkillManager({ skills, availableSkills, onAdd, onRemove }: SkillManagerProps) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold mb-0.5">My Skills</h3>
            <p className="text-gray-500 text-xs">{skills.length} skills added</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Add Skill
          </button>
        </div>

        <SkillTagList skills={skills} onRemove={onRemove} />
      </div>

      {showModal && (
        <SkillSelectorModal
          availableSkills={availableSkills}
          selectedSkills={skills}
          onAdd={skill => { onAdd(skill); setShowModal(false) }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

export default SkillTag
