import { Connection, PublicKey } from '@solana/web3.js';

const PID = new PublicKey('EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C');
const conn = new Connection('https://api.devnet.solana.com', 'confirmed');

// PDAs
const TASK_PDA = new PublicKey('8XQLoK9HciM6MZKHVzfPRqZc826vEsBdxM6hn6CgQTbx');
const PROFILE_PDA = new PublicKey('5LHEUz3yxPuwtqW46EorfkcGPJqzV8zyoTeyAA8VkePb');
const BID_PDA = new PublicKey('E1eRoQKMVghKqgS4imb6WaLKFyNP9mMvsMEMT631L1Ch');

function decodePubkey(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.slice(offset, offset + 32));
}

function decodeString(data: Buffer, offset: number): { value: string; nextOffset: number } {
  const len = data.readUInt32LE(offset);
  const value = data.slice(offset + 4, offset + 4 + len).toString('utf8');
  return { value, nextOffset: offset + 4 + len };
}

function decodeVecString(data: Buffer, offset: number): { values: string[]; nextOffset: number } {
  const count = data.readUInt32LE(offset);
  let pos = offset + 4;
  const values: string[] = [];
  for (let i = 0; i < count; i++) {
    const { value, nextOffset } = decodeString(data, pos);
    values.push(value);
    pos = nextOffset;
  }
  return { values, nextOffset: pos };
}

const TASK_STATUS = ['Created', 'Assigned', 'InProgress', 'Completed', 'Verified', 'Cancelled'];
const BID_STATUS = ['Active', 'Accepted', 'Rejected', 'Cancelled', 'Withdrawn'];
const AGENT_TIER = ['Bronze', 'Silver', 'Gold', 'Platinum'];

async function main() {
  console.log('=== Claw Universe On-Chain State ===\n');
  
  // Task
  console.log('📋 Task:', TASK_PDA.toBase58());
  const taskData = (await conn.getAccountInfo(TASK_PDA))?.data;
  if (taskData) {
    let offset = 8; // skip discriminator
    
    const creator = decodePubkey(taskData, offset); offset += 32;
    const worker = decodePubkey(taskData, offset); offset += 32;
    const { value: title, nextOffset: o1 } = decodeString(taskData, offset); offset = o1;
    const { value: description, nextOffset: o2 } = decodeString(taskData, offset); offset = o2;
    const { values: requiredSkills, nextOffset: o3 } = decodeVecString(taskData, offset); offset = o3;
    const status = taskData[offset]; offset += 1;
    const reward = taskData.readBigUInt64LE(offset); offset += 8;
    const verificationDeadline = taskData.readBigInt64LE(offset); offset += 8;
    const submissionTime = taskData.readBigInt64LE(offset); offset += 8; // Option<i64>
    const verificationTime = taskData.readBigInt64LE(offset); offset += 8; // Option<i64>
    const bump = taskData[offset]; offset += 1;
    const createdAt = taskData.readBigInt64LE(offset);
    
    console.log('  Creator:', creator.toBase58());
    console.log('  Worker:', worker.toBase58());
    console.log('  Title:', title);
    console.log('  Description:', description.slice(0, 50) + '...');
    console.log('  Required Skills:', requiredSkills.join(', '));
    console.log('  Status:', TASK_STATUS[status] || status);
    console.log('  Reward:', Number(reward) / 1e9, 'SOL');
    console.log('  Created:', new Date(Number(createdAt) * 1000).toISOString());
  }
  
  // Profile
  console.log('\n👤 Profile:', PROFILE_PDA.toBase58());
  const profileData = (await conn.getAccountInfo(PROFILE_PDA))?.data;
  if (profileData) {
    let offset = 8;
    const owner = decodePubkey(profileData, offset); offset += 32;
    const reputation = profileData.readUInt32LE(offset); offset += 4;
    const tasksCompleted = profileData.readUInt32LE(offset); offset += 4;
    const tasksFailed = profileData.readUInt32LE(offset); offset += 4;
    const tier = profileData[offset]; offset += 1;
    const { values: skills, nextOffset: o4 } = decodeVecString(profileData, offset); offset = o4;
    const totalEarnings = profileData.readBigUInt64LE(offset);
    
    console.log('  Owner:', owner.toBase58());
    console.log('  Reputation:', reputation);
    console.log('  Tasks Completed:', tasksCompleted);
    console.log('  Tasks Failed:', tasksFailed);
    console.log('  Tier:', AGENT_TIER[tier] || tier);
    console.log('  Skills:', skills.join(', '));
    console.log('  Total Earnings:', Number(totalEarnings) / 1e9, 'SOL');
  }
  
  // Bid
  console.log('\n💰 Bid:', BID_PDA.toBase58());
  const bidData = (await conn.getAccountInfo(BID_PDA))?.data;
  if (bidData) {
    let offset = 8;
    const task = decodePubkey(bidData, offset); offset += 32; // task first!
    const bidder = decodePubkey(bidData, offset); offset += 32; // bidder second!
    const { value: proposal, nextOffset: o5 } = decodeString(bidData, offset); offset = o5;
    const amount = bidData.readBigUInt64LE(offset); offset += 8;
    const status = bidData[offset]; offset += 1;
    const createdAt = bidData.readBigInt64LE(offset);
    
    console.log('  Bidder:', bidder.toBase58());
    console.log('  Task:', task.toBase58());
  }
  
  // Program accounts count
  const accounts = await conn.getProgramAccounts(PID);
  console.log('\n📊 Program Accounts:', accounts.length);
}

main().catch(console.error);
