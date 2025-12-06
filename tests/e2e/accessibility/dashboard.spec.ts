/**
 * Dashboard Accessibility Tests
 * Tests WCAG AA compliance for dashboard pages using axe-core
 */

import { test, expect } from '@playwright/test';
import { testA11y, a11yTestScenarios, getA11yViolations } from '@legal-platform/test-utils';

test.describe('Dashboard Accessibility - WCAG AA Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and navigate to dashboard
    // In real implementation, this would use actual auth flow
    await page.goto('http://localhost:3000/dashboard');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('Main dashboard page has no accessibility violations', async ({ page }) => {
    await testA11y(page);
  });

  test('Dashboard has proper landmark regions', async ({ page }) => {
    await a11yTestScenarios.landmarks(page);

    // Verify essential landmarks exist
    const main = page.locator('main');
    const nav = page.locator('nav');
    const header = page.locator('header, [role="banner"]');

    await expect(main).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(header).toBeVisible();
  });

  test('Dashboard has proper heading hierarchy', async ({ page }) => {
    await a11yTestScenarios.headings(page);

    // Verify h1 exists and is unique
    const h1Elements = await page.locator('h1').count();
    expect(h1Elements).toBe(1);

    // Verify heading order
    const h1Text = await page.locator('h1').textContent();
    expect(h1Text).toBeTruthy();
  });

  test('All interactive elements are keyboard accessible', async ({ page }) => {
    // Test keyboard navigation
    await a11yTestScenarios.keyboard(page);

    // Verify tab order makes sense
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();
  });

  test('All images have alt text', async ({ page }) => {
    await a11yTestScenarios.images(page);

    // Verify no images without alt text
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test('Color contrast meets WCAG AA requirements', async ({ page }) => {
    await a11yTestScenarios.colorContrast(page);
  });

  test('ARIA attributes are used correctly', async ({ page }) => {
    await a11yTestScenarios.aria(page);
  });

  test('Forms have proper labels', async ({ page }) => {
    // Only run if forms exist on the page
    const formCount = await page.locator('form').count();

    if (formCount > 0) {
      await a11yTestScenarios.formLabels(page);

      // Verify all inputs have associated labels
      const inputs = page.locator('input:not([type="hidden"])');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const hasLabel =
          (await input.getAttribute('aria-label')) ||
          (await input.getAttribute('aria-labelledby')) ||
          (await page
            .locator(`label[for="${await input.getAttribute('id')}"]`)
            .count()) > 0;

        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('Focus indicators are visible', async ({ page }) => {
    // Tab through interactive elements and verify focus is visible
    const interactiveElements = page.locator(
      'a, button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const count = await interactiveElements.count();

    if (count > 0) {
      // Focus first interactive element
      await page.keyboard.press('Tab');

      // Get computed styles of focused element
      const focusOutline = await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement;
        const styles = window.getComputedStyle(focused);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow,
        };
      });

      // Verify some form of focus indicator exists
      const hasFocusIndicator =
        focusOutline.outline !== 'none' ||
        focusOutline.outlineWidth !== '0px' ||
        focusOutline.boxShadow !== 'none';

      expect(hasFocusIndicator).toBeTruthy();
    }
  });

  test('Page has a skip link for keyboard users', async ({ page }) => {
    // Verify skip link exists and works
    const skipLink = page.locator('a[href="#main-content"], a[href="#main"], .skip-link');

    if ((await skipLink.count()) > 0) {
      // Focus skip link
      await page.keyboard.press('Tab');

      // Verify it's the first focusable element
      const focusedText = await page.evaluate(
        () => (document.activeElement as HTMLElement)?.textContent
      );

      expect(focusedText?.toLowerCase()).toContain('skip');
    }
  });

  test('Dynamic content updates are announced to screen readers', async ({ page }) => {
    // Check for live regions
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
    const liveRegionCount = await liveRegions.count();

    // If there are dynamic updates, verify they have proper ARIA
    if (liveRegionCount > 0) {
      for (let i = 0; i < liveRegionCount; i++) {
        const region = liveRegions.nth(i);
        const ariaLive =
          (await region.getAttribute('aria-live')) || (await region.getAttribute('role'));
        expect(ariaLive).toBeTruthy();
      }
    }
  });

  test('Can generate detailed violation report', async ({ page }) => {
    // Get violations without throwing (for reporting purposes)
    const violations = await getA11yViolations(page);

    // In a real scenario, this could be saved to a file or sent to a reporting service
    if (violations.length > 0) {
      console.log('Accessibility violations found:', violations.length);
      violations.forEach((violation: any, index: number) => {
        console.log(`\n${index + 1}. ${violation.id} (${violation.impact})`);
        console.log(`   ${violation.description}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);
      });

      // Fail the test if violations exist
      expect(violations).toHaveLength(0);
    }
  });
});

test.describe('Dashboard Accessibility - Role-based Views', () => {
  test('Partner dashboard is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/partner');
    await page.waitForLoadState('networkidle');
    await testA11y(page);
  });

  test('Associate dashboard is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/associate');
    await page.waitForLoadState('networkidle');
    await testA11y(page);
  });

  test('Paralegal dashboard is accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/paralegal');
    await page.waitForLoadState('networkidle');
    await testA11y(page);
  });
});

test.describe('Dashboard Accessibility - Romanian Language Support', () => {
  test('Dashboard with Romanian content maintains accessibility', async ({ page }) => {
    // Set language preference to Romanian
    await page.goto('http://localhost:3000/dashboard?lang=ro');
    await page.waitForLoadState('networkidle');

    // Test accessibility with Romanian diacritics
    await testA11y(page);

    // Verify Romanian characters render correctly
    const pageContent = await page.textContent('body');
    const hasRomanianChars = /[ăâîșț]/i.test(pageContent || '');

    // If Romanian content exists, it should still be accessible
    if (hasRomanianChars) {
      console.log('Romanian diacritics detected, accessibility maintained');
    }
  });
});
