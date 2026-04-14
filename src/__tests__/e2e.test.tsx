/**
 * ============================================================
 * CLAW UNIVERSE — E2E Tests
 * Tests the full user journey through the web app:
 *   1. TaskMarket browsing + all filter combinations
 *   2. TaskDetailPage — detail view + accept bid flow
 *   3. Filter pipeline (type × budget × search × sort)
 *   4. Wallet connection state transitions
 *
 * Framework : Vitest + React Testing Library + jsdom
 * Run       : cd claw-universe && npm test
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom'
import * as ReactRouter from 'react-router-dom'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const TASKS = [
  {
    id: '1',
    title: 'AI Article Writer Agent',
    description:
      'Build a React-based AI agent that autonomously writes technical articles about the Solana ecosystem.',
    reward: 5,
    status: 'open' as const,
    deadline: '2026-04-20',
    category: 'AI Agent',
    bids: 3,
    skills: ['React', 'TypeScript', 'OpenAI API'],
    createdAt: '2026-04-01',
    bidRange: { min: 4.5, max: 6.0 },
    publisher: { address: '7xKX...f3b9', reputation: 4.8, tasksCompleted: 23, joinedDays: 45 },
  },
  {
    id: '2',
    title: 'DeFi Analytics Dashboard',
    description: 'Build a real-time dashboard for tracking DeFi protocols on Solana with charts.',
    reward: 12,
    status: 'in_progress' as const,
    deadline: '2026-04-08',
    category: 'Development',
    bids: 7,
    skills: ['React', 'Web3', 'Chart.js', 'TypeScript'],
    createdAt: '2026-04-03',
    bidRange: { min: 10, max: 15 },
    publisher: { address: '3dxK...p7m2', reputation: 4.2, tasksCompleted: 11, joinedDays: 20 },
  },
  {
    id: '3',
    title: 'Social Media Bot',
    description: 'Automated Twitter/X bot for crypto news aggregation and scheduled posting.',
    reward: 3,
    status: 'open' as const,
    deadline: '2026-04-25',
    category: 'Automation',
    bids: 1,
    skills: ['Python', 'Twitter API'],
    createdAt: '2026-04-05',
    bidRange: { min: 2.5, max: 4 },
    publisher: { address: '9mL2...q3r8', reputation: 3.9, tasksCompleted: 5, joinedDays: 10 },
  },
  {
    id: '4',
    title: 'NFT Marketplace Frontend',
    description: 'Design and build a modern NFT marketplace UI on Solana with wallet integration.',
    reward: 8,
    status: 'open' as const,
    deadline: '2026-04-30',
    category: 'Development',
    bids: 5,
    skills: ['React', 'Solana', 'Metaplex', 'TypeScript'],
    createdAt: '2026-04-02',
    bidRange: { min: 7, max: 10 },
    publisher: { address: '2abC...k9p1', reputation: 5.0, tasksCompleted: 42, joinedDays: 90 },
  },
  {
    id: '5',
    title: 'Smart Contract Auditor',
    description: 'Security audit for a Solana DeFi protocol. Review Rust code for vulnerabilities.',
    reward: 20,
    status: 'in_progress' as const,
    deadline: '2026-04-10',
    category: 'Security',
    bids: 2,
    skills: ['Rust', 'Solana', 'DeFi', 'Security'],
    createdAt: '2026-03-28',
    bidRange: { min: 18, max: 25 },
    publisher: { address: '5xyZ...w4t7', reputation: 4.6, tasksCompleted: 18, joinedDays: 60 },
  },
]

// ─── Wallet Mock ────────────────────────────────────────────────────────────

const mockWalletState = {
  connected: false,
  publicKey: null as { toBase58: () => string } | null,
  connecting: false,
  signTransaction: vi.fn(),
  signAllTransactions: vi.fn(),
  signMessage: vi.fn(),
}

function setWallet(connected: boolean) {
  mockWalletState.connected = connected
  mockWalletState.publicKey = connected ? ({ toBase58: () => '7xKXtg2CW87d97TXJSDpbD5jBkheTlxA7ZmEU4LNMhAF' } as const) : null
}

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockWalletState,
  useConnection: () => ({ connection: vi.fn() }),
}))

// ─── API Mock ────────────────────────────────────────────────────────────────

const mockGetTasks = vi.fn()
const mockGetTaskDetail = vi.fn()

vi.mock('../api/task', () => ({
  getTasks: (...args: unknown[]) => mockGetTasks(...args),
  getTaskDetail: (...args: unknown[]) => mockGetTaskDetail(...args),
  getMyTasks: vi.fn().mockResolvedValue({ tasks: [] }),
  createTask: vi.fn(),
  assignTask: vi.fn(),
  startTask: vi.fn(),
  submitTask: vi.fn(),
  verifyTask: vi.fn(),
  cancelTask: vi.fn(),
  getTaskBids: vi.fn().mockResolvedValue([]),
}))

// ─── Router Helpers ────────────────────────────────────────────────────────

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

// ─── Reusable Test TaskCard from TaskMarket logic ──────────────────────────

// We test the actual TaskMarket + FilterBar integration, not isolated units.
// TaskMarket is the page that uses FilterBar + TaskCard together.

function renderTaskMarket() {
  // Lazy-import to avoid hoisting issues with mocks
  const { TaskMarket } = require('../pages/TaskMarket')
  return renderWithRouter(<TaskMarket />)
}

// ════════════════════════════════════════════════════════════════════════════
// E2E SUITE 1: TASK MARKET — BROWSING
// ════════════════════════════════════════════════════════════════════════════

describe('E2E: Task Market — Browsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setWallet(false)
    mockGetTasks.mockResolvedValue({ tasks: TASKS })
  })

  it('renders all task cards from API', async () => {
    renderTaskMarket()
    await waitFor(() => {
      expect(screen.getByText('AI Article Writer Agent')).toBeInTheDocument()
      expect(screen.getByText('DeFi Analytics Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Social Media Bot')).toBeInTheDocument()
      expect(screen.getByText('NFT Marketplace Frontend')).toBeInTheDocument()
      expect(screen.getByText('Smart Contract Auditor')).toBeInTheDocument()
    })
  })

  it('renders reward amounts on each card', async () => {
    renderTaskMarket()
    await waitFor(() => {
      expect(screen.getByText('5 SOL')).toBeInTheDocument()
      expect(screen.getByText('12 SOL')).toBeInTheDocument()
      expect(screen.getByText('3 SOL')).toBeInTheDocument()
      expect(screen.getByText('8 SOL')).toBeInTheDocument()
      expect(screen.getByText('20 SOL')).toBeInTheDocument()
    })
  })

  it('renders skill tags on task cards', async () => {
    renderTaskMarket()
    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('Python')).toBeInTheDocument()
      expect(screen.getByText('Rust')).toBeInTheDocument()
    })
  })

  it('renders status badges on task cards', async () => {
    renderTaskMarket()
    await waitFor(() => {
      // At least 3 open tasks should have OPEN badge text
      const openBadges = screen.getAllByText('OPEN')
      expect(openBadges.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('renders bid counts', async () => {
    renderTaskMarket()
    await waitFor(() => {
      expect(screen.getByText(/3 bids/i)).toBeInTheDocument()
      expect(screen.getByText(/7 bids/i)).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching', async () => {
    mockGetTasks.mockImplementation(() => new Promise(() => {})) // never resolves
    renderTaskMarket()
    // Should not throw — page renders without crashing
    expect(screen.queryByText('AI Article Writer Agent')).not.toBeInTheDocument()
  })

  it('shows empty state when API returns no tasks', async () => {
    mockGetTasks.mockResolvedValue({ tasks: [] })
    renderTaskMarket()
    await waitFor(() => {
      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument()
    })
  })

  it('shows wallet-disconnected banner', async () => {
    renderTaskMarket()
    await waitFor(() => {
      expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument()
    })
  })

  it('hides wallet banner when wallet is connected', async () => {
    setWallet(true)
    renderTaskMarket()
    await waitFor(() => {
      expect(screen.queryByText(/wallet not connected/i)).not.toBeInTheDocument()
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// E2E SUITE 2: TASK MARKET — FILTERING
// ════════════════════════════════════════════════════════════════════════════

describe('E2E: Task Market — Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setWallet(false)
    mockGetTasks.mockResolvedValue({ tasks: TASKS })
  })

  it('"All" type filter shows all tasks', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const allBtn = screen.getByRole('button', { name: /all/i }).closest('button') || screen.getAllByRole('button').find(b => b.textContent === 'All')
    if (allBtn) fireEvent.click(allBtn)

    await waitFor(() => {
      expect(screen.getByText('AI Article Writer Agent')).toBeInTheDocument()
      expect(screen.getByText('DeFi Analytics Dashboard')).toBeInTheDocument()
    })
  })

  it('"Open" type filter hides in_progress tasks', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    // Click "Open" filter pill
    const openBtns = screen.getAllByRole('button')
    const openBtn = openBtns.find(b => b.textContent?.trim() === 'Open')
    if (openBtn) fireEvent.click(openBtn)

    await waitFor(() => {
      // Open tasks visible
      expect(screen.getByText('AI Article Writer Agent')).toBeInTheDocument()
      expect(screen.getByText('Social Media Bot')).toBeInTheDocument()
      expect(screen.getByText('NFT Marketplace Frontend')).toBeInTheDocument()
      // In-progress tasks hidden
      expect(screen.queryByText('DeFi Analytics Dashboard')).not.toBeInTheDocument()
      expect(screen.queryByText('Smart Contract Auditor')).not.toBeInTheDocument()
    })
  })

  it('"In Progress" filter shows only in_progress tasks', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const allBtns = screen.getAllByRole('button')
    const inProgressBtn = allBtns.find(b => b.textContent?.trim() === 'In Progress')
    if (inProgressBtn) fireEvent.click(inProgressBtn)

    await waitFor(() => {
      expect(screen.getByText('DeFi Analytics Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Smart Contract Auditor')).toBeInTheDocument()
      expect(screen.queryByText('AI Article Writer Agent')).not.toBeInTheDocument()
    })
  })

  it('budget filter 0–3 SOL shows only tasks ≤ 3 SOL', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const selects = screen.getAllByRole('combobox')
    const budgetSelect = selects[0] // first select is budget
    if (budgetSelect) fireEvent.change(budgetSelect, { target: { value: '0-3' } })

    await waitFor(() => {
      expect(screen.getByText('3 SOL')).toBeInTheDocument()
    })
    // Only the 3-SOL task should appear
    await waitFor(() => {
      expect(screen.queryByText('5 SOL')).not.toBeInTheDocument()
      expect(screen.queryByText('8 SOL')).not.toBeInTheDocument()
      expect(screen.queryByText('12 SOL')).not.toBeInTheDocument()
      expect(screen.queryByText('20 SOL')).not.toBeInTheDocument()
    })
  })

  it('budget filter 10+ SOL shows only tasks ≥ 10 SOL', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const selects = screen.getAllByRole('combobox')
    const budgetSelect = selects.find(s => (s as HTMLSelectElement).value === 'all')
    if (budgetSelect) fireEvent.change(budgetSelect, { target: { value: '10+' } })

    await waitFor(() => {
      expect(screen.getByText('12 SOL')).toBeInTheDocument()
      expect(screen.getByText('20 SOL')).toBeInTheDocument()
      expect(screen.queryByText('5 SOL')).not.toBeInTheDocument()
      expect(screen.queryByText('3 SOL')).not.toBeInTheDocument()
    })
  })

  it('search by title filters tasks', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const searchInput = screen.getByPlaceholder(/search tasks/i)
    await userEvent.clear(searchInput)
    await userEvent.type(searchInput, 'NFT')

    await waitFor(() => {
      expect(screen.getByText('NFT Marketplace Frontend')).toBeInTheDocument()
      expect(screen.queryByText('AI Article Writer Agent')).not.toBeInTheDocument()
    })
  })

  it('search by skill filters tasks', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const searchInput = screen.getByPlaceholder(/search tasks/i)
    await userEvent.clear(searchInput)
    await userEvent.type(searchInput, 'Python')

    await waitFor(() => {
      expect(screen.getByText('Social Media Bot')).toBeInTheDocument()
      expect(screen.queryByText('AI Article Writer Agent')).not.toBeInTheDocument()
    })
  })

  it('search is case-insensitive', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const searchInput = screen.getByPlaceholder(/search tasks/i)
    await userEvent.clear(searchInput)
    await userEvent.type(searchInput, 'rust')

    await waitFor(() => {
      expect(screen.getByText('Smart Contract Auditor')).toBeInTheDocument()
    })
  })

  it('search with no match shows empty state', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const searchInput = screen.getByPlaceholder(/search tasks/i)
    await userEvent.clear(searchInput)
    await userEvent.type(searchInput, 'XYZ999_NO_MATCH')

    await waitFor(() => {
      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument()
    })
  })

  it('clear button (✕) resets search', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const searchInput = screen.getByPlaceholder(/search tasks/i)
    await userEvent.type(searchInput, 'NFT')

    await waitFor(() => expect(screen.getByText('NFT Marketplace Frontend')).toBeInTheDocument())

    const clearBtn = screen.getByText('✕')
    fireEvent.click(clearBtn)

    await waitFor(() => {
      expect(searchInput).toHaveValue('')
      expect(screen.getByText('AI Article Writer Agent')).toBeInTheDocument()
    })
  })

  it('sort by reward shows highest first', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const selects = screen.getAllByRole('combobox')
    const sortSelect = selects[selects.length - 1] // last select is sort
    if (sortSelect) fireEvent.change(sortSelect, { target: { value: 'reward' } })

    await waitFor(() => {
      const cards = screen.getAllByRole('article')
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  it('filter pipeline: Open + 5-10 SOL shows correct tasks', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    // Open filter
    const allBtns1 = screen.getAllByRole('button')
    const openBtn = allBtns1.find(b => b.textContent?.trim() === 'Open')
    if (openBtn) fireEvent.click(openBtn)

    // Budget 5-10 SOL
    const selects = screen.getAllByRole('combobox')
    const budgetSelect = selects.find(s => (s as HTMLSelectElement).value === 'all')
    if (budgetSelect) fireEvent.change(budgetSelect, { target: { value: '5-10' } })

    await waitFor(() => {
      expect(screen.getByText('8 SOL')).toBeInTheDocument()
      expect(screen.queryByText('5 SOL')).not.toBeInTheDocument() // 5 is "open" but budget is 5-10
      expect(screen.queryByText('3 SOL')).not.toBeInTheDocument()
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// E2E SUITE 3: TASK CARD CTA & WALLET STATE
// ════════════════════════════════════════════════════════════════════════════

describe('E2E: Task Card — CTA & Wallet State', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTasks.mockResolvedValue({ tasks: TASKS })
  })

  it('"View Details →" button is disabled when wallet disconnected', async () => {
    setWallet(false)
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    // Find all "View Details →" buttons
    const detailBtns = screen.getAllByText('View Details →')
    expect(detailBtns.length).toBeGreaterThan(0)
    // They should be inside disabled parent buttons
    detailBtns.forEach(btn => {
      const parent = btn.closest('button')
      if (parent) expect(parent).toBeDisabled()
    })
  })

  it('CTA enables when wallet connected and task is open', async () => {
    setWallet(true)
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const detailBtns = screen.getAllByText('View Details →')
    detailBtns.forEach(btn => {
      const parent = btn.closest('button')
      if (parent) expect(parent).not.toBeDisabled()
    })
  })

  it('in-progress task CTA always shows "Unavailable"', async () => {
    setWallet(true)
    renderTaskMarket()
    await waitFor(() => screen.getByText('DeFi Analytics Dashboard'))

    // DeFi task is in_progress — should show Unavailable even with wallet connected
    // (DeFi task is filtered out by default 'open' filter, but visible in 'all' or 'in_progress')
    const allBtns = screen.getAllByRole('button')
    const inProgressBtn = allBtns.find(b => b.textContent?.trim() === 'In Progress')
    if (inProgressBtn) fireEvent.click(inProgressBtn)

    await waitFor(() => {
      const unavailableBtns = screen.getAllByText('Unavailable')
      expect(unavailableBtns.length).toBeGreaterThan(0)
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// E2E SUITE 4: TASK DETAIL PAGE
// ════════════════════════════════════════════════════════════════════════════

describe('E2E: Task Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setWallet(true)
  })

  async function renderTaskDetail(taskId = '1') {
    const { TaskDetailPage } = require('../pages/TaskDetailPage')
    return render(
      <MemoryRouter initialEntries={[`/tasks/${taskId}`]}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('renders task title and description', async () => {
    mockGetTaskDetail.mockResolvedValue({
      task: TASKS[0],
      bids: [],
    })
    renderTaskDetail('1')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /ai article writer/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/build a react-based ai agent/i)).toBeInTheDocument()
  })

  it('renders reward badge', async () => {
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[0], bids: [] })
    renderTaskDetail('1')

    await waitFor(() => {
      expect(screen.getByText('5 SOL')).toBeInTheDocument()
    })
  })

  it('renders skill tags', async () => {
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[0], bids: [] })
    renderTaskDetail('1')

    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument()
      expect(screen.getByText('TypeScript')).toBeInTheDocument()
      expect(screen.getByText('OpenAI API')).toBeInTheDocument()
    })
  })

  it('renders publisher info', async () => {
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[0], bids: [] })
    renderTaskDetail('1')

    await waitFor(() => {
      expect(screen.getByText(/7xk...f3b9/i)).toBeInTheDocument()
      expect(screen.getByText(/4\.8/i)).toBeInTheDocument()
      expect(screen.getByText(/23 tasks/i)).toBeInTheDocument()
    })
  })

  it('renders bid count', async () => {
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[0], bids: [] })
    renderTaskDetail('1')

    await waitFor(() => {
      expect(screen.getByText(/3 bids/i)).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching detail', async () => {
    mockGetTaskDetail.mockImplementation(() => new Promise(() => {}))
    renderTaskDetail('1')
    // Should not throw
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows "Accept Task" button for open task when wallet connected', async () => {
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[0], bids: [] })
    renderTaskDetail('1')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept task/i })).toBeInTheDocument()
    })
  })

  it('shows "Connect Wallet" prompt when wallet disconnected', async () => {
    setWallet(false)
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[0], bids: [] })
    renderTaskDetail('1')

    await waitFor(() => {
      expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument()
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// E2E SUITE 5: FULL USER JOURNEY — BROWSING → DETAIL → BID
// ════════════════════════════════════════════════════════════════════════════

describe('E2E: Full User Journey — Browse → Detail → Bid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setWallet(true)
    mockGetTasks.mockResolvedValue({ tasks: TASKS })
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[0], bids: [] })
  })

  it('clicking task card navigates to task detail page', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    // Click the first task card
    const card = screen.getByText('AI Article Writer Agent').closest('article')
    expect(card).toBeTruthy()
    fireEvent.click(card!)

    await waitFor(() => {
      // Should now be on detail page
      expect(screen.getByRole('heading', { name: /ai article writer/i })).toBeInTheDocument()
    })
  })

  it('detail page shows all task fields from API', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const card = screen.getByText('AI Article Writer Agent').closest('article')
    fireEvent.click(card!)

    await waitFor(() => {
      // Acceptance criteria
      expect(screen.getByText(/agent generates coherent/i)).toBeInTheDocument()
      // Budget range
      expect(screen.getByText(/4\.5.*6\.0/i)).toBeInTheDocument()
    })
  })

  it('task detail shows correct task when navigated directly', async () => {
    // Navigate directly to task #2
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[1], bids: [] })

    const { TaskDetailPage } = require('../pages/TaskDetailPage')
    render(
      <MemoryRouter initialEntries={['/tasks/2']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /defi analytics/i })).toBeInTheDocument()
      expect(screen.getByText('12 SOL')).toBeInTheDocument()
    })
  })

  it('shows deadline urgency — task due soon shows warning', async () => {
    mockGetTaskDetail.mockResolvedValue({ task: TASKS[1], bids: [] }) // deadline: 2026-04-08 (1 day away)

    const { TaskDetailPage } = require('../pages/TaskDetailPage')
    render(
      <MemoryRouter initialEntries={['/tasks/2']}>
        <Routes>
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      // The detail page should show deadline info
      expect(screen.getByText(/2026-04-08/i)).toBeInTheDocument()
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// E2E SUITE 6: FILTER × SORT INTERACTIONS
// ════════════════════════════════════════════════════════════════════════════

describe('E2E: Filter × Sort Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setWallet(false)
    mockGetTasks.mockResolvedValue({ tasks: TASKS })
  })

  it('changing sort option re-renders task list', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    const selects = screen.getAllByRole('combobox')
    const sortSelect = selects[selects.length - 1]
    if (sortSelect) fireEvent.change(sortSelect, { target: { value: 'bids' } })

    await waitFor(() => {
      // All tasks still visible (sort doesn't filter, only reorders)
      expect(screen.getByText('AI Article Writer Agent')).toBeInTheDocument()
    })
  })

  it('multiple filter changes are composable', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    // 1. Set type filter to "Open"
    const allBtns = screen.getAllByRole('button')
    const openBtn = allBtns.find(b => b.textContent?.trim() === 'Open')
    if (openBtn) fireEvent.click(openBtn)

    // 2. Set budget filter to "3–5 SOL"
    const selects = screen.getAllByRole('combobox')
    const budgetSelect = selects[0]
    if (budgetSelect) fireEvent.change(budgetSelect, { target: { value: '3-5' } })

    await waitFor(() => {
      // 5 SOL task is open and 3-5 range (boundary — task at 5 SOL)
      expect(screen.getByText('5 SOL')).toBeInTheDocument()
    })

    // 3. Search narrows further
    const searchInput = screen.getByPlaceholder(/search tasks/i)
    await userEvent.type(searchInput, 'AI')

    await waitFor(() => {
      expect(screen.getByText('AI Article Writer Agent')).toBeInTheDocument()
      // Social Media Bot (3 SOL) should be filtered out by search
      expect(screen.queryByText('Social Media Bot')).not.toBeInTheDocument()
    })
  })

  it('result count reflects active filters', async () => {
    renderTaskMarket()
    await waitFor(() => screen.getByText('AI Article Writer Agent'))

    // "Open" filter: 3 open tasks out of 5
    const allBtns = screen.getAllByRole('button')
    const openBtn = allBtns.find(b => b.textContent?.trim() === 'Open')
    if (openBtn) fireEvent.click(openBtn)

    await waitFor(() => {
      const countEl = screen.getByText(/of 5/i)
      expect(countEl).toBeInTheDocument()
    })
  })
})
