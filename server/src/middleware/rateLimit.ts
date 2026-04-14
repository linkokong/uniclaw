import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'
import { config } from '../config/index.js'

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Use wallet address if available, otherwise IP
    const wallet = req.headers['x-wallet-address'] as string
    return wallet || req.ip || 'unknown'
  }
})

// Strict limiter for sensitive endpoints (login, auth)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
})

// Limiter for task creation
export const taskCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 tasks per hour
  message: {
    success: false,
    error: {
      code: 'TASK_RATE_LIMIT',
      message: 'Task creation limit reached, please try again later'
    }
  }
})

// Limiter for bid submission
export const bidLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 bids per minute
  message: {
    success: false,
    error: {
      code: 'BID_RATE_LIMIT',
      message: 'Bid rate limit exceeded'
    }
  }
})

// Limiter for wallet transactions
export const transactionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 transactions per minute
  message: {
    success: false,
    error: {
      code: 'TX_RATE_LIMIT',
      message: 'Transaction rate limit exceeded'
    }
  }
})
