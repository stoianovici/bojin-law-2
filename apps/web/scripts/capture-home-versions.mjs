import { chromium } from 'playwright';

async function captureVersions() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  await page.goto('http://localhost:3001/dev/home-preview');
  await page.waitForLoadState('networkidle');

  // V4 is now shown by default
  await page.screenshot({ path: '.claude/work/screenshots/home-versions/v4-mockup.png', fullPage: true });
  console.log('Captured V4');

  // Click V1
  await page.click('button:has-text("V1: Clean")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.claude/work/screenshots/home-versions/v1-clean.png', fullPage: true });
  console.log('Captured V1');

  // Click V2
  await page.click('button:has-text("V2: Activity")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.claude/work/screenshots/home-versions/v2-activity.png', fullPage: true });
  console.log('Captured V2');

  // Click V3
  await page.click('button:has-text("V3: Command")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.claude/work/screenshots/home-versions/v3-command.png', fullPage: true });
  console.log('Captured V3');

  await browser.close();
  console.log('Done!');
}

captureVersions().catch(console.error);
