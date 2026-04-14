/**
 * WalletConnect Component
 * 
 * Beautiful wallet connection UI for Claw Universe
 * Supports Phantom and Solflare wallets
 * Displays address, balance, and disconnect button
 */
import { useMemo } from 'react'
import { useWalletState } from '../hooks/useWallet'
import { colors, radius, shadows, transitions } from '../design-system'

export default function WalletConnect() {
  const {
    connected,
    connecting,
    disconnecting,
    shortAddress,
    balance,
    loading,
    walletName,
    connect,
    disconnect,
    refreshBalance,
  } = useWalletState()

  // Get wallet icon color based on wallet name
  const walletIconColor = useMemo(() => {
    if (!walletName) return colors.solana.purple
    if (walletName.toLowerCase().includes('phantom')) return '#AB9FF2'
    if (walletName.toLowerCase().includes('solflare')) return '#FF9F1C'
    return colors.solana.purple
  }, [walletName])

  // Loading state
  if (connecting || disconnecting) {
    return (
      <button
        disabled
        className="wallet-connect-btn loading"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: colors.bg.card,
          border: `1px solid ${colors.border.default}`,
          borderRadius: radius.lg,
          color: colors.text.secondary,
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'not-allowed',
          opacity: 0.7,
        }}
      >
        <Spinner />
        <span>{connecting ? 'Connecting...' : 'Disconnecting...'}</span>
      </button>
    )
  }

  // Connected state
  if (connected && shortAddress) {
    return (
      <div
        className="wallet-connect-connected"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Wallet info */}
        <div
          className="wallet-info"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: colors.bg.card,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radius.lg,
            transition: transitions.base,
            cursor: 'pointer',
          }}
          onClick={refreshBalance}
          title="Click to refresh balance"
        >
          {/* Wallet icon */}
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${walletIconColor}, ${colors.solana.gradient})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: '#000',
            }}
          >
            {walletName?.charAt(0) || 'W'}
          </div>
          
          {/* Address */}
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
              color: colors.text.primary,
              letterSpacing: '0.02em',
            }}
          >
            {shortAddress}
          </span>
          
          {/* Separator */}
          <div
            style={{
              width: '1px',
              height: '16px',
              background: colors.border.default,
            }}
          />
          
          {/* Balance */}
          <span
            style={{
              fontSize: '13px',
              color: colors.text.accent,
              fontWeight: 500,
              minWidth: '60px',
            }}
          >
            {loading ? (
              <MiniSpinner />
            ) : balance !== null ? (
              `${balance.toFixed(4)} SOL`
            ) : (
              '-- SOL'
            )}
          </span>
        </div>

        {/* Disconnect button */}
        <button
          onClick={disconnect}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            padding: 0,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: radius.md,
            color: '#ef4444',
            cursor: 'pointer',
            transition: transitions.base,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
          }}
          title="Disconnect wallet"
        >
          <DisconnectIcon />
        </button>
      </div>
    )
  }

  // Disconnected state - Connect button
  return (
    <button
      onClick={connect}
      className="wallet-connect-btn connect"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
        border: 'none',
        borderRadius: radius.lg,
        color: '#000',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: transitions.base,
        boxShadow: shadows.glow,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 0 30px rgba(153, 69, 255, 0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = shadows.glow
      }}
    >
      <WalletIcon />
      <span>Connect Wallet</span>
    </button>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────

function WalletIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  )
}

function DisconnectIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="animate-spin"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function MiniSpinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
