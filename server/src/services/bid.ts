import { pool } from '../models/index.js'
import { NotFoundError, ForbiddenError, ConflictError } from '../middleware/error.js'
import type { Bid, BidStatus } from '../types/index.js'

export class BidService {
  // Create a bid
  async create(
    bidderWallet: string,
    data: {
      task_id: string
      amount: string
      proposal: string
      estimated_duration: number
    }
  ): Promise<Bid> {
    // Check task is still open
    const taskResult = await pool.query(
      `SELECT status, creator_wallet FROM tasks WHERE id = $1`,
      [data.task_id]
    )
    if (taskResult.rows.length === 0) {
      throw new NotFoundError('Task')
    }
    if (taskResult.rows[0].status !== 'created') {
      throw new ConflictError('Task is not accepting bids')
    }
    if (taskResult.rows[0].creator_wallet === bidderWallet) {
      throw new ConflictError('Cannot bid on your own task')
    }

    const result = await pool.query(
      `INSERT INTO bids (task_id, bidder_wallet, amount, proposal, estimated_duration, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [data.task_id, bidderWallet, data.amount, data.proposal, data.estimated_duration]
    )

    return this.mapBid(result.rows[0])
  }

  // Get bid by ID
  async getById(id: string): Promise<Bid> {
    const result = await pool.query(
      'SELECT * FROM bids WHERE id = $1',
      [id]
    )
    if (result.rows.length === 0) {
      throw new NotFoundError('Bid')
    }
    return this.mapBid(result.rows[0])
  }

  // List bids for a task
  async listByTask(taskId: string, page = 1, limit = 20): Promise<{ bids: Bid[]; total: number }> {
    const offset = (page - 1) * limit

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM bids WHERE task_id = $1',
      [taskId]
    )
    const total = parseInt(countResult.rows[0].count)

    const result = await pool.query(
      `SELECT * FROM bids WHERE task_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [taskId, limit, offset]
    )

    return {
      bids: result.rows.map(row => this.mapBid(row)),
      total
    }
  }

  // List bids by bidder
  async listByBidder(bidderWallet: string, page = 1, limit = 20): Promise<{ bids: Bid[]; total: number }> {
    const offset = (page - 1) * limit

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM bids WHERE bidder_wallet = $1',
      [bidderWallet]
    )
    const total = parseInt(countResult.rows[0].count)

    const result = await pool.query(
      `SELECT * FROM bids WHERE bidder_wallet = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [bidderWallet, limit, offset]
    )

    return {
      bids: result.rows.map(row => this.mapBid(row)),
      total
    }
  }

  // Accept bid
  async accept(bidId: string, accepterWallet: string): Promise<Bid> {
    const bid = await this.getById(bidId)

    // Get task
    const taskResult = await pool.query(
      'SELECT creator_wallet, status FROM tasks WHERE id = $1',
      [bid.task_id]
    )
    if (taskResult.rows.length === 0) {
      throw new NotFoundError('Task')
    }
    if (taskResult.rows[0].creator_wallet !== accepterWallet) {
      throw new ForbiddenError('Only task creator can accept bids')
    }
    if (taskResult.rows[0].status !== 'created') {
      throw new ConflictError('Task is no longer accepting bids')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Accept this bid
      await client.query(
        `UPDATE bids SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [bidId]
      )

      // Reject other bids
      await client.query(
        `UPDATE bids SET status = 'rejected', updated_at = NOW()
         WHERE task_id = $1 AND id != $2`,
        [bid.task_id, bidId]
      )

      // Update task status
      await client.query(
        `UPDATE tasks SET
           worker_wallet = $2,
           status = 'assigned',
           worker_reputation_at_assignment = (SELECT reputation FROM users WHERE wallet_address = $2),
           updated_at = NOW()
         WHERE id = $1`,
        [bid.task_id, bid.bidder_wallet]
      )

      await client.query('COMMIT')

      return this.getById(bidId)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Reject bid
  async reject(bidId: string, rejecterWallet: string): Promise<Bid> {
    const bid = await this.getById(bidId)

    const taskResult = await pool.query(
      'SELECT creator_wallet FROM tasks WHERE id = $1',
      [bid.task_id]
    )
    if (taskResult.rows.length === 0) {
      throw new NotFoundError('Task')
    }
    if (taskResult.rows[0].creator_wallet !== rejecterWallet) {
      throw new ForbiddenError('Only task creator can reject bids')
    }

    const result = await pool.query(
      `UPDATE bids SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [bidId]
    )

    return this.mapBid(result.rows[0])
  }

  // Withdraw bid
  async withdraw(bidId: string, bidderWallet: string): Promise<Bid> {
    const bid = await this.getById(bidId)

    if (bid.bidder_wallet !== bidderWallet) {
      throw new ForbiddenError('You can only withdraw your own bids')
    }
    if (bid.status !== 'pending') {
      throw new ConflictError('Can only withdraw pending bids')
    }

    const result = await pool.query(
      `UPDATE bids SET status = 'withdrawn', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [bidId]
    )

    return this.mapBid(result.rows[0])
  }

  private mapBid(row: any): Bid {
    return {
      id: row.id,
      task_id: row.task_id,
      bidder_wallet: row.bidder_wallet,
      amount: row.amount,
      proposal: row.proposal,
      estimated_duration: row.estimated_duration,
      status: row.status as BidStatus,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }
}

export const bidService = new BidService()
