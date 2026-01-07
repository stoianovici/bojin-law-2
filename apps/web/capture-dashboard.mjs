import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // Navigate to login
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Fill in dev credentials
  await page.fill('input[placeholder="Username"]', 'test');
  await page.fill('input[placeholder="Password"]', 'test');
  
  // Click login
  await page.click('button:has-text("Login")');
  
  // Wait for dashboard to load
  await page.waitForTimeout(5000);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/dashboard-authed.png', fullPage: true });
  
  // Also capture the HTML
  const html = await page.content();
  fs.writeFileSync('/tmp/dashboard-authed.html', html);
  
  console.log('Screenshot saved to /tmp/dashboard-authed.png');
  console.log('HTML saved to /tmp/dashboard-authed.html');
  
  await browser.close();
})();
