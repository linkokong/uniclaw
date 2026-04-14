/**
 * scenarios.js — Claw Universe Load Test Scenarios
 *
 * Three concurrency tiers:
 *   light   — 10 VUs  (小规模验证)
 *   medium  — 50 VUs (预期峰值)
 *   heavy   — 100 VUs (压力上限)
 *
 * Each scenario follows the same ramp pattern:
 *   ramp-up  → steady-state → ramp-down
 *
 * Import from k6-script.js:
 *   import { scenarios } from './scenarios.js';
 *   export const options = scenarios[__ENV.SCENARIO || 'light'];
 *
 * Run individually:
 *   k6 run k6-script.js --env SCENARIO=light
 *   k6 run k6-script.js --env SCENARIO=medium
 *   k6 run k6-script.js --env SCENARIO=heavy
 *
 * Run all sequentially:
 *   ./run-load-test.sh
 */

/**
 * @typedef {Object} Scenario
 * @property {string}  scenario.name          — display name
 * @property {string}  scenario.tag           — k6 tag for filtering metrics
 * @property {number}  scenario.vus           — target VUs
 * @property {string}  scenario.duration     — total duration
 * @property {Array}   scenario.stages       — k6 executor stages
 * @property {string}  [scenario.notes]      — human description
 */

/** @type {Record<string, Scenario>} */
export const scenarios = {

  // ── Light: 10 VUs ───────────────────────────────────────────────────────────
  light: {
    name:     'light — 10 concurrent users',
    tag:      'light',
    vus:      10,
    duration: '5m',
    notes:    'Sanity + light baseline. Confirms service is up and latency is healthy under modest load.',
    stages: [
      { duration: '30s',  target: 10  },  // instant ramp-up
      { duration: '3m',   target: 10  },  // steady state
      { duration: '30s',  target: 0   },  // ramp-down
    ],
  },

  // ── Medium: 50 VUs ───────────────────────────────────────────────────────────
  medium: {
    name:     'medium — 50 concurrent users',
    tag:      'medium',
    vus:      50,
    duration: '10m',
    notes:    'Normal peak traffic. Validates SLA thresholds (p95 < 500ms for reads, p95 < 1000ms for writes).',
    stages: [
      { duration: '1m',   target: 50  },  // 1-min ramp
      { duration: '7m',   target: 50  },  // steady state
      { duration: '1m',   target: 0   },  // ramp-down
    ],
  },

  // ── Heavy: 100 VUs ───────────────────────────────────────────────────────────
  heavy: {
    name:     'heavy — 100 concurrent users',
    tag:      'heavy',
    vus:      100,
    duration: '15m',
    notes:    'Stress ceiling. Exposes bottlenecks, connection-pool exhaustion, slow queries, and breaking points.',
    stages: [
      { duration: '2m',   target: 100 },  // 2-min gradual ramp
      { duration: '10m',  target: 100 },  // sustained stress
      { duration: '2m',   target: 0   },  // ramp-down
    ],
  },
};

// ── Convenience helpers ─────────────────────────────────────────────────────────

/**
 * Returns the list of all scenario keys, e.g. ['light', 'medium', 'heavy']
 */
export function listScenarios() {
  return Object.keys(scenarios);
}

/**
 * Resolve a scenario by name (case-insensitive), falling back to 'light'.
 * @param {string} name
 */
export function getScenario(name) {
  return scenarios[name?.toLowerCase()] || scenarios.light;
}

/**
 * Summary table for docs / console output.
 */
export const summaryTable = `
┌─────────┬────────┬───────────┬───────────────────────────────────────┐
│ Key     │  VUs   │ Duration  │ Purpose                                │
├─────────┼────────┼───────────┼───────────────────────────────────────┤
│ light   │    10  │   5 min   │ Baseline sanity + latency check        │
│ medium  │    50  │  10 min   │ Peak-traffic SLA validation            │
│ heavy   │   100  │  15 min   │ Stress ceiling, bottleneck discovery   │
└─────────┴────────┴───────────┴───────────────────────────────────────┘
`;
