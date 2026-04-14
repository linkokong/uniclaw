# Load Testing — Claw Universe

## Tool

Uses **[k6](https://k6.io)** (free, open-source, Go-based load testing).

Install on macOS: `brew install k6`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run load:smoke` | Smoke test — 1 VU, 30s |
| `npm run load:load`   | Load test — 20→50 VUs, 2.5 min |
| `npm run load:stress` | Stress test — up to 200 VUs, 3.5 min |
| `npm run load:spike`  | Spike test — 10→200 VUs spike, 2.5 min |
| `npm run load:all`    | Run all scenarios sequentially |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BACKEND_URL` | `http://localhost:3001` | Backend API base URL |
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend base URL |

Example:
```bash
E2E_BACKEND_URL=http://localhost:3001 npm run load:load
```

## Prerequisites

1. Backend must be running: `cd server && npm run dev`
2. Database seeded with test data (optional — setup phase creates its own test user + task)

## Scenarios

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| Smoke | 1 | 30s | Sanity check, verify no crashes |
| Load | 0→50 | 3min | Normal peak traffic simulation |
| Stress | 0→200 | 3.5min | Pushing past capacity limits |
| Spike | 10→200 | 2.5min | Sudden traffic burst |

## Thresholds

- Task list/detail p(95) < **500ms**
- Task create p(95) < **1000ms**
- Bid/submit p(95) < **800ms**
- Error rate < **5%**
- HTTP failure rate < **1%**

## Output

k6 prints a summary to stdout and saves:
- `load-test-results.json` — machine-readable results
- HTML report via `k6 report` (install: `npm i -g k6 Reporter`)

## Integrating with CI

```yaml
# Example GitHub Actions
- name: Run load tests
  run: |
    npm run load:smoke
  env:
    E2E_BACKEND_URL: ${{ secrets.STAGING_API_URL }}
```
