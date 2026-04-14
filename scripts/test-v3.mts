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
    console.log(`❌ ${name}: ${e.message?.slice(0, 200) || e}`);
    return null;
  }
}

async function main() {
  console.log('=== Claw Universe - Full Lifecycle Test v3 ===\n');
  console.log('Wallet:', payer.publicKey.toBase58());
  
  // PDAs
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.PLATFORM_TREASURY)], PID);
  const [taskPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.TASK), payer.publicKey.toBuffer()], PID);
  const [escrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ESCROW), taskPDA.toBuffer()], PID);
  const [profilePDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AGENT_PROFILE), payer.publicKey.toBuffer()], PID);
  const [bidPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.BID), taskPDA.toBuffer(), payer.publicKey.toBuffer()], PID);
  const [bidEscrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.BID_ESCROW), bidPDA.toBuffer()], PID);
  
  console.log('Task:', taskPDA.toBase58());
  console.log('Profile:', profilePDA.toBase58());
  console.log('Treasury:', treasuryPDA.toBase58());
  console.log('Bid:', bidPDA.toBase58());
  console.log('Bid Escrow:', bidEscrowPDA.toBase58(), '\n');
  
  // Check if bid already exists
  const bidAcct = await conn.getAccountInfo(bidPDA);
  if (bidAcct) {
    console.log('⚠️  Bid already exists. Skipping submit_bid.\n');
  } else {
    // [1/5] Submit Bid
    console.log('[1/5] Submitting bid...');
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
  }
  
  // [2/5] Accept Bid
  console.log('\n[2/5] Accepting bid...');
  await sendIx('accept_bid', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: bidPDA, isSigner: false, isWritable: true },
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: profilePDA, isSigner: false, isWritable: false },
    { pubkey: bidEscrowPDA, isSigner: false, isWritable: true },
  ], getDiscriminator('accept_bid'));
  
  // [3/5] Start Task
  console.log('\n[3/5] Starting task...');
  await sendIx('start_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: taskPDA, isSigner: false, isWritable: true },
  ], getDiscriminator('start_task'));
  
  // [4/5] Submit Task
  console.log('\n[4/5] Submitting task...');
  await sendIx('submit_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: taskPDA, isSigner: false, isWritable: true },
  ], getDiscriminator('submit_task'));
  
  // [5/5] Verify Task
  console.log('\n[5/5] Verifying task...');
  await sendIx('verify_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: payer.publicKey, isSigner: false, isWritable: true },
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: escrowPDA, isSigner: false, isWritable: true },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: profilePDA, isSigner: false, isWritable: true },
  ], Buffer.concat([getDiscriminator('verify_task'), encodeBool(true)]));
  
  // Final state
  console.log('\n=== Final State ===');
  const profileAfter = await conn.getAccountInfo(profilePDA);
  if (profileAfter) {
    const data = profileAfter.data;
    const reputation = data.readUInt32LE(32 + 8);
    const tasksCompleted = data.readUInt32LE(32 + 8 + 4);
    console.log('Reputation:', reputation);
    console.log('Tasks completed:', tasksCompleted);
  }
  
  const balance = await conn.getBalance(payer.publicKey);
  console.log('Wallet SOL:', (balance / LAMPORTS_PER_SOL).toFixed(4));
}

main().catch(console.error);
