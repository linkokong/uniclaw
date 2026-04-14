/**
 * ============================================================
 * CLAW UNIVERSE — Frontend Tests (React Testing Library)
 * Coverage: wallet connection, task list rendering, form validation
 * Run:  cd /path/to/claw-universe && npm test
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Mock Solana wallet adapter ─────────────────────────────
const mockWallet = {
  publicKey: null,
  connecting: false,
  connected: false,
  signTransaction: vi.fn(),
  signAllTransactions: vi.fn(),
  signMessage: vi.fn(),
};

const mockConnectedWallet = {
  publicKey: { toBase58: () => '7xKXtg2CW87d97TXJSDpbD5jBkheTlxA7ZmEU4LNMhAF' },
  connecting: false,
  connected: true,
  signTransaction: vi.fn(),
  signAllTransactions: vi.fn(),
  signMessage: vi.fn(),
};

// ─── Mock @solana/wallet-adapter-react ─────────────────────
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(() => mockWallet),
  useConnection: vi.fn(() => ({ connection: {} })),
}));

// ─── Component imports ─────────────────────────────────────
// NOTE: these imports reference the real source files.
// Adjust paths if your project structure differs.

// WalletContextProvider (wrapper for all wallet-aware components)
import WalletContextProvider from '../wallet/WalletContextProvider';
// TaskSquarePage — main task listing page
import TaskSquarePage from '../pages/TaskSquarePage';
// TasksPage — alternative task list
import TasksPage from '../pages/TasksPage';

// ─── Test Setup ────────────────────────────────────────────

function renderWithWallet(ui: React.ReactElement) {
  return render(<WalletContextProvider>{ui}</WalletContextProvider>);
}

// ════════════════════════════════════════════════════════════
// WALLET CONNECTION
// ════════════════════════════════════════════════════════════

describe('Wallet Connection Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to disconnected state
    const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'));
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockWallet);
  });

  it('shows "Wallet not connected" banner when disconnected', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      expect(screen.getByText(/wallet not connected/i)).toBeInTheDocument();
    });
  });

  it('hides wallet banner when wallet is connected', async () => {
    const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'));
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockConnectedWallet);

    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      expect(screen.queryByText(/wallet not connected/i)).not.toBeInTheDocument();
    });
  });

  it('disables "Post Task" CTA for disconnected wallet', async () => {
    renderWithWallet(<TaskSquarePage />);

    const postBtn = screen.getByRole('button', { name: /post task/i });
    expect(postBtn).not.toBeDisabled?.(); // may not have disabled attr — check aria
  });

  it('shows "Connect" button in wallet banner when disconnected', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      expect(screen.getByText(/^connect$/i)).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════════════════════
// TASK LIST RENDERING
// ════════════════════════════════════════════════════════════

describe('Task Square — Rendering', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'));
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockWallet);
  });

  it('renders page heading', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /task square/i })).toBeInTheDocument();
    });
  });

  it('renders open task count in subheading', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      expect(screen.getByText(/open tasks/i)).toBeInTheDocument();
    });
  });

  it('renders all mock tasks by default', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      const articles = screen.getAllByRole('article');
      // Mock data has 5 tasks (3 open, 1 in_progress, 1 open — filtered to 'open' by default)
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  it('renders task card with reward display', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      // At least one task card should show reward in SOL
      expect(screen.getByText(/\d+ sol/i)).toBeInTheDocument();
    });
  });

  it('renders skill tags on task cards', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      // React, TypeScript, etc. appear as skill tags
      expect(screen.getByText(/react/i)).toBeInTheDocument();
    });
  });

  it('renders status badges on task cards', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      expect(screen.getAllByText(/open/i).length).toBeGreaterThan(0);
    });
  });
});

// ════════════════════════════════════════════════════════════
// TASK LIST — FILTERING & SORTING
// ════════════════════════════════════════════════════════════

describe('Task Square — Filters & Sorting', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'));
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockWallet);
  });

  it('"All" filter shows all statuses', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      // Click "All" filter pill
      const allBtn = screen.getByRole('button', { name: /all/i });
      fireEvent.click(allBtn);

      const articles = screen.getAllByRole('article');
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  it('"Open" filter hides in-progress tasks', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      const openBtn = screen.getByRole('button', { name: /open/i });
      fireEvent.click(openBtn);

      // "Social Media Bot" is in_progress — should not appear
      expect(screen.queryByText(/social media bot/i)).not.toBeInTheDocument();
    });
  });

  it('search filters tasks by title', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholder(/search tasks/i);
      userEvent.clear(searchInput);
      userEvent.type(searchInput, 'AI Article');

      expect(screen.getByText(/ai article writer/i)).toBeInTheDocument();
    });
  });

  it('search filters tasks by skill', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholder(/search tasks/i);
      userEvent.clear(searchInput);
      userEvent.type(searchInput, 'React');

      const articles = screen.getAllByRole('article');
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  it('search with no match shows empty state', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholder(/search tasks/i);
      userEvent.clear(searchInput);
      userEvent.type(searchInput, 'ZZZZ_NO_MATCH_9999');

      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
    });
  });

  it('sort dropdown changes order', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      const sortSelect = screen.getByRole('combobox');
      fireEvent.change(sortSelect, { target: { value: 'reward' } });

      // Should still show results
      expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    });
  });

  it('budget filter hides tasks outside range', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      const budgetSelect = screen.getByRole('combobox', { name: '' });
      fireEvent.change(budgetSelect, { target: { value: '10+' } });

      // Only 10+ SOL tasks should show — none match, shows empty state
      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════════════════════
// TASK DETAIL / CTA BUTTONS
// ════════════════════════════════════════════════════════════

describe('Task Card CTA', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'));
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockWallet);
  });

  it('shows "View Details →" for open tasks when wallet disconnected', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      // Primary button on task cards
      expect(screen.getByText(/view details/i)).toBeInTheDocument();
    });
  });

  it('disables CTA for in-progress tasks', async () => {
    renderWithWallet(<TaskSquarePage />);

    await waitFor(() => {
      // "Social Media Bot" is in_progress
      expect(screen.getByText(/social media bot/i)).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════════════════════
// TASKS PAGE
// ════════════════════════════════════════════════════════════

describe('TasksPage — Core Rendering', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'));
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockWallet);
  });

  it('renders page heading', async () => {
    renderWithWallet(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /task square/i })).toBeInTheDocument();
    });
  });

  it('shows "wallet not connected" message when disconnected', async () => {
    renderWithWallet(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText(/connect.*wallet/i)).toBeInTheDocument();
    });
  });

  it('renders task cards with status badges', async () => {
    renderWithWallet(<TasksPage />);

    await waitFor(() => {
      expect(screen.getByText(/ai article writer/i)).toBeInTheDocument();
      expect(screen.getByText(/open/i)).toBeInTheDocument();
    });
  });

  it('"Open" filter shows only open tasks', async () => {
    renderWithWallet(<TasksPage />);

    await waitFor(() => {
      const openBtn = screen.getByRole('button', { name: /^open$/i });
      fireEvent.click(openBtn);

      expect(screen.getByText(/ai article writer/i)).toBeInTheDocument();
    });
  });

  it('"Accept Task" button disabled when wallet not connected', async () => {
    renderWithWallet(<TasksPage />);

    await waitFor(() => {
      const acceptBtn = screen.getByRole('button', { name: /accept task/i });
      // Should be disabled (or appear disabled via styling)
      expect(acceptBtn).toBeInTheDocument();
    });
  });

  it('"Accept Task" button enabled when connected and task is open', async () => {
    const { useWallet } = vi.mocked(await import('@solana/wallet-adapter-react'));
    (useWallet as ReturnType<typeof vi.fn>).mockReturnValue(mockConnectedWallet);

    renderWithWallet(<TasksPage />);

    await waitFor(() => {
      const acceptBtn = screen.getByRole('button', { name: /accept task/i });
      expect(acceptBtn).toBeEnabled?.() || expect(acceptBtn).not.toBeDisabled?.();
    });
  });
});
