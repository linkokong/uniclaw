import { Connection, Keypair, PublicKey, TransactionMessage, TransactionInstruction, SystemProgram, VersionedTransaction } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as borsh from '@coral-xyz/borsh';

const KEYPAIR_PATH = process.env.HOME + '/.config/solana/devnet-keypair.json';
const keydata = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
const payer = Keypair.fromSecretKey(new Uint8Array(keydata));
const PID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C');
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');

// Seeds from Rust code
const SEEDS = {
  PLATFORM_TREASURY: 'platform_treasury',
  TASK: 'task',
  ESCROW: 'escrow',
  AGENT_PROFILE: 'agent_profile',
  BID: 'bid',
};

// Anchor instruction discriminator
function getDiscriminator(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

// Borsh encoders for instruction args
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

async function sendIx(name: string, ix: TransactionInstruction): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  const msg = new TransactionMessage({ 
    payerKey: payer.publicKey, 
    recentBlockhash: blockhash, 
    instructions: [ix] 
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([payer]);
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  return sig;
}

async function main() {
  console.log('=== Claw Universe On-Chain Initialization ===\n');
  console.log('Wallet:', payer.publicKey.toBase58());
  
  // Check if treasury already exists
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.PLATFORM_TREASURY)], PID);
  const treasuryAcct = await conn.getAccountInfo(treasuryPDA);
  
  if (treasuryAcct) {
    console.log('✅ Platform already initialized (Treasury exists)\n');
  } else {
    console.log('[1/4] Initializing platform...');
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: treasuryPDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PID,
      data: getDiscriminator('initialize_platform'),
    });
    const sig = await sendIx('initialize_platform', ix);
    console.log('✅ Platform initialized:', sig, '\n');
  }
  
  // [2/4] Initialize Worker Profile
  const [profilePDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.AGENT_PROFILE), payer.publicKey.toBuffer()], PID);
  const profileAcct = await conn.getAccountInfo(profilePDA);
  
  if (profileAcct) {
    console.log('✅ Worker profile already exists\n');
  } else {
    console.log('[2/4] Initializing worker profile...');
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PID,
      data: getDiscriminator('initialize_worker_profile'),
    });
    const sig = await sendIx('initialize_worker_profile', ix);
    console.log('✅ Worker profile initialized:', sig, '\n');
  }
  
  // [3/4] Create Task
  const [taskPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.TASK), payer.publicKey.toBuffer()], PID);
  const taskAcct = await conn.getAccountInfo(taskPDA);
  
  if (taskAcct) {
    console.log('✅ Task already exists:', taskPDA.toBase58(), '\n');
  } else {
    console.log('[3/4] Creating test task...');
    const [escrowPDA] = PublicKey.findProgramAddressSync([Buffer.from(SEEDS.ESCROW), taskPDA.toBuffer()], PID);
    
    // create_task args: title, description, required_skills, reward, verification_period
    const title = 'Test Task: Build Smart Contract';
    const description = 'Build a Solana smart contract for task management';
    const requiredSkills = ['rust', 'solana', 'anchor'];
    const reward = 1_000_000_000; // 1 SOL (in lamports)
    const verificationPeriod = 7 * 24 * 60 * 60; // 7 days in seconds
    
    const data = Buffer.concat([
      getDiscriminator('create_task'),
      encodeString(title),
      encodeString(description),
      encodeVecString(requiredSkills),
      encodeU64(reward),
      encodeI64(verificationPeriod),
    ]);
    
    console.log('   Task PDA:', taskPDA.toBase58());
    console.log('   Escrow PDA:', escrowPDA.toBase58());
    console.log('   Data size:', data.length, 'bytes');
    
    const ix = new TransactionInstruction({
      keys: [
        { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // creator
        { pubkey: taskPDA, isSigner: false, isWritable: true }, // task
        { pubkey: escrowPDA, isSigner: false, isWritable: true }, // escrow
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PID,
      data,
    });
    
    try {
      const sig = await sendIx('create_task', ix);
      console.log('✅ Task created:', sig, '\n');
    } catch (e: any) {
      console.log('❌ Task creation failed:', e.message?.slice(0, 200) || e, '\n');
    }
  }
  
  // Summary
  console.log('=== Summary ===');
  const programAccounts = await conn.getProgramAccounts(PID);
  console.log('Program accounts:', programAccounts.length);
  for (const acct of programAccounts) {
    console.log('  ', acct.pubkey.toBase58(), '-', acct.account.data.length, 'bytes');
  }
  
  const balance = await conn.getBalance(payer.publicKey);
  console.log('Wallet SOL:', (balance / 1e9).toFixed(4));
}

main().catch(e => {
  console.error('Fatal error:', e);
});
