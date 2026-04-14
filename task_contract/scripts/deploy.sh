#!/bin/bash
# =============================================================================
# Claw Universe Smart Contract Deployment Script
# =============================================================================
# Supports: devnet | testnet | mainnet
# Usage: ./scripts/deploy.sh <network> [skip-build]
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Configuration
# =============================================================================

NETWORK="${1:-devnet}"
SKIP_BUILD="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_REPORT="$PROJECT_DIR/deploy-report.json"

# Program configuration
PROGRAM_NAME="task_contract"
PROGRAM_ID="EzZB9K4JVeFDczc4tRy78uR6JAiQazHhsY7MvY3B2Q2C"
KEYPAIR_PATH="$PROJECT_DIR/target/deploy/${PROGRAM_NAME}-keypair.json"

# Network RPC endpoints
declare -A RPC_URLS
RPC_URLS["devnet"]="${RPC_URL:-https://api.devnet.solana.com}"
RPC_URLS["testnet"]="${RPC_URL:-https://api.testnet.solana.com}"
RPC_URLS["mainnet"]="${RPC_URL:-https://api.mainnet-beta.solana.com}"

# Cluster identifiers
declare -A CLUSTER_IDS
CLUSTER_IDS["devnet"]="Devnet"
CLUSTER_IDS["testnet"]="Testnet"
CLUSTER_IDS["mainnet"]="Mainnet"

# =============================================================================
# Utility Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Anchor/Solana CLI
    if ! command -v anchor &> /dev/null && ! command -v solana &> /dev/null; then
        log_error "Neither 'anchor' nor 'solana' CLI found. Please install Anchor framework."
        exit 1
    fi
    
    # Check for keypair
    if [ ! -f "$KEYPAIR_PATH" ]; then
        log_error "Keypair not found at: $KEYPAIR_PATH"
        log_info "Generate with: solana-keygen new -o target/deploy/${PROGRAM_NAME}-keypair.json"
        exit 1
    fi
    
    # Check wallet
    if [ -z "$ANCHOR_WALLET" ] && [ -z "$SOLANA_WALLET" ]; then
        log_warn "No wallet configured. Set ANCHOR_WALLET or SOLANA_WALLET environment variable."
    fi
    
    log_success "Prerequisites check passed"
}

# =============================================================================
# Build
# =============================================================================

build_program() {
    log_info "Building program..."
    
    cd "$PROJECT_DIR"
    
    if [ -f "Anchor.toml" ]; then
        anchor build --verifiable 2>&1 | tee "$PROJECT_DIR/build.log"
    else
        cargo build-sbf 2>&1 | tee "$PROJECT_DIR/build.log"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Build completed successfully"
    else
        log_error "Build failed. Check build.log for details."
        exit 1
    fi
}

# =============================================================================
# Get Program Address
# =============================================================================

get_program_address() {
    if [ -f "$KEYPAIR_PATH" ]; then
        solana-keygen pubkey "$KEYPAIR_PATH" 2>/dev/null
    else
        echo "$PROGRAM_ID"
    fi
}

# =============================================================================
# Deploy
# =============================================================================

deploy_to_network() {
    local network="$1"
    local rpc_url="${RPC_URLS[$network]}"
    
    log_info "Deploying to ${CLUSTER_IDS[$network]} ($network)..."
    log_info "RPC URL: $rpc_url"
    
    cd "$PROJECT_DIR"
    
    # Set deployment parameters
    export ANCHOR_PROVIDER_URL="$rpc_url"
    export ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
    export SOLANA_URL="$rpc_url"
    
    # Get keypair for deployment
    local pubkey
    pubkey=$(get_program_address)
    
    # Check balance
    log_info "Checking wallet balance..."
    local balance
    balance=$(solana balance "$(solana-keygen pubkey "$ANCHOR_WALLET" 2>/dev/null || echo "$ANCHOR_WALLET")" --url "$rpc_url" 2>/dev/null | awk '{print $1}' || echo "N/A")
    log_info "Current balance: $balance SOL"
    
    # Deploy with anchor
    if command -v anchor &> /dev/null; then
        log_info "Deploying with Anchor..."
        anchor deploy --provider.cluster "$network" 2>&1 | tee "$PROJECT_DIR/deploy.log"
    else
        log_info "Deploying with Solana CLI..."
        solana program deploy "$KEYPAIR_PATH" \
            --url "$rpc_url" \
            --keypair "$ANCHOR_WALLET" \
            2>&1 | tee "$PROJECT_DIR/deploy.log"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Deployment transaction sent"
        
        # Extract transaction signature from deploy log
        local tx_sig
        tx_sig=$(grep -oE '[1-9A-HJ-NP-Za-km-z]{86,}' "$PROJECT_DIR/deploy.log" | tail -1 || echo "pending")
        
        # Save deployment info
        echo "$tx_sig"
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# =============================================================================
# Generate Deploy Report
# =============================================================================

generate_report() {
    local network="$1"
    local tx_sig="$2"
    local program_address="$3"
    local build_time="$4"
    
    local status="success"
    if [ "$tx_sig" = "pending" ] || [ -z "$tx_sig" ]; then
        status="partial"
        tx_sig="N/A"
    fi
    
    cat > "$DEPLOY_REPORT" << EOF
{
  "deployment": {
    "timestamp": "$(timestamp)",
    "network": "$network",
    "cluster": "${CLUSTER_IDS[$network]}",
    "status": "$status",
    "program": {
      "name": "$PROGRAM_NAME",
      "id": "$program_address",
      "keypair": "$KEYPAIR_PATH"
    },
    "transaction": {
      "signature": "$tx_sig",
      "rpc_url": "${RPC_URLS[$network]}"
    },
    "build": {
      "time": "$build_time",
      "log": "$PROJECT_DIR/build.log"
    }
  },
  "next_steps": {
    "initialize_platform": "ts-node $SCRIPT_DIR/init_pool.ts $network",
    "verify_deployment": "ts-node $SCRIPT_DIR/verify.ts $network",
    "view_on_explorer": "https://explorer.solana.com/address/$program_address?cluster=$network"
  }
}
EOF

    log_success "Deploy report generated: $DEPLOY_REPORT"
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo ""
    echo "========================================"
    echo "  Claw Universe - Contract Deployment"
    echo "========================================"
    echo ""
    log_info "Target Network: $NETWORK"
    log_info "Timestamp: $(timestamp)"
    echo ""
    
    # Validate network
    if [[ ! "devnet testnet mainnet" == *"$NETWORK"* ]]; then
        log_error "Invalid network: $NETWORK"
        log_info "Valid options: devnet, testnet, mainnet"
        exit 1
    fi
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # Run prerequisites
    check_prerequisites
    
    # Build (unless skipped)
    local build_start
    build_start=$(date +%s)
    
    if [ "$SKIP_BUILD" != "skip-build" ]; then
        build_program
    else
        log_warn "Build skipped"
    fi
    
    local build_end
    build_end=$(date +%s)
    local build_duration=$((build_end - build_start))
    
    # Deploy
    local tx_sig
    tx_sig=$(deploy_to_network "$NETWORK")
    
    # Get program address
    local program_address
    program_address=$(get_program_address)
    
    # Generate report
    generate_report "$NETWORK" "$tx_sig" "$program_address" "${build_duration}s"
    
    echo ""
    echo "========================================"
    log_success "Deployment Complete!"
    echo "========================================"
    echo ""
    echo "  Program ID: $program_address"
    echo "  Network:    ${CLUSTER_IDS[$NETWORK]} ($NETWORK)"
    echo "  TX Sig:     $tx_sig"
    echo ""
    echo "  Report:     $DEPLOY_REPORT"
    echo ""
    echo "  Next Steps:"
    echo "  1. Initialize pool: ts-node $SCRIPT_DIR/init_pool.ts $NETWORK"
    echo "  2. Verify deployment: ts-node $SCRIPT_DIR/verify.ts $NETWORK"
    echo ""
}

main "$@"
