#!/bin/bash

# API Integration Test Script
# 测试 Silicon Bureau 后端 API 端点

set -e

# 配置
BASE_URL="${API_BASE_URL:-http://localhost:3001}"
TIMEOUT=10

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Silicon Bureau API Tests"
echo "  Base URL: $BASE_URL"
echo "========================================"
echo ""

# 测试计数器
TOTAL=0
PASSED=0
FAILED=0

# 测试函数
test_api() {
    local name="$1"
    local endpoint="$2"
    local expected_status="${3:-200}"
    
    TOTAL=$((TOTAL + 1))
    echo -n "Testing $name ... "
    
    response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "${BASE_URL}${endpoint}" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        # 显示响应预览（前200字符）
        preview=$(echo "$body" | head -c 200)
        if [ -n "$preview" ]; then
            echo "   Response: ${preview}..."
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $http_code)"
        FAILED=$((FAILED + 1))
        if [ -n "$body" ]; then
            echo "   Error: $body"
        fi
    fi
    echo ""
}

# 测试连接
echo -e "${YELLOW}Checking server connection...${NC}"
if curl -s --max-time 5 "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}Server is reachable${NC}"
    echo ""
else
    echo -e "${YELLOW}Warning: Server may not be running at $BASE_URL${NC}"
    echo "Tests will proceed anyway (endpoints might still work)"
    echo ""
fi

# ========================================
# API Tests
# ========================================

echo "========================================"
echo "  Task API Tests"
echo "========================================"

test_api "GET /api/tasks" "/api/tasks"
test_api "GET /api/tasks?status=open" "/api/tasks?status=open"
test_api "GET /api/tasks?limit=5" "/api/tasks?limit=5"

echo "========================================"
echo "  User API Tests"
echo "========================================"

test_api "GET /api/users" "/api/users"
test_api "GET /api/users?role=freelancer" "/api/users?role=freelancer"

echo "========================================"
echo "  Bid API Tests"
echo "========================================"

test_api "GET /api/bids" "/api/bids"
test_api "GET /api/bids?task_id=1" "/api/bids?task_id=1"

# ========================================
# Summary
# ========================================

echo "========================================"
echo "  Test Summary"
echo "========================================"
echo ""
echo "Total:  $TOTAL tests"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. ✗${NC}"
    exit 1
fi
