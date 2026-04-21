import { useState, useEffect } from 'react'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

const TREASURY_ADDRESS = '56i6ZHTbuqSUmMExXReDUrcXuAfa5N3v8uuHvaCuRPzp'
const connection = new Connection('https://api.devnet.solana.com')

export function TreasuryCard() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    connection.getBalance(new PublicKey(TREASURY_ADDRESS)).then((lamports) => {
      setBalance(lamports / LAMPORTS_PER_SOL)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="bg-[#111827] border border-[#9945FF]/30 rounded-2xl p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Platform Treasury</p>
      {loading ? (
        <div className="h-8 w-24 bg-gray-700 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#14F195]">{balance?.toFixed(4)}</span>
          <span className="text-gray-400">SOL</span>
        </div>
      )}
      <p className="text-xs text-gray-600 mt-2 font-mono">
        {TREASURY_ADDRESS.slice(0, 6)}…{TREASURY_ADDRESS.slice(-4)}
      </p>
    </div>
  )
}
