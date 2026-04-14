import { Connection, Keypair, PublicKey, TransactionMessage, TransactionInstruction, SystemProgram, VersionedTransaction } from '@solana/web3.js';
import * as crypto from 'crypto';
import * as fs from 'fs';

const KEYPAIR_PATH = process.env.HOME + '/.config/solana/devnet-keypair.json';
const keydata = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8'));
const payer = Keypair.fromSecretKey(new Uint8Array(keydata));
const PID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C');
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');

// Manual instruction building - bypass IDL
// Anchor instruction discriminator = sha256('global:<instruction_name>')[0:8]
function getDiscriminator(name: string): Buffer {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

async function main() {
  console.log('Wallet:', payer.publicKey.toBase58());
  
  // PDA for treasury
  const [treasuryPDA] = PublicKey.findProgramAddressSync([Buffer.from('platform_treasury')], PID);
  console.log('Treasury PDA:', treasuryPDA.toBase58());

  // Build initializePlatform instruction
  const discriminator = getDiscriminator('initialize_platform');
  console.log('Discriminator:', discriminator.toString('hex'));

  const ix = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: treasuryPDA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PID,
    data: Buffer.from(discriminator),
  });

  console.log('Instruction built OK');

  // Build transaction
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  const msg = new TransactionMessage({ 
    payerKey: payer.publicKey, 
    recentBlockhash: blockhash, 
    instructions: [ix] 
  }).compileToV0Message();
  
  const tx = new VersionedTransaction(msg);
  tx.sign([payer]);

  console.log('Transaction signed, sending...');
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  console.log('Transaction sent:', sig);
  
  const result = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
  console.log('Confirmed!', result.value.err ? 'Error: ' + JSON.stringify(result.value.err) : 'Success');
  
  // Check treasury account
  const treasuryAccount = await conn.getAccountInfo(treasuryPDA);
  console.log('Treasury account exists:', !!treasuryAccount);
  if (treasuryAccount) {
    console.log('Treasury account size:', treasuryAccount.data.length, 'bytes');
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
});
