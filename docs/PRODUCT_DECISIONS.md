# PRODUCT_DECISIONS.md — 决策锁定文档

> 所有产品/技术决策在此记录，修改需经确认。**最后更新：2026-04-13**

---

## 一、代币策略

**决策：** SOL 和 $UNICLAW 均支持平台支付

**细则：**
- $UNICLAW（SPL Token on Solana Devnet）为主结算代币
- SPL Token Mint：`5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5`
- 合约层面：SOL/lamports 用于支付悬赏（测试阶段用 SOL）
- 前端 UI：Reward 输入框默认 SOL，用户可切换 UNICLAW
- Phase 1：SOL 测试 + UNICLAW 显示余额
- Phase 2：正式切换 UNICLAW 为唯一结算代币

**代币经济（白皮书保留）：**
- $UNICLAW 总供应量：1,000,000,000（1B）
- 平台费：15%（固定，不可修改）
- 销毁机制：Phase 2 实现（当前未接入合约）

---

## 二、Dispute 机制

**决策：** Phase 1 MVP 采用时间锁自动触发，Phase 2 升级 DAO 仲裁

**细则：**
- Worker 在 `verification_deadline` 过期后可调用 `dispute_task`
- 合约自动处理：15% fee 进 treasury，剩余给 worker，押金退回
- `tasks_failed += 1`（信誉分不变，Phase 2 联动信誉惩罚）
- 白皮书 DAO 仲裁条款延至 Phase 2

**为什么选时间锁而非 DAO：**
| | 时间锁 ✅ | DAO 仲裁 |
|--|---------|---------|
| MVP 可用性 | 已实现 | 需要额外基础设施 |
| 中心化风险 | 零 | 需要可信 DAO 成员 |
| 响应速度 | 即时 | 需等待投票 |
| Phase 2 升级 | 升级为 DAO | — |

---

## 三、MVP 范围

**决策：** Phase 1 MVP = 任务广场完整生命周期，Agent 租赁放 Phase 2

### MVP 功能（Phase 1）

| 功能 | 说明 |
|------|------|
| 钱包连接 | Phantom/Solflare，Web3 原生登录 |
| Worker Profile | 注册 + 链上信誉分展示 |
| 任务广场（Task Pool） | 链上创建 + 浏览 |
| 竞标流程 | submitBid → acceptBid → startTask → submitTask → verifyTask |
| Dispute（时间锁） | 验证截止期过后自动触发 |
| 悬赏支付 | SOL/lamports |
| 平台费 | 15% 进 treasury |
| 信誉系统 | Bronze/Silver/Gold/Platinum，verifyTask 自动升级 |

### Phase 2 功能（明确不在 MVP）

- Agent 租赁市场（龙虾租赁）
- IPFS 存储层
- 在线挖矿/推荐奖励
- $UNICLAW 正式结算集成
- 50% 销毁机制
- DAO 仲裁升级
- V-Corp 虚拟公司

---

## 四、部署状态（锁定）

| 组件 | 地址/ID | 网络 |
|------|---------|------|
| SPL Token Mint | `5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5` | Devnet |
| Anchor Program | `EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C` | Devnet |
| Token 精度 | 9 | — |
| 代币总量 | 1,000,000,000 | — |
| Platform Fee | 15% (1500 bps) | 合约固定 |

---

## 五、技术栈（锁定）

| 层 | 技术 |
|----|------|
| 区块链 | Solana Devnet |
| 智能合约 | Anchor (Rust) + SPL Token |
| 前端框架 | Vue 3 + Vite |
| 链上交互 | @coral-xyz/anchor + @solana/web3.js |
| 钱包适配 | @solana/wallet-adapter |
| 后端 | 可选（当前 MVP 无后端依赖） |
| 前端状态管理 | Pinia |

---

## 六、待确认/未决策项

| # | 问题 | 状态 |
|---|------|------|
| 1 | Treasury authority 是谁？（当前 initialize_platform 未确认是否已调用） | ⚠️ 待确认 |
| 2 | 初始 reputation 值（合约固定 100）是否合适 | ⚠️ 待确认 |
| 3 | dispute 成功后 reputation 是否扣分 | ⚠️ 待定（Phase 2） |
| 4 | 品牌名称：任务广场 vs Task Square vs 其他 | ⚠️ 待确认 |
| 5 | 前端服务器是否需要运行（当前 MVP 无后端） | ✅ 不需要 |

---

*决策变更需经用户确认后更新本文档。*
