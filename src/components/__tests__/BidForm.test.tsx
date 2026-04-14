/**
 * BidForm.test.tsx — Integration Tests
 * Framework: Vitest + React Testing Library + jsdom
 *
 * Tests the BidForm component's key user flows:
 *   • Wallet NOT connected → shows "Connect Your Wallet" locked state
 *   • Wallet connected + success → shows success message with bid amount
 *   • Form validation: bidAmount required, proposal ≥ 20 chars
 *   • Duration presets toggle correctly
 *   • Error state displays API error message
 *   • Submit disabled when form invalid
 *   • "Place another bid" resets the form
 *   • bidRange warning below/above typical range
 *
 * Run:
 *   npx vitest run src/components/__tests__/BidForm.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockPublicKey = { toBase58: () => '7xKXtg2CW87d97TXJSDpbD5jBkheTlxA7ZmEU4LNMhAF' }
const mockSignTransaction = vi.fn()

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
}))

vi.mock('../api/bid', () => ({
  createBid: vi.fn(),
}))

const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'))
const { createBid } = await import('../api/bid')

function setWalletConnected(connected: boolean) {
  ;(useWallet as ReturnType<typeof vi.fn>).mockReturnValue({
    connected,
    publicKey: connected ? mockPublicKey : null,
    connecting: false,
    disconnecting: false,
    signTransaction: connected ? mockSignTransaction : vi.fn(),
    signAllTransactions: vi.fn(),
    signMessage: vi.fn(),
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function importBidForm() {
  const mod = await import('../BidForm')
  return mod.default
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  setWalletConnected(false)
  vi.mocked(createBid).mockResolvedValue({} as never)
})

// ── Wallet Gate ───────────────────────────────────────────────────────────────

describe('BidForm — Wallet Gate', () => {
  it('shows "Connect Your Wallet" when wallet is NOT connected', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument()
    expect(screen.getByText(/connect your solana wallet to place a bid/i)).toBeInTheDocument()
  })

  it('renders the form when wallet IS connected', async () => {
    setWalletConnected(true)
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    expect(screen.getByText('Place Your Bid')).toBeInTheDocument()
  })
})

// ── Form Fields ───────────────────────────────────────────────────────────────

describe('BidForm — Form Fields', () => {
  beforeEach(() => { setWalletConnected(true) })

  it('renders bid amount input', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    expect(screen.getByLabelText(/your bid.*sol/i)).toBeInTheDocument()
  })

  it('renders proposal textarea', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    expect(screen.getByLabelText(/your proposal/i)).toBeInTheDocument()
  })

  it('renders all duration preset buttons', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    expect(screen.getByRole('button', { name: '1 day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 days' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 weeks' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 month' })).toBeInTheDocument()
  })

  it('shows bidRange typical range hint when provided', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" bidRange={{ min: 3, max: 8 }} />)

    expect(screen.getByText(/typical.*3–8 sol/i)).toBeInTheDocument()
  })
})

// ── Duration Presets ────────────────────────────────────────────────────────

describe('BidForm — Duration Presets', () => {
  beforeEach(() => { setWalletConnected(true) })

  it('selects preset on click and updates hidden duration input', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    // Default: "1 week"
    const weekBtn = screen.getByRole('button', { name: '1 week' })
    expect(weekBtn.className).toMatch(/bg-\[#9945FF\]/)

    // Click "3 days"
    const threeDayBtn = screen.getByRole('button', { name: '3 days' })
    fireEvent.click(threeDayBtn)
    expect(threeDayBtn.className).toMatch(/bg-\[#9945FF\]/)
  })
})

// ── Proposal Validation ──────────────────────────────────────────────────────

describe('BidForm — Proposal Validation', () => {
  beforeEach(() => { setWalletConnected(true) })

  it('shows character counter', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    const counter = screen.getByText(/\d+ \/ 20 min/)
    expect(counter).toBeInTheDocument()
  })

  it('disables submit when proposal is too short (< 20 chars)', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    const submitBtn = screen.getByRole('button', { name: 'Submit Bid' })
    expect(submitBtn).toBeDisabled()
  })

  it('enables submit when proposal ≥ 20 chars and bidAmount filled', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5')
    await userEvent.type(
      screen.getByLabelText(/your proposal/i),
      'This is a detailed proposal that exceeds the minimum character requirement.',
    )

    const submitBtn = screen.getByRole('button', { name: 'Submit Bid' })
    expect(submitBtn).not.toBeDisabled()
  })
})

// ── Submission Flow ──────────────────────────────────────────────────────────

describe('BidForm — Submission', () => {
  beforeEach(() => { setWalletConnected(true) })

  it('calls createBid with correct payload on submit', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5')
    await userEvent.type(
      screen.getByLabelText(/your proposal/i),
      'This is a detailed proposal that exceeds the minimum character requirement.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bid' }))

    await waitFor(() => {
      expect(createBid).toHaveBeenCalledOnce()
      expect(createBid).toHaveBeenCalledWith({
        task_id: 'task-1',
        amount: '5',
        proposal: expect.stringContaining('detailed proposal'),
        estimated_duration: '1 week',
      })
    })
  })

  it('shows loading state while submitting', async () => {
    vi.mocked(createBid).mockImplementation(
      () => new Promise((res) => setTimeout(() => res({}), 100)),
    )
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5')
    await userEvent.type(
      screen.getByLabelText(/your proposal/i),
      'This is a detailed proposal that exceeds the minimum character requirement.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bid' }))

    expect(screen.getByText(/submitting/i)).toBeInTheDocument()
    const submitBtn = screen.getByRole('button', { name: /submitting/i })
    expect(submitBtn).toBeDisabled()
  })

  it('shows error message on API failure', async () => {
    vi.mocked(createBid).mockRejectedValue(new Error('Network error: 500'))
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5')
    await userEvent.type(
      screen.getByLabelText(/your proposal/i),
      'This is a detailed proposal that exceeds the minimum character requirement.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bid' }))

    await waitFor(() => {
      expect(screen.getByText(/failed to submit bid/i)).toBeInTheDocument()
    })
  })
})

// ── Success State ─────────────────────────────────────────────────────────────

describe('BidForm — Success State', () => {
  beforeEach(() => { setWalletConnected(true) })

  it('shows success message with bid amount after successful submit', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5.5')
    await userEvent.type(
      screen.getByLabelText(/your proposal/i),
      'This is a detailed proposal that exceeds the minimum character requirement.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bid' }))

    await waitFor(() => {
      expect(screen.getByText(/bid submitted/i)).toBeInTheDocument()
      expect(screen.getByText(/5\.5 sol/i)).toBeInTheDocument()
    })
  })

  it('"Place another bid" resets form to initial state', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5')
    await userEvent.type(
      screen.getByLabelText(/your proposal/i),
      'This is a detailed proposal that exceeds the minimum character requirement.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bid' }))

    await waitFor(() => {
      expect(screen.getByText(/bid submitted/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Place another bid'))

    await waitFor(() => {
      expect(screen.getByLabelText(/your bid.*sol/i)).toHaveValue('')
      expect(screen.getByLabelText(/your proposal/i)).toHaveValue('')
    })
  })

  it('calls onSuccess callback after successful submit', async () => {
    const onSuccess = vi.fn()
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5')
    await userEvent.type(
      screen.getByLabelText(/your proposal/i),
      'This is a detailed proposal that exceeds the minimum character requirement.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Submit Bid' }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce()
    })
  })
})

// ── bidRange Warning ───────────────────────────────────────────────────────────

describe('BidForm — bidRange Warning', () => {
  beforeEach(() => { setWalletConnected(true) })

  it('shows yellow warning when bid is below typical min', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" bidRange={{ min: 3, max: 8 }} />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '1')

    expect(screen.getByText(/below typical range.*min 3 sol/i)).toBeInTheDocument()
  })

  it('shows warning when bid is above typical max', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" bidRange={{ min: 3, max: 8 }} />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '20')

    expect(screen.getByText(/above typical range.*max 8 sol/i)).toBeInTheDocument()
  })

  it('no warning when bid is within range', async () => {
    const BidForm = await importBidForm()
    render(<BidForm taskId="task-1" bidRange={{ min: 3, max: 8 }} />)

    await userEvent.type(screen.getByLabelText(/your bid.*sol/i), '5')

    // Should not show above/below range messages
    expect(screen.queryByText(/below typical range/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/above typical range/i)).not.toBeInTheDocument()
  })
})
