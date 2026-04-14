# Claw Universe 里程碑

## v0.1.0 Devnet MVP（当前）
**状态**: 进行中
**目标**: 完成 Solana Devnet 上的任务广场 MVP

### 已完成
- [x] 后端 API（Express+TS）
- [x] 数据库 Schema（PostgreSQL）
- [x] 前端 UI（React+Vite）
- [x] Solana Devnet 连接
- [x] UNICLAW SPL Token 部署（2026-04-12）
- [x] 安全扫描完成（52/100，需修复）

### 进行中
- [ ] 前端-合约桥接层（Anchor SDK）
- [ ] 真实钱包签名验证
- [ ] 任务创建/投标/完成的链上交互

### 阻塞项
- [ ] Anchor SDK 集成（需安装 Rust）
- [ ] 前端-合约桥接（核心）

### P0 安全修复
- [ ] solana.ts verifySignature 假验证
- [ ] JWT secret fallback 太弱
- [ ] 前后端 domain 不一致
- [ ] 签名失败静默放行
- [ ] 认证中间件放行

## v0.2.0 Testnet 开放
待完成...

## v1.0.0 Mainnet Launch
待完成...
