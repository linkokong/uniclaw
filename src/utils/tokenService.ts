// $UNICLAW Token Service
// Direct Solana RPC calls for SPL Token balance (no Anchor needed)

import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { TOKENS } from './tokens'

const DEVNET_RPC = 'https://api.devnet.solana.com'
const MAINNET_RPC = 'https://api.mainnet-beta.solana.com'

export const tokenConnection = new Connection(DEVNET_RPC, 'confirmed')
export const mainnetConnection = new Connection(MAINNET_RPC, 'confirmed')

/** Get RPC connection for a token based on its network */
export function getConnectionForToken(tokenKey: keyof typeof TOKENS): Connection {
  const token = TOKENS[tokenKey]
  return token.network === 'mainnet-beta' ? mainnetConnection : tokenConnection
}

/** Get all SPL token accounts for a wallet */
export async function getTokenAccounts(wallet: PublicKey) {
  const accounts = await tokenConnection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  })
  return accounts.value.map((acc) => {
    const info = acc.account.data as unknown as { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number; uiAmount: number } } } }
    return {
      pubkey: acc.pubkey.toBase58(),
      mint: info.parsed.info.mint,
      amount: BigInt(info.parsed.info.tokenAmount.amount),
      decimals: info.parsed.info.tokenAmount.decimals,
      uiAmount: info.parsed.info.tokenAmount.uiAmount,
    }
  })
}

/** Get token balance for a specific token (supports devnet + mainnet) */
export async function getTokenBalance(wallet: PublicKey, tokenKey: keyof typeof TOKENS): Promise<number> {
  const token = TOKENS[tokenKey]
  const connection = getConnectionForToken(tokenKey)
  const accounts = await connection.getTokenAccountsByOwner(wallet, {
    programId: TOKEN_PROGRAM_ID,
  })
  const matched = accounts.value.filter((acc) => {
    const info = acc.account.data as unknown as { parsed: { info: { mint: string } } }
    return info.parsed.info.mint === token.mintAddress
  })
  if (matched.length === 0) return 0
  const totalRaw = matched.reduce((sum, acc) => {
    const info = acc.account.data as unknown as { parsed: { info: { tokenAmount: { amount: string } } } }
    return sum + BigInt(info.parsed.info.tokenAmount.amount)
  }, 0n)
  return Number(totalRaw) / 10 ** token.decimals
}

/** Get UNICLAW balance for a wallet (in UI units) — convenience wrapper */
export async function getUniclawBalance(wallet: PublicKey): Promise<number> {
  return getTokenBalance(wallet, 'UNICLAW')
}

/** Get associated token account address for UNICLAW */
export async function getUniclawAccountAddress(wallet: PublicKey): Promise<PublicKey> {
  return PublicKey.findProgramAddressSync(
    [
      wallet.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      new PublicKey(TOKENS.UNICLAW.mintAddress).toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0]
}
