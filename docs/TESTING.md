# Claw Universe — Test Suite

## 📁 测试文件结构

```
claw-universe/
├── task_contract/
│   └── tests/
│       ├── task_contract.ts          ← 原始基础测试（Anchor框架）
│       └── task_contract_full.ts     ← 完整合约测试（45+ cases）
├── integration-tests/
│   └── task-lifecycle.integration.ts ← 集成测试（10 scenarios）
├── src/__tests__/
│   ├── setup.ts                      ← Vitest + jest-dom setup
│   ├── wallet.test.tsx               ← 钱包连接测试（18 cases）
│   └── form-validation.test.tsx      ← 表单验证测试（15 cases）
├── vitest.config.ts                  ← Vitest 配置
└── TESTING.md                        ← 本文档
```

---

## 🧪 1. 合约测试（Anchor / Solana）

**文件：** `task_contract/tests/task_contract_full.ts`

**运行命令：**
```bash
cd task_contract
anchor test
```

**覆盖范围：**

| 模块 | 测试用例数 | 覆盖内容 |
|------|-----------|---------|
| Platform Initialization | 2 | treasury初始化、重复初始化拒绝 |
| Worker Profile | 2 | 默认值验证、重复创建拒绝 |
| Task Creation | 7 | 奖励托管、边界验证（零奖励/超长标题/超长描述/验证期范围） |
| Task Assignment | 4 | 正常分配、声誉快照、自己分配拒绝、非创建者分配拒绝 |
| State Transitions | 6 | start/submit权限、状态机检查、submission_time记录 |
| Reward Release | 5 | 批准/拒绝验证、费用计算、stats更新、tier晋升 |
| Cancellation | 5 | 取消未分配/已分配/进行中/已完成任务、非创建者取消拒绝 |
| Dispute | 2 | deadline后争议、权限检查 |
| Full Lifecycle | 1 | 端到端5步流程 |
| Multi-Worker | 2 | 双工人竞标race condition、dispute escrow归属 |

**覆盖率目标：** 语句覆盖 ≥ 80%，分支覆盖 ≥ 70%

---

## ⚛️ 2. 前端测试（React Testing Library + Vitest）

**文件：**
- `src/__tests__/wallet.test.tsx`
- `src/__tests__/form-validation.test.tsx`

**运行命令：**
```bash
cd claw-universe
npm test
# 或带覆盖率：
npm test -- --coverage
```

**覆盖范围：**

| 模块 | 测试用例数 | 覆盖内容 |
|------|-----------|---------|
| 钱包连接 | 4 | 未连接banner、已连接隐藏banner、Post Task按钮、Connect按钮 |
| 任务列表渲染 | 6 | 页面标题、open计数、任务卡片、奖励显示、技能标签、状态徽章 |
| 过滤器与排序 | 6 | All/Open过滤、标题搜索、技能搜索、空状态、排序、重置 |
| 表单验证 | 10 | 搜索(大小写不敏感/AND逻辑)、预算范围过滤、截止日期显示、空状态、结果计数 |
| 钱包状态切换 | 1 | disconnected→connected banner消失 |

**覆盖率目标：** 行覆盖 ≥ 70%，函数覆盖 ≥ 70%

---

## 🔗 3. 集成测试（Anchor）

**文件：** `integration-tests/task-lifecycle.integration.ts`

**运行命令：**
```bash
cd task_contract
anchor test integration-tests/task-lifecycle.integration.ts
```

**覆盖场景：**

### 场景 1：完整幸福路径
```
创建任务 → 分配工人 → 开始任务 → 提交交付物 → 创建者批准 → 工人收款
```
- 验证每一步后状态正确转换
- 验证奖励分配（85%工人 / 15%平台）
- 验证worker profile stats更新
- 验证escrow完全清空

### 场景 2：被拒绝后重新提交
```
提交 → 创建者拒绝(approved=false) → 任务回到InProgress → 工人重新提交 → 创建者批准
```
- 验证拒绝时escrow不动
- 验证submission_time被清除
- 验证重新提交后流程正常完成

### 场景 3：多工人竞标
- 第一个分配的工人赢得任务
- 第二/三个工人被 `InvalidTaskState` 拒绝
- 每个工人各自创建任务互不干扰

### 场景 4：争议解决
- creator 超过deadline未验证，worker通过disputeClaim获取escrow
- 非worker不能发起dispute

### 场景 5：取消与退款
- 取消未分配任务：全额退款（扣除租金）
- 取消已分配但未开始的任务：全额退款
- 进行中的任务不能取消（工人保护）

---

## 🔧 依赖安装

```bash
# 合约测试
cd task_contract
npm install

# 前端测试
cd ..
npm install
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

---

## 📊 覆盖率目标汇总

| 测试层 | 目标行覆盖 | 目标分支覆盖 | 目标函数覆盖 |
|--------|-----------|-------------|-------------|
| 合约测试 | ≥ 80% | ≥ 70% | ≥ 80% |
| 前端测试 | ≥ 70% | ≥ 60% | ≥ 70% |
| 集成测试 | 关键路径100% | — | — |

---

## ⚠️ 已知限制

1. **时间依赖测试**：dispute测试依赖验证期(7天)已过。在快速测试环境中会收到 `VerificationDeadlineExceeded` 错误，这是预期行为。
2. **并发race condition**：多工人同时分配同一任务的race condition在单线程测试中通过状态检查验证。在真实Solana网络上由交易排序保证。
3. **钱包适配器mock**：前端测试使用简化的wallet mock，不包含完整的签名流程。真实钱包集成测试需要在devnet/mainnet上进行。
