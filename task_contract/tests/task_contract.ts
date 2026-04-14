import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TaskContract, IDL } from "../target/idl/task_contract";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";

describe("task_contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TaskContract as Program<TaskContract>;
  const payer = provider.wallet as anchor.Wallet;

  // Test accounts
  let creator: Keypair;
  let worker: Keypair;
  let platformTreasury: PublicKey;
  let task: PublicKey;
  let escrow: PublicKey;
  let workerProfile: PublicKey;

  const TASK_SEED = Buffer.from("task");
  const ESCROW_PREFIX = Buffer.from("escrow");
  const TREASURY_SEED = Buffer.from("platform_treasury");
  const AGENT_PROFILE_SEED = Buffer.from("agent_profile");

  beforeEach(async () => {
    // Create test keypairs
    creator = Keypair.generate();
    worker = Keypair.generate();

    // Airdrop SOL to creator and worker
    const airdropSig = await provider.connection.requestAirdrop(creator.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSig);
    const airdropSig2 = await provider.connection.requestAirdrop(worker.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(airdropSig2);

    // Derive PDAs
    [platformTreasury] = PublicKey.findProgramAddressSync([TREASURY_SEED], program.programId);
    [task] = PublicKey.findProgramAddressSync([TASK_SEED, creator.publicKey.toBuffer()], program.programId);
    [escrow] = PublicKey.findProgramAddressSync([ESCROW_PREFIX, task.toBuffer()], program.programId);
    [workerProfile] = PublicKey.findProgramAddressSync([AGENT_PROFILE_SEED, worker.publicKey.toBuffer()], program.programId);

    // Initialize platform treasury
    try {
      await program.methods
        .initializePlatform()
        .accounts({
          authority: payer.publicKey,
          treasury: platformTreasury,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    } catch (e) {
      // Treasury might already be initialized
    }

    // Create worker profile
    try {
      await program.methods
        .initializeWorkerProfile()
        .accounts({
          owner: worker.publicKey,
          workerProfile: workerProfile,
          systemProgram: SystemProgram.programId,
        })
        .signers([worker])
        .rpc();
    } catch (e) {
      // Profile might already exist
    }
  });

  describe("Platform Initialization", () => {
    it("should initialize platform treasury", async () => {
      const treasuryAccount = await program.account.platformTreasury.fetch(platformTreasury);
      assert.equal(treasuryAccount.authority.toBase58(), payer.publicKey.toBase58());
      assert.equal(treasuryAccount.feeBasisPoints.toNumber(), 1500); // 15%
      assert.equal(treasuryAccount.totalFeesCollected.toNumber(), 0);
    });
  });

  describe("Task Creation", () => {
    it("should create a new task with reward escrow", async () => {
      const reward = 1_000_000_000; // 1 SOL in lamports
      const title = "Test Task";
      const description = "This is a test task description";
      const verificationPeriod = 7 * 24 * 60 * 60; // 7 days

      const beforeBalance = await provider.connection.getBalance(creator.publicKey);

      await program.methods
        .createTask(title, description, [], reward, verificationPeriod)
        .accounts({
          creator: creator.publicKey,
          task: task,
          escrow: escrow,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const taskAccount = await program.account.task.fetch(task);
      assert.equal(taskAccount.creator.toBase58(), creator.publicKey.toBase58());
      assert.equal(taskAccount.title, title);
      assert.equal(taskAccount.description, description);
      assert.equal(taskAccount.reward.toNumber(), reward);
      assert.equal(taskAccount.status.created, true);

      const escrowAccount = await program.account.taskEscrow.fetch(escrow);
      assert.equal(escrowAccount.balance.toNumber(), reward);
    });

    it("should reject zero reward", async () => {
      try {
        await program.methods
          .createTask("Test", "Description", [], 0, 604800)
          .accounts({
            creator: creator.publicKey,
            task: task,
            escrow: escrow,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (e) {
        assert.include(e.toString(), "ZeroReward");
      }
    });
  });

  describe("Task Assignment", () => {
    beforeEach(async () => {
      // Create a task first
      await program.methods
        .createTask("Test Task", "Description", [], 1_000_000_000, 604800)
        .accounts({
          creator: creator.publicKey,
          task: task,
          escrow: escrow,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
    });

    it("should assign task to worker", async () => {
      await program.methods
        .assignTask()
        .accounts({
          creator: creator.publicKey,
          worker: worker.publicKey,
          workerProfile: workerProfile,
          task: task,
        })
        .signers([creator])
        .rpc();

      const taskAccount = await program.account.task.fetch(task);
      assert.equal(taskAccount.worker.toBase58(), worker.publicKey.toBase58());
      assert.equal(taskAccount.status.assigned, true);
    });

    it("should reject self-assignment", async () => {
      try {
        await program.methods
          .assignTask()
          .accounts({
            creator: creator.publicKey,
            worker: creator.publicKey, // Same as creator
            workerProfile: workerProfile,
            task: task,
          })
          .signers([creator])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (e) {
        assert.include(e.toString(), "SelfAssignmentNotAllowed");
      }
    });
  });

  describe("Task Workflow", () => {
    beforeEach(async () => {
      // Create and assign task
      await program.methods
        .createTask("Test Task", "Description", [], 1_000_000_000, 604800)
        .accounts({
          creator: creator.publicKey,
          task: task,
          escrow: escrow,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      await program.methods
        .assignTask()
        .accounts({
          creator: creator.publicKey,
          worker: worker.publicKey,
          workerProfile: workerProfile,
          task: task,
        })
        .signers([creator])
        .rpc();
    });

    it("should start task", async () => {
      await program.methods
        .startTask()
        .accounts({
          worker: worker.publicKey,
          task: task,
        })
        .signers([worker])
        .rpc();

      const taskAccount = await program.account.task.fetch(task);
      assert.equal(taskAccount.status.inProgress, true);
    });

    it("should submit task", async () => {
      // Start first
      await program.methods
        .startTask()
        .accounts({
          worker: worker.publicKey,
          task: task,
        })
        .signers([worker])
        .rpc();

      // Then submit
      await program.methods
        .submitTask()
        .accounts({
          worker: worker.publicKey,
          task: task,
        })
        .signers([worker])
        .rpc();

      const taskAccount = await program.account.task.fetch(task);
      assert.equal(taskAccount.status.completed, true);
      assert.isNotNull(taskAccount.submissionTime);
    });

    it("should verify task and transfer rewards", async () => {
      // Start and submit
      await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
      await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();

      const workerBeforeBalance = await provider.connection.getBalance(worker.publicKey);

      // Verify (approve)
      await program.methods
        .verifyTask(true)
        .accounts({
          creator: creator.publicKey,
          worker: worker.publicKey,
          task: task,
          escrow: escrow,
          treasury: platformTreasury,
          workerProfile: workerProfile,
        })
        .signers([creator])
        .rpc();

      const taskAccount = await program.account.task.fetch(task);
      assert.equal(taskAccount.status.verified, true);

      const escrowAccount = await program.account.taskEscrow.fetch(escrow);
      assert.equal(escrowAccount.balance.toNumber(), 0);
    });

    it("should reject verification by non-creator", async () => {
      await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
      await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();

      try {
        await program.methods
          .verifyTask(true)
          .accounts({
            creator: worker.publicKey, // Wrong!
            worker: worker.publicKey,
            task: task,
            escrow: escrow,
            treasury: platformTreasury,
            workerProfile: workerProfile,
          })
          .signers([worker])
          .rpc();
        assert.fail("Should have thrown error");
      } catch (e) {
        assert.include(e.toString(), "NotTaskCreator");
      }
    });
  });

  describe("Task Cancellation", () => {
    beforeEach(async () => {
      await program.methods
        .createTask("Test Task", "Description", [], 1_000_000_000, 604800)
        .accounts({
          creator: creator.publicKey,
          task: task,
          escrow: escrow,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
    });

    it("should cancel unassigned task and refund", async () => {
      const creatorBeforeBalance = await provider.connection.getBalance(creator.publicKey);

      await program.methods
        .cancelTask()
        .accounts({
          creator: creator.publicKey,
          task: task,
          escrow: escrow,
        })
        .signers([creator])
        .rpc();

      const taskAccount = await program.account.task.fetch(task);
      assert.equal(taskAccount.status.cancelled, true);

      const escrowAccount = await program.account.taskEscrow.fetch(escrow);
      assert.equal(escrowAccount.balance.toNumber(), 0);
    });

    it("should not cancel completed task", async () => {
      await program.methods.startTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();
      await program.methods.submitTask().accounts({ worker: worker.publicKey, task }).signers([worker]).rpc();

      try {
        await program.methods.cancelTask().accounts({ creator: creator.publicKey, task, escrow }).signers([creator]).rpc();
        assert.fail("Should have thrown error");
      } catch (e) {
        assert.include(e.toString(), "InvalidTaskState");
      }
    });
  });
});
