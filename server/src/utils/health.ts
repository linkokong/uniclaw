/**
 * Health Check Utilities
 * — Database connectivity probe
 * — Memory usage monitor
 * — Combined health endpoint handler
 */

import { Request, Response, NextFunction } from 'express';
import os from 'os';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number; // seconds
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
  };
}

interface HealthCheck {
  status: 'ok' | 'degraded' | 'unhealthy';
  message: string;
  duration?: number; // ms taken to complete
}

// ─── Memory Monitor ───────────────────────────────────────────────────────────

/**
 * Returns current memory usage for the Node.js process and the system.
 */
export function getMemoryUsage(): {
  process: {
    rssMB: number;        // Resident Set Size — total memory allocated
    heapUsedMB: number;  // V8 heap used
    heapTotalMB: number; // V8 heap total
    externalMB: number;  // C++ objects bound to JS objects
    arrayBuffersMB: number;
  };
  system: {
    totalMB: number;
    freeMB: number;
    usedMB: number;
    usagePercent: number;
  };
  memoryUsagePercent: number; // process rss / system total
} {
  const used = process.memoryUsage();

  const totalMemBytes = os.totalmem();
  const freeMemBytes  = os.freemem();
  const usedMemBytes  = totalMemBytes - freeMemBytes;

  const toMB = (b: number) => Math.round(b / 1024 / 1024 * 100) / 100;

  const rssMB         = toMB(used.rss);
  const heapUsedMB    = toMB(used.heapUsed);
  const heapTotalMB   = toMB(used.heapTotal);
  const externalMB    = toMB(used.external);
  const arrayBuffersMB = toMB((used as unknown as { arrayBuffers: number }).arrayBuffers ?? 0);

  const totalMB   = toMB(totalMemBytes);
  const freeMB    = toMB(freeMemBytes);
  const usedMB    = toMB(usedMemBytes);
  const sysUsage  = Math.round((usedMemBytes / totalMemBytes) * 10000) / 100;
  const procUsage = Math.round((used.rss / totalMemBytes) * 10000) / 100;

  return {
    process: { rssMB, heapUsedMB, heapTotalMB, externalMB, arrayBuffersMB },
    system:  { totalMB, freeMB, usedMB, usagePercent: sysUsage },
    memoryUsagePercent: procUsage,
  };
}

/**
 * Check memory health based on configurable thresholds.
 */
export function checkMemory(thresholds?: {
  /** Percentage of system memory consumed by process — warn above this (default: 70) */
  processWarningPercent?: number;
  /** Percentage of system memory consumed by process — error above this (default: 90) */
  processCriticalPercent?: number;
  /** Percentage of V8 heap used — warn above this (default: 80) */
  heapWarningPercent?: number;
}): HealthCheck {
  const {
    processWarningPercent  = 70,
    processCriticalPercent = 90,
    heapWarningPercent     = 80,
  } = thresholds ?? {};

  const mem = getMemoryUsage();

  // Determine process-level health
  let procStatus: HealthCheck['status'] = 'ok';
  if (mem.memoryUsagePercent >= processCriticalPercent) procStatus = 'unhealthy';
  else if (mem.memoryUsagePercent >= processWarningPercent)  procStatus = 'degraded';

  // Determine heap-level health
  const heapPercent = Math.round((mem.process.heapUsedMB / mem.process.heapTotalMB) * 100);
  if (heapPercent >= 95)  procStatus = 'unhealthy';
  else if (heapPercent >= heapWarningPercent && procStatus === 'ok') procStatus = 'degraded';

  const status: HealthCheck['status'] = procStatus;
  const message = [
    `process rss: ${mem.process.rssMB} MB (${mem.memoryUsagePercent}%)`,
    `v8 heap: ${mem.process.heapUsedMB}/${mem.process.heapTotalMB} MB (${heapPercent}%)`,
    `system: ${mem.system.usedMB}/${mem.system.totalMB} MB (${mem.system.usagePercent}%)`,
    status === 'ok'      ? '✅ memory healthy'
      : status === 'degraded' ? '⚠️  memory pressure detected'
      : '🚨 memory critical',
  ].join(' | ');

  return { status, message };
}

// ─── Database Health Check ────────────────────────────────────────────────────

/**
 * Probe the database connection.
 * Accepts a function that returns a Promise — the function should execute
 * a lightweight query (e.g. SELECT 1) and resolve on success / reject on failure.
 *
 * @example
 * ```ts
 * const { query } = require('./db'); // your db instance
 * app.get('/health', healthHandler(async () => {
 *   await query('SELECT 1');
 * }));
 * ```
 */
export async function checkDatabase(
  probe: () => Promise<unknown>,
  timeoutMs = 3000,
): Promise<HealthCheck> {
  const start = Date.now();
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), timeoutMs),
  );

  try {
    await Promise.race([probe(), timeout]);
    return {
      status: 'ok',
      message: `database responding in ${Date.now() - start}ms`,
      duration: Date.now() - start,
    };
  } catch (err) {
    const err_ = err as Error;
    return {
      status: 'unhealthy',
      message: `database unreachable: ${err_.message}`,
      duration: Date.now() - start,
    };
  }
}

// ─── Combined Health Handler ──────────────────────────────────────────────────

export type DatabaseProbe = () => Promise<unknown>;

export interface HealthOptions {
  /** Memory thresholds (optional) */
  memory?: Parameters<typeof checkMemory>[0];
  /** Database probe timeout in ms (default: 3000) */
  dbTimeoutMs?: number;
  /** Extra arbitrary checks to run and merge in (optional) */
  extra?: Array<() => Promise<HealthCheck>>;
}

/**
 * Creates an Express middleware handler that returns a JSON health report.
 *
 * Usage:
 * ```ts
 * import { healthHandler } from './utils/health';
 * import { db } from './db';
 *
 * app.get('/health', healthHandler({
 *   dbProbe: () => db.query('SELECT 1'),
 * }));
 * ```
 *
 * If no dbProbe is provided the database check is skipped (status 'skipped').
 */
export function healthHandler(
  dbProbe?: DatabaseProbe,
  options?: HealthOptions,
) {
  return async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const start = Date.now();

    // Run memory check (always fast, no async needed)
    const memoryCheck = checkMemory(options?.memory);

    // Run DB check if a probe was provided
    let dbCheck: HealthCheck = { status: 'skipped' as unknown as HealthCheck['status'], message: 'not configured' };

    if (dbProbe) {
      // Run in parallel with memory for speed
      const [result] = await Promise.all([
        checkDatabase(dbProbe, options?.dbTimeoutMs ?? 3000),
        ...(options?.extra?.map(fn => fn()) ?? []),
      ]);
      dbCheck = result;
    }

    // Run extra checks
    const extraChecks = options?.extra
      ? await Promise.all(options.extra.map(fn => fn()))
      : [];

    // Determine overall status: worst of all checks
    const allChecks: HealthCheck[] = [memoryCheck, dbCheck, ...extraChecks];
    const worst = allChecks.reduce<HealthCheck['status']>((worst, check) => {
      const order: Record<string, number> = {
        ok: 0, degraded: 1, unhealthy: 2, skipped: -1,
      };
      return order[check.status] > order[worst] ? check.status : worst;
    }, 'ok');

    const report: HealthStatus = {
      status: worst,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks: {
        database: dbCheck,
        memory: memoryCheck,
      },
    };

    // Attach extra checks keyed by their index
    extraChecks.forEach((check, i) => {
      (report.checks as Record<string, HealthCheck>)[`extra_${i}`] = check;
    });

    const statusCode = worst === 'unhealthy' ? 503 : worst === 'degraded' ? 200 : 200;
    const totalDuration = Date.now() - start;

    res.set('Cache-Control', 'no-store');
    res.status(statusCode).json({ ...report, checkDurationMs: totalDuration });
  };
}

// ─── Convenience: Ready & Live probes (Kubernetes) ───────────────────────────

/** GET /healthz/ready — checks DB and memory */
export function readyHandler(dbProbe?: DatabaseProbe, options?: HealthOptions) {
  return healthHandler(dbProbe, options);
}

/** GET /healthz/live — process is alive, no deep checks */
export function liveHandler(_req: Request, res: Response, _next: NextFunction): void {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()) });
}
