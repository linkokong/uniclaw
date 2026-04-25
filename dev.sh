#!/bin/bash
# Claw Universe — 本地开发环境一键启动/停止
# 用法: ./dev.sh            启动（前端5173 + 后端3001）
#       ./dev.sh tunnel     启动 + cloudflare tunnel（全走3001，支持HMR）
#       ./dev.sh stop       停止

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PID_DIR="$(pwd)/.dev-pids"
ROOT_DIR="$(pwd)"

stop_all() {
  echo -e "${YELLOW}⏹  停止开发环境...${NC}"

  # 停止 tunnel
  if [ -f "$PID_DIR/tunnel.pid" ]; then
    kill "$(cat $PID_DIR/tunnel.pid)" 2>/dev/null && echo -e "${GREEN}  ✓ Tunnel 已停止${NC}" || echo "  Tunnel 未运行"
    rm -f "$PID_DIR/tunnel.pid"
  fi

  # 停止前端
  if [ -f "$PID_DIR/vite.pid" ]; then
    kill "$(cat $PID_DIR/vite.pid)" 2>/dev/null && echo -e "${GREEN}  ✓ 前端已停止${NC}" || echo "  前端未运行"
    rm -f "$PID_DIR/vite.pid"
  fi

  # 停止后端
  if [ -f "$PID_DIR/server.pid" ]; then
    kill "$(cat $PID_DIR/server.pid)" 2>/dev/null && echo -e "${GREEN}  ✓ 后端已停止${NC}" || echo "  后端未运行"
    rm -f "$PID_DIR/server.pid"
  fi

  # 停止 Docker 容器
  docker stop claw-pg claw-redis 2>/dev/null && echo -e "${GREEN}  ✓ PostgreSQL + Redis 已停止${NC}" || echo "  容器未运行"

  rm -rf "$PID_DIR"
  echo -e "${GREEN}✅ 开发环境已停止${NC}"
  exit 0
}

# 处理 stop 参数
if [ "$1" = "stop" ]; then
  stop_all
fi

echo -e "${CYAN}🦞 Claw Universe — 启动本地开发环境${NC}"
echo ""

# ── 1. 检查依赖 ──────────────────────────────────────────
echo -e "${YELLOW}[1/5] 检查依赖...${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js 未安装${NC}" && exit 1
fi
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker 未安装${NC}" && exit 1
fi
if ! docker info &>/dev/null; then
  echo -e "${RED}✗ Docker 未启动，请先启动 Docker Desktop${NC}" && exit 1
fi
echo -e "  Node $(node -v) ✓"

# ── 2. 启动 PostgreSQL + Redis ────────────────────────────
echo -e "${YELLOW}[2/5] 启动 PostgreSQL + Redis...${NC}"

# PostgreSQL
if docker ps --format '{{.Names}}' | grep -q claw-pg; then
  echo -e "  PostgreSQL 已在运行 ✓"
else
  if docker ps -a --format '{{.Names}}' | grep -q claw-pg; then
    docker start claw-pg >/dev/null
  else
    docker run -d --name claw-pg \
      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=claw_universe \
      -p 5432:5432 postgres:16-alpine >/dev/null
  fi
  echo -e "  PostgreSQL 启动中..."
fi

# Redis
if docker ps --format '{{.Names}}' | grep -q claw-redis; then
  echo -e "  Redis 已在运行 ✓"
else
  if docker ps -a --format '{{.Names}}' | grep -q claw-redis; then
    docker start claw-redis >/dev/null
  else
    docker run -d --name claw-redis -p 6379:6379 redis:7-alpine >/dev/null
  fi
  echo -e "  Redis 启动中..."
fi

# 等待 PG 就绪
echo -n "  等待 PostgreSQL 就绪"
for i in $(seq 1 15); do
  if docker exec claw-pg pg_isready -q 2>/dev/null; then
    echo -e " ✓"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" = "15" ]; then
    echo -e "\n${RED}✗ PostgreSQL 启动超时${NC}" && exit 1
  fi
done

# ── 3. 清理占用端口 ───────────────────────────────────────
echo -e "${YELLOW}[3/6] 检查端口占用...${NC}"

kill_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo -e "  端口 $port 被占用 (PID: $pids)，正在释放..."
    echo "$pids" | xargs kill -9 2>/dev/null
    sleep 1
    echo -e "  端口 $port 已释放 ✓"
  else
    echo -e "  端口 $port 空闲 ✓"
  fi
}

kill_port 5173
kill_port 3001

mkdir -p "$PID_DIR"

# ── 4. 安装依赖 ───────────────────────────────────────────
echo -e "${YELLOW}[4/6] 检查 npm 依赖...${NC}"

if [ ! -d "node_modules" ]; then
  echo "  安装前端依赖..."
  npm install --silent
fi
if [ ! -d "server/node_modules" ]; then
  echo "  安装后端依赖..."
  (cd server && npm install --silent)
fi
echo -e "  依赖就绪 ✓"

# ── 4. 启动后端 ───────────────────────────────────────────
echo -e "${YELLOW}[5/6] 启动后端 API (port 3001)...${NC}"

# 确保 server/.env 存在
if [ ! -f "server/.env" ]; then
  cat > server/.env << 'ENV'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/claw_universe
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-claw-universe-2026
PORT=3001
NODE_ENV=development
SOLANA_RPC_URL=https://api.devnet.solana.com
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
ENV
  echo "  创建 server/.env ✓"
fi

cd server && npx tsx src/index.ts &
SERVER_PID=$!
cd "$ROOT_DIR"
echo "$SERVER_PID" > "$PID_DIR/server.pid"

# 等后端就绪
echo -n "  等待后端就绪"
for i in $(seq 1 10); do
  if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e " ✓"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" = "10" ]; then
    echo -e " (可能还在初始化，继续...)"
  fi
done

# ── 5. 启动前端 ───────────────────────────────────────────
echo -e "${YELLOW}[6/6] 启动前端 (port 5173)...${NC}"

npx vite --port 5173 &
VITE_PID=$!
echo "$VITE_PID" > "$PID_DIR/vite.pid"

sleep 2

echo ""
echo -e "${GREEN}✅ 开发环境已启动！${NC}"
echo ""
echo -e "  ${CYAN}前端${NC}  → http://localhost:5173"
echo -e "  ${CYAN}后端${NC}  → http://localhost:3001/api/v1"
echo -e "  ${CYAN}统一入口${NC} → http://localhost:3001 (后端代理前端，支持HMR)"
echo -e "  ${CYAN}数据库${NC} → postgresql://localhost:5432/claw_universe"
echo -e "  ${CYAN}Redis${NC} → redis://localhost:6379"

# ── Tunnel 模式 ───────────────────────────────────────────
if [ "$1" = "tunnel" ]; then
  echo ""
  echo -e "${YELLOW}🌐 启动 Cloudflare Tunnel...${NC}"
  if ! command -v cloudflared &>/dev/null; then
    echo -e "  cloudflared 未安装，尝试 npx..."
    npx cloudflared tunnel --url http://localhost:3001 &
  else
    cloudflared tunnel --url http://localhost:3001 &
  fi
  TUNNEL_PID=$!
  echo "$TUNNEL_PID" > "$PID_DIR/tunnel.pid"
  echo -e "  Tunnel PID: $TUNNEL_PID（等待 URL 输出...）"
fi

echo ""
echo -e "  停止: ${YELLOW}./dev.sh stop${NC}"
echo -e "  或按 ${YELLOW}Ctrl+C${NC}"
echo ""

# Ctrl+C 时清理
trap 'echo ""; stop_all' INT TERM

# 保持前台运行
wait
