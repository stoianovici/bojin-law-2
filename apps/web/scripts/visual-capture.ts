#!/usr/bin/env npx ts-node

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface CaptureConfig {
  slug: string;
  pages: string[];
  components: string[];
  darkMode: boolean;
}

interface ManifestEntry {
  type: 'page' | 'component';
  name: string;
  path: string;
  url: string;
  timestamp: string;
}

function parseArgs(): CaptureConfig {
  const args = process.argv.slice(2);
  const config: CaptureConfig = {
    slug: 'default',
    pages: [],
    components: [],
    darkMode: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--slug':
        config.slug = nextArg || 'default';
        i++;
        break;
      case '--pages':
        config.pages = (nextArg || '').split(',').filter(Boolean);
        i++;
        break;
      case '--components':
        config.components = (nextArg || '').split(',').filter(Boolean);
        i++;
        break;
      case '--light':
        config.darkMode = false;
        break;
    }
  }

  return config;
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

async function capturePages(
  page: Page,
  pages: string[],
  outputDir: string
): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];

  for (const route of pages) {
    const safeName = route.replace(/\//g, '-').replace(/^-/, '') || 'home';
    const screenshotPath = path.join(outputDir, `page-${safeName}.png`);

    console.log(`Capturing page: ${route}`);

    try {
      await page.goto(`http://localhost:3001${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await waitForPageReady(page);

      // For documents page, expand the first case to show mape
      if (route === '/documents') {
        try {
          // Click the chevron of the first case to expand it
          const chevron = page
            .locator('button:has-text("Popescu") svg.lucide-chevron-right')
            .first();
          if (await chevron.isVisible()) {
            await chevron.click();
            await page.waitForTimeout(500);
          }
        } catch {
          // Ignore if chevron not found
        }
      }

      // For documents-mapa route, expand case and click the mapa
      if (route === '/documents-mapa') {
        try {
          // First navigate to documents
          await page.goto('http://localhost:3001/documents', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await waitForPageReady(page);

          // Click the chevron of the first case to expand it
          const chevron = page
            .locator('button:has-text("Popescu") svg.lucide-chevron-right')
            .first();
          if (await chevron.isVisible()) {
            await chevron.click();
            await page.waitForTimeout(500);
          }

          // Click on the first mapa "Dosar Instanță"
          const mapaItem = page.locator('button:has-text("Dosar Instanță")').first();
          if (await mapaItem.isVisible()) {
            await mapaItem.click();
            await page.waitForTimeout(1000);
          }
        } catch {
          // Ignore if elements not found
        }
      }

      // For create-mapa route, click the + button to open modal
      if (route === '/documents-create-mapa') {
        try {
          await page.goto('http://localhost:3001/documents', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await waitForPageReady(page);

          // Click the + button in the Documents header
          const plusButton = page.locator('aside button:has(svg.lucide-plus)').first();
          if (await plusButton.isVisible()) {
            await plusButton.click();
            await page.waitForTimeout(1000);
          }
        } catch {
          // Ignore if elements not found
        }
      }

      // For template-picker route, open the template picker modal
      if (route === '/documents-template-picker') {
        try {
          await page.goto('http://localhost:3001/documents', {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
          await waitForPageReady(page);

          // Click the + button to open create mapa modal
          const plusButton = page.locator('aside button:has(svg.lucide-plus)').first();
          if (await plusButton.isVisible()) {
            await plusButton.click();
            await page.waitForTimeout(500);
          }

          // Toggle "Start from template" switch
          const templateToggle = page.locator('button:has-text("Start from template")');
          if (await templateToggle.isVisible()) {
            await templateToggle.click();
            await page.waitForTimeout(300);
          }

          // Click "Select Template" button
          const selectButton = page.locator('button:has-text("Select Template")');
          if (await selectButton.isVisible()) {
            await selectButton.click();
            await page.waitForTimeout(1000);
          }
        } catch {
          // Ignore if elements not found
        }
      }

      await page.screenshot({ path: screenshotPath, fullPage: true });

      entries.push({
        type: 'page',
        name: route,
        path: screenshotPath,
        url: route,
        timestamp: new Date().toISOString(),
      });

      console.log(`  -> Saved: ${screenshotPath}`);
    } catch (error) {
      console.error(`  -> Failed to capture ${route}: ${error}`);
    }
  }

  return entries;
}

async function captureComponents(
  page: Page,
  components: string[],
  outputDir: string
): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];

  for (const component of components) {
    const url = `/dev/preview/${component}`;
    const screenshotPath = path.join(outputDir, `component-${component}.png`);

    console.log(`Capturing component: ${component}`);

    try {
      await page.goto(`http://localhost:3001${url}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await waitForPageReady(page);
      await page.screenshot({ path: screenshotPath });

      entries.push({
        type: 'component',
        name: component,
        path: screenshotPath,
        url: url,
        timestamp: new Date().toISOString(),
      });

      console.log(`  -> Saved: ${screenshotPath}`);
    } catch (error) {
      console.error(`  -> Failed to capture ${component}: ${error}`);
    }
  }

  return entries;
}

async function performDevLogin(page: Page): Promise<boolean> {
  console.log('Authenticating with dev credentials...');
  try {
    await page.goto('http://localhost:3001/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(1000);

    // Fill in test credentials
    await page.fill('input[placeholder="Username"]', 'test');
    await page.fill('input[placeholder="Password"]', 'test');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for redirect to complete
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await page.waitForTimeout(1000);

    console.log('  -> Login successful');
    return true;
  } catch (error) {
    console.error('  -> Login failed:', error);
    return false;
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  if (config.pages.length === 0 && config.components.length === 0) {
    console.log('Usage: npx ts-node scripts/visual-capture.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --slug <name>           Identifier for this capture session');
    console.log('  --pages <routes>        Comma-separated list of routes (e.g., /,/cases,/tasks)');
    console.log('  --components <names>    Comma-separated list of components (e.g., Button,Card)');
    console.log('  --light                 Use light mode instead of dark mode');
    console.log('');
    console.log('Example:');
    console.log(
      '  npx ts-node scripts/visual-capture.ts --slug my-feature --pages /,/cases --components Button,Card'
    );
    process.exit(1);
  }

  const outputDir = path.join(
    process.cwd(),
    '.claude',
    'work',
    'screenshots',
    `iterate-${config.slug}`
  );
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\nVisual Capture - ${config.slug}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Color scheme: ${config.darkMode ? 'dark' : 'light'}`);
  console.log('');

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context: BrowserContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      colorScheme: config.darkMode ? 'dark' : 'light',
    });
    const page: Page = await context.newPage();

    // Perform dev login before capturing pages
    const loggedIn = await performDevLogin(page);
    if (!loggedIn) {
      console.error('Failed to authenticate. Screenshots may show login page.');
    }

    const manifest: ManifestEntry[] = [];

    if (config.pages.length > 0) {
      console.log(`Capturing ${config.pages.length} page(s)...`);
      const pageEntries = await capturePages(page, config.pages, outputDir);
      manifest.push(...pageEntries);
    }

    if (config.components.length > 0) {
      console.log(`\nCapturing ${config.components.length} component(s)...`);
      const componentEntries = await captureComponents(page, config.components, outputDir);
      manifest.push(...componentEntries);
    }

    await browser.close();

    const manifestPath = path.join(outputDir, 'manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          slug: config.slug,
          timestamp: new Date().toISOString(),
          darkMode: config.darkMode,
          entries: manifest,
        },
        null,
        2
      )
    );

    console.log(`\nCapture complete!`);
    console.log(`Total: ${manifest.length} screenshot(s)`);
    console.log(`Manifest: ${manifestPath}`);
  } catch (error) {
    console.error('Error during capture:', error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

main();
