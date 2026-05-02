#!/bin/bash
# UNICLAW Smoke Test Script
# Tests critical backend API endpoints for MCP Server integration
# Generated: 2026-05-02

set -e

API_BASE="http://localhost:3001/api/v1"
FAILED=0
PASSED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "UNICLAW Smoke Test - $(date '+%Y-%m-%d %H:%M:%S')"
echo "API Base: $API_BASE"
echo "=============================================="
echo ""

# Test helper
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_status="$4"
  local data="$5"
  local auth_token="$6"
  
  local url="${API_BASE}${endpoint}"
  local curl_opts="-s -w '\n%{http_code}'"
  
  if [ -n "$auth_token" ]; then
    curl_opts="$curl_opts -H 'Authorization: Bearer $auth_token'"
  fi
  
  if [ -n "$data" ]; then
    curl_opts="$curl_opts -H 'Content-Type: application/json' -d '$data'"
  fi
  
  local response
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET "$url" ${auth_token:+-H "Authorization: Bearer $auth_token"} 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      ${auth_token:+-H "Authorization: Bearer $auth_token"} \
      ${data:+-d "$data"} 2>/dev/null)
  fi
  
  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)
  
  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} [$status] $method $endpoint"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} [$status] $method $endpoint (expected $expected_status)"
    echo "   Response: $body" | head -c 200
    echo ""
    FAILED=$((FAILED + 1))
  fi
}

# ========================================
# 1. Health Check
# ========================================
echo "=== 1. Health Check ==="
test_endpoint "Health" "GET" "/health" "200"

# ========================================
# 2. Public Endpoints (No Auth)
# ========================================
echo ""
echo "=== 2. Public Endpoints ==="

# Get nonce for wallet auth
test_endpoint "Get Nonce" "GET" "/auth/nonce?publicKey=DemoWallet123" "200"

# List tasks (public)
test_endpoint "List Tasks" "GET" "/tasks?status=created&limit=5" "200"

# List agents (public)
test_endpoint "List Agents" "GET" "/agents?limit=5" "200"

# ========================================
# 3. Authentication Flow
# ========================================
echo ""
echo "=== 3. Authentication Flow ==="

# Test wallet verify endpoint (MCP Server uses this)
# This will fail without valid signature, but should return 400/401, not 500
test_endpoint "Wallet Verify (invalid)" "POST" "/auth/verify" "400" \
  '{"message":"test","signature":"invalid","publicKey":"invalid"}'

# Test API key verify endpoint
test_endpoint "API Key Verify (invalid format)" "POST" "/auth/verify-api-key" "400" \
  '{"apiKey":"invalid_format"}'

# Test API key verify with proper format but invalid key
test_endpoint "API Key Verify (invalid key)" "POST" "/auth/verify-api-key" "401" \
  '{"apiKey":"uniclaw_sk_test_invalid_key_12345"}'

# ========================================
# 4. Protected Endpoints (Require Auth)
# ========================================
echo ""
echo "=== 4. Protected Endpoints (without auth - should fail) ==="

# These should return 401 without valid token
test_endpoint "Create Task (no auth)" "POST" "/tasks" "401" \
  '{"title":"Test","description":"Test"}'

test_endpoint "List My Bids (no auth)" "GET" "/bids" "401"

test_endpoint "Get My Profile (no auth)" "GET" "/agents/me" "401"

test_endpoint "Update My Profile (no auth)" "PUT" "/agents/me" "401" \
  '{"name":"Test Agent"}'

test_endpoint "Get My Reputation (no auth)" "GET" "/agents/me/reputation" "401"

# ========================================
# 5. Task Endpoints
# ========================================
echo ""
echo "=== 5. Task Endpoints ==="

# Get task by ID (should return 404 for non-existent)
test_endpoint "Get Task (not found)" "GET" "/tasks/00000000-0000-0000-0000-000000000000" "404"

# ========================================
# 6. Bid Endpoints
# ========================================
echo ""
echo "=== 6. Bid Endpoints ==="

# Create bid without auth (should fail)
test_endpoint "Create Bid (no auth)" "POST" "/bids" "401" \
  '{"task_id":"00000000-0000-0000-0000-000000000000","amount":"1.0"}'

# ========================================
# Summary
# ========================================
echo ""
echo "=============================================="
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "=============================================="

if [ $FAILED -gt 0 ]; then
  exit 1
fi
