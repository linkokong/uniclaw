# ROADMAP.md — Claw Universe 开发路线图
## 当前版本：v2.2
**最后更新：2026-04-25**

---

## 一、已确认产品决策（锁定）

### 代币与定价
- **代币**：SOL、$UNICLAW、USDGO 三种支付方式
- **租赁定价**：雇主自设价格，平台收固定费 0.1 SOL/小时（或等值 UNIC），不抽比例
- **最低门槛**：0.5 SOL/小时

### Dispute 机制
- **Phase 1**：时间锁自动触发（验证截止期过后自动获赔）
- **Phase 2**：升级为 DAO 仲裁

### MVP 范围
- **Phase 1**：任务广场完整生命周期（竞标/接单）+ Agent 租赁市场
- **Phase 2**：IPFS、挖矿、DAO、V-Corp

---

## 二、Sprint 1 开发任务

### 目标：让 Agent 主能完整走完"浏览→注册→接单→执行→提交→验收"全流程

**任务清单：**

```
P0（必须完成）：
  [x] 1. Worker Profile 注册入口
        - RegisterProfile.tsx 已接通链上 initializeWorkerProfile
        - 自动检测是否已注册

  [x] 2. 竞标页面 / 接单按钮
        - BidForm.tsx：支持 API / On-chain 双模式提交
        - BidList.tsx：Creator 可见 accept/reject 按钮（API + On-chain）
        - 链上 PDA 任务自动切换 on-chain 模式

  [x] 3. 任务生命周期按钮（Worker 视角）
        - TaskDetail.tsx：
          * 状态=Assigned → 「Start Task」按钮（startTask）
          * 状态=InProgress → 「Submit Task」按钮（submitTask）
          * 状态=Submitted + deadline过期 → 「Dispute」按钮（disputeTask）

  [x] 4. 任务生命周期按钮（Creator 视角）
        - TaskDetail.tsx：
          * 状态=Submitted → 「Approve & Pay」/「Reject」按钮（verifyTask）
          * 状态=Open/Assigned → 「Cancel Task」按钮（cancelTask）
          * 支持 SOL 和 UNICLAW Token 两种支付方式

  [ ] 5. Treasury 初始化确认
        - 待确认 initialize_platform 是否已调用

P1（完成后做）：
  [x] 6. Dispute 按钮（Worker）
        - verification_deadline 过期后显示
        - disputeTask / disputeTaskToken 调用

  [ ] 7. Reputation / Tier 展示
        - 待接入链上 fetchProfile 数据

  [x] 8. 链上状态同步（双写架构）
        - 链上创建任务后自动同步到后端 DB（POST /tasks/sync）
        - 首页优先从 DB 读（快），后台异步从链上补充合并
        - 任务详情页直接从链上读（权威数据源）
```

---

## 三、已完成的基础设施改造

### IDL 升级（Anchor 0.32 兼容）
- [x] 添加顶层 `address` 字段
- [x] `publicKey` → `pubkey` 类型名称
- [x] `isMut`/`isSigner` → `writable`/`signer` 账户标记
- [x] account struct 定义从 `accounts` 移到 `types`
- [x] 所有 instruction 添加 `discriminator` 字段
- [x] 所有 account 添加 `discriminator` 字段

### Anchor Client 修复
- [x] `new BN()` 包装 u64/i64 参数（reward, verificationPeriod, deposit）
- [x] `Program` 构造函数改为 `new Program(idl, provider)` 正确签名
- [x] `clock` sysvar 账户正确传入 createTask
- [x] Borsh decode 跳过 8 字节 discriminator 前缀
- [x] Task 账户 dataSize 修正为 1341（原 800 导致过滤掉所有任务）
- [x] AgentProfile dataSize 修正为 202

### 前端修复
- [x] Vite Buffer polyfill（vite-plugin-node-polyfills）
- [x] 移除 PhantomWalletAdapter（Phantom 自动注册为 Standard Wallet）
- [x] React Router v7 future flags
- [x] API BASE_URL 统一为 `/api/v1`
- [x] 任务创建添加 nonce 后缀避免同用户同 title PDA 冲突
- [x] reward 显示修复（BigInt 整数除法 → 浮点除法，保留小数）
- [x] CHAIN_TASK_STATUS 映射补全（8 个状态：0-7）
- [x] TaskSquarePage 筛选标签增加 Assigned / Submitted
- [x] 后端 SPA fallback 限制为 production 环境

### Agent 租赁市场（重构）
- [x] 从链上 mock 改为后端 DB 存储
- [x] Agent 挂牌无需链上交易（零 gas）
- [x] 支持 SOL / UNICLAW / USDGO 三种计价币种
- [x] 搜索、浏览、挂牌完整流程

### 数据库 Migration
- [x] 006_add_task_pda_columns.sql — tasks 表新增 task_pda, tx_signature
- [x] 007_create_agents.sql — agents 表（租赁市场）

---

## 四、技术债务

| # | 问题 | 优先级 | 状态 |
|---|------|--------|------|
| T1 | Treasury 初始化确认 | P1 | 待验证 |
| T2 | 前端 chunk size 警告 | P3 | 可延后 |
| T3 | Profile 页面钱包登录流程优化 | P1 | 进行中 |
| T4 | smoke-test.ts 端到端验证 | P2 | 待做 |
| T5 | Agent 租赁实际支付（链上托管） | P2 | Phase 2 |

---

## 五、Sprint 2 - 体验打磨

```
P0：
  [ ] smoke-test.ts 端到端验证（覆盖完整生命周期）
  [ ] Profile 页面钱包登录 + 用户信息展示

P1：
  [ ] Treasury 余额查看 UI（管理员）
  [ ] 验证截止期倒计时 UI
  [ ] 用户引导（未注册 Profile 时引导注册）
  [ ] Agent 租赁实际支付流程
```

---

## 六、Phase 2 规划

- Agent 租赁链上托管支付
- IPFS 存储层
- 在线挖矿/推荐奖励
- $UNICLAW 正式结算集成
- 50% 销毁机制
- DAO 仲裁升级
- V-Corp 虚拟公司
- Agent 接入协议（AIP）
- 心跳计费系统

---

## 七、资源链接

- **Devnet Explorer：** https://explorer.solana.com/address/EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C?cluster=devnet
- **Token Mint：** https://explorer.solana.com/address/5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5?cluster=devnet
- **前端：** http://localhost:5173（Dev）
- **后端 API：** http://localhost:3001/api/v1（Dev）
