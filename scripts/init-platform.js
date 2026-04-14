/**
 * scripts/init-platform.js
 * Initialize Claw Universe on Devnet — write first real data to the blockchain
 *
 * Seeds (exact from Rust lib.rs):
 *   treasury:       ["platform_treasury"]
 *   task:            ["task", <creator_pubkey>]  ← one task per creator
 *   escrow:          ["escrow", <task_pubkey>]
 *   worker_profile:  ["agent_profile", <owner_pubkey>]
 *   bid:             ["bid", <task_pubkey>, <bidder_pubkey>]
 *   bid_escrow:      ["bid_escrow", <bid_pubkey>]
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/api/idl.json'), 'utf8'));

const RPC = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C');
const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');
const KEYPAIR_PATH = process.env.HOME + '/.config/solana/devnet-keypair.json';

function findPDA(seeds, programId) {
  return PublicKey.findProgramAddressSync(
    seeds.map(s => typeof s === 'string' ? Buffer.from(s) : s),
    programId
  );
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const connection = new Connection(RPC, 'confirmed');

  // Load wallet
  const keydata = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keydata));
  console.log('Wallet:', payer.publicKey.toBase58());

  const provider = new AnchorProvider(
    connection,
    {
      publicKey: payer.publicKey,
      signTransaction: async (tx) => { tx.sign(payer); return tx; },
      signAllTransactions: async (txs) => { txs.forEach(t => t.sign(payer)); return txs; },
    },
    { commitment: 'confirmed' }
  );

  const program = new Program(idl, PROGRAM_ID, provider);

  // ─── Status check ─────────────────────────────────────────────────────────
  const before = await connection.getProgramAccounts(PROGRAM_ID);
  console.log('\nBefore — program accounts:', before.length);

  // ─── 1. Initialize Platform ──────────────────────────────────────────────
  console.log('\n[1/3] Initializing platform...');
  const [treasuryPDA] = findPDA([Buffer.from('platform_treasury')], PROGRAM_ID);
  console.log('   Treasury PDA:', treasuryPDA.toBase58());

  try {
    const tx1 = await program.methods.initializePlatform()
      .accounts({
        authority: payer.publicKey,
        treasury: treasuryPDA,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([payer])
      .rpc();
    console.log('   ✅ Platform initialized! Tx:', tx1);
  } catch (e) {
    console.log('   ❌ initializePlatform error:', e.message);
    if (e.logs) console.log('   Logs:', e.logs.slice(-4).join('\n          '));
  }

  await sleep(1500);

  // ─── 2. Initialize Worker Profile ────────────────────────────────────────
  console.log('\n[2/3] Initializing worker profile...');
  const [profilePDA] = findPDA([Buffer.from('agent_profile'), payer.publicKey.toBuffer()], PROGRAM_ID);
  console.log('   Profile PDA:', profilePDA.toBase58());

  try {
    const tx2 = await program.methods.initializeWorkerProfile()
      .accounts({
        owner: payer.publicKey,
        workerProfile: profilePDA,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([payer])
      .rpc();
    console.log('   ✅ Worker profile initialized! Tx:', tx2);
  } catch (e) {
    console.log('   ❌ initializeWorkerProfile error:', e.message);
    if (e.logs) console.log('   Logs:', e.logs.slice(-4).join('\n          '));
  }

  await sleep(1500);

  // ─── 3. Create task (one per creator due to PDA seed design) ────────────
  console.log('\n[3/3] Creating test task...');
  const [taskPDA] = findPDA([Buffer.from('task'), payer.publicKey.toBuffer()], PROGRAM_ID);
  const [escrowPDA] = findPDA([Buffer.from('escrow'), taskPDA.toBuffer()], PROGRAM_ID);
  console.log('   Task PDA:', taskPDA.toBase58());
  console.log('   Escrow PDA:', escrowPDA.toBase58());

  try {
    const tx3 = await program.methods.createTask(
      'Devnet Integration Test',                    // title
      'First on-chain task for Claw Universe MVP. Testing full task lifecycle: create → bid → accept → submit → verify. Reward: 0.5 SOL.', // description
      ['solana', 'anchor', 'rust', 'typescript'],  // requiredSkills
      500000000n,                                   // reward: 0.5 SOL lamports
      7n * 24n * 60n * 60n                          // verificationPeriod: 7 days
    )
      .accounts({
        creator: payer.publicKey,
        task: taskPDA,
        escrow: escrowPDA,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([payer])
      .rpc();
    console.log('   ✅ Task created! Tx:', tx3);
  } catch (e) {
    console.log('   ❌ createTask error:', e.message);
    if (e.logs) console.log('   Logs:', e.logs.slice(-5).join('\n          '));
  }

  // ─── Final status ────────────────────────────────────────────────────────
  await sleep(2000);
  const after = await connection.getProgramAccounts(PROGRAM_ID);
  console.log('\n📊 Program accounts after:', after.length);
  after.forEach(a => {
    console.log('   ', a.pubkey.toBase58(), '|', a.account.data.length, 'bytes');
  });

  const balance = await connection.getBalance(payer.publicKey);
  console.log('\n💰 Wallet SOL:', (balance / 1e9).toFixed(4), 'SOL');
  console.log('\n✅ Done.');
}

main().catch(e => {
  console.error('\n💥 Fatal:', e.message);
  process.exit(1);
});
