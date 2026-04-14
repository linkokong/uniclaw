// ============================================================
// Claw Universe — WalletPage (src/pages/WalletPage.tsx)
// 钱包页面：展示余额 + 交易历史（占位 UI，后续接入真实 API）
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

import { getSolBalance } from '../api/user'
import { getUniclawBalance } from '../utils/tokenService'
import { TOKENS } from '../utils/tokens'
import type { Transaction } from '../types/api'

// ─── Types ─────────────────────────────────────────────────────────────────

interface BalanceData {
  balance: number
  escrow: number
}

interface TokenBalanceData {
  symbol: string
  name: string
  balance: number
  mintAddress: string
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800/50 rounded ${className}`} />
}

// ─── Transaction Row ───────────────────────────────────────────────────────

const TX_TYPE_CONFIG: Record<string, { label: string; color: string; sign: '+' | '-' }> = {
  transfer_in:        { label: '转入',       color: 'text-emerald-400', sign: '+' },
  transfer_out:       { label: '转出',       color: 'text-red-400',     sign: '-' },
  escrow_deposit:     { label: '押金存入',   color: 'text-yellow-400', sign: '-' },
  escrow_release:     { label: '押金释放',   color: 'text-emerald-400', sign: '+' },
  escrow_refund:      { label: '押金退还',   color: 'text-blue-400',    sign: '+' },
}

function TxRow({ tx }: { tx: Transaction }) {
  const cfg = TX_TYPE_CONFIG[tx.type] ?? { label: tx.type, color: 'text-gray-400', sign: '+' }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(tx.timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins}分钟前`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}小时前`
    return `${Math.floor(hrs / 24)}天前`
  })()

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800/50 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          cfg.sign === '+' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {cfg.sign}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</p>
          <p className="text-gray-500 text-xs truncate">
            {tx.memo || `${tx.counterparty.slice(0, 6)}…${tx.counterparty.slice(-4)}`}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className={`text-sm font-bold ${cfg.sign === '+' ? 'text-emerald-400' : 'text-red-400'}`}>
          {cfg.sign}{parseFloat(tx.amount).toFixed(4)} SOL
        </p>
        <p className="text-gray-600 text-xs">{timeAgo}</p>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { publicKey } = useWallet()

  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [tokenBalance, setTokenBalance] = useState<TokenBalanceData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [loadingTx, setLoadingTx] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  // ── Load Balance ───────────────────────────────────────────────────────
  const loadBalance = useCallback(async () => {
    if (!publicKey) return
    setLoadingBalance(true)
    setBalanceError(null)
    try {
      const wallet = publicKey.toBase58()
      const data = await getSolBalance(wallet)
      setBalance(data)
      // Also fetch UNICLAW balance directly from Solana RPC
      const uniclawBal = await getUniclawBalance(publicKey)
      setTokenBalance({
        symbol: TOKENS.UNICLAW.symbol,
        name: TOKENS.UNICLAW.name,
        balance: uniclawBal,
        mintAddress: TOKENS.UNICLAW.mintAddress,
      })
    } catch {
      setBalanceError('余额加载失败')
    } finally {
      setLoadingBalance(false)
    }
  }, [publicKey])

  // ── Load Transactions ─────────────────────────────────────────────────
  const loadTransactions = useCallback(async () => {
    if (!publicKey) return
    setLoadingTx(true)
    setTxError(null)
    try {
      const wallet = publicKey.toBase58()
      const { transactions: txs } = await import('../api/user').then(m => m.getTransactions(wallet))
      setTransactions((txs as Transaction[]) ?? [])
    } catch {
      setTxError('交易记录加载失败')
    } finally {
      setLoadingTx(false)
    }
  }, [publicKey])

  useEffect(() => {
    loadBalance()
    loadTransactions()
  }, [loadBalance, loadTransactions])

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">钱包</h1>
        <p className="text-gray-500 text-sm mt-1">管理您的资产与交易</p>
      </div>

      {/* Not connected */}
      {!publicKey && (
        <div className="text-center py-20 bg-[#111827] border border-gray-800/60 rounded-2xl space-y-2">
          <span className="text-5xl">🔗</span>
          <p className="text-gray-300 font-semibold text-lg">连接钱包</p>
          <p className="text-gray-600 text-sm">请先连接钱包以查看余额与交易</p>
        </div>
      )}

      {/* Balance Cards */}
      {publicKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SOL Card */}
          <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              <span className="inline-block mr-2">◎</span>SOL
            </h2>
            {loadingBalance && (
              <div className="space-y-3">
                <SkeletonBlock className="h-10 w-48" />
                <SkeletonBlock className="h-6 w-32" />
              </div>
            )}
            {balanceError && <p className="text-red-400 text-sm">{balanceError}</p>}
            {balance && !loadingBalance && (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">
                    {balance.balance.toFixed(4)}
                  </span>
                  <span className="text-gray-500 text-lg">SOL</span>
                </div>
                <p className="text-gray-500 text-sm">
                  托管中 <span className="text-yellow-400 font-medium">{balance.escrow.toFixed(4)} SOL</span>
                </p>
              </div>
            )}
          </div>

          {/* UNICLAW Card */}
          <div className="bg-[#111827] border border-purple-800/50 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              <span className="inline-block mr-2">⬡</span>UNICLAW
            </h2>
            {!loadingBalance && tokenBalance && (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-purple-400">
                    {tokenBalance.balance.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                  </span>
                  <span className="text-gray-500 text-lg">UNIC</span>
                </div>
                <p className="text-gray-600 text-xs">
                  Mint: {tokenBalance.mintAddress.slice(0, 8)}…{tokenBalance.mintAddress.slice(-4)}
                </p>
                <a
                  href={`https://explorer.solana.com/address/${tokenBalance.mintAddress}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-purple-400/70 hover:text-purple-400 transition-colors"
                >
                  在 Explorer 查看 →
                </a>
              </div>
            )}
            {loadingBalance && (
              <div className="space-y-3">
                <SkeletonBlock className="h-10 w-48" />
                <SkeletonBlock className="h-4 w-32" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction History */}
      {publicKey && (
        <div className="bg-[#111827] border border-gray-800/70 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">交易历史</h2>

          {loadingTx && (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex justify-between py-3">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-4 w-20" />
                </div>
              ))}
            </div>
          )}

          {txError && (
            <div className="text-center py-6">
              <p className="text-red-400 text-sm mb-2">{txError}</p>
              <button
                onClick={loadTransactions}
                className="text-sm text-gray-400 hover:text-white underline transition-colors"
              >
                重试
              </button>
            </div>
          )}

          {!loadingTx && !txError && transactions.length === 0 && (
            <div className="text-center py-10 text-gray-600 space-y-1">
              <span className="text-3xl">📭</span>
              <p className="text-sm">暂无交易记录</p>
            </div>
          )}

          {!loadingTx && !txError && transactions.length > 0 && (
            <div>
              {transactions.map(tx => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Placeholder hint */}
      {publicKey && !loadingBalance && (
        <p className="text-center text-gray-700 text-xs">
          💡 余额与交易数据来自 API，UI 已完成占位
        </p>
      )}
    </div>
  )
}
