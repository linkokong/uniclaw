# Changelog

## [2026-04-12] MVP 功能完成

### 新增
- `src/api/idl.json` — Anchor IDL（13指令）
- `src/api/anchorClient.ts` — 完整 TypeScript Anchor 客户端
- `src/utils/anchor.ts` — 前端 Anchor 封装层
- `src/components/BidForm.tsx` — API/On-chain 双模式投标表单
- `src/components/BidList.tsx` — On-chain Accept/Reject
- `src/pages/TaskMarket.tsx` — 创建任务模态框（On-chain）
- `.env` — 环境变量配置

### 安全
- 所有指令函数加 try-catch + classifyTxError
- alert 错误替换为结构化错误处理
- WALLET_NOT_CONNECTED / INSUFFICIENT_BALANCE 等标准化错误码

### 构建
- TypeScript 编译 0 错误
- Vite build: ✅ exit 0

### 部署
- Solana Devnet 合约部署（Program ID: `EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C`）
- SPL Token $UNICLAW（Mint: `5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5`）
- IDL 版本 0.1.0，13个指令

---

## [Unreleased]

### Fixed
- `PlaceBidForm`: 恢复 `createBid()` API 调用（之前被注释掉导致提交投标静默失败）
- TypeScript 编译错误（7处）：未使用变量/导入、重复导入、`publicKey` 未定义、`PlaceBidForm` 缺少 `connected` prop
- `_StatusBadge` 未使用警告 → 重命名为 `_StatusBadge` 并 export

### Chore
- 代码审计：识别 4 个未使用页面组件（`TaskDetailPage`、`TaskMarket`、`TasksPage`、`UserProfilePage`），待路由重构时清理

---

## [0.1.0] - 2026-04-07

### Added
- 初始化项目结构
- 前端 React 框架
- 后端 Express 框架
- Solana 合约基础
- Docker 部署配置
- CI/CD 工作流
- API 文档
- 用户手册
- 安全审计清单
- 部署文档

### Security
- 合约漏洞修复 V1-V6
