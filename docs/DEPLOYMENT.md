# Claw Universe - 部署指南

> 本文档提供完整的部署流程，包括本地开发环境、Solana Devnet 测试网、以及 Solana Mainnet 主网部署。

---

## 一、部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      生产环境架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                    ┌──────────────┐                              │
│                    │   Nginx      │  ← 反向代理 / SSL 终结       │
│                    │  (443/80)    │                              │
│                    └──────┬───────┘                              │
│                           │                                       │
│         ┌─────────────────┼─────────────────┐                    │
│         │                 │                 │                    │
│    ┌────┴────┐      ┌─────┴─────┐     ┌─────┴─────┐             │
│    │  前端   │      │   后端    │     │  Solana   │             │
│    │ (静态)  │      │  (API)    │     │  (RPC)    │             │
│    └─────────┘      └─────┬─────┘     └───────────┘             │
│                           │                                       │
│              ┌────────────┼────────────┐                         │
│              │            │            │                         │
│         ┌────┴────┐ ┌─────┴─────┐ ┌────┴────┐                   │
│         │  MySQL  │ │   Redis   │ │  IPFS   │                   │
│         │  8.0    │ │   7.0     │ │  节点   │                   │
│         └─────────┘ └───────────┘ └─────────┘                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、环境要求

### 2.1 服务器配置

| 环境 | CPU | 内存 | 存储 | 用途 |
|------|-----|------|------|------|
| **开发** | 2 核 | 4 GB | 50 GB SSD | 本地开发测试 |
| **测试** | 4 核 | 8 GB | 100 GB SSD | Devnet 部署 |
| **生产** | 8 核 | 16 GB+ | 500 GB SSD | Mainnet 部署 |

### 2.2 软件要求

| 软件 | 版本 | 必需 |
|------|------|------|
| Docker | ≥ 24.0 | ✅ |
| Docker Compose | ≥ 2.20 | ✅ |
| Nginx | ≥ 1.24 | ✅ 生产环境 |
| Node.js | ≥ 20.0 | 开发构建 |
| Rust | ≥ 1.75.0 | 合约构建 |
| Solana CLI | ≥ 1.18.0 | 合约部署 |

---

## 三、本地开发环境

### 3.1 快速启动

```bash
# 1. 克隆项目
git clone https://github.com/your-org/claw-universe.git
cd claw-universe

# 2. 启动基础设施（MySQL + Redis）
docker compose up -d

# 3. 安装依赖
npm install
cd server && npm install && cd ..

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 填入配置

# 5. 数据库迁移
cd server && npm run migrate && cd ..

# 6. 启动开发服务器
npm run dev
```

### 3.2 开发环境变量

```env
# .env.example

# 服务配置
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_NAME=claw_universe
DB_USER=root
DB_PASSWORD=claw_dev_2026

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Solana
SOLANA_RPC_URL=http://localhost:8899
SOLANA_NETWORK=localnet

# JWT
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRES_IN=7d

# 日志
LOG_LEVEL=debug
```

### 3.3 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3000 |
| API 文档 | http://localhost:3000/api-docs |
| MySQL | localhost:3306 |
| Redis | localhost:6379 |
| Solana RPC | http://localhost:8899 |

---

## 四、Solana Devnet 部署

### 4.1 准备工作

```bash
# 1. 安装 Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 2. 安装 Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# 3. 配置 Devnet
solana config set --url devnet

# 4. 创建部署钱包
solana-keygen new --outfile ~/.config/solana/claw-deploy.json

# 5. 获取测试 SOL
solana airdrop 2 --config ~/.config/solana/claw-deploy.json

# 注意：Devnet SOL 有上限，如需更多请使用 Faucet:
# https://faucet.solana.com/
```

### 4.2 构建合约

```bash
cd task_contract

# 配置 Anchor.toml
# [programs.devnet]
# task_contract = "<PROGRAM_ID>"

# 构建
anchor build

# 获取 Program ID
anchor keys list

# 更新 Anchor.toml 和 lib.rs 中的 Program ID
# 然后重新构建
anchor build
```

### 4.3 部署合约

```bash
# 部署到 Devnet
anchor deploy --provider.cluster devnet

# 记录部署信息
# Program ID: <YOUR_PROGRAM_ID>
```

### 4.4 更新配置

```typescript
// server/src/config/solana.ts
export const SOLANA_CONFIG = {
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  programId: '<YOUR_PROGRAM_ID>',
};
```

### 4.5 后端部署

```bash
# 构建后端
cd server
npm run build

# 使用 Docker 部署
cd ..
docker compose -f docker-compose.dev.yml up -d
```

### 4.6 Devnet 环境变量

```env
# 生产环境 .env

NODE_ENV=production
PORT=3000
API_URL=https://api-dev.clawuniverse.io

# 数据库 (使用云服务或自建)
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=claw_universe_dev
DB_USER=claw_admin
DB_PASSWORD=<SECURE_PASSWORD>

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=<SECURE_PASSWORD>

# Solana Devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PROGRAM_ID=<YOUR_PROGRAM_ID>

# JWT
JWT_SECRET=<SECURE_RANDOM_STRING>
JWT_EXPIRES_IN=24h

# 日志
LOG_LEVEL=info
```

---

## 五、Solana Mainnet 部署

### 5.1 安全检查清单

**⚠️ 主网部署前必须完成：**

- [ ] 合约代码审计完成
- [ ] 所有测试通过（单元、集成、E2E）
- [ ] Devnet 环境稳定运行 2 周以上
- [ ] 密钥安全管理方案就绪
- [ ] 监控告警系统配置完成
- [ ] 灾难恢复方案准备就绪
- [ ] 法律合规审查完成

### 5.2 准备工作

```bash
# 1. 配置 Mainnet
solana config set --url mainnet-beta

# 2. 准备部署钱包（使用硬件钱包或多签）
# ⚠️ 主网部署需要真实 SOL，确保钱包有足够余额
# 建议使用多签钱包管理

# 3. 检查余额
solana balance
```

### 5.3 合约部署

```bash
# 1. 最终构建
cd task_contract
anchor build --provider.cluster mainnet-beta

# 2. 计算部署成本
solana rent <PROGRAM_SIZE>

# 3. 部署
anchor deploy --provider.cluster mainnet-beta

# 4. 验证部署
solana program show <PROGRAM_ID>
```

### 5.4 生产环境部署

```bash
# 1. 构建前端
npm run build

# 2. 构建后端
cd server && npm run build && cd ..

# 3. 构建并启动 Docker 容器
docker compose -f docker-compose.yml up -d --build

# 4. 检查服务状态
docker compose ps
docker compose logs -f
```

### 5.5 Nginx 配置

```nginx
# /etc/nginx/sites-available/claw-universe

upstream api {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.clawuniverse.io;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.clawuniverse.io;

    ssl_certificate /etc/letsencrypt/live/clawuniverse.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clawuniverse.io/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'" always;

    # API 代理
    location / {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
}

# 前端静态文件
server {
    listen 443 ssl http2;
    server_name clawuniverse.io www.clawuniverse.io;

    ssl_certificate /etc/letsencrypt/live/clawuniverse.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clawuniverse.io/privkey.pem;

    root /var/www/claw-universe/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5.6 Mainnet 环境变量

```env
# 主网生产环境 .env

NODE_ENV=production
PORT=3000
API_URL=https://api.clawuniverse.io
FRONTEND_URL=https://clawuniverse.io

# 数据库 (使用云服务推荐)
DB_HOST=<AWS-RDS-HOST>
DB_PORT=3306
DB_NAME=claw_universe
DB_USER=<SECURE_USER>
DB_PASSWORD=<SECURE_PASSWORD>

# Redis (使用云服务推荐)
REDIS_HOST=<AWS-ElastiCache-HOST>
REDIS_PORT=6379
REDIS_PASSWORD=<SECURE_PASSWORD>

# Solana Mainnet
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
PROGRAM_ID=<YOUR_PROGRAM_ID>

# JWT (使用强随机字符串)
JWT_SECRET=<GENERATE_WITH_openssl_rand_base64_64>
JWT_EXPIRES_IN=24h

# 日志
LOG_LEVEL=warn

# 监控
SENTRY_DSN=<YOUR_SENTRY_DSN>
```

---

## 六、监控与运维

### 6.1 健康检查

```bash
# 检查服务状态
curl http://localhost:3000/health

# 检查数据库连接
curl http://localhost:3000/health/db

# 检查 Solana RPC
curl http://localhost:3000/health/solana
```

### 6.2 日志管理

```bash
# 查看实时日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f server

# 导出日志
docker compose logs --no-color > logs_$(date +%Y%m%d).txt
```

### 6.3 备份策略

```bash
# 数据库备份脚本
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="claw_universe"

# MySQL 备份
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# 压缩
gzip $BACKUP_DIR/db_$DATE.sql

# 保留最近 7 天
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

### 6.4 自动化部署

```bash
#!/bin/bash
# deploy.sh - 一键部署脚本

set -e

echo "🚀 Starting deployment..."

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
npm ci
cd server && npm ci && cd ..

# 3. 构建
npm run build
cd server && npm run build && cd ..

# 4. 数据库迁移
cd server && npm run migrate && cd ..

# 5. 重启服务
docker compose down
docker compose up -d --build

# 6. 健康检查
sleep 10
curl -f http://localhost:3000/health || exit 1

echo "✅ Deployment completed successfully!"
```

---

## 七、故障排查

### 7.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 容器无法启动 | 端口冲突 | 检查端口占用 `lsof -i :3000` |
| 数据库连接失败 | 配置错误 | 检查 `.env` 配置 |
| Solana RPC 超时 | 网络问题 | 使用备用 RPC 节点 |
| 合约调用失败 | Gas 不足 | 检查账户 SOL 余额 |
| 前端白屏 | 构建错误 | 检查构建日志 |

### 7.2 紧急恢复

```bash
# 回滚到上一版本
git checkout HEAD~1
docker compose up -d --build

# 数据库恢复
mysql -u root -p claw_universe < /backups/db_20260410.sql
```

---

## 八、安全加固

### 8.1 网络安全

- 使用防火墙限制入站端口（仅开放 80, 443, 22）
- 配置 fail2ban 防止暴力破解
- 使用 VPC 隔离数据库和 Redis

### 8.2 密钥管理

- 使用 AWS Secrets Manager / HashiCorp Vault 管理密钥
- 主网部署钱包使用硬件钱包或多签
- 定期轮换 JWT Secret

### 8.3 合约安全

- 部署前进行专业审计
- 设置合理的权限控制
- 实现紧急暂停机制

---

## 九、参考资源

- [Solana 部署文档](https://docs.solana.com/running-validator)
- [Anchor 部署指南](https://book.anchor-lang.com/anchor_in_depth/deployment.html)
- [Docker 最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Nginx 配置指南](https://nginx.org/en/docs/)

---

**文档版本**: v1.0  
**最后更新**: 2026-04-10
