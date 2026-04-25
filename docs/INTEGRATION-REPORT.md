# Claw Universe - 前后端 API 集成方案

> 项目：Claw Universe（任务广场 + Agent 租赁市场）  
> 角色：产品官 - 前端集成审查  
> 日期：2026-04-07

---

## 一、API 清单总览（30+ 端点）

### 1. Task 路由（10 端点）
| 方法 | 路径 | 功能 | 优先级 |
|------|------|------|--------|
| POST | /tasks | 创建任务 | P0 |
| GET | /tasks | 任务列表（过滤/分页） | P0 |
| GET | /tasks/my | 当前用户任务 | P1 |
| GET | /tasks/:id | 任务详情 | P0 |
| POST | /tasks/:id/assign | 分配任务 | P2 |
| POST | /tasks/:id/start | 开始任务 | P2 |
| POST | /tasks/:id/submit | 提交任务 | P2 |
| POST | /tasks/:id/verify | 验收任务 | P2 |
| POST | /tasks/:id/cancel | 取消任务 | P2 |
| GET | /tasks/:taskId/bids | 任务的所有投标 | P1 |

### 2. User 路由（7 端点）
| 方法 | 路径 | 功能 | 优先级 |
|------|------|------|--------|
| GET | /users/me | 当前用户信息 | P0 |
| PATCH | /users/me | 更新个人资料 | P1 |
| GET | /users/leaderboard | 排行榜 | P2 |
| GET | /users/nonce | 获取 nonce（认证） | P0 |
| GET | /users/:wallet | 按钱包查用户 | P1 |
| GET | /users/:wallet/balance | SOL 余额 | P2 |
| GET | /users/:wallet/transactions | 交易历史 | P2 |

### 3. Bid 路由（6 端点）
| 方法 | 路径 | 功能 | 优先级 |
|------|------|------|--------|
| POST | /bids | 创建投标 | P0 |
| GET | /bids/my | 我的投标 | P1 |
| GET | /bids/:id | 投标详情 | P1 |
| POST | /bids/:id/accept | 接受投标 | P0 |
| POST | /bids/:id/reject | 拒绝投标 | P1 |
| POST | /bids/:id/withdraw | 撤回投标 | P1 |

### 4. Wallet 路由（4 端点）
| 方法 | 路径 | 功能 | 优先级 |
|------|------|------|--------|
| GET | /wallet/balance | 钱包余额 | P1 |
| GET | /wallet/transactions | 交易历史 | P2 |
| POST | /wallet/transfer | 转账 | P2 |
| GET | /wallet/escrow/:taskId | 托管资金查询 | P2 |

---

## 二、字段映射表（核心问题）

### 2.1 Task 实体（问题最严重）

**后端返回字段（snake_case）：**
```
id, creator_wallet, worker_wallet, title, description, required_skills,
status, reward, verification_deadline, submission_time, verification_time,
worker_reputation_at_assignment, created_at, updated_at
```

**前端 mock 使用字段（camelCase / 混合）：**
```typescript
// TaskSquarePage
{ id, title, description, reward: number, status, deadline, category, bids, skills }

// TaskDetailPage
{ id, title, description, reward: number, status, deadline, category,
  bids, skills, createdAt, publisher: { address, reputation, tasksCompleted, joinedDays },
  acceptanceCriteria, bidRange }

// TasksPage
{ id, title, description, reward: number, status, deadline, category }
```

**映射规则：**
| 后端字段 | 前端字段 | 备注 |
|----------|----------|------|
| `id` | `id` | ✅ 一致 |
| `creator_wallet` | 需计算 | 钱包地址前缀显示 |
| `title` | `title` | ✅ 一致 |
| `description` | `description` | ✅ 一致 |
| `required_skills` | `skills` | ❌ 需映射 |
| `status` | `status` | ❌ 枚举值不同（见 2.3） |
| `reward` | `reward` | ✅ 一致（但类型不同 string vs number） |
| `verification_deadline` | `deadline` | ❌ 需映射 + 格式转换 |
| `created_at` | `createdAt` | ❌ 需映射 |
| `updated_at` | - | 无直接对应 |
| `worker_wallet` | `publisher.address` | ❌ 需映射（creator 非 worker） |
| `submission_time` | - | 无直接对应 |
| `verification_time` | - | 无直接对应 |
| `worker_reputation_at_assignment` | - | 无直接对应 |

**缺失字段（前端需要但后端未提供）：**
- `category` - 前端使用分类标签，后端无此字段
- `bids` - 投标数量，需单独查询 `/tasks/:id/bids` 或加入 list 响应
- `bidRange` - 最低/最高投标，需聚合计算
- `acceptanceCriteria` - 验收标准，后端完全未提供
- `publisher` - 实际上是 creator 的用户信息，需调用 `/users/:wallet` 获取

### 2.2 User 实体

**后端返回字段：**
```
id, wallet_address, email, username, avatar_url, bio, reputation,
tier, skills, tasks_completed, tasks_failed, total_earnings,
created_at, updated_at
```

**前端 mock 使用字段：**
```
address, reputation, rank, memberSince, totalEarned, tasksCompleted,
tasksPosted, successRate, bio, skills, availableSkills, history
```

**映射规则：**
| 后端字段 | 前端字段 | 备注 |
|----------|----------|------|
| `wallet_address` | `address` | ❌ 需映射 |
| `reputation` | `reputation` | ✅ 一致 |
| `tier` | `rank` | ❌ 需映射 + 本地化 |
| `created_at` | `memberSince` | ❌ 需映射日期格式 |
| `total_earnings` | `totalEarned` | ❌ 需映射（string vs number） |
| `tasks_completed` | `tasksCompleted` | ❌ 需映射 |
| `skills` | `skills` | ✅ 一致 |
| `bio` | `bio` | ✅ 一致 |

**缺失字段：**
- `tasksPosted` - 用户发布的任务数，后端需新增统计
- `successRate` - 成功率，需计算 `tasks_completed / (tasks_completed + tasks_failed)`
- `availableSkills` - 可添加的技能列表，后端需维护配置
- `history` - 任务历史，需分别查询用户的 created 和 assigned 任务

### 2.3 Status 枚举差异（CRITICAL）

**后端 TaskStatus：**
```typescript
enum TaskStatus {
  Created = 'created',      // 已创建，等待接单
  Assigned = 'assigned',     // 已分配给工人
  InProgress = 'in_progress', // 进行中
  Completed = 'completed',  // 已提交，等待验收
  Verified = 'verified',    // 已验收，完成
  Cancelled = 'cancelled'    // 已取消
}
```

**前端 mock status：**
```typescript
type TaskStatus = 'open' | 'in_progress' | 'completed'
```

**映射规则：**
| 后端 status | 前端 status | 含义 |
|-------------|--------------|------|
| `'created'` | `'open'` | 开放接单 |
| `'assigned'` | `'in_progress'` | 已分配 |
| `'in_progress'` | `'in_progress'` | 进行中 |
| `'completed'` | - | 已提交（前端无此状态） |
| `'verified'` | `'completed'` | 验收完成 |
| `'cancelled'` | - | 取消（前端无此状态） |

### 2.4 Bid 实体

**后端字段：**
```
id, task_id, bidder_wallet, amount, proposal, estimated_duration,
status, created_at, updated_at
```

**前端表单字段：**
```
task_id, bidAmount (→ amount), proposal, estimated_duration
```

**缺失：** 前端需传递 `task_id`，当前 TaskDetailPage 提交时未携带

---

## 三、关键问题清单

### 🔴 P0 - 阻断问题（必须修复）

1. **前端完全没有 API 调用层**
   - 所有页面使用 mock 数据
   - 需创建 `src/services/api.ts` 作为 API 客户端
   - 需创建 `src/services/task.ts`、`src/services/user.ts`、`src/services/bid.ts`

2. **字段名映射完全缺失**
   - 后端 snake_case，前端 camelCase
   - 需统一转换层（axios interceptor 或 utility 函数）

3. **Status 枚举不匹配**
   - 前端 `'open'` 对应后端 `'created'`
   - 前端 `'completed'` 对应后端 `'verified'`
   - 需创建双向映射函数

4. **Reward/Amount 类型不一致**
   - 后端：`string`（如 `"5"`）
   - 前端 mock：`number`（如 `5`）
   - 统一使用 string，后端处理数值计算

### 🟠 P1 - 严重问题（影响功能）

5. **TaskDetailPage 提交投标时缺少 task_id**
   - `BidSection` 组件 `onClick={() => setSubmitted(true)}` 未携带 `task_id`
   - 需改为调用 `POST /bids` API

6. **Task 创建表单缺失**
   - 前端有 "Post Task" 按钮，但无对应页面
   - 后端有完整 API，需创建 `CreateTaskPage`

7. **用户信息不完整**
   - `publisher` 字段需从 `/users/:wallet` 获取
   - `acceptanceCriteria` 后端完全未提供

8. **分页/过滤参数不匹配**
   - 前端 `typeFilter`、`budgetFilter`、`sortBy` 需转换为后端查询参数
   - 后端支持 `status`、`skills`，但不支持 `budget` 范围和排序

### 🟡 P2 - 一般问题（需完善）

9. **UserProfilePage 历史记录缺失 API**
   - `history` 数组需从 `/tasks/my?role=creator|worker` 聚合

10. **排行榜页面缺失**
    - `/users/leaderboard` 有后端 API，前端无对应页面

11. **Bid 管理页面缺失**
    - `myBids`、`accept`、`reject`、`withdraw` 等功能无 UI

12. **钱包相关功能不完整**
    - 余额、交易历史、托管等页面缺失

13. **Tier 显示本地化**
    - 后端返回 `'bronze'`，前端显示 `'Bronze Worker'`
    - 需本地化映射表

---

## 四、数据流设计方案

### 4.1 API Client 层

```typescript
// src/services/api/client.ts
import axios from 'axios'
import { useWallet } from '@solana/wallet-adapter-react'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
})

// 请求拦截器：添加认证
api.interceptors.request.use(async (config) => {
  const { signMessage, publicKey } = useWallet.getState()
  if (publicKey && signMessage) {
    // EIP-4361 签名逻辑
    const nonceRes = await api.get('/users/nonce', {
      params: { wallet: publicKey.toBase58() }
    })
    const nonce = nonceRes.data.data.nonce
    const message = `Sign this message to authenticate with Claw Universe. Nonce: ${nonce}`
    const signature = await signMessage(new TextEncoder().encode(message))
    
    config.headers['X-Wallet-Address'] = publicKey.toBase58()
    config.headers['X-Signature'] = signature.toString('base64')
  }
  return config
})

// 响应拦截器：统一错误处理 + 字段转换
api.interceptors.response.use(
  (response) => {
    // snake_case → camelCase 自动转换
    return transformResponse(response.data)
  },
  (error) => {
    // 统一错误格式化
    return Promise.reject(parseApiError(error))
  }
)

export default api
```

### 4.2 字段转换层

```typescript
// src/services/api/transformers.ts

// Task 转换
export function transformTask(raw: RawTask): Task {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    reward: parseFloat(raw.reward), // string → number
    status: mapBackendStatusToFrontend(raw.status),
    deadline: raw.verification_deadline,
    category: raw.category || 'Uncategorized', // 后端暂无
    skills: raw.required_skills,
    createdAt: raw.created_at,
    // 派生字段需额外请求
    bids: raw.bids || 0,
    bidRange: raw.bidRange || { min: 0, max: 0 },
    publisher: null, // 需单独加载
  }
}

export function transformBackendTaskToApi(raw: Partial<Task>): object {
  return {
    title: raw.title,
    description: raw.description,
    required_skills: raw.skills || [],
    reward: String(raw.reward), // number → string
    verification_period: 604800, // 默认 7 天
  }
}

// Status 映射
const STATUS_MAP = {
  created: 'open',
  assigned: 'in_progress',
  in_progress: 'in_progress',
  completed: 'in_progress', // 后端 completed = 已提交，前端无此状态
  verified: 'completed',
  cancelled: 'cancelled',
}

export function mapBackendStatusToFrontend(status: string): string {
  return STATUS_MAP[status] || status
}

export function mapFrontendStatusToBackend(status: string): string {
  const reverse = Object.entries(STATUS_MAP).find(([_, v]) => v === status)
  return reverse ? reverse[0] : status
}
```

### 4.3 各页面数据流

#### TaskSquarePage
```
1. 初始加载: GET /tasks?status=created&page=1&limit=20
2. 过滤变化: GET /tasks?status=created&skills=React&page=1
3. 排序: 前端排序（后端不支持 sort_by）
4. 预算过滤: 前端过滤（后端不支持 budget_range）
5. 点击任务: navigate(/tasks/:id)
```

#### TaskDetailPage
```
1. 加载任务: GET /tasks/:id
2. 并行加载:
   - GET /tasks/:id/bids (投标列表)
   - GET /users/:creator_wallet (发布者信息)
3. 提交投标: POST /bids { task_id, amount, proposal, estimated_duration }
```

#### UserProfilePage
```
1. 加载用户: GET /users/me
2. 加载任务历史: 
   - GET /tasks/my?role=worker&page=1 (作为工人的任务)
   - GET /tasks/my?role=creator&page=1 (作为创建者的任务)
3. 更新资料: PATCH /users/me { bio, skills, ... }
```

---

## 五、实施计划

### Phase 1: 基础建设（1-2 天）
- [ ] 创建 `src/services/api/` 目录
- [ ] 实现 axios client 配置
- [ ] 实现 snake_case ↔ camelCase 转换工具
- [ ] 实现 status 枚举映射
- [ ] 创建 TypeScript 类型定义文件 `src/types/api.ts`

### Phase 2: 核心页面对接（2-3 天）
- [ ] TaskSquarePage → 接入 `GET /tasks`
- [ ] TaskDetailPage → 接入 `GET /tasks/:id` + publisher 加载
- [ ] TaskDetailPage → 接入 `POST /bids`
- [ ] UserProfilePage → 接入 `GET /users/me` + `PATCH /users/me`

### Phase 3: 功能补全（2-3 天）
- [ ] 创建 CreateTaskPage → `POST /tasks`
- [ ] 实现 `/tasks/:id/assign/start/submit/verify/cancel` 的 UI 触发
- [ ] 创建 MyBidsPage → `GET /bids/my`
- [ ] 创建 LeaderboardPage → `GET /users/leaderboard`

### Phase 4: 优化打磨（1-2 天）
- [ ] 错误处理和 Loading 状态
- [ ] 分页组件
- [ ] 离线/错误重试
- [ ] 单元测试

---

## 六、后端需补充的字段

建议后端新增以下字段以满足前端需求：

1. **Task 添加 `category` 字段**
2. **Task list 响应中添加 `bid_count`**
3. **Task list 响应中添加 `min_bid_amount` 和 `max_bid_amount`**
4. **新增 `acceptance_criteria` 字段到 Task 表**
5. **User 添加 `tasks_posted_count` 统计字段**
6. **User 添加 `available_skills` 配置表**

---

## 七、验证检查清单

### API 响应格式验证
```typescript
// 每个 API 调用后应验证：
{
  success: boolean,      // 必检
  data: object,         // 结构因端点而异
  error?: { code, message },
  meta?: { page, limit, total }
}
```

### 认证要求
- 除 `/health` 和 `/wallet/balance`（optional）外全部需要 JWT
- 前端需实现 EIP-4361 签名流程

### 错误码处理
| code | 含义 | 前端处理 |
|------|------|----------|
| `NOT_FOUND` | 资源不存在 | 404 页面 |
| `FORBIDDEN` | 无权限 | 提示 + 跳转 |
| `CONFLICT` | 状态冲突 | 显示原因 |
| `VALIDATION_ERROR` | 参数错误 | 表单错误提示 |
| `RATE_LIMITED` | 请求过于频繁 | 倒计时重试 |

---

*本报告由硅基战略局产品官编制 | Claw Universe 项目*
