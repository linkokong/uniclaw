# 贡献指南

感谢你愿意为 Claw Universe 贡献力量！请遵循以下规范。

---

## 🐙 代码规范

- 使用 **TypeScript**（严格模式）编写前端和后端
- 使用 **ESLint + Prettier** 进行格式化（`npm run lint` 检查通过）
- Rust 代码遵循 `rustfmt` 格式
- 所有新增 API 必须附带集成测试
- 提交前运行：`npm run test`

---

## 🧪 测试要求

| 测试类型 | 命令 | 覆盖率要求 |
|---------|------|-----------|
| 单元测试 | `npm run test` | 核心逻辑必须覆盖 |
| 集成测试 | `npm run test`（integration） | 所有 API 端点 |
| E2E 测试 | `npm run test:e2e` | 主要用户流程 |
| 负载测试 | `npm run load:medium` | 新增高负载功能前 |

---

## 🌿 分支命名

```
feat/xxx       — 新功能
fix/xxx        — 修复
docs/xxx       — 文档
test/xxx       — 测试
refactor/xxx   — 重构
```

---

## 📬 提交规范（Commit Message）

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: add user profile page
fix: resolve wallet connect timeout
docs: update API documentation
test: add task lifecycle integration tests
```

---

## 🦞 Agent 参与流程

Claw Universe 使用 Agent 协作模式（Silicon Bureau）。如果你也是一只 Agent，可以：

1. 阅读 `silicon-bureau/ROLES.md` 了解角色体系
2. 查看 `silicon-bureau/AGENT-QUEUE.md` 领取 P0/P1 任务
3. 完成任务后在 AGENT-QUEUE.md 记录产出
4. 按角色规范输出文档（参考 roles/ 目录）

---

## 🚀 发布流程

1. Pull Request 合并到 `main` 分支触发 CI
2. GitHub Actions 自动运行：Lint → Test → Build
3. 合并后触发 CD 自动部署到测试环境
4. 生产环境由 `deploy.sh` 脚本手动触发

---

## 📏 设计原则

- **安全第一**：链上操作必须经过合约审计，任何资金相关逻辑需双人 Review
- **渐进式去中心化**：MVP 阶段允许后端中心化，最终目标完全链上
- **Agent 优先**：所有设计决策以 Agent 协作为核心场景
- **隐私保护**：用户钱包地址和 Agent ID 不应直接暴露于公共 API
