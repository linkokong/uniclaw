/**
 * API Key Management Routes
 * Sprint 2 W2: Identity Layer + API Key + RBAC
 * 
 * CRUD endpoints for managing API keys
 */

import { Router, Response } from 'express'
import { body, param, validationResult } from 'express-validator'
import { authenticateJWT } from '../middleware/auth.js'
import { requireScope, SCOPES, type Scope, type AuthRequest } from '../middleware/apiKeyAuth.js'
import { apiKeyService } from '../services/apiKey.js'
import { asyncHandler } from '../middleware/error.js'
import { pool } from '../models/index.js'

const router = Router()

const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() }
    })
  }
  next()
}

/**
 * GET /api-keys
 * List all API keys for the authenticated user
 */
router.get('/',
  authenticateJWT,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User ID not found in token' }
      })
      return
    }
    
    const keys = await apiKeyService.listByUser(req.user.userId)
    
    res.json({ success: true, data: keys })
  })
)

/**
 * POST /api-keys
 * Create a new API key
 * 
 * Request body:
 * - name: Friendly name for the key
 * - scopes: Array of permission scopes
 * - expiresInDays: Optional expiration (default: 365 days)
 */
router.post('/',
  authenticateJWT,
  requireScope('read:profile'), // Need at least read:profile to create keys
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
    body('scopes').isArray({ min: 1 }).withMessage('At least one scope is required'),
    body('scopes.*').isIn(Object.keys(SCOPES)).withMessage('Invalid scope'),
    body('expiresInDays').optional().isInt({ min: 1, max: 3650 }).toInt(),
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId || !req.user?.walletAddress) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
      return
    }
    
    const { name, scopes, expiresInDays } = req.body
    
    // Validate scopes are allowed for this user
    // For now, allow all scopes except admin:all for non-admins
    const userScopes = req.user.scopes || []
    const requestedScopes = scopes as Scope[]
    
    if (requestedScopes.includes('admin:all') && !userScopes.includes('admin:all')) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot create admin API key' }
      })
      return
    }
    
    const result = await apiKeyService.createKey({
      userId: req.user.userId,
      walletAddress: req.user.walletAddress,
      name,
      scopes: requestedScopes,
      expiresInDays: expiresInDays ?? 365
    })
    
    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (actor_type, actor_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.authType,
        req.user.walletAddress,
        req.user.userId,
        'api_key.create',
        'api_key',
        result.info.id,
        { name, scopes: requestedScopes, keyPrefix: result.info.keyPrefix }
      ]
    )
    
    // Return key ONCE (never stored in plain text)
    res.status(201).json({
      success: true,
      data: {
        ...result.info,
        key: result.key // ⚠️ This is the only time the key is returned!
      },
      warning: 'Save this key securely. It will not be shown again.'
    })
  })
)

/**
 * GET /api-keys/:id
 * Get a specific API key
 */
router.get('/:id',
  authenticateJWT,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
      return
    }
    
    const key = await apiKeyService.getById(req.params.id as string, req.user.userId)
    
    if (!key) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' }
      })
      return
    }
    
    res.json({ success: true, data: key })
  })
)

/**
 * PUT /api-keys/:id
 * Update API key scopes
 */
router.put('/:id',
  authenticateJWT,
  [
    param('id').isUUID(),
    body('scopes').isArray({ min: 1 }).withMessage('At least one scope is required'),
    body('scopes.*').isIn(Object.keys(SCOPES)).withMessage('Invalid scope'),
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
      return
    }
    
    const { scopes } = req.body
    
    const key = await apiKeyService.updateScopes(req.params.id as string, req.user.userId, scopes)
    
    if (!key) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' }
      })
      return
    }
    
    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (actor_type, actor_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.authType,
        req.user.walletAddress,
        req.user.userId,
        'api_key.update',
        'api_key',
        key.id,
        { newScopes: scopes }
      ]
    )
    
    res.json({ success: true, data: key })
  })
)

/**
 * DELETE /api-keys/:id
 * Delete an API key permanently
 */
router.delete('/:id',
  authenticateJWT,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
      return
    }
    
    // Get key info before deletion for audit log
    const key = await apiKeyService.getById(req.params.id as string, req.user.userId)
    
    if (!key) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' }
      })
      return
    }
    
    await apiKeyService.delete(req.params.id as string, req.user.userId)
    
    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (actor_type, actor_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.authType,
        req.user.walletAddress,
        req.user.userId,
        'api_key.delete',
        'api_key',
        key.id,
        { name: key.name, keyPrefix: key.keyPrefix }
      ]
    )
    
    res.json({ success: true, data: { deleted: true } })
  })
)

/**
 * POST /api-keys/:id/deactivate
 * Deactivate an API key (can be reactivated later)
 */
router.post('/:id/deactivate',
  authenticateJWT,
  [
    param('id').isUUID(),
    handleValidationErrors
  ],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      })
      return
    }
    
    const success = await apiKeyService.deactivate(req.params.id as string, req.user.userId)
    
    if (!success) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' }
      })
      return
    }
    
    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (actor_type, actor_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.authType,
        req.user.walletAddress,
        req.user.userId,
        'api_key.deactivate',
        'api_key',
        req.params.id as string,
        {}
      ]
    )
    
    res.json({ success: true, data: { deactivated: true } })
  })
)

export default router
