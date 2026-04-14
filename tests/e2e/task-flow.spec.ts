import { test, expect } from '@playwright/test';

/**
 * E2E Test: Task Flow
 * Covers: Task Market → Task Detail → Bid → Submit → Acceptance
 *
 * Prereq: Dev server running (npm run dev)
 * Auth state: globalSetup creates .auth/user.json with wallet session
 */

test.describe('Task Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('TASK-001: User can browse task market and see available tasks', async ({ page }) => {
    // Navigate to task market
    await page.goto('/tasks');

    // Check page title / heading
    await expect(page.getByRole('heading', { name: /task|任务/i })).toBeVisible({ timeout: 10_000 });

    // Task list should render
    const taskCards = page.locator('[data-testid="task-card"], .task-card, article');
    await expect(taskCards.first()).toBeVisible({ timeout: 15_000 });

    // Filter bar should be present
    await expect(page.getByPlaceholder(/filter|搜索|筛选/i)).or(page.getByRole('button', { name: /filter/i })).toBeVisible();
  });

  test('TASK-002: User can click a task card and view task details', async ({ page }) => {
    await page.goto('/tasks');

    // Wait for task cards to load
    const taskCards = page.locator('[data-testid="task-card"], .task-card, article');
    await expect(taskCards.first()).toBeVisible({ timeout: 15_000 });

    // Click first task
    await taskCards.first().click();

    // Detail page should show title, description, reward
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/reward|payment|奖励|报酬/i)).toBeVisible();
  });

  test('TASK-003: User can submit a bid on a task', async ({ page }) => {
    // Go to a specific task detail
    await page.goto('/tasks/1');

    // Wait for detail page to load
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });

    // Look for bid/submit button
    const bidButton = page.getByRole('button', { name: /bid|接单|投标/i });
    await expect(bidButton).toBeVisible({ timeout: 5_000 });

    // Click bid
    await bidButton.click();

    // Bid form should appear (amount input, confirm button)
    await expect(page.getByPlaceholder(/amount|bid amount|金额/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /confirm|提交|确认/i })).toBeVisible();

    // Enter bid amount and confirm
    await page.getByPlaceholder(/amount|bid amount|金额/i).fill('100');
    await page.getByRole('button', { name: /confirm|提交|确认/i }).click();

    // Success feedback — could be toast, alert, or redirect
    await expect(
      page.getByText(/success|submitted|成功/i).or(page.getByRole('button', { name: /submitted|已提交/i }))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('TASK-004: Worker can submit deliverable on an accepted task', async ({ page }) => {
    // Navigate to task that has been accepted (assumes test data state)
    await page.goto('/tasks/1');

    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });

    // Look for submit deliverable button
    const submitBtn = page.getByRole('button', { name: /submit|deliver|提交|交付/i });
    await expect(submitBtn).toBeVisible({ timeout: 5_000 });

    await submitBtn.click();

    // Should show submission form (text area or file upload)
    await expect(
      page.getByRole('textbox').or(page.getByLabel(/submission|deliverable|提交内容/i))
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('textbox').fill('Test deliverable: task completed as per requirements.');
    await page.getByRole('button', { name: /confirm|提交|确认/i }).click();

    // Expect success
    await expect(page.getByText(/success|submitted|成功/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TASK-005: Owner can accept a submitted deliverable', async ({ page }) => {
    // Login as task owner
    await page.goto('/tasks/1');

    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });

    // Check for accept/approve button
    const acceptBtn = page.getByRole('button', { name: /accept|approve|验收|通过/i });
    await expect(acceptBtn).toBeVisible({ timeout: 5_000 });

    await acceptBtn.click();

    // Confirmation dialog
    await page.getByRole('button', { name: /confirm|确定|是/i }).click();

    // Task should move to "completed" state
    await expect(page.getByText(/completed|已完成|已验收/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TASK-006: Full happy path — create task → browse → bid → submit → accept', async ({ page }) => {
    // ── Step 1: Create a new task ──
    await page.goto('/tasks/new');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });

    const titleInput = page.getByPlaceholder(/title|任务标题/i);
    const descInput = page.getByPlaceholder(/description|描述/i);
    const rewardInput = page.getByPlaceholder(/reward|payment|报酬/i);

    await titleInput.fill(`E2E Test Task ${Date.now()}`);
    await descInput.fill('This is an automated E2E test task created by Playwright.');
    await rewardInput.fill('500');

    await page.getByRole('button', { name: /create|发布|创建/i }).click();
    await expect(page.getByText(/success|created|已创建/i)).toBeVisible({ timeout: 10_000 });

    // Extract task ID from URL or redirect
    const taskUrl = page.url();
    const taskId = taskUrl.split('/').pop() || '1';

    // ── Step 2: Browse task market ──
    await page.goto('/tasks');
    await expect(page.getByText(`E2E Test Task ${Date.now()}`)).toBeVisible({ timeout: 15_000 });

    // ── Step 3: Bid on the task ──
    await page.goto(`/tasks/${taskId}`);
    await page.getByRole('button', { name: /bid|接单|投标/i }).click();
    await page.getByPlaceholder(/amount|bid amount|金额/i).fill('400');
    await page.getByRole('button', { name: /confirm|提交|确认/i }).click();
    await expect(page.getByText(/success|submitted|已投标/i)).toBeVisible({ timeout: 10_000 });

    // ── Step 4: Submit deliverable ──
    await page.getByRole('button', { name: /submit|deliver|提交/i }).click();
    await page.getByRole('textbox').fill('E2E test deliverable content.');
    await page.getByRole('button', { name: /confirm|提交|确认/i }).click();
    await expect(page.getByText(/success|submitted|已提交/i)).toBeVisible({ timeout: 10_000 });

    // ── Step 5: Accept deliverable ──
    await page.getByRole('button', { name: /accept|approve|验收/i }).click();
    await page.getByRole('button', { name: /confirm|确定/i }).click();
    await expect(page.getByText(/completed|已完成|已验收/i)).toBeVisible({ timeout: 10_000 });
  });
});
