// Token Configuration
// UNICLAW: Solana Devnet | USDGO: Solana Mainnet

export const TOKENS = {
  UNICLAW: {
    name: 'UNICLAW',
    symbol: 'UNIC',
    decimals: 9,
    mintAddress: '5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5',
    programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
    network: 'devnet' as const,
    poolAddress: null as string | null,
  },
  USDGO: {
    name: 'USDGO',
    symbol: 'USDGO',
    decimals: 6,
    mintAddress: '72puLt71H93Z9CzHuBRTwFpL4TG3WZUhnoCC7p8gxigu',
    network: 'mainnet-beta' as const,
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
