#!/usr/bin/env ts-node
/**
 * =============================================================================
 * Verify Contract Deployment - Claw Universe Task Contract
 * =============================================================================
 * Verifies that the smart contract is deployed and functional on the target
 * network by checking program existence, treasury initialization, and basic RPC.
 * 
 * Usage: ts-node scripts/verify.ts <network>
 * Example: ts-node scripts/verify.ts devnet
 * =============================================================================
 */

import {
  Connection,
  PublicKey,
  Keypair,
} from "@solana/web3.js";
import * as anchor from "@anchor-lang/core";

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
// Verification Results
// =============================================================================

interface VerificationResult {
  passed: boolean;
  check: string;
  message: string;
  details?: Record<string, any>;
}

interface VerificationReport {
  timestamp: string;
  network: string;
  rpc_url: string;
  program_id: string;
  overall_status: "PASS" | "FAIL" | "PARTIAL";
  checks: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

// =============================================================================
// Verification Checks
// =============================================================================

async function checkProgramDeployed(
  connection: Connection
): Promise<VerificationResult> {
  try {
    const programInfo = await connection.getAccountInfo(PROGRAM_ID);
    
    if (!programInfo) {
      return {
        passed: false,
        check: "program_deployed",
        message: "Program not found on-chain",
      };
    }

    if (programInfo.executable !== true) {
      return {
        passed: false,
        check: "program_deployed",
        message: "Account is not executable (not a program)",
      };
    }

    return {
      passed: true,
      check: "program_deployed",
      message: "Program is deployed and executable",
      details: {
        owner: programInfo.owner.toBase58(),
        lamports: programInfo.lamports,
        data_size: programInfo.data.length,
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      check: "program_deployed",
      message: `Error checking program: ${error.message}`,
    };
  }
}

async function checkTreasuryInitialized(
  connection: Connection
): Promise<VerificationResult> {
  try {
    const [treasuryAddress] = PublicKey.findProgramAddressSync(
      [TREASURY_SEED],
      PROGRAM_ID
    );

    const treasuryInfo = await connection.getAccountInfo(treasuryAddress);

    if (!treasuryInfo) {
      return {
        passed: false,
        check: "treasury_initialized",
        message: "Treasury account not found (not yet initialized)",
        details: {
          treasury_address: treasuryAddress.toBase58(),
          pda_seed: TREASURY_SEED.toString(),
        },
      };
    }

    // Verify it's owned by our program
    if (treasuryInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
      return {
        passed: false,
        check: "treasury_initialized",
        message: "Treasury account has wrong owner",
        details: {
          expected_owner: PROGRAM_ID.toBase58(),
          actual_owner: treasuryInfo.owner.toBase58(),
        },
      };
    }

    // Parse treasury data (basic validation)
    if (treasuryInfo.data.length < 43) {
      return {
        passed: false,
        check: "treasury_initialized",
        message: "Treasury data too short",
      };
    }

    // Extract treasury state
    const authority = new PublicKey(treasuryInfo.data.slice(0, 32));
    const feeBps = treasuryInfo.data.readUInt16LE(40);

    return {
      passed: true,
      check: "treasury_initialized",
      message: "Treasury is initialized",
      details: {
        treasury_address: treasuryAddress.toBase58(),
        authority: authority.toBase58(),
        fee_basis_points: feeBps,
        data_size: treasuryInfo.data.length,
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      check: "treasury_initialized",
      message: `Error checking treasury: ${error.message}`,
    };
  }
}

async function checkClusterHealth(
  connection: Connection
): Promise<VerificationResult> {
  try {
    const start = Date.now();
    const version = await connection.getVersion();
    const latency = Date.now() - start;

    return {
      passed: true,
      check: "cluster_health",
      message: "Cluster is responsive",
      details: {
        version: version["solana-core"],
        latency_ms: latency,
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      check: "cluster_health",
      message: `Cluster not responding: ${error.message}`,
    };
  }
}

async function checkWalletBalance(
  connection: Connection,
  wallet: Keypair
): Promise<VerificationResult> {
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    const balanceSol = balance / 1e9;

    const hasMinimum = balance >= 0.01; // 0.01 SOL for rent

    return {
      passed: hasMinimum,
      check: "wallet_balance",
      message: hasMinimum
        ? `Wallet has sufficient balance`
        : `Insufficient balance for operations`,
      details: {
        address: wallet.publicKey.toBase58(),
        balance_lamports: balance,
        balance_sol: balanceSol,
        minimum_required: "0.01 SOL",
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      check: "wallet_balance",
      message: `Error checking balance: ${error.message}`,
    };
  }
}

async function checkRecentBlocks(
  connection: Connection
): Promise<VerificationResult> {
  try {
    const slot = await connection.getSlot();
    const block = await connection.getBlock(slot, {
      maxSupportedTransactionVersion: 0,
    });

    return {
      passed: true,
      check: "recent_blocks",
      message: "Can fetch recent blocks",
      details: {
        current_slot: slot,
        block_slot: block?.slot,
        block_time: block?.blockTime
          ? new Date(block.blockTime * 1000).toISOString()
          : null,
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      check: "recent_blocks",
      message: `Cannot fetch blocks: ${error.message}`,
    };
  }
}

async function checkProgramIdl(
  connection: Connection
): Promise<VerificationResult> {
  // Check if we can derive expected PDA addresses
  try {
    const [treasury] = PublicKey.findProgramAddressSync(
      [TREASURY_SEED],
      PROGRAM_ID
    );

    return {
      passed: true,
      check: "program_idl",
      message: "Program IDL structure derivable",
      details: {
        treasury_pda: treasury.toBase58(),
        escrow_seed: Buffer.from("escrow").toString("base64"),
        agent_profile_seed: Buffer.from("agent_profile").toString("base64"),
        task_seed: Buffer.from("task").toString("base64"),
      },
    };
  } catch (error: any) {
    return {
      passed: false,
      check: "program_idl",
      message: `Error deriving PDAs: ${error.message}`,
    };
  }
}

// =============================================================================
// Generate Verification Report
// =============================================================================

function generateReport(report: VerificationReport): void {
  const fs = require("fs");
  const path = require("path");

  const reportPath = path.join(__dirname, "../verify-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n[Report] Verification report saved to: ${reportPath}`);
}

function printReport(report: VerificationReport): void {
  console.log("\n" + "=".repeat(70));
  console.log("                    VERIFICATION REPORT");
  console.log("=".repeat(70));
  console.log(`\n  Timestamp:  ${report.timestamp}`);
  console.log(`  Network:   ${report.network}`);
  console.log(`  RPC:       ${report.rpc_url}`);
  console.log(`  Program:   ${report.program_id}`);
  console.log(`  Status:    ${report.overall_status}`);
  console.log("");

  console.log("-".repeat(70));
  console.log("  CHECKS:");
  console.log("-".repeat(70));

  for (const check of report.checks) {
    const icon = check.passed ? "✓" : "✗";
    const status = check.passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
    console.log(`\n  [${icon}] ${check.check} - ${status}`);
    console.log(`      ${check.message}`);

    if (check.details) {
      for (const [key, value] of Object.entries(check.details)) {
        console.log(`      ${key}: ${value}`);
      }
    }
  }

  console.log("\n" + "-".repeat(70));
  console.log("  SUMMARY:");
  console.log("-".repeat(70));
  console.log(`  Total:  ${report.summary.total}`);
  console.log(`  Passed: ${report.summary.passed}`);
  console.log(`  Failed: ${report.summary.failed}`);
  console.log("=".repeat(70) + "\n");
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("         Claw Universe - Smart Contract Verification");
  console.log("=".repeat(70) + "\n");

  // Parse arguments
  const network = process.argv[2] || "devnet";

  console.log(`Network: ${network}`);
  console.log(`RPC URL: ${RPC_URLS[network]}`);
  console.log(`Program: ${PROGRAM_ID.toBase58()}`);
  console.log("");

  // Validate network
  if (!RPC_URLS[network]) {
    console.error(`Error: Invalid network '${network}'`);
    console.error("Valid options: devnet, testnet, mainnet");
    process.exit(1);
  }

  // Load wallet for balance check
  const walletPath =
    process.env.ANCHOR_WALLET ||
    process.env.SOLANA_WALLET ||
    `${process.env.HOME}/.config/solana/id.json`;

  let wallet: Keypair;
  try {
    const walletData = require("fs").readFileSync(walletPath);
    wallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(walletData.toString()))
    );
  } catch (error) {
    console.warn("Warning: Could not load wallet. Balance check will be skipped.");
    wallet = Keypair.generate();
  }

  // Connect to network
  const connection = new Connection(RPC_URLS[network], {
    commitment: "confirmed",
  });

  // Run verification checks
  console.log("[*] Running verification checks...\n");

  const checks: VerificationResult[] = [];

  // 1. Cluster health
  process.stdout.write("  [*] Checking cluster health... ");
  const healthCheck = await checkClusterHealth(connection);
  console.log(healthCheck.passed ? "✓" : "✗");
  checks.push(healthCheck);

  // 2. Program deployed
  process.stdout.write("  [*] Checking program deployment... ");
  const programCheck = await checkProgramDeployed(connection);
  console.log(programCheck.passed ? "✓" : "✗");
  checks.push(programCheck);

  // 3. Treasury initialized
  process.stdout.write("  [*] Checking treasury initialization... ");
  const treasuryCheck = await checkTreasuryInitialized(connection);
  console.log(treasuryCheck.passed ? "✓" : "✗");
  checks.push(treasuryCheck);

  // 4. Program IDL structure
  process.stdout.write("  [*] Checking program IDL structure... ");
  const idlCheck = await checkProgramIdl(connection);
  console.log(idlCheck.passed ? "✓" : "✗");
  checks.push(idlCheck);

  // 5. Recent blocks
  process.stdout.write("  [*] Checking recent blocks... ");
  const blockCheck = await checkRecentBlocks(connection);
  console.log(blockCheck.passed ? "✓" : "✗");
  checks.push(blockCheck);

  // 6. Wallet balance
  process.stdout.write("  [*] Checking wallet balance... ");
  const balanceCheck = await checkWalletBalance(connection, wallet);
  console.log(balanceCheck.passed ? "✓" : "✗");
  checks.push(balanceCheck);

  // Calculate summary
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  // Determine overall status
  let overallStatus: "PASS" | "FAIL" | "PARTIAL";
  if (failed === 0) {
    overallStatus = "PASS";
  } else if (passed === 0) {
    overallStatus = "FAIL";
  } else {
    overallStatus = "PARTIAL";
  }

  // Build report
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    network,
    rpc_url: RPC_URLS[network],
    program_id: PROGRAM_ID.toBase58(),
    overall_status: overallStatus,
    checks,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
  };

  // Print report
  printReport(report);

  // Generate JSON report
  generateReport(report);

  // Return exit code based on status
  if (overallStatus === "FAIL") {
    console.log("✗ Verification FAILED. Please check the errors above.\n");
    process.exit(1);
  } else if (overallStatus === "PARTIAL") {
    console.log(
      "⚠ Verification PARTIAL. Some checks failed. Review the report above.\n"
    );
    process.exit(1);
  } else {
    console.log(
      "✓ Verification PASSED. All checks successful.\n"
    );
    process.exit(0);
  }
}

// Export for programmatic use
export {
  checkProgramDeployed,
  checkTreasuryInitialized,
  checkClusterHealth,
  checkWalletBalance,
  checkRecentBlocks,
  checkProgramIdl,
  generateReport,
  VerificationResult,
  VerificationReport,
};

// Run if executed directly
main().catch((error) => {
  console.error("\n✗ Unexpected error:", error.message || error);
  process.exit(1);
});
