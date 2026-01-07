#!/usr/bin/env npx ts-node

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const BASE_URL = 'http://localhost:3001';

async function main() {
  const outputDir = path.join(
    process.cwd(),
    '.claude',
    'work',
    'screenshots',
    'iterate-mobile-mockups-v2'
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    colorScheme: 'dark',
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Mobile pages to capture
  const mobilePages = [
    { route: '/m', name: 'page-m' },
    { route: '/m/cases', name: 'page-m-cases' },
    { route: '/m/cases/1', name: 'page-m-cases-1' },
    { route: '/m/calendar', name: 'page-m-calendar' },
    { route: '/m/search', name: 'page-m-search' },
  ];

  for (const { route, name } of mobilePages) {
    console.log(`Capturing ${route}...`);
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);

      const screenshotPath = path.join(outputDir, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  -> Saved: ${screenshotPath}`);
    } catch (error) {
      console.error(`  -> Failed: ${error}`);
    }
  }

  await browser.close();
  console.log('\nDone!');
}

main();
