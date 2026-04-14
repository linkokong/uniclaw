// $UNICLAW Token Service
// Direct Solana RPC calls for SPL Token balance (no Anchor needed)

import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { TOKENS } from './tokens'

const DEVNET_RPC = 'https://api.devnet.solana.com'

export const tokenConnection = new Connection(DEVNET_RPC, 'confirmed')

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

/** Get UNICLAW balance for a wallet (in UI units) */
export async function getUniclawBalance(wallet: PublicKey): Promise<number> {
  const accounts = await getTokenAccounts(wallet)
  const uniclawAccounts = accounts.filter(
    (a) => a.mint === TOKENS.UNICLAW.mintAddress
  )
  if (uniclawAccounts.length === 0) return 0
  const totalRaw = uniclawAccounts.reduce((sum, a) => sum + a.amount, 0n)
  return Number(totalRaw) / 10 ** TOKENS.UNICLAW.decimals
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
