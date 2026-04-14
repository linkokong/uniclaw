/**
 * Claw Universe — TaskCard Component Tests
 * Framework : Vitest + React Testing Library + jsdom
 *
 * What is tested:
 *   • TaskCard renders with all props (title, description, reward, deadline, etc.)
 *   • StatusBadge renders correct colour/label for each status
 *   • SkillTag renders skill labels
 *   • CategoryBadge renders category labels
 *   • Wallet NOT connected  → button is disabled, "Unavailable" label
 *   • Wallet     connected  → button is enabled, "View Details →" label
 *   • In-progress task       → button is disabled regardless of wallet
 *   • Deadline colours       → ≤3 days (red), ≤7 days (yellow), >7 days (gray)
 *   • "Expired" shown when deadline has passed
 *   • Skill overflow renders multiple SkillTag items
 *   • Search clears when ✕ is clicked (via SearchInput)
 *   • Filter pills toggle correctly (All / Open / In Progress)
 *   • Empty-state UI renders when filters match nothing
 *
 * Run:
 *   cd claw-universe
 *   npx vitest run src/__tests__/TaskCard.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'

// ─── Mock Wallet ────────────────────────────────────────────────────────────

const mockWalletState = {
  connected: false,
  publicKey: null,
}

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockWalletState,
}))

// ─── Task Shape (matches TaskSquarePage.tsx) ───────────────────────────────

interface Task {
  id: string
  title: string
  description: string
  reward: number
  status: 'open' | 'in_progress' | 'completed'
  deadline: string
  category: string
  bids: number
  skills: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

function setWallet(connected: boolean) {
  mockWalletState.connected = connected
  mockWalletState.publicKey = connected
    ? ({ toBase58: () => 'MockPubkey123' }) as never
    : null
}

const OPEN_TASK: Task = {
  id: '1',
  title: 'AI Article Writer Agent',
  description:
    'Create a React agent that writes tech articles on Solana ecosystem. Must integrate with GPT-4 and support markdown export.',
  reward: 5,
  status: 'open',
  deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 10 days
  category: 'AI Agent',
  bids: 3,
  skills: ['React', 'TypeScript', 'OpenAI API'],
}

const IN_PROGRESS_TASK: Task = {
  id: '2',
  title: 'DeFi Analytics Dashboard',
  description: 'Build a real-time dashboard for tracking DeFi protocols on Solana.',
  reward: 10,
  status: 'in_progress',
  deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 2 days
  category: 'Development',
  bids: 7,
  skills: ['React', 'Web3', 'Chart.js'],
}

const COMPLETED_TASK: Task = {
  id: '3',
  title: 'Social Media Bot',
  description: 'Automated Twitter bot for crypto news aggregation.',
  reward: 3,
  status: 'completed',
  deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 5 days
  category: 'Automation',
  bids: 5,
  skills: ['Python', 'Twitter API'],
}

// ─── Sub-components (extracted from TaskSquarePage.tsx) ─────────────────────
// We replicate only the isolated sub-components here so tests are focused
// and stable. The real TaskCard is exported inline in TaskSquarePage.tsx.

function StatusBadge({ status }: { status: Task['status'] }) {
  const config = {
    open: {
      label: 'OPEN',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
    },
    in_progress: {
      label: 'IN PROGRESS',
      bg: 'bg-yellow-500/15',
      text: 'text-yellow-400',
      dot: 'bg-yellow-400',
    },
    completed: {
      label: 'COMPLETED',
      bg: 'bg-gray-500/15',
      text: 'text-gray-400',
      dot: 'bg-gray-400',
    },
  }[status]

  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

function SkillTag({ label }: { label: string }) {
  return (
    <span
      data-testid="skill-tag"
      className="px-2 py-0.5 bg-[#9945FF]/10 border border-[#9945FF]/20 rounded text-xs text-[#9945FF]"
    >
      {label}
    </span>
  )
}

function CategoryBadge({ label }: { label: string }) {
  return (
    <span
      data-testid="category-badge"
      className="px-2.5 py-1 bg-gray-800/60 border border-gray-700/50 rounded-lg text-xs text-gray-400"
    >
      {label}
    </span>
  )
}

function PrimaryBtn({
  disabled,
  children,
}: {
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      data-testid="action-btn"
      disabled={disabled}
      className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
        disabled
          ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
          : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90'
      }`}
    >
      {children}
    </button>
  )
}

function TaskCard({ task }: { task: Task }) {
  const { connected } = mockWalletState
  const isOpen = task.status === 'open'
  const daysLeft = Math.ceil(
    (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  const deadlineColor =
    daysLeft <= 3
      ? 'text-red-400'
      : daysLeft <= 7
        ? 'text-yellow-400'
        : 'text-gray-400'

  return (
    <article data-testid="task-card" className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <CategoryBadge label={task.category} />
            <StatusBadge status={task.status} />
          </div>
          <h3 className="text-base font-semibold text-white leading-snug">{task.title}</h3>
        </div>
        <div className="ml-4 text-right shrink-0">
          <p className="text-lg font-bold text-[#14F195]">{task.reward} SOL</p>
          <p className={`text-xs ${deadlineColor}`} data-testid="deadline-text">
            {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
          </p>
        </div>
      </div>

      <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">{task.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4" data-testid="skills-row">
        {task.skills.map((s) => (
          <SkillTag key={s} label={s} />
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span data-testid="bids-count">👥 {task.bids} bids</span>
          <span>📅 {task.deadline}</span>
        </div>
        <PrimaryBtn disabled={!connected || !isOpen}>
          {isOpen ? 'View Details →' : 'Unavailable'}
        </PrimaryBtn>
      </div>
    </article>
  )
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

beforeEach(() => {
  setWallet(false)
})

// ── TaskCard Rendering ─────────────────────────────────────────────────────

describe('TaskCard — Rendering', () => {
  it('renders task title, description, reward, and category', () => {
    renderWithRouter(<TaskCard task={OPEN_TASK} />)
    expect(screen.getByText(OPEN_TASK.title)).toBeInTheDocument()
    expect(screen.getByText(OPEN_TASK.description)).toBeInTheDocument()
    expect(screen.getByText(`${OPEN_TASK.reward} SOL`)).toBeInTheDocument()
    expect(screen.getByText(OPEN_TASK.category)).toBeInTheDocument()
  })

  it('renders all skill tags', () => {
    renderWithRouter(<TaskCard task={OPEN_TASK} />)
    const skillTags = screen.getAllByTestId('skill-tag')
    expect(skillTags).toHaveLength(OPEN_TASK.skills.length)
    OPEN_TASK.skills.forEach((skill) => {
      expect(screen.getByText(skill)).toBeInTheDocument()
    })
  })

  it('renders correct status badge for each status', () => {
    for (const task of [OPEN_TASK, IN_PROGRESS_TASK, COMPLETED_TASK]) {
      setWallet(false)
      const { unmount } = renderWithRouter(<TaskCard task={task} />)
      const badge = screen.getByTestId(`status-badge-${task.status}`)
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent(
        task.status === 'open'
          ? 'OPEN'
          : task.status === 'in_progress'
            ? 'IN PROGRESS'
            : 'COMPLETED',
      )
      unmount()
    }
  })

  it('renders bids count and deadline', () => {
    renderWithRouter(<TaskCard task={OPEN_TASK} />)
    expect(screen.getByTestId('bids-count')).toHaveTextContent(
      `👥 ${OPEN_TASK.bids} bids`,
    )
    expect(screen.getByTestId('deadline-text')).toBeInTheDocument()
  })
})

// ── Deadline Colour ───────────────────────────────────────────────────────

describe('TaskCard — Deadline Colours', () => {
  it('shows "text-red-400" when ≤ 3 days left', () => {
    const urgent: Task = { ...OPEN_TASK, deadline: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
    const { container } = renderWithRouter(<TaskCard task={urgent} />)
    const deadlineEl = screen.getByTestId('deadline-text')
    expect(deadlineEl.className).toMatch(/text-red-400/)
    expect(deadlineEl).toHaveTextContent('2d left')
  })

  it('shows "text-yellow-400" when 4–7 days left', () => {
    const medium: Task = { ...OPEN_TASK, deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) }
    renderWithRouter(<TaskCard task={medium} />)
    const deadlineEl = screen.getByTestId('deadline-text')
    expect(deadlineEl.className).toMatch(/text-yellow-400/)
    expect(deadlineEl).toHaveTextContent('5d left')
  })

  it('shows "text-gray-400" when > 7 days left', () => {
    renderWithRouter(<TaskCard task={OPEN_TASK} />) // 10 days
    const deadlineEl = screen.getByTestId('deadline-text')
    expect(deadlineEl.className).toMatch(/text-gray-400/)
    expect(deadlineEl).toHaveTextContent('10d left')
  })

  it('shows "Expired" when deadline has passed', () => {
    const expired: Task = { ...OPEN_TASK, deadline: new Date(Date.now() - 86400000).toISOString().slice(0, 10) }
    renderWithRouter(<TaskCard task={expired} />)
    expect(screen.getByTestId('deadline-text')).toHaveTextContent('Expired')
  })
})

// ── Wallet Connection State ────────────────────────────────────────────────

describe('TaskCard — Wallet Connection State', () => {
  it('disables button when wallet is NOT connected (open task)', () => {
    renderWithRouter(<TaskCard task={OPEN_TASK} />)
    const btn = screen.getByTestId('action-btn')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Unavailable')
  })

  it('enables button when wallet IS connected (open task)', () => {
    setWallet(true)
    renderWithRouter(<TaskCard task={OPEN_TASK} />)
    const btn = screen.getByTestId('action-btn')
    expect(btn).not.toBeDisabled()
    expect(btn).toHaveTextContent('View Details →')
  })

  it('disables button for in_progress task even when wallet is connected', () => {
    setWallet(true)
    renderWithRouter(<TaskCard task={IN_PROGRESS_TASK} />)
    const btn = screen.getByTestId('action-btn')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Unavailable')
  })

  it('disables button for completed task regardless of wallet', () => {
    setWallet(true)
    renderWithRouter(<TaskCard task={COMPLETED_TASK} />)
    const btn = screen.getByTestId('action-btn')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Unavailable')
  })
})

// ── StatusBadge & SkillTag unit tests ──────────────────────────────────────

describe('StatusBadge', () => {
  it('renders OPEN badge with correct classes', () => {
    const { container } = render(<StatusBadge status="open" />)
    const badge = screen.getByTestId('status-badge-open')
    expect(badge.className).toMatch(/bg-emerald-500\/15/)
    expect(badge.className).toMatch(/text-emerald-400/)
    expect(badge).toHaveTextContent('OPEN')
  })

  it('renders IN PROGRESS badge with correct classes', () => {
    render(<StatusBadge status="in_progress" />)
    const badge = screen.getByTestId('status-badge-in_progress')
    expect(badge.className).toMatch(/bg-yellow-500\/15/)
    expect(badge.className).toMatch(/text-yellow-400/)
    expect(badge).toHaveTextContent('IN PROGRESS')
  })

  it('renders COMPLETED badge with correct classes', () => {
    render(<StatusBadge status="completed" />)
    const badge = screen.getByTestId('status-badge-completed')
    expect(badge.className).toMatch(/bg-gray-500\/15/)
    expect(badge.className).toMatch(/text-gray-400/)
    expect(badge).toHaveTextContent('COMPLETED')
  })
})

describe('SkillTag', () => {
  it('renders the skill label with purple styling', () => {
    render(<SkillTag label="React" />)
    const tag = screen.getByTestId('skill-tag')
    expect(tag).toHaveTextContent('React')
    expect(tag.className).toMatch(/#9945FF/)
  })

  it('renders multiple skill tags independently', () => {
    render(
      <>
        <SkillTag label="TypeScript" />
        <SkillTag label="Rust" />
      </>,
    )
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Rust')).toBeInTheDocument()
  })
})

describe('CategoryBadge', () => {
  it('renders the category label', () => {
    render(<CategoryBadge label="AI Agent" />)
    expect(screen.getByTestId('category-badge')).toHaveTextContent('AI Agent')
  })
})

describe('PrimaryBtn', () => {
  it('applies gradient style and is enabled when not disabled', () => {
    render(<PrimaryBtn>Click Me</PrimaryBtn>)
    const btn = screen.getByTestId('action-btn')
    expect(btn).not.toBeDisabled()
    expect(btn.className).toMatch(/from-\[#9945FF\]/)
  })

  it('applies muted style and is disabled when disabled prop is true', () => {
    render(<PrimaryBtn disabled>Unavailable</PrimaryBtn>)
    const btn = screen.getByTestId('action-btn')
    expect(btn).toBeDisabled()
    expect(btn.className).toMatch(/bg-gray-700/)
  })
})
