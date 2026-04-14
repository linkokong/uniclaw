import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const taskListLatency = new Trend('task_list_latency_ms');
const taskDetailLatency = new Trend('task_detail_latency_ms');
const taskCreateLatency = new Trend('task_create_latency_ms');
const bidLatency = new Trend('bid_latency_ms');
const submitLatency = new Trend('submit_latency_ms');
const errorRate = new Rate('errors');

// ── Test configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Smoke test — 1 VU, fast ramp-up, sanity checks
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test: 'smoke' },
    },
    // Load test — 50 VUs, 2-minute steady state
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      tags: { test: 'load' },
    },
    // Stress test — rapid ramp-up to 200 VUs
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      tags: { test: 'stress' },
    },
    // Spike test — sudden spike
    spike: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '10s', target: 200 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 10 },
      ],
      tags: { test: 'spike' },
    },
  },
  thresholds: {
    // API endpoints should respond < 500ms p95 under load
    'task_list_latency_ms': ['p(95)<500'],
    'task_detail_latency_ms': ['p(95)<500'],
    'task_create_latency_ms': ['p(95)<1000'],
    'bid_latency_ms': ['p(95)<800'],
    'submit_latency_ms': ['p(95)<800'],
    // Error rate should stay below 5%
    'errors': ['rate<0.05'],
    // HTTP failures should be below 1%
    'http_req_failed': ['rate<0.01'],
  },
};

// ── Test data ─────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.E2E_BASE_URL || 'http://localhost:5173';
const API_URL  = __ENV.E2E_BACKEND_URL || 'http://localhost:3001';
const testUser = {
  wallet: 'TestWallet' + Math.floor(Math.random() * 1e9),
  name: 'k6-load-test-user',
};

let authToken = '';
let testTaskId = '';

// ── Setup: register + login once ───────────────────────────────────────────────
export function setup() {
  const res = http.post(
    `${API_URL}/api/v1/auth/register`,
    JSON.stringify({ wallet: testUser.wallet, name: testUser.name }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 201 && res.status !== 409) {
    console.error('Setup failed: ' + res.body);
  }

  const loginRes = http.post(
    `${API_URL}/api/v1/auth/login`,
    JSON.stringify({ wallet: testUser.wallet }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  authToken = loginRes.json('token') || '';

  // Create a test task for bid/submit tests
  const createRes = http.post(
    `${API_URL}/api/v1/tasks`,
    JSON.stringify({
      title: `Load Test Task ${Date.now()}`,
      description: 'Auto-generated task for k6 load testing',
      budget: 1000,
      deadline: new Date(Date.now() + 86400_000).toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    }
  );
  testTaskId = createRes.json('id') || '1';
  console.log(`Setup complete — authToken: ${authToken ? 'set' : 'MISSING'}, taskId: ${testTaskId}`);

  return { authToken, testTaskId };
}

// ── Main test runner ───────────────────────────────────────────────────────────
export default function (data: { authToken: string; testTaskId: string }) {
  const token = data.authToken;
  const taskId = data.testTaskId;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // ── TASK LIST ──────────────────────────────────────────────────────────────
  group('Task List', () => {
    const res = http.get(`${API_URL}/api/v1/tasks?page=1&limit=20`, { headers });
    const ok = check(res, {
      'task list: status 200': r => r.status === 200,
      'task list: has data': r => (r.json('data') as object) !== undefined,
    });
    if (!ok) errorRate.add(1);
    taskListLatency.add(res.timings.duration);
    sleep(1);
  });

  // ── TASK DETAIL ────────────────────────────────────────────────────────────
  group('Task Detail', () => {
    const res = http.get(`${API_URL}/api/v1/tasks/${taskId}`, { headers });
    const ok = check(res, {
      'task detail: status 200': r => r.status === 200,
      'task detail: has title': r => (r.json('title') as string) !== undefined,
    });
    if (!ok) errorRate.add(1);
    taskDetailLatency.add(res.timings.duration);
    sleep(1);
  });

  // ── BID ON TASK ────────────────────────────────────────────────────────────
  group('Bid on Task', () => {
    const payload = JSON.stringify({ amount: 500, message: 'I can do this task' });
    const res = http.post(`${API_URL}/api/v1/tasks/${taskId}/bids`, payload, { headers });
    const ok = check(res, {
      'bid: status 201 or already bid': r => r.status === 201 || r.status === 409,
    });
    if (!ok) errorRate.add(1);
    bidLatency.add(res.timings.duration);
    sleep(1);
  });

  // ── SUBMIT DELIVERABLE ─────────────────────────────────────────────────────
  group('Submit Deliverable', () => {
    const payload = JSON.stringify({ content: `Submission at ${Date.now()}` });
    const res = http.post(`${API_URL}/api/v1/tasks/${taskId}/submit`, payload, { headers });
    const ok = check(res, {
      'submit: status 200 or not-your-task': r => r.status === 200 || r.status === 403,
    });
    if (!ok) errorRate.add(1);
    submitLatency.add(res.timings.duration);
    sleep(1);
  });

  // ── USER PROFILE ───────────────────────────────────────────────────────────
  group('User Profile', () => {
    const res = http.get(`${API_URL}/api/v1/users/me`, { headers });
    const ok = check(res, {
      'profile: status 200': r => r.status === 200,
    });
    if (!ok) errorRate.add(1);
    sleep(1);
  });
}

// ── Teardown ──────────────────────────────────────────────────────────────────
export function teardown(data: { authToken: string }) {
  if (data.authToken) {
    http.del(
      `${API_URL}/api/v1/tasks/cleanup-test`,
      null,
      { headers: { Authorization: `Bearer ${data.authToken}` } }
    );
  }
  console.log('Load test teardown complete.');
}
