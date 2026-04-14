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

async function sendIxDebug(name: string, keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[], data: Buffer): Promise<{ sig: string | null; logs: string[] }> {
  try {
    console.log(`\n--- ${name} ---`);
    console.log('Keys:', keys.map(k => `${k.pubkey.toBase58().slice(0,8)}... (sign:${k.isSigner}, write:${k.isWritable})`).join(', '));
    console.log('Data:', data.toString('hex').slice(0, 32) + '...');
    
    const ix = new TransactionInstruction({ keys, programId: PID, data });
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: [ix] }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([payer]);
    
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    console.log('Sent:', sig);
    
    const result = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    
    // Get transaction details for logs
    const txDetails = await conn.getTransaction(sig, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    const logs = txDetails?.meta?.logMessages || [];
    
    if (result.value.err) {
      console.log('❌ Error:', JSON.stringify(result.value.err));
      logs.forEach(l => console.log('  LOG:', l));
    } else {
      console.log('✅ Success');
    }
    
    return { sig, logs };
  } catch (e: any) {
    console.log('❌ Exception:', e.message?.slice(0, 300));
    return { sig: null, logs: [] };
  }
}

async function main() {
  console.log('=== Debug Accept Bid ===\n');
  
  // PDAs
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.PLATFORM_TREASURY)], PID);
  const [taskPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.TASK), payer.publicKey.toBuffer()], PID);
  const [escrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ESCROW), taskPDA.toBuffer()], PID);
  const [profilePDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AGENT_PROFILE), payer.publicKey.toBuffer()], PID);
  const [bidPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.BID), taskPDA.toBuffer(), payer.publicKey.toBuffer()], PID);
  
  console.log('Task:', taskPDA.toBase58());
  console.log('Profile:', profilePDA.toBase58());
  console.log('Bid:', bidPDA.toBase58());
  console.log('Treasury:', treasuryPDA.toBase58());
  
  // Check bid exists
  const bidAcct = await conn.getAccountInfo(bidPDA);
  console.log('\nBid exists:', !!bidAcct);
  
  if (bidAcct) {
    // Read bid data
    const data = bidAcct.data;
    let offset = 8;
    const bidder = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const task = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const proposalLen = data.readUInt32LE(offset);
    offset += 4;
    const proposal = data.slice(offset, offset + proposalLen).toString('utf8');
    offset += proposalLen;
    const deposit = data.readBigUInt64LE(offset);
    offset += 8;
    const status = data[offset];
    
    console.log('Bid bidder:', bidder.toBase58());
    console.log('Bid task:', task.toBase58());
    console.log('Bid status:', ['Active', 'Accepted', 'Rejected', 'Cancelled', 'Withdrawn'][status]);
    console.log('Bid deposit:', Number(deposit) / 1e9, 'SOL');
  }
  
  // Try accept_bid with correct accounts
  console.log('\n=== Sending accept_bid ===');
  
  // According to Rust: AcceptBid needs: creator, bid, task, treasury, worker_profile
  // worker_profile should be the bidder's profile, not creator's
  // But since we're testing with same wallet, it's the same
  
  const result = await sendIxDebug('accept_bid', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // creator (signer)
    { pubkey: bidPDA, isSigner: false, isWritable: true }, // bid
    { pubkey: taskPDA, isSigner: false, isWritable: true }, // task
    { pubkey: treasuryPDA, isSigner: false, isWritable: true }, // treasury
    { pubkey: profilePDA, isSigner: false, isWritable: false }, // worker_profile
  ], getDiscriminator('accept_bid'));
  
  console.log('\nLogs:');
  result.logs.forEach(l => console.log(' ', l));
  
  // Re-read task
  const taskAfter = await conn.getAccountInfo(taskPDA);
  if (taskAfter) {
    const data = taskAfter.data;
    const status = data[8 + 32 + 32]; // rough offset
    console.log('\nTask status byte:', status);
  }
}

main().catch(console.error);
