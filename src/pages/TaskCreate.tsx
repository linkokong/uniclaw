// ============================================================
// Claw Universe — Task Create Page
// 任务发布页面：创建新任务
// ============================================================

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { createTask } from '../api/task'

// ─── Available Skills Pool ─────────────────────────────────────────────────
const ALL_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Go', 'Rust', 'Solidity',
  'Next.js', 'Vue.js', 'Angular', 'CSS', 'Tailwind', 'Web3', 'Solana SDK',
  'Ethereum', 'OpenAI API', 'GPT-4', 'LangChain', 'Pinecone', 'Twitter API',
  'Discord API', 'Telegram Bot', 'NFT', 'DeFi', 'Chart.js', 'D3.js',
  'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
  'GCP', 'CI/CD', 'GitHub Actions', 'Stripe', 'Socket.io', 'GraphQL',
  'REST API', 'Smart Contracts', 'ZK Proofs', 'IPFS', 'Arweave',
]

// ─── Categories ────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Development', 'AI Agent', 'Automation', 'Design', 'Data Science',
  'Smart Contracts', 'Security Audit', 'Content Writing', 'Testing',
  'DevOps', 'Other',
]

// ─── Form Shape ────────────────────────────────────────────────────────────
interface FormData {
  title: string
  description: string
  reward: string
  deadline: string
  category: string
  skills: string[]
  acceptanceCriteria: string
}

interface FormErrors {
  title?: string
  description?: string
  reward?: string
  deadline?: string
  category?: string
  skills?: string
  attachment?: string
}

// ─── Validation ─────────────────────────────────────────────────────────────
function validate(data: FormData, _hasAttachment: boolean): FormErrors {
  const errors: FormErrors = {}

  if (!data.title.trim()) {
    errors.title = 'Title is required'
  } else if (data.title.length > 100) {
    errors.title = 'Title must be 100 characters or less'
  }

  if (!data.description.trim()) {
    errors.description = 'Description is required'
  } else if (data.description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters'
  }

  const reward = parseFloat(data.reward)
  if (!data.reward) {
    errors.reward = 'Reward amount is required'
  } else if (isNaN(reward) || reward < 0.01) {
    errors.reward = 'Minimum reward is 0.01 SOL'
  }

  if (!data.deadline) {
    errors.deadline = 'Deadline is required'
  } else {
    const deadlineDate = new Date(data.deadline)
    if (deadlineDate <= new Date()) {
      errors.deadline = 'Deadline must be in the future'
    }
  }

  if (!data.category) {
    errors.category = 'Category is required'
  }

  if (data.skills.length === 0) {
    errors.skills = 'Select at least one skill'
  }

  return errors
}

// ─── Markdown Editor ─────────────────────────────────────────────────────────
function MarkdownEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertMarkdown = (prefix: string, suffix = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)
    const newValue =
      value.slice(0, start) + prefix + selected + suffix + value.slice(end)
    onChange(newValue)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    }, 0)
  }

  return (
    <div className="border border-gray-700/50 rounded-xl overflow-hidden bg-gray-900/40">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/40 bg-gray-900/20">
        <div className="flex items-center gap-1">
          {[
            { label: 'B', title: 'Bold', prefix: '**', suffix: '**' },
            { label: 'I', title: 'Italic', prefix: '_', suffix: '_' },
            { label: 'H2', title: 'Heading', prefix: '## ', suffix: '' },
            { label: '•', title: 'List', prefix: '- ', suffix: '' },
            { label: '「」', title: 'Quote', prefix: '> ', suffix: '' },
            { label: '</>', title: 'Code', prefix: '`', suffix: '`' },
            { label: '```', title: 'Code Block', prefix: '```\n', suffix: '\n```' },
          ].map(({ label, title, prefix, suffix }) => (
            <button
              key={label}
              type="button"
              title={title}
              onClick={() => insertMarkdown(prefix, suffix)}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-700/50 text-xs font-mono transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              tab === 'write' ? 'bg-[#9945FF]/20 text-[#9945FF]' : 'text-gray-400 hover:text-white'
            }`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              tab === 'preview' ? 'bg-[#9945FF]/20 text-[#9945FF]' : 'text-gray-400 hover:text-white'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe the task in detail. You can use Markdown for formatting: **bold**, _italic_, ## heading, - list, > quote, `code`"
          rows={10}
          className="w-full px-4 py-3 bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none leading-relaxed"
        />
      ) : (
        <div className="px-4 py-3 min-h-[240px] text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
          {value ? (
            <RenderMarkdown text={value} />
          ) : (
            <p className="text-gray-600 italic">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Minimal Markdown Renderer ─────────────────────────────────────────────
function RenderMarkdown({ text }: { text: string }) {
  // Very lightweight inline-only renderer for preview
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} className="text-white font-semibold text-base mt-3 mb-1">{line.slice(3)}</h2>
        if (line.startsWith('# ')) return <h1 key={i} className="text-white font-bold text-lg mt-3 mb-1">{line.slice(2)}</h1>
        if (line.startsWith('- ')) return <li key={i} className="ml-3 text-gray-300">{line.slice(2)}</li>
        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-gray-600 pl-3 italic text-gray-400 my-1">{line.slice(2)}</blockquote>
        if (line.startsWith('```')) return null
        // Bold + italic + code
        const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g)
        return (
          <p key={i} className="text-gray-300 my-0.5">
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="text-white">{part.slice(2, -2)}</strong>
              if (part.startsWith('_') && part.endsWith('_')) return <em key={j}>{part.slice(1, -1)}</em>
              if (part.startsWith('`') && part.endsWith('`')) return <code key={j} className="bg-gray-800 text-[#14F195] px-1 rounded text-xs">{part.slice(1, -1)}</code>
              return part
            })}
          </p>
        )
      })}
    </>
  )
}

// ─── Skill Selector ─────────────────────────────────────────────────────────
function SkillSelector({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)

  const filtered = ALL_SKILLS.filter(
    s => !selected.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  )

  const addSkill = (skill: string) => {
    if (selected.length < 10) onChange([...selected, skill])
  }

  const removeSkill = (skill: string) => {
    onChange(selected.filter(s => s !== skill))
  }

  return (
    <>
      {/* Selected Skills */}
      <div className="min-h-[44px] flex flex-wrap gap-2 p-3 bg-gray-900/40 border border-gray-700/50 rounded-xl">
        {selected.length === 0 ? (
          <span className="text-gray-600 text-sm">No skills selected</span>
        ) : (
          selected.map(skill => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#9945FF]/10 border border-[#9945FF]/25 rounded-lg text-sm text-[#9945FF]"
            >
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="text-[#9945FF]/50 hover:text-[#9945FF] text-base leading-none transition-colors ml-0.5"
              >
                ×
              </button>
            </span>
          ))
        )}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-3 py-1 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          >
            + Add more
          </button>
        )}
      </div>

      {/* Add Skill Button (when none selected) */}
      {selected.length === 0 && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mt-2 px-4 py-2 bg-[#9945FF]/10 border border-[#9945FF]/25 text-[#9945FF] rounded-xl text-sm hover:bg-[#9945FF]/20 transition-colors"
        >
          + Select Skills
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-[#111827] border border-gray-700/60 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">Add Skill</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-white text-2xl leading-none transition-colors"
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

            <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 w-full text-center">No skills found</p>
              ) : (
                filtered.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => { addSkill(skill); setQuery('') }}
                    className="px-3 py-1.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-300 hover:bg-[#9945FF]/20 hover:border-[#9945FF]/40 hover:text-[#9945FF] transition-all"
                  >
                    + {skill}
                  </button>
                ))
              )}
            </div>

            {selected.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700/40">
                <p className="text-xs text-gray-500 mb-2">Selected ({selected.length}/10):</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-[#9945FF]/10 border border-[#9945FF]/25 rounded text-xs text-[#9945FF]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── File Upload ─────────────────────────────────────────────────────────────
function FileUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (fs: FileList | null) => {
    if (!fs) return
    const arr = Array.from(fs).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'zip', 'md', 'txt', 'doc', 'docx']
      return ext ? allowed.includes(ext) : false
    })
    const total = files.length + arr.length
    if (total > 5) { alert('Maximum 5 files allowed'); return }
    const next = [...files, ...arr]
    setFiles(next)
    onFiles(next)
  }

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx)
    setFiles(next)
    onFiles(next)
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-[#9945FF] bg-[#9945FF]/5'
            : 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-900/20'
        }`}
      >
        <div className="text-3xl mb-2">📎</div>
        <p className="text-gray-300 text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-gray-600 text-xs mt-1">PDF, PNG, JPG, GIF, ZIP, MD, TXT, DOC — up to 5 files</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={e => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-gray-900/50 border border-gray-800/60 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-base">📄</span>
                <span className="text-sm text-gray-300 truncate">{f.name}</span>
                <span className="text-xs text-gray-600 shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-gray-500 hover:text-red-400 text-xl leading-none ml-2 shrink-0 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export function TaskCreatePage() {
  const navigate = useNavigate()
  const { connected } = useWallet()

  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    reward: '',
    deadline: '',
    category: '',
    skills: [],
    acceptanceCriteria: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Minimum deadline = tomorrow 00:00 local
  const minDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 16)
  })()

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errs = validate(form, files.length > 0)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // Scroll to first error
      const firstKey = Object.keys(errs)[0]
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (!connected) {
      setErrors({ title: 'Please connect your wallet to create a task' })
      return
    }

    setSubmitting(true)
    setServerError(null)

    try {
      const task = await createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        required_skills: form.skills,
        reward: form.reward,
        verification_period: 3,
      })

      // Navigate to the newly created task detail page
      navigate(`/task/${task.id}`)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create task. Please try again.')
      setSubmitting(false)
    }
  }

  // Group criteria into array for display
  const criteriaLines = form.acceptanceCriteria
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">

      {/* ── Header ── */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors group mb-4"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Back
        </button>
        <h1 className="text-2xl font-bold text-white">Create New Task</h1>
        <p className="text-gray-400 text-sm mt-1">Define your task, set a reward, and attract talented freelancers on Solana.</p>
      </div>

      {/* ── Wallet Warning ── */}
      {!connected && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <p className="text-yellow-400 text-sm font-medium">Wallet not connected</p>
            <p className="text-gray-500 text-xs">Connect your wallet to publish a task</p>
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Title */}
        <div id="field-title">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Task Title <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="e.g. Build a React dashboard for Solana DeFi tracking"
              maxLength={100}
              className={`w-full px-4 py-3 bg-gray-900/50 border rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-all ${
                errors.title ? 'border-red-500/60 focus:border-red-500' : 'border-gray-700/50 focus:border-[#9945FF]/50'
              }`}
            />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${form.title.length > 80 ? 'text-yellow-400' : 'text-gray-600'}`}>
              {form.title.length}/100
            </span>
          </div>
          {errors.title && <FieldError message={errors.title} />}
        </div>

        {/* Category */}
        <div id="field-category">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Category <span className="text-red-400">*</span>
          </label>
          <select
            value={form.category}
            onChange={e => setField('category', e.target.value)}
            className={`w-full px-4 py-3 bg-gray-900/50 border rounded-xl text-sm text-white focus:outline-none transition-all appearance-none cursor-pointer ${
              errors.category ? 'border-red-500/60' : 'border-gray-700/50 focus:border-[#9945FF]/50'
            } ${!form.category ? 'text-gray-600' : ''}`}
          >
            <option value="">Select a category…</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c} className="bg-[#111827]">{c}</option>
            ))}
          </select>
          {errors.category && <FieldError message={errors.category} />}
        </div>

        {/* Description + Markdown Editor */}
        <div id="field-description">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Task Description <span className="text-red-400">*</span>
          </label>
          <MarkdownEditor value={form.description} onChange={v => setField('description', v)} />
          {errors.description && <FieldError message={errors.description} />}
          <p className="text-xs text-gray-600 mt-1.5">{form.description.length} characters — be specific about requirements and deliverables</p>
        </div>

        {/* Reward + Deadline Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div id="field-reward">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reward (SOL) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={form.reward}
                onChange={e => setField('reward', e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className={`w-full px-4 py-3 bg-gray-900/50 border rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-all ${
                  errors.reward ? 'border-red-500/60' : 'border-gray-700/50 focus:border-[#9945FF]/50'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">SOL</span>
            </div>
            {errors.reward && <FieldError message={errors.reward} />}
            <p className="text-xs text-gray-600 mt-1.5">Minimum 0.01 SOL</p>
          </div>

          <div id="field-deadline">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Deadline <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.deadline}
              min={minDate}
              onChange={e => setField('deadline', e.target.value)}
              className={`w-full px-4 py-3 bg-gray-900/50 border rounded-xl text-sm text-white focus:outline-none transition-all ${
                errors.deadline ? 'border-red-500/60' : 'border-gray-700/50 focus:border-[#9945FF]/50'
              } ${!form.deadline ? 'text-gray-600' : ''}`}
            />
            {errors.deadline && <FieldError message={errors.deadline} />}
          </div>
        </div>

        {/* Skills */}
        <div id="field-skills">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Required Skills <span className="text-red-400">*</span>
          </label>
          <SkillSelector selected={form.skills} onChange={skills => setField('skills', skills)} />
          {errors.skills && <FieldError message={errors.skills} />}
          <p className="text-xs text-gray-600 mt-1.5">Select up to 10 skills needed for this task</p>
        </div>

        {/* Acceptance Criteria */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Acceptance Criteria
            <span className="text-gray-600 font-normal ml-2">(optional)</span>
          </label>
          <textarea
            value={form.acceptanceCriteria}
            onChange={e => setField('acceptanceCriteria', e.target.value)}
            placeholder="Define clear acceptance criteria, one per line:
- Example: Dashboard must load in under 2 seconds
- Must support dark and light themes
- All API errors must show user-friendly messages"
            rows={4}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-[#9945FF]/50 transition-all"
          />
          {criteriaLines.length > 0 && (
            <div className="mt-2 space-y-1">
              {criteriaLines.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-gray-600 text-xs mt-0.5">{i + 1}.</span>
                  <span className="text-xs text-gray-400">{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* File Upload */}
        <div id="field-attachment">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Attachments
            <span className="text-gray-600 font-normal ml-2">(optional)</span>
          </label>
          <FileUpload onFiles={setFiles} />
          {errors.attachment && <FieldError message={errors.attachment} />}
        </div>

        {/* Server Error */}
        {serverError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            <p className="text-red-400 text-sm">{serverError}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              !submitting
                ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 active:scale-98'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Publishing…' : 'Publish Task'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white border border-gray-700/50 hover:border-gray-600 transition-all"
          >
            Cancel
          </button>
          {!connected && (
            <p className="text-xs text-gray-600 text-center sm:text-left">
              Connect wallet to publish
            </p>
          )}
        </div>
      </form>

      {/* ── Tips ── */}
      <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 space-y-3">
        <h3 className="text-white font-semibold text-sm">💡 Tips for a great task</h3>
        <ul className="space-y-2">
          {[
            'Be specific — vague descriptions get fewer quality bids',
            'Set a realistic reward aligned with task complexity',
            'Include measurable acceptance criteria',
            'Select all relevant skills to reach the right freelancers',
            'Attach reference materials if available',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
              <span className="text-gray-600 mt-0.5">•</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Field Error ────────────────────────────────────────────────────────────
function FieldError({ message }: { message: string }) {
  return (
    <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
      <span>⚠</span> {message}
    </p>
  )
}
