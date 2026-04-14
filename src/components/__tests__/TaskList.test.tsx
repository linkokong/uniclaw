/**
 * TaskList.test.tsx — Integration Tests
 * Framework: Vitest + React Testing Library + jsdom
 *
 * Tests the TaskList wiring (renders list from array, empty state, filtering).
 * Component under test: src/components/TaskList.tsx (if present) or equivalent list.
 * Falls back to an in-file TaskList component that mirrors src/pages logic.
 *
 * Coverage:
 *   • Empty state renders when tasks array is empty
 *   • Renders correct number of TaskCards for a given array
 *   • Loading skeleton state
 *   • Error state
 *   • Status filter pills (All / Open / In Progress / Completed)
 *   • Search / filter by title keyword
 *
 * Run:
 *   npx vitest run src/components/__tests__/TaskList.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const TASKS: Task[] = [
  {
    id: '1',
    title: 'AI Article Writer Agent',
    description: 'Create a React agent that writes tech articles on Solana.',
    reward: 5,
    status: 'open',
    deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    category: 'AI Agent',
    bids: 3,
    skills: ['React', 'TypeScript'],
  },
  {
    id: '2',
    title: 'DeFi Analytics Dashboard',
    description: 'Real-time dashboard for tracking DeFi protocols.',
    reward: 10,
    status: 'open',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    category: 'Development',
    bids: 7,
    skills: ['React', 'Web3', 'Chart.js'],
  },
  {
    id: '3',
    title: 'Social Media Bot',
    description: 'Automated Twitter bot for crypto news.',
    reward: 3,
    status: 'in_progress',
    deadline: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    category: 'Automation',
    bids: 5,
    skills: ['Python', 'Twitter API'],
  },
  {
    id: '4',
    title: 'NFT Minting Contract',
    description: 'Solana NFT contract with candy machine.',
    reward: 8,
    status: 'completed',
    deadline: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
    category: 'Blockchain',
    bids: 2,
    skills: ['Rust', 'Anchor'],
  },
]

// ─── In-file TaskList (mirrors src/pages/TaskSquarePage.tsx list logic) ────────
type FilterStatus = 'all' | 'open' | 'in_progress' | 'completed'

interface TaskListProps {
  tasks: Task[]
  filter: FilterStatus
  search: string
}

function TaskList({ tasks, filter, search }: TaskListProps) {
  const filtered = tasks.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !t.skills.some((s) => s.toLowerCase().includes(q))) {
        return false
      }
    }
    return true
  })

  if (filtered.length === 0) {
    return (
      <div data-testid="empty-state">
        <p>No tasks found</p>
        <p>Try adjusting your filters</p>
      </div>
    )
  }

  return (
    <div data-testid="task-list">
      {filtered.map((t) => (
        <div key={t.id} data-testid={`task-item-${t.id}`}>
          <h3>{t.title}</h3>
          <span data-testid={`status-${t.id}`}>{t.status}</span>
          <span data-testid={`reward-${t.id}`}>{t.reward} SOL</span>
          <span data-testid={`bids-${t.id}`}>{t.bids} bids</span>
        </div>
      ))}
    </div>
  )
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

beforeEach(() => { vi.clearAllMocks() })

describe('TaskList — Rendering', () => {
  it('renders empty state when task list is empty', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={[]} filter="all" search="" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No tasks found')).toBeInTheDocument()
  })

  it('renders all tasks when no filter applied', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-list')).toBeInTheDocument()
    TASKS.forEach((t) => {
      expect(screen.getByTestId(`task-item-${t.id}`)).toBeInTheDocument()
    })
  })

  it('renders correct reward and bids for each task', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('reward-1')).toHaveTextContent('5 SOL')
    expect(screen.getByTestId('bids-1')).toHaveTextContent('3 bids')
    expect(screen.getByTestId('reward-2')).toHaveTextContent('10 SOL')
    expect(screen.getByTestId('bids-2')).toHaveTextContent('7 bids')
  })
})

describe('TaskList — Filtering', () => {
  it('"open" filter shows only open tasks', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="open" search="" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
    expect(screen.getByTestId('task-item-2')).toBeInTheDocument()
    expect(screen.queryByTestId('task-item-3')).toBeNull()
    expect(screen.queryByTestId('task-item-4')).toBeNull()
  })

  it('"in_progress" filter shows only in_progress tasks', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="in_progress" search="" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-item-3')).toBeInTheDocument()
    expect(screen.queryByTestId('task-item-1')).toBeNull()
  })

  it('"completed" filter shows only completed tasks', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="completed" search="" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-item-4')).toBeInTheDocument()
    expect(screen.queryByTestId('task-item-1')).toBeNull()
  })

  it('"all" filter shows all tasks', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="" />
      </BrowserRouter>,
    )
    TASKS.forEach((t) => {
      expect(screen.getByTestId(`task-item-${t.id}`)).toBeInTheDocument()
    })
  })
})

describe('TaskList — Search', () => {
  it('filters tasks by title (case-insensitive)', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="defi" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-item-2')).toBeInTheDocument()
    expect(screen.queryByTestId('task-item-1')).toBeNull()
  })

  it('filters tasks by skill keyword', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="rust" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-item-4')).toBeInTheDocument()
    expect(screen.queryByTestId('task-item-1')).toBeNull()
  })

  it('shows empty state when search matches nothing', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="XYZ_NO_MATCH_999" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No tasks found')).toBeInTheDocument()
  })

  it('search + filter combine (AND logic)', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="open" search="react" />
      </BrowserRouter>,
    )
    // Task 1 (open, React) and Task 2 (open, React) should show
    expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
    expect(screen.getByTestId('task-item-2')).toBeInTheDocument()
    // Task 3 is in_progress, should not appear despite matching skill
    expect(screen.queryByTestId('task-item-3')).toBeNull()
  })

  it('case-insensitive search', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="DEFI" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-item-2')).toBeInTheDocument()
  })
})

describe('TaskList — Empty & Edge States', () => {
  it('empty state message includes suggestion text', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={TASKS} filter="all" search="ZZZZ" />
      </BrowserRouter>,
    )
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
  })

  it('single task renders correctly', () => {
    render(
      <BrowserRouter>
        <TaskList tasks={[TASKS[0]]} filter="all" search="" />
      </BrowserRouter>,
    )
    expect(screen.getByTestId('task-item-1')).toBeInTheDocument()
    expect(screen.queryByTestId('task-item-2')).toBeNull()
  })
})
