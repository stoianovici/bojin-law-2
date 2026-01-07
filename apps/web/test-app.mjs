import { chromium } from 'playwright';

async function testApp() {
  console.log('Starting Playwright test...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Mock auth state that matches the auth store
  const mockAuthState = {
    state: {
      user: {
        id: 'aa3992a2-4bb0-45e2-9bc5-15e75f6a5793',
        email: 'partner@demo.lawfirm.ro',
        name: 'Demo Partner',
        role: 'ADMIN',
        firmId: '99d685ee-1723-4d21-9634-ea414ceaba9b'
      },
      accessToken: 'mock-token',
      graphToken: null,
      isAuthenticated: true,
      isLoading: false
    },
    version: 0
  };

  // Collect console messages and network errors
  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('requestfailed', request => {
    if (!request.url().includes('_next/static')) {
      networkErrors.push(`${request.url()} - ${request.failure()?.errorText}`);
    }
  });

  try {
    // First, set up auth state via any page
    console.log('1. Setting up mock auth state...');
    await page.goto('http://localhost:3001/login?devAuth=true', { waitUntil: 'domcontentloaded' });

    // Inject auth state into sessionStorage
    await page.evaluate((authState) => {
      sessionStorage.setItem('auth-storage', JSON.stringify(authState));
    }, mockAuthState);
    console.log('   Auth state injected into sessionStorage');

    // Test 2: Navigate to dashboard with devAuth
    console.log('\n2. Loading dashboard...');
    await page.goto('http://localhost:3001/?devAuth=true', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`   URL: ${page.url()}`);

    // Wait for GraphQL to complete
    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/test-dashboard.png', fullPage: true });
    console.log('   Screenshot saved to /tmp/test-dashboard.png');

    // Check if we're on dashboard or redirected to login
    if (page.url().includes('/login')) {
      console.log('   FAILED: Redirected to login page');
    } else {
      const dashboardText = await page.locator('body').textContent();
      console.log(`   Content (first 500 chars): ${dashboardText?.slice(0, 500)?.replace(/\s+/g, ' ')}...\n`);
    }

    // Test 3: Check /cases page
    console.log('3. Navigating to /cases...');
    await page.goto('http://localhost:3001/cases?devAuth=true', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`   URL: ${page.url()}`);

    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/test-cases.png', fullPage: true });
    console.log('   Screenshot saved to /tmp/test-cases.png');

    if (page.url().includes('/login')) {
      console.log('   FAILED: Redirected to login page');
    } else {
      const casesContent = await page.locator('body').textContent();
      console.log(`   Content (first 500 chars): ${casesContent?.slice(0, 500)?.replace(/\s+/g, ' ')}...\n`);

      // Check for case data
      const caseCards = await page.locator('a[href^="/cases/"]').count();
      console.log(`   Case links found: ${caseCards}`);

      const errorElements = await page.locator('text=/eroare|error/i').count();
      console.log(`   Error elements: ${errorElements}`);
    }

    // Test 4: Check /tasks page
    console.log('\n4. Navigating to /tasks...');
    await page.goto('http://localhost:3001/tasks?devAuth=true', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`   URL: ${page.url()}`);

    await page.waitForTimeout(5000);

    await page.screenshot({ path: '/tmp/test-tasks.png', fullPage: true });
    console.log('   Screenshot saved to /tmp/test-tasks.png');

    if (page.url().includes('/login')) {
      console.log('   FAILED: Redirected to login page');
    } else {
      const tasksContent = await page.locator('body').textContent();
      console.log(`   Content (first 500 chars): ${tasksContent?.slice(0, 500)?.replace(/\s+/g, ' ')}...\n`);
    }

    // Print relevant console logs
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('GraphQL') ||
      log.includes('error') ||
      log.includes('Error') ||
      log.includes('Apollo') ||
      log.includes('Network') ||
      log.includes('fetch')
    );

    if (relevantLogs.length > 0) {
      console.log('Relevant console logs:');
      relevantLogs.slice(-15).forEach(log => console.log(`   ${log}`));
    }

    if (networkErrors.length > 0) {
      console.log('\nNetwork errors:');
      networkErrors.forEach(err => console.log(`   ${err}`));
    }

  } catch (error) {
    console.error('Test error:', error.message);
    await page.screenshot({ path: '/tmp/test-error.png' });

    console.log('\nAll console logs:');
    consoleLogs.slice(-30).forEach(log => console.log(`   ${log}`));
  } finally {
    await browser.close();
    console.log('\nTest completed.');
  }
}

testApp();
