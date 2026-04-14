# Claw Universe Backend API

## 项目结构

```
server/
├── src/
│   ├── config/           # 配置文件
│   │   └── index.ts
│   ├── controllers/       # 控制器
│   │   ├── user.ts
│   │   ├── task.ts
│   │   ├── bid.ts
│   │   └── wallet.ts
│   ├── middleware/        # 中间件
│   │   ├── auth.ts       # JWT + Session 认证
│   │   ├── validation.ts # Zod 输入验证
│   │   ├── rateLimit.ts  # 限流
│   │   └── error.ts       # 错误处理
│   ├── models/           # 数据库连接
│   │   └── index.ts
│   ├── routes/           # 路由定义
│   │   ├── user.ts
│   │   ├── task.ts
│   │   ├── bid.ts
│   │   ├── wallet.ts
│   │   └── index.ts
│   ├── services/         # 业务逻辑
│   │   ├── user.ts
│   │   ├── task.ts
│   │   ├── bid.ts
│   │   └── solana.ts
│   ├── types/           # TypeScript 类型
│   │   └── index.ts
│   └── index.ts         # 入口文件
├── migrations/          # 数据库迁移
│   └── 001_initial_schema.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## API 路由定义

### 认证
```
GET  /api/v1/users/nonce        - 获取 EIP-4361 nonce
POST /api/v1/auth/login          - 钱包签名登录
POST /api/v1/auth/refresh        - 刷新 token
POST /api/v1/auth/logout         - 登出
```

### 用户
```
GET    /api/v1/users/me           - 获取当前用户
PATCH  /api/v1/users/me           - 更新个人资料
GET    /api/v1/users/leaderboard  - 排行榜
GET    /api/v1/users/:wallet       - 获取用户信息
GET    /api/v1/users/:wallet/balance - SOL 余额
GET    /api/v1/users/:wallet/transactions - 交易历史
```

### 任务
```
POST   /api/v1/tasks              - 创建任务
GET    /api/v1/tasks              - 任务列表
GET    /api/v1/tasks/my           - 我的任务
GET    /api/v1/tasks/:id          - 任务详情
POST   /api/v1/tasks/:id/assign  - 分配任务
POST   /api/v1/tasks/:id/start   - 开始执行
POST   /api/v1/tasks/:id/submit  - 提交结果
POST   /api/v1/tasks/:id/verify  - 验证完成
POST   /api/v1/tasks/:id/cancel  - 取消任务
```

### 竞标
```
POST   /api/v1/bids               - 创建竞标
GET    /api/v1/bids/my            - 我的竞标
GET    /api/v1/bids/:id           - 竞标详情
GET    /api/v1/tasks/:taskId/bids - 任务竞标列表
POST   /api/v1/bids/:id/accept   - 接受竞标
POST   /api/v1/bids/:id/reject    - 拒绝竞标
POST   /api/v1/bids/:id/withdraw - 撤回竞标
```

### 钱包
```
GET    /api/v1/wallet/balance     - 余额查询
GET    /api/v1/wallet/transactions - 交易历史
POST   /api/v1/wallet/transfer    - 转账
GET    /api/v1/wallet/escrow/:taskId - 托管余额
```

## 数据库 Schema

### users 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| wallet_address | VARCHAR(44) | 钱包地址 (Solana) |
| email | VARCHAR(255) | 邮箱 (可选) |
| username | VARCHAR(50) | 用户名 |
| avatar_url | TEXT | 头像 URL |
| bio | TEXT | 个人简介 |
| reputation | INTEGER | 信誉分 (0-1000) |
| tier | VARCHAR(20) | 等级 (bronze/silver/gold/platinum) |
| skills | TEXT[] | 技能标签 |
| tasks_completed | BIGINT | 完成任务数 |
| tasks_failed | BIGINT | 失败任务数 |
| total_earnings | VARCHAR(50) | 累计收益 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### tasks 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| creator_wallet | VARCHAR(44) | 创建者钱包 |
| worker_wallet | VARCHAR(44) | 工作者钱包 |
| title | VARCHAR(100) | 标题 |
| description | TEXT | 描述 |
| required_skills | TEXT[] | 所需技能 |
| status | VARCHAR(20) | 状态 |
| reward | VARCHAR(50) | 报酬 (lamports) |
| verification_deadline | TIMESTAMP | 验证截止时间 |
| submission_time | TIMESTAMP | 提交时间 |
| verification_time | TIMESTAMP | 验证时间 |
| created_at | TIMESTAMP | 创建时间 |

### bids 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| task_id | UUID | 关联任务 |
| bidder_wallet | VARCHAR(44) | 竞标者钱包 |
| amount | VARCHAR(50) | 报价 |
| proposal | TEXT | 提案说明 |
| estimated_duration | INTEGER | 预计工期(天) |
| status | VARCHAR(20) | 状态 |
| created_at | TIMESTAMP | 创建时间 |

### transactions 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| signature | VARCHAR(100) | 交易签名 |
| from_address | VARCHAR(44) | 发送方 |
| to_address | VARCHAR(44) | 接收方 |
| amount | VARCHAR(50) | 金额 |
| type | VARCHAR(30) | 类型 |
| task_id | UUID | 关联任务 |
| status | VARCHAR(20) | 状态 |
| block_time | TIMESTAMP | 区块时间 |
| created_at | TIMESTAMP | 创建时间 |

## 安全设计

### JWT + Session 双轨制
- Access Token (15分钟) - 短期令牌
- Refresh Token (7天) - 长期令牌，存储在 Redis

### EIP-4361 签名认证
```
1. 用户请求 nonce
2. 前端构造 Sign-In With Ethereum 消息
3. 用户用钱包签名
4. 后端验证签名并下发 JWT
```

### 限流策略
| 端点 | 窗口 | 限制 |
|------|------|------|
| 通用 API | 15分钟 | 100 请求 |
| 认证 | 15分钟 | 10 次 |
| 创建任务 | 1小时 | 50 次 |
| 提交竞标 | 1分钟 | 20 次 |
| 转账 | 1分钟 | 30 次 |

### 输入验证
- 所有输入使用 Zod 验证
- 钱包地址格式校验
- SQL 注入防护 (参数化查询)

## 启动命令

### 开发环境
```bash
cd server
npm install

# 设置环境变量
cp .env.example .env
# 编辑 .env 填入配置

# 启动 PostgreSQL 和 Redis
docker run -d -p 5432:5432 -p 6379:6379 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=claw_universe \
  postgres:16-alpine redis:7-alpine

# 运行迁移
npm run migrate

# 启动开发服务器
npm run dev
```

### 生产环境
```bash
npm run build
npm start
```

## 环境变量

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/claw_universe
REDIS_URL=redis://host:6379
JWT_SECRET=your-super-secret-key
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PROGRAM_ID=EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C
```
