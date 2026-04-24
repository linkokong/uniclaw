// ============================================================
// Claw Universe — BidForm Component
// 提交投标表单：输入报价、方案、预计时长
// ============================================================

import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { createBid } from '../api/bid'
import {
  submitBidOnChain,
  deriveTaskPdaFromCreator,
  ANCHOR_PROGRAM_ID,
} from '../utils/anchor'
import type { CreateBidPayload } from '../types/api'
import { PublicKey } from '@solana/web3.js'

interface BidFormProps {
  taskId: string
  taskPda?: string  // Direct PDA address (preferred)
  taskTitle?: string // For PDA derivation if taskPda not provided
  creatorWallet?: string // Creator wallet for PDA derivation
  /** 典型报价范围（用于 UI 提示） */
  bidRange?: { min: number; max: number }
  /** 提交成功后回调 */
  onSuccess?: () => void
}

/** Duration presets */
const DURATION_PRESETS = [
  { label: '1 day',    value: '1 day' },
  { label: '3 days',   value: '3 days' },
  { label: '1 week',   value: '1 week' },
  { label: '2 weeks',  value: '2 weeks' },
  { label: '1 month',  value: '1 month' },
]

// ─── Main BidForm Component ──────────────────────────────────────────────
export default function BidForm({ taskId, taskPda, taskTitle, creatorWallet, bidRange, onSuccess }: BidFormProps) {
  const { publicKey, signTransaction, connected } = useWallet()

  const [bidAmount, setBidAmount] = useState('')
  const [proposal, setProposal]   = useState('')
  const [duration, setDuration]   = useState('1 week')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const [submitMode, setSubmitMode] = useState<'api' | 'onchain'>(taskPda ? 'onchain' : 'api')

  // 表单校验
  const isValid = bidAmount.length > 0 && parseFloat(bidAmount) > 0 && proposal.trim().length >= 20

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || !publicKey || !signTransaction) return

    setLoading(true)
    setError(null)

    try {
      if (submitMode === 'onchain') {
        // ── On-chain submission via Anchor ──────────────────────────
        const numAmount = parseFloat(bidAmount)
        if (isNaN(numAmount) || numAmount <= 0) {
          setError('请输入有效的投标金额')
          setLoading(false)
          return
        }
        // Use taskPda prop if provided, otherwise derive from creatorWallet + taskTitle
        let resolvedTaskPda: PublicKey
        if (taskPda) {
          resolvedTaskPda = new PublicKey(taskPda)
        } else if (creatorWallet && taskTitle) {
          resolvedTaskPda = deriveTaskPdaFromCreator(creatorWallet, taskTitle)
        } else {
          setError('缺少任务信息，无法提交链上投标')
          setLoading(false)
          return
        }
        const depositLamports = Math.max(
          Math.round(numAmount * 1e9 * 0.01), // 1% of bid as deposit, min 100k lamports (refunded on task completion)
          100_000,
        )
        if (isNaN(depositLamports) || depositLamports <= 0) {
          setError('金额计算错误，请重试')
          setLoading(false)
          return
        }
        await submitBidOnChain(
          { publicKey, signTransaction: signTransaction as never, signAllTransactions: undefined },
          resolvedTaskPda,
          proposal.trim(),
          depositLamports,
        )
        setSuccess(true)
        onSuccess?.()
        return
      }

      // ── API submission (default) ──────────────────────────────────
      const payload: CreateBidPayload = {
        task_id: taskId,
        amount: bidAmount.trim(),
        proposal: proposal.trim(),
        estimated_duration: duration,
      }
      await createBid(payload)
      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Failed to submit bid: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [isValid, publicKey, signTransaction, taskId, bidAmount, proposal, duration, submitMode, onSuccess])

  // ── Wallet not connected ──────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="bg-gray-900/50 border border-gray-700/50 rounded-2xl p-6 text-center">
        <span className="text-3xl mb-3 block">🔒</span>
        <h3 className="text-white font-medium mb-1">Connect Your Wallet</h3>
        <p className="text-gray-500 text-sm">Connect your Solana wallet to place a bid</p>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-6 text-center">
        <span className="text-4xl mb-3 block">✅</span>
        <h3 className="text-emerald-400 font-semibold mb-1">Bid Submitted!</h3>
        <p className="text-gray-400 text-sm mb-4">
          Your bid of <span className="text-emerald-400 font-medium">{bidAmount} SOL</span> has been placed.
          If selected, your deposit is held as a performance guarantee and refunded upon task completion.
        </p>
        <button
          onClick={() => { setSuccess(false); setBidAmount(''); setProposal(''); setDuration('1 week') }}
          className="text-sm text-gray-400 hover:text-white underline transition-colors"
        >
          Place another bid
        </button>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#111827] border border-gray-800/70 rounded-2xl p-5 space-y-4"
      noValidate
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white">Place Your Bid</h3>
        {bidRange && (
          <span className="text-xs text-gray-500">
            Typical: {bidRange.min}–{bidRange.max} SOL
          </span>
        )}
      </div>

      {/* On-chain toggle */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-500">Submit via:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-700/50 text-xs">
          <button
            type="button"
            onClick={() => setSubmitMode('api')}
            className={`px-3 py-1 transition-colors ${
              submitMode === 'api'
                ? 'bg-[#9945FF]/20 text-[#9945FF] font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            API
          </button>
          <button
            type="button"
            onClick={() => setSubmitMode('onchain')}
            className={`px-3 py-1 transition-colors ${
              submitMode === 'onchain'
                ? 'bg-[#14F195]/15 text-[#14F195] font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            ⚡ On-chain
          </button>
        </div>
        {submitMode === 'onchain' && (
          <span className="text-[10px] text-gray-600">
            via Anchor · {ANCHOR_PROGRAM_ID.toBase58().slice(0, 8)}…
          </span>
        )}
      </div>

      {/* Bid amount */}
      <div>
        <label htmlFor="bid-amount" className="block text-xs text-gray-400 mb-1.5">
          Your Bid (SOL) <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            id="bid-amount"
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="5.0"
            min="0.001"
            step="0.1"
            className="w-full px-4 py-2.5 bg-gray-900/70 border border-gray-700/50 rounded-xl
              text-sm text-white placeholder-gray-600
              focus:outline-none focus:border-[#9945FF]/50 focus:ring-2 focus:ring-[#9945FF]/20
              transition-all"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">SOL</span>
        </div>
        {bidRange && bidAmount && (
          <p className={`mt-1 text-xs ${parseFloat(bidAmount) < bidRange.min ? 'text-yellow-400' : 'text-gray-600'}`}>
            {parseFloat(bidAmount) < bidRange.min
              ? `Below typical range (min ${bidRange.min} SOL) — may reduce acceptance chances`
              : parseFloat(bidAmount) > bidRange.max
              ? `Above typical range (max ${bidRange.max} SOL)` : ''}
          </p>
        )}
      </div>

      {/* Estimated duration */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Estimated Duration <span className="text-red-400">*</span></label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map(preset => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setDuration(preset.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                duration === preset.value
                  ? 'bg-[#9945FF]/20 border border-[#9945FF]/50 text-[#9945FF]'
                  : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 5 days"
          className="mt-2 w-full px-4 py-2 bg-gray-900/70 border border-gray-700/50 rounded-xl
            text-sm text-white placeholder-gray-600
            focus:outline-none focus:border-[#9945FF]/50 focus:ring-2 focus:ring-[#9945FF]/20
            transition-all"
        />
      </div>

      {/* Proposal */}
      <div>
        <label htmlFor="bid-proposal" className="block text-xs text-gray-400 mb-1.5">
          Your Proposal <span className="text-red-400">*</span>
        </label>
        <textarea
          id="bid-proposal"
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          placeholder="Describe your approach, relevant experience, tools you'll use, and how you'll ensure quality delivery..."
          rows={4}
          className="w-full px-4 py-3 bg-gray-900/70 border border-gray-700/50 rounded-xl
            text-sm text-white placeholder-gray-600 resize-none
            focus:outline-none focus:border-[#9945FF]/50 focus:ring-2 focus:ring-[#9945FF]/20
            transition-all"
        />
        <p className="mt-1 text-xs text-right text-gray-600">
          {proposal.trim().length} / 20 min
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2.5">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || loading}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
          isValid && !loading
            ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 active:scale-98'
            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
            Submitting…
          </span>
        ) : 'Submit Bid'}
      </button>

      {/* Escrow note */}
      <p className="text-center text-xs text-gray-600">
        By submitting, you agree to escrow your bid amount until task completion
      </p>
    </form>
  )
}
