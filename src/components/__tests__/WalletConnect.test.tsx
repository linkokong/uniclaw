/**
 * WalletConnect.test.tsx
 * Tests for WalletConnect component — rendering, connect/disconnect callbacks, connected state.
 * Framework: Vitest + React Testing Library
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ─── Mock useWallet hook ───────────────────────────────────────────────────
vi.mock('../hooks/useWallet', () => ({
  useWalletState: vi.fn(),
}))

vi.mock('../design-system', () => ({
  colors: {
    solana: { purple: '#9945FF', gradient: '#14F195' },
    bg: { card: '#111827' },
    border: { default: '#1f2937' },
    text: { primary: '#ffffff', secondary: '#9ca3af', accent: '#14F195' },
  },
  radius: { md: '10px', lg: '14px' },
  shadows: { glow: '0 0 20px rgba(153,69,255,0.3)' },
  transitions: { base: '200ms ease' },
}))

const mockWalletState = {
  connected: false,
  connecting: false,
  disconnecting: false,
  shortAddress: null as string | null,
  balance: null as number | null,
  loading: false,
  walletName: null as string | null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  refreshBalance: vi.fn(),
}

const { useWalletState } = vi.mocked(await import('../hooks/useWallet'))

function setWalletState(overrides: Partial<typeof mockWalletState> = {}) {
  const state = {
    ...mockWalletState,
    ...overrides,
    connect: overrides.connect ?? vi.fn(),
    disconnect: overrides.disconnect ?? vi.fn(),
    refreshBalance: overrides.refreshBalance ?? vi.fn(),
  }
  ;(useWalletState as ReturnType<typeof vi.fn>).mockReturnValue(state)
  return state
}

beforeEach(() => {
  vi.clearAllMocks()
  setWalletState()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WalletConnect — button rendering', () => {
  it('renders "Connect Wallet" button when disconnected', async () => {
    setWalletState({ connected: false })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('does NOT show connect button when wallet is connected', async () => {
    setWalletState({ connected: true, shortAddress: '7xKX...hAF' })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(screen.queryByRole('button', { name: /connect wallet/i })).toBeNull()
  })
})

describe('WalletConnect — onConnect callback', () => {
  it('calls connect() when Connect Wallet button is clicked', async () => {
    setWalletState({ connected: false })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(mockWalletState.connect).toHaveBeenCalledTimes(1)
  })

  it('connect is not called before button is clicked', async () => {
    setWalletState({ connected: false })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(mockWalletState.connect).not.toHaveBeenCalled()
  })
})

describe('WalletConnect — connected state display', () => {
  it('shows short address when connected', async () => {
    setWalletState({ connected: true, shortAddress: '7xKX...hAF', walletName: 'Phantom' })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(screen.getByText('7xKX...hAF')).toBeInTheDocument()
  })

  it('shows balance when loaded', async () => {
    setWalletState({ connected: true, shortAddress: '7xKX...hAF', balance: 4.5678 })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(screen.getByText('4.5678 SOL')).toBeInTheDocument()
  })

  it('shows "-- SOL" when balance is null', async () => {
    setWalletState({ connected: true, shortAddress: '7xKX...hAF', balance: null })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(screen.getByText('-- SOL')).toBeInTheDocument()
  })

  it('calls disconnect() when disconnect button is clicked', async () => {
    setWalletState({ connected: true, shortAddress: '7xKX...hAF', walletName: 'Phantom' })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    fireEvent.click(screen.getByTitle('Disconnect wallet'))
    expect(mockWalletState.disconnect).toHaveBeenCalledTimes(1)
  })

  it('shows loading spinner text when connecting', async () => {
    setWalletState({ connected: false, connecting: true })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(screen.getByText('Connecting...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows wallet initial in icon circle', async () => {
    setWalletState({ connected: true, shortAddress: '7xKX...hAF', walletName: 'Phantom' })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    expect(screen.getByText('P')).toBeInTheDocument()
  })

  it('calls refreshBalance() when wallet info container is clicked', async () => {
    setWalletState({ connected: true, shortAddress: '7xKX...hAF', balance: 1.5 })
    const WalletConnect = (await import('../WalletConnect')).default
    render(<WalletConnect />)
    fireEvent.click(screen.getByText('7xKX...hAF').closest('div')!)
    expect(mockWalletState.refreshBalance).toHaveBeenCalledTimes(1)
  })
})