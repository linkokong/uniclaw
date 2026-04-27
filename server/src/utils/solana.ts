/**
 * Solana utility functions for signature verification
 */

import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { sign } from 'tweetnacl'

/**
 * Verify a Solana message signature
 * @param publicKeyBase58 - The signer's public key in base58
 * @param message - The original message that was signed
 * @param signatureBase58 - The signature in base58
 * @returns true if signature is valid
 */
export async function verifyMessageSignature(
  publicKeyBase58: string,
  message: string,
  signatureBase58: string
): Promise<boolean> {
  try {
    // Decode public key
    const publicKey = new PublicKey(publicKeyBase58)
    const publicKeyBytes = publicKey.toBytes()

    // Decode signature from base58
    const signatureBytes = bs58.decode(signatureBase58)

    // Encode message as UTF-8 bytes
    const messageBytes = new TextEncoder().encode(message)

    // Verify signature using nacl
    const isValid = sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)

    return isValid
  } catch (error) {
    console.error('[verifyMessageSignature] Error:', error)
    return false
  }
}

/**
 * Create a sign message for authentication
 * @param nonce - Random nonce from server
 * @param walletAddress - Wallet address
 * @returns Formatted message to sign
 */
export function createSignMessage(nonce: string, walletAddress: string): string {
  const timestamp = new Date().toISOString()
  return `Sign this message to authenticate with UNICLAW.

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp}

This signature will prove you own this wallet.`
}
