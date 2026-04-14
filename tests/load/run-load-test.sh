#!/usr/bin/env zsh
# run-load-test.sh — Claw Universe Load Test Runner
#
# Usage:
#   ./run-load-test.sh [scenario] [--report]
#   ./run-load-test.sh           # runs all: light → medium → heavy
#   ./run-load-test.sh light      # runs single scenario
#   ./run-load-test.sh --report  # generates HTML report from last run
#
# Options:
#   --report    Generate k6 HTML report after run
#   --env KEY=VAL  Pass extra environment vars to k6
#
# Prerequisites:
#   1. Backend running:  cd server && npm run dev
#   2. k6 installed:     brew install k6   (macOS)
#                        sudo apt install k6  (Linux)
#   3. Optional InfluxDB/Grafana: docker compose up -d influxdb grafana

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR=${0:a:h}
PROJECT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd -P)
LOAD_DIR="$PROJECT_DIR/tests/load"
RESULTS_DIR="$LOAD_DIR/results"
K6_SCRIPT="$LOAD_DIR/k6-script.js"
SCENARIOS_FILE="$LOAD_DIR/scenarios.js"

# ── Defaults ────────────────────────────────────────────────────────────────────
RUN_ALL=${1:-all}        # 'all' or 'light'/'medium'/'heavy'
WANT_REPORT=false
EXTRA_ENV=()

# Parse flags
for arg in "$@"; do
  case $arg in
    --report)  WANT_REPORT=true ;;
    --env=*)   EXTRA_ENV+=("${arg#--env=}") ;;
    light|medium|heavy) RUN_ALL=$arg ;;
    *)         echo "Unknown argument: $arg" && exit 1 ;;
  esac
done

# ── Guards ─────────────────────────────────────────────────────────────────────
command -v k6 >/dev/null 2>&1 || {
  echo -e "${RED}✗ k6 not found. Install: brew install k6${RESET}"
  exit 1
}

[[ -f "$K6_SCRIPT" ]] || {
  echo -e "${RED}✗ k6 script not found: $K6_SCRIPT${RESET}"
  exit 1
}

# ── Results directory ──────────────────────────────────────────────────────────
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# ── Helper functions ────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[PASS]${RESET}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
fail()    { echo -e "${RED}[FAIL]${RESET}  $*" >&2; exit 1; }

run_scenario() {
  local SCENARIO=$1
  local OUT_JSON="$RESULTS_DIR/${SCENARIO}-${TIMESTAMP}.json"
  local OUT_HTML="$RESULTS_DIR/${SCENARIO}-${TIMESTAMP}.html"
  local OUT_SUMMARY="$RESULTS_DIR/${SCENARIO}-summary.txt"

  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  Scenario: ${SCENARIO}${RESET}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

  # Export env vars for this run
  local ENV_CMD=(
    env
    "SCENARIO=${SCENARIO}"
    "API_URL=${API_URL:-http://localhost:3001}"
    "BASE_URL=${BASE_URL:-http://localhost:5173}"
    "${EXTRA_ENV[@]}"
  )

  local K6_CMD=(
    k6 run
      "$K6_SCRIPT"
      --env "SCENARIO=${SCENARIO}"
      --env "API_URL=${API_URL:-http://localhost:3001}"
      --env "BASE_URL=${BASE_URL:-http://localhost:5173}"
      --out json="$OUT_JSON"
      --summary-export="$OUT_SUMMARY"
  )

  echo -e "${BLUE}[RUN ]${RESET}  k6 run $K6_SCRIPT --env SCENARIO=$SCENARIO"
  echo -e "${BLUE}[OUT ]${RESET}  JSON: $OUT_JSON"
  echo ""

  # Run k6; capture exit code
  local EXIT_CODE=0
  "${K6_CMD[@]}" || EXIT_CODE=$?

  if [[ $EXIT_CODE -eq 0 ]]; then
    success "Scenario '${SCENARIO}' PASSED"
  else
    warn "Scenario '${SCENARIO}' finished with exit code $EXIT_CODE (thresholds may have been breached)"
  fi

  # Generate HTML report if requested
  if [[ "$WANT_REPORT" == "true" ]]; then
    if command -v k6 run --html >/dev/null 2>&1; then
      k6 run "$K6_SCRIPT" \
        --env "SCENARIO=${SCENARIO}" \
        --env "API_URL=${API_URL:-http://localhost:3001}" \
        --env "BASE_URL=${BASE_URL:-http://localhost:5173}" \
        --out html="$OUT_HTML" >/dev/null 2>&1 || true
      echo -e "${BLUE}[HTML]${RESET}  Report: $OUT_HTML"
    fi
  fi

  echo ""
  echo "  JSON results : $OUT_JSON"
  [[ "$WANT_REPORT" == "true" ]] && echo "  HTML report  : $OUT_HTML"
  echo ""
}

# ── Pre-flight check ───────────────────────────────────────────────────────────
echo -e "${BOLD}Claw Universe — Load Test Runner${RESET}"
echo -e "  Project  : $PROJECT_DIR"
echo -e "  k6 script: $K6_SCRIPT"
echo -e "  Results  : $RESULTS_DIR"
echo -e "  Timestamp: $TIMESTAMP"
echo ""

# Warn if backend doesn't seem reachable
API_HOST=${API_URL:-http://localhost:3001}
if ! curl -sf --max-time 2 "$API_HOST/api/v1/health" >/dev/null 2>&1 && \
   ! curl -sf --max-time 2 "$API_HOST/api/v1/tasks?page=1&limit=1" >/dev/null 2>&1; then
  warn "Backend not reachable at $API_HOST — ensure server is running:"
  warn "  cd $PROJECT_DIR/server && npm run dev"
  echo ""
fi

# ── Run ─────────────────────────────────────────────────────────────────────────
if [[ "$RUN_ALL" == "all" ]]; then
  info "Running ALL scenarios: light → medium → heavy"
  info "Total estimated time: ~30 minutes"
  echo ""
  for SCENARIO in light medium heavy; do
    run_scenario $SCENARIO
    sleep 5  # brief cool-down between scenarios
  done
  info "All scenarios complete. Results in: $RESULTS_DIR/"
else
  run_scenario $RUN_ALL
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Results Summary${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

find "$RESULTS_DIR" -name "*-${TIMESTAMP}.json" -type f | sort | while read -r f; do
  SCENARIO=$(basename "$f" | cut -d'-' -f1)
  echo ""
  echo -e "  ${BOLD}${SCENARIO}:${RESET}  $f"
done

echo ""
if [[ "$WANT_REPORT" == "true" ]]; then
  HTML_FILES=("$RESULTS_DIR"/*-"${TIMESTAMP}.html"(N))
  if [[ ${#HTML_FILES[@]} -gt 0 ]]; then
    info "HTML reports:"
    for f in "${HTML_FILES[@]}"; do
      echo "    $f"
    done
  fi
fi

success "Load test run complete."
echo ""
