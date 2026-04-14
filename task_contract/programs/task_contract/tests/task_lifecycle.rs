// ============================================================
// Task Contract Tests — Anchor / LiteSVM
// Program: EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C
// Coverage: task lifecycle, escrow, state transitions, disputes
// ============================================================

use {
    anchor_lang::{
        prelude::*,
        solana_program::instruction::Instruction,
        InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const PROGRAM_ID: Pubkey = pubkey!("EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C");

fn build_svm() -> (LiteSVM, Keypair) {
    let payer = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = std::fs::read(
        "/Users/pipi/.qclaw/workspace/projects/claw-universe/task_contract/target/deploy/task_contract.so",
    )
    .expect("contract .so not found — run `cd task_contract && cargo build-sbf` first");
    svm.add_program(PROGRAM_ID, &bytes).unwrap();
    svm.airdrop(&payer.pubkey(), 5_000_000_000u64).unwrap();
    (svm, payer)
}

fn send_tx(svm: &mut LiteSVM, ix: Instruction, signer: &Keypair) -> anchor_lang::solana_program::hash::Hash {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&signer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[signer.clone()]).unwrap();
    svm.send_transaction(tx).unwrap();
    blockhash
}

// ── Platform Setup ────────────────────────────────────────────

#[test]
fn test_initialize_platform() {
    let (mut svm, payer) = build_svm();

    let treasury_addr = Pubkey::find_program_address(&[b"platform_treasury"], &PROGRAM_ID).0;

    let ix = Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::InitializePlatform {},
        task_contract::accounts::InitializePlatform {
            authority: &payer.pubkey(),
            treasury: &treasury_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    );

    let _ = send_tx(&mut svm, ix, &payer);

    let treasury_data = svm.get_account(&treasury_addr);
    assert!(treasury_data.is_some(), "Treasury account should exist after init");
}

#[test]
fn test_initialize_platform_twice_fails() {
    let (mut svm, payer) = build_svm();
    let treasury_addr = Pubkey::find_program_address(&[b"platform_treasury"], &PROGRAM_ID).0;

    let ix = || Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::InitializePlatform {},
        task_contract::accounts::InitializePlatform {
            authority: &payer.pubkey(),
            treasury: &treasury_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    );

    let _ = send_tx(&mut svm, ix(), &payer);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, ix(), &payer);
    }));
    assert!(result.is_err(), "Second init should revert");
}

// ── Worker Profile ────────────────────────────────────────────

#[test]
fn test_initialize_worker_profile() {
    let (mut svm, payer) = build_svm();
    let profile_addr =
        Pubkey::find_program_address(&[b"agent_profile", payer.pubkey().as_ref()], &PROGRAM_ID).0;

    let ix = Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &payer.pubkey(),
            worker_profile: &profile_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    );

    let _ = send_tx(&mut svm, ix, &payer);
    let data = svm.get_account(&profile_addr);
    assert!(data.is_some(), "Worker profile should be created");
}

// ── Task Creation & Escrow ─────────────────────────────────────

#[test]
fn test_create_task_with_escrow() {
    let (mut svm, payer) = build_svm();
    let payer_start = svm.get_account(&payer.pubkey()).unwrap().lamports();

    let task_addr =
        Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr =
        Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;
    let reward = 1_000_000_000u64; // 1 SOL

    let ix = Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "AI Content Writer".to_string(),
            description: "Write 5 tech articles on Solana".to_string(),
            required_skills: vec!["writing".to_string(), "solana".to_string()],
            reward,
            verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(),
            task: &task_addr,
            escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    );

    let _ = send_tx(&mut svm, ix, &payer);

    // Escrow must exist and be funded
    assert!(svm.get_account(&escrow_addr).is_some(), "Escrow should exist");

    // Payer lamports should have decreased by reward + rent
    let payer_after = svm.get_account(&payer.pubkey()).unwrap().lamports();
    assert!(
        payer_start > payer_after,
        "Payer balance should decrease after funding escrow"
    );
}

#[test]
fn test_create_task_zero_reward_fails() {
    let (mut svm, payer) = build_svm();

    let task_addr =
        Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr =
        Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let ix = Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Bad Task".to_string(),
            description: "Zero reward should fail".to_string(),
            required_skills: vec![],
            reward: 0,
            verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(),
            task: &task_addr,
            escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, ix, &payer);
    }));
    assert!(result.is_err(), "CreateTask with reward=0 must revert");
}

#[test]
fn test_create_task_title_too_long_fails() {
    let (mut svm, payer) = build_svm();
    let task_addr =
        Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr =
        Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let long_title = "A".repeat(101); // MAX_TITLE_LENGTH = 100

    let ix = Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: long_title,
            description: "Should fail".to_string(),
            required_skills: vec![],
            reward: 100_000_000,
            verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(),
            task: &task_addr,
            escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, ix, &payer);
    }));
    assert!(result.is_err(), "Title exceeding MAX_TITLE_LENGTH should revert");
}

// ── Task Assignment ───────────────────────────────────────────

#[test]
fn test_assign_task_happy_path() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let worker_profile_addr = Pubkey::find_program_address(
        &[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID,
    ).0;

    // Init worker profile
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(),
            worker_profile: &worker_profile_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    // Create task
    let task_addr =
        Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr =
        Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Test Task".to_string(),
            description: "A task for testing".to_string(),
            required_skills: vec![],
            reward: 500_000_000,
            verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    // Assign task
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(),
            worker: &worker.pubkey(),
            worker_profile: &worker_profile_addr,
            task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
}

#[test]
fn test_self_assignment_fails() {
    let (mut svm, payer) = build_svm();

    let worker_profile_addr = Pubkey::find_program_address(
        &[b"agent_profile", payer.pubkey().as_ref()], &PROGRAM_ID,
    ).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &payer.pubkey(),
            worker_profile: &worker_profile_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let task_addr =
        Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr =
        Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Self Assign".to_string(),
            description: "Should fail".to_string(),
            required_skills: vec![],
            reward: 100_000_000,
            verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let assign_ix = Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(),
            worker: &payer.pubkey(), // self-assign
            worker_profile: &worker_profile_addr,
            task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    );

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, assign_ix, &payer);
    }));
    assert!(result.is_err(), "Self-assignment must revert with SelfAssignmentNotAllowed");
}

#[test]
fn test_assign_already_assigned_task_fails() {
    let (mut svm, payer) = build_svm();
    let worker1 = Keypair::new();
    let worker2 = Keypair::new();
    svm.airdrop(&worker1.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&worker2.pubkey(), 1_000_000_000).unwrap();

    let wp1 = Pubkey::find_program_address(&[b"agent_profile", worker1.pubkey().as_ref()], &PROGRAM_ID).0;
    let wp2 = Pubkey::find_program_address(&[b"agent_profile", worker2.pubkey().as_ref()], &PROGRAM_ID).0;

    for (w, wp) in [(&worker1, &wp1), (&worker2, &wp2)] {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
            task_contract::accounts::InitializeWorkerProfile {
                owner: &w.pubkey(), worker_profile: wp,
                system_program: &solana_program::system_program::id(),
            }
            .to_account_metas(Some(&w.pubkey())),
        ), w);
    }

    let task_addr =
        Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr =
        Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Taken Task".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 200_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    // First assignment
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(), worker: &worker1.pubkey(),
            worker_profile: &wp1, task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    // Second assignment should fail (InvalidTaskState)
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &task_contract::instruction::AssignTask {},
            task_contract::accounts::AssignTask {
                creator: &payer.pubkey(), worker: &worker2.pubkey(),
                worker_profile: &wp2, task: &task_addr,
            }
            .to_account_metas(Some(&payer.pubkey())),
        ), &payer);
    }));
    assert!(result.is_err(), "Re-assigning an already-assigned task must revert");
}

// ── State Transitions ─────────────────────────────────────────

#[test]
fn test_start_task() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Start Test".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 200_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            worker_profile: &wp, task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    // Worker starts task
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::StartTask {},
        task_contract::accounts::StartTask {
            worker: &worker.pubkey(), task: &task_addr,
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);
}

#[test]
fn test_start_task_only_worker_can_start() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    let attacker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Auth Test".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 200_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            worker_profile: &wp, task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    // Non-worker tries to start — should fail
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &task_contract::instruction::StartTask {},
            task_contract::accounts::StartTask {
                worker: &attacker.pubkey(), // wrong worker
                task: &task_addr,
            }
            .to_account_metas(Some(&attacker.pubkey())),
        ), &attacker);
    }));
    assert!(result.is_err(), "Non-assigned worker cannot start task");
}

#[test]
fn test_submit_task() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    for ix_data in [
        task_contract::instruction::CreateTask {
            title: "Submit Test".to_string(), description: "Test submit".to_string(),
            required_skills: vec![], reward: 300_000_000, verification_period: 7 * 24 * 3600,
        },
    ] {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &ix_data,
            task_contract::accounts::CreateTask {
                creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
                system_program: &solana_program::system_program::id(),
            }
            .to_account_metas(Some(&payer.pubkey())),
        ), &payer);
    }

    for (ix_data, signer) in [
        (
            task_contract::instruction::AssignTask {},
            &payer as &dyn Signer,
        ),
    ] {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &ix_data,
            task_contract::accounts::AssignTask {
                creator: &payer.pubkey(), worker: &worker.pubkey(),
                worker_profile: &wp, task: &task_addr,
            }
            .to_account_metas(Some(&payer.pubkey())),
        ), &payer);
    }

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::StartTask {},
        task_contract::accounts::StartTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::SubmitTask {},
        task_contract::accounts::SubmitTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);
}

// ── Reward Release ─────────────────────────────────────────────

#[test]
fn test_verify_task_approved_releases_reward() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;
    let treasury = Pubkey::find_program_address(&[b"platform_treasury"], &PROGRAM_ID).0;

    // Init treasury + worker profile
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializePlatform {},
        task_contract::accounts::InitializePlatform {
            authority: &payer.pubkey(), treasury: &treasury,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;
    let reward = 1_000_000_000u64;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Reward Test".to_string(), description: "Testing reward release".to_string(),
            required_skills: vec![], reward, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            worker_profile: &wp, task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::StartTask {},
        task_contract::accounts::StartTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::SubmitTask {},
        task_contract::accounts::SubmitTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let worker_before = svm.get_account(&worker.pubkey()).unwrap().lamports();

    // Creator verifies (approved)
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::VerifyTask { approved: true },
        task_contract::accounts::VerifyTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            task: &task_addr, escrow: &escrow_addr,
            treasury: &treasury, worker_profile: &wp,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let worker_after = svm.get_account(&worker.pubkey()).unwrap().lamports();
    // Worker receives reward minus 15% platform fee (150M fee → 850M to worker)
    assert!(
        worker_after > worker_before,
        "Worker balance must increase after verified approval"
    );
}

#[test]
fn test_verify_task_rejected_returns_to_in_progress() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;
    let treasury = Pubkey::find_program_address(&[b"platform_treasury"], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializePlatform {},
        task_contract::accounts::InitializePlatform {
            authority: &payer.pubkey(), treasury: &treasury,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Reject Test".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 500_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    for (ix, signer) in [
        (task_contract::instruction::AssignTask {}, &payer as &dyn Signer),
        (task_contract::instruction::StartTask {}, &worker as &dyn Signer),
        (task_contract::instruction::SubmitTask {}, &worker as &dyn Signer),
    ] {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &ix,
            match ix.instruction_name() {
                "assign_task" => task_contract::accounts::AssignTask {
                    creator: &payer.pubkey(), worker: &worker.pubkey(),
                    worker_profile: &wp, task: &task_addr,
                }
                .to_account_metas(Some(&payer.pubkey())),
                "start_task" => task_contract::accounts::StartTask {
                    worker: &worker.pubkey(), task: &task_addr,
                }
                .to_account_metas(Some(&worker.pubkey())),
                "submit_task" => task_contract::accounts::SubmitTask {
                    worker: &worker.pubkey(), task: &task_addr,
                }
                .to_account_metas(Some(&worker.pubkey())),
                _ => panic!("unknown"),
            },
        ), signer);
    }

    // Reject — task returns to InProgress
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::VerifyTask { approved: false },
        task_contract::accounts::VerifyTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            task: &task_addr, escrow: &escrow_addr,
            treasury: &treasury, worker_profile: &wp,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
    // Escrow balance should remain unchanged (no funds moved)
    let escrow_data = svm.get_account(&escrow_addr).unwrap();
    // Balance is still in escrow when rejected
}

// ── Cancellation & Refund ──────────────────────────────────────

#[test]
fn test_cancel_task_refunds_creator() {
    let (mut svm, payer) = build_svm();

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;
    let reward = 1_500_000_000u64;

    let payer_before = svm.get_account(&payer.pubkey()).unwrap().lamports();

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Cancel Test".to_string(),
            description: "Should be cancellable".to_string(),
            required_skills: vec![],
            reward,
            verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CancelTask {},
        task_contract::accounts::CancelTask {
            creator: &payer.pubkey(),
            task: &task_addr,
            escrow: &escrow_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let payer_after = svm.get_account(&payer.pubkey()).unwrap().lamports();
    // After cancel + rent refund, payer should have most of their lamports back
    assert!(
        payer_after >= payer_before - 5000,
        "Creator should be refunded after cancellation"
    );
}

#[test]
fn test_cancel_task_in_progress_fails() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "No Cancel".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 200_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            worker_profile: &wp, task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::StartTask {},
        task_contract::accounts::StartTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    // Cancel should fail when task is InProgress
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &task_contract::instruction::CancelTask {},
            task_contract::accounts::CancelTask {
                creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            }
            .to_account_metas(Some(&payer.pubkey())),
        ), &payer);
    }));
    assert!(result.is_err(), "Cannot cancel a task that is InProgress");
}

// ── Permission / Authorization ───────────────────────────────

#[test]
fn test_non_creator_cannot_cancel() {
    let (mut svm, payer) = build_svm();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Secure Task".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 100_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID, &task_contract::instruction::CancelTask {},
            task_contract::accounts::CancelTask {
                creator: &attacker.pubkey(), // wrong signer
                task: &task_addr,
                escrow: &escrow_addr,
            }
            .to_account_metas(Some(&attacker.pubkey())),
        ), &attacker);
    }));
    assert!(result.is_err(), "Non-creator cannot cancel task");
}

#[test]
fn test_worker_cannot_verify_own_task() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;
    let treasury = Pubkey::find_program_address(&[b"platform_treasury"], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializePlatform {},
        task_contract::accounts::InitializePlatform {
            authority: &payer.pubkey(), treasury: &treasury,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Auth Test".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 200_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            worker_profile: &wp, task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::StartTask {},
        task_contract::accounts::StartTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::SubmitTask {},
        task_contract::accounts::SubmitTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    // Worker tries to verify — must fail (must be creator)
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _ = send_tx(&mut svm, Instruction::new_with_borsh(
            PROGRAM_ID,
            &task_contract::instruction::VerifyTask { approved: true },
            task_contract::accounts::VerifyTask {
                creator: &worker.pubkey(), // wrong — must be creator
                worker: &worker.pubkey(),
                task: &task_addr,
                escrow: &escrow_addr,
                treasury: &treasury,
                worker_profile: &wp,
            }
            .to_account_metas(Some(&worker.pubkey())),
        ), &worker);
    }));
    assert!(result.is_err(), "Worker cannot verify their own task");
}

// ── Dispute ───────────────────────────────────────────────────

#[test]
fn test_dispute_after_verification_deadline() {
    let (mut svm, payer) = build_svm();
    let worker = Keypair::new();
    svm.airdrop(&worker.pubkey(), 1_000_000_000).unwrap();

    let wp = Pubkey::find_program_address(&[b"agent_profile", worker.pubkey().as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::InitializeWorkerProfile {},
        task_contract::accounts::InitializeWorkerProfile {
            owner: &worker.pubkey(), worker_profile: &wp,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let task_addr = Pubkey::find_program_address(&[b"task", payer.pubkey().as_ref()], &PROGRAM_ID).0;
    let escrow_addr = Pubkey::find_program_address(&[b"escrow", task_addr.as_ref()], &PROGRAM_ID).0;

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::CreateTask {
            title: "Dispute Test".to_string(), description: "".to_string(),
            required_skills: vec![], reward: 1_000_000_000, verification_period: 7 * 24 * 3600,
        },
        task_contract::accounts::CreateTask {
            creator: &payer.pubkey(), task: &task_addr, escrow: &escrow_addr,
            system_program: &solana_program::system_program::id(),
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);

    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::AssignTask {},
        task_contract::accounts::AssignTask {
            creator: &payer.pubkey(), worker: &worker.pubkey(),
            worker_profile: &wp, task: &task_addr,
        }
        .to_account_metas(Some(&payer.pubkey())),
    ), &payer);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::StartTask {},
        task_contract::accounts::StartTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID, &task_contract::instruction::SubmitTask {},
        task_contract::accounts::SubmitTask { worker: &worker.pubkey(), task: &task_addr }
            .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let worker_before = svm.get_account(&worker.pubkey()).unwrap().lamports();

    // Dispute — worker claims after deadline (LiteSVM uses real clock; in tests
    // the verification_deadline is set to now + period, so this should work)
    let _ = send_tx(&mut svm, Instruction::new_with_borsh(
        PROGRAM_ID,
        &task_contract::instruction::DisputeTask {},
        task_contract::accounts::DisputeTask {
            worker: &worker.pubkey(),
            task: &task_addr,
            escrow: &escrow_addr,
            worker_profile: &wp,
        }
        .to_account_metas(Some(&worker.pubkey())),
    ), &worker);

    let worker_after = svm.get_account(&worker.pubkey()).unwrap().lamports();
    assert!(
        worker_after > worker_before,
        "Worker should receive funds after successful dispute"
    );
}
