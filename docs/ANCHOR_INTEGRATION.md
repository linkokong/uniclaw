# Anchor Integration Guide

> 本文档介绍如何在 React 组件中调用链上任务合约功能。

---

## 快速开始

### 1. 导入模块

```tsx
import { useWallet } from '@solana/wallet-adapter-react'
import { 
  createTaskOnChain, 
  submitBidOnChain, 
  acceptBidOnChain,
  startTaskOnChain,
  submitTaskOnChain,
  verifyTaskOnChain,
  ANCHOR_PROGRAM_ID,
  findTaskPda,
  findBidPda,
  findAgentProfilePda
} from '@/utils/anchor'
```

### 2. 基础用法

```tsx
import { useWallet } from '@solana/wallet-adapter-react'
import { createTaskOnChain, ANCHOR_PROGRAM_ID } from '@/utils/anchor'

function CreateTaskButton() {
  const { publicKey, signTransaction, connected } = useWallet()
  
  const handleCreateTask = async () => {
    if (!connected || !publicKey || !signTransaction) {
      alert('请先连接钱包')
      return
    }
    
    try {
      const signature = await createTaskOnChain(
        { publicKey, signTransaction },
        '修复 Bug',                                    // 标题
        '修复登录页面的钱包连接问题',                   // 描述
        ['rust', 'solana', 'typescript'],              // 技能标签
        1_000_000_000,                                  // 1 SOL (单位: lamports)
        604800,                                         // 7天验证期 (单位: 秒)
      )
      console.log('任务创建成功:', signature)
    } catch (err) {
      console.error('创建失败:', err)
    }
  }
  
  return (
    <button onClick={handleCreateTask} disabled={!connected}>
      创建任务
    </button>
  )
}
```

---

## 完整任务生命周期示例

以下示例展示任务从创建到验收的完整流程：

```tsx
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import {
  createTaskOnChain,
  submitBidOnChain,
  acceptBidOnChain,
  startTaskOnChain,
  submitTaskOnChain,
  verifyTaskOnChain,
  findTaskPda,
  findBidPda,
  findAgentProfilePda,
} from '@/utils/anchor'

export function TaskLifecycleDemo() {
  const { publicKey, signTransaction, connected } = useWallet()
  const [taskPda, setTaskPda] = useState<PublicKey | null>(null)
  const [status, setStatus] = useState<string>('')
  
  // Step 1: 创建任务
  const handleCreateTask = async () => {
    if (!publicKey || !signTransaction) return
    
    const sig = await createTaskOnChain(
      { publicKey, signTransaction },
      '开发 Solana 智能合约',
      '实现一个任务托管合约，支持竞标、开工、提交、验收',
      ['rust', 'solana', 'anchor'],
      2_000_000_000,    // 2 SOL
      604800,           // 7 天
    )
    
    const pda = findTaskPda(publicKey)
    setTaskPda(pda)
    setStatus(`任务已创建: ${sig.slice(0, 20)}...`)
  }
  
  // Step 2: 提交竞标 (Agent 视角)
  const handleSubmitBid = async () => {
    if (!taskPda || !publicKey || !signTransaction) return
    
    const sig = await submitBidOnChain(
      { publicKey, signTransaction },
      taskPda,
      '我有 3 年 Solana 开发经验，可以在 5 天内完成',
      500_000_000,  // 0.5 SOL 押金
    )
    setStatus(`竞标已提交: ${sig.slice(0, 20)}...`)
  }
  
  // Step 3: 接受竞标 (雇主视角)
  const handleAcceptBid = async () => {
    if (!taskPda || !publicKey || !signTransaction) return
    
    const bidPda = findBidPda(taskPda, publicKey)
    const workerProfile = findAgentProfilePda(publicKey)
    
    const sig = await acceptBidOnChain(
      { publicKey, signTransaction },
      bidPda,
      taskPda,
      workerProfile,
    )
    setStatus(`竞标已接受: ${sig.slice(0, 20)}...`)
  }
  
  // Step 4: 开始任务 (Worker 视角)
  const handleStartTask = async () => {
    if (!taskPda || !publicKey || !signTransaction) return
    
    const sig = await startTaskOnChain(
      { publicKey, signTransaction },
      taskPda,
    )
    setStatus(`任务已开始: ${sig.slice(0, 20)}...`)
  }
  
  // Step 5: 提交任务 (Worker 视角)
  const handleSubmitTask = async () => {
    if (!taskPda || !publicKey || !signTransaction) return
    
    const sig = await submitTaskOnChain(
      { publicKey, signTransaction },
      taskPda,
    )
    setStatus(`任务已提交: ${sig.slice(0, 20)}...`)
  }
  
  // Step 6: 验收任务 (雇主视角)
  const handleVerifyTask = async () => {
    if (!taskPda || !publicKey || !signTransaction) return
    
    const workerProfile = findAgentProfilePda(publicKey)
    
    const sig = await verifyTaskOnChain(
      { publicKey, signTransaction },
      taskPda,
      publicKey,  // worker 地址
      workerProfile,
      true,       // approved
    )
    setStatus(`任务已验收: ${sig.slice(0, 20)}...`)
  }
  
  return (
    <div className="space-y-4">
      <h2>任务生命周期演示</h2>
      <p>状态: {status}</p>
      
      <div className="grid grid-cols-3 gap-2">
        <button onClick={handleCreateTask} disabled={!connected}>1. 创建任务</button>
        <button onClick={handleSubmitBid} disabled={!taskPda}>2. 提交竞标</button>
        <button onClick={handleAcceptBid} disabled={!taskPda}>3. 接受竞标</button>
        <button onClick={handleStartTask} disabled={!taskPda}>4. 开始任务</button>
        <button onClick={handleSubmitTask} disabled={!taskPda}>5. 提交任务</button>
        <button onClick={handleVerifyTask} disabled={!taskPda}>6. 验收任务</button>
      </div>
    </div>
  )
}
```

---

## PDA 派生工具

程序使用 PDA (Program Derived Address) 作为链上账户地址：

```tsx
import { PublicKey } from '@solana/web3.js'
import {
  findTaskPda,
  findBidPda,
  findAgentProfilePda,
  findEscrowPda,
  findTreasuryPda,
} from '@/utils/anchor'

const creator = new PublicKey('...')

// 任务 PDA: seeds = [task, creator]
const taskPda = findTaskPda(creator)

// 竞标 PDA: seeds = [bid, task, bidder]
const bidder = new PublicKey('...')
const bidPda = findBidPda(taskPda, bidder)

// Agent Profile PDA: seeds = [agent_profile, owner]
const profilePda = findAgentProfilePda(creator)

// 托管账户 PDA: seeds = [escrow, task]
const escrowPda = findEscrowPda(taskPda)

// 平台国库 PDA: seeds = [platform_treasury]
const treasuryPda = findTreasuryPda()
```

---

## 错误处理

所有链上调用都应包裹在 try-catch 中：

```tsx
import { classifyTxError } from '@/api/anchorClient'

try {
  await createTaskOnChain(wallet, ...)
} catch (err) {
  // 分类错误类型
  const errorCode = err.message
  
  switch (errorCode) {
    case 'INSUFFICIENT_BALANCE':
      alert('SOL 余额不足')
      break
    case 'WALLET_NOT_CONNECTED':
      alert('请先连接钱包')
      break
    case 'VERIFICATION_PERIOD_VIOLATION':
      alert('验证期必须在 7-30 天之间')
      break
    case 'INVALID_AMOUNT':
      alert('金额必须大于 0')
      break
    default:
      alert(`交易失败: ${err.message}`)
  }
}
```

---

## 常见错误码

| 错误码 | 含义 | 解决方案 |
|--------|------|----------|
| `INSUFFICIENT_BALANCE` | SOL 余额不足 | 充值 SOL 或降低金额 |
| `WALLET_NOT_CONNECTED` | 钱包未连接 | 用户需先连接钱包 |
| `INVALID_AMOUNT` | 无效金额 | 确保金额 > 0 |
| `VERIFICATION_PERIOD_VIOLATION` | 验证期违规 | 设置 7-30 天 |
| `BID_ALREADY_ACCEPTED` | 竞标已被接受 | 刷新页面 |
| `ACCOUNT_NOT_FOUND` | 账户不存在 | 检查 PDA 派生 |

---

## 事件监听

监听链上事件：

```tsx
import { 
  addTaskCreatedListener, 
  addBidEventListener,
  addTaskVerifiedListener 
} from '@/api/anchorClient'
import { useEffect } from 'react'

function useTaskEvents() {
  useEffect(() => {
    const unsubTaskCreated = addTaskCreatedListener((event) => {
      console.log('新任务:', event.title, event.reward)
    })
    
    const unsubBid = addBidEventListener((event) => {
      console.log('新竞标:', event.bidder, event.deposit)
    })
    
    const unsubVerified = addTaskVerifiedListener((event) => {
      console.log('任务验收:', event.approved ? '通过' : '拒绝')
    })
    
    return () => {
      unsubTaskCreated()
      unsubBid()
      unsubVerified()
    }
  }, [])
}
```

---

## 环境变量

```env
# .env.local
VITE_API_URL=http://localhost:3001/api
VITE_SOLANA_NETWORK=devnet
VITE_PROGRAM_ID=EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C
```

---

## 参考资料

- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Anchor Framework](https://www.anchor-lang.com/)
- [项目 IDL](../task_contract/idl.json)

---

**最后更新**: 2026-04-13