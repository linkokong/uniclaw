import { Router } from 'express'
import { taskController } from '../controllers/task.js'
import { bidController } from '../controllers/bid.js'
import { authenticateJWT, optionalAuth } from '../middleware/auth.js'
import { validate, schemas } from '../middleware/validation.js'
import { taskCreationLimiter } from '../middleware/rateLimit.js'

const router = Router()

// All routes require authentication
router.use(authenticateJWT)

// POST /tasks - Create new task
router.post('/', taskCreationLimiter, validate(schemas.createTask), taskController.create)

// GET /tasks - List tasks with filters
router.get('/', taskController.list)

// GET /tasks/my - Get current user's tasks
router.get('/my', taskController.myTasks)

// GET /tasks/:id - Get task by ID
router.get('/:id', taskController.getById)

// POST /tasks/:id/assign - Assign task to worker
router.post('/:id/assign', taskController.assign)

// POST /tasks/:id/start - Worker starts task
router.post('/:id/start', taskController.start)

// POST /tasks/:id/submit - Worker submits completed task
router.post('/:id/submit', validate(schemas.submitTask), taskController.submit)

// POST /tasks/:id/verify - Creator verifies completed task
router.post('/:id/verify', validate(schemas.verifyTask), taskController.verify)

// POST /tasks/:id/cancel - Cancel task
router.post('/:id/cancel', taskController.cancel)

// Nested bid routes
// GET /tasks/:taskId/bids - List bids for a task
router.get('/:taskId/bids', bidController.listByTask)

export default router
