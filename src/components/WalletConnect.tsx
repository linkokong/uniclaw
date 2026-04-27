/**
 * WalletConnect Component
 *
 * Wallet connection UI for Uniclaw
 * Displays address, balance, and disconnect button
 */
import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletState } from '../hooks/useWallet'
import { registerWallet } from '../api/client'
import { colors, radius, shadows, transitions } from '../design-system'
// Note: some design tokens may be used inline below; keep all imports for consistency

// ─── 检测 Phantom 是否安装 ─────────────────────────────────────────────────
function isPhantomInstalled() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return !!(w.phantom?.solana?.isPhantom || w.solana?.isPhantom)
}

export default function WalletConnect() {
  const { signMessage, publicKey } = useWallet()
  const {
    connected,
    connecting,
    disconnecting,
    shortAddress,
    walletName,
    connect,
  } = useWalletState()

  const [phantomDetected, setPhantomDetected] = useState(false)

  // ⚠️ 所有 hooks 必须在条件 return 之前调用（React Hooks 规则）
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhantomDetected(isPhantomInstalled())
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    registerWallet(signMessage ?? null, publicKey)
  }, [signMessage, publicKey, connected])

  void walletName // used for conditional rendering above via useWalletState

  // ─── 条件渲染放在所有 hooks 之后 ──────────────────────────────────────

  if (!phantomDetected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => window.open('https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa', '_blank')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #9945FF, #14F195)',
            border: 'none',
            borderRadius: radius.lg,
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(153, 69, 255, 0.4)',
          }}
        >
          <span style={{ fontSize: '16px' }}>👻</span>
          <span>安装 Phantom 钱包</span>
        </button>
      </div>
    )
  }

  if (connecting || disconnecting) {
    return (
      <button
        disabled
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

  if (connected && shortAddress) {
    // Minimal display — profile dropdown in Header handles the rest
    return null
  }

  return (
    <button
      onClick={connect}
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}


