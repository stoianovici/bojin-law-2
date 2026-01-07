import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Collect console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Task') || text.includes('Auth') || text.includes('Apollo') || text.includes('Error') || text.includes('subtask')) {
      console.log(`[BROWSER] ${text}`);
    }
  });

  // Set gateway mode BEFORE any navigation
  console.log('1. Setting gateway mode to seed via route handler...');

  // Use addInitScript to set localStorage before any page script runs
  await context.addInitScript(() => {
    localStorage.setItem('gateway-mode', 'seed');
    sessionStorage.clear();
  });

  // Now navigate
  console.log('2. Navigating to tasks page...');
  await page.goto('http://localhost:3000/tasks');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  await page.screenshot({ path: '.playwright-mcp/test-1-tasks.png' });

  // Verify gateway mode
  const gatewayMode = await page.evaluate(() => localStorage.getItem('gateway-mode'));
  console.log('3. Gateway mode:', gatewayMode);

  // Check what user we got
  const bodyText = await page.textContent('body');
  const hasPartner = bodyText?.includes('Demo Partner') || bodyText?.includes('partner@demo');
  const hasTasks = bodyText?.includes('Research') || bodyText?.includes('Planificat') || bodyText?.includes('DocumentCreation');
  console.log('4. Using seed user (Demo Partner):', hasPartner);
  console.log('5. Has tasks visible:', hasTasks);

  if (hasTasks) {
    // Find clickable task items and click one
    console.log('6. Looking for task rows...');
    const taskItems = page.locator('.group.cursor-pointer, [class*="TaskRow"], div[class*="cursor-pointer"]').first();
    if (await taskItems.count() > 0) {
      console.log('7. Clicking first task...');
      await taskItems.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '.playwright-mcp/test-2-drawer.png' });

      // Look for subtask checkbox button
      const subtaskBtn = page.locator('button[title*="finalizat"], button[title*="Marcheaza"]');
      const count = await subtaskBtn.count();
      console.log(`8. Found ${count} subtask checkbox buttons`);

      if (count > 0) {
        console.log('9. Clicking subtask checkbox...');
        await subtaskBtn.first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: '.playwright-mcp/test-3-clicked.png' });
        console.log('10. Done! Check test-3-clicked.png for result');
      } else {
        console.log('   No subtask checkboxes found. Task may not have subtasks.');
      }
    } else {
      console.log('   No clickable task rows found');
    }
  } else {
    console.log('   No tasks visible - auth may have failed');
  }

  console.log('\nScreenshots saved to .playwright-mcp/test-*.png');
  await page.waitForTimeout(3000);
  await browser.close();
})();
