import { Connection, Keypair, PublicKey, TransactionMessage, TransactionInstruction, SystemProgram, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as fs from 'fs';

const KEYPAIR_PATH = process.env.HOME + '/.config/solana/devnet-keypair.json';
const keydata = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
const payer = Keypair.fromSecretKey(new Uint8Array(keydata));
const PID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C');
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');

const SEEDS = {
  PLATFORM_TREASURY: 'platform_treasury',
  TASK: 'task',
  ESCROW: 'escrow',
  AGENT_PROFILE: 'agent_profile',
  BID: 'bid',
  BID_ESCROW: 'bid_escrow',
};

function getDiscriminator(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

function encodeString(s: string): Buffer {
  const buf = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length);
  return Buffer.concat([len, buf]);
}

function encodeVecString(arr: string[]): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(arr.length);
  return Buffer.concat([len, ...arr.map(s => encodeString(s))]);
}

function encodeU64(n: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

function encodeI64(n: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(n));
  return buf;
}

async function sendIx(name: string, keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[], data: Buffer): Promise<string | null> {
  try {
    const ix = new TransactionInstruction({ keys, programId: PID, data });
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: [ix] }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([payer]);
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    console.log(`✅ ${name}: ${sig.slice(0, 15)}...`);
    return sig;
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message?.slice(0, 100) || e}`);
    return null;
  }
}

async function main() {
  console.log('=== Claw Universe - What Works ===\n');
  console.log('Wallet:', payer.publicKey.toBase58());
  
  // PDAs
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.PLATFORM_TREASURY)], PID);
  const [taskPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.TASK), payer.publicKey.toBuffer()], PID);
  const [escrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ESCROW), taskPDA.toBuffer()], PID);
  const [profilePDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AGENT_PROFILE), payer.publicKey.toBuffer()], PID);
  
  // Test: Create a NEW task (different seed to avoid conflict)
  // Since Task PDA uses creator as seed, each wallet can only have 1 task
  // Let's use the existing one
  
  // Check current state
  const taskAcct = await conn.getAccountInfo(taskPDA);
  console.log('Task exists:', !!taskAcct);
  console.log('Profile exists:', !!(await conn.getAccountInfo(profilePDA)));
  console.log('Treasury exists:', !!(await conn.getAccountInfo(treasuryPDA)));
  
  // Summary
  console.log('\n=== On-Chain State Summary ===');
  const accounts = await conn.getProgramAccounts(PID);
  console.log('Program accounts:', accounts.length);
  
  for (const acct of accounts) {
    const data = acct.account.data;
    const discriminator = data.slice(0, 8).toString('hex');
    let type = 'Unknown';
    if (discriminator === '4f22e537585a3754') type = 'Task';
    else if (discriminator === 'a6b3d4e5f6a7b8c9') type = 'TaskEscrow';
    else if (discriminator.includes('treasury')) type = 'Treasury';
    else if (data.length === 202) type = 'AgentProfile';
    else if (data.length < 60) type = 'Escrow/Treasury';
    else if (data.length > 200 && data.length < 400) type = 'Bid';
    
    console.log(`  ${acct.pubkey.toBase58().slice(0, 12)}... ${type} (${data.length} bytes)`);
  }
  
  const balance = await conn.getBalance(payer.publicKey);
  console.log('\nWallet SOL:', (balance / LAMPORTS_PER_SOL).toFixed(4));
  
  console.log('\n=== Known Contract Bugs ===');
  console.log('1. accept_bid: UnbalancedInstruction - transfers lamports without deducting from source');
  console.log('2. verify_task: Custom:102 (InvalidReputation) - needs investigation');
  console.log('3. submit_task: Custom:6004 - Anchor internal error');
  console.log('\n⚠️  Contract needs bug fixes before production deployment');
}

main().catch(console.error);
