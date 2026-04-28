import { pool } from '../models/index.js'
import { solanaService } from './solana.js'
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError
} from '../middleware/error.js'
import { Task, Bid, TaskStatus, BidStatus } from '../types/index.js'

const TIER_REQUIREMENTS: Record<string, number> = {
  bronze: 0,
  silver: 201,
  gold: 501,
  platinum: 801
}

export class TaskService {
  // Create a new task
  async create(
    creatorWallet: string,
    data: {
      title: string
      description: string
      required_skills: string[]
      reward: string
      verification_period: number
    }
  ): Promise<Task> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Calculate verification deadline
      const verificationDeadline = new Date(
        Date.now() + data.verification_period * 1000
      )

      // Insert task
      const result = await client.query(
        `INSERT INTO tasks (
           creator_wallet, title, description, required_skills,
           reward, verification_deadline, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'created')
         RETURNING *`,
        [
          creatorWallet,
          data.title,
          data.description,
          data.required_skills,
          data.reward,
          verificationDeadline
        ]
      )

      await client.query('COMMIT')
      return this.mapTask(result.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Get task by ID
  async getById(id: string): Promise<Task> {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('Task')
    }
    return this.mapTask(result.rows[0])
  }

  // List tasks with filters
  async list(filters: {
    status?: TaskStatus
    creator_wallet?: string
    worker_wallet?: string
    skills?: string[]
    page?: number
    limit?: number
  }): Promise<{ tasks: Task[]; total: number }> {
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`)
      values.push(filters.status)
    }
    if (filters.creator_wallet) {
      conditions.push(`creator_wallet = $${paramIndex++}`)
      values.push(filters.creator_wallet)
    }
    if (filters.worker_wallet) {
      conditions.push(`worker_wallet = $${paramIndex++}`)
      values.push(filters.worker_wallet)
    }
    if (filters.skills && filters.skills.length > 0) {
      conditions.push(`required_skills && $${paramIndex++}`)
      values.push(filters.skills)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tasks ${whereClause}`,
      values
    )
    const total = parseInt(countResult.rows[0].count)

    // Get paginated results
    const page = filters.page || 1
    const limit = filters.limit || 20
    const offset = (page - 1) * limit

    values.push(limit, offset)
    const result = await pool.query(
      `SELECT * FROM tasks ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    )

    return {
      tasks: result.rows.map(row => this.mapTask(row)),
      total
    }
  }

  // Accept/assign task to worker
  async assign(taskId: string, workerWallet: string, workerReputation: number): Promise<Task> {
    const task = await this.getById(taskId)

    if (task.status !== 'created') {
      throw new ConflictError('Task is not open for assignment')
    }
    if (task.creator_wallet === workerWallet) {
      throw new ValidationError('Cannot assign task to yourself')
    }

    const result = await pool.query(
      `UPDATE tasks SET
         worker_wallet = $2,
         status = 'assigned',
         worker_reputation_at_assignment = $3,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [taskId, workerWallet, workerReputation]
    )

    return this.mapTask(result.rows[0])
  }

  // Start task (worker begins work)
  async start(taskId: string, workerWallet: string): Promise<Task> {
    const task = await this.getById(taskId)

    if (task.worker_wallet !== workerWallet) {
      throw new ForbiddenError('You are not assigned to this task')
    }
    if (task.status !== 'assigned') {
      throw new ConflictError('Task cannot be started')
    }

    const result = await pool.query(
      `UPDATE tasks SET status = 'in_progress', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [taskId]
    )

    return this.mapTask(result.rows[0])
  }

  // Submit task (worker completes work)
  async submit(
    taskId: string,
    workerWallet: string,
    resultData?: { resultUrl?: string; resultDescription?: string; attachments?: string[] }
  ): Promise<Task> {
    const task = await this.getById(taskId)

    if (task.worker_wallet !== workerWallet) {
      throw new ForbiddenError('You are not assigned to this task')
    }
    if (task.status !== 'in_progress') {
      throw new ConflictError('Task cannot be submitted')
    }

    const result = await pool.query(
      `UPDATE tasks SET
         status = 'completed',
         submission_time = NOW(),
         result_url = $2,
         result_description = $3,
         result_attachments = $4,
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [taskId, resultData?.resultUrl || null, resultData?.resultDescription || null, resultData?.attachments || null]
    )

    return this.mapTask(result.rows[0])
  }

  // Verify task (creator approves/rejects)
  async verify(
    taskId: string,
    creatorWallet: string,
    approved: boolean
  ): Promise<Task> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const task = await this.getById(taskId)

      if (task.creator_wallet !== creatorWallet) {
        throw new ForbiddenError('You are not the task creator')
      }
      if (task.status !== 'completed') {
        throw new ConflictError('Task cannot be verified')
      }

      let newStatus: TaskStatus = TaskStatus.Verified
      let reputationChange = 10 // Success

      if (!approved) {
        newStatus = TaskStatus.InProgress
        reputationChange = 0
      }

      // Update task
      const result = await client.query(
        `UPDATE tasks SET
           status = $2,
           verification_time = NOW(),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [taskId, newStatus]
      )

      // Update worker stats if approved
      if (approved) {
        await client.query(
          `UPDATE users SET
             tasks_completed = tasks_completed + 1,
             reputation = LEAST(1000, reputation + $2),
             total_earnings = (SELECT (total_earnings::numeric + $3)::text FROM users WHERE wallet_address = $1),
             updated_at = NOW()
           WHERE wallet_address = (SELECT worker_wallet FROM tasks WHERE id = $1)`,
          [taskId, reputationChange, task.reward]
        )
      }

      await client.query('COMMIT')
      return this.mapTask(result.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Cancel task
  async cancel(taskId: string, creatorWallet: string): Promise<Task> {
    const task = await this.getById(taskId)

    if (task.creator_wallet !== creatorWallet) {
      throw new ForbiddenError('You are not the task creator')
    }
    if (!['created', 'assigned'].includes(task.status)) {
      throw new ConflictError('Task cannot be cancelled')
    }

    const result = await pool.query(
      `UPDATE tasks SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [taskId]
    )

    return this.mapTask(result.rows[0])
  }

  private mapTask(row: any): Task {
    return {
      id: row.id,
      creator_wallet: row.creator_wallet,
      worker_wallet: row.worker_wallet,
      title: row.title,
      description: row.description,
      required_skills: row.required_skills || [],
      status: row.status as TaskStatus,
      reward: row.reward,
      verification_deadline: row.verification_deadline,
      submission_time: row.submission_time,
      verification_time: row.verification_time,
      worker_reputation_at_assignment: row.worker_reputation_at_assignment,
      created_at: row.created_at,
      updated_at: row.updated_at,
      task_pda: row.task_pda,
      tx_signature: row.tx_signature,
      result_url: row.result_url,
      result_description: row.result_description,
      result_attachments: row.result_attachments,
      acceptance_criteria: row.acceptance_criteria ?? '',
      category: row.category ?? 'General',
    }
  }

  // Get task by on-chain PDA address
  async getByPda(pda: string): Promise<Task | null> {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE task_pda = $1',
      [pda]
    )
    if (result.rows.length === 0) return null
    return this.mapTask(result.rows[0])
  }

  // Sync a task from chain to DB (called after successful on-chain tx)
  async syncFromChain(data: {
    title: string
    description: string
    required_skills: string[]
    reward: string
    verification_period: number
    tx_signature: string
    task_pda: string
    creator_wallet: string
    category?: string
    acceptance_criteria?: string
  }): Promise<Task> {
    // Check if already synced (idempotent)
    const existing = await this.getByPda(data.task_pda)
    if (existing) return existing

    const verificationDeadline = new Date(
      Date.now() + data.verification_period * 1000
    )

    const result = await pool.query(
      `INSERT INTO tasks (
         creator_wallet, title, description, required_skills,
         reward, verification_deadline, status, task_pda, tx_signature, acceptance_criteria, category
       ) VALUES ($1, $2, $3, $4, $5, $6, 'created', $7, $8, $9, $10)
       ON CONFLICT (task_pda) DO NOTHING
       RETURNING *`,
      [
        data.creator_wallet,
        data.title,
        data.description,
        data.required_skills,
        data.reward,
        verificationDeadline,
        data.task_pda,
        data.tx_signature,
        data.acceptance_criteria ?? '',
        data.category ?? 'General',
      ]
    )

    if (result.rows.length === 0) {
      // Already existed via ON CONFLICT
      return (await this.getByPda(data.task_pda))!
    }
    return this.mapTask(result.rows[0])
  }
}

export const taskService = new TaskService()
