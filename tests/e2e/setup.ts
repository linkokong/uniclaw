import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  // Ensure dev server is reachable
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(baseURL!, { method: 'HEAD' });
      if (response.ok) break;
    } catch {
      if (i === maxRetries - 1) throw new Error(`Dev server not available at ${baseURL}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Optionally seed test data via backend API
  const backendUrl = process.env.E2E_BACKEND_URL || 'http://localhost:3001';
  try {
    await fetch(`${backendUrl}/api/test/seed`, { method: 'POST' });
  } catch {
    // Seed endpoint may not exist — skip silently
  }

  // Create a authenticated context for tests that need a logged-in user
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to app and ensure wallet connection flow works
  await page.goto(baseURL!);
  await page.waitForLoadState('networkidle').catch(() => {});

  // Store auth state if wallet adapter persists it
  await context.storageState({ path: './tests/e2e/.auth/user.json' });

  await browser.close();
}

export default globalSetup;
