/* eslint-disable @typescript-eslint/naming-convention */
import { Pool } from 'pg'
import { config } from '../src/config/index.js'

export async function up(pgm: any): Promise<void> {
  // Enable UUID extension
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

  // Users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: 'uuid_generate_v4()'
    },
    wallet_address: {
      type: 'varchar(44)',
      unique: true,
      notNull: true
    },
    email: {
      type: 'varchar(255)',
      unique: true
    },
    username: {
      type: 'varchar(50)',
      unique: true
    },
    avatar_url: {
      type: 'text'
    },
    bio: {
      type: 'text'
    },
    reputation: {
      type: 'integer',
      default: 100
    },
    tier: {
      type: 'varchar(20)',
      default: 'bronze'
    },
    skills: {
      type: 'text[]',
      default: '{}'
    },
    tasks_completed: {
      type: 'bigint',
      default: 0
    },
    tasks_failed: {
      type: 'bigint',
      default: 0
    },
    total_earnings: {
      type: 'varchar(50)',
      default: '0'
    },
    created_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    },
    updated_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    }
  })

  // Tasks table
  pgm.createTable('tasks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: 'uuid_generate_v4()'
    },
    creator_wallet: {
      type: 'varchar(44)',
      notNull: true
    },
    worker_wallet: {
      type: 'varchar(44)'
    },
    title: {
      type: 'varchar(100)',
      notNull: true
    },
    description: {
      type: 'text',
      notNull: true
    },
    required_skills: {
      type: 'text[]',
      default: '{}'
    },
    status: {
      type: 'varchar(20)',
      default: 'created'
    },
    reward: {
      type: 'varchar(50)',
      notNull: true
    },
    verification_deadline: {
      type: 'timestamp with time zone',
      notNull: true
    },
    submission_time: {
      type: 'timestamp with time zone'
    },
    verification_time: {
      type: 'timestamp with time zone'
    },
    worker_reputation_at_assignment: {
      type: 'integer',
      default: 0
    },
    created_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    },
    updated_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    }
  })

  // Bids table
  pgm.createTable('bids', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: 'uuid_generate_v4()'
    },
    task_id: {
      type: 'uuid',
      references: 'tasks(id)',
      onDelete: 'CASCADE'
    },
    bidder_wallet: {
      type: 'varchar(44)',
      notNull: true
    },
    amount: {
      type: 'varchar(50)',
      notNull: true
    },
    proposal: {
      type: 'text',
      notNull: true
    },
    estimated_duration: {
      type: 'integer',
      default: 1
    },
    status: {
      type: 'varchar(20)',
      default: 'pending'
    },
    created_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    },
    updated_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    }
  })

  // Transactions table
  pgm.createTable('transactions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: 'uuid_generate_v4()'
    },
    signature: {
      type: 'varchar(100)',
      unique: true,
      notNull: true
    },
    from_address: {
      type: 'varchar(44)',
      notNull: true
    },
    to_address: {
      type: 'varchar(44)',
      notNull: true
    },
    amount: {
      type: 'varchar(50)',
      notNull: true
    },
    type: {
      type: 'varchar(30)',
      notNull: true
    },
    task_id: {
      type: 'uuid',
      references: 'tasks(id)'
    },
    status: {
      type: 'varchar(20)',
      default: 'pending'
    },
    block_time: {
      type: 'timestamp with time zone'
    },
    created_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    }
  })

  // Auth nonces table for EIP-4361
  pgm.createTable('auth_nonces', {
    wallet_address: {
      type: 'varchar(44)',
      primaryKey: true
    },
    nonce: {
      type: 'varchar(32)',
      notNull: true
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true
    },
    created_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    }
  })

  // Refresh tokens table
  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: 'uuid_generate_v4()'
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    token_hash: {
      type: 'varchar(64)',
      notNull: true
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true
    },
    created_at: {
      type: 'timestamp with time zone',
      default: 'NOW()'
    },
    revoked_at: {
      type: 'timestamp with time zone'
    }
  })

  // Indexes
  pgm.createIndex('tasks', ['creator_wallet'])
  pgm.createIndex('tasks', ['worker_wallet'])
  pgm.createIndex('tasks', ['status'])
  pgm.createIndex('tasks', ['created_at'])
  pgm.createIndex('bids', ['task_id'])
  pgm.createIndex('bids', ['bidder_wallet'])
  pgm.createIndex('bids', ['status'])
  pgm.createIndex('transactions', ['from_address'])
  pgm.createIndex('transactions', ['to_address'])
  pgm.createIndex('transactions', ['task_id'])
}

export async function down(pgm: any): Promise<void> {
  pgm.dropTable('refresh_tokens')
  pgm.dropTable('auth_nonces')
  pgm.dropTable('transactions')
  pgm.dropTable('bids')
  pgm.dropTable('tasks')
  pgm.dropTable('users')
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp"')
}
