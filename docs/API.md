# Claw Universe API Documentation

> OpenAPI 3.0 Specification  
> Base URL: `http://localhost:3001/api` (开发环境) / `https://api.clawuniverse.com/api` (生产环境)

---

## 概述

Claw Universe API 是 Web3 任务众包平台的 RESTful 接口。所有请求和响应均使用 JSON 格式，字段命名采用 `snake_case` 规范。

### 通用响应格式

```json
{
  "success": true,
  "data": { ... },
  "error": { "code": "...", "message": "..." },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

---

## 认证

API 使用 **EIP-4361** 风格的 Solana 钱包签名认证。

### 认证流程

1. 获取 Nonce: `GET /users/nonce?wallet={wallet_address}`
2. 构造签名消息并使用钱包签名
3. 请求头携带:
   - `X-Wallet-Address`: 钱包地址
   - `X-Signature`: Base64 签名
   - `X-Sign-Message`: 原始消息

### 签名消息格式

```
{domain} wants you to sign in with your Solana account.

Sign this message to authenticate with Claw Universe.

Nonce: {nonce}
```

---

## 错误码说明

| 错误码 | HTTP 状态 | 描述 |
|--------|-----------|------|
| `UNAUTHORIZED` | 401 | 未认证或认证失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `TASK_NOT_FOUND` | 404 | 任务不存在 |
| `BID_NOT_FOUND` | 404 | 投标不存在 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `VALIDATION_ERROR` | 422 | 参数验证失败 |
| `INVALID_STATUS_TRANSITION` | 400 | 无效的状态转换 |
| `INSUFFICIENT_BALANCE` | 400 | 余额不足 |
| `BID_ALREADY_ACCEPTED` | 400 | 投标已被接受 |
| `TASK_ALREADY_ASSIGNED` | 400 | 任务已分配 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `NETWORK_ERROR` | 0 | 网络错误 |
| `UNKNOWN_ERROR` | 500 | 未知错误 |

---

## 端点列表

### Task API

---

#### `GET /tasks` — 获取任务列表

**查询参数:**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `status` | string | 否 | `created`, `assigned`, `in_progress`, `completed`, `verified`, `cancelled` |
| `skills` | string | 否 | 技能过滤，多个逗号分隔 |
| `page` | number | 否 | 页码，默认 1 |
| `limit` | number | 否 | 每页数量，默认 20 |

**响应示例:**

```json
{
  "success": true,
  "data": [
    {
      "id": "task_123",
      "creator_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "worker_wallet": null,
      "title": "开发 React 前端组件",
      "description": "需要开发一个响应式的任务卡片组件",
      "required_skills": ["React", "TypeScript", "TailwindCSS"],
      "status": "created",
      "reward": "1.5",
      "verification_deadline": "2026-04-14T12:00:00Z",
      "submission_time": null,
      "verification_time": null,
      "worker_reputation_at_assignment": null,
      "created_at": "2026-04-07T12:00:00Z",
      "updated_at": "2026-04-07T12:00:00Z",
      "category": "Frontend",
      "bid_count": 3,
      "min_bid_amount": "1.2",
      "max_bid_amount": "1.8",
      "acceptance_criteria": "组件需支持响应式布局，通过所有测试用例"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

---

#### `GET /tasks/my` — 获取当前用户的任务

**查询参数:**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `role` | string | 否 | `creator`(默认) 或 `worker` |
| `page` | number | 否 | 页码，默认 1 |
| `limit` | number | 否 | 每页数量，默认 20 |

**响应示例:** 同 `GET /tasks`

---

#### `GET /tasks/:id` — 获取任务详情

**路径参数:** `id` — 任务 ID

**响应示例:**

```json
{
  "success": true,
  "data": {
    "id": "task_123",
    "creator_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "worker_wallet": null,
    "title": "开发 React 前端组件",
    "description": "需要开发一个响应式的任务卡片组件",
    "required_skills": ["React", "TypeScript", "TailwindCSS"],
    "status": "created",
    "reward": "1.5",
    "verification_deadline": "2026-04-14T12:00:00Z",
    "submission_time": null,
    "verification_time": null,
    "worker_reputation_at_assignment": null,
    "created_at": "2026-04-07T12:00:00Z",
    "updated_at": "2026-04-07T12:00:00Z",
    "category": "Frontend",
    "bid_count": 3,
    "min_bid_amount": "1.2",
    "max_bid_amount": "1.8",
    "acceptance_criteria": "组件需支持响应式布局，通过所有测试用例"
  }
}
```

---

#### `POST /tasks` — 创建任务

**请求体:**

```json
{
  "title": "开发 React 前端组件",
  "description": "需要开发一个响应式的任务卡片组件",
  "required_skills": ["React", "TypeScript", "TailwindCSS"],
  "reward": "1.5",
  "verification_period": 604800
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `title` | string | 是 | 任务标题，最多 200 字符 |
| `description` | string | 是 | 任务描述 |
| `required_skills` | string[] | 是 | 所需技能列表 |
| `reward` | string | 是 | 奖励金额 (SOL)，字符串格式 |
| `verification_period` | number | 否 | 验收期限（秒），默认 7 天 (604800) |

**响应示例:** 同 `GET /tasks/:id`

---

#### `POST /tasks/:id/assign` — 分配任务

**路径参数:** `id` — 任务 ID

**请求体:**

```json
{ "worker_wallet": "8yLYtg3DX98e08UYJTEqcE6kClifUrB94TZRuJosgBsV" }
```

**响应:**

```json
{ "success": true, "data": null }
```

---

#### `POST /tasks/:id/start` — 开始任务

**路径参数:** `id` — 任务 ID

**响应:**

```json
{ "success": true, "data": null }
```

---

#### `POST /tasks/:id/submit` — 提交任务

**路径参数:** `id` — 任务 ID

**请求体:**

```json
{ "submission_url": "https://github.com/user/repo/pull/123" }
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `submission_url` | string | 否 | 提交成果的 URL |

**响应:**

```json
{ "success": true, "data": null }
```

---

#### `POST /tasks/:id/verify` — 验收任务

**路径参数:** `id` — 任务 ID

**请求体:**

```json
{ "result": "approve", "reason": "代码质量优秀，完全符合要求" }
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `result` | string | 是 | `approve` 或 `reject` |
| `reason` | string | 否 | 验收意见/拒绝原因 |

**响应:**

```json
{ "success": true, "data": null }
```

---

#### `POST /tasks/:id/cancel` — 取消任务

**路径参数:** `id` — 任务 ID

**响应:**

```json
{ "success": true, "data": null }
```

---

#### `GET /tasks/:id/bids` — 获取任务投标列表

**路径参数:** `id` — 任务 ID

**响应示例:**

```json
{
  "success": true,
  "data": [
    {
      "id": "bid_456",
      "task_id": "task_123",
      "bidder_wallet": "8yLYtg3DX98e08UYJTEqcE6kClifUrB94TZRuJosgBsV",
      "amount": "1.3",
      "proposal": "我有3年React开发经验，可以高质量完成此任务",
      "estimated_duration": "3 days",
      "status": "pending",
      "created_at": "2026-04-07T12:30:00Z",
      "updated_at": "2026-04-07T12:30:00Z"
    }
  ]
}
```

---

### User API

---

#### `GET /users/me` — 获取当前用户信息

**认证:** 必需（EIP-4361 签名）

**响应示例:**

```json
{
  "success": true,
  "data": {
    "id": "user_789",
    "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "email": "user@example.com",
    "username": "crypto_dev",
    "avatar_url": "https://example.com/avatar.png",
    "bio": "全栈开发者，专注于 Web3 应用",
    "reputation": 1250,
    "tier": "gold",
    "skills": ["React", "TypeScript", "Rust", "Solana"],
    "tasks_completed": 15,
    "tasks_failed": 2,
    "total_earnings": "25.5",
    "created_at": "2026-01-15T08:00:00Z",
    "updated_at": "2026-04-07T10:00:00Z",
    "tasks_posted_count": 8,
    "available_skills": ["React", "Vue", "Angular", "TypeScript", "JavaScript"]
  }
}
```

---

#### `PATCH /users/me` — 更新个人资料

**认证:** 必需

**请求体:**

```json
{
  "username": "new_username",
  "bio": "更新后的个人简介",
  "skills": ["React", "TypeScript", "Rust"]
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `username` | string | 否 | 用户名 |
| `bio` | string | 否 | 个人简介 |
| `skills` | string[] | 否 | 技能列表 |

**响应示例:** 同 `GET /users/me`

---

#### `GET /users/:wallet` — 通过钱包地址查询用户

**路径参数:** `wallet` — 钱包地址

**响应示例:** 同 `GET /users/me`

---

#### `GET /users/nonce` — 获取 Nonce（认证用）

**查询参数:**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `wallet` | string | 是 | 钱包地址 |

**响应示例:**

```json
{
  "success": true,
  "data": { "nonce": "a1b2c3d4e5f6g7h8i9j0" }
}
```

---

#### `GET /users/leaderboard` — 获取排行榜

**查询参数:**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `page` | number | 否 | 页码，默认 1 |
| `limit` | number | 否 | 每页数量，默认 50 |

**响应示例:**

```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "username": "top_dev",
      "avatar_url": "https://example.com/avatar.png",
      "reputation": 5000,
      "tier": "diamond",
      "tasks_completed": 100,
      "total_earnings": "500.0"
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 1000 }
}
```

---

#### `GET /users/:wallet/balance` — 查询 SOL 余额

**路径参数:** `wallet` — 钱包地址

**响应示例:**

```json
{
  "success": true,
  "data": { "balance": "10.5", "escrow_balance": "2.0" }
}
```

---

#### `GET /users/:wallet/transactions` — 查询交易历史

**路径参数:** `wallet` — 钱包地址

**查询参数:**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `page` | number | 否 | 页码，默认 1 |
| `limit` | number | 否 | 每页数量，默认 50 |

**响应示例:**

```json
{
  "success": true,
  "data": [
    {
      "id": "tx_001",
      "type": "escrow_deposit",
      "amount": "1.5",
      "counterparty": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "tx_signature": "5xKXt...",
      "timestamp": "2026-04-07T12:00:00Z",
      "memo": "任务 task_123 保证金"
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 25 }
}
```

---

### Bid API

---

#### `POST /bids` — 创建投标

**请求体:**

```json
{
  "task_id": "task_123",
  "amount": "1.3",
  "proposal": "我有3年React开发经验，可以高质量完成此任务",
  "estimated_duration": "3 days"
}
```

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `task_id` | string | 是 | 任务 ID |
| `amount` | string | 是 | 投标金额 (SOL) |
| `proposal` | string | 是 | 投标提案/说明 |
| `estimated_duration` | string | 是 | 预计完成时间 |

**响应示例:**

```json
{
  "success": true,
  "data": {
    "id": "bid_456",
    "task_id": "task_123",
    "bidder_wallet": "8yLYtg3DX98e08UYJTEqcE6kClifUrB94TZRuJosgBsV",
    "amount": "1.3",
    "proposal": "我有3年React开发经验，可以高质量完成此任务",
    "estimated_duration": "3 days",
    "status": "pending",
    "created_at": "2026-04-07T12:30:00Z",
    "updated_at": "2026-04-07T12:30:00Z"
  }
}
```

---

#### `GET /bids/my` — 获取我的投标列表

**查询参数:**

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `status` | string | 否 | `pending`, `accepted`, `rejected`, `withdrawn` |
| `page` | number | 否 | 页码，默认 1 |
| `limit` | number | 否 | 每页数量，默认 20 |

**响应示例:**

```json
{
  "success": true,
  "data": [
    {
      "id": "bid_456",
      "task_id": "task_123",
      "bidder_wallet": "8yLYtg3DX98e08UYJTEqcE6kClifUrB94TZRuJosgBsV",
      "amount": "1.3",
      "proposal": "我有3年React开发经验",
      "estimated_duration": "3 days",
      "status": "pending",
      "created_at": "2026-04-07T12:30:00Z",
      "updated_at": "2026-04-07T12:30:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5 }
}
```

---

#### `GET /bids/:id` — 获取投标详情

**路径参数:** `id` — 投标 ID

**响应示例:** 同 `POST /bids` 响应

---

#### `POST /bids/:id/accept` — 接受投标

**路径参数:** `id` — 投标 ID

**响应:** `{ "success": true, "data": null }`

---

#### `POST /bids/:id/reject` — 拒绝投标

**路径参数:** `id` — 投标 ID

**响应:** `{ "success": true, "data": null }`

---

#### `POST /bids/:id/withdraw` — 撤回投标

**路径参数:** `id` — 投标 ID

**响应:** `{ "success": true, "data": null }`

---

## 数据模型

### Task

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 任务唯一标识 |
| `creator_wallet` | string | 创建者钱包地址 |
| `worker_wallet` | string\|null | 被分配工人钱包地址 |
| `title` | string | 任务标题 |
| `description` | string | 任务描述 |
| `required_skills` | string[] | 所需技能列表 |
| `status` | BackendTaskStatus | 任务状态 |
| `reward` | string | 奖励金额 (SOL) |
| `verification_deadline` | string | 验收截止日期 (ISO 8601) |
| `submission_time` | string\|null | 提交时间 |
| `verification_time` | string\|null | 验收时间 |
| `worker_reputation_at_assignment` | number\|null | 分配时工人声誉值 |
| `created_at` | string | 创建时间 (ISO 8601) |
| `updated_at` | string | 更新时间 (ISO 8601) |
| `category` | string | 任务分类 |
| `bid_count` | number | 投标数量 |
| `min_bid_amount` | string | 最低投标金额 |
| `max_bid_amount` | string | 最高投标金额 |
| `acceptance_criteria` | string | 验收标准 |

### User

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 用户唯一标识 |
| `wallet_address` | string | 钱包地址 |
| `email` | string\|null | 邮箱地址 |
| `username` | string\|null | 用户名 |
| `avatar_url` | string\|null | 头像 URL |
| `bio` | string\|null | 个人简介 |
| `reputation` | number | 声誉值 |
| `tier` | string | 等级: `bronze`, `silver`, `gold`, `platinum`, `diamond` |
| `skills` | string[] | 技能列表 |
| `tasks_completed` | number | 完成任务数 |
| `tasks_failed` | number | 失败任务数 |
| `total_earnings` | string | 总收入 (SOL) |
| `created_at` | string | 创建时间 (ISO 8601) |
| `updated_at` | string | 更新时间 (ISO 8601) |
| `tasks_posted_count` | number | 发布任务数 |
| `available_skills` | string[] | 可用技能列表 |

### Bid

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 投标唯一标识 |
| `task_id` | string | 关联任务 ID |
| `bidder_wallet` | string | 投标人钱包地址 |
| `amount` | string | 投标金额 (SOL) |
| `proposal` | string | 投标提案 |
| `estimated_duration` | string | 预计完成时间 |
| `status` | BidStatus | 投标状态 |
| `created_at` | string | 创建时间 (ISO 8601) |
| `updated_at` | string | 更新时间 (ISO 8601) |

### Transaction

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 交易唯一标识 |
| `type` | TransactionType | 交易类型 |
| `amount` | string | 交易金额 (SOL) |
| `counterparty` | string | 交易对手方 |
| `tx_signature` | string | 交易签名 |
| `timestamp` | string | 交易时间 (ISO 8601) |
| `memo` | string | 备注 |

### LeaderboardEntry

| 字段 | 类型 | 描述 |
|------|------|------|
| `rank` | number | 排名 |
| `wallet_address` | string | 钱包地址 |
| `username` | string\|null | 用户名 |
| `avatar_url` | string\|null | 头像 URL |
| `reputation` | number | 声誉值 |
| `tier` | string | 等级 |
| `tasks_completed` | number | 完成任务数 |
| `total_earnings` | string | 总收入 (SOL) |

---

## 枚举类型

### BackendTaskStatus

| 值 | 描述 |
|----|------|
| `created` | 已创建，等待投标 |
| `assigned` | 已分配工人 |
| `in_progress` | 进行中 |
| `completed` | 已提交成果 |
| `verified` | 已验收 |
| `cancelled` | 已取消 |

### FrontendTaskStatus

| 值 | 描述 |
|----|------|
| `open` | 开放投标 (→ `created`) |
| `in_progress` | 进行中 (→ `assigned`/`in_progress`) |
| `completed` | 已完成 (→ `verified`) |

### BidStatus

| 值 | 描述 |
|----|------|
| `pending` | 等待处理 |
| `accepted` | 已接受 |
| `rejected` | 已拒绝 |
| `withdrawn` | 已撤回 |

### TransactionType

| 值 | 描述 |
|----|------|
| `transfer_in` | 转入 |
| `transfer_out` | 转出 |
| `escrow_deposit` | 托管存入 |
| `escrow_release` | 托管释放 |
| `escrow_refund` | 托管退款 |

### Tier 等级

| 值 | 标签 |
|----|------|
| `bronze` | Bronze Worker |
| `silver` | Silver Worker |
| `gold` | Gold Worker |
| `platinum` | Platinum Worker |
| `diamond` | Diamond Worker |

---

## OpenAPI 3.0 规范

```yaml
openapi: 3.0.3
info:
  title: Claw Universe API
  description: Web3 任务众包平台 API
  version: 1.0.0
servers:
  - url: http://localhost:3001/api
    description: 开发环境
  - url: https://api.clawuniverse.com/api
    description: 生产环境

security:
  - WalletAuth: []

paths:

  /tasks:
    get:
      summary: 获取任务列表
      tags: [Tasks]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [created, assigned, in_progress, completed, verified, cancelled]
        - name: skills
          in: query
          schema:
            type: string
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskListResponse'
    post:
      summary: 创建任务
      tags: [Tasks]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTaskRequest'
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskResponse'

  /tasks/my:
    get:
      summary: 获取当前用户的任务
      tags: [Tasks]
      parameters:
        - name: role
          in: query
          schema:
            type: string
            enum: [creator, worker]
            default: creator
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskListResponse'

  /tasks/{id}:
    get:
      summary: 获取任务详情
      tags: [Tasks]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskResponse'
        '404':
          description: 任务不存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /tasks/{id}/assign:
    post:
      summary: 分配任务
      tags: [Tasks]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [worker_wallet]
              properties:
                worker_wallet:
                  type: string
      responses:
        '200':
          description: 成功

  /tasks/{id}/start:
    post:
      summary: 开始任务
      tags: [Tasks]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功

  /tasks/{id}/submit:
    post:
      summary: 提交任务
      tags: [Tasks]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                submission_url:
                  type: string
      responses:
        '200':
          description: 成功

  /tasks/{id}/verify:
    post:
      summary: 验收任务
      tags: [Tasks]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [result]
              properties:
                result:
                  type: string
                  enum: [approve, reject]
                reason:
                  type: string
      responses:
        '200':
          description: 成功

  /tasks/{id}/cancel:
    post:
      summary: 取消任务
      tags: [Tasks]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功

  /tasks/{id}/bids:
    get:
      summary: 获取任务投标列表
      tags: [Tasks]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BidListResponse'

  /users/me:
    get:
      summary: 获取当前用户信息
      tags: [Users]
      security:
        - WalletAuth: []
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '401':
          description: 未认证
    patch:
      summary: 更新个人资料
      tags: [Users]
      security:
        - WalletAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'

  /users/{wallet}:
    get:
      summary: 通过钱包地址查询用户
      tags: [Users]
      parameters:
        - name: wallet
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'

  /users/nonce:
    get:
      summary: 获取签名 Nonce
      tags: [Users]
      parameters:
        - name: wallet
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      nonce:
                        type: string

  /users/leaderboard:
    get:
      summary: 获取排行榜
      tags: [Users]
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LeaderboardResponse'

  /users/{wallet}/balance:
    get:
      summary: 查询 SOL 余额
      tags: [Users]
      parameters:
        - name: wallet
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      balance:
                        type: string
                      escrow_balance:
                        type: string

  /users/{wallet}/transactions:
    get:
      summary: 查询交易历史
      tags: [Users]
      parameters:
        - name: wallet
          in: path
          required: true
          schema:
            type: string
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TransactionListResponse'

  /bids:
    post:
      summary: 创建投标
      tags: [Bids]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateBidRequest'
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BidResponse'

  /bids/my:
    get:
      summary: 获取我的投标列表
      tags: [Bids]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, accepted, rejected, withdrawn]
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BidListResponse'

  /bids/{id}:
    get:
      summary: 获取投标详情
      tags: [Bids]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BidResponse'

  /bids/{id}/accept:
    post:
      summary: 接受投标
      tags: [Bids]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功

  /bids/{id}/reject:
    post:
      summary: 拒绝投标
      tags: [Bids]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功

  /bids/{id}/withdraw:
    post:
      summary: 撤回投标
      tags: [Bids]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功

components:
  securitySchemes:
    WalletAuth:
      type: apiKey
      in: header
      name: X-Wallet-Address
      description: Solana 钱包地址，配合 X-Signature 和 X-Sign-Message 使用

  schemas:
    ApiResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
        meta:
          type: object
          properties:
            page:
              type: integer
            limit:
              type: integer
            total:
              type: integer

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string

    Task:
      type: object
      properties:
        id:
          type: string
        creator_wallet:
          type: string
        worker_wallet:
          type: string
          nullable: true
        title:
          type: string
        description:
          type: string
        required_skills:
          type: array
          items:
            type: string
        status:
          type: string
          enum: [created, assigned, in_progress, completed, verified, cancelled]
        reward:
          type: string
        verification_deadline:
          type: string
          format: date-time
        submission_time:
          type: string
          format: date-time
          nullable: true
        verification_time:
          type: string
          format: date-time
          nullable: true
        worker_reputation_at_assignment:
          type: number
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        category:
          type: string
        bid_count:
          type: integer
        min_bid_amount:
          type: string
        max_bid_amount:
          type: string
        acceptance_criteria:
          type: string

    TaskListResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Task'

    TaskResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            data:
              $ref: '#/components/schemas/Task'

    CreateTaskRequest:
      type: object
      required: [title, description, required_skills, reward]
      properties:
        title:
          type: string
          maxLength: 200
        description:
          type: string
        required_skills:
          type: array
          items:
            type: string
        reward:
          type: string
        verification_period:
          type: integer
          description: 验收期限（秒），默认 604800

    User:
      type: object
      properties:
        id:
          type: string
        wallet_address:
          type: string
        email:
          type: string
          nullable: true
        username:
          type: string
          nullable: true
        avatar_url:
          type: string
          nullable: true
        bio:
          type: string
          nullable: true
        reputation:
          type: integer
        tier:
          type: string
          enum: [bronze, silver, gold, platinum, diamond]
        skills:
          type: array
          items:
            type: string
        tasks_completed:
          type: integer
        tasks_failed:
          type: integer
        total_earnings:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        tasks_posted_count:
          type: integer
        available_skills:
          type: array
          items:
            type: string

    UserResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            data:
              $ref: '#/components/schemas/User'

    UpdateUserRequest:
      type: object
      properties:
        username:
          type: string
        bio:
          type: string
        skills:
          type: array
          items:
            type: string

    Bid:
      type: object
      properties:
        id:
          type: string
        task_id:
          type: string
        bidder_wallet:
          type: string
        amount:
          type: string
        proposal:
          type: string
        estimated_duration:
          type: string
        status:
          type: string
          enum: [pending, accepted, rejected, withdrawn]
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    BidResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            data:
              $ref: '#/components/schemas/Bid'

    BidListResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Bid'

    CreateBidRequest:
      type: object
      required: [task_id, amount, proposal, estimated_duration]
      properties:
        task_id:
          type: string
        amount:
          type: string
        proposal:
          type: string
        estimated_duration:
          type: string

    LeaderboardEntry:
      type: object
      properties:
        rank:
          type: integer
        wallet_address:
          type: string
        username:
          type: string
          nullable: true
        avatar_url:
          type: string
          nullable: true
        reputation:
          type: integer
        tier:
          type: string
        tasks_completed:
          type: integer
        total_earnings:
          type: string

    LeaderboardResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/LeaderboardEntry'

    Transaction:
      type: object
      properties:
        id:
          type: string
        type:
          type: string
          enum: [transfer_in, transfer_out, escrow_deposit, escrow_release, escrow_refund]
        amount:
          type: string
        counterparty:
          type: string
        tx_signature:
          type: string
        timestamp:
          type: string
          format: date-time
        memo:
          type: string

    TransactionListResponse:
      allOf:
        - $ref: '#/components/schemas/ApiResponse'
        - type: object
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Transaction'

tags:
  - name: Tasks
    description: 任务管理
  - name: Users
    description: 用户管理
  - name: Bids
    description: 投标管理
