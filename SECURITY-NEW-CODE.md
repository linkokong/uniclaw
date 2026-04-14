## 新增代码安全扫描 (2026-04-12)

### 发现数：13
- CRITICAL: 3
- HIGH: 4
- MEDIUM: 3
- LOW: 3

---

### 逐项问题

---

#### Issue #1
- 文件：`src/api/anchorClient.ts`
- 位置：`initializePlatform`、`createTask`、`submitBid` 等所有 instruction callers（行 74–265）
- 描述：所有链上指令调用函数均未包裹 `try-catch`，RPC 错误直接抛出到调用组件，导致页面崩溃、无错误提示。例如 `createTask`：
  ```ts
  return program.methods.createTask(...).accounts({...}).rpc()
  // 如果 RPC 失败（如余额不足、指令参数错误）→ 未捕获的 Promise rejection
  ```
- 影响：交易失败时用户看到空白错误或白屏，无法得知失败原因；链上操作失败也无重试机制。
- 严重度：**CRITICAL**
- 建议修复：
  ```ts
  export async function createTask(...): Promise<string> {
    try {
      const program = getProgram(wallet)
      return await program.methods.createTask(...).accounts({...}).rpc()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`createTask failed: ${msg}`)
    }
  }
  ```
  或在 AnchorProvider 层面配置 `skipPreflight: false` 并添加全局错误边界。

---

#### Issue #2
- 文件：`src/components/BidList.tsx`
- 位置：`handleAccept`（行 ~420）、`handleReject`（行 ~437）
- 描述：接受/拒绝投标时完全没有错误处理，用 `alert()` 展示错误：
  ```ts
  } catch (err) {
    alert('Failed to accept bid: ' + String(err))
  }
  ```
  错误被吞掉，UI 无 loading 状态回退，用户体验差，且 alert 内容可能含内网路径或堆栈信息。
- 影响：链上交易失败（超时、余额不足）时用户只能看到浏览器 alert，且错误无法被组件状态记录。
- 严重度：**CRITICAL**
- 建议修复：使用 `setError()` 状态 + 错误提示 UI 替代 alert，例如：
  ```ts
  const [actionError, setActionError] = useState<string | null>(null)
  // ...
  } catch (err) {
    setActionError(err instanceof Error ? err.message : 'Transaction failed')
  } finally {
    setLoading(null)
  }
  ```

---

#### Issue #3
- 文件：`src/api/anchorClient.ts`
- 位置：`findTreasuryPda`、`findTaskPda`、`findBidPda` 等所有 PDA 推导函数（行 58–72）
- 描述：所有 PDA 推导仅取 `findProgramAddressSync` 的 `[0]`（第一个结果），未验证 bump nonce 是否正确。如果第一个 bump 派生出的 PDA 已被占用（理论上几乎不可能，但存在理论风险），或者合约层 bump 逻辑与前端不一致，将派生出错误的 PDA。
  ```ts
  return PublicKey.findProgramAddressSync([Buffer.from('task'), creator.toBuffer()], PROGRAM_ID)[0]
  // 只用了 [0]，没有验证 bump
  ```
- 影响：若 bump 不一致，指令发送到错误账户地址，交易失败或资金发到错误地址。
- 严重度：**CRITICAL**
- 建议修复：验证 canonical bump（通常取 `[1]` 返回的 bump 值），或与合约层确认使用 canonical bump：
  ```ts
  const [pda, bump] = PublicKey.findProgramAddressSync(seeds, programId)
  // 可选：将 bump 存储或验证
  ```

---

#### Issue #4
- 文件：`src/api/anchorClient.ts` & `src/utils/anchor.ts`
- 位置：全局 `as never` 强制类型转换
- 描述：代码中大量使用 `as never` 绕过 TypeScript 类型检查：
  ```ts
  // anchorClient.ts 行 38
  } as never, { commitment: 'confirmed' })
  // utils/anchor.ts 行 77
  { signTransaction: wallet.signTransaction as never, publicKey: wallet.publicKey }
  ```
  这完全绕过了 TypeScript 的类型安全机制，`signTransaction` 的实际签名类型（`<T extends Transaction>`）与传入的 `Transaction` 子类型不匹配时，运行时不会报错。
- 影响：类型不匹配时交易可能静默失败，或产生无法预料的运行时错误。
- 严重度：**HIGH**
- 建议修复：定义统一的 `WalletLike` 接口，用 `unknown` +守卫函数做类型收窄，而非 `as never`：
  ```ts
  function toAnchorWallet(w: WalletAdapter): Wallet {
    if (!w.signTransaction) throw new Error('Wallet missing signTransaction')
    return w as Wallet
  }
  ```

---

#### Issue #5
- 文件：`src/components/BidList.tsx`
- 位置：`handleAccept`（行 ~422）
- 描述：`bids?.find(b => b.id === bidId)?.bidder_wallet` 可能为 `undefined`，直接传入 `deriveBidPda`：
  ```ts
  const bidderWallet = bids?.find(b => b.id === bidId)?.bidder_wallet
  if (!bidderWallet) throw new Error('Bid not found')  // ← 这里虽然有检查，但抛出的错误被 alert 吞掉
  const bidPda = deriveBidPda(taskPda, bidderWallet)   // ← 若 above throw 不触发，这里 bidderWallet 为 undefined
  ```
  `throw new Error(...)` 在 catch 块中，不会阻止后续代码执行（实际上此处 throw 在 try 内，但如果前面的条件判断有漏洞，bidderWallet 可能为空字符串）。
- 影响：派生出无效 PDA，提交到错误地址。
- 严重度：**HIGH**
- 建议修复：在 throw 前加入明确守卫：
  ```ts
  if (!bidderWallet) {
    setActionError('Bidder wallet not found')
    return
  }
  ```

---

#### Issue #6
- 文件：`src/api/anchorClient.ts`
- 位置：所有 instruction caller 函数签名（`initializePlatform`、`initializeWorkerProfile`、`createTask` 等）
- 描述：函数参数接受 `wallet: { signTransaction; publicKey }` 但未检查 `publicKey` 是否存在（null/undefined）：
  ```ts
  export async function initializeWorkerProfile(wallet: {
    signTransaction: <T extends Transaction>(tx: T) => Promise<T>
    publicKey: PublicKey
  }): Promise<string> {
    const workerProfile = findAgentProfilePda(wallet.publicKey) // ← publicKey 若为 null → toBuffer() 报错
  ```
  `utils/anchor.ts` 的封装层有 `if (!wallet?.publicKey)` 检查，但 `anchorClient.ts` 的直接调用方（如其他测试脚本）若跳过封装层调用，会触发 NPE。
- 影响：若 `publicKey` 为 null，`wallet.publicKey.toBuffer()` 抛出 `TypeError`。
- 严重度：**HIGH**
- 建议修复：在每个函数入口添加守卫（与 `utils/anchor.ts` 保持一致）：
  ```ts
  if (!wallet?.publicKey) throw new Error('Wallet not connected or publicKey missing')
  ```

---

#### Issue #7
- 文件：`src/components/BidForm.tsx`（行 ~103）、`src/pages/TaskMarket.tsx`（行 ~330）
- 描述：`parseFloat(bidAmount) * 1e9` 和 `parseFloat(ocReward) * 1e9` 在输入为空字符串时返回 `NaN`，后续运算产生无效 lamports 值：
  ```ts
  // BidForm.tsx
  const depositLamports = Math.max(
    Math.round(parseFloat(bidAmount) * 1e9 * 0.01), // ← bidAmount='' → NaN
    100_000,
  )
  // TaskMarket.tsx
  const rewardLamports = Math.round(parseFloat(ocReward) * 1e9) // ← ocReward='' → NaN
  ```
- 影响：`NaN` 被发送到链上，指令参数类型错误，交易被 Reject 或产生无法预测的状态。
- 严重度：**HIGH**
- 建议修复：先验证输入有效性：
  ```ts
  const amount = parseFloat(bidAmount)
  if (isNaN(amount) || amount <= 0) {
    setError('Invalid bid amount')
    return
  }
  const depositLamports = Math.max(Math.round(amount * 1e9 * 0.01), 100_000)
  ```

---

#### Issue #8
- 文件：`src/api/anchorClient.ts`、`src/utils/anchor.ts`、`src/components/BidForm.tsx`、`src/components/BidList.tsx`、`src/pages/TaskMarket.tsx`
- 描述：所有链上交易均直接调用 `.rpc()` 发送，未调用 `.simulate()` 先验证交易可行性。
- 影响：无效交易（如余额不足、账户不存在、参数超限）直接上链浪费 gas，且无法在发送前向用户提示预估失败原因。
- 严重度：**MEDIUM**
- 建议修复：在发送前先 simulate：
  ```ts
  const simulated = await program.methods.createTask(...).accounts({...}).simulate()
  if (simulated.value.err) throw new Error('Simulation failed: ' + JSON.stringify(simulated.value.err))
  return await program.methods.createTask(...).accounts({...}).rpc()
  ```

---

#### Issue #9
- 文件：`src/utils/anchor.ts`
- 位置：`deriveTaskPda`、`deriveTaskPdaFromCreator`、`deriveWorkerProfilePda`（行 ~153–179）
- 描述：使用 `new PublicKey(creatorAddress)` 派生 PDA 时，未验证地址字符串的有效性：
  ```ts
  export function deriveTaskPdaFromCreator(creatorAddress: string): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('task'), new PublicKey(creatorAddress).toBuffer()], // ← Invalid string → throw
      ANCHOR_PROGRAM_ID,
    )[0]
  }
  ```
  如果传入非法 base58 字符串（如用户伪造 URL 参数），会直接抛出异常而非优雅处理。
- 影响：非法地址输入导致页面崩溃（未捕获的异常）。
- 严重度：**MEDIUM**
- 建议修复：添加 try-catch 或预验证：
  ```ts
  export function deriveTaskPdaFromCreator(creatorAddress: string): PublicKey {
    try {
      return PublicKey.findProgramAddressSync(
        [Buffer.from('task'), new PublicKey(creatorAddress).toBuffer()],
        ANCHOR_PROGRAM_ID,
      )[0]
    } catch {
      throw new Error('Invalid creator address format')
    }
  }
  ```

---

#### Issue #10
- 文件：`src/pages/TaskMarket.tsx`
- 位置：On-chain 创建模态框（行 ~295–312）
- 描述：模态框表单的 description 字段（`ocDesc`）没有 `maxLength` 限制，但 `createTaskOnChain` 内部做了 `description.slice(0, 1000)` 截断：
  - UI 层面无字数提示，用户可能输入超长内容而不知
  - `requiredSkills` 拆分逻辑未验证每个 tag 长度
  ```ts
  // 行 297: <textarea ... rows={3} />  ← 无 maxLength
  ```
- 影响：用户输入超长描述在前端被静默截断，可能丢失关键信息；超出合约限制时交易 Reject（无预提示）。
- 严重度：**MEDIUM**
- 建议修复：
  ```tsx
  <textarea
    value={ocDesc}
    onChange={(e) => setOcDesc(e.target.value)}
    placeholder="Describe the task…"
    rows={3}
    maxLength={1000}
    className="..."
  />
  <p className="mt-1 text-xs text-right text-gray-600">{ocDesc.length} / 1000</p>
  ```

---

#### Issue #11
- 文件：`src/api/anchorClient.ts`
- 位置：`getReadOnlyProvider`（行 27–38）
- 描述：只读 provider 使用 `PublicKey.default`（全零地址）作为 signer，合约若对 signer 有特殊校验，可能产生意外行为：
  ```ts
  _readOnlyProvider = new AnchorProvider(connection, {
    publicKey: PublicKey.default,
    signTransaction: async <T extends Transaction>(tx: T) => tx,
    signAllTransactions: async <T extends Transaction>(txs: T[]) => txs,
  } as never, { commitment: 'confirmed' })
  ```
- 影响：只读查询通常不涉及签名，但若合约指令对 signer 有隐式校验，可能产生不明确行为。
- 严重度：**LOW**
- 建议修复：添加注释说明使用 default keypair 的原因，并确认合约层对这类 signer 的处理。

---

#### Issue #12
- 文件：`src/api/anchorClient.ts` & `src/utils/anchor.ts`
- 位置：所有 PDA 推导函数中的 seed 字符串
- 描述：PDA seed 字符串硬编码（如 `'task'`、`'bid'`、`'escrow'`、`'platform_treasury'`），一旦合约 IDL 中 seed 发生变化，前端将派生出完全不同的 PDA，但 TypeScript 编译无报错：
  ```ts
  [Buffer.from('task'), creator.toBuffer()]  // ← 硬编码字符串
  ```
- 影响：合约升级后 seed 变化，前端静默派错 PDA，导致"找不到账户"或资金发到错误地址。
- 严重度：**LOW**
- 建议修复：将 seed 字符串提取为常量并集中管理：
  ```ts
  const PDA_SEEDS = {
    TASK: 'task',
    BID: 'bid',
    ESCROW: 'escrow',
    WORKER_PROFILE: 'agent_profile',
    PLATFORM_TREASURY: 'platform_treasury',
  } as const
  ```
  并添加 IDL 版本校验或单测验证前端 seed 与合约 seed 一致。

---

#### Issue #13
- 文件：`src/components/BidList.tsx`
- 位置：`handleReject`（行 ~441）
- 描述：函数内部动态导入 `@solana/web3.js`：
  ```ts
  const { PublicKey } = await import('@solana/web3.js')
  ```
  该模块已在文件顶部静态导入（`BidList` 未直接导入，但 `anchor.ts` 等已导入），动态导入多余且增加 bundle size。
- 影响：轻微——额外的网络开销（生产环境应为 chunk 缓存），但不涉及安全。
- 严重度：**LOW**
- 建议修复：移除动态 import，直接使用已有的静态导入引用。

---

## 最关键的 3 个问题

1. **CRITICAL #1 — anchorClient.ts 所有指令调用无 try-catch**：这是系统性风险，任意一笔链上交易失败都会导致页面崩溃。当前代码大量依赖链上操作（createTask、submitBid、acceptBid 等），任何网络波动、余额不足、合约 Reject 都会直接抛出未处理的 Promise rejection，用户体验极差且无法调试。

2. **CRITICAL #2 — BidList.tsx handleAccept/handleReject 用 alert 替代错误处理**：这是前端 UX 与安全的双重问题。错误被静默吞掉，链上交易失败（如网络超时）时用户只能看到丑陋的浏览器 alert，且 alert 内容可能泄露内部路径信息。现有代码虽有 `try-catch`，但 catch 块只做了 `alert` + `setLoading(null)`，没有更新 UI 错误状态。

3. **CRITICAL #3 — PDA 推导仅取 [0] 无 bump 验证**：`findProgramAddressSync` 返回 `[pda, bump]`，当前代码全部只取 `[0]`。虽然 cannonical bump 理论上稳定，但一旦合约层 bump 逻辑与前端不一致（合约升级、重新部署），将静默派生出完全不同的 PDA，导致交易发送到不存在的账户或错误地址，资金损失风险。
