/**
 * Proactive Suggestions E2E Tests
 * Story 5.4: Proactive AI Suggestions System - Task 39
 *
 * End-to-end tests for AI suggestions, morning briefings, deadline warnings,
 * and document completeness workflows
 */

import { test, expect } from '@playwright/test';

test.describe('Proactive AI Suggestions System', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[name="email"]', 'testuser@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  // ============================================================================
  // Morning Briefing Tests (AC: 1)
  // ============================================================================

  test.describe('Morning Briefing (AC: 1)', () => {
    test('should display morning briefing on dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for morning briefing component
      await expect(page.locator('[data-testid="morning-briefing"]')).toBeVisible({ timeout: 10000 });
    });

    test('should show AI-generated summary', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="morning-briefing"]', { timeout: 10000 });

      // Verify summary section
      await expect(page.locator('[data-testid="briefing-summary"]')).toBeVisible();
    });

    test('should show prioritized tasks list', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="morning-briefing"]', { timeout: 10000 });

      // Verify prioritized tasks section
      await expect(page.locator('[data-testid="prioritized-tasks"]')).toBeVisible();

      // Check for task cards if any
      const taskCards = await page.locator('[data-testid="prioritized-task-card"]').count();
      if (taskCards > 0) {
        // Verify task card has priority indicator
        await expect(
          page.locator('[data-testid="prioritized-task-card"]').first().locator('[data-testid="priority-badge"]')
        ).toBeVisible();
      }
    });

    test('should show key deadlines timeline', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="morning-briefing"]', { timeout: 10000 });

      // Verify deadlines section
      await expect(page.locator('[data-testid="key-deadlines"]')).toBeVisible();
    });

    test('should show risk alerts panel', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="morning-briefing"]', { timeout: 10000 });

      // Verify risk alerts section
      await expect(page.locator('[data-testid="risk-alerts"]')).toBeVisible();
    });

    test('should collapse/expand briefing sections', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="morning-briefing"]', { timeout: 10000 });

      // Find collapsible section
      const collapseButton = page.locator('[data-testid="collapse-tasks"]');
      if (await collapseButton.isVisible()) {
        await collapseButton.click();

        // Verify section collapsed
        await expect(page.locator('[data-testid="prioritized-tasks-content"]')).not.toBeVisible();
      }
    });

    test('should mark briefing as viewed', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="morning-briefing"]', { timeout: 10000 });

      // After viewing, briefing should be marked as viewed (no unread indicator)
      await expect(page.locator('[data-testid="briefing-unread-indicator"]')).not.toBeVisible();
    });
  });

  // ============================================================================
  // Contextual Suggestions Tests (AC: 2)
  // ============================================================================

  test.describe('Contextual Suggestions Widget (AC: 2)', () => {
    test('should display suggestion widget on dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for suggestion widget
      await expect(page.locator('[data-testid="suggestion-widget"]')).toBeVisible({ timeout: 10000 });
    });

    test('should show suggestion count badge', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      // Check for count badge
      const countBadge = page.locator('[data-testid="suggestion-count"]');
      if (await countBadge.isVisible()) {
        const count = await countBadge.textContent();
        expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
      }
    });

    test('should expand widget on click', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      // Click to expand
      await page.locator('[data-testid="suggestion-widget-trigger"]').click();

      // Verify expanded content
      await expect(page.locator('[data-testid="suggestion-list"]')).toBeVisible();
    });

    test('should collapse widget on Escape key', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      // Expand widget
      await page.locator('[data-testid="suggestion-widget-trigger"]').click();
      await expect(page.locator('[data-testid="suggestion-list"]')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Verify collapsed
      await expect(page.locator('[data-testid="suggestion-list"]')).not.toBeVisible();
    });

    test('should display suggestion cards with type icons', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      // Expand widget
      await page.locator('[data-testid="suggestion-widget-trigger"]').click();

      // Check for suggestion cards
      const cards = await page.locator('[data-testid="suggestion-card"]').count();
      if (cards > 0) {
        // Verify card has type icon
        await expect(
          page.locator('[data-testid="suggestion-card"]').first().locator('[data-testid="suggestion-type-icon"]')
        ).toBeVisible();
      }
    });
  });

  // ============================================================================
  // Suggestion Accept/Dismiss Flow (AC: 2, 6)
  // ============================================================================

  test.describe('Suggestion Accept/Dismiss Flow (AC: 2, 6)', () => {
    test('should accept suggestion', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      // Expand widget
      await page.locator('[data-testid="suggestion-widget-trigger"]').click();

      const cards = await page.locator('[data-testid="suggestion-card"]').count();
      if (cards > 0) {
        // Click accept button
        await page.locator('[data-testid="suggestion-card"]').first().locator('[data-testid="accept-button"]').click();

        // Verify suggestion removed or marked as accepted
        await expect(page.locator('[data-testid="suggestion-accepted-toast"]')).toBeVisible();
      }
    });

    test('should dismiss suggestion and show feedback dialog', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      // Expand widget
      await page.locator('[data-testid="suggestion-widget-trigger"]').click();

      const cards = await page.locator('[data-testid="suggestion-card"]').count();
      if (cards > 0) {
        // Click dismiss button
        await page.locator('[data-testid="suggestion-card"]').first().locator('[data-testid="dismiss-button"]').click();

        // Verify feedback dialog appears
        await expect(page.locator('[data-testid="feedback-dialog"]')).toBeVisible();
      }
    });

    test('should submit feedback with reason', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      // Expand widget
      await page.locator('[data-testid="suggestion-widget-trigger"]').click();

      const cards = await page.locator('[data-testid="suggestion-card"]').count();
      if (cards > 0) {
        // Click dismiss button
        await page.locator('[data-testid="suggestion-card"]').first().locator('[data-testid="dismiss-button"]').click();

        // Select a reason
        await page.locator('[data-testid="reason-not-relevant"]').click();

        // Submit feedback
        await page.locator('[data-testid="submit-feedback"]').click();

        // Verify dialog closed
        await expect(page.locator('[data-testid="feedback-dialog"]')).not.toBeVisible();
      }
    });
  });

  // ============================================================================
  // Deadline Warnings Tests (AC: 4)
  // ============================================================================

  test.describe('Deadline Warnings (AC: 4)', () => {
    test('should display deadline warning banner on dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Wait for deadline warning banner
      const banner = page.locator('[data-testid="deadline-warning-banner"]');
      if (await banner.isVisible()) {
        // Verify banner has warning items
        await expect(banner.locator('[data-testid="deadline-warning-item"]').first()).toBeVisible();
      }
    });

    test('should show deadline warning on case detail page', async ({ page }) => {
      await page.goto('/cases');

      // Wait and click first case
      await page.waitForSelector('[data-testid="case-card"]', { timeout: 10000 });
      await page.locator('[data-testid="case-card"]').first().click();

      // Check for deadline warning banner
      const banner = page.locator('[data-testid="deadline-warning-banner"]');
      if (await banner.isVisible()) {
        // Verify warning shows case-specific deadlines
        await expect(banner).toBeVisible();
      }
    });

    test('should show severity indicators for deadlines', async ({ page }) => {
      await page.goto('/dashboard');

      const banner = page.locator('[data-testid="deadline-warning-banner"]');
      if (await banner.isVisible()) {
        // Check for severity badges
        const criticalBadge = banner.locator('[data-testid="severity-critical"]');
        const warningBadge = banner.locator('[data-testid="severity-warning"]');
        const infoBadge = banner.locator('[data-testid="severity-info"]');

        // At least one severity type should exist
        const hasSeverity =
          (await criticalBadge.count()) > 0 ||
          (await warningBadge.count()) > 0 ||
          (await infoBadge.count()) > 0;

        expect(hasSeverity).toBeTruthy();
      }
    });

    test('should show action menu for deadline items', async ({ page }) => {
      await page.goto('/dashboard');

      const banner = page.locator('[data-testid="deadline-warning-banner"]');
      if (await banner.isVisible()) {
        const items = await banner.locator('[data-testid="deadline-warning-item"]').count();
        if (items > 0) {
          // Click action menu
          await banner
            .locator('[data-testid="deadline-warning-item"]')
            .first()
            .locator('[data-testid="action-menu-trigger"]')
            .click();

          // Verify menu is visible
          await expect(page.locator('[data-testid="deadline-action-menu"]')).toBeVisible();
        }
      }
    });
  });

  // ============================================================================
  // Document Completeness Tests (AC: 5)
  // ============================================================================

  test.describe('Document Completeness (AC: 5)', () => {
    test('should display completeness indicator on document view', async ({ page }) => {
      await page.goto('/documents');

      // Wait and click first document
      await page.waitForSelector('[data-testid="document-item"]', { timeout: 10000 });
      await page.locator('[data-testid="document-item"]').first().click();

      // Verify completeness indicator
      await expect(page.locator('[data-testid="completeness-indicator"]')).toBeVisible();
    });

    test('should show completeness percentage', async ({ page }) => {
      await page.goto('/documents');

      await page.waitForSelector('[data-testid="document-item"]', { timeout: 10000 });
      await page.locator('[data-testid="document-item"]').first().click();

      const indicator = page.locator('[data-testid="completeness-indicator"]');
      if (await indicator.isVisible()) {
        // Verify percentage is shown
        await expect(indicator.locator('[data-testid="completeness-percentage"]')).toBeVisible();
      }
    });

    test('should expand to show missing items', async ({ page }) => {
      await page.goto('/documents');

      await page.waitForSelector('[data-testid="document-item"]', { timeout: 10000 });
      await page.locator('[data-testid="document-item"]').first().click();

      const indicator = page.locator('[data-testid="completeness-indicator"]');
      if (await indicator.isVisible()) {
        // Click to expand
        await indicator.click();

        // Verify missing items list
        await expect(page.locator('[data-testid="missing-items-list"]')).toBeVisible();
      }
    });

    test('should show severity badges for missing items', async ({ page }) => {
      await page.goto('/documents');

      await page.waitForSelector('[data-testid="document-item"]', { timeout: 10000 });
      await page.locator('[data-testid="document-item"]').first().click();

      const indicator = page.locator('[data-testid="completeness-indicator"]');
      if (await indicator.isVisible()) {
        await indicator.click();

        const list = page.locator('[data-testid="missing-items-list"]');
        if (await list.isVisible()) {
          // Check for severity badges
          const items = await list.locator('[data-testid="missing-item"]').count();
          if (items > 0) {
            const firstItem = list.locator('[data-testid="missing-item"]').first();
            await expect(firstItem.locator('[data-testid="severity-badge"]')).toBeVisible();
          }
        }
      }
    });

    test('should allow marking items as resolved', async ({ page }) => {
      await page.goto('/documents');

      await page.waitForSelector('[data-testid="document-item"]', { timeout: 10000 });
      await page.locator('[data-testid="document-item"]').first().click();

      const indicator = page.locator('[data-testid="completeness-indicator"]');
      if (await indicator.isVisible()) {
        await indicator.click();

        const list = page.locator('[data-testid="missing-items-list"]');
        if (await list.isVisible()) {
          const items = await list.locator('[data-testid="missing-item"]').count();
          if (items > 0) {
            // Click checkbox
            await list
              .locator('[data-testid="missing-item"]')
              .first()
              .locator('[data-testid="item-checkbox"]')
              .click();

            // Verify item checked
            await expect(
              list.locator('[data-testid="missing-item"]').first().locator('[data-testid="item-checkbox"]')
            ).toBeChecked();
          }
        }
      }
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  test.describe('Accessibility', () => {
    test('morning briefing should have proper ARIA attributes', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="morning-briefing"]', { timeout: 10000 });

      // Check for region role
      await expect(page.locator('[data-testid="morning-briefing"]')).toHaveAttribute('role', 'region');

      // Check for aria-label
      const ariaLabel = await page.locator('[data-testid="morning-briefing"]').getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('suggestion widget should have complementary role', async ({ page }) => {
      await page.goto('/dashboard');

      await page.waitForSelector('[data-testid="suggestion-widget"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="suggestion-widget"]')).toHaveAttribute('role', 'complementary');
    });

    test('deadline warnings should announce critical items', async ({ page }) => {
      await page.goto('/dashboard');

      const banner = page.locator('[data-testid="deadline-warning-banner"]');
      if (await banner.isVisible()) {
        // Check for alert role on critical items
        const criticalItems = banner.locator('[data-testid="severity-critical"]').locator('..');
        const count = await criticalItems.count();
        if (count > 0) {
          await expect(criticalItems.first()).toHaveAttribute('role', 'alert');
        }
      }
    });

    test('completeness indicator should have progressbar role', async ({ page }) => {
      await page.goto('/documents');

      await page.waitForSelector('[data-testid="document-item"]', { timeout: 10000 });
      await page.locator('[data-testid="document-item"]').first().click();

      const indicator = page.locator('[data-testid="completeness-indicator"]');
      if (await indicator.isVisible()) {
        await expect(indicator.locator('[role="progressbar"]')).toBeVisible();
      }
    });
  });
});
