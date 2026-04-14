import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { verify } from '@noble/ed25519'
import { config } from '../config/index.js'
import { pool } from '../models/index.js'
import { SolanaError } from '../middleware/error.js'

export class SolanaService {
  private connection: Connection

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed')
  }

  // Get wallet balance
  async getBalance(walletAddress: string): Promise<string> {
    try {
      const publicKey = new PublicKey(walletAddress)
      const balance = await this.connection.getBalance(publicKey)
      return (balance / LAMPORTS_PER_SOL).toString()
    } catch (error) {
      throw new SolanaError('Failed to fetch wallet balance', error)
    }
  }

  // Get transaction history
  async getTransactionHistory(
    walletAddress: string,
    limit = 20
  ): Promise<Array<{
    signature: string
    blockTime: number
    type: string
    amount: string
    status: string
  }>> {
    try {
      const publicKey = new PublicKey(walletAddress)
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit })

      return signatures.map(sig => ({
        signature: sig.signature,
        blockTime: sig.blockTime || 0,
        type: 'unknown', // Will be determined by parsing
        amount: '0',
        status: sig.confirmationStatus || 'confirmed'
      }))
    } catch (error) {
      throw new SolanaError('Failed to fetch transaction history', error)
    }
  }

  // Send SOL transfer
  async transfer(
    fromWallet: string,
    toWallet: string,
    amount: number
  ): Promise<string> {
    try {
      // In production, this would require proper transaction signing
      // For now, we just record the transaction intent
      const publicKey = new PublicKey(fromWallet)
      const recentBlockhash = await this.connection.getLatestBlockhash()

      const transaction = new Transaction({
        recentBlockhash: recentBlockhash.blockhash,
        feePayer: publicKey,
      })

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(toWallet),
          lamports: amount * LAMPORTS_PER_SOL,
        })
      )

      // Return unsigned transaction for client to sign
      return transaction.serialize({ requireAllSignatures: false }).toString('base64')
    } catch (error) {
      throw new SolanaError('Failed to create transfer transaction', error)
    }
  }

  // Get task escrow balance from on-chain
  async getEscrowBalance(taskAddress: string): Promise<string> {
    try {
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(taskAddress))
      if (!accountInfo) {
        return '0'
      }
      return (accountInfo.lamports / LAMPORTS_PER_SOL).toString()
    } catch {
      return '0'
    }
  }

  // Verify Ed25519 signature using @noble/ed25519 (real cryptographic verification)
  async verifySignature(
    message: string,
    signature: string,
    walletAddress: string
  ): Promise<boolean> {
    try {
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = Buffer.from(signature, 'base64')
      const publicKeyBytes = new PublicKey(walletAddress).toBytes()
      const isValid = await verify(signatureBytes, messageBytes, publicKeyBytes)
      return isValid
    } catch {
      return false
    }
  }

  // Record transaction to database
  async recordTransaction(
    signature: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    type: string,
    taskId?: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO transactions (signature, from_address, to_address, amount, type, task_id, status, block_time)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', NOW())
       ON CONFLICT (signature) DO NOTHING`,
      [signature, fromAddress, toAddress, amount, type, taskId]
    )
  }
}

export const solanaService = new SolanaService()
