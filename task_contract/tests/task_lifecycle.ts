import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TaskContract, IDL } from "../target/idl/task_contract";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("Task Lifecycle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TaskContract as Program<TaskContract>;

  const TASK_SEED = Buffer.from("task");
  const ESCROW_PREFIX = Buffer.from("escrow");
  const TREASURY_SEED = Buffer.from("platform_treasury");
  const AGENT_PROFILE_SEED = Buffer.from("agent_profile");

  let creator: Keypair;
  let worker: Keypair;
  let platformTreasury: PublicKey;
  let task: PublicKey;
  let escrow: PublicKey;
  let workerProfile: PublicKey;

  const REWARD = 2_000_000_000; // 2 SOL
  const VERIFICATION_PERIOD = 7 * 24 * 60 * 60;

  beforeEach(async () => {
    creator = Keypair.generate();
    worker = Keypair.generate();

    await provider.connection.requestAirdrop(creator.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(worker.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await new Promise((r) => setTimeout(r, 500));

    [platformTreasury] = PublicKey.findProgramAddressSync([TREASURY_SEED], program.programId);
    [task] = PublicKey.findProgramAddressSync([TASK_SEED, creator.publicKey.toBuffer()], program.programId);
    [escrow] = PublicKey.findProgramAddressSync([ESCROW_PREFIX, task.toBuffer()], program.programId);
    [workerProfile] = PublicKey.findProgramAddressSync([AGENT_PROFILE_SEED, worker.publicKey.toBuffer()], program.programId);

    // Initialize platform (idempotent)
    try {
      await program.methods
        .initializePlatform()
        .accounts({ authority: provider.wallet.publicKey, treasury: platformTreasury, systemProgram: SystemProgram.programId })
        .rpc();
    } catch (_) {}

    // Initialize worker profile
    try {
      await program.methods
        .initializeWorkerProfile()
        .accounts({ owner: worker.publicKey, workerProfile, systemProgram: SystemProgram.programId })
        .signers([worker])
        .rpc();
    } catch (_) {}
  });

  async function createTask() {
    await program.methods
      .createTask("Test Task", "Test description", [], REWARD, VERIFICATION_PERIOD)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();
  }

  async function fullAssign() {
    await createTask();
    await program.methods
      .assignTask()
      .accounts({ creator: creator.publicKey, worker: worker.publicKey, workerProfile, task })
      .signers([creator])
      .rpc();
  }

  // ─── Creation ─────────────────────────────────────────────────────────────

  it("creates task in Created status with funded escrow", async () => {
    await createTask();

    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.created, true);
    assert.equal(ta.creator.toBase58(), creator.publicKey.toBase58());
    assert.equal(ta.worker.toBase58(), Pubkey.default().toBase58());
    assert.equal(ta.reward.toNumber(), REWARD);
    assert.isNull(ta.submissionTime);
    assert.isNull(ta.verificationTime);

    const ea = await program.account.taskEscrow.fetch(escrow);
    assert.equal(ea.balance.toNumber(), REWARD);
  });

  it("rejects empty title", async () => {
    try {
      await program.methods
        .createTask("", "desc", [], REWARD, VERIFICATION_PERIOD)
        .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId })
        .signers([creator])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "ZeroReward");
    }
  });

  it("rejects zero reward", async () => {
    try {
      await program.methods
        .createTask("Title", "desc", [], 0, VERIFICATION_PERIOD)
        .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId })
        .signers([creator])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "ZeroReward");
    }
  });

  it("sets verification_deadline in the future", async () => {
    await createTask();
    const ta = await program.account.task.fetch(task);
    const clock = await provider.connection.getClock();
    assert.isAbove(ta.verificationDeadline, clock.unixTimestamp);
  });

  // ─── Assignment ───────────────────────────────────────────────────────────

  it("moves task to Assigned status", async () => {
    await fullAssign();
    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.assigned, true);
    assert.equal(ta.worker.toBase58(), worker.publicKey.toBase58());
    assert.isAbove(ta.workerReputationAtAssignment, 0);
  });

  it("rejects self-assignment", async () => {
    await createTask();
    try {
      await program.methods
        .assignTask()
        .accounts({ creator: creator.publicKey, worker: creator.publicKey, workerProfile, task })
        .signers([creator])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "SelfAssignmentNotAllowed");
    }
  });

  it("rejects assignment if task is not in Created state", async () => {
    await fullAssign();
    try {
      await program.methods
        .assignTask()
        .accounts({ creator: creator.publicKey, worker: worker.publicKey, workerProfile, task })
        .signers([creator])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "InvalidTaskState");
    }
  });

  it("requires worker to have all required skills", async () => {
    await program.methods
      .createTask("Skill Task", "desc", ["rust", "python"], REWARD, VERIFICATION_PERIOD)
      .accounts({ creator: creator.publicKey, task, escrow, systemProgram: SystemProgram.programId })
      .signers([creator])
      .rpc();

    try {
      await program.methods
        .assignTask()
        .accounts({ creator: creator.publicKey, worker: worker.publicKey, workerProfile, task })
        .signers([creator])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "MissingRequiredSkill");
    }
  });

  // ─── Start ────────────────────────────────────────────────────────────────

  it("moves task to InProgress", async () => {
    await fullAssign();
    await program.methods
      .startTask()
      .accounts({ worker: worker.publicKey, task })
      .signers([worker])
      .rpc();

    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.inProgress, true);
  });

  it("rejects start by non-worker", async () => {
    await fullAssign();
    const outsider = Keypair.generate();
    await provider.connection.requestAirdrop(outsider.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
    try {
      await program.methods
        .startTask()
        .accounts({ worker: outsider.publicKey, task })
        .signers([outsider])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "NotTaskWorker");
    }
  });

  it("rejects start if task not in Assigned state", async () => {
    await fullAssign();
    // Try to start again
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    try {
      await program.methods
        .startTask()
        .accounts({ worker: worker.publicKey, task })
        .signers([worker])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "InvalidTaskState");
    }
  });

  // ─── Submit ───────────────────────────────────────────────────────────────

  it("moves task to Completed and records submission_time", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();

    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.completed, true);
    assert.isNotNull(ta.submissionTime);
  });

  it("rejects submit by non-worker", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    const outsider = Keypair.generate();
    await provider.connection.requestAirdrop(outsider.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL);
    try {
      await program.methods
        .submitTask()
        .accounts({ worker: outsider.publicKey, task })
        .signers([outsider])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "NotTaskWorker");
    }
  });

  it("rejects submit if task not in InProgress state", async () => {
    await fullAssign();
    try {
      await program.methods
        .submitTask()
        .accounts({ worker: worker.publicKey, task })
        .signers([worker])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "InvalidTaskState");
    }
  });

  // ─── Verify (approve) ─────────────────────────────────────────────────────

  it("moves task to Verified, zeroes escrow, pays worker + fee", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();

    const workerBalBefore = await provider.connection.getBalance(worker.publicKey);
    const treasuryBalBefore = await provider.connection.getBalance(platformTreasury);

    await program.methods
      .verifyTask(true)
      .accounts({ creator: creator.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile })
      .signers([creator])
      .rpc();

    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.verified, true);
    assert.isNotNull(ta.verificationTime);

    const ea = await program.account.taskEscrow.fetch(escrow);
    assert.equal(ea.balance.toNumber(), 0);

    const workerBalAfter = await provider.connection.getBalance(worker.publicKey);
    assert.isAbove(workerBalAfter, workerBalBefore);

    const treasuryBalAfter = await provider.connection.getBalance(platformTreasury);
    assert.isAbove(treasuryBalAfter, treasuryBalBefore);
  });

  it("rejects verification by non-creator", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    try {
      await program.methods
        .verifyTask(true)
        .accounts({ creator: worker.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile })
        .signers([worker])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "NotTaskCreator");
    }
  });

  it("rejects verification when escrow already emptied", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods
      .verifyTask(true)
      .accounts({ creator: creator.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile })
      .signers([creator])
      .rpc();

    try {
      await program.methods
        .verifyTask(true)
        .accounts({ creator: creator.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile })
        .signers([creator])
        .rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "InsufficientEscrowFunds");
    }
  });

  // ─── Verify (reject) ──────────────────────────────────────────────────────

  it("sends task back to InProgress on rejection", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();

    await program.methods
      .verifyTask(false)
      .accounts({ creator: creator.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile })
      .signers([creator])
      .rpc();

    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.inProgress, true);
    assert.isNull(ta.submissionTime);
    assert.isNull(ta.verificationTime);
  });

  // ─── Cancel ──────────────────────────────────────────────────────────────

  it("cancels Created task and refunds escrow to creator", async () => {
    await createTask();
    const creatorBalBefore = await provider.connection.getBalance(creator.publicKey);

    await program.methods.cancelTask().accounts({ creator: creator.publicKey, task, escrow }).signers([creator]).rpc();

    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.cancelled, true);

    const ea = await program.account.taskEscrow.fetch(escrow);
    assert.equal(ea.balance.toNumber(), 0);

    const creatorBalAfter = await provider.connection.getBalance(creator.publicKey);
    assert.isAbove(creatorBalAfter, creatorBalBefore);
  });

  it("cancels Assigned task and refunds", async () => {
    await fullAssign();
    await program.methods.cancelTask().accounts({ creator: creator.publicKey, task, escrow }).signers([creator]).rpc();

    const ta = await program.account.task.fetch(task);
    assert.equal(ta.status.cancelled, true);
  });

  it("cannot cancel InProgress task", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    try {
      await program.methods.cancelTask().accounts({ creator: creator.publicKey, task, escrow }).signers([creator]).rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "InvalidTaskState");
    }
  });

  it("cannot cancel Completed task", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    try {
      await program.methods.cancelTask().accounts({ creator: creator.publicKey, task, escrow }).signers([creator]).rpc();
      assert.fail();
    } catch (e) {
      assert.include(e.toString(), "InvalidTaskState");
    }
  });

  // ─── Reputation & Tier ───────────────────────────────────────────────────

  it("increases worker reputation and tier after approved verification", async () => {
    await fullAssign();
    await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
    await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();

    const profileBefore = await program.account.agentProfile.fetch(workerProfile);
    const repBefore = profileBefore.reputation;

    await program.methods
      .verifyTask(true)
      .accounts({ creator: creator.publicKey, worker: worker.publicKey, task, escrow, treasury: platformTreasury, workerProfile })
      .signers([creator])
      .rpc();

    const profileAfter = await program.account.agentProfile.fetch(workerProfile);
    assert.isAbove(profileAfter.reputation, repBefore);
    assert.equal(profileAfter.tasksCompleted, profileBefore.tasksCompleted + 1);
    assert.equal(profileAfter.totalEarnings.toNumber(), profileBefore.totalEarnings.toNumber() + (REWARD * 8500) / 10000);
  });
});
