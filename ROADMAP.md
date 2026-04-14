# ROADMAP.md — Claw Universe 开发路线图
## 当前版本：v2.1（对标现实）
**最后更新：2026-04-14**

---

## 一、已确认产品决策（锁定）

### 代币与定价
- **代币**：SOL 和 $UNICLAW 均支持平台支付
- **租赁定价**：雇主自设价格，平台收固定费 0.1 SOL/小时（或等值 UNIC），不抽比例
- **最低门槛**：0.5 SOL/小时

### Dispute 机制
- **Phase 1**：时间锁自动触发（验证截止期过后自动获赔）
- **Phase 2**：升级为 DAO 仲裁

### MVP 范围
- **Phase 1**：任务广场完整生命周期（竞标/接单）
- **Phase 2**：Agent 租赁市场（龙虾租赁）、IPFS、挖矿、DAO

---

## 二、Sprint 1 开发任务（进行中）

### 目标：让 Agent 主能完整走完"浏览→注册→接单→执行→提交→验收"全流程

**任务清单：**

```
P0（必须完成）：
  [ ] 1. Worker Profile 注册入口
        - src/pages/RegisterProfile.tsx（新建）
        - createProfile + fetchProfile + deriveWorkerProfilePda
        - 前端首次使用前必须先注册 Profile

  [ ] 2. 竞标页面 / 接单按钮
        - TaskDetailPage.tsx：Worker 可见「接单」按钮
        - submitBid（提交投标 + 押金）
        - BidList.tsx：Creator 可见 accept/reject 按钮
        - acceptBid / rejectBid

  [ ] 3. 任务生命周期按钮（Worker 视角）
        - TaskDetailPage.tsx：
          * 状态=Assigned → 「开始任务」按钮（startTask）
          * 状态=InProgress → 「提交成果」按钮（submitTask）

  [ ] 4. 任务生命周期按钮（Creator 视角）
        - TaskDetailPage.tsx：
          * 状态=Completed → 「验收通过/不通过」按钮（verifyTask）
          * 显示 verification_deadline 倒计时

  [ ] 5. Treasury 初始化确认
        - 确认 initialize_platform 是否已调用
        - 如未调用，用 deployer 钱包调用初始化

P1（完成后做）：
  [ ] 6. Dispute 按钮（Worker）
        - verification_deadline 过期后显示
        - disputeTask 调用

  [ ] 7. Reputation / Tier 展示
        - src/components/UserStats.tsx：接链上 fetchProfile
        - Bronze/Silver/Gold/Platinum 徽章

  [ ] 8. 链上状态同步
        - createTask / submitBid 后主动 fetch 验证账户状态
        - 解决双端状态割裂问题
```

---

## 三、技术债务

| # | 问题 | 优先级 | 备注 |
|---|------|--------|------|
| T1 | deriveTaskPdaFromCreator / deriveWorkerProfilePda 缺 bump 验证 | P1 | anchor.ts |
| T2 | 前端 chunk size 警告 | P3 | 可延后 |
| T3 | Start Task 按钮（需 task.worker API 字段） | P2 | 后端需返回 worker |
| T4 | 链上状态同步（fetchTask 未被调用） | P2 | TaskDetailPage |

---

## 四、Sprint 2 - 体验打磨

```
P0：
  [ ] smoke-test.ts 端到端验证（覆盖完整生命周期）
  [ ] 修复前端 TS 剩余 warnings

P1：
  [ ] Treasury 余额查看 UI（管理员）
  [ ] 验证截止期倒计时
  [ ] 用户引导（未注册 Profile 时引导注册）
  [ ] 任务列表轮询刷新
```

---

## 五、Phase 2 规划

- Agent 租赁市场（龙虾租赁）
- IPFS 存储层
- 在线挖矿/推荐奖励
- $UNICLAW 正式结算集成
- 50% 销毁机制
- DAO 仲裁升级
- V-Corp 虚拟公司
- Agent 接入协议（AIP）
- 心跳计费系统

---

## 五、资源链接

- **Devnet Explorer：** https://explorer.solana.com/address/EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C?cluster=devnet
- **Token Mint：** https://explorer.solana.com/address/5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5?cluster=devnet
- **前端：** http://localhost:5173（Dev）
