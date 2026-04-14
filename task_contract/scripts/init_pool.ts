#!/usr/bin/env ts-node
/**
 * =============================================================================
 * Initialize Fund Pool - Claw Universe Task Contract
 * =============================================================================
 * Initializes the PlatformTreasury account after contract deployment.
 * This must be done before any tasks can be created.
 * 
 * Usage: ts-node scripts/init_pool.ts <network> [treasury_amount]
 * Example: ts-node scripts/init_pool.ts devnet 10
 * =============================================================================
 */

import * as anchor from "@anchor-lang/core";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

// =============================================================================
// Configuration
// =============================================================================

const PROGRAM_ID = new PublicKey("EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C");
const TREASURY_SEED = Buffer.from("platform_treasury");

// Network RPC endpoints
const RPC_URLS: Record<string, string> = {
  devnet: process.env.RPC_URL || "https://api.devnet.solana.com",
  testnet: process.env.RPC_URL || "https://api.testnet.solana.com",
  mainnet: process.env.RPC_URL || "https://api.mainnet-beta.solana.com",
};

// =============================================================================
// Types & Interfaces
// =============================================================================

interface PlatformTreasury {
  authority: PublicKey;
  total_fees_collected: anchor.BN;
  fee_basis_points: number;
  bump: number;
}

interface InitializePoolParams {
  connection: Connection;
  payer: Keypair;
  authority: PublicKey;
  treasury: Keypair;
  signers: Keypair[];
}

// =============================================================================
// Initialize Platform Treasury
// =============================================================================

async function initializePlatformTreasury(
  params: InitializePoolParams
): Promise<{ txSig: string; treasury: PublicKey }> {
  const { connection, payer, authority, treasury, signers } = params;

  // Create the treasury account (PDA)
  const treasurySpace = 32 + 8 + 2 + 1 + 8; // authority + total_fees + fee_bps + bump + padding
  const treasuryLamports = await connection.getMinimumBalanceForRentExemption(treasurySpace);

  const createTreasuryIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: treasury.publicKey,
    lamports: treasuryLamports,
    space: treasurySpace,
    programId: PROGRAM_ID,
  });

  // Initialize instruction (CPI call)
  // Since we're using Anchor, we need to construct the instruction manually
  // or use the Anchor workspace. For standalone execution, we use raw CPI.

  const initializeIx = {
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },      // authority
      { pubkey: treasury.publicKey, isSigner: false, isWritable: true }, // treasury (PDA)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: Buffer.from([
      0x00, // InitializePlatform variant index
      ...treasury.bump.toBuffer(1, "little"),
    ]),
  };

  const transaction = new Transaction().add(createTreasuryIx, initializeIx as any);

  const txSig = await sendAndConfirmTransaction(connection, transaction, signers, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  return { txSig, treasury: treasury.publicKey };
}

// =============================================================================
// Find Treasury PDA
// =============================================================================

function findTreasuryAddress(): PublicKey {
  const [address] = PublicKey.findProgramAddressSync([TREASURY_SEED], PROGRAM_ID);
  return address;
}

// =============================================================================
// Get PlatformTreasury Data (from account info)
// =============================================================================

async function getTreasuryData(
  connection: Connection,
  treasuryAddress: PublicKey
): Promise<PlatformTreasury | null> {
  try {
    const accountInfo = await connection.getAccountInfo(treasuryAddress);
    if (!accountInfo) return null;

    // Parse the account data (simplified - actual parsing depends on Anchor IDL)
    const data = accountInfo.data;
    const authority = new PublicKey(data.slice(0, 32));
    const totalFees = anchor.BN.fromBuffer(data.slice(32, 40));
    const feeBps = data.readUInt16LE(40);
    const bump = data[42];

    return {
      authority,
      total_fees_collected: totalFees,
      fee_basis_points: feeBps,
      bump,
    };
  } catch (error) {
    console.error("Error fetching treasury data:", error);
    return null;
  }
}

// =============================================================================
// Verify Treasury Initialization
// =============================================================================

async function verifyTreasuryInitialized(
  connection: Connection,
  authority: PublicKey
): Promise<boolean> {
  const treasuryAddress = findTreasuryAddress();
  console.log(`\n[Verify] Treasury PDA: ${treasuryAddress.toBase58()}`);

  const accountInfo = await connection.getAccountInfo(treasuryAddress);

  if (!accountInfo) {
    console.log("[Verify] ✗ Treasury account not found");
    return false;
  }

  if (accountInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
    console.log("[Verify] ✗ Treasury account has wrong owner");
    return false;
  }

  const treasury = await getTreasuryData(connection, treasuryAddress);
  if (!treasury) {
    console.log("[Verify] ✗ Could not parse treasury data");
    return false;
  }

  console.log("[Verify] ✓ Treasury account initialized");
  console.log(`         Authority: ${treasury.authority.toBase58()}`);
  console.log(`         Total Fees Collected: ${treasury.total_fees_collected} lamports`);
  console.log(`         Fee (bps): ${treasury.fee_basis_points}`);
  console.log(`         Bump: ${treasury.bump}`);

  // Verify authority matches
  if (treasury.authority.toBase58() !== authority.toBase58()) {
    console.log("[Verify] ✗ Authority mismatch!");
    return false;
  }

  // Verify fee is correct (1500 bps = 15%)
  if (treasury.fee_basis_points !== 1500) {
    console.log("[Verify] ✗ Fee basis points mismatch!");
    return false;
  }

  console.log("\n[Verify] ✓ All checks passed!");
  return true;
}

// =============================================================================
// Generate Deploy Report
// =============================================================================

function generateInitReport(
  network: string,
  txSig: string,
  treasuryAddress: PublicKey,
  authority: PublicKey
): void {
  const fs = require("fs");
  const path = require("path");

  const reportPath = path.join(__dirname, "../init-report.json");
  const report = {
    initialization: {
      timestamp: new Date().toISOString(),
      network,
      status: "success",
      transaction: {
        signature: txSig,
        rpc_url: RPC_URLS[network],
        explorer_url: `https://explorer.solana.com/tx/${txSig}?cluster=${network}`,
      },
      treasury: {
        address: treasuryAddress.toBase58(),
        pda_seed: TREASURY_SEED.toString(),
        authority: authority.toBase58(),
        fee_basis_points: 1500,
      },
    },
    next_steps: {
      create_task: "Use the CLI or frontend to create tasks",
      verify_contract: "ts-node scripts/verify.ts " + network,
    },
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n[Report] Initialization report saved to: ${reportPath}`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  Claw Universe - Initialize Platform Treasury");
  console.log("=".repeat(60) + "\n");

  // Parse arguments
  const network = process.argv[2] || "devnet";
  const treasuryAmount = parseFloat(process.argv[3]) || 0; // Initial SOL deposit (optional)

  console.log(`Network: ${network}`);
  console.log(`RPC URL: ${RPC_URLS[network]}`);
  console.log("");

  // Validate network
  if (!RPC_URLS[network]) {
    console.error(`Error: Invalid network '${network}'`);
    console.error("Valid options: devnet, testnet, mainnet");
    process.exit(1);
  }

  // Get provider/wallet
  const walletPath =
    process.env.ANCHOR_WALLET ||
    process.env.SOLANA_WALLET ||
    `${process.env.HOME}/.config/solana/id.json`;

  console.log(`Wallet: ${walletPath}`);

  // Load wallet keypair
  let payer: Keypair;
  try {
    const walletData = require("fs").readFileSync(walletPath);
    payer = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(walletData.toString()))
    );
    console.log(`Payer: ${payer.publicKey.toBase58()}\n`);
  } catch (error) {
    console.error(`Error: Could not load wallet from ${walletPath}`);
    console.error("Set ANCHOR_WALLET or SOLANA_WALLET environment variable.");
    process.exit(1);
  }

  // Connect to network
  const connection = new Connection(RPC_URLS[network], {
    commitment: "confirmed",
  });

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL\n`);

  if (balance < 0.01) {
    console.error("Error: Insufficient balance. Need at least 0.01 SOL for rent.");
    process.exit(1);
  }

  // Find treasury PDA
  const treasury = findTreasuryAddress();
  console.log(`Treasury PDA: ${treasury.toBase58()}`);

  // Check if already initialized
  const existingTreasury = await connection.getAccountInfo(treasury);
  if (existingTreasury && existingTreasury.data.length > 0) {
    console.log("\n[Info] Treasury already initialized. Verifying...\n");
    const isValid = await verifyTreasuryInitialized(connection, payer.publicKey);
    if (isValid) {
      console.log("\n[Info] Treasury is ready. No re-initialization needed.");
    }
    process.exit(isValid ? 0 : 1);
  }

  // Generate treasury keypair (for the PDA, we derive it deterministically)
  const treasuryKeypair = Keypair.fromSeed(
    TREASURY_SEED
  );

  console.log("\n[Step 1] Creating treasury account...");

  // Create treasury account
  const treasurySpace = 32 + 8 + 2 + 1 + 8; // authority + total_fees + fee_bps + bump + padding
  const treasuryLamports = await connection.getMinimumBalanceForRentExemption(treasurySpace);

  const createTreasuryIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: treasury,
    lamports: treasuryLamports,
    space: treasurySpace,
    programId: PROGRAM_ID,
  });

  console.log("[Step 2] Initializing treasury (calling initialize_platform)...");

  // Initialize instruction data
  // This needs to match the Anchor IDL encoding
  const initializeData = Buffer.alloc(1 + 1); // variant (1) + bump (1)
  initializeData.writeUInt8(0, 0); // InitializePlatform variant
  // The bump will be auto-derived in the program, but we need to pass it
  // For now, we create the account first then call init

  const initIx = {
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // authority
      { pubkey: treasury, isSigner: false, isWritable: true }, // treasury
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: Buffer.from([0x00]), // InitializePlatform instruction
  };

  const transaction = new Transaction().add(createTreasuryIx, initIx as any);

  console.log("[Step 3] Sending transaction...");

  const txSig = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }
  );

  console.log(`\n✓ Transaction confirmed: ${txSig}`);
  console.log(`  Explorer: https://explorer.solana.com/tx/${txSig}?cluster=${network}`);

  // Verify
  console.log("\n[Verify] Verifying initialization...");
  const isValid = await verifyTreasuryInitialized(connection, payer.publicKey);

  if (isValid) {
    console.log("\n" + "=".repeat(60));
    console.log("  ✓ Platform Treasury Initialized Successfully!");
    console.log("=".repeat(60) + "\n");
    generateInitReport(network, txSig, treasury, payer.publicKey);
  } else {
    console.error("\n✗ Initialization verification failed!");
    process.exit(1);
  }
}

// Export functions for testing
export {
  initializePlatformTreasury,
  findTreasuryAddress,
  getTreasuryData,
  verifyTreasuryInitialized,
  generateInitReport,
};

// Run if executed directly
main().catch((error) => {
  console.error("\n✗ Error:", error.message || error);
  if (error.logs) {
    console.error("Program logs:", error.logs);
  }
  process.exit(1);
});
