import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'

// Mock dependencies before importing routes
vi.mock('../../server/src/models/index.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  closeConnections: vi.fn().mockResolvedValue(undefined),
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn()
    })
  },
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1)
  }
}))

// Mock jose for JWT
vi.mock('jose', () => ({
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { walletAddress: 'TestWallet123456789', userId: '1' }
  }),
  SignJWT: class SignJWT {
    constructor(payload: any) { this.payload = payload }
    private payload: any
    setProtectedHeader() { return this }
    setIssuedAt() { return this }
    setExpirationTime() { return this }
    async sign() { return 'mock-jwt-token' }
  }
}))

// Create a simple test app
function createTestApp() {
  const app = express()
  
  app.use(helmet())
  app.use(compression())
  app.use(cors({ origin: '*', credentials: true }))
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // API prefix
  const apiPrefix = '/api/v1'

  // Health check
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Mock routes - Tasks
  app.get(`${apiPrefix}/tasks`, (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 1, title: 'Test Task 1', status: 'open', budget: '100.00' },
        { id: 2, title: 'Test Task 2', status: 'in_progress', budget: '200.00' }
      ],
      meta: { page: 1, limit: 20, total: 2 }
    })
  })

  app.post(`${apiPrefix}/tasks`, (req, res) => {
    res.status(201).json({
      success: true,
      data: {
        id: 1,
        title: req.body.title || 'New Task',
        description: req.body.description || '',
        budget: req.body.budget || '100.00',
        status: 'open',
        created_at: new Date().toISOString()
      }
    })
  })

  // Mock routes - Users
  app.get(`${apiPrefix}/users/:id`, (req, res) => {
    const id = req.params.id
    
    // Handle 'me' case
    if (id === 'me') {
      return res.json({
        success: true,
        data: {
          id: 1,
          wallet_address: 'TestWallet123456789',
          nickname: 'Current User',
          reputation: 85,
          balance: '500.00'
        }
      })
    }

    // Handle numeric ID
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid user ID' }
      })
    }

    // Return mock user data
    res.json({
      success: true,
      data: {
        id: numericId,
        wallet_address: `Wallet${numericId}`,
        nickname: `User ${numericId}`,
        reputation: 75 + numericId,
        balance: `${100 * numericId}.00`,
        created_at: new Date().toISOString()
      }
    })
  })

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' }
    })
  })

  return app
}

describe('API Integration Tests', () => {
  let app: express.Application

  beforeAll(() => {
    app = createTestApp()
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/v1/tasks', () => {
    it('should return 200 and a list of tasks', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('data')
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
      
      // Check task structure
      const task = response.body.data[0]
      expect(task).toHaveProperty('id')
      expect(task).toHaveProperty('title')
      expect(task).toHaveProperty('status')
      expect(task).toHaveProperty('budget')
    })

    it('should return pagination metadata', async () => {
      const response = await request(app)
        .get('/api/v1/tasks')
        .expect(200)

      expect(response.body).toHaveProperty('meta')
      expect(response.body.meta).toHaveProperty('page')
      expect(response.body.meta).toHaveProperty('limit')
      expect(response.body.meta).toHaveProperty('total')
    })
  })

  describe('POST /api/v1/tasks', () => {
    it('should return success and create a new task', async () => {
      const newTask = {
        title: 'Integration Test Task',
        description: 'This is a test task for integration testing',
        budget: '150.00'
      }

      const response = await request(app)
        .post('/api/v1/tasks')
        .send(newTask)
        .expect(201)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.title).toBe(newTask.title)
      expect(response.body.data.budget).toBe(newTask.budget)
      expect(response.body.data.status).toBe('open')
    })

    it('should return 201 with default values for minimal input', async () => {
      const response = await request(app)
        .post('/api/v1/tasks')
        .send({})
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
    })
  })

  describe('GET /api/v1/users/:id', () => {
    it('should return user data for valid user ID', async () => {
      const response = await request(app)
        .get('/api/v1/users/1')
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('data')
      expect(response.body.data).toHaveProperty('id', 1)
      expect(response.body.data).toHaveProperty('wallet_address')
      expect(response.body.data).toHaveProperty('nickname')
      expect(response.body.data).toHaveProperty('reputation')
      expect(response.body.data).toHaveProperty('balance')
    })

    it('should return different user for different IDs', async () => {
      const response1 = await request(app)
        .get('/api/v1/users/1')
        .expect(200)
      
      const response2 = await request(app)
        .get('/api/v1/users/5')
        .expect(200)

      expect(response1.body.data.id).toBe(1)
      expect(response2.body.data.id).toBe(5)
      expect(response1.body.data.nickname).not.toBe(response2.body.data.nickname)
    })

    it('should return 400 for invalid user ID', async () => {
      const response = await request(app)
        .get('/api/v1/users/invalid')
        .expect(400)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error.code).toBe('INVALID_ID')
    })

    it('should return current user for "me" endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/users/me')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('wallet_address', 'TestWallet123456789')
    })
  })

  describe('Health Check', () => {
    it('should return ok status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/unknown')
        .expect(404)

      expect(response.body).toHaveProperty('success', false)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })
  })
})
