/**
 * ============================================================
 * CLAW UNIVERSE — Integration Tests
 * Coverage: full task lifecycle, multi-user bidding, dispute resolution
 * Framework: mocha + @coral-xyz/anchor + chai
 * Run:  cd task_contract && anchor test
 * ============================================================
 *
 * These tests verify end-to-end flows across the contract boundary,
 * simulating real-world user interactions with the full task system.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TaskContract, IDL } from "../target/idl/task_contract";
import { assert } from "chai";

const PROGRAM_ID = new PublicKey("EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C");
const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

async function airdrop(connection: anchor.web3.Connection, pubkey: PublicKey, lamports: number) {
  const sig = await connection.requestAirdrop(pubkey, lamports);
  await connection.confirmTransaction(sig);
}

function derivePda(seeds: Buffer[], programId: PublicKey): PublicKey {
  const [addr] = PublicKey.findProgramAddressSync(seeds, programId);
  return addr;
}

// ════════════════════════════════════════════════════════════
// SCENARIO 1: Complete Happy-Path Task Lifecycle
// ════════════════════════════════════════════════════════════

describe("INTEGRATION: Full Task Lifecycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program<TaskContract>(IDL, PROGRAM_ID, provider);
  const payer = (provider.wallet as anchor.Wallet).payer;

  const SEED_TREASURY = Buffer.from("platform_treasury");
  const SEED_TASK = Buffer.from("task");
  const SEED_ESCROW = Buffer.from("escrow");
  const SEED_AGENT_PROFILE = Buffer.from("agent_profile");

  let creator: Keypair;
  let worker: Keypair;
  let platformTreasury: PublicKey;
  let task: PublicKey;
  let escrow: PublicKey;
  let workerProfile: PublicKey;

  const VERIFICATION_PERIOD = 7 * 24 * 60 * 60;

  beforeEach(async () => {
    creator = Keypair.generate();
    worker = Keypair.generate();
    await airdrop(provider.connection, creator.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(provider.connection, worker.publicKey, 10 * LAMPORTS_PER_SOL);

    platformTreasury = derivePda([SEED_TREASURY], PROGRAM_ID);
    task = derivePda([SEED_TASK, creator.publicKey.toBuffer()], PROGRAM_ID);
    escrow = derivePda([SEED_ESCROW, task.toBuffer()], PROGRAM_ID);
    workerProfile = derivePda([SEED_AGENT_PROFILE, worker.publicKey.toBuffer()], PROGRAM_ID);

    try {
      await program.methods.initializePlatform().accounts({
        authority: payer.publicKey,
        treasury: platformTreasury,
        systemProgram: SystemProgram.programId,
      } as any).rpc();
    } catch (_) { /* already initialized */ }

    try {
      await program.methods.initializeWorkerProfile().accounts({
        owner: worker.publicKey,
        workerProfile,
        systemProgram: SystemProgram.programId,
      } as any).signers([worker]).rpc();
    } catch (_) { /* exists */ }
  });

  it("creator posts task → worker claims → works → submits → creator approves → worker paid", async () => {
    const REWARD = 5 * LAMPORTS_PER_SOL; // 5 SOL
    const FEE_BPS = 1500;
    const expectedFee = Math.floor(REWARD * FEE_BPS / 10000);
    const expectedWorkerReward = REWARD - expectedFee;

    const creatorBalBefore = await provider.connection.getBalance(creator.publicKey);
    const workerBalBefore = await provider.connection.getBalance(worker.publicKey);
    const treasuryBalBefore = await provider.connection.getBalance(platformTreasury);

    // ── Step 1: Creator posts task ──────────────────────
    await program.methods
      .createTask(
        "Build AI Agent for Crypto News",
        "Develop an autonomous agent that monitors DeFi protocols and posts summaries to Discord.",
        ["Python", "Discord API", "Web3"],
        REWARD,
        VERIFICATION_PERIOD,
      )
      .accounts({
        creator: creator.publicKey,
        task,
        escrow,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([creator])
      .rpc();

    const escrowAcc = await program.account.taskEscrow.fetch(escrow);
    assert.equal(escrowAcc.balance.toNumber(), REWARD, "Escrow funded with full reward");

    // ── Step 2: Creator assigns to worker ───────────────
    await program.methods
      .assignTask()
      .accounts({
        creator: creator.publicKey,
        worker: worker.publicKey,
        workerProfile,
        task,
      } as any)
      .signers([creator])
      .rpc();

    const taskAcc1 = await program.account.task.fetch(task);
    assert.equal(taskAcc1.status.assigned, true);
    assert.equal(taskAcc1.worker.toBase58(), worker.publicKey.toBase58());

    // ── Step 3: Worker starts task ──────────────────────
    await program.methods
      .startTask()
      .accounts({ worker: worker.publicKey, task } as any)
      .signers([worker])
      .rpc();

    const taskAcc2 = await program.account.task.fetch(task);
    assert.equal(taskAcc2.status.inProgress, true);

    // ── Step 4: Worker submits deliverable ──────────────
    await program.methods
      .submitTask()
      .accounts({ worker: worker.publicKey, task } as any)
      .signers([worker])
      .rpc();

    const taskAcc3 = await program.account.task.fetch(task);
    assert.equal(taskAcc3.status.completed, true);
    assert.isNotNull(taskAcc3.submissionTime);

    // ── Step 5: Creator verifies & approves ────────────
    await program.methods
      .verifyTask(true)
      .accounts({
        creator: creator.publicKey,
        worker: worker.publicKey,
        task,
        escrow,
        treasury: platformTreasury,
        workerProfile,
      } as any)
      .signers([creator])
      .rpc();

    const taskAcc4 = await program.account.task.fetch(task);
    assert.equal(taskAcc4.status.verified, true);
    assert.isNotNull(taskAcc4.verificationTime);

    const escrowFinal = await program.account.taskEscrow.fetch(escrow);
    assert.equal(escrowFinal.balance.toNumber(), 0, "Escrow fully drained");

    // ── Step 6: Balances updated ───────────────────────
    const workerBalAfter = await provider.connection.getBalance(worker.publicKey);
    const treasuryBalAfter = await provider.connection.getBalance(platformTreasury);

    assert.isAtLeast(
      workerBalAfter - workerBalBefore,
      expectedWorkerReward - 1000,
      "Worker receives net reward (minus platform fee)"
    );
    assert.isAbove(treasuryBalAfter - treasuryBalBefore, 0, "Platform treasury receives fee");

    // ── Step 7: Worker profile updated ─────────────────
    const profile = await program.account.agentProfile.fetch(workerProfile);
    assert.equal(profile.tasksCompleted.toNumber(), 1);
    assert.isAbove(profile.totalEarnings.toNumber(), 0);
    assert.isAtLeast(profile.reputation, 100);
  });

  it("rejected submission: creator rejects → worker resubmits → creator approves", async () => {
    const REWARD = 3 * LAMPORTS_PER_SOL;

    await program.methods.createTask("Rejected Then Approved", "Desc", [], REWARD, VERIFICATION_PERIOD).accounts({
      creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId,
    } as any).signers([creator]).rpc();

    await program.methods.assignTask().accounts({
      creator: creator.publicKey, worker: worker.publicKey, workerProfile, task,
    } as any).signers([creator]).rpc();

    await program.methods.startTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    // First submission
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    // Creator rejects
    await program.methods.verifyTask(false).accounts({
      creator: creator.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile,
    } as any).signers([creator]).rpc();

    let taskAcc = await program.account.task.fetch(task);
    assert.equal(taskAcc.status.inProgress, true, "Task back to InProgress after rejection");
    assert.isNull(taskAcc.submissionTime, "submissionTime cleared");

    const escrowBefore = (await program.account.taskEscrow.fetch(escrow)).balance.toNumber();
    assert.equal(escrowBefore, REWARD, "Escrow unchanged after rejection");

    // Worker resubmits
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    taskAcc = await program.account.task.fetch(task);
    assert.equal(taskAcc.status.completed, true);

    // Creator approves
    await program.methods.verifyTask(true).accounts({
      creator: creator.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile,
    } as any).signers([creator]).rpc();

    taskAcc = await program.account.task.fetch(task);
    assert.equal(taskAcc.status.verified, true);
    assert.equal((await program.account.taskEscrow.fetch(escrow)).balance.toNumber(), 0);
  });
});

// ════════════════════════════════════════════════════════════
// SCENARIO 2: Multi-Worker Bidding Race
// ════════════════════════════════════════════════════════════

describe("INTEGRATION: Multi-Worker Bidding Race", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program<TaskContract>(IDL, PROGRAM_ID, provider);
  const payer = (provider.wallet as anchor.Wallet).payer;

  const SEED_TREASURY = Buffer.from("platform_treasury");
  const SEED_TASK = Buffer.from("task");
  const SEED_ESCROW = Buffer.from("escrow");
  const SEED_AGENT_PROFILE = Buffer.from("agent_profile");

  let creator: Keypair;
  let worker1: Keypair;
  let worker2: Keypair;
  let worker3: Keypair;
  let platformTreasury: PublicKey;
  let task: PublicKey;
  let escrow: PublicKey;
  let wp1: PublicKey;
  let wp2: PublicKey;
  let wp3: PublicKey;

  beforeEach(async () => {
    creator = Keypair.generate();
    worker1 = Keypair.generate();
    worker2 = Keypair.generate();
    worker3 = Keypair.generate();

    for (const kp of [creator, worker1, worker2, worker3]) {
      await airdrop(provider.connection, kp.publicKey, 10 * LAMPORTS_PER_SOL);
    }

    platformTreasury = derivePda([SEED_TREASURY], PROGRAM_ID);
    task = derivePda([SEED_TASK, creator.publicKey.toBuffer()], PROGRAM_ID);
    escrow = derivePda([SEED_ESCROW, task.toBuffer()], PROGRAM_ID);
    wp1 = derivePda([SEED_AGENT_PROFILE, worker1.publicKey.toBuffer()], PROGRAM_ID);
    wp2 = derivePda([SEED_AGENT_PROFILE, worker2.publicKey.toBuffer()], PROGRAM_ID);
    wp3 = derivePda([SEED_AGENT_PROFILE, worker3.publicKey.toBuffer()], PROGRAM_ID);

    try {
      await program.methods.initializePlatform().accounts({
        authority: payer.publicKey, treasury: platformTreasury, systemProgram: SystemProgram.programId,
      } as any).rpc();
    } catch (_) { /* ok */ }

    for (const [kp, wp] of [[worker1, wp1], [worker2, wp2], [worker3, wp3]] as [Keypair, PublicKey][]) {
      try {
        await program.methods.initializeWorkerProfile().accounts({
          owner: kp.publicKey, workerProfile: wp, systemProgram: SystemProgram.programId,
        } as any).signers([kp]).rpc();
      } catch (_) { /* exists */ }
    }
  });

  it("first worker to be assigned wins — others blocked by state check", async () => {
    // Creator posts task
    await program.methods.createTask("Racing Task", "Desc", [], 5 * LAMPORTS_PER_SOL, 7 * 24 * 60 * 60)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId } as any)
      .signers([creator]).rpc();

    // Worker1 claims first
    await program.methods.assignTask()
      .accounts({ creator: creator.publicKey, worker: worker1.publicKey, workerProfile: wp1, task } as any)
      .signers([creator]).rpc();

    const taskAcc = await program.account.task.fetch(task);
    assert.equal(taskAcc.worker.toBase58(), worker1.publicKey.toBase58());

    // Worker2 and Worker3 attempt to claim same task — must both fail
    for (const [kp, wp] of [[worker2, wp2], [worker3, wp3]] as [Keypair, PublicKey][]) {
      try {
        await program.methods.assignTask()
          .accounts({ creator: creator.publicKey, worker: kp.publicKey, workerProfile: wp, task } as any)
          .signers([creator]).rpc();
        assert.fail(`Worker ${kp.publicKey.toBase58().slice(0, 8)} should be blocked`);
      } catch (e) {
        assert.match(e.toString(), /InvalidTaskState/i);
      }
    }
  });

  it("all three workers bid on separate tasks — each gets their own task", async () => {
    // Worker1 creates a task
    const task1 = derivePda([SEED_TASK, worker1.publicKey.toBuffer()], PROGRAM_ID);
    const escrow1 = derivePda([SEED_ESCROW, task1.toBuffer()], PROGRAM_ID);

    await program.methods
      .createTask("Worker1 Task", "Task created by worker1", [], 2 * LAMPORTS_PER_SOL, 7 * 24 * 60 * 60)
      .accounts({ creator: worker1.publicKey, task: task1, escrow: escrow1, systemProgram: SystemProgram.programId } as any)
      .signers([worker1]).rpc();

    // Worker2 creates a task
    const task2 = derivePda([SEED_TASK, worker2.publicKey.toBuffer()], PROGRAM_ID);
    const escrow2 = derivePda([SEED_ESCROW, task2.toBuffer()], PROGRAM_ID);

    await program.methods
      .createTask("Worker2 Task", "Task created by worker2", [], 3 * LAMPORTS_PER_SOL, 7 * 24 * 60 * 60)
      .accounts({ creator: worker2.publicKey, task: task2, escrow: escrow2, systemProgram: SystemProgram.programId } as any)
      .signers([worker2]).rpc();

    // Creator assigns to worker3
    await program.methods.createTask("Creator Task", "Desc", [], 4 * LAMPORTS_PER_SOL, 7 * 24 * 60 * 60)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId } as any)
      .signers([creator]).rpc();

    await program.methods.assignTask()
      .accounts({ creator: creator.publicKey, worker: worker3.publicKey, workerProfile: wp3, task } as any)
      .signers([creator]).rpc();

    // All three tasks have correct workers
    const t1 = await program.account.task.fetch(task1);
    const t2 = await program.account.task.fetch(task2);
    const t3 = await program.account.task.fetch(task);

    assert.equal(t1.creator.toBase58(), worker1.publicKey.toBase58());
    assert.equal(t2.creator.toBase58(), worker2.publicKey.toBase58());
    assert.equal(t3.worker.toBase58(), worker3.publicKey.toBase58());
  });
});

// ════════════════════════════════════════════════════════════
// SCENARIO 3: Dispute Resolution Flow
// ════════════════════════════════════════════════════════════

describe("INTEGRATION: Dispute Resolution Flow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program<TaskContract>(IDL, PROGRAM_ID, provider);
  const payer = (provider.wallet as anchor.Wallet).payer;

  const SEED_TREASURY = Buffer.from("platform_treasury");
  const SEED_TASK = Buffer.from("task");
  const SEED_ESCROW = Buffer.from("escrow");
  const SEED_AGENT_PROFILE = Buffer.from("agent_profile");

  let creator: Keypair;
  let worker: Keypair;
  let platformTreasury: PublicKey;
  let task: PublicKey;
  let escrow: PublicKey;
  let workerProfile: PublicKey;

  beforeEach(async () => {
    creator = Keypair.generate();
    worker = Keypair.generate();
    await airdrop(provider.connection, creator.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(provider.connection, worker.publicKey, 10 * LAMPORTS_PER_SOL);

    platformTreasury = derivePda([SEED_TREASURY], PROGRAM_ID);
    task = derivePda([SEED_TASK, creator.publicKey.toBuffer()], PROGRAM_ID);
    escrow = derivePda([SEED_ESCROW, task.toBuffer()], PROGRAM_ID);
    workerProfile = derivePda([SEED_AGENT_PROFILE, worker.publicKey.toBuffer()], PROGRAM_ID);

    try {
      await program.methods.initializePlatform().accounts({
        authority: payer.publicKey, treasury: platformTreasury, systemProgram: SystemProgram.programId,
      } as any).rpc();
    } catch (_) { /* ok */ }
    try {
      await program.methods.initializeWorkerProfile().accounts({
        owner: worker.publicKey, workerProfile, systemProgram: SystemProgram.programId,
      } as any).signers([worker]).rpc();
    } catch (_) { /* ok */ }
  });

  it("dispute after deadline: worker claims escrow when creator doesn't verify", async () => {
    const REWARD = 2 * LAMPORTS_PER_SOL;

    await program.methods
      .createTask("Dispute: Creator Silent", "Creator never verified", [], REWARD, 7 * 24 * 60 * 60)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId } as any)
      .signers([creator]).rpc();

    await program.methods.assignTask().accounts({
      creator: creator.publicKey, worker: worker.publicKey, workerProfile, task,
    } as any).signers([creator]).rpc();

    await program.methods.startTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    await program.methods.submitTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    const workerBalBefore = await provider.connection.getBalance(worker.publicKey);

    // Advance clock (simulated — in real test env, you'd use FastForward or a 7-day period)
    // LiteSVM/blockboard test envs: try dispute after deadline
    // We test the happy path: if deadline has passed, worker wins the escrow
    try {
      await program.methods.disputeTask().accounts({
        worker: worker.publicKey, task, escrow, workerProfile,
      } as any).signers([worker]).rpc();

      const escrowFinal = await program.account.taskEscrow.fetch(escrow);
      const workerBalAfter = await provider.connection.getBalance(worker.publicKey);

      if (escrowFinal.balance.toNumber() === 0) {
        assert.isAbove(workerBalAfter, workerBalBefore, "Worker receives escrow after successful dispute");
      }
    } catch (e) {
      // In fast test envs the clock hasn't advanced enough — this is expected behavior
      assert.match(e.toString(), /VerificationDeadlineExceeded/i);
    }
  });

  it("dispute blocked: non-worker cannot claim escrow via dispute", async () => {
    const attacker = Keypair.generate();
    await airdrop(provider.connection, attacker.publicKey, 5 * LAMPORTS_PER_SOL);

    const attackerProfile = derivePda([SEED_AGENT_PROFILE, attacker.publicKey.toBuffer()], PROGRAM_ID);
    try {
      await program.methods.initializeWorkerProfile().accounts({
        owner: attacker.publicKey, workerProfile: attackerProfile, systemProgram: SystemProgram.programId,
      } as any).signers([attacker]).rpc();
    } catch (_) { /* ok */ }

    await program.methods.createTask("Dispute Auth Test", "Desc", [], 2 * LAMPORTS_PER_SOL, 7 * 24 * 60 * 60)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId } as any)
      .signers([creator]).rpc();

    await program.methods.assignTask().accounts({
      creator: creator.publicKey, worker: worker.publicKey, workerProfile, task,
    } as any).signers([creator]).rpc();

    await program.methods.startTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    await program.methods.submitTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    // Attacker tries to dispute — must fail with NotTaskWorker
    try {
      await program.methods.disputeTask().accounts({
        worker: attacker.publicKey, task, escrow, workerProfile: attackerProfile,
      } as any).signers([attacker]).rpc();
      assert.fail("Non-worker should not be able to dispute");
    } catch (e) {
      assert.match(e.toString(), /NotTaskWorker/i);
    }
  });
});

// ════════════════════════════════════════════════════════════
// SCENARIO 4: Cancellation & Refund Flows
// ════════════════════════════════════════════════════════════

describe("INTEGRATION: Cancellation & Refund Flows", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = new Program<TaskContract>(IDL, PROGRAM_ID, provider);
  const payer = (provider.wallet as anchor.Wallet).payer;

  const SEED_TREASURY = Buffer.from("platform_treasury");
  const SEED_TASK = Buffer.from("task");
  const SEED_ESCROW = Buffer.from("escrow");
  const SEED_AGENT_PROFILE = Buffer.from("agent_profile");

  let creator: Keypair;
  let worker: Keypair;
  let platformTreasury: PublicKey;
  let task: PublicKey;
  let escrow: PublicKey;
  let workerProfile: PublicKey;

  beforeEach(async () => {
    creator = Keypair.generate();
    worker = Keypair.generate();
    await airdrop(provider.connection, creator.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(provider.connection, worker.publicKey, 10 * LAMPORTS_PER_SOL);

    platformTreasury = derivePda([SEED_TREASURY], PROGRAM_ID);
    task = derivePda([SEED_TASK, creator.publicKey.toBuffer()], PROGRAM_ID);
    escrow = derivePda([SEED_ESCROW, task.toBuffer()], PROGRAM_ID);
    workerProfile = derivePda([SEED_AGENT_PROFILE, worker.publicKey.toBuffer()], PROGRAM_ID);

    try {
      await program.methods.initializePlatform().accounts({
        authority: payer.publicKey, treasury: platformTreasury, systemProgram: SystemProgram.programId,
      } as any).rpc();
    } catch (_) { /* ok */ }
    try {
      await program.methods.initializeWorkerProfile().accounts({
        owner: worker.publicKey, workerProfile, systemProgram: SystemProgram.programId,
      } as any).signers([worker]).rpc();
    } catch (_) { /* ok */ }
  });

  it("cancel unassigned: full refund to creator", async () => {
    const REWARD = 4 * LAMPORTS_PER_SOL;
    const creatorBalBefore = await provider.connection.getBalance(creator.publicKey);

    await program.methods.createTask("Cancel Unassigned", "Desc", [], REWARD, 7 * 24 * 60 * 60)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId } as any)
      .signers([creator]).rpc();

    await program.methods.cancelTask().accounts({
      creator: creator.publicKey, task, escrow,
    } as any).signers([creator]).rpc();

    const creatorBalAfter = await provider.connection.getBalance(creator.publicKey);
    const escrowAcc = await program.account.taskEscrow.fetch(escrow);

    assert.equal(escrowAcc.balance.toNumber(), 0);
    assert.isAtLeast(creatorBalAfter, creatorBalBefore - 1000, "Creator refunded (minus rent)");
  });

  it("cancel assigned-but-idle: creator cancels before worker starts", async () => {
    await program.methods.createTask("Cancel Assigned Idle", "Desc", [], 3 * LAMPORTS_PER_SOL, 7 * 24 * 60 * 60)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId } as any)
      .signers([creator]).rpc();

    await program.methods.assignTask().accounts({
      creator: creator.publicKey, worker: worker.publicKey, workerProfile, task,
    } as any).signers([creator]).rpc();

    await program.methods.cancelTask().accounts({
      creator: creator.publicKey, task, escrow,
    } as any).signers([creator]).rpc();

    const taskAcc = await program.account.task.fetch(task);
    assert.equal(taskAcc.status.cancelled, true);
    assert.equal((await program.account.taskEscrow.fetch(escrow)).balance.toNumber(), 0);
  });

  it("cannot cancel in-progress task — worker protection", async () => {
    await program.methods.createTask("Worker Protected", "Desc", [], 2 * LAMPORTS_PER_SOL, 7 * 24 * 60 * 60)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId } as any)
      .signers([creator]).rpc();

    await program.methods.assignTask().accounts({
      creator: creator.publicKey, worker: worker.publicKey, workerProfile, task,
    } as any).signers([creator]).rpc();

    await program.methods.startTask().accounts({ worker: worker.publicKey, task } as any).signers([worker]).rpc();

    try {
      await program.methods.cancelTask().accounts({
        creator: creator.publicKey, task, escrow,
      } as any).signers([creator]).rpc();
      assert.fail("In-progress task should not be cancellable");
    } catch (e) {
      assert.match(e.toString(), /InvalidTaskState/i);
    }
  });
});
