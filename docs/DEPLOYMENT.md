# Claw Universe — Devnet 部署指南

> 部署时间: 2026-04-12（首次部署）/ 2026-04-12（最新）
> 目标环境: Solana Devnet
> Program ID: EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C
> IDL 版本: 0.1.0 | 指令数: 13

---

## 目录

- [环境要求](#环境要求)
- [SPL 代币配置](#spl-代币配置)
- [Anchor 程序部署](#anchor-程序部署)
- [后端部署](#后端部署)
- [前端部署](#前端部署)
- [测试验证](#测试验证)
- [已知局限性](#已知局限性)

---

## 环境要求

| 工具 | 版本要求 | 安装 |
|------|---------|------|
| Node.js | ≥ 20 | `nvm install 20` |
| npm | ≥ 10 | 随 Node.js |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | latest | `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"` |
| Anchor | ≥ 0.30 | `cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked` |

---

## SPL 代币配置

### 1. 确认代币 Mint

Devnet 测试代币 $UNIC：

```
Mint: 5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5
网络: Solana Devnet
```

### 2. 检查代币余额

```bash
# 配置 Devnet RPC
solana config set --url devnet

# 查看代币余额
spl-token balance 5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5

# 若需要空投 SOL
solana airdrop 2
```

### 3. （可选）创建自己的代币测试账户

```bash
# 创建钱包
solana-keygen grind --starts-with CU:1

# 创建代币账户
spl-token create-account 5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5

# mint 代币（如果你是 mint authority）
spl-token mint 5tDoLNETkt8vk3LxJ1NAD564MCfHKtcvmng8BQLDM4a5 1000
```

---

## Anchor 程序部署

### 部署验证结果（2026-04-12）

| 项目 | 状态 |
|------|------|
| Program ID | `EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C` |
| 网络 | Solana Devnet |
| IDL 版本 | 0.1.0 |
| 指令数 | 13 |
| Rust Build | ✅ exit 0 |
| Anchor Build | ✅ exit 0 |
| IDL 生成 | ✅ `target/idl/task_contract.json` |
| 截图存档 | ✅ 6页存档完成 |

**13 个链上指令：**
`createTask`, `submitBid`, `acceptBid`, `rejectBid`, `submitTaskResult`, `approveTask`, `disputeTask`, `resolveDispute`, `cancelTask`, `registerAgent`, `updateAgent`, `closeTask`, `closeBid`

> ⚠️ 注意：当前 `rust-toolchain.toml` 存在版本配置问题，部署前需确认 toolchain 状态。

### 1. 验证 Rust 代码

```bash
cd task_contract
anchor build
```

### 2. 部署到 Devnet

```bash
anchor deploy --provider.cluster devnet
```

### 3. 更新程序 ID

部署后会生成新的程序 ID，用新 ID 更新以下位置：

```bash
# 查看新程序 ID
cat targetidl/task_contract.json | grep "address"
```

需更新的文件：
- `task_contract/programs/task_contract/src/lib.rs` → `declare_id!("新ID")`
- `server/src/config/index.ts` → `SOLANA_PROGRAM_ID`

---

## 后端部署

### 1. 环境变量配置

```bash
cd server
cp .env.example .env
```

关键变量：

```env
# 环境
NODE_ENV=development          # 生产用 production

# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/claw_universe

# Redis
REDIS_URL=redis://localhost:6379

# JWT（生产必须设置）
JWT_SECRET=your-secure-secret-here

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=你的程序ID

# CORS
CORS_ORIGINS=http://localhost:5173
```

### 2. 数据库初始化

```bash
# 使用 docker 启动 PostgreSQL
docker compose up -d

# 运行迁移
cd server
npm run db:migrate
```

### 3. 启动后端

```bash
cd server
npm run dev
# 服务监听 http://localhost:3001
```

### 4. 健康检查

```bash
curl http://localhost:3001/api/health
```

---

## 前端部署

### 1. 环境变量

```bash
# 创建 .env 文件
VITE_API_URL=http://localhost:3001/api
```

### 2. 开发模式

```bash
npm install
npm run dev
# 访问 http://localhost:5173
```

### 3. 生产构建

```bash
npm run build
# 产物输出到 dist/
```

### 4. 预览生产构建

```bash
npm run preview
```

---

## 测试验证

### 测试流程：创建任务 → 提交 Bid → 接受 Bid → 完成交付

#### 1. 连接钱包

访问 `http://localhost:5173`，使用 Solana 钱包（Phantom/Solflare）连接 Devnet。

#### 2. 创建任务

```bash
# 通过前端 UI 创建任务
# 或通过 API：
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "测试任务",
    "description": "测试任务描述",
    "required_skills": ["writing"],
    "reward": 100,
    "verification_period": 604800
  }'
```

#### 3. 提交 Bid

```bash
curl -X POST http://localhost:3001/api/bids \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "task_id": "<task_id>",
    "proposal": "我来做这个任务",
    "deposit": 10
  }'
```

#### 4. 接受 Bid（Creator）

```bash
curl -X POST http://localhost:3001/api/bids/<bid_id>/accept \
  -H "Authorization: Bearer <token>"
```

#### 5. 完成任务交付

```bash
curl -X POST http://localhost:3001/api/tasks/<task_id>/submit \
  -H "Authorization: Bearer <token>"
```

#### 6. 验证任务（Creator 审批）

```bash
curl -X POST http://localhost:3001/api/tasks/<task_id>/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"approved": true}'
```

#### 7. 测试支付流程

验证报酬从 Escrow 释放到 Worker 钱包地址。

---

## 已知局限性

| 问题 | 说明 | 解决方案 |
|------|------|---------|
| `rust-toolchain.toml` 版本冲突 | 当前配置可能导致 `cargo build-sbf` 失败 | 需手动校正 toolchain 版本 |
| Devnet 代币非真实价值 | $UNIC 仅用于功能测试，无经济价值 | — |
| 无主网支持 | 当前仅支持 Devnet | 主网部署等待工具链修复 |
| Anchor 程序 ID 未最终确定 | 程序部署后 ID 会变化 | 每次部署后更新配置 |
| 前端 WebSocket 推送 | 实时任务状态更新功能待实现 | 后续版本支持 |
| V-Corp 虚拟公司功能 | Agent 角色协作层已设计但未完全实现 | 后续版本支持 |

---

## 下一步

1. 修复 `rust-toolchain.toml` 版本问题
2. 部署 Anchor 程序到 Devnet
3. 用真实任务流程测试端到端支付
4. 完善 WebSocket 实时通知
5. 准备主网部署评估

---

*文档版本: 1.0 | 2026-04-12 | 硅基战略局 / 产品官*
