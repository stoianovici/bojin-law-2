/**
 * E2E Tests: Partner Operational Dashboard (Story 1.6)
 * Tests the new Partner dashboard with operational focus
 * - Supervised Cases Widget
 * - Firm Cases Overview Widget
 * - Firm Tasks Overview Widget
 * - Employee Workload Widget
 */

import { test, expect } from '@playwright/test';

test.describe('Partner Operational Dashboard (Story 1.6)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard as Partner
    await page.goto('http://localhost:3000');

    // Verify we're on Partner role
    await expect(page.locator('[data-testid="role-switcher"], [aria-label="Select role"]')).toContainText('Partner');
  });

  test('Partner dashboard loads with new operational layout', async ({ page }) => {
    // Verify page loads
    await expect(page.locator('main h1').first()).toContainText(/Dashboard/i);

    // Verify new operational widgets are present (Story 1.6)
    // 1. Supervised Cases Widget
    await expect(page.locator('[data-widget-id="supervised-cases"]')).toBeVisible({ timeout: 10000 });

    // 2. My Tasks Widget
    await expect(page.locator('[data-widget-id="my-tasks"]')).toBeVisible();

    // 3. Firm Cases Overview Widget
    await expect(page.locator('[data-widget-id="firm-cases-overview"]')).toBeVisible();

    // 4. Firm Tasks Overview Widget
    await expect(page.locator('[data-widget-id="firm-tasks-overview"]')).toBeVisible();

    // 5. Employee Workload Widget
    await expect(page.locator('[data-widget-id="employee-workload"]')).toBeVisible();

    // 6. AI Suggestions Widget (remains from previous stories)
    await expect(page.locator('[data-widget-id="ai-suggestions"]')).toBeVisible();

    // Verify old KPI widgets are NOT on main dashboard (moved to Analytics)
    await expect(page.locator('[data-widget-id="firm-kpis"]')).not.toBeVisible();
    await expect(page.locator('[data-widget-id="billable-hours-chart"]')).not.toBeVisible();
    await expect(page.locator('[data-widget-id="case-distribution"]')).not.toBeVisible();
  });

  test('Supervised Cases Widget renders correctly', async ({ page }) => {
    const widget = page.locator('[data-widget-id="supervised-cases"]');
    await expect(widget).toBeVisible();

    // Verify widget has cases or empty state
    const hasCases = await widget.locator('[data-testid="case-item"]').count();

    if (hasCases > 0) {
      // Verify first case has required elements
      const firstCase = widget.locator('[data-testid="case-item"]').first();
      await expect(firstCase).toBeVisible();

      // Should show case number, status, risk level
      await expect(firstCase.locator('[data-testid="case-number"]')).toBeVisible();
      await expect(firstCase.locator('[data-testid="case-status"]')).toBeVisible();
    } else {
      // Verify empty state
      await expect(widget).toContainText(/No supervised cases|Nu există cazuri/i);
    }

    // Verify widget supports Romanian diacritics
    await expect(widget).toContainText(/Cazuri|Cases/i);
  });

  test('Firm Cases Overview Widget tabs function correctly', async ({ page }) => {
    const widget = page.locator('[data-widget-id="firm-cases-overview"]');
    await expect(widget).toBeVisible();

    // Verify 3 tabs exist
    await expect(widget.locator('[role="tab"]')).toHaveCount(3);

    // Verify tab labels
    await expect(widget.locator('text=/At Risk|La Risc/i')).toBeVisible();
    await expect(widget.locator('text=/High Value|Valoare Mare/i')).toBeVisible();
    await expect(widget.locator('text=/AI Insights/i')).toBeVisible();

    // Test tab switching
    await widget.locator('text=/High Value|Valoare Mare/i').click();
    await expect(widget.locator('[role="tabpanel"][data-state="active"]')).toBeVisible();

    await widget.locator('text=/AI Insights/i').click();
    await expect(widget.locator('[role="tabpanel"][data-state="active"]')).toBeVisible();
  });

  test('Firm Tasks Overview Widget displays metrics', async ({ page }) => {
    const widget = page.locator('[data-widget-id="firm-tasks-overview"]');
    await expect(widget).toBeVisible();

    // Verify task metrics are displayed
    await expect(widget).toContainText(/Tasks|Sarcini/i);

    // Should show at least one metric (overdue, due today, etc.)
    const metrics = widget.locator('[data-testid="task-metric"]');
    await expect(metrics.first()).toBeVisible();
  });

  test('Employee Workload Widget view toggle works', async ({ page }) => {
    const widget = page.locator('[data-widget-id="employee-workload"]');
    await expect(widget).toBeVisible();

    // Verify Daily/Weekly toggle exists
    const dailyButton = widget.locator('text=/Daily|Zilnic/i');
    const weeklyButton = widget.locator('text=/Weekly|Săptămânal/i');

    await expect(dailyButton).toBeVisible();
    await expect(weeklyButton).toBeVisible();

    // Test toggle functionality
    await weeklyButton.click();
    await expect(weeklyButton).toHaveAttribute('data-state', 'active');

    await dailyButton.click();
    await expect(dailyButton).toHaveAttribute('data-state', 'active');

    // Verify utilization data is displayed
    const employees = widget.locator('[data-testid="employee-row"]');
    if (await employees.count() > 0) {
      await expect(employees.first()).toBeVisible();
      await expect(employees.first()).toContainText(/%/); // Utilization percentage
    }
  });

  test('Employee Workload Widget detail row expansion', async ({ page }) => {
    const widget = page.locator('[data-widget-id="employee-workload"]');
    await expect(widget).toBeVisible();

    const employees = widget.locator('[data-testid="employee-row"]');
    const employeeCount = await employees.count();

    if (employeeCount > 0) {
      // Click first employee row to expand details
      await employees.first().click();

      // Verify detail row appears
      await expect(widget.locator('[data-testid="employee-detail"]').first()).toBeVisible();

      // Detail should show task breakdown
      await expect(widget.locator('[data-testid="employee-detail"]').first()).toContainText(/Tasks|Sarcini/i);
    }
  });

  test('Widgets support drag-and-drop rearrangement', async ({ page }) => {
    // Verify React Grid Layout is active
    const gridLayout = page.locator('.react-grid-layout');
    await expect(gridLayout).toBeVisible();

    // Verify widgets have draggable handles
    const draggableWidgets = page.locator('.react-grid-item');
    await expect(draggableWidgets).toHaveCount(6); // 6 widgets in Story 1.6 layout

    // Test drag functionality (basic check - full drag test requires complex mouse events)
    const firstWidget = draggableWidgets.first();
    await expect(firstWidget).toHaveAttribute('draggable', 'true');
  });

  test('Widgets maintain collapsed/expanded state', async ({ page }) => {
    const widget = page.locator('[data-widget-id="supervised-cases"]');
    await expect(widget).toBeVisible();

    // Find collapse/expand button
    const collapseButton = widget.locator('[aria-label*="Collapse"], [aria-label*="Expand"]').first();

    if (await collapseButton.isVisible()) {
      // Click to collapse
      await collapseButton.click();
      await page.waitForTimeout(300); // Wait for animation

      // Verify widget is collapsed (content hidden)
      const widgetContent = widget.locator('[data-testid="widget-content"]');
      await expect(widgetContent).not.toBeVisible();

      // Reload page and verify state persists
      await page.reload();
      await expect(widgetContent).not.toBeVisible();
    }
  });

  test('Dashboard displays Romanian language content correctly', async ({ page }) => {
    // Verify Romanian diacritics render in widgets
    const dashboard = page.locator('main, [role="main"]');

    // Check for Romanian text with diacritics
    const romanianText = await dashboard.textContent();
    expect(romanianText).toMatch(/Cazuri|Sarcini|Angajați/i);

    // Verify Romanian characters render (not replaced with ?)
    expect(romanianText).toMatch(/[ăâîșț]/);
  });

  test('Navigation includes Analytics section', async ({ page }) => {
    // Verify Analytics navigation item exists in sidebar
    const sidebar = page.locator('aside[aria-label="Main navigation"], nav');
    await expect(sidebar).toBeVisible();

    const analyticsLink = sidebar.locator('text=/Analytics|Analitică/i');
    await expect(analyticsLink).toBeVisible();
  });
});
