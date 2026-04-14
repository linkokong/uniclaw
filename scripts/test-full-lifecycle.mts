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

function encodeBool(b: boolean): Buffer {
  return Buffer.from([b ? 1 : 0]);
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
    console.log(`✅ ${name}: ${sig.slice(0, 20)}...`);
    return sig;
  } catch (e: any) {
    console.log(`❌ ${name}: ${e.message?.slice(0, 150) || e}`);
    return null;
  }
}

async function main() {
  console.log('=== Claw Universe - Full Lifecycle Test (Fixed Contract) ===\n');
  console.log('Wallet:', payer.publicKey.toBase58());
  
  // PDAs
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.PLATFORM_TREASURY)], PID);
  const [taskPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.TASK), payer.publicKey.toBuffer()], PID);
  const [escrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ESCROW), taskPDA.toBuffer()], PID);
  const [profilePDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AGENT_PROFILE), payer.publicKey.toBuffer()], PID);
  const [bidPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.BID), taskPDA.toBuffer(), payer.publicKey.toBuffer()], PID);
  const [bidEscrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.BID_ESCROW), bidPDA.toBuffer()], PID);
  
  console.log('Task PDA:', taskPDA.toBase58());
  console.log('Profile PDA:', profilePDA.toBase58());
  console.log('Treasury PDA:', treasuryPDA.toBase58());
  console.log('Bid PDA:', bidPDA.toBase58());
  console.log('Bid Escrow PDA:', bidEscrowPDA.toBase58(), '\n');
  
  // Check if existing task needs reset
  const taskAcct = await conn.getAccountInfo(taskPDA);
  if (taskAcct) {
    const data = taskAcct.data;
    let offset = 8 + 32 + 32; // disc + creator + worker
    // Skip strings to find status
    const titleLen = data.readUInt32LE(offset); offset += 4 + titleLen;
    const descLen = data.readUInt32LE(offset); offset += 4 + descLen;
    const skillsCount = data.readUInt32LE(offset);
    for (let i = 0; i < skillsCount; i++) {
      const skillLen = data.readUInt32LE(offset); offset += 4 + skillLen;
    }
    const status = data[offset];
    console.log('Current Task status:', ['Created', 'Assigned', 'InProgress', 'Completed', 'Verified', 'Cancelled'][status]);
    
    if (status === 0) { // Created - can proceed with bid
      console.log('Task is Created, proceeding with bid flow...\n');
    } else {
      console.log('Task is not in Created state, need to reset or use different wallet.\n');
      console.log('⚠️  Each wallet can only have 1 task due to PDA seed constraint.');
      return;
    }
  }
  
  // [1/6] Submit Bid (with bid_escrow)
  console.log('[1/6] Submitting bid...');
  await sendIx('submit_bid', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: bidPDA, isSigner: false, isWritable: true },
    { pubkey: bidEscrowPDA, isSigner: false, isWritable: true },
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], Buffer.concat([
    getDiscriminator('submit_bid'),
    encodeString('I can build this contract in 3 days'),
    encodeU64(100_000),
  ]));
  
  // [2/6] Accept Bid (with bid_escrow)
  console.log('\n[2/6] Accepting bid...');
  await sendIx('accept_bid', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // creator
    { pubkey: bidPDA, isSigner: false, isWritable: true },
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: profilePDA, isSigner: false, isWritable: false }, // worker_profile
    { pubkey: bidEscrowPDA, isSigner: false, isWritable: true }, // bid_escrow (NEW!)
  ], getDiscriminator('accept_bid'));
  
  // [3/6] Start Task
  console.log('\n[3/6] Starting task...');
  await sendIx('start_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // worker
    { pubkey: taskPDA, isSigner: false, isWritable: true },
  ], getDiscriminator('start_task'));
  
  // [4/6] Submit Task
  console.log('\n[4/6] Submitting task...');
  await sendIx('submit_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // worker
    { pubkey: taskPDA, isSigner: false, isWritable: true },
  ], getDiscriminator('submit_task'));
  
  // [5/6] Verify Task (approved: true)
  console.log('\n[5/6] Verifying task (approved)...');
  await sendIx('verify_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // creator
    { pubkey: payer.publicKey, isSigner: false, isWritable: true }, // worker (gets reward)
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: escrowPDA, isSigner: false, isWritable: true },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: profilePDA, isSigner: false, isWritable: true },
  ], Buffer.concat([getDiscriminator('verify_task'), encodeBool(true)]));
  
  // Final state
  console.log('\n=== Final State ===');
  const taskAfter = await conn.getAccountInfo(taskPDA);
  if (taskAfter) {
    const data = taskAfter.data;
    let offset = 8 + 32 + 32;
    const titleLen = data.readUInt32LE(offset); offset += 4 + titleLen;
    const descLen = data.readUInt32LE(offset); offset += 4 + descLen;
    const skillsCount = data.readUInt32LE(offset);
    for (let i = 0; i < skillsCount; i++) {
      const skillLen = data.readUInt32LE(offset); offset += 4 + skillLen;
    }
    const status = data[offset];
    console.log('Task status:', ['Created', 'Assigned', 'InProgress', 'Completed', 'Verified', 'Cancelled'][status]);
  }
  
  const profileAfter = await conn.getAccountInfo(profilePDA);
  if (profileAfter) {
    const data = profileAfter.data;
    const reputation = data.readUInt32LE(32 + 8);
    const tasksCompleted = data.readUInt32LE(32 + 8 + 4);
    console.log('Profile reputation:', reputation);
    console.log('Profile tasks completed:', tasksCompleted);
  }
  
  const balance = await conn.getBalance(payer.publicKey);
  console.log('Wallet SOL:', (balance / LAMPORTS_PER_SOL).toFixed(4));
}

main().catch(console.error);
