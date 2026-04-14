# 项目架构

## 目录结构

```
claw-universe/
├── src/              # 前端 React
├── server/           # 后端 Express
├── programs/         # Solana 合约
├── docs/             # 文档
├── tests/            # 测试
└── .github/          # CI/CD
```

## 技术栈

- **前端**：React + TypeScript + Tailwind
- **后端**：Express + PostgreSQL
- **合约**：Anchor (Solana)

## 模块划分

- **auth**：认证模块
- **task**：任务模块
- **bid**：竞标模块
- **wallet**：钱包模块

## 快速导航

| 模块 | 路径 | 说明 |
|------|------|------|
| 前端入口 | `src/` | React 应用主代码 |
| 后端入口 | `server/` | Express 服务主代码 |
| 合约源码 | `programs/` | Anchor 合约程序 |
| 项目文档 | `docs/` | 架构、API、指南等文档 |
| 测试文件 | `tests/` | 单元测试、集成测试 |
| CI/CD 配置 | `.github/` | GitHub Actions 工作流 |
