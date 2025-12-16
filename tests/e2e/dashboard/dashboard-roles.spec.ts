/**
 * E2E Tests: Dashboard Role-Specific Views
 * Tests that each role displays appropriate widgets on their dashboard
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Role Views', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('http://localhost:3000');
  });

  test('Partner dashboard displays all expected widgets', async ({ page }) => {
    // Verify we're on Partner role (default)
    await expect(
      page.locator('[data-testid="role-switcher"], [aria-label="Select role"]')
    ).toContainText('Partner');

    // Verify page title
    await expect(page.locator('h1, [role="heading"]')).toContainText(/Dashboard.*Partner/i);

    // Partner widgets:
    // 1. Firm KPIs Widget
    await expect(page.locator('[data-widget-id="firm-kpis"]')).toBeVisible();
    await expect(page.locator('text=KPI-uri Firmă')).toBeVisible();
    await expect(page.locator('text=Cazuri Active')).toBeVisible();

    // 2. Billable Hours Chart Widget
    await expect(page.locator('[data-widget-id="billable-hours-chart"]')).toBeVisible();
    await expect(page.locator('text=Ore Facturabile')).toBeVisible();

    // 3. Case Distribution Widget
    await expect(page.locator('[data-widget-id="case-distribution"]')).toBeVisible();
    await expect(page.locator('text=Distribuție Cazuri')).toBeVisible();

    // 4. Pending Approvals Widget
    await expect(page.locator('[data-widget-id="pending-approvals"]')).toBeVisible();
    await expect(page.locator('text=Aprobări în Așteptare')).toBeVisible();

    // 5. AI Suggestions Widget
    await expect(page.locator('[data-widget-id="ai-suggestions"]')).toBeVisible();
    await expect(page.locator('text=AI Insights')).toBeVisible();

    // Take screenshot for visual regression
    await page.screenshot({
      path: 'test-results/screenshots/partner-dashboard.png',
      fullPage: true,
    });
  });

  test('Associate dashboard displays role-specific widgets', async ({ page }) => {
    // Switch to Associate role
    await page.click('[aria-label="Select role"]');
    await page.click('text=Associate');

    // Wait for dashboard to update
    await page.waitForTimeout(500);

    // Verify role switched
    await expect(
      page.locator('[data-testid="role-switcher"], [aria-label="Select role"]')
    ).toContainText('Associate');

    // Verify page title updated
    await expect(page.locator('h1, [role="heading"]')).toContainText(/Dashboard.*Avocat/i);

    // Associate widgets:
    // 1. Active Cases Widget
    await expect(page.locator('[data-widget-id="active-cases"]')).toBeVisible();
    await expect(page.locator('text=Cazurile Mele')).toBeVisible();

    // 2. Today's Tasks Widget
    await expect(page.locator('[data-widget-id="today-tasks"]')).toBeVisible();
    await expect(page.locator('text=Sarcini Astăzi')).toBeVisible();

    // 3. Deadlines Widget
    await expect(page.locator('[data-widget-id="deadlines"]')).toBeVisible();
    await expect(page.locator('text=Termene')).toBeVisible();

    // 4. Recent Documents Widget
    await expect(page.locator('[data-widget-id="recent-documents"]')).toBeVisible();
    await expect(page.locator('text=Documente Recente')).toBeVisible();

    // 5. AI Suggestions Widget
    await expect(page.locator('[data-widget-id="ai-suggestions"]')).toBeVisible();
    await expect(page.locator('text=AI Insights')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/screenshots/associate-dashboard.png',
      fullPage: true,
    });
  });

  test('Paralegal dashboard displays role-appropriate widgets', async ({ page }) => {
    // Switch to Paralegal role
    await page.click('[aria-label="Select role"]');
    await page.click('text=Paralegal');

    // Wait for dashboard to update
    await page.waitForTimeout(500);

    // Verify role switched
    await expect(
      page.locator('[data-testid="role-switcher"], [aria-label="Select role"]')
    ).toContainText('Paralegal');

    // Verify page title updated
    await expect(page.locator('h1, [role="heading"]')).toContainText(/Dashboard.*Paralegal/i);

    // Paralegal widgets:
    // 1. Assigned Tasks Widget
    await expect(page.locator('[data-widget-id="assigned-tasks"]')).toBeVisible();
    await expect(page.locator('text=Sarcini Atribuite')).toBeVisible();

    // 2. Document Requests Widget
    await expect(page.locator('[data-widget-id="document-requests"]')).toBeVisible();
    await expect(page.locator('text=Cereri Documente')).toBeVisible();

    // 3. Deadline Calendar Widget
    await expect(page.locator('[data-widget-id="deadline-calendar"]')).toBeVisible();
    await expect(page.locator('text=Calendar Termene')).toBeVisible();

    // 4. AI Suggestions Widget
    await expect(page.locator('[data-widget-id="ai-suggestions"]')).toBeVisible();
    await expect(page.locator('text=AI Insights')).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/screenshots/paralegal-dashboard.png',
      fullPage: true,
    });
  });

  test('Dashboard updates immediately when role is switched', async ({ page }) => {
    // Start as Partner - verify Partner widget exists
    await expect(page.locator('[data-widget-id="firm-kpis"]')).toBeVisible();

    // Switch to Associate
    await page.click('[aria-label="Select role"]');
    await page.click('text=Associate');
    await page.waitForTimeout(500);

    // Partner widget should be gone, Associate widget should appear
    await expect(page.locator('[data-widget-id="firm-kpis"]')).not.toBeVisible();
    await expect(page.locator('[data-widget-id="active-cases"]')).toBeVisible();

    // Switch to Paralegal
    await page.click('[aria-label="Select role"]');
    await page.click('text=Paralegal');
    await page.waitForTimeout(500);

    // Associate widget should be gone, Paralegal widget should appear
    await expect(page.locator('[data-widget-id="active-cases"]')).not.toBeVisible();
    await expect(page.locator('[data-widget-id="assigned-tasks"]')).toBeVisible();

    // Switch back to Partner
    await page.click('[aria-label="Select role"]');
    await page.click('text=Partner');
    await page.waitForTimeout(500);

    // Paralegal widget should be gone, Partner widget should be back
    await expect(page.locator('[data-widget-id="assigned-tasks"]')).not.toBeVisible();
    await expect(page.locator('[data-widget-id="firm-kpis"]')).toBeVisible();
  });
});
