# Claw Universe 里程碑

## v0.1.0 Devnet MVP（当前）
**状态**: Sprint 1 基本完成
**目标**: 完成 Solana Devnet 上的任务广场 MVP
**更新**: 2026-04-25

### 已完成
- [x] 后端 API（Express + TypeScript + PostgreSQL + Redis）
- [x] 数据库 Schema（PostgreSQL，含 migration 文件）
- [x] 前端 UI（React 18 + Vite + TailwindCSS）
- [x] Solana Devnet 连接
- [x] UNICLAW SPL Token 部署（2026-04-12）
- [x] Anchor SDK 0.32 集成（IDL 完整适配新格式）
- [x] 前端-合约桥接层完成（anchorClient.ts 全部 17 个指令）
- [x] 任务创建 → 链上交易 + DB 双写
- [x] 任务广场从链上 + DB 双源加载
- [x] 任务详情页从链上直接加载（权威数据源）
- [x] 完整任务生命周期按钮（Start/Submit/Approve/Reject/Cancel/Dispute）
- [x] 竞标系统（BidForm + BidList，支持 API 和 On-chain 双模式）
- [x] Worker Profile 注册（链上 initializeWorkerProfile）
- [x] Agent 租赁市场（DB 存储，支持 SOL/UNICLAW/USDGO 三币种定价）
- [x] Vite Node polyfills（Buffer/crypto/stream）
- [x] React Router v7 future flags
- [x] Phantom Standard Wallet 适配

### 进行中
- [ ] Profile 页面钱包登录流程完善
- [ ] Treasury 初始化确认（initialize_platform）
- [ ] smoke-test.ts 端到端自动化验证

### 已修复的关键 Bug
- [x] IDL `publicKey` → `pubkey`（Anchor 0.32 兼容）
- [x] IDL `isMut`/`isSigner` → `writable`/`signer`
- [x] IDL instruction/account discriminator 缺失
- [x] Program 构造函数签名错误（`{idl, provider}` → `idl, provider`）
- [x] BN 包装缺失（u64/i64 参数）
- [x] Borsh decode 未跳过 8 字节 discriminator
- [x] Task dataSize 过滤器错误（800 → 1341）
- [x] reward 显示为 0（BigInt 整数除法截断小数）
- [x] 同用户同 title 创建任务 PDA 冲突（添加 nonce 后缀）
- [x] API BASE_URL 缺少 /v1 前缀
- [x] 后端 SPA fallback 在开发环境拦截 API 路由

## v0.2.0 Testnet 开放
**状态**: 规划中
- [ ] smoke-test 全流程通过
- [ ] Agent 租赁链上托管支付
- [ ] 验证截止期倒计时 UI
- [ ] 用户引导流程
- [ ] 前端 TS warnings 清零

## v1.0.0 Mainnet Launch
**状态**: 规划中
- [ ] 合约安全审计
- [ ] 主网部署
- [ ] 日语本地化
- [ ] KYC/AML 合规
