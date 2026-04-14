/**
 * UserProfile.test.tsx
 * Tests for UserProfile page — loading state, user info rendering, empty state.
 * Framework: Vitest + React Testing Library
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import UserProfile from '../UserProfile'

// ─── Mock external dependencies ─────────────────────────────────────────────

vi.mock('../api/user', () => ({
  getCurrentUser: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: null,
    connected: false,
  }),
}))

vi.mock('../components/UserStats', () => ({
  UserStatsGrid: ({ tasksCompleted, reputation, totalEarned, tasksPosted, successRate }: {
    tasksCompleted: number; reputation: number; totalEarned: number; tasksPosted: number; successRate: number;
  }) => (
    <div data-testid="user-stats-grid">
      <span data-testid="stat-tasks-completed">{tasksCompleted}</span>
      <span data-testid="stat-reputation">{reputation}</span>
      <span data-testid="stat-total-earned">{totalEarned}</span>
      <span data-testid="stat-tasks-posted">{tasksPosted}</span>
      <span data-testid="stat-success-rate">{successRate}</span>
    </div>
  ),
  ReputationScore: ({ score }: { score: number }) => (
    <div data-testid="reputation-score">{score}</div>
  ),
}))

vi.mock('../components/SkillTags', () => ({
  SkillTagList: ({ skills, onRemove, emptyMessage }: {
    skills: string[];
    onRemove?: (s: string) => void;
    emptyMessage?: string;
  }) => (
    <div data-testid="skill-tag-list">
      {skills.length === 0 ? (
        <span data-testid="skill-empty-message">{emptyMessage ?? 'No skills'}</span>
      ) : (
        skills.map(s => (
          <span key={s} data-testid={`skill-tag-${s}`}>{s}</span>
        ))
      )}
    </div>
  ),
  SkillSelectorModal: ({ onAdd, onClose }: {
    onAdd: (s: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="skill-selector-modal">
      <button data-testid="modal-close" onClick={onClose}>×</button>
      <button data-testid="modal-add-react" onClick={() => onAdd('React')}>+ React</button>
    </div>
  ),
}))

// ─── Test fixtures ─────────────────────────────────────────────────────────

const mockUser = {
  address: '7xKXtg2aCJrKuC9oMQfMN6mJomqTHXLXxNRyPGqJDqk',
  reputation: 4.5,
  rank: 'Gold Worker',
  memberSince: '2025-01-15T00:00:00Z',
  totalEarned: 38.5,
  tasksCompleted: 42,
  tasksPosted: 15,
  successRate: 92,
  bio: 'Full-stack Web3 developer.',
  skills: ['React', 'TypeScript', 'Solana SDK'],
  avatarUrl: null,
  username: null,
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('UserProfile — page loading', () => {
  it('shows loading spinner before user data arrives', async () => {
    vi.mocked(await import('../api/user')).getCurrentUser.mockImplementation(
      () => new Promise(() => {}) // never resolves — keeps loading state
    )

    const { container } = render(<UserProfile />)
    const spinner = container.querySelector('[class*="animate-spin"]')
    expect(spinner).toBeInTheDocument()
  })

  it('hides loading spinner after user data resolves', async () => {
    vi.mocked(await import('../api/user')).getCurrentUser.mockResolvedValue(mockUser)

    const { container } = render(<UserProfile />)
    await waitFor(() => {
      expect(container.querySelector('[class*="animate-spin"]')).toBeNull()
    })
  })

  it('sets loading=false and renders page content after successful fetch', async () => {
    vi.mocked(await import('../api/user')).getCurrentUser.mockResolvedValue(mockUser)

    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.queryByText(/Loading profile/i)).toBeNull()
    })
  })
})

describe('UserProfile — user info rendering', () => {
  beforeEach(() => {
    vi.mocked(await import('../api/user')).getCurrentUser.mockResolvedValue(mockUser)
  })

  it('displays user rank badge', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByText('Gold Worker')).toBeInTheDocument()
    })
  })

  it('displays member since date', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByText(/Member since/i)).toBeInTheDocument()
    })
  })

  it('displays tasks completed count', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      const stat = screen.getByTestId('stat-tasks-completed')
      expect(stat.textContent).toBe('42')
    })
  })

  it('displays reputation score', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      const score = screen.getByTestId('reputation-score')
      expect(score.textContent).toBe('4.5')
    })
  })

  it('displays bio text', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByText('Full-stack Web3 developer.')).toBeInTheDocument()
    })
  })

  it('renders UserStatsGrid with correct props', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByTestId('stat-total-earned').textContent).toBe('38.5')
      expect(screen.getByTestId('stat-success-rate').textContent).toBe('92')
    })
  })

  it('displays short address in avatar', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      // Avatar shows first 2 chars of short address uppercase
      expect(screen.getByText(/^[A-Z0-9]{2}$/)).toBeInTheDocument()
    })
  })

  it('shows history tab content by default', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByText(/History/i)).toBeInTheDocument()
    })
  })
})

describe('UserProfile — empty state', () => {
  beforeEach(() => {
    vi.mocked(await import('../api/user')).getCurrentUser.mockResolvedValue({
      ...mockUser,
      bio: null,
      skills: [],
      tasksCompleted: 0,
      reputation: 0,
      rank: 'Bronze Worker',
    })
  })

  it('shows placeholder bio text when bio is null', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByText('No bio yet.')).toBeInTheDocument()
    })
  })

  it('shows empty skill list message', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      const msg = screen.getByTestId('skill-empty-message')
      expect(msg.textContent).toBeTruthy()
    })
  })

  it('shows zero tasks completed', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      const stat = screen.getByTestId('stat-tasks-completed')
      expect(stat.textContent).toBe('0')
    })
  })

  it('renders Bronze Worker rank for new user', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByText('Bronze Worker')).toBeInTheDocument()
    })
  })

  it('shows Edit button even when bio is empty', async () => {
    render(<UserProfile />)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
  })
})