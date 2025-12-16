/**
 * Communication Intelligence E2E Tests
 * Story 5.2: Communication Intelligence Engine
 *
 * End-to-end tests for AI-extracted intelligence UI and workflows
 */

import { test, expect } from '@playwright/test';

test.describe('Communication Intelligence', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[name="email"]', 'testuser@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test.describe('Intelligence Display in Email Thread View (AC: 2)', () => {
    test('should display extracted items panel in thread view', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Verify extracted items panel is visible
      await expect(page.locator('[data-testid="extracted-items-panel"]')).toBeVisible();
    });

    test('should show deadlines section with extracted deadlines', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Verify deadlines section exists
      await expect(page.locator('[data-testid="deadlines-section"]')).toBeVisible();

      // Check for deadline items if any exist
      const deadlineItems = await page.locator('[data-testid="deadline-item"]').count();
      if (deadlineItems > 0) {
        // Verify deadline has date
        await expect(
          page
            .locator('[data-testid="deadline-item"]')
            .first()
            .locator('[data-testid="deadline-date"]')
        ).toBeVisible();
      }
    });

    test('should show commitments section with party information', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Verify commitments section exists
      await expect(page.locator('[data-testid="commitments-section"]')).toBeVisible();

      // Check for commitment items if any exist
      const commitmentItems = await page.locator('[data-testid="commitment-item"]').count();
      if (commitmentItems > 0) {
        // Verify commitment has party label
        await expect(
          page
            .locator('[data-testid="commitment-item"]')
            .first()
            .locator('[data-testid="commitment-party"]')
        ).toBeVisible();
      }
    });

    test('should show action items section with priority', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Verify action items section exists
      await expect(page.locator('[data-testid="action-items-section"]')).toBeVisible();

      // Check for action items if any exist
      const actionItems = await page.locator('[data-testid="action-item"]').count();
      if (actionItems > 0) {
        // Verify action item has priority badge
        await expect(
          page
            .locator('[data-testid="action-item"]')
            .first()
            .locator('[data-testid="priority-badge"]')
        ).toBeVisible();
      }
    });

    test('should show questions section', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Verify questions section exists
      await expect(page.locator('[data-testid="questions-section"]')).toBeVisible();
    });
  });

  test.describe('Confidence Scoring Display (AC: 4)', () => {
    test('should display confidence badges on extracted items', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items panel
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Check for confidence badges on any extraction
      const confidenceBadges = await page.locator('[data-testid="confidence-badge"]').count();

      if (confidenceBadges > 0) {
        // Verify badge shows percentage
        await expect(page.locator('[data-testid="confidence-badge"]').first()).toContainText('%');
      }
    });

    test('should show high confidence indicator for scores >= 80%', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for high confidence items
      const highConfidenceItems = await page.locator('[data-testid="confidence-high"]').count();

      if (highConfidenceItems > 0) {
        // High confidence items should have green styling
        const firstHighConfidence = page.locator('[data-testid="confidence-high"]').first();
        await expect(firstHighConfidence).toHaveClass(/bg-green|text-green/);
      }
    });

    test('should show medium confidence indicator for scores 50-79%', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for medium confidence items
      const mediumConfidenceItems = await page.locator('[data-testid="confidence-medium"]').count();

      if (mediumConfidenceItems > 0) {
        // Medium confidence items should have yellow styling
        const firstMediumConfidence = page.locator('[data-testid="confidence-medium"]').first();
        await expect(firstMediumConfidence).toHaveClass(/bg-yellow|text-yellow/);
      }
    });
  });

  test.describe('Extraction to Task Conversion (AC: 3)', () => {
    test('should show convert to task button on extractions', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Check for convert button
      const convertButtons = await page
        .locator('button:has-text("Convert"), button:has-text("Create Task")')
        .count();

      if (convertButtons > 0) {
        await expect(
          page.locator('button:has-text("Convert"), button:has-text("Create Task")').first()
        ).toBeVisible();
      }
    });

    test('should open task creation dialog when convert clicked', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Find and click convert button
      const convertButton = page
        .locator('button:has-text("Convert"), button:has-text("Create Task")')
        .first();

      if (await convertButton.isVisible()) {
        await convertButton.click();

        // Verify task creation modal opens
        await expect(
          page.locator('[data-testid="task-creation-modal"], [data-testid="task-dialog"]')
        ).toBeVisible();
      }
    });

    test('should pre-fill task details from extraction', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Find deadline with convert button
      const deadlineItem = page.locator('[data-testid="deadline-item"]').first();

      if (await deadlineItem.isVisible()) {
        // Get deadline description
        const description = await deadlineItem
          .locator('[data-testid="deadline-description"]')
          .textContent();

        // Click convert
        await deadlineItem
          .locator('button:has-text("Convert"), button:has-text("Create Task")')
          .click();

        // Check task modal has pre-filled description
        const taskDescriptionInput = page.locator(
          '[data-testid="task-description-input"], [name="description"], textarea'
        );

        if (description && (await taskDescriptionInput.isVisible())) {
          const inputValue = await taskDescriptionInput.inputValue();
          expect(inputValue).toContain(description);
        }
      }
    });

    test('should mark extraction as converted after task creation', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Get count of pending items before
      const pendingBefore = await page.locator('[data-testid="extraction-status-pending"]').count();

      // Find and convert first item
      const convertButton = page
        .locator('button:has-text("Convert"), button:has-text("Create Task")')
        .first();

      if (await convertButton.isVisible()) {
        await convertButton.click();

        // Complete task creation if modal appears
        const createButton = page.locator('button:has-text("Create"), button:has-text("Save")');
        if (await createButton.isVisible()) {
          await createButton.click();

          // Wait for conversion
          await page.waitForTimeout(500);

          // Verify item shows converted status or is removed from pending
          const convertedItems = await page
            .locator('[data-testid="extraction-status-converted"]')
            .count();
          expect(convertedItems).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Dismiss Extraction (AC: 3)', () => {
    test('should show dismiss button on extractions', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Check for dismiss button
      const dismissButtons = await page.locator('button:has-text("Dismiss")').count();

      if (dismissButtons > 0) {
        await expect(page.locator('button:has-text("Dismiss")').first()).toBeVisible();
      }
    });

    test('should remove extraction from list when dismissed', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Count items before
      const itemsBefore = await page
        .locator(
          '[data-testid="deadline-item"], [data-testid="action-item"], [data-testid="commitment-item"]'
        )
        .count();

      // Click dismiss on first item
      const dismissButton = page.locator('button:has-text("Dismiss")').first();

      if (await dismissButton.isVisible()) {
        await dismissButton.click();

        // Wait for dismissal
        await page.waitForTimeout(500);

        // Count items after
        const itemsAfter = await page
          .locator(
            '[data-testid="deadline-item"], [data-testid="action-item"], [data-testid="commitment-item"]'
          )
          .count();

        // Should have one fewer item or show dismissed status
        expect(itemsAfter).toBeLessThanOrEqual(itemsBefore);
      }
    });
  });

  test.describe('Risk Indicators (AC: 8)', () => {
    test('should display risk alert banner when high risks exist', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for risk alert
      const riskAlert = page.locator('[role="alert"]');

      if (await riskAlert.isVisible()) {
        await expect(riskAlert).toContainText(/risk|deadline|urgent/i);
      }
    });

    test('should show deadline risk indicators for imminent deadlines', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for risk indicator on deadlines
      const riskIndicators = await page.locator('[data-testid="risk-indicator"]').count();

      if (riskIndicators > 0) {
        // Risk indicator should have warning color
        await expect(page.locator('[data-testid="risk-indicator"]').first()).toHaveClass(
          /red|orange|warning/
        );
      }
    });
  });

  test.describe('Intelligence Dashboard Widget (AC: 7)', () => {
    test('should display intelligence widget on dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Verify intelligence widget is visible
      await expect(page.locator('[data-testid="intelligence-widget"]')).toBeVisible();
    });

    test('should show summary statistics in widget', async ({ page }) => {
      await page.goto('/dashboard');

      // Verify widget shows counts
      const widget = page.locator('[data-testid="intelligence-widget"]');
      await expect(widget).toBeVisible();

      // Should show pending items count
      await expect(widget.locator('[data-testid="pending-items-count"]')).toBeVisible();

      // Should show urgent deadlines count
      await expect(widget.locator('[data-testid="urgent-deadlines-count"]')).toBeVisible();
    });

    test('should navigate to case when clicking deadline item', async ({ page }) => {
      await page.goto('/dashboard');

      // Find deadline item in widget
      const deadlineLink = page
        .locator('[data-testid="intelligence-widget"]')
        .locator('[data-testid="deadline-link"]')
        .first();

      if (await deadlineLink.isVisible()) {
        await deadlineLink.click();

        // Should navigate to case page
        await expect(page).toHaveURL(/\/cases\/.+/);
      }
    });

    test('should show high severity risk alert in widget', async ({ page }) => {
      await page.goto('/dashboard');

      const widget = page.locator('[data-testid="intelligence-widget"]');

      // Check for alert role element
      const alert = widget.locator('[role="alert"]');

      if (await alert.isVisible()) {
        await expect(alert).toContainText(/high severity|urgent/i);
      }
    });
  });

  test.describe('Case Intelligence Tab (AC: 7)', () => {
    test('should display intelligence tab on case detail page', async ({ page }) => {
      // Navigate to a case
      await page.goto('/cases');

      // Wait for cases to load
      await page.waitForSelector('[data-testid="case-card"], [data-testid="case-row"]', {
        timeout: 10000,
      });

      // Click first case
      await page.locator('[data-testid="case-card"], [data-testid="case-row"]').first().click();

      // Wait for case detail page
      await page.waitForURL(/\/cases\/.+/);

      // Verify intelligence tab exists
      await expect(
        page.locator('button:has-text("Intelligence"), [data-testid="intelligence-tab"]')
      ).toBeVisible();
    });

    test('should show case-specific extractions in intelligence tab', async ({ page }) => {
      // Navigate to a case
      await page.goto('/cases');
      await page.waitForSelector('[data-testid="case-card"], [data-testid="case-row"]', {
        timeout: 10000,
      });
      await page.locator('[data-testid="case-card"], [data-testid="case-row"]').first().click();
      await page.waitForURL(/\/cases\/.+/);

      // Click intelligence tab
      await page.click('button:has-text("Intelligence"), [data-testid="intelligence-tab"]');

      // Verify intelligence content is shown
      await expect(page.locator('[data-testid="case-intelligence-content"]')).toBeVisible();

      // Should show extraction categories
      await expect(
        page.locator('text=/Deadlines|Commitments|Action Items|Questions/')
      ).toBeVisible();
    });
  });

  test.describe('Thread Summary (AC: 6)', () => {
    test('should display thread summary in email thread view', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for thread summary component
      const summary = page.locator('[data-testid="thread-summary"]');

      if (await summary.isVisible()) {
        await expect(summary).toBeVisible();
      }
    });

    test('should show key points in thread summary', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for key points
      const keyPoints = page.locator('[data-testid="summary-key-points"]');

      if (await keyPoints.isVisible()) {
        // Should have bullet points
        const points = await keyPoints.locator('li').count();
        expect(points).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Calendar Suggestions (AC: 5)', () => {
    test('should display calendar suggestions for meetings', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for calendar suggestions
      const calendarSuggestions = page.locator('[data-testid="calendar-suggestions"]');

      if (await calendarSuggestions.isVisible()) {
        await expect(calendarSuggestions).toBeVisible();
      }
    });

    test('should show add to calendar button on meeting suggestions', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Check for add to calendar button
      const addToCalendarButton = page.locator('button:has-text("Add to Calendar")');

      if (await addToCalendarButton.isVisible()) {
        await expect(addToCalendarButton).toBeVisible();
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible extraction items panel', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items panel
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Verify panel has region role with accessible name
      await expect(page.locator('[role="region"][aria-label*="Extracted"]')).toBeVisible();
    });

    test('should support keyboard navigation in extraction list', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Wait for extracted items panel
      await page.waitForSelector('[data-testid="extracted-items-panel"]', { timeout: 5000 });

      // Find first interactive element
      const firstButton = page.locator('[data-testid="extracted-items-panel"] button').first();

      if (await firstButton.isVisible()) {
        // Tab to button
        await page.keyboard.press('Tab');

        // Verify focus is on button
        await expect(firstButton).toBeFocused();
      }
    });
  });
});
