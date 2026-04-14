/**
 * k6-script.js — Claw Universe Load Test
 * Tests: Task List / Task Create / Bid API
 *
 * Usage:
 *   k6 run k6-script.js --env SCENARIO=light
 *   k6 run k6-script.js --env SCENARIO=medium
 *   k6 run k6-script.js --env SCENARIO=heavy
 *
 * Environment Variables:
 *   API_URL          — backend base URL (default: http://localhost:3001)
 *   BASE_URL         — frontend base URL (default: http://localhost:5173)
 *   SCENARIO         — light | medium | heavy
 *   DURATION         — override scenario duration (e.g. "2m")
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { scenarios } from './scenarios.js';

// ── Custom metrics ─────────────────────────────────────────────────────────────
const taskListLatency   = new Trend('task_list_latency_ms');
const taskCreateLatency = new Trend('task_create_latency_ms');
const taskDetailLatency = new Trend('task_detail_latency_ms');
const bidCreateLatency  = new Trend('bid_create_latency_ms');
const bidListLatency    = new Trend('bid_list_latency_ms');

const errorRate       = new Rate('error_rate');
const httpFailRate    = new Rate('http_req_failed');

const activeTasksGauge = new Gauge('active_tasks_created');

// ── Config ────────────────────────────────────────────────────────────────────
const API_URL  = __ENV.API_URL  || 'http://localhost:3001';
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';

// Resolve scenario from env or default to 'light'
const scenarioName = __ENV.SCENARIO || 'light';
const scenarioCfg  = scenarios[scenarioName] || scenarios.light;

export { scenarioCfg as options };

// Override duration if provided
if (__ENV.DURATION) {
  scenarioCfg.scenario.default.duration = __ENV.DURATION;
}

// ── Thresholds ────────────────────────────────────────────────────────────────
export const thresholds = {
  'task_list_latency_ms':   ['p(95)<500',  'p(99)<1200'],
  'task_create_latency_ms': ['p(95)<1000', 'p(99)<2000'],
  'task_detail_latency_ms': ['p(95)<500',  'p(99)<1200'],
  'bid_create_latency_ms':  ['p(95)<800',  'p(99)<1500'],
  'bid_list_latency_ms':    ['p(95)<600',  'p(99)<1200'],
  'error_rate':             ['rate<0.05'],
  'http_req_failed':        ['rate<0.01'],
};

// ── Shared test data ───────────────────────────────────────────────────────────
let setupData = null;
let walletIndex = 0;
let createdTaskIds = [];

// ── Setup: run once per test, not per VU ──────────────────────────────────────
export function setup() {
  console.log(`[setup] Starting load test — scenario: ${scenarioName}, VUs: ${scenarioCfg.vus}, duration: ${scenarioCfg.duration}`);

  // Register & login a test admin user
  const wallet = `k6-load-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const regRes = http.post(
    `${API_URL}/api/v1/auth/register`,
    JSON.stringify({ wallet, name: 'k6-admin' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  let token = '';
  if (regRes.status === 201) {
    const loginRes = http.post(
      `${API_URL}/api/v1/auth/login`,
      JSON.stringify({ wallet }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    token = loginRes.json('token') || '';
  } else if (regRes.status === 409) {
    // Already registered — just login
    const loginRes = http.post(
      `${API_URL}/api/v1/auth/login`,
      JSON.stringify({ wallet }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    token = loginRes.json('token') || '';
  } else {
    console.error('[setup] Auth failed: ' + regRes.status + ' — ' + regRes.body);
  }

  // Pre-create a pool of tasks for bid tests
  const poolSize = Math.min(scenarioCfg.vus * 2, 50);
  const taskIds = [];
  for (let i = 0; i < poolSize; i++) {
    const res = http.post(
      `${API_URL}/api/v1/tasks`,
      JSON.stringify({
        title:       `[k6-prefab] Load test task ${i + 1}`,
        description: 'Auto-generated prefab task for load testing bid API',
        budget:      100 + Math.floor(Math.random() * 500),
        deadline:    new Date(Date.now() + 86400_000).toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (res.status === 201) {
      const id = res.json('id') || res.json('task.id') || res.json('data.id');
      if (id) taskIds.push(id);
    }
    sleep(0.1);
  }

  console.log(`[setup] Auth token: ${token ? 'OK' : 'MISSING'}, prefab tasks: ${taskIds.length}`);
  setupData = { token, wallet, taskIds, poolSize };
  return setupData;
}

// ── Per-VU iteration ───────────────────────────────────────────────────────────
export default function (data) {
  const token = data?.token || '';
  const taskIds = data?.taskIds || [];
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // Each VU gets a deterministic wallet identity
  const vuId = __VU || 0;
  const vwWallet = `k6-vu-${vuId}-${Date.now()}`;
  const vwHeaders = {
    'Content-Type': 'application/json',
    ...authHeader,
  };

  // ── Group 1: Task List ──────────────────────────────────────────────────────
  group('1_task_list', () => {
    const params = { headers: vwHeaders };
    const res = http.get(`${API_URL}/api/v1/tasks?page=1&limit=20`, params);

    const ok = check(res, {
      'task list: status 200':           r => r.status === 200,
      'task list: has data array':       r => Array.isArray(r.json('data') || r.json()),
    });

    if (!ok) {
      errorRate.add(1);
      httpFailRate.add(1);
    } else {
      httpFailRate.add(0);
    }
    taskListLatency.add(res.timings.duration);
    sleep(1 + Math.random() * 0.5);
  });

  // ── Group 2: Task Detail ───────────────────────────────────────────────────
  group('2_task_detail', () => {
    // Pick a random prefab task
    const targetId = taskIds.length > 0
      ? taskIds[Math.floor(Math.random() * taskIds.length)]
      : '1';

    const res = http.get(`${API_URL}/api/v1/tasks/${targetId}`, { headers: vwHeaders });

    const ok = check(res, {
      'task detail: status 200':         r => r.status === 200,
      'task detail: has title or error': r => r.status === 200 || r.status === 404,
    });

    if (!ok) {
      errorRate.add(1);
      httpFailRate.add(1);
    } else {
      httpFailRate.add(0);
    }
    taskDetailLatency.add(res.timings.duration);
    sleep(1 + Math.random() * 0.5);
  });

  // ── Group 3: Create Task ───────────────────────────────────────────────────
  group('3_task_create', () => {
    const payload = JSON.stringify({
      title:       `[k6-vu${vuId}] Load test task at ${Date.now()}`,
      description: `VU #${vuId} — ${scenarioName} scenario — ${new Date().toISOString()}`,
      budget:      200 + Math.floor(Math.random() * 800),
      deadline:    new Date(Date.now() + 86400_000 * 3).toISOString(),
      skills:      ['load-test', 'auto'],
    });

    const res = http.post(`${API_URL}/api/v1/tasks`, payload, { headers: vwHeaders });

    const ok = check(res, {
      'task create: status 201':          r => r.status === 201,
      'task create: has id in response': r => !!(r.json('id') || r.json('task.id') || r.json('data.id')),
    });

    if (!ok) {
      errorRate.add(1);
      httpFailRate.add(1);
    } else {
      httpFailRate.add(0);
      // Track created tasks (up to 5 per VU to avoid memory bloat)
      const id = res.json('id') || res.json('task.id') || res.json('data.id');
      if (id && createdTaskIds.length < __ENV.MAX_TRACKED_TASKS * 1 || __ENV.MAX_TRACKED_TASKS * 1 === 1) {
        createdTaskIds.push(id);
        activeTasksGauge.add(1);
      }
    }
    taskCreateLatency.add(res.timings.duration);
    sleep(2 + Math.random());
  });

  // ── Group 4: Place Bid ────────────────────────────────────────────────────
  group('4_bid_create', () => {
    const targetId = taskIds.length > 0
      ? taskIds[Math.floor(Math.random() * taskIds.length)]
      : '1';

    const payload = JSON.stringify({
      amount:  100 + Math.floor(Math.random() * 400),
      message: `Bid from VU #${vuId} — ${new Date().toISOString()}`,
    });

    const res = http.post(`${API_URL}/api/v1/tasks/${targetId}/bids`, payload, { headers: vwHeaders });

    const ok = check(res, {
      'bid: status 201 | 409 | 400': r => [201, 409, 400].includes(r.status),
    });

    if (!ok) {
      errorRate.add(1);
      httpFailRate.add(1);
    } else {
      httpFailRate.add(0);
    }
    bidCreateLatency.add(res.timings.duration);
    sleep(1 + Math.random() * 0.5);
  });

  // ── Group 5: List My Bids ─────────────────────────────────────────────────
  group('5_bid_list', () => {
    const res = http.get(`${API_URL}/api/v1/bids/my`, { headers: vwHeaders });

    const ok = check(res, {
      'bid list: status 200 | 401': r => [200, 401].includes(r.status),
    });

    if (!ok) {
      errorRate.add(1);
      httpFailRate.add(1);
    } else {
      httpFailRate.add(0);
    }
    bidListLatency.add(res.timings.duration);
    sleep(1);
  });
}

// ── Teardown ───────────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log(`[teardown] Load test complete. Scenario: ${scenarioName}`);
  console.log(`[teardown] Tasks created during test: ${createdTaskIds.length}`);
  // Optionally cleanup: POST /api/v1/tasks/batch-delete with IDs
  // For safety, cleanup is left to the CI pipeline / db seed scripts
}
