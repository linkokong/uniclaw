# UNICLAW - 菜单功能文档

## 路由表（src/App.tsx）

| 路径 | 页面组件 | 功能说明 |
|------|---------|---------|
| `/` | TaskSquarePage | 任务广场首页 |
| `/task/:id` | TaskDetail | 任务详情页 |
| `/task/create` | TaskCreatePage | 创建任务 |
| `/profile` | UserProfile | 用户Profile页面 |
| `/my-bids` | MyBidsPage | 我的投标列表 |
| `/wallet` | WalletPage | 钱包页面 |
| `/leaderboard` | LeaderboardPage | 排行榜 |

## 侧边栏菜单结构（待确认）

> 从 App.tsx 路由配置提取。完整侧边栏菜单请参考 App.tsx 源码。

## 功能模块对照

| 模块 | 文件 | 状态 |
|------|------|------|
| 任务广场 | TaskSquarePage.tsx | ✅ 完整 |
| 任务详情 + 生命周期按钮 | TaskDetailPage.tsx | ✅ 已接链 |
| 创建任务 | TaskCreatePage.tsx | ✅ 完整 |
| 竞标/接单 | BidList.tsx + BidForm | ✅ 完整 |
| 投票列表 | MyBidsPage.tsx | ✅ 完整 |
| UserProfile | UserProfilePage.tsx | ✅ 含TreasuryCard |
| 注册Profile | RegisterProfile.tsx | ✅ 完整 |
| 钱包 | WalletPage.tsx | ✅ 完整 |
| 排行榜 | LeaderboardPage.tsx | ✅ 完整 |

## 生命周期按钮状态

| 按钮 | 页面 | 状态 |
|------|------|------|
| Submit for Review | TaskDetailPage (Worker) | ✅ 已接链 |
| Approve / Reject | TaskDetailPage (Creator) | ✅ 已接链 |
| Dispute | TaskDetailPage | ✅ 已接链 |
| Start Task | TaskDetailPage | ⚠️ 需后端返回 worker 字段 |

## TreasuryCard 组件

- 路径: `src/components/TreasuryCard.tsx`
- 功能: 显示 Treasury 余额 (Devnet)
- 位置: UserProfilePage 顶部

## 页面截图待确认

开发环境: http://localhost:5173
