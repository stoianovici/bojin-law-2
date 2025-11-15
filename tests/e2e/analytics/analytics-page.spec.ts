/**
 * E2E Tests: Analytics Page (Story 1.6)
 * Tests the new Analytics section with KPI widgets
 * - Role-based access control (Partner only)
 * - KPI widget rendering
 * - Navigation integration
 */

import { test, expect } from '@playwright/test';

test.describe('Analytics Page (Story 1.6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('Partner can access Analytics page', async ({ page }) => {
    // Verify we're on Partner role
    await expect(page.locator('[data-testid="role-switcher"], [aria-label="Select role"]')).toContainText('Partner');

    // Navigate to Analytics via sidebar
    const sidebar = page.locator('aside[aria-label="Main navigation"], nav');
    const analyticsLink = sidebar.locator('text=/Analytics|Analitică/i');

    await expect(analyticsLink).toBeVisible();
    await analyticsLink.click();

    // Verify we're on Analytics page
    await expect(page).toHaveURL('/analytics');

    // Verify Analytics page loads
    await expect(page.locator('main h1').first()).toContainText(/Analytics.*KPI/i);
  });

  test('Analytics page displays KPI widgets', async ({ page }) => {
    // Navigate to Analytics
    await page.goto('http://localhost:3000/analytics');

    // Wait for page to load
    await expect(page.locator('main h1').first()).toContainText(/Analytics/i);

    // Verify KPI widgets (moved from main dashboard in Story 1.6)
    // 1. Firm KPIs Widget
    await expect(page.locator('[data-widget-id="firm-kpis"]')).toBeVisible({ timeout: 10000 });

    // 2. Billable Hours Chart Widget
    await expect(page.locator('[data-widget-id="billable-hours-chart"]')).toBeVisible();

    // 3. Case Distribution Widget
    await expect(page.locator('[data-widget-id="case-distribution"]')).toBeVisible();

    // 4. Pending Approvals Widget
    await expect(page.locator('[data-widget-id="pending-approvals"]')).toBeVisible();
  });

  test('Firm KPIs Widget displays metrics', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');

    const widget = page.locator('[data-widget-id="firm-kpis"]');
    await expect(widget).toBeVisible();

    // Verify widget shows KPI metrics
    await expect(widget).toContainText(/KPI/i);
    await expect(widget).toContainText(/Cazuri Active|Active Cases/i);

    // Verify metrics display numerical values
    const metrics = widget.locator('[data-testid="kpi-metric"]');
    if (await metrics.count() > 0) {
      await expect(metrics.first()).toBeVisible();
    }
  });

  test('Billable Hours Chart Widget displays visualization', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');

    const widget = page.locator('[data-widget-id="billable-hours-chart"]');
    await expect(widget).toBeVisible();

    // Verify chart container exists
    await expect(widget).toContainText(/Ore Facturabile|Billable Hours/i);

    // Verify chart renders (recharts component)
    const chart = widget.locator('.recharts-wrapper').first();
    await expect(chart).toBeVisible();
  });

  test('Case Distribution Widget displays data', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');

    const widget = page.locator('[data-widget-id="case-distribution"]');
    await expect(widget).toBeVisible();

    await expect(widget).toContainText(/Distribuție|Distribution/i);
  });

  test('Pending Approvals Widget displays pending items', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');

    const widget = page.locator('[data-widget-id="pending-approvals"]');
    await expect(widget).toBeVisible();

    await expect(widget).toContainText(/Aprobări|Approvals/i);
  });

  test('Analytics widgets support drag-and-drop rearrangement', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');

    // Verify React Grid Layout is active
    const gridLayout = page.locator('.react-grid-layout');
    await expect(gridLayout).toBeVisible();

    // Verify widgets have draggable handles
    const draggableWidgets = page.locator('.react-grid-item');
    await expect(draggableWidgets.count()).toBeGreaterThan(0);

    // Verify first widget is draggable
    const firstWidget = draggableWidgets.first();
    await expect(firstWidget).toHaveAttribute('draggable', 'true');
  });

  test('Associate role cannot access Analytics page', async ({ page }) => {
    // Switch to Associate role
    await page.click('[aria-label="Select role"]');
    await page.click('text=Associate');

    // Verify Associate role is active
    await expect(page.locator('[data-testid="role-switcher"], [aria-label="Select role"]')).toContainText('Associate');

    // Verify Analytics link is NOT visible in sidebar
    const sidebar = page.locator('aside[aria-label="Main navigation"], nav');
    const analyticsLink = sidebar.locator('text=/Analytics|Analitică/i');
    await expect(analyticsLink).not.toBeVisible();

    // Try to navigate directly to Analytics URL
    await page.goto('http://localhost:3000/analytics');

    // Should be redirected to dashboard or see access denied
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/analytics');

    // OR should see access denied message
    const accessDenied = page.locator('text=/Access Denied|Nu aveți acces/i');
    if (await accessDenied.isVisible()) {
      await expect(accessDenied).toBeVisible();
    }
  });

  test('Paralegal role cannot access Analytics page', async ({ page }) => {
    // Switch to Paralegal role
    await page.click('[aria-label="Select role"]');
    await page.click('text=Paralegal');

    // Verify Paralegal role is active
    await expect(page.locator('[data-testid="role-switcher"], [aria-label="Select role"]')).toContainText('Paralegal');

    // Verify Analytics link is NOT visible in sidebar
    const sidebar = page.locator('aside[aria-label="Main navigation"], nav');
    const analyticsLink = sidebar.locator('text=/Analytics|Analitică/i');
    await expect(analyticsLink).not.toBeVisible();

    // Try to navigate directly to Analytics URL
    await page.goto('http://localhost:3000/analytics');

    // Should be redirected to dashboard or see access denied
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/analytics');

    // OR should see access denied message
    const accessDenied = page.locator('text=/Access Denied|Nu aveți acces/i');
    if (await accessDenied.isVisible()) {
      await expect(accessDenied).toBeVisible();
    }
  });

  test('Navigation between Dashboard and Analytics preserves state', async ({ page }) => {
    // Start on Dashboard
    await page.goto('http://localhost:3000');

    // Navigate to Analytics
    const sidebar = page.locator('aside[aria-label="Main navigation"], nav');
    await sidebar.locator('text=/Analytics|Analitică/i').click();
    await expect(page).toHaveURL('/analytics');

    // Navigate back to Dashboard
    await sidebar.locator('text=/Dashboard/i').click();
    await expect(page).toHaveURL('/');

    // Navigate to Analytics again
    await sidebar.locator('text=/Analytics|Analitică/i').click();
    await expect(page).toHaveURL('/analytics');

    // Verify Analytics widgets still render correctly
    await expect(page.locator('[data-widget-id="firm-kpis"]')).toBeVisible();
  });

  test('Analytics page supports Romanian language', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');

    // Verify Romanian diacritics render correctly
    const pageContent = await page.locator('main, [role="main"]').textContent();

    // Check for Romanian characters
    expect(pageContent).toMatch(/[ăâîșț]/);

    // Check for Romanian labels
    expect(pageContent).toMatch(/Ore|Cazuri|Aprobări/i);
  });

  test('Analytics page layout persists after reload', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');

    // Wait for widgets to load
    await expect(page.locator('[data-widget-id="firm-kpis"]')).toBeVisible();

    // Reload page
    await page.reload();

    // Verify widgets still render in same layout
    await expect(page.locator('[data-widget-id="firm-kpis"]')).toBeVisible();
    await expect(page.locator('[data-widget-id="billable-hours-chart"]')).toBeVisible();
  });
});
