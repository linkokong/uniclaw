import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from './src/api/idl.json' with { type: 'json' };

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C');
const TOKEN_MINT = new PublicKey('5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5');

async function main() {
  console.log('=== Part 2: Chain Status Check ===');
  console.log('Program ID:', PROGRAM_ID.toBase58());
  console.log('Token Mint:', TOKEN_MINT.toBase58());
  console.log('RPC:', 'https://api.devnet.solana.com');

  // List program accounts
  try {
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, { limit: 10 });
    console.log('\n[Program Accounts]', accounts.length, 'found');
    accounts.forEach(a => console.log(' -', a.pubkey.toBase58(), '->', a.account.data.length, 'bytes'));
  } catch (e) {
    console.log('\n[Program Accounts] Error:', e.message);
  }

  // Read wallet balance (test wallet)
  const testWallet = new PublicKey('4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T');
  try {
    const bal = await connection.getBalance(testWallet);
    console.log('\n[Test Wallet]', testWallet.toBase58());
    console.log('  SOL balance:', bal / 1e9, 'SOL');
  } catch (e) {
    console.log('\n[Test Wallet] Error:', e.message);
  }

  // Read token balance
  try {
    const tokenAccounts = await connection.getParsedProgramAccounts(
      new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      {
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 32, bytes: testWallet.toBase58() } },
          { memcmp: { offset: 0, bytes: TOKEN_MINT.toBase58() } }
        ]
      }
    );
    console.log('\n[UNICLAW Token Balance for Test Wallet]');
    if (tokenAccounts.length > 0) {
      tokenAccounts.forEach(ta => {
        const parsed = ta.account.data.parsed;
        console.log('  ATA:', ta.pubkey.toBase58());
        console.log('  Amount:', parsed.info.tokenAmount.uiAmount, 'UNICLAW');
      });
    } else {
      console.log('  No UNICLAW tokens found for this wallet');
    }
  } catch (e) {
    console.log('\n[UNICLAW Token] Error:', e.message);
  }

  // Try to get recent blocks to confirm RPC connectivity
  try {
    const slot = await connection.getSlot();
    console.log('\n[Network] Current slot:', slot);
    const block = await connection.getBlock(slot, { maxSupportedTransactionVersion: 0 });
    console.log('  Latest block hash:', block.blockhash.substring(0, 16) + '...');
    console.log('  Block time:', new Date(block.blockTime * 1000).toISOString());
  } catch (e) {
    console.log('\n[Network] Error:', e.message);
  }
}

main().catch(console.error);
