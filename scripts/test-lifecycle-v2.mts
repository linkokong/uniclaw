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

function encodeU64(n: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
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
    return sig;
  } catch (e: any) {
    console.log('   ❌ Error:', e.message?.slice(0, 200) || e);
    return null;
  }
}

async function main() {
  console.log('=== Claw Universe Full Lifecycle (Fixed) ===\n');
  
  // PDAs
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.PLATFORM_TREASURY)], PID);
  const [taskPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.TASK), payer.publicKey.toBuffer()], PID);
  const [escrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ESCROW), taskPDA.toBuffer()], PID);
  const [profilePDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AGENT_PROFILE), payer.publicKey.toBuffer()], PID);
  const [bidPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.BID), taskPDA.toBuffer(), payer.publicKey.toBuffer()], PID);
  const [bidEscrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.BID_ESCROW), bidPDA.toBuffer()], PID);
  
  console.log('Task PDA:', taskPDA.toBase58());
  console.log('Bid PDA:', bidPDA.toBase58());
  console.log('Bid Escrow PDA:', bidEscrowPDA.toBase58(), '\n');
  
  // [1/5] Submit Bid (with bid_escrow!)
  console.log('[1/5] Submitting bid...');
  const bidSig = await sendIx('submit_bid', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // bidder
    { pubkey: bidPDA, isSigner: false, isWritable: true }, // bid
    { pubkey: bidEscrowPDA, isSigner: false, isWritable: true }, // bid_escrow
    { pubkey: taskPDA, isSigner: false, isWritable: true }, // task
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], Buffer.concat([
    getDiscriminator('submit_bid'),
    encodeString('I can build this contract in 3 days'),
    encodeU64(100_000), // 0.0001 SOL minimum deposit
  ]));
  console.log(bidSig ? '✅ Bid submitted: ' + bidSig.slice(0, 20) + '...' : '❌ Bid failed');
  
  // [2/5] Accept Bid
  console.log('\n[2/5] Accepting bid...');
  const acceptSig = await sendIx('accept_bid', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // creator
    { pubkey: bidPDA, isSigner: false, isWritable: true },
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: profilePDA, isSigner: false, isWritable: true },
  ], getDiscriminator('accept_bid'));
  console.log(acceptSig ? '✅ Bid accepted: ' + acceptSig.slice(0, 20) + '...' : '❌ Accept failed');
  
  // [3/5] Start Task
  console.log('\n[3/5] Starting task...');
  const startSig = await sendIx('start_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // worker
    { pubkey: taskPDA, isSigner: false, isWritable: true },
  ], getDiscriminator('start_task'));
  console.log(startSig ? '✅ Task started: ' + startSig.slice(0, 20) + '...' : '❌ Start failed');
  
  // [4/5] Submit Task
  console.log('\n[4/5] Submitting task...');
  const submitSig = await sendIx('submit_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // worker
    { pubkey: taskPDA, isSigner: false, isWritable: true },
  ], getDiscriminator('submit_task'));
  console.log(submitSig ? '✅ Task submitted: ' + submitSig.slice(0, 20) + '...' : '❌ Submit failed');
  
  // [5/5] Verify Task
  console.log('\n[5/5] Verifying task...');
  const verifySig = await sendIx('verify_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // creator
    { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // worker
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: escrowPDA, isSigner: false, isWritable: true },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: profilePDA, isSigner: false, isWritable: true },
  ], getDiscriminator('verify_task'));
  console.log(verifySig ? '✅ Task verified: ' + verifySig.slice(0, 20) + '...' : '❌ Verify failed');
  
  // Check final state
  console.log('\n=== Final State ===');
  const bidAcct = await conn.getAccountInfo(bidPDA);
  console.log('Bid exists:', !!bidAcct);
  
  const bidEscrowAcct = await conn.getAccountInfo(bidEscrowPDA);
  console.log('Bid escrow exists:', !!bidEscrowAcct);
  
  const accounts = await conn.getProgramAccounts(PID);
  console.log('Program accounts:', accounts.length);
  
  const balance = await conn.getBalance(payer.publicKey);
  console.log('Wallet SOL:', (balance / LAMPORTS_PER_SOL).toFixed(4));
}

main().catch(e => console.error('Fatal:', e));
