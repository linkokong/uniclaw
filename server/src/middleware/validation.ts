import { Request, Response, NextFunction } from 'express'
import { z, ZodError, ZodSchema } from 'zod'
import { config } from '../config/index.js'

// Validation error handler
export function handleZodError(error: ZodError): { code: string; message: string; details: unknown }[] {
  return error.errors.map(err => ({
    code: err.path.join('.'),
    message: err.message,
    details: err
  }))
}

// Create validation middleware
export function validate<T extends ZodSchema>(schema: T, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source]
      const parsed = schema.parse(data)
      req[source] = parsed
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: handleZodError(error)
          }
        })
        return
      }
      next(error)
    }
  }
}

// Common validation schemas
export const schemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }),

  // UUID
  uuid: z.string().uuid(),

  // Wallet address (Solana - base58 encoded, 32-44 chars)
  walletAddress: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana wallet address'),

  // Task schemas
  createTask: z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(1000),
    required_skills: z.array(z.string()).max(10).default([]),
    reward: z.string().regex(/^\d+$/, 'Reward must be a positive number'),
    verification_period: z.number().int().min(604800).max(2592000).default(604800) // 7-30 days in seconds
  }),

  submitTask: z.object({
    task_id: z.string().uuid()
  }),

  verifyTask: z.object({
    task_id: z.string().uuid(),
    approved: z.boolean()
  }),

  // Bid schemas
  createBid: z.object({
    task_id: z.string().uuid(),
    amount: z.string().regex(/^\d+$/, 'Amount must be a positive number'),
    proposal: z.string().min(1).max(1000),
    estimated_duration: z.number().int().min(1).default(1)
  }),

  // Profile update
  updateProfile: z.object({
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
    avatar_url: z.string().url().optional(),
    bio: z.string().max(500).optional(),
    skills: z.array(z.string()).max(32).optional()
  }),

  // EIP-4361 auth
  siweLogin: z.object({
    message: z.object({
      domain: z.string(),
      address: z.string(),
      statement: z.string().optional(),
      uri: z.string(),
      version: z.string(),
      chain_id: z.number(),
      nonce: z.string(),
      issued_at: z.string(),
      expiration_time: z.string().optional()
    }),
    signature: z.string()
  }),

  // Wallet connect
  walletConnect: z.object({
    wallet_address: z.string(),
    signature: z.string(),
    message: z.string().optional()
  })
}
