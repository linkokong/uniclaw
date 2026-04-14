import { Request, Response, NextFunction } from 'express';
import { IncomingMessage } from 'http';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LogMeta {
  method?: string;
  url?: string;
  status?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
  error?: Error;
  [key: string]: unknown;
}

// ─── Log Levels ───────────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

// ─── Formatter ─────────────────────────────────────────────────────────────────

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMeta(meta: LogMeta): string {
  return JSON.stringify(meta, null, 0);
}

function formatLine(level: LogLevel, message: string, meta?: LogMeta): string {
  const timestamp = formatTimestamp();
  const metaStr = meta ? ` ${formatMeta(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(level: LogLevel, message: string, meta?: LogMeta): void {
  if (!shouldLog(level)) return;
  const line = formatLine(level, message, meta);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
  info: (message: string, meta?: LogMeta) => log('info', message, meta),
  warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
  error: (message: string, meta?: LogMeta) => log('error', message, meta),
};

// ─── Color helpers (ANSI codes, no external deps) ─────────────────────────────

function colorReset(): string { return '\x1b[0m'; }
function colorGreen(): string  { return '\x1b[32m'; }
function colorRed(): string    { return '\x1b[31m'; }
function colorYellow(): string  { return '\x1b[33m'; }
function colorCyan(): string    { return '\x1b[36m'; }
function colorGray(): string    { return '\x1b[90m'; }

function colorDuration(ms: number): string {
  if (ms < 500)  return `${colorGreen()}${ms}ms${colorReset()}`;
  if (ms < 2000) return `${colorYellow()}${ms}ms${colorReset()}`;
  return `${colorRed()}${ms}ms${colorReset()}`;
}

function colorStatus(status: number): string {
  if (status >= 500) return `${colorRed()}${status}${colorReset()}`;
  if (status >= 400) return `${colorYellow()}${status}${colorReset()}`;
  return `${colorGreen()}${status}${colorReset()}`;
}

// ─── Request Logger Middleware ─────────────────────────────────────────────────

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startMs = Date.now();
    const reqUrl = req.originalUrl ?? req.url;
    const method = req.method;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
             ?? req.socket.remoteAddress
             ?? '-';
    const ua = req.headers['user-agent'] ?? '-';
    const reqId = (req.headers['x-request-id'] as string) ?? generateReqId();

    // Attach request ID early so downstream code can use it
    (req as Request & { requestId: string }).requestId = reqId;
    res.setHeader('X-Request-ID', reqId);

    // ── Request start ──────────────────────────────────────────────────────
    logger.info('→ incoming request', {
      requestId: reqId,
      method,
      url: reqUrl,
      ip,
      userAgent: ua,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
    });

    // Capture the original end() so we can hook into completion
    const originalEnd = res.end;
    let logged = false;

    // @ts-ignore - res.end overload complexity
    (res.end as Function) =
      function (...args: unknown[]): void {
        if (logged) { (originalEnd as Function).apply(res, args); return; }
        logged = true;

        const durationMs = Date.now() - startMs;
        const status = res.statusCode;

        // ── Log with nice formatting ───────────────────────────────────────
        const ts = new Date().toLocaleTimeString('ja-JP', { hour12: false });
        const statusStr = colorStatus(status);
        const durStr = colorDuration(durationMs);
        const reset = colorReset();

        const statusOk = status < 400;

        // @ts-ignore - String object vs string mismatch in template literals
        console.log(
          `${colorGray}${ts}${colorReset} ` +
          `${statusOk ? colorGreen : colorRed}${method}${colorReset} ` +
          `${colorCyan}${reqUrl}${colorReset} ` +
          `${statusStr} ` +
          `${durStr}`
        );

        // ── Structured log (JSON, for log aggregators) ──────────────────────
        logger.info('← request completed', {
          requestId: reqId,
          method,
          url: reqUrl,
          status,
          duration: durationMs,
          ip,
        });

        (originalEnd as Function).apply(res, args);
      };

    next();
  };
}

// ─── Error Logger Middleware ──────────────────────────────────────────────────

export function errorLogger() {
  return (
    err: Error & { statusCode?: number; status?: number; code?: string; path?: string },
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    const statusCode = err.statusCode ?? err.status ?? 500;
    const requestId = (req as Request & { requestId?: string }).requestId;
    const reqUrl = req.originalUrl ?? req.url;
    const method = req.method;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
             ?? req.socket.remoteAddress
             ?? '-';

    // Avoid logging stack for operational errors (4xx)
    const meta = {
      requestId,
      statusCode,
      method,
      url: reqUrl,
      ip,
      code: err.code,
      path: err.path,
      message: err.message,
      ...(statusCode >= 500 ? { stack: err.stack } : {}),
    };

    logger.error('⨯ request error', meta);

    // Don't send stack trace to the client in production
    const response = process.env.NODE_ENV === 'production'
      ? { error: err.message || 'Internal Server Error' }
      : { error: err.message, stack: err.stack };

    res.status(statusCode).json({
      ...response,
      requestId,
    });
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReqId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export { generateReqId };
