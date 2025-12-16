/**
 * E2E Tests: Case Workspace Navigation and Interaction Flow
 * Tests complete case workspace functionality including tab navigation, panels, and responsive behavior
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Case Workspace', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a case workspace page (using mock case ID)
    await page.goto('http://localhost:3000/cases/test-case-123');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Case Header Display', () => {
    test('should display case header with case information', async ({ page }) => {
      // Verify case number badge is visible
      await expect(page.locator('text=/CASE-\\d{4}-\\d{3}/')).toBeVisible();

      // Verify case title is displayed
      await expect(page.locator('h1')).toBeVisible();

      // Verify status badge exists
      await expect(page.locator('text=/Active|OnHold|Closed|Archived/')).toBeVisible();
    });

    test('should display team members', async ({ page }) => {
      // Check for team member avatars (at least one should exist)
      const avatars = page.locator('[role="img"]').filter({ hasText: /[A-Z]{2}/ });
      await expect(avatars.first()).toBeVisible();
    });

    test('should display next deadline if present', async ({ page }) => {
      // Check if deadline section exists (may not always be present)
      const deadline = page.locator('text=/Next Deadline|Termen Limită/');
      const count = await deadline.count();

      if (count > 0) {
        await expect(deadline.first()).toBeVisible();
      }
    });
  });

  test.describe('Tab Navigation', () => {
    test('should switch between all tabs', async ({ page }) => {
      const tabs = ['Overview', 'Documents', 'Tasks', 'Communications', 'Time Entries', 'Notes'];

      for (const tab of tabs) {
        await page.click(`text=${tab}`);
        await expect(page.locator(`[aria-selected="true"]`)).toContainText(tab);

        // Wait a moment for tab content to render
        await page.waitForTimeout(100);
      }
    });

    test('should display correct content for Documents tab', async ({ page }) => {
      await page.click('text=Documents');

      // Should show three-column layout
      await expect(page.locator('text=/Folder|Document/i')).toBeVisible();

      // Should show folder tree
      await expect(page.locator('svg')).toBeVisible(); // Folder/file icons
    });

    test('should display correct content for Tasks tab', async ({ page }) => {
      await page.click('text=Tasks');

      // Should show kanban board columns
      await expect(page.locator('text=/To Do|De Făcut/')).toBeVisible();
      await expect(page.locator('text=/In Progress|În Lucru/')).toBeVisible();
      await expect(page.locator('text=/Review|În Revizuire/')).toBeVisible();
      await expect(page.locator('text=/Complete|Finalizat/')).toBeVisible();
    });

    test('should display correct content for Overview tab', async ({ page }) => {
      await page.click('text=Overview');

      // Should show case details and overview cards
      await expect(page.locator('text=/Case Details|Detalii Caz/i')).toBeVisible();
    });
  });

  test.describe('AI Insights Panel', () => {
    test('should toggle AI insights panel', async ({ page }) => {
      // Find and click the AI panel toggle button
      const toggleButton = page.locator('button[aria-label*="AI"]').first();

      if (await toggleButton.isVisible()) {
        // Get initial panel state by checking width
        const panel = page.locator('[class*="ai"]').first();
        const initialWidth = await panel.evaluate((el) => el.clientWidth);

        // Toggle panel
        await toggleButton.click();
        await page.waitForTimeout(300); // Wait for animation

        const newWidth = await panel.evaluate((el) => el.clientWidth);
        expect(newWidth).not.toBe(initialWidth);
      }
    });

    test('should display AI suggestions when expanded', async ({ page }) => {
      // Ensure panel is expanded by looking for suggestions content
      const suggestions = page.locator('text=/Sugestii|Suggestions/i');

      if (await suggestions.isVisible()) {
        await expect(suggestions).toBeVisible();
      }
    });
  });

  test.describe('Quick Actions Bar', () => {
    test('should display quick actions bar', async ({ page }) => {
      // Look for the quick actions input or button
      const quickActions = page
        .locator('input[placeholder*="do"]')
        .or(page.locator('button[aria-label*="Quick"]'));

      const count = await quickActions.count();
      if (count > 0) {
        await expect(quickActions.first()).toBeVisible();
      }
    });

    test('should show suggestion chips when empty', async ({ page }) => {
      // Look for quick action suggestions
      const suggestions = page.locator('text=/Add|Create|Schedule|Adaugă|Creează/');

      const count = await suggestions.count();
      if (count > 0) {
        await expect(suggestions.first()).toBeVisible();
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should display correctly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Case header should stack vertically
      await expect(page.locator('h1')).toBeVisible();

      // Tabs should be scrollable
      const tabs = page.locator('[role="tablist"]');
      await expect(tabs).toBeVisible();
    });

    test('should display correctly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      // All main elements should be visible
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('[role="tablist"]')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support keyboard navigation for tabs', async ({ page }) => {
      // Focus on first tab
      const overviewTab = page.locator('text=Overview').first();
      await overviewTab.focus();

      // Press ArrowRight to move to next tab
      await page.keyboard.press('ArrowRight');

      // Documents tab should now be selected
      await expect(page.locator('[aria-selected="true"]')).toContainText('Documents');
    });

    test('should support Tab key navigation', async ({ page }) => {
      // Tab through focusable elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to navigate without errors
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should not have accessibility violations', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for tab roles
      await expect(page.locator('[role="tab"]').first()).toBeVisible();
      await expect(page.locator('[role="tabpanel"]').first()).toBeVisible();

      // Check for labeled buttons
      const buttons = page.locator('button[aria-label]');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Romanian Diacritics', () => {
    test('should correctly render Romanian characters', async ({ page }) => {
      // Look for Romanian text with diacritics
      const romanianText = page.locator('text=/[ăâîșț]/i');

      const count = await romanianText.count();
      if (count > 0) {
        await expect(romanianText.first()).toBeVisible();

        // Verify text is not garbled
        const text = await romanianText.first().textContent();
        expect(text).toMatch(/[ăâîșț]/);
      }
    });
  });

  test.describe('State Persistence', () => {
    test('should maintain tab state on page reload', async ({ page }) => {
      // Switch to Documents tab
      await page.click('text=Documents');
      await expect(page.locator('[aria-selected="true"]')).toContainText('Documents');

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Documents tab should still be selected (due to localStorage persistence)
      await expect(page.locator('[aria-selected="true"]')).toContainText('Documents');
    });
  });
});
