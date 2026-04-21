use anchor_lang::{declare_id, prelude::*};
use anchor_lang::solana_program::hash::hashv;

// ============================================================
// Constants
// ============================================================

pub const PLATFORM_FEE_BPS: u16 = 1500;
pub const ESCROW_PREFIX: &[u8] = b"escrow";
pub const BID_SEED: &[u8] = b"bid";
pub const TREASURY_SEED: &[u8] = b"platform_treasury";
pub const AGENT_PROFILE_SEED: &[u8] = b"agent_profile";
pub const TASK_SEED: &[u8] = b"task";
pub const DEFAULT_VERIFICATION_PERIOD: i64 = 7 * 24 * 60 * 60;
pub const MAX_VERIFICATION_PERIOD: i64 = 30 * 24 * 60 * 60;
pub const MIN_REPUTATION: u32 = 0;
pub const MAX_REPUTATION: u32 = 1000;
pub const TIER_BRONZE_MAX_REPUTATION: u32 = 200;
pub const TIER_SILVER_MAX_REPUTATION: u32 = 500;
pub const TIER_GOLD_MAX_REPUTATION: u32 = 800;
pub const REPUTATION_INCREASE_COMPLETED: u32 = 10;
pub const REPUTATION_DECREASE_FAILED: u32 = 50;
pub const REPUTATION_DECREASE_DISPUTED: u32 = 30;
pub const MAX_TITLE_LENGTH: usize = 100;
pub const MAX_DESCRIPTION_LENGTH: usize = 1000;
pub const MAX_TASK_SKILLS: usize = 10;
pub const MAX_AGENT_SKILLS: usize = 32;
pub const MAX_BID_PROPOSAL_LENGTH: usize = 500;

// ============================================================
// Error Codes
// ============================================================

#[error_code]
pub enum TaskError {
    #[msg("Task is not in the expected state")]
    InvalidTaskState,
    #[msg("Task is already assigned")]
    TaskAlreadyAssigned,
    #[msg("Task has already been completed")]
    TaskAlreadyCompleted,
    #[msg("Caller is not the task creator")]
    NotTaskCreator,
    #[msg("Caller is not the assigned worker")]
    NotTaskWorker,
    #[msg("Task deadline has passed")]
    DeadlineExceeded,
    #[msg("Verification deadline has passed")]
    VerificationDeadlineExceeded,
    #[msg("Insufficient reward funds in escrow")]
    InsufficientEscrowFunds,
    #[msg("Invalid reputation score")]
    InvalidReputation,
    #[msg("Agent tier too low for this task")]
    InsufficientTier,
    #[msg("Agent does not have required skills")]
    MissingRequiredSkill,
    #[msg("Creator cannot assign task to self")]
    SelfAssignmentNotAllowed,
    #[msg("Reward amount must be greater than zero")]
    ZeroReward,
    #[msg("Task account not found")]
    TaskNotFound,
    #[msg("Escrow account not found")]
    EscrowNotFound,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("Fee calculation error")]
    FeeCalculationError,
    #[msg("Failed to transfer lamports")]
    TransferFailed,
    #[msg("Account mismatch")]
    AccountMismatch,
    #[msg("Bid already exists for this task and worker")]
    BidAlreadyExists,
    #[msg("Bid not found")]
    BidNotFound,
    #[msg("Worker does not have enough funds for bid deposit")]
    InsufficientBidDeposit,
    #[msg("Bid deposit too small")]
    BidDepositTooSmall,
}

// ============================================================
// State Types
// ============================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus {
    Created,     // Task created, accepting bids
    Assigned,    // Worker assigned, awaiting start
    InProgress,  // Worker actively working
    Completed,   // Worker submitted deliverables
    Verified,    // Creator approved completion
    Cancelled,   // Task cancelled, funds refunded
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BidStatus {
    Active,     // Bid is active, can be accepted
    Accepted,   // Creator accepted this bid
    Rejected,   // Creator rejected / chose another bid
    Cancelled,  // Bidder cancelled their bid
    Withdrawn,  // Bid withdrawn after task assigned elsewhere
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AgentTier {
    Bronze,
    Silver,
    Gold,
    Platinum,
}

impl Default for AgentTier {
    fn default() -> Self {
        AgentTier::Bronze
    }
}

/// Task account — the core work unit in the marketplace.
/// PDA seed: [TASK_SEED, creator.key().as_ref(), task_bump]
/// Space: 8 + 1622 ≈ 1630 bytes
#[account]
pub struct Task {
    pub creator: Pubkey,                       // 32 — task creator's public key
    pub worker: Pubkey,                        // 32 — assigned worker (zeroed if unassigned)
    pub title: String,                          // 4 + 100
    pub description: String,                  // 4 + 1000
    pub required_skills: Vec<String>,           // 4 + (10 × 64)
    pub status: TaskStatus,                      // 1
    pub reward: u64,                            // 8
    pub verification_deadline: i64,              // 8 — unix timestamp
    pub submission_time: Option<i64>,            // 9
    pub verification_time: Option<i64>,         // 9
    pub bump: u8,                               // 1
    pub created_at: i64,                        // 8
    pub worker_reputation_at_assignment: u32,  // 4
    /// C2 FIX: Tracks the accepted bid's deposit amount so it can be refunded
    /// from the treasury to the worker upon successful task completion.
    /// Zero if task was assigned via assign_task (no bid deposit).
    pub accepted_bid_deposit: u64,             // 8
}

impl Task {
    pub const MAX_SIZE: usize = 32 + 32 + 4 + 100 + 4 + 1000 + 4 + 64 + 1 + 8 + 9 + 9 + 1 + 4 + 4 + 8 + 8;
    pub fn space() -> usize { 8 + Self::MAX_SIZE }
}

/// Escrow account — holds task reward lamports in custody.
/// PDA seed: [ESCROW_PREFIX, task.key().as_ref(), escrow_bump]
/// Space: 8 + 41 ≈ 49 bytes
#[account]
pub struct TaskEscrow {
    pub task: Pubkey,    // 32 — points back to the task
    pub balance: u64,    // 8 — lamports held in escrow
    pub bump: u8,        // 1
}

impl TaskEscrow {
    pub const MAX_SIZE: usize = 32 + 8 + 1;
    pub fn space() -> usize { 8 + Self::MAX_SIZE }
}

/// Platform treasury — collects protocol fees.
/// PDA seed: [TREASURY_SEED, treasury_bump]
/// Space: 8 + 43 ≈ 51 bytes
#[account]
pub struct PlatformTreasury {
    pub authority: Pubkey,           // 32
    pub total_fees_collected: u64,    // 8
    pub fee_basis_points: u16,       // 2
    pub bump: u8,                     // 1
}

impl PlatformTreasury {
    pub const MAX_SIZE: usize = 32 + 8 + 2 + 1;
    pub fn space() -> usize { 8 + Self::MAX_SIZE }
}

/// Agent profile — tracks agent reputation and credentials.
/// PDA seed: [AGENT_PROFILE_SEED, owner.key().as_ref(), profile_bump]
/// Space: 8 + 186 ≈ 194 bytes
#[account]
pub struct AgentProfile {
    pub owner: Pubkey,               // 32 — agent's wallet
    pub reputation: u32,              // 4 — 0-1000 reputation score
    pub tasks_completed: u64,         // 8
    pub tasks_failed: u64,            // 8
    pub tier: AgentTier,              // 1
    pub skills: Vec<String>,          // 4 + (32 × 64)
    pub total_earnings: u64,          // 8
    pub bump: u8,                     // 1
}

impl AgentProfile {
    pub const MAX_SIZE: usize = 32 + 4 + 8 + 8 + 1 + 4 + 128 + 8 + 1;
    pub fn space() -> usize { 8 + Self::MAX_SIZE }
}

/// Bid account — represents a worker's proposal for a task.
/// PDA seed: [BID_SEED, task.key().as_ref(), bidder.key().as_ref(), bid_bump]
/// Space: 8 + 114 ≈ 122 bytes
#[account]
pub struct Bid {
    pub task: Pubkey,        // 32 — the task this bid is for
    pub bidder: Pubkey,      // 32 — worker's public key
    pub proposal: String,    // 4 + 500 — bid proposal / cover letter
    pub deposit: u64,         // 8 — good-faition deposit (slashed on default)
    pub status: BidStatus,   // 1
    pub created_at: i64,    // 8
    pub bump: u8,            // 1
}

impl Bid {
    pub const MAX_SIZE: usize = 32 + 32 + 4 + MAX_BID_PROPOSAL_LENGTH + 8 + 1 + 8 + 1;
    pub fn space() -> usize { 8 + Self::MAX_SIZE }
}

// ============================================================
// Program ID
// ============================================================

declare_id!("EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C");

// ============================================================
// Program Module
// ============================================================

#[program]
pub mod task_contract {
    use super::*;

    pub fn initialize_platform(ctx: Context<InitializePlatform>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.total_fees_collected = 0;
        treasury.fee_basis_points = PLATFORM_FEE_BPS;
        treasury.bump = ctx.bumps.treasury;
        emit!(PlatformInitialized {
            authority: ctx.accounts.authority.key(),
            fee_basis_points: PLATFORM_FEE_BPS,
        });
        Ok(())
    }

    pub fn initialize_worker_profile(ctx: Context<InitializeWorkerProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.worker_profile;
        profile.owner = ctx.accounts.owner.key();
        profile.reputation = 100; // Start with default reputation
        profile.tasks_completed = 0;
        profile.tasks_failed = 0;
        profile.tier = AgentTier::Bronze;
        profile.skills = vec![];
        profile.total_earnings = 0;
        profile.bump = ctx.bumps.worker_profile;
        Ok(())
    }

    pub fn create_task(
        ctx: Context<CreateTask>,
        title: String,
        description: String,
        required_skills: Vec<String>,
        reward: u64,
        verification_period: i64,
    ) -> Result<()> {
        require!(!title.is_empty(), TaskError::ZeroReward);
        require!(title.len() <= MAX_TITLE_LENGTH, TaskError::ZeroReward);
        require!(description.len() <= MAX_DESCRIPTION_LENGTH, TaskError::ZeroReward);
        require!(required_skills.len() <= MAX_TASK_SKILLS, TaskError::ZeroReward);
        require!(reward > 0, TaskError::ZeroReward);
        require!(
            verification_period >= DEFAULT_VERIFICATION_PERIOD
                && verification_period <= MAX_VERIFICATION_PERIOD,
            TaskError::ZeroReward
        );

        let task = &mut ctx.accounts.task;
        let clock = Clock::get()?;
        task.creator = ctx.accounts.creator.key();
        task.worker = Pubkey::default();
        task.title = title;
        task.description = description;
        task.required_skills = required_skills;
        task.status = TaskStatus::Created;
        task.reward = reward;
        task.verification_deadline = clock.unix_timestamp + verification_period;
        task.submission_time = None;
        task.verification_time = None;
        task.bump = ctx.bumps.task;
        task.created_at = clock.unix_timestamp;
        task.worker_reputation_at_assignment = 0;

        ctx.accounts.escrow.task = task.key();
        ctx.accounts.escrow.balance = reward;
        ctx.accounts.escrow.bump = ctx.bumps.escrow;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.key(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, reward)?;

        emit!(TaskCreated {
            task: ctx.accounts.task.key(),
            creator: ctx.accounts.creator.key(),
            reward,
            title: ctx.accounts.task.title.clone(),
        });
        Ok(())
    }

    pub fn assign_task(ctx: Context<AssignTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(task.status == TaskStatus::Created, TaskError::InvalidTaskState);
        let worker = ctx.accounts.worker.key();
        let creator = ctx.accounts.creator.key();
        require!(worker != creator, TaskError::SelfAssignmentNotAllowed);
        // V5 FIX: Validate worker qualifications before assignment
        let worker_profile = &ctx.accounts.worker_profile;
        require!(worker_profile.reputation >= MIN_REPUTATION, TaskError::InvalidReputation);
        // Verify worker has all required skills if task specifies any
        if !task.required_skills.is_empty() {
            for required_skill in &task.required_skills {
                require!(
                    worker_profile.skills.contains(required_skill),
                    TaskError::MissingRequiredSkill
                );
            }
        }
        task.worker = worker;
        task.status = TaskStatus::Assigned;
        task.worker_reputation_at_assignment = ctx.accounts.worker_profile.reputation;
        task.accepted_bid_deposit = 0; // No bid deposit when assigned via assign_task
        emit!(TaskAssigned {
            task: ctx.accounts.task.key(),
            worker,
            creator,
        });
        Ok(())
    }

    // ============================================================
    // Bid Instructions
    // ============================================================

    /// Submit a bid on an open task.
    /// The bidder must include a good-faith deposit (slashed if they default).
    /// Only one active bid per (task, bidder) pair.
    pub fn submit_bid(
        ctx: Context<SubmitBid>,
        proposal: String,
        deposit: u64,
    ) -> Result<()> {
        require!(proposal.len() <= MAX_BID_PROPOSAL_LENGTH, TaskError::ZeroReward);
        require!(deposit >= 100_000, TaskError::BidDepositTooSmall); // min 0.0001 SOL

        let task = &ctx.accounts.task;
        require!(task.status == TaskStatus::Created, TaskError::InvalidTaskState);

        let bid = &mut ctx.accounts.bid;
        bid.task = task.key();
        bid.bidder = ctx.accounts.bidder.key();
        bid.proposal = proposal;
        bid.deposit = deposit;
        bid.status = BidStatus::Active;
        bid.created_at = Clock::get()?.unix_timestamp;
        bid.bump = ctx.bumps.bid;

        // Transfer bid deposit to escrow (held by program, separate from task escrow)
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.key(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.bidder.to_account_info(),
                to: ctx.accounts.bid_escrow.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_ctx, deposit)?;

        emit!(BidSubmitted {
            bid: ctx.accounts.bid.key(),
            task: task.key(),
            bidder: ctx.accounts.bidder.key(),
            deposit,
        });
        Ok(())
    }

    /// Withdraw a bid before it is accepted. Returns the deposit.
    pub fn withdraw_bid(ctx: Context<WithdrawBid>) -> Result<()> {
        let bid = &mut ctx.accounts.bid;
        require!(bid.bidder == ctx.accounts.bidder.key(), TaskError::AccountMismatch);
        require!(bid.status == BidStatus::Active, TaskError::InvalidTaskState);

        let deposit = bid.deposit;
        bid.deposit = 0;
        bid.status = BidStatus::Withdrawn;

        // Deduct from bid_escrow (actual lamports)
        **ctx.accounts.bid_escrow.try_borrow_mut_lamports()? =
            ctx.accounts.bid_escrow.lamports()
                .checked_sub(deposit)
                .ok_or(TaskError::ArithmeticOverflow)?;
        
        // Return deposit to bidder
        **ctx.accounts.bidder.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.bidder.to_account_info().lamports()
                .checked_add(deposit)
                .ok_or(TaskError::ArithmeticOverflow)?;

        emit!(BidWithdrawn {
            bid: ctx.accounts.bid.key(),
            bidder: ctx.accounts.bidder.key(),
            deposit,
        });
        Ok(())
    }

    /// Creator accepts a bid — assigns the task to the winning bidder.
    /// The winning bidder's deposit is transferred to the platform treasury as a
    /// PERFORMANCE GUARANTEE. It is fully refunded (方案A) when the worker
    /// successfully completes the task (verify_task approved=true) or wins a
    /// dispute (dispute_task). Losing bids (Active → Rejected) get their deposits returned.
    pub fn accept_bid(ctx: Context<AcceptBid>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let bid = &mut ctx.accounts.bid;

        require!(task.status == TaskStatus::Created, TaskError::InvalidTaskState);
        require!(bid.task == task.key(), TaskError::AccountMismatch);
        require!(bid.status == BidStatus::Active, TaskError::InvalidTaskState);
        require!(task.creator == ctx.accounts.creator.key(), TaskError::NotTaskCreator);

        // Mark this bid as accepted
        bid.status = BidStatus::Accepted;

        // Assign the task to the winning bidder
        let worker = bid.bidder;
        task.worker = worker;
        task.status = TaskStatus::Assigned;
        task.worker_reputation_at_assignment = ctx.accounts.worker_profile.reputation;
        // C2 FIX: Store the bid deposit amount on the task so verify_task can refund it
        task.accepted_bid_deposit = bid.deposit;

        // Transfer winning bid deposit to treasury as performance guarantee.
        // C2 FIX (方案A): This deposit is refunded in full when the worker either:
        //   - Successfully completes the task (verify_task approved=true), OR
        //   - Wins a dispute (dispute_task).
        // The deposit is NOT refunded if the worker abandons without submitting.
        let slashed = bid.deposit;
        
        // Deduct from bid_escrow
        **ctx.accounts.bid_escrow.try_borrow_mut_lamports()? =
            ctx.accounts.bid_escrow.lamports()
                .checked_sub(slashed)
                .ok_or(TaskError::ArithmeticOverflow)?;
        
        // Add to treasury
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.treasury.to_account_info().lamports()
                .checked_add(slashed)
                .ok_or(TaskError::ArithmeticOverflow)?;
        bid.deposit = 0;

        emit!(BidAccepted {
            bid: ctx.accounts.bid.key(),
            task: task.key(),
            winner: worker,
            slashed_deposit: slashed,
        });
        Ok(())
    }

    /// Creator rejects a specific bid. Returns the deposit to the bidder.
    pub fn reject_bid(ctx: Context<RejectBid>) -> Result<()> {
        // Extract immutable data BEFORE mutable borrow
        let bid_key = ctx.accounts.bid.key();
        let bidder_key = ctx.accounts.bid.bidder;
        let deposit = ctx.accounts.bid.deposit;

        let bid = &mut ctx.accounts.bid;
        let task = &ctx.accounts.task;

        require!(bid.task == task.key(), TaskError::AccountMismatch);
        require!(bid.status == BidStatus::Active, TaskError::InvalidTaskState);
        require!(task.creator == ctx.accounts.creator.key(), TaskError::NotTaskCreator);

        bid.deposit = 0;
        bid.status = BidStatus::Rejected;

        // Deduct from bid_escrow (actual lamports)
        **ctx.accounts.bid_escrow.try_borrow_mut_lamports()? =
            ctx.accounts.bid_escrow.lamports()
                .checked_sub(deposit)
                .ok_or(TaskError::ArithmeticOverflow)?;
        
        // Return deposit to bidder
        **ctx.accounts.bidder.to_account_info().try_borrow_mut_lamports()? =
            ctx.accounts.bidder.to_account_info().lamports()
                .checked_add(deposit)
                .ok_or(TaskError::ArithmeticOverflow)?;

        emit!(BidRejected {
            bid: bid_key,
            bidder: bidder_key,
        });
        Ok(())
    }

    pub fn start_task(ctx: Context<StartTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(task.status == TaskStatus::Assigned, TaskError::InvalidTaskState);
        require!(ctx.accounts.worker.key() == task.worker, TaskError::NotTaskWorker);
        task.status = TaskStatus::InProgress;
        emit!(TaskStarted {
            task: ctx.accounts.task.key(),
            worker: ctx.accounts.worker.key(),
        });
        Ok(())
    }

    pub fn submit_task(ctx: Context<SubmitTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        require!(task.status == TaskStatus::InProgress, TaskError::InvalidTaskState);
        require!(ctx.accounts.worker.key() == task.worker, TaskError::NotTaskWorker);
        let clock = Clock::get()?;
        task.status = TaskStatus::Completed;
        task.submission_time = Some(clock.unix_timestamp);
        emit!(TaskSubmitted {
            task: ctx.accounts.task.key(),
            worker: ctx.accounts.worker.key(),
            submitted_at: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn verify_task(ctx: Context<VerifyTask>, approved: bool) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();
        let worker_profile = &mut ctx.accounts.worker_profile;
        require!(task.status == TaskStatus::Completed, TaskError::InvalidTaskState);
        require!(ctx.accounts.creator.key() == task.creator, TaskError::NotTaskCreator);
        // V4 FIX: Enforce verification deadline - creator cannot approve after deadline expires
        let clock = Clock::get()?;
        require!(clock.unix_timestamp <= task.verification_deadline, TaskError::VerificationDeadlineExceeded);
        // V6 FIX: Prevent repeated calls on emptied escrow
        require!(ctx.accounts.escrow.balance > 0, TaskError::InsufficientEscrowFunds);

        let total_reward = ctx.accounts.escrow.balance;
        let fee_amount = (total_reward as u128)
            .checked_mul(ctx.accounts.treasury.fee_basis_points as u128)
            .ok_or(TaskError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(TaskError::ArithmeticOverflow)? as u64;
        let worker_reward = total_reward.checked_sub(fee_amount).ok_or(TaskError::ArithmeticOverflow)?;
        let task_key = task.key();
        let worker_key = task.worker;

        if approved {
            // Deduct from escrow account (actual lamports)
            **escrow_info.try_borrow_mut_lamports()? = escrow_info
                .lamports().checked_sub(total_reward).ok_or(TaskError::ArithmeticOverflow)?;
            
            // Add to treasury
            **treasury_info.try_borrow_mut_lamports()? = treasury_info
                .lamports().checked_add(fee_amount).ok_or(TaskError::ArithmeticOverflow)?;
            
            // Add to worker
            **ctx.accounts.worker.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.worker
                .to_account_info().lamports().checked_add(worker_reward).ok_or(TaskError::ArithmeticOverflow)?;
            
            // C2 FIX: Refund the bid deposit from treasury to the worker
            let bid_deposit = task.accepted_bid_deposit;
            if bid_deposit > 0 {
                **treasury_info.try_borrow_mut_lamports()? = treasury_info
                    .lamports().checked_sub(bid_deposit).ok_or(TaskError::ArithmeticOverflow)?;
                **ctx.accounts.worker.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.worker
                    .to_account_info().lamports().checked_add(bid_deposit).ok_or(TaskError::ArithmeticOverflow)?;
            }
            
            ctx.accounts.escrow.balance = 0;
            worker_profile.tasks_completed = worker_profile.tasks_completed.saturating_add(1);
            worker_profile.total_earnings = worker_profile.total_earnings.saturating_add(worker_reward);
            let new_rep = worker_profile.reputation.saturating_add(REPUTATION_INCREASE_COMPLETED);
            worker_profile.reputation = new_rep.min(MAX_REPUTATION);
            worker_profile.tier = if new_rep <= TIER_BRONZE_MAX_REPUTATION {
                AgentTier::Bronze
            } else if new_rep <= TIER_SILVER_MAX_REPUTATION {
                AgentTier::Silver
            } else if new_rep <= TIER_GOLD_MAX_REPUTATION {
                AgentTier::Gold
            } else {
                AgentTier::Platinum
            };
            task.status = TaskStatus::Verified;
            task.verification_time = Some(clock.unix_timestamp);
            ctx.accounts.treasury.total_fees_collected = ctx.accounts.treasury.total_fees_collected.saturating_add(fee_amount);
            emit!(TaskVerified {
                task: task_key,
                worker: worker_key,
                approved: true,
                worker_reward,
                fee_amount,
            });
        } else {
            task.status = TaskStatus::InProgress;
            task.submission_time = None;
            emit!(TaskVerified {
                task: task_key,
                worker: worker_key,
                approved: false,
                worker_reward: 0,
                fee_amount: 0,
            });
        }
        Ok(())
    }

    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let escrow_info = ctx.accounts.escrow.to_account_info();
        require!(task.status == TaskStatus::Created || task.status == TaskStatus::Assigned, TaskError::InvalidTaskState);
        require!(ctx.accounts.creator.key() == task.creator, TaskError::NotTaskCreator);
        let reward = ctx.accounts.escrow.balance;
        if reward > 0 {
            // Deduct from escrow account (actual lamports)
            **escrow_info.try_borrow_mut_lamports()? = 
                escrow_info.lamports().checked_sub(reward).ok_or(TaskError::ArithmeticOverflow)?;
            // Add to creator
            **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? = 
                ctx.accounts.creator.to_account_info().lamports().checked_add(reward).ok_or(TaskError::ArithmeticOverflow)?;
            ctx.accounts.escrow.balance = 0;
        }
        task.status = TaskStatus::Cancelled;
        emit!(TaskCancelled {
            task: ctx.accounts.task.key(),
            creator: ctx.accounts.creator.key(),
            refunded_amount: reward,
        });
        Ok(())
    }

    pub fn dispute_task(ctx: Context<DisputeTask>) -> Result<()> {
        let task = &mut ctx.accounts.task;
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();
        let worker_profile = &mut ctx.accounts.worker_profile;
        // V2 FIX: Explicitly verify task was submitted before allowing dispute claim
        require!(task.status == TaskStatus::Completed, TaskError::InvalidTaskState);
        require!(task.submission_time.is_some(), TaskError::InvalidTaskState);
        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= task.verification_deadline, TaskError::VerificationDeadlineExceeded);
        // V6 FIX: Prevent repeated calls on emptied escrow
        require!(ctx.accounts.escrow.balance > 0, TaskError::InsufficientEscrowFunds);
        // SECURITY FIX: Verify the caller is the actual task worker
        // (DisputeTask declares worker: Signer but wasn't checking the worker key)
        require!(ctx.accounts.worker.key() == task.worker, TaskError::NotTaskWorker);

        let total_reward = ctx.accounts.escrow.balance;
        // C1 FIX: Use treasury.fee_basis_points instead of hardcoded PLATFORM_FEE_BPS
        let fee_amount = (total_reward as u128)
            .checked_mul(ctx.accounts.treasury.fee_basis_points as u128)
            .ok_or(TaskError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(TaskError::ArithmeticOverflow)? as u64;
        let worker_reward = total_reward.checked_sub(fee_amount).ok_or(TaskError::ArithmeticOverflow)?;
        let task_key = task.key();
        let worker_key = task.worker;

        // Deduct from escrow account (actual lamports)
        **escrow_info.try_borrow_mut_lamports()? = 
            escrow_info.lamports().checked_sub(total_reward).ok_or(TaskError::ArithmeticOverflow)?;
        
        // C1 FIX: Transfer fee to treasury (not missing anymore)
        **treasury_info.try_borrow_mut_lamports()? = treasury_info
            .lamports().checked_add(fee_amount).ok_or(TaskError::ArithmeticOverflow)?;
        ctx.accounts.treasury.total_fees_collected = ctx.accounts.treasury.total_fees_collected
            .saturating_add(fee_amount);
        
        // Add worker reward
        **ctx.accounts.worker.to_account_info().try_borrow_mut_lamports()? = 
            ctx.accounts.worker.to_account_info().lamports().checked_add(worker_reward).ok_or(TaskError::ArithmeticOverflow)?;
        
        // C2 FIX: Refund bid deposit from treasury to worker
        let bid_deposit = task.accepted_bid_deposit;
        if bid_deposit > 0 {
            **treasury_info.try_borrow_mut_lamports()? = treasury_info
                .lamports().checked_sub(bid_deposit).ok_or(TaskError::ArithmeticOverflow)?;
            **ctx.accounts.worker.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.worker
                .to_account_info().lamports().checked_add(bid_deposit).ok_or(TaskError::ArithmeticOverflow)?;
        }
        
        ctx.accounts.escrow.balance = 0;
        // V1 FIX: Dispute is a penalty scenario - do NOT reward reputation or increase tasks_completed
        // Instead mark as failed to properly reflect the disputed outcome
        worker_profile.tasks_failed = worker_profile.tasks_failed.saturating_add(1);
        // Do NOT add to total_earnings or reputation - this is a penalty resolution
        // Note: reputation stays unchanged for disputed tasks per audit recommendation
        task.status = TaskStatus::Verified;
        task.verification_time = Some(clock.unix_timestamp);
        emit!(TaskDisputeResolved {
            task: task_key,
            worker: worker_key,
            worker_reward,
            fee_amount,
            resolution: "deadline_expired_worker_claimed".to_string(),
        });
        Ok(())
    }
}

// ============================================================
// Account Contexts
// ============================================================

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(init, payer = authority, space = PlatformTreasury::space(), seeds = [TREASURY_SEED], bump)]
    pub treasury: Account<'info, PlatformTreasury>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeWorkerProfile<'info> {
    #[account(mut)] pub owner: Signer<'info>,
    #[account(init, payer = owner, space = AgentProfile::space(), seeds = [AGENT_PROFILE_SEED, owner.key().as_ref()], bump)]
    pub worker_profile: Account<'info, AgentProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateTask<'info> {
    #[account(mut)] pub creator: Signer<'info>,
    #[account(
        init, 
        payer = creator, 
        space = Task::space(), 
        seeds = [TASK_SEED, creator.key().as_ref(), &hashv(&[title.as_bytes()]).to_bytes()[..8]], 
        bump
    )]
    pub task: Account<'info, Task>,
    #[account(init, payer = creator, space = TaskEscrow::space(), seeds = [ESCROW_PREFIX, task.key().as_ref()], bump)]
    pub escrow: Account<'info, TaskEscrow>,
    pub clock: Sysvar<'info, Clock>,
    pub system_program: Program<'info, System>,
}

/// SECURITY FIX: worker changed from SystemAccount to Signer.
/// This ensures the worker must personally consent to being assigned a task.
#[derive(Accounts)]
pub struct AssignTask<'info> {
    pub creator: Signer<'info>,
    pub worker: Signer<'info>,                                          // ✅ Was SystemAccount — now requires actual signature
    pub worker_profile: Account<'info, AgentProfile>,
    #[account(mut, has_one = creator @ TaskError::NotTaskCreator)]
    pub task: Account<'info, Task>,
}

/// Submit a bid on an open task. The bidder must sign this tx.
#[derive(Accounts)]
pub struct SubmitBid<'info> {
    #[account(mut)] pub bidder: Signer<'info>,                           // ✅ Bidder must sign
    /// Bid PDA: [BID_SEED, task.key().as_ref(), bidder.key().as_ref()]
    #[account(init, payer = bidder, space = Bid::space(), seeds = [BID_SEED, task.key().as_ref(), bidder.key().as_ref()], bump)]
    pub bid: Account<'info, Bid>,
    /// Separate escrow to hold bid deposit (distinct from task escrow).
    /// This prevents bid deposits from mixing with task rewards.
    #[account(init, payer = bidder, space = 1, seeds = [b"bid_escrow", bid.key().as_ref()], bump)]
    pub bid_escrow: AccountInfo<'info>,
    #[account(mut)] pub task: Account<'info, Task>,                      // Must be Created status
    pub system_program: Program<'info, System>,
}

/// Withdraw an active bid. Only the original bidder can do this.
#[derive(Accounts)]
pub struct WithdrawBid<'info> {
    #[account(mut)] pub bidder: Signer<'info>,                           // ✅ Must be original bidder
    #[account(mut, seeds = [BID_SEED, task.key().as_ref(), bidder.key().as_ref()], bump)]
    pub bid: Account<'info, Bid>,
    #[account(mut)] pub task: Account<'info, Task>,
    /// Bid escrow account holding the deposit
    #[account(mut, seeds = [b"bid_escrow", bid.key().as_ref()], bump)]
    pub bid_escrow: AccountInfo<'info>,
}

/// Accept a bid — creator chooses the winning bidder.
#[derive(Accounts)]
pub struct AcceptBid<'info> {
    #[account(mut)] pub creator: Signer<'info>,                          // ✅ Must be task creator
    #[account(mut)] pub bid: Account<'info, Bid>,                        // Must be Active bid for this task
    #[account(mut)] pub task: Account<'info, Task>,                      // Must be Created status
    #[account(mut)] pub treasury: Account<'info, PlatformTreasury>,     // Slashed deposit goes here
    pub worker_profile: Account<'info, AgentProfile>,
    /// Bid escrow account holding the deposit
    #[account(mut, seeds = [b"bid_escrow", bid.key().as_ref()], bump)]
    pub bid_escrow: AccountInfo<'info>,
}

/// Reject a bid — return the deposit to the bidder.
#[derive(Accounts)]
pub struct RejectBid<'info> {
    #[account(mut)] pub creator: Signer<'info>,                          // ✅ Must be task creator
    #[account(mut)] pub bid: Account<'info, Bid>,                        // Must be Active bid
    #[account(mut)] pub bidder: SystemAccount<'info>,                    // Bid deposit returned here
    #[account(mut)] pub task: Account<'info, Task>,
    /// Bid escrow account holding the deposit
    #[account(mut, seeds = [b"bid_escrow", bid.key().as_ref()], bump)]
    pub bid_escrow: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct StartTask<'info> {
    pub worker: Signer<'info>,
    #[account(mut, has_one = worker @ TaskError::NotTaskWorker)]
    pub task: Account<'info, Task>,
}

#[derive(Accounts)]
pub struct SubmitTask<'info> {
    pub worker: Signer<'info>,
    #[account(mut, has_one = worker @ TaskError::NotTaskWorker)]
    pub task: Account<'info, Task>,
}

#[derive(Accounts)]
pub struct VerifyTask<'info> {
    pub creator: Signer<'info>,
    pub worker: SystemAccount<'info>,
    #[account(mut, has_one = creator @ TaskError::NotTaskCreator, has_one = worker @ TaskError::NotTaskWorker)]
    pub task: Account<'info, Task>,
    #[account(mut, seeds = [ESCROW_PREFIX, task.key().as_ref()], bump)]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut)] pub treasury: Account<'info, PlatformTreasury>,
    #[account(mut)] pub worker_profile: Account<'info, AgentProfile>,
}

#[derive(Accounts)]
pub struct CancelTask<'info> {
    pub creator: Signer<'info>,
    #[account(mut, has_one = creator @ TaskError::NotTaskCreator)]
    pub task: Account<'info, Task>,
    #[account(mut, seeds = [ESCROW_PREFIX, task.key().as_ref()], bump)]
    pub escrow: Account<'info, TaskEscrow>,
}

#[derive(Accounts)]
pub struct DisputeTask<'info> {
    pub worker: Signer<'info>,
    #[account(mut, has_one = worker @ TaskError::NotTaskWorker)]
    pub task: Account<'info, Task>,
    #[account(mut, seeds = [ESCROW_PREFIX, task.key().as_ref()], bump)]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut, seeds = [AGENT_PROFILE_SEED, worker.key().as_ref()], bump)]
    pub worker_profile: Account<'info, AgentProfile>,
    // C1 FIX: Treasury account needed to collect platform fee and handle bid deposit refund
    #[account(mut, seeds = [TREASURY_SEED], bump)]
    pub treasury: Account<'info, PlatformTreasury>,
}

// ============================================================
// Events
// ============================================================

#[event]
pub struct PlatformInitialized {
    pub authority: Pubkey,
    pub fee_basis_points: u16,
}

#[event]
pub struct TaskCreated {
    pub task: Pubkey,
    pub creator: Pubkey,
    pub reward: u64,
    pub title: String,
}

#[event]
pub struct TaskAssigned {
    pub task: Pubkey,
    pub worker: Pubkey,
    pub creator: Pubkey,
}

#[event]
pub struct TaskStarted {
    pub task: Pubkey,
    pub worker: Pubkey,
}

#[event]
pub struct TaskSubmitted {
    pub task: Pubkey,
    pub worker: Pubkey,
    pub submitted_at: i64,
}

#[event]
pub struct TaskVerified {
    pub task: Pubkey,
    pub worker: Pubkey,
    pub approved: bool,
    pub worker_reward: u64,
    pub fee_amount: u64,
}

#[event]
pub struct TaskCancelled {
    pub task: Pubkey,
    pub creator: Pubkey,
    pub refunded_amount: u64,
}

#[event]
pub struct TaskDisputeResolved {
    pub task: Pubkey,
    pub worker: Pubkey,
    pub worker_reward: u64,
    pub fee_amount: u64,
    pub resolution: String,
}

#[event]
pub struct BidSubmitted {
    pub bid: Pubkey,
    pub task: Pubkey,
    pub bidder: Pubkey,
    pub deposit: u64,
}

#[event]
pub struct BidWithdrawn {
    pub bid: Pubkey,
    pub bidder: Pubkey,
    pub deposit: u64,
}

#[event]
pub struct BidAccepted {
    pub bid: Pubkey,
    pub task: Pubkey,
    pub winner: Pubkey,
    pub slashed_deposit: u64,
}

#[event]
pub struct BidRejected {
    pub bid: Pubkey,
    pub bidder: Pubkey,
}
