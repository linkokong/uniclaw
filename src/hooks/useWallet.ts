/**
 * useWallet Hook
 * 
 * Enhanced wallet state management for Claw Universe
 * Supports Phantom and Solflare wallets with balance tracking
 */
import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

export interface WalletState {
  connected: boolean
  connecting: boolean
  disconnecting: boolean
  publicKey: PublicKey | null
  address: string | null
  shortAddress: string | null
  balance: number | null
  loading: boolean
  walletName: string | null
}

export interface WalletActions {
  connect: () => void
  disconnect: () => void
  refreshBalance: () => Promise<void>
}

export interface UseWalletReturn extends WalletState, WalletActions {}

export function useWalletState(): UseWalletReturn {
  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnecting,
    disconnect,
    wallet 
  } = useWallet()
  const { connection } = useConnection()
  const { setVisible } = useWalletModal()
  
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Derive address helpers
  const address = publicKey?.toBase58() ?? null
  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null
  const walletName = wallet?.adapter.name ?? null

  // Fetch balance
  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connection) return

    setLoading(true)
    try {
      const lamports = await connection.getBalance(publicKey)
      setBalance(lamports / LAMPORTS_PER_SOL)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [publicKey, connection])

  // Fetch balance on connect
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalance()
    } else {
      setBalance(null)
    }
  }, [connected, publicKey, refreshBalance])

  // Auto-refresh balance every 30 seconds
  useEffect(() => {
    if (!connected || !publicKey) return

    const interval = setInterval(refreshBalance, 30000)
    return () => clearInterval(interval)
  }, [connected, publicKey, refreshBalance])

  // Connect wallet - if already selected, connect directly; otherwise open modal
  const connect = useCallback(() => {
    if (wallet && !connected) {
      // Wallet already selected (e.g. from localStorage) — connect directly
      wallet.adapter.connect().catch((err) => {
        console.error('[Wallet] connect failed:', err)
      })
    } else {
      // No wallet selected — open modal to choose one
      setVisible(true)
    }
  }, [wallet, connected, setVisible])

  return {
    // State
    connected,
    connecting,
    disconnecting,
    publicKey,
    address,
    shortAddress,
    balance,
    loading,
    walletName,
    
    // Actions
    connect,
    disconnect,
    refreshBalance,
  }
}

export default useWalletState
