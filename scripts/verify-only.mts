import { Connection, Keypair, PublicKey, TransactionMessage, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as fs from 'fs';

const KEYPAIR_PATH = process.env.HOME + '/.config/solana/devnet-keypair.json';
const keydata = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
const payer = Keypair.fromSecretKey(new Uint8Array(keydata));
const PID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C');
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');

function getDiscriminator(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
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
  console.log('=== Verify Task (Retry) ===\n');
  
  // PDAs
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from('platform_treasury')], PID);
  const [taskPDA] = PublicKey.findProgramAddressSync([Buffer.from('task'), payer.publicKey.toBuffer()], PID);
  const [escrowPDA] = PublicKey.findProgramAddressSync([Buffer.from('escrow'), taskPDA.toBuffer()], PID);
  const [profilePDA] = PublicKey.findProgramAddressSync([Buffer.from('agent_profile'), payer.publicKey.toBuffer()], PID);
  
  console.log('Task:', taskPDA.toBase58());
  console.log('Escrow:', escrowPDA.toBase58());
  console.log('Treasury:', treasuryPDA.toBase58());
  console.log('Profile:', profilePDA.toBase58(), '\n');
  
  // Check balances before
  const escrowBefore = await conn.getAccountInfo(escrowPDA);
  const treasuryBefore = await conn.getAccountInfo(treasuryPDA);
  const profileBefore = await conn.getAccountInfo(profilePDA);
  
  console.log('Before:');
  console.log('  Escrow:', escrowBefore.lamports / 1e9, 'SOL');
  console.log('  Treasury:', treasuryBefore.lamports / 1e9, 'SOL');
  
  // verify_task with approved: true
  await sendIx('verify_task', [
    { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // creator
    { pubkey: payer.publicKey, isSigner: false, isWritable: true }, // worker
    { pubkey: taskPDA, isSigner: false, isWritable: true },
    { pubkey: escrowPDA, isSigner: false, isWritable: true },
    { pubkey: treasuryPDA, isSigner: false, isWritable: true },
    { pubkey: profilePDA, isSigner: false, isWritable: true },
  ], Buffer.concat([getDiscriminator('verify_task'), encodeBool(true)]));
  
  // Check balances after
  const escrowAfter = await conn.getAccountInfo(escrowPDA);
  const treasuryAfter = await conn.getAccountInfo(treasuryPDA);
  const profileAfter = await conn.getAccountInfo(profilePDA);
  
  console.log('\nAfter:');
  console.log('  Escrow:', escrowAfter.lamports / 1e9, 'SOL');
  console.log('  Treasury:', treasuryAfter.lamports / 1e9, 'SOL');
  
  // Check task status
  const taskAfter = await conn.getAccountInfo(taskPDA);
  const status = taskAfter.data[192];
  console.log('  Task status:', ['Created', 'Assigned', 'InProgress', 'Completed', 'Verified', 'Cancelled'][status]);
  
  // Check profile
  const rep = profileAfter.data.readUInt32LE(32 + 8);
  const tasksCompleted = profileAfter.data.readUInt32LE(32 + 8 + 4);
  console.log('  Profile reputation:', rep);
  console.log('  Profile tasks completed:', tasksCompleted);
}

main().catch(console.error);
