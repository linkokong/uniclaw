/**
 * TaskCard.test.tsx — Unit Tests
 * Framework: Vitest + React Testing Library + happy-dom
 *
 * Coverage:
 *   • TaskCard renders all task fields correctly
 *   • StatusBadge renders correct label/colour for open / in_progress / completed
 *   • SkillTag and CategoryBadge render correctly
 *   • Button enabled state driven by wallet-connected + is-open
 *   • Deadline colour: ≤3d red, 4-7d yellow, >7d gray / Expired
 *   • Skill overflow (+N badge) when >5 skills
 *   • Link wrapping article element
 *
 * Run:
 *   npx vitest run src/components/__tests__/TaskCard.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'

// ─── Wallet Mock ─────────────────────────────────────────────────────────────
const mockPublicKey = { toBase58: () => '7xKXtg2CW87d97TXJSDpbD5jBkheTlxA7ZmEU4LNMhAF' }

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => ({
    connected: false,
    publicKey: null,
    connecting: false,
    disconnecting: false,
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
    signMessage: vi.fn(),
  })),
}))

import { useWallet } from '@solana/wallet-adapter-react'

// ─── Task Shape ──────────────────────────────────────────────────────────────
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

// ─── Task Fixtures ───────────────────────────────────────────────────────────
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '1',
    title: 'AI Article Writer Agent',
    description: 'Create a React agent that writes tech articles on Solana.',
    reward: 5,
    status: 'open',
    deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    category: 'AI Agent',
    bids: 3,
    skills: ['React', 'TypeScript', 'OpenAI API'],
    ...overrides,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function importTaskCard() {
  const mod = await import('@/components/TaskCard')
  return mod.TaskCard
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  ;(useWallet as ReturnType<typeof useWallet>).mockReturnValue({
    connected: false,
    publicKey: null,
    connecting: false,
    disconnecting: false,
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
    signMessage: vi.fn(),
  })
})

// ── StatusBadge ───────────────────────────────────────────────────────────────

describe('StatusBadge', () => {
  it('renders OPEN with emerald styles', () => {
    const { StatusBadge } = require('@/components/TaskCard')
    render(<StatusBadge status="open" />)
    const badge = screen.getByText('OPEN')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/bg-emerald-500\/15/)
    expect(badge.className).toMatch(/text-emerald-400/)
  })

  it('renders IN PROGRESS with yellow styles', () => {
    const { StatusBadge } = require('@/components/TaskCard')
    render(<StatusBadge status="in_progress" />)
    const badge = screen.getByText('IN PROGRESS')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/bg-yellow-500\/15/)
    expect(badge.className).toMatch(/text-yellow-400/)
  })

  it('renders COMPLETED with gray styles', () => {
    const { StatusBadge } = require('@/components/TaskCard')
    render(<StatusBadge status="completed" />)
    const badge = screen.getByText('COMPLETED')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/bg-gray-500\/15/)
    expect(badge.className).toMatch(/text-gray-400/)
  })
})

// ── SkillTag ─────────────────────────────────────────────────────────────────

describe('SkillTag', () => {
  it('renders the skill label with purple styling', () => {
    const { SkillTag } = require('@/components/TaskCard')
    render(<SkillTag label="React" />)
    const tag = screen.getByText('React')
    expect(tag).toBeInTheDocument()
    expect(tag.className).toMatch(/#9945FF/)
  })

  it('renders multiple skill tags independently', () => {
    const { SkillTag } = require('@/components/TaskCard')
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

// ── CategoryBadge ─────────────────────────────────────────────────────────────

describe('CategoryBadge', () => {
  it('renders the category label', () => {
    const { CategoryBadge } = require('@/components/TaskCard')
    render(<CategoryBadge label="AI Agent" />)
    expect(screen.getByText('AI Agent')).toBeInTheDocument()
  })
})

// ── TaskCard Rendering ───────────────────────────────────────────────────────

describe('TaskCard — Rendering', () => {
  it('renders title, description, reward, and category', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask()
    renderWithRouter(<TaskCard task={task} />)

    expect(screen.getByText(task.title)).toBeInTheDocument()
    expect(screen.getByText(task.description)).toBeInTheDocument()
    expect(screen.getByText(`${task.reward} SOL`)).toBeInTheDocument()
    expect(screen.getByText(task.category)).toBeInTheDocument()
  })

  it('renders all skill tags', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ skills: ['React', 'TypeScript', 'Rust'] })
    renderWithRouter(<TaskCard task={task} />)

    task.skills.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument()
    })
  })

  it('shows "+N" overflow badge when skills > 5', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ skills: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] })
    renderWithRouter(<TaskCard task={task} />)

    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('renders bids count and deadline', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ bids: 7 })
    renderWithRouter(<TaskCard task={task} />)

    expect(screen.getByText(/7 bids?/)).toBeInTheDocument()
  })

  it('wraps article in a Link element', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask()
    renderWithRouter(<TaskCard task={task} />)

    const article = screen.getByRole('article')
    expect(article.closest('a')).not.toBeNull()
    expect(article.closest('a')).toHaveAttribute('href', `/tasks/${task.id}`)
  })
})

// ── Deadline Colours ──────────────────────────────────────────────────────────

describe('TaskCard — Deadline Colours', () => {
  it('shows text-red-400 when ≤ 3 days left', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ deadline: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) })
    renderWithRouter(<TaskCard task={task} />)
    const deadline = screen.getByText('2d left')
    expect(deadline.className).toMatch(/text-red-400/)
  })

  it('shows text-yellow-400 when 4–7 days left', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) })
    renderWithRouter(<TaskCard task={task} />)
    const deadline = screen.getByText('5d left')
    expect(deadline.className).toMatch(/text-yellow-400/)
  })

  it('shows text-gray-400 when > 7 days left', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) })
    renderWithRouter(<TaskCard task={task} />)
    const deadline = screen.getByText('10d left')
    expect(deadline.className).toMatch(/text-gray-400/)
  })

  it('shows "Due today" when deadline is today', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ deadline: new Date().toISOString().slice(0, 10) })
    renderWithRouter(<TaskCard task={task} />)
    expect(screen.getByText('Due today')).toBeInTheDocument()
  })

  it('shows "Expired" when deadline has passed', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    const task = makeTask({ deadline: new Date(Date.now() - 86400000).toISOString().slice(0, 10) })
    renderWithRouter(<TaskCard task={task} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })
})

// ── Wallet / CTA Button ──────────────────────────────────────────────────────

describe('TaskCard — Wallet & CTA Button', () => {
  it('shows "Unavailable" and is disabled when wallet NOT connected (open task)', async () => {
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    // Wallet already mocked to connected=false in beforeEach
    renderWithRouter(<TaskCard task={makeTask({ status: 'open' })} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Unavailable')
  })

  it('shows "View Details →" and is enabled when wallet IS connected (open task)', async () => {
    ;(useWallet as ReturnType<typeof useWallet>).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      connecting: false,
      disconnecting: false,
      signTransaction: vi.fn(),
      signAllTransactions: vi.fn(),
      signMessage: vi.fn(),
    })
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    renderWithRouter(<TaskCard task={makeTask({ status: 'open' })} />)
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
    expect(btn).toHaveTextContent('View Details →')
  })

  it('shows "Unavailable" for in_progress task even when wallet is connected', async () => {
    ;(useWallet as ReturnType<typeof useWallet>).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      connecting: false,
      disconnecting: false,
      signTransaction: vi.fn(),
      signAllTransactions: vi.fn(),
      signMessage: vi.fn(),
    })
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    renderWithRouter(<TaskCard task={makeTask({ status: 'in_progress' })} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Unavailable')
  })

  it('shows "Unavailable" for completed task regardless of wallet', async () => {
    ;(useWallet as ReturnType<typeof useWallet>).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      connecting: false,
      disconnecting: false,
      signTransaction: vi.fn(),
      signAllTransactions: vi.fn(),
      signMessage: vi.fn(),
    })
    const TaskCard = (await import('@/components/TaskCard')).TaskCard
    renderWithRouter(<TaskCard task={makeTask({ status: 'completed' })} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Unavailable')
  })
})
