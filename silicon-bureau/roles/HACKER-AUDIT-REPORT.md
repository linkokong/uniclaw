# 🔴 Claw Universe — Task Contract 安全审计报告

> **审计角色**：黑客（安全专家）  
> **项目**：Claw Universe 任务广场 + Agent 租赁市场  
> **审计目标**：`task_contract/programs/task_contract/src/lib.rs`  
> **版本**：v1.0  
> **日期**：2026-04-07  
> **状态**：🔴 高危漏洞发现

---

## 一、执行摘要

| 项目 | 结论 |
|------|------|
| **整体评级** | 🔴 **高危** |
| **漏洞总数** | 6 个 |
| **严重（Critical）** | 2 个 |
| **高危（High）** | 2 个 |
| **中危（Medium）** | 2 个 |
| **可上线** | ❌ 否 |

---

## 二、漏洞详情

### 🔴 漏洞 1：争议解决时 Worker 声誉错误增加（CRITICAL）

**位置**：`dispute_task` 函数（第 247 行）

**问题描述**：
当验证截止期到期后，Worker 通过争议机制索取奖励时，系统**错误地增加了 Worker 的声誉和完成任务数**。

```rust
// ❌ 错误代码
worker_profile.tasks_completed = worker_profile.tasks_completed.saturating_add(1);
worker_profile.total_earnings = worker_profile.total_earnings.saturating_add(worker_reward);
worker_profile.reputation = worker_profile.reputation.saturating_add(REPUTATION_INCREASE_COMPLETED);
```

**问题分析**：
- 截止期到期意味着 Worker **未能在规定时间内交付满意成果**
- 这是一种**惩罚性场景**，Worker 不应获得声誉奖励
- 当前逻辑：Worker 可以故意拖延至截止期，然后通过争议机制获得全额报酬 + 声誉提升
- 这形成了一个**恶意套利漏洞**：Worker 可以零风险获取报酬，因为即使被拒绝也能在截止期后Claim

**攻击场景**：
```
1. Worker 接手任务，获得奖励托管
2. Worker 故意低质量提交或根本不提交
3. Creator 拒绝验收
4. 截止期到期
5. Worker 调用 dispute_task → 获得全额报酬 + 声誉+10
6. Worker 重复此操作快速刷声誉
```

**修复建议**：
```rust
// ✅ 应该减去声誉或保持不变
worker_profile.reputation = worker_profile.reputation.saturating_sub(REPUTATION_DECREASE_DISPUTED);
// 或者 tasks_failed 增加
worker_profile.tasks_failed = worker_profile.tasks_failed.saturating_add(1);
// 不应增加 total_earnings，因为这是惩罚性发放
```

---

### 🔴 漏洞 2：争议机制缺少任务提交验证（CRITICAL）

**位置**：`dispute_task` 函数

**问题描述**：
`dispute_task` 只检查 `verification_deadline` 是否到期，**不验证任务是否实际提交过**。

```rust
require!(task.status == TaskStatus::Completed, TaskError::InvalidTaskState);
let clock = Clock::get()?;
require!(clock.unix_timestamp >= task.verification_deadline, TaskError::VerificationDeadlineExceeded);
```

**问题分析**：
- 如果 Worker **从未提交任务**（`submission_time == None`），截止期到期后仍可调用 `dispute_task`
- Worker 可以获得 `worker_reward` **而不做任何实际工作**

**攻击场景**：
```
1. Worker 接手任务，获得奖励托管
2. Worker 从不提交任务
3. 截止期到期
4. Worker 调用 dispute_task → 获得全额报酬（未完成任何工作）
```

**修复建议**：
```rust
// ✅ 在 dispute_task 开头添加提交验证
require!(task.submission_time.is_some(), TaskError::InvalidTaskState);
```

---

### 🟠 漏洞 3：任务取消机制逻辑缺陷（HIGH）

**位置**：`cancel_task` 函数

**问题描述**：
取消任务只能由 Creator 调用，且只能在 `Created` 或 `Assigned` 状态取消。

```rust
require!(task.status == TaskStatus::Created || task.status == TaskStatus::Assigned, TaskError::InvalidTaskState);
require!(ctx.accounts.creator.key() == task.creator, TaskError::NotTaskCreator);
```

**问题分析**：
- 一旦任务进入 `InProgress` 状态，**Creator 无法取消任务**
- 如果 Worker 跑路或失联，托管资金将永远锁定在 Escrow 中
- 没有机制处理 Worker 单方面放弃的情况

**修复建议**：
```rust
// ✅ 添加基于截止期的取消机制
// 如果任务超时且 Worker 无响应，Creator 可在一定条件下取消
pub fn force_cancel_task(ctx: Context<ForceCancelTask>, force_reason: String) -> Result<()> {
    let task = &mut ctx.accounts.task;
    let clock = Clock::get()?;
    
    // 仅在 InProgress 状态且超时后可强制取消
    if task.status == TaskStatus::InProgress {
        require!(clock.unix_timestamp > task.deadline, TaskError::DeadlineExceeded);
        // 资金退回给 Creator
    }
    // ...
}
```

---

### 🟠 漏洞 4：验证通过缺少截止期检查（HIGH）

**位置**：`verify_task` 函数

**问题描述**：
当 Creator 批准任务时，**没有检查当前时间是否在验证截止期内**。

```rust
pub fn verify_task(ctx: Context<VerifyTask>, approved: bool) -> Result<()> {
    let task = &mut ctx.accounts.task;
    // ❌ 缺少截止期检查
    // require!(clock.unix_timestamp <= task.verification_deadline, TaskError::VerificationDeadlineExceeded);
    
    if approved {
        // ... 发放奖励
    }
}
```

**问题分析**：
- Creator 可以在验证截止期**过期后**批准任务
- 破坏了平台设定的验证时间窗口限制

**修复建议**：
```rust
// ✅ 在 verify_task 开头添加截止期检查
let clock = Clock::get()?;
require!(clock.unix_timestamp <= task.verification_deadline, TaskError::VerificationDeadlineExceeded);
```

---

### 🟡 漏洞 5：Worker 资格验证缺失（MEDIUM）

**位置**：`assign_task` 函数

**问题描述**：
分配任务时**不验证 Worker 的声誉等级或技能是否满足任务要求**。

```rust
pub fn assign_task(ctx: Context<AssignTask>) -> Result<()> {
    let task = &mut ctx.accounts.task;
    require!(task.status == TaskStatus::Created, TaskError::InvalidTaskState);
    let worker = ctx.accounts.worker.key();
    let creator = ctx.accounts.creator.key();
    require!(worker != creator, TaskError::SelfAssignmentNotAllowed);
    
    // ❌ 没有验证 worker_profile.reputation >= 任务要求的最低声誉
    // ❌ 没有验证 worker_profile.tier >= 任务要求的最低等级
    // ❌ 没有验证 Worker 拥有 task.required_skills
    
    task.worker = worker;
    task.status = TaskStatus::Assigned;
    task.worker_reputation_at_assignment = ctx.accounts.worker_profile.reputation;
}
```

**修复建议**：
```rust
// ✅ 添加资格验证
require!(worker_profile.reputation >= MIN_REPUTATION, TaskError::InsufficientReputation);

// 验证技能匹配（如果任务有技能要求）
if !task.required_skills.is_empty() {
    for required_skill in &task.required_skills {
        require!(worker_profile.skills.contains(required_skill), TaskError::MissingRequiredSkill);
    }
}
```

---

### 🟡 漏洞 6：重复操作防护缺失（MEDIUM）

**位置**：`verify_task` 和 `dispute_task`

**问题描述**：
两个函数都没有检查 `escrow.balance == 0` 的保护状态，**可以重复调用并试图转移已清零的托管账户**。

```rust
// ❌ verify_task 中
escrow.balance = 0;  // 设置为0后没有进一步保护

// ❌ dispute_task 中同样的问题
escrow.balance = 0;
```

**问题分析**：
- 虽然 Anchor 的 `try_borrow_mut_lamports` 会在余额不足时失败
- 但代码逻辑不够健壮，依赖于底层系统错误而非显式状态检查

**修复建议**：
```rust
// ✅ 在函数开始时检查 escrow 状态
require!(escrow.balance > 0, TaskError::InsufficientEscrowFunds);
```

---

## 三、风控报告对比

根据硅基战略局的 **BL-002 底线规则**（所有合约必须通过安全审计），以及 KYC 合规方案中的风险识别：

| 风控风险点 | 合约对应状态 | 审计结果 |
|-----------|-------------|---------|
| 用户资产必须链上托管 | ✅ escrow 机制存在 | ⚠️ 存在，但有漏洞 |
| 智能合约必须通过安全审计 | 🔴 本次审计发现 6 个漏洞 | **未通过** |
| 不得有声誉/奖励套利漏洞 | 🔴 dispute_task 漏洞可刷声誉 | **高危** |

---

## 四、修复优先级

| 优先级 | 漏洞 | 预计修复时间 |
|--------|------|-------------|
| **P0** | 漏洞 1（声誉错误增加）| 1 小时 |
| **P0** | 漏洞 2（未提交可Claim）| 30 分钟 |
| **P1** | 漏洞 3（取消机制缺陷）| 2 小时 |
| **P1** | 漏洞 4（验证无截止期）| 30 分钟 |
| **P2** | 漏洞 5（资格验证缺失）| 1 小时 |
| **P2** | 漏洞 6（重复操作防护）| 30 分钟 |

---

## 五、总体建议

1. **立即修复 P0 漏洞**后再部署到主网
2. **添加完整的集成测试**，特别是边界条件测试
3. **引入 Formal Verification** 对经济机制进行数学证明
4. **主网部署前必须再次审计**，确保所有漏洞已修复
5. 建议添加 **紧急暂停机制**（Pause Functionality）以便在发现新漏洞时及时止损

---

## 六、审计声明

本审计基于代码静态分析，未进行运行时验证。实际漏洞影响可能因业务场景和链上状态而有所不同。建议在测试网充分测试后再部署主网。

---

*🔴 审计完成 | 6 个漏洞 | 0 个可直接上线问题*
