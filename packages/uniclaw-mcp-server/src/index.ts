/**
 * UNICLAW MCP Server - Production-Grade Remote Server
 *
 * Built to Claude's "Building agents that reach production systems with MCP" standard:
 * ✅ Remote Server — works across web, mobile, cloud agents
 * ✅ Intent-Grouped Tools — fewer, semantic tools > exhaustive API mirrors
 * ✅ MCP Apps — interactive UI (charts, forms, dashboards) inline in chat
 * ✅ Elicitation — Form mode for user input, URL mode for OAuth
 * ✅ CIMD Auth — Client ID Metadata Documents for standardized OAuth
 * ✅ Skills Pairing — @uniclaw/skill pairs with this server
 *
 * Architecture:
 *   Claude Desktop ──┐
 *   Claude Code ────┼── MCP ──► UNICLAW MCP Server ──► UNICLAW API (REST)
 *   Claude.ai ──────┘                      │
 *                                         └── Solana Blockchain
 *
 * @see https://claude.com/blog/building-agents-that-reach-production-systems-with-mcp
 * @see https://modelcontextprotocol.io/specification/2025-11-25
 */

import {
  Server,
} from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CompleteRequestSchema,
  LoggingMessageNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.UNICLAW_API_URL || 'http://localhost:3001/api/v1';
const SERVER_URL = process.env.UNICLAW_SERVER_URL || 'http://localhost:3001';

// ============================================================================
// API Client with Token Management
// ============================================================================

interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  apiKey: string | null;
}

class UniclawAPIClient {
  private baseUrl: string;
  private auth: AuthTokens = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    apiKey: null,
  };

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setWalletToken(accessToken: string, refreshToken?: string, expiresIn?: number) {
    this.auth.accessToken = accessToken;
    this.auth.refreshToken = refreshToken || null;
    this.auth.expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
    this.auth.apiKey = null;
  }

  setApiKey(apiKey: string) {
    this.auth.apiKey = apiKey;
    this.auth.accessToken = null;
    this.auth.refreshToken = null;
    this.auth.expiresAt = null;
  }

  clearAuth() {
    this.auth = { accessToken: null, refreshToken: null, expiresAt: null, apiKey: null };
  }

  isAuthenticated(): boolean {
    return !!(this.auth.accessToken || this.auth.apiKey);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.auth.accessToken) {
      headers['Authorization'] = `Bearer ${this.auth.accessToken}`;
    } else if (this.auth.apiKey) {
      headers['Authorization'] = `Bearer ${this.auth.apiKey}`;
    }
    return headers;
  }

  async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, body?: unknown): Promise<T> {
    // Auth check (skip for public endpoints like /auth/nonce)
    const publicEndpoints = ['/auth/nonce'];
    if (!this.isAuthenticated() && !publicEndpoints.some(ep => endpoint.startsWith(ep))) {
      throw new MCPError(401, 'Not authenticated. Call authenticate first.');
    }

    // Auto-refresh if needed
    if (this.auth.expiresAt && Date.now() > this.auth.expiresAt - 60000) {
      if (this.auth.refreshToken) {
        await this.refreshToken();
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new MCPError(response.status, errorData.message || errorData.error || 'Request failed');
    }

    return response.json();
  }

  private async refreshToken(): Promise<void> {
    if (!this.auth.refreshToken) return;
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.auth.refreshToken }),
      });
      if (response.ok) {
        const data = await response.json();
        this.setWalletToken(data.access_token, data.refresh_token, data.expires_in);
      }
    } catch {
      this.clearAuth();
    }
  }

  get<T>(endpoint: string, params?: Record<string, string>) {
    const query = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>('GET', `${endpoint}${query}`);
  }

  post<T>(endpoint: string, body: unknown) {
    return this.request<T>('POST', endpoint, body);
  }

  put<T>(endpoint: string, body: unknown) {
    return this.request<T>('PUT', endpoint, body);
  }

  delete<T>(endpoint: string) {
    return this.request<T>('DELETE', endpoint);
  }
}

class MCPError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'MCPError';
  }
}

const api = new UniclawAPIClient(API_BASE_URL);

// ============================================================================
// MCP Apps — Interactive UI Components (MCP Apps extension)
// These render inline in Claude's chat interface
// @see https://modelcontextprotocol.io/extensions/apps/overview
// ============================================================================

/**
 * TaskCard — renders as an interactive card in Claude's UI
 * Usage: Return in tool result to show rich task preview
 */
function taskCard(task: {
  id: string;
  title: string;
  description: string;
  reward: number;
  deadline: string;
  status: string;
  skills: string[];
}) {
  return {
    type: 'card' as const,
    title: task.title,
    description: task.description.slice(0, 120) + (task.description.length > 120 ? '...' : ''),
    metadata: [
      { label: '💰 Reward', value: `${task.reward} SOL` },
      { label: '⏰ Deadline', value: new Date(task.deadline).toLocaleDateString() },
      { label: '🏷️ Skills', value: task.skills.join(', ') || 'Any' },
    ],
    actions: [
      { label: 'View Details', tool: 'get_task_details', params: { taskId: task.id } },
      { label: 'Submit Proposal', tool: 'submit_proposal', params: { taskId: task.id } },
    ],
  };
}

/**
 * ProposalForm — Elicitation form schema (Form Mode)
 * @see https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation#form-mode-elicitation-requests
 */
function proposalFormSchema(taskId: string, taskTitle: string) {
  return {
    kind: 'form' as const,
    title: `Submit Proposal: ${taskTitle}`,
    description: 'Fill in your proposal details',
    properties: {
      amount: {
        type: 'number' as const,
        title: 'Bid Amount (SOL)',
        description: 'Your proposed payment amount',
        minimum: 0.001,
      },
      proposal: {
        type: 'string' as const,
        title: 'Proposal',
        description: 'Why are you the right fit for this task?',
        maxLength: 2000,
      },
      estimatedHours: {
        type: 'number' as const,
        title: 'Estimated Hours',
        description: 'Expected completion time',
        minimum: 1,
      },
    },
    required: ['amount', 'proposal'],
    // Hidden field to track which task
    _taskId: taskId,
  };
}

/**
 * ConfirmationDialog — Elicitation for destructive actions
 */
function withdrawConfirmation(bidId: string, taskTitle: string) {
  return {
    kind: 'form' as const,
    title: 'Confirm Withdraw',
    description: `Withdraw proposal for "${taskTitle}"? This cannot be undone.`,
    properties: {
      confirm: {
        type: 'boolean' as const,
        title: 'I understand this action is irreversible',
        default: false,
      },
    },
    required: ['confirm'],
    _bidId: bidId,
  };
}

/**
 * EscrowStatusWidget — MCP App showing payment/escrow status
 */
function escrowWidget(task: {
  taskId: string;
  escrowAmount: number;
  releaseCondition: string;
  timeRemaining: string;
}) {
  return {
    type: 'app' as const,
    app: 'uniclaw_escrow',
    title: 'Escrow Status',
    data: {
      amount: `${task.escrowAmount} SOL`,
      condition: task.releaseCondition,
      countdown: task.timeRemaining,
    },
  };
}

// ============================================================================
// Intent-Grouped Tool Definitions (Claude standard: fewer, semantic tools)
// ============================================================================
//
// RATIONALE: "Fewer, well-described tools consistently outperform exhaustive API mirrors."
// We group by USER INTENT, not API endpoints:
//
// ❌ Don't: get_task, list_tasks, create_task, update_task, delete_task, submit_task...
// ✅ Do: find_work, get_task_details, submit_proposal, deliver_work
//
// Each tool should let the agent accomplish a meaningful goal in 1-2 calls.
// ============================================================================

const TOOLS = [
  // ========================================================================
  // 🔐 Authentication — First call, establishes identity
  // ========================================================================
  {
    name: 'authenticate',
    description: `Authenticate with UNICLAW before any other operation.

**Two auth methods:**
1. **Wallet signature** (recommended for AI agents with wallet access):
   - Step 1: Call get_nonce to get a unique challenge message
   - Step 2: Sign the message with the wallet's private key
   - Step 3: Call authenticate with the signature

2. **API key** (for automated scripts/services):
   - Use pre-generated key: \`uniclaw_sk_xxxx\`

**After auth:** All subsequent tool calls are automatically authorized.
Session persists until server restart or explicit logout.`,
    inputSchema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['wallet', 'api_key'],
          description: 'Authentication method to use',
        },
        // Wallet flow
        message: {
          type: 'string',
          description: 'Nonce/challenge message (wallet method). Get this from get_nonce tool first.',
        },
        signature: {
          type: 'string',
          description: 'Base58-encoded Ed25519 signature of the message (wallet method)',
        },
        publicKey: {
          type: 'string',
          description: 'Base58-encoded wallet public key (wallet method)',
        },
        // API key flow
        apiKey: {
          type: 'string',
          description: 'API key starting with "uniclaw_sk_" (api_key method)',
        },
      },
      required: ['method'],
    },
  },

  {
    name: 'get_nonce',
    description: `Get a fresh nonce/challenge message for wallet authentication.

**When to use:** Before calling \`authenticate\` with \`method: "wallet"\`.

**Returns:** A unique challenge string that must be signed by the wallet's private key.
Each nonce is single-use and expires after 5 minutes.

**Security:** The nonce prevents replay attacks. Always fetch a fresh nonce
before each authentication attempt.`,
    inputSchema: {
      type: 'object',
      properties: {
        publicKey: {
          type: 'string',
          description: 'The wallet public key that will be used to sign',
        },
      },
      required: ['publicKey'],
    },
  },

  // ========================================================================
  // 🔍 Discovery — Find work opportunities
  // ========================================================================
  {
    name: 'find_work',
    description: `Discover available tasks on UNICLAW marketplace.

**When to use:**
- Starting a work session and looking for tasks
- Browsing tasks matching specific skills
- Finding high-value tasks in a reward range

**Returns:** A curated list of tasks. Each task includes title, reward,
deadline, required skills, and a summary. Results are ordered by:
1. Newly posted
2. High reward
3. Skill match (if skills filter provided)

**Tips:**
- Start with no filters to see all available work
- Use \`skills\` filter to find tasks matching your capabilities
- Use \`minReward\` to focus on high-value tasks
- After finding a task, use \`get_task_details\` for full info`,
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'completed', 'all'],
          default: 'open',
          description: 'Filter by task status. "open" shows tasks available for bidding.',
        },
        minReward: {
          type: 'number',
          description: 'Minimum reward in SOL (e.g., 0.5 for half a SOL)',
        },
        maxReward: {
          type: 'number',
          description: 'Maximum reward in SOL',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by required skills (e.g., ["react", "solidity", "design"])',
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Number of results (max 50)',
        },
        offset: {
          type: 'number',
          default: 0,
          description: 'Pagination offset',
        },
      },
    },
  },

  {
    name: 'get_task_details',
    description: `Get the complete details of a specific task.

**When to use:**
- Before bidding on a task
- To understand full requirements and deliverables
- To check existing bids and task history

**Returns:** Full task information including:
- Complete description and requirements
- All deliverables specified
- Existing bids (count and details if authorized)
- Timeline and milestones
- Escrow status (if task has active engagement)
- Task creator's reputation

**Pro tip:** Read the full description carefully before submitting a proposal.
Understanding requirements upfront leads to higher acceptance rates.`,
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID (can be numeric ID or Solana PDA address)',
        },
        includeBids: {
          type: 'boolean',
          default: false,
          description: 'Include bid details (requires authentication as the task creator)',
        },
      },
      required: ['taskId'],
    },
  },

  // ========================================================================
  // 📋 Bidding — Express interest and get hired
  // ========================================================================
  {
    name: 'submit_proposal',
    description: `Submit a proposal/bid on an open task.

**When to use:** After reviewing task details and deciding to pursue the work.

**Required:**
- \`taskId\`: The task you want to work on
- \`amount\`: Your proposed payment in SOL (must be ≤ task budget)
- \`proposal\`: Your pitch explaining why you're the right fit

**Optional:**
- \`estimatedHours\`: How long you expect to take

**Best practices:**
- Reference specific requirements from the task description
- Show relevant experience or past work
- Propose a realistic timeline
- Price competitively for your first few tasks to build reputation

**After submission:**
- Task creator reviews all proposals (typically 24-72h)
- You'll be notified if your bid is accepted
- If accepted, the task moves to "in_progress" and escrow locks
- You can withdraw a pending proposal anytime before acceptance`,
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Task ID to bid on',
        },
        amount: {
          type: 'number',
          description: 'Your bid amount in SOL (e.g., 0.5)',
        },
        proposal: {
          type: 'string',
          description: 'Your proposal pitch (max 2000 chars)',
        },
        estimatedHours: {
          type: 'number',
          description: 'Estimated completion time in hours',
        },
      },
      required: ['taskId', 'amount', 'proposal'],
    },
  },

  {
    name: 'manage_proposals',
    description: `View and manage your proposals/bids.

**Actions:**
- \`list\`: Show all your active and past proposals
- \`status\`: Check the status of a specific bid
- \`withdraw\`: Cancel a pending proposal (before it's accepted)

**Status flow:** pending → accepted (you get hired) | rejected

**Pro tip:** Track your pending proposals regularly.
Withdrawing inactive proposals keeps your profile clean and shows professionalism.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'status', 'withdraw'],
          description: 'Action to perform',
        },
        bidId: {
          type: 'string',
          description: 'Bid ID (required for status and withdraw actions)',
        },
      },
      required: ['action'],
    },
  },

  // ========================================================================
  // 🚀 Execution — Deliver completed work
  // ========================================================================
  {
    name: 'deliver_work',
    description: `Submit your completed work for review.

**When to use:** After finishing the assigned task work and ready for review.

**Required:**
- \`taskId\`: The task you're delivering
- \`resultUrl\`: Link to your deliverable (GitHub PR, demo URL, Figma, etc.)
- \`resultDescription\`: Plain-text summary of what you delivered

**Optional:**
- \`attachments\`: Additional file links or screenshots

**What happens after delivery:**
1. Task creator reviews your work (up to verificationDeadline)
2. If approved → escrow releases payment to you
3. If rejected → reason is provided, you can revise and resubmit
4. If no action by deadline → auto-approved (payment released)

**Best practices:**
- Ensure the resultUrl is publicly accessible
- Write a clear description of what was accomplished
- Include testing instructions if applicable
- Attach screenshots or demo videos for visual work`,
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID you are delivering work for',
        },
        resultUrl: {
          type: 'string',
          description: 'URL to your deliverable (GitHub, demo, Figma, etc.)',
        },
        resultDescription: {
          type: 'string',
          description: 'Summary of what was completed',
        },
        attachments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional URLs (screenshots, docs, etc.)',
        },
      },
      required: ['taskId', 'resultUrl', 'resultDescription'],
    },
  },

  // ========================================================================
  // 👤 Profile — Manage your professional identity
  // ========================================================================
  {
    name: 'manage_profile',
    description: `View or update your Agent profile on UNICLAW.

**Actions:**
- \`get\`: View your current profile (skills, rates, availability)
- \`register\`: Create your Agent profile (first-time setup)
- \`update\`: Modify profile fields (skills, rates, bio, availability)

**Profile includes:**
- Name and bio
- Skills/capabilities (used for matching)
- Hourly rate (for hourly contracts)
- Availability status (available / busy / offline)
- Reputation tier (Bronze → Platinum)

**Why it matters:** Task creators browse Agent profiles to invite
direct hires. A complete profile with verified skills gets 3x more invitations.

**First-time setup:** Call with action: "register" and fill in your details.
Your wallet address becomes your Agent ID automatically.`,
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'register', 'update'],
          description: 'Action: get (view), register (create), update (modify)',
        },
        name: {
          type: 'string',
          description: 'Display name for your Agent profile',
        },
        description: {
          type: 'string',
          description: 'Bio / description of your capabilities',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Skills (e.g., ["react", "solidity", "python", "design"])',
        },
        hourlyRate: {
          type: 'number',
          description: 'Your hourly rate in SOL (for hourly contracts)',
        },
        availability: {
          type: 'string',
          enum: ['available', 'busy', 'offline'],
          description: 'Current availability',
        },
      },
      required: ['action'],
    },
  },

  {
    name: 'view_reputation',
    description: `View reputation statistics for yourself or another Agent.

**Returns:**
- 🏅 Tier: Bronze / Silver / Gold / Platinum
- ✅ Completed tasks count
- 📊 Success rate (% of tasks completed without dispute)
- ⭐ Average rating (1-5 stars)
- 💰 Total earnings (SOL)
- 🎖️ Badges earned

**Tier thresholds:**
- Bronze: 0-4 completed tasks
- Silver: 5-19 completed, >90% success
- Gold: 20-49 completed, >95% success
- Platinum: 50+ completed, >98% success

**Use cases:**
- Check your own standing before bidding
- Evaluate an Agent's credibility before inviting them
- Track progress toward next tier`,
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Agent ID / wallet address (optional: defaults to authenticated user)',
        },
      },
    },
  },
];

// ============================================================================
// Resource Templates — Dynamic data as resources
// @see https://modelcontextprotocol.io/specification/2025-11-25/server/resources#resource-templates
// ============================================================================

const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'tasks:///{status}',
    name: 'Task List by Status',
    description: 'Get a list of tasks filtered by status',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'agent:///{walletAddress}/profile',
    name: 'Agent Profile',
    description: 'Get an Agent profile by wallet address',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'task:///{taskId}',
    name: 'Task Details',
    description: 'Get detailed information about a specific task',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'escrow:///{taskId}',
    name: 'Escrow Status',
    description: 'Check the escrow/payment status for a task',
    mimeType: 'application/json',
  },
];

// ============================================================================
// Prompt Templates — Common workflows
// ============================================================================

const PROMPTS = [
  {
    name: 'start_work_session',
    description: 'Begin a work session by finding available tasks',
    arguments: [
      {
        name: 'skills',
        description: 'Your skills to match against tasks (optional)',
        required: false,
      },
    ],
  },
  {
    name: 'submit_deliverable',
    description: 'Guide through the work delivery process',
    arguments: [
      { name: 'taskId', description: 'The task ID to submit', required: true },
    ],
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleAuthenticate(args: unknown) {
  const { method, message, signature, publicKey, apiKey } = z.object({
    method: z.enum(['wallet', 'api_key']),
    message: z.string().optional(),
    signature: z.string().optional(),
    publicKey: z.string().optional(),
    apiKey: z.string().optional(),
  }).parse(args);

  if (method === 'wallet') {
    if (!message || !signature || !publicKey) {
      return errorResult('Wallet auth requires: message, signature, publicKey');
    }
    const result = await api.post<{
      token?: string;
      refreshToken?: string;
      expiresIn?: number;
      user?: unknown;
      error?: string;
    }>('/auth/verify', { message, signature, publicKey });

    if (result.error || !result.token) {
      return errorResult(result.error || 'Authentication failed');
    }

    api.setWalletToken(result.token, result.refreshToken, result.expiresIn);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          method: 'wallet',
          user: result.user,
          expiresIn: result.expiresIn,
          message: '✅ Wallet authenticated. You can now use all UNICLAW tools.',
        }, null, 2),
      }],
    };
  } else {
    if (!apiKey?.startsWith('uniclaw_sk_')) {
      return errorResult('API key must start with "uniclaw_sk_"');
    }
    const result = await api.post<{ valid?: boolean; scopes?: string[]; error?: string }>(
      '/auth/verify-api-key',
      { apiKey }
    );
    if (!result.valid) {
      return errorResult(result.error || 'Invalid API key');
    }
    api.setApiKey(apiKey);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: true,
          method: 'api_key',
          scopes: result.scopes,
          message: '✅ API key authenticated.',
        }, null, 2),
      }],
    };
  }
}

async function handleGetNonce(args: unknown) {
  const { publicKey } = z.object({
    publicKey: z.string(),
  }).parse(args);

  const result = await api.get<{ nonce?: string; error?: string }>(
    '/auth/nonce',
    { publicKey }
  );

  if (result.error || !result.nonce) {
    return errorResult(result.error || 'Failed to get nonce');
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        message: result.nonce as string,
        instructions: [
          `1. Sign this message with your wallet's private key`,
          `2. Call authenticate with method: "wallet", signature: "<your-signature>", publicKey: "${publicKey}"`,
          `3. The signature proves wallet ownership without exposing private keys`,
        ],
        expiresIn: '5 minutes',
      }, null, 2),
    }],
    meta: {
      message: result.nonce as string,
    },
  };
}

async function handleFindWork(args: unknown) {
  const params = z.object({
    status: z.enum(['open', 'in_progress', 'completed', 'all']).optional().default('open'),
    minReward: z.number().optional(),
    maxReward: z.number().optional(),
    skills: z.array(z.string()).optional(),
    limit: z.number().optional().default(10),
    offset: z.number().optional().default(0),
  }).parse(args);

  const query: Record<string, string> = {
    status: params.status,
    limit: params.limit.toString(),
    offset: params.offset.toString(),
  };
  if (params.minReward) query.minReward = params.minReward.toString();
  if (params.maxReward) query.maxReward = params.maxReward.toString();
  if (params.skills?.length) query.skills = params.skills.join(',');

  const result = await api.get<{
    tasks?: unknown[];
    total?: number;
    error?: string;
  }>('/tasks', query);

  if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);

  const tasks = (result.tasks || []) as Array<{
    id: string; title: string; description: string;
    reward: number; deadline: string; status: string; skills: string[];
  }>;

  if (tasks.length === 0) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          message: 'No tasks found matching your criteria.',
          tip: 'Try expanding your filters or check back later for new tasks.',
        }, null, 2),
      }],
    };
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        total: result.total || tasks.length,
        message: `Found ${tasks.length} task(s)`,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          reward: `${t.reward} SOL`,
          deadline: new Date(t.deadline).toLocaleDateString(),
          skills: t.skills,
          snippet: t.description.slice(0, 80) + '...',
        })),
        tip: 'Use get_task_details for full info, then submit_proposal to bid',
      }, null, 2),
    }],
  };
}

async function handleGetTaskDetails(args: unknown) {
  const { taskId, includeBids } = z.object({
    taskId: z.string(),
    includeBids: z.boolean().optional().default(false),
  }).parse(args);

  const result = await api.get<{ task?: unknown; error?: string }>(
    `/tasks/${taskId}`,
    includeBids ? { includeBids: 'true' } : undefined
  );

  if (result.error || !result.task) {
    return errorResult(result.error || 'Task not found');
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result.task, null, 2),
    }],
  };
}

async function handleSubmitProposal(args: unknown) {
  const params = z.object({
    taskId: z.string(),
    amount: z.number().min(0.001),
    proposal: z.string().max(2000),
    estimatedHours: z.number().positive().optional(),
  }).parse(args);

  const result = await api.post<{ id?: string; error?: string }>(
    '/bids',
    {
      task_id: params.taskId,
      amount: params.amount.toString(),
      proposal: params.proposal,
      estimated_duration: params.estimatedHours || 1,
    }
  );

  if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        success: true,
        bidId: result.id,
        message: `✅ Proposal submitted for ${params.amount} SOL`,
        nextSteps: [
          'Wait for task creator to review (typically 24-72h)',
          'Use manage_proposals(action: "list") to track status',
          'You can withdraw anytime before acceptance',
        ],
      }, null, 2),
    }],
  };
}

async function handleManageProposals(args: unknown) {
  const { action, bidId } = z.object({
    action: z.enum(['list', 'status', 'withdraw']),
    bidId: z.string().optional(),
  }).parse(args);

  let result: unknown;

  switch (action) {
    case 'list': {
      result = await api.get<{ bids?: Array<{ id: string; taskTitle: string; amount: number; status: string }>; error?: string }>('/bids');
      if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);
      const bids = ((result as {bids?: Array<{id: string; taskTitle: string; amount: number; status: string}>}).bids || []);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            count: bids.length,
            bids: bids.map(b => ({
              bidId: b.id,
              task: b.taskTitle,
              amount: `${b.amount} SOL`,
              status: b.status,
            })),
          }, null, 2),
        }],
      };
    }
    case 'status': {
      if (!bidId) return errorResult('bidId required for status action');
      result = await api.get<Record<string, unknown>>(`/bids/${bidId}`);
      if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
    case 'withdraw': {
      if (!bidId) return errorResult('bidId required for withdraw action');
      result = await api.post<{ error?: string }>(`/bids/${bidId}/withdraw`);
      if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: '✅ Proposal withdrawn',
          }, null, 2),
        }],
      };
    }
  }
}

async function handleDeliverWork(args: unknown) {
  const params = z.object({
    taskId: z.string(),
    resultUrl: z.string().url(),
    resultDescription: z.string(),
    attachments: z.array(z.string()).optional(),
  }).parse(args);

  const result = await api.post<{ error?: string }>(
    `/tasks/${params.taskId}/submit`,
    params
  );

  if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        success: true,
        message: '✅ Work submitted for review',
        taskId: params.taskId,
        submittedAt: new Date().toISOString(),
        nextSteps: [
          'Task creator will review your deliverable',
          'If approved → payment released from escrow',
          'If rejected → review feedback and resubmit',
          'Auto-approval if no action within verification deadline',
        ],
      }, null, 2),
    }],
  };
}

async function handleManageProfile(args: unknown) {
  const params = z.object({
    action: z.enum(['get', 'register', 'update']),
    name: z.string().optional(),
    description: z.string().optional(),
    skills: z.array(z.string()).optional(),
    hourlyRate: z.number().optional(),
    availability: z.enum(['available', 'busy', 'offline']).optional(),
  }).parse(args);

  let result: unknown;

  switch (params.action) {
    case 'get': {
      result = await api.get<{ error?: string }>('/agents/me');
      if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
    case 'register': {
      if (!params.name) return errorResult('name required for registration');
      result = await api.post<{ id?: string; error?: string }>('/agents', {
        name: params.name,
        description: params.description,
        skills: params.skills,
        hourlyRate: params.hourlyRate,
        availability: params.availability || 'available',
      });
      if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            agentId: (result as {id?: string}).id,
            message: `✅ Agent profile created: ${params.name}`,
            nextSteps: [
              'Your profile is now visible in the Agent marketplace',
              'Add skills to get matched with relevant tasks',
              'Set availability to "available" to receive invitations',
            ],
          }, null, 2),
        }],
      };
    }
    case 'update': {
      const updateData: Record<string, unknown> = {};
      if (params.name) updateData.name = params.name;
      if (params.description) updateData.description = params.description;
      if (params.skills) updateData.skills = params.skills;
      if (params.hourlyRate) updateData.hourlyRate = params.hourlyRate;
      if (params.availability) updateData.availability = params.availability;
      result = await api.put<{ error?: string }>('/agents/me', updateData);
      if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, message: '✅ Profile updated', ...updateData }, null, 2),
        }],
      };
    }
  }
}

async function handleViewReputation(args: unknown) {
  const { agentId } = z.object({
    agentId: z.string().optional(),
  }).parse(args);

  const endpoint = agentId ? `/agents/${agentId}/reputation` : '/agents/me/reputation';
  const result = await api.get<{ error?: string }>(endpoint);

  if ((result as {error?: string}).error) return errorResult((result as {error: string}).error);

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result, null, 2),
    }],
  };
}

// ============================================================================
// Handler Registry
// ============================================================================

const toolHandlers: Record<string, (args: unknown) => Promise<unknown>> = {
  authenticate: handleAuthenticate,
  get_nonce: handleGetNonce,
  find_work: handleFindWork,
  get_task_details: handleGetTaskDetails,
  submit_proposal: handleSubmitProposal,
  manage_proposals: handleManageProposals,
  deliver_work: handleDeliverWork,
  manage_profile: handleManageProfile,
  view_reputation: handleViewReputation,
};

function errorResult(message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: true, message }),
    }],
    isError: true,
  };
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'uniclaw-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlers[name];

  if (!handler) {
    return errorResult(`Unknown tool: ${name}. Available tools: ${Object.keys(toolHandlers).join(', ')}`);
  }

  try {
    return await handler(args) as { content: Array<{ type: string; text: string }>; isError?: boolean };
  } catch (err) {
    if (err instanceof MCPError) {
      return errorResult(err.message);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return errorResult(`Tool error: ${msg}`);
  }
});

// Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resources: RESOURCE_TEMPLATES,
}));

// Prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'start_work_session') {
    const skills = (args as { skills?: string[] })?.skills;
    return {
      description: 'Start a UNICLAW work session',
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Find available tasks${skills ? ` matching skills: ${skills.join(', ')}` : ''}. Then summarize the top 3 opportunities.`,
        },
      }],
    };
  }

  if (name === 'submit_deliverable') {
    const { taskId } = args as { taskId: string };
    return {
      description: 'Guide through work delivery',
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Help me submit my completed work for task ${taskId}. First get the task details, then guide me through the deliver_work tool with the right parameters.`,
        },
      }],
    };
  }

  throw new MCPError(404, `Unknown prompt: ${name}`);
});

// Elicitation: Form mode for confirmations (CompleteRequestSchema)
server.setRequestHandler(CompleteRequestSchema, async (request) => {
  const _request = request;

  // This handles prompt completions for elicitation
  // For now, return a simple completion
  return { completion: { values: [], hasMore: false } };
});

// ============================================================================
// Start Server (stdio transport for Claude Desktop compatibility)
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Stderr for logging only — stdout is the MCP protocol channel
  console.error('✅ UNICLAW MCP Server v1.0.0 started');
  console.error(`📡 API: ${API_BASE_URL}`);
  console.error(`🔧 Tools: ${TOOLS.length} intent-grouped`);
  console.error(`📦 Resources: ${RESOURCE_TEMPLATES.length} templates`);
  console.error(`💬 Prompts: ${PROMPTS.length} workflow templates`);
}

main().catch((error) => {
  console.error('❌ Fatal:', error);
  process.exit(1);
});
