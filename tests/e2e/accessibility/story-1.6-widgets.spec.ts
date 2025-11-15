/**
 * Story 1.6 Widget Accessibility Tests
 * Tests WCAG AA compliance for new Partner dashboard widgets:
 * - SupervisedCasesWidget
 * - FirmCasesOverviewWidget
 * - FirmTasksOverviewWidget
 * - EmployeeWorkloadWidget
 * - Analytics Page
 */

import { test, expect } from '@playwright/test';
import { testA11y, a11yTestScenarios, getA11yViolations } from '@legal-platform/test-utils';

test.describe('Story 1.6 - Partner Dashboard Widgets Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Partner dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('SupervisedCasesWidget has no accessibility violations', async ({ page }) => {
    // Locate the widget
    const widget = page.locator('[data-widget-type="supervised-cases"]');
    await expect(widget).toBeVisible();

    // Run axe-core on the widget
    await testA11y(page);

    // Verify specific accessibility features
    // Case links should have accessible names
    const caseLinks = widget.locator('a[href^="/cases/"]');
    const linkCount = await caseLinks.count();

    for (let i = 0; i < linkCount; i++) {
      const link = caseLinks.nth(i);
      const hasAccessibleName =
        (await link.getAttribute('aria-label')) || (await link.textContent());
      expect(hasAccessibleName).toBeTruthy();
    }

    // Risk indicators should have ARIA labels
    const riskIndicators = widget.locator('[data-risk-level]');
    const riskCount = await riskIndicators.count();

    for (let i = 0; i < riskCount; i++) {
      const indicator = riskIndicators.nth(i);
      const hasAriaLabel = await indicator.getAttribute('aria-label');
      expect(hasAriaLabel).toBeTruthy();
    }
  });

  test('FirmCasesOverviewWidget tabs are keyboard accessible', async ({ page }) => {
    const widget = page.locator('[data-widget-type="firm-cases-overview"]');
    await expect(widget).toBeVisible();

    // Test keyboard navigation through tabs
    await a11yTestScenarios.keyboard(page);

    // Verify tab elements have proper ARIA attributes
    const tabs = widget.locator('[role="tab"]');
    const tabCount = await tabs.count();

    expect(tabCount).toBeGreaterThanOrEqual(3); // At Risk, High Value, AI Insights

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const ariaSelected = await tab.getAttribute('aria-selected');
      const ariaControls = await tab.getAttribute('aria-controls');

      expect(ariaSelected).toBeTruthy();
      expect(ariaControls).toBeTruthy();
    }

    // Verify tab panels have proper ARIA
    const tabPanels = widget.locator('[role="tabpanel"]');
    const panelCount = await tabPanels.count();

    for (let i = 0; i < panelCount; i++) {
      const panel = tabPanels.nth(i);
      const ariaLabelledBy = await panel.getAttribute('aria-labelledby');
      expect(ariaLabelledBy).toBeTruthy();
    }
  });

  test('FirmCasesOverviewWidget meets color contrast requirements', async ({ page }) => {
    const widget = page.locator('[data-widget-type="firm-cases-overview"]');
    await expect(widget).toBeVisible();

    // Test color contrast for badges
    await a11yTestScenarios.colorContrast(page);

    // Run full accessibility check
    await testA11y(page);
  });

  test('FirmTasksOverviewWidget chart is accessible to screen readers', async ({ page }) => {
    const widget = page.locator('[data-widget-type="firm-tasks-overview"]');
    await expect(widget).toBeVisible();

    // Verify chart has accessible description
    const chart = widget.locator('[role="img"], svg[role="img"]');

    if ((await chart.count()) > 0) {
      const ariaLabel = await chart.first().getAttribute('aria-label');
      const ariaDescribedBy = await chart.first().getAttribute('aria-describedby');

      expect(ariaLabel || ariaDescribedBy).toBeTruthy();
    }

    // Run full accessibility check
    await testA11y(page);
  });

  test('EmployeeWorkloadWidget is keyboard accessible', async ({ page }) => {
    const widget = page.locator('[data-widget-type="employee-workload"]');
    await expect(widget).toBeVisible();

    // Test Daily/Weekly toggle buttons
    const toggleButtons = widget.locator('button[role="tab"], button[aria-pressed]');
    const buttonCount = await toggleButtons.count();

    if (buttonCount > 0) {
      // Verify buttons have proper ARIA states
      for (let i = 0; i < buttonCount; i++) {
        const button = toggleButtons.nth(i);
        const ariaPressed = await button.getAttribute('aria-pressed');
        const ariaLabel = await button.getAttribute('aria-label');

        // Should have either aria-pressed (for toggle) or role="tab"
        expect(ariaPressed || (await button.getAttribute('role'))).toBeTruthy();
      }
    }

    // Test keyboard navigation
    await a11yTestScenarios.keyboard(page);

    // Run full accessibility check
    await testA11y(page);
  });

  test('EmployeeWorkloadWidget detail rows are accessible', async ({ page }) => {
    const widget = page.locator('[data-widget-type="employee-workload"]');
    await expect(widget).toBeVisible();

    // Find expandable rows
    const expandButtons = widget.locator('button[aria-expanded]');
    const expandCount = await expandButtons.count();

    if (expandCount > 0) {
      // Test first expand button
      const firstButton = expandButtons.first();
      const initialState = await firstButton.getAttribute('aria-expanded');

      // Click to expand
      await firstButton.click();

      // Verify state changed
      const newState = await firstButton.getAttribute('aria-expanded');
      expect(newState).not.toBe(initialState);

      // Verify accessible name
      const ariaLabel = await firstButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    }

    // Run full accessibility check
    await testA11y(page);
  });

  test('EmployeeWorkloadWidget utilization indicators have screen reader labels', async ({
    page,
  }) => {
    const widget = page.locator('[data-widget-type="employee-workload"]');
    await expect(widget).toBeVisible();

    // Find utilization percentage elements
    const utilizationBars = widget.locator('[role="progressbar"], .utilization-bar');
    const barCount = await utilizationBars.count();

    if (barCount > 0) {
      for (let i = 0; i < barCount; i++) {
        const bar = utilizationBars.nth(i);

        // Progress bars should have aria-label and aria-valuenow
        const role = await bar.getAttribute('role');

        if (role === 'progressbar') {
          const ariaLabel = await bar.getAttribute('aria-label');
          const ariaValueNow = await bar.getAttribute('aria-valuenow');

          expect(ariaLabel).toBeTruthy();
          expect(ariaValueNow).toBeTruthy();
        }
      }
    }
  });

  test('All Story 1.6 widgets maintain Romanian diacritics accessibility', async ({ page }) => {
    // Verify Romanian content renders correctly
    const pageContent = await page.textContent('body');
    const hasRomanianChars = /[ăâîșț]/i.test(pageContent || '');

    if (hasRomanianChars) {
      console.log('Romanian diacritics detected in Story 1.6 widgets');

      // Verify language attributes are set correctly
      const romanianElements = page.locator('[lang="ro"], [lang="ro-RO"]');
      const count = await romanianElements.count();

      if (count === 0) {
        // If no lang attribute, verify parent html has lang set
        const htmlLang = await page.locator('html').getAttribute('lang');
        console.log(`HTML lang attribute: ${htmlLang}`);
      }
    }

    // Run full accessibility check
    await testA11y(page);
  });

  test('Partner dashboard with all widgets has no accessibility violations', async ({
    page,
  }) => {
    // Get comprehensive violation report
    const violations = await getA11yViolations(page);

    if (violations.length > 0) {
      console.log('\nAccessibility violations found on Partner dashboard:');
      violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.id} (Impact: ${violation.impact})`);
        console.log(`   ${violation.description}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);
        violation.nodes.forEach((node) => {
          console.log(`     - ${node.html}`);
          console.log(`       ${node.failureSummary}`);
        });
      });

      // Fail the test
      expect(violations).toHaveLength(0);
    }
  });
});

test.describe('Story 1.6 - Analytics Page Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Analytics page
    await page.goto('http://localhost:3000/analytics');
    await page.waitForLoadState('networkidle');
  });

  test('Analytics page has no accessibility violations', async ({ page }) => {
    await testA11y(page);
  });

  test('Analytics page has proper heading hierarchy', async ({ page }) => {
    await a11yTestScenarios.headings(page);

    // Verify h1 exists
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    const h1Text = await page.locator('h1').textContent();
    expect(h1Text?.toLowerCase()).toContain('analytics');
  });

  test('Analytics page KPI widgets are accessible', async ({ page }) => {
    // Verify KPI widgets have proper structure
    const widgets = page.locator('[data-widget-type]');
    const widgetCount = await widgets.count();

    expect(widgetCount).toBeGreaterThan(0);

    // Run full accessibility check
    await testA11y(page);
  });

  test('Analytics page charts have accessible descriptions', async ({ page }) => {
    // Find all chart elements
    const charts = page.locator('[role="img"], svg[role="img"], .recharts-wrapper');
    const chartCount = await charts.count();

    if (chartCount > 0) {
      for (let i = 0; i < chartCount; i++) {
        const chart = charts.nth(i);
        const ariaLabel =
          (await chart.getAttribute('aria-label')) ||
          (await chart.getAttribute('aria-describedby')) ||
          (await chart.locator('title').textContent());

        // Charts should have some form of accessible description
        if (!(await chart.getAttribute('role'))) {
          // If not marked as role="img", may be wrapped or have title
          const hasTitle = (await chart.locator('title').count()) > 0;
          expect(hasTitle || ariaLabel).toBeTruthy();
        }
      }
    }
  });

  test('Analytics page date range selector is keyboard accessible', async ({ page }) => {
    // Find date range selector if present
    const dateSelector = page.locator('[type="date"], [role="combobox"]');
    const count = await dateSelector.count();

    if (count > 0) {
      // Test keyboard navigation
      await a11yTestScenarios.keyboard(page);

      // Verify accessible labels
      for (let i = 0; i < count; i++) {
        const selector = dateSelector.nth(i);
        const hasLabel =
          (await selector.getAttribute('aria-label')) ||
          (await selector.getAttribute('aria-labelledby')) ||
          (await page.locator(`label[for="${await selector.getAttribute('id')}"]`).count()) > 0;

        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('Analytics page generates detailed violation report', async ({ page }) => {
    const violations = await getA11yViolations(page);

    if (violations.length > 0) {
      console.log('\nAccessibility violations found on Analytics page:');
      violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.id} (Impact: ${violation.impact})`);
        console.log(`   ${violation.description}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);
      });

      // Fail the test
      expect(violations).toHaveLength(0);
    }
  });
});

test.describe('Story 1.6 - Comprehensive Accessibility Report', () => {
  test('Generate comprehensive accessibility report for all Story 1.6 features', async ({
    page,
  }) => {
    const results: Array<{ page: string; violations: number; details: any[] }> = [];

    // Test Partner dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    const dashboardViolations = await getA11yViolations(page);
    results.push({
      page: 'Partner Dashboard',
      violations: dashboardViolations.length,
      details: dashboardViolations,
    });

    // Test Analytics page
    await page.goto('http://localhost:3000/analytics');
    await page.waitForLoadState('networkidle');
    const analyticsViolations = await getA11yViolations(page);
    results.push({
      page: 'Analytics Page',
      violations: analyticsViolations.length,
      details: analyticsViolations,
    });

    // Generate report
    console.log('\n=== Story 1.6 Accessibility Report ===\n');
    let totalViolations = 0;

    results.forEach((result) => {
      console.log(`${result.page}: ${result.violations} violations`);
      totalViolations += result.violations;

      if (result.violations > 0) {
        result.details.forEach((violation, idx) => {
          console.log(`  ${idx + 1}. ${violation.id} (${violation.impact})`);
          console.log(`     ${violation.description}`);
        });
      }
    });

    console.log(`\nTotal violations across Story 1.6: ${totalViolations}`);

    // Fail if any violations found
    expect(totalViolations).toBe(0);
  });
});
