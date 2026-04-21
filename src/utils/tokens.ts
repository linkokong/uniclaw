// $UNICLAW Token Configuration
// Created: 2026-04-09
// Network: Solana Devnet

export const TOKENS = {
  UNICLAW: {
    name: 'UNICLAW',
    symbol: 'UNIC',
    decimals: 9,
    mintAddress: '5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5',
    programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
    // Stable pool for UNIC/SOL on Raydium (placeholder — update after pool creation)
    poolAddress: null as string | null,
  },
} as const

export type TokenSymbol = keyof typeof TOKENS

// Convert UI amount (human readable) to raw amount (smallest unit)
export function toRaw(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals))
}

// Convert raw amount to UI amount
export function fromRaw(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals
}
