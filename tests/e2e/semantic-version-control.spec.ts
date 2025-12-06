/**
 * Semantic Version Control E2E Tests
 * Story 3.5: Semantic Version Control System - Task 17
 *
 * End-to-end tests for version comparison, semantic diff, and response suggestions.
 */

import { test, expect, Page } from '@playwright/test';

// Test fixtures
const TEST_CASE_ID = 'test-case-123';
const TEST_DOCUMENT_ID = 'test-doc-123';

// Helper functions
async function login(page: Page) {
  // Navigate to login page and authenticate
  await page.goto('/auth/signin');
  await page.fill('[data-testid="email-input"]', 'test.associate@example.com');
  await page.click('[data-testid="login-button"]');
  // Wait for Azure AD redirect (mocked in test environment)
  await page.waitForURL(/\/dashboard|\/cases/);
}

async function navigateToDocumentDetail(page: Page, caseId: string, documentId: string) {
  await page.goto(`/cases/${caseId}/documents/${documentId}`);
  await page.waitForSelector('[data-testid="document-detail"]');
}

async function navigateToVersionComparison(
  page: Page,
  caseId: string,
  documentId: string,
  fromVersionId: string,
  toVersionId: string
) {
  await page.goto(
    `/cases/${caseId}/documents/${documentId}/compare?from=${fromVersionId}&to=${toVersionId}`
  );
  await page.waitForSelector('[data-testid="version-comparison"]');
}

test.describe('Semantic Version Control', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.describe('Document Detail Page', () => {
    test('should display document details with version history tab', async ({ page }) => {
      await navigateToDocumentDetail(page, TEST_CASE_ID, TEST_DOCUMENT_ID);

      // Check document header
      await expect(page.locator('[data-testid="document-filename"]')).toBeVisible();

      // Check tabs exist
      await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="tab-versions"]')).toBeVisible();
    });

    test('should show version timeline when clicking versions tab', async ({ page }) => {
      await navigateToDocumentDetail(page, TEST_CASE_ID, TEST_DOCUMENT_ID);

      // Click versions tab
      await page.click('[data-testid="tab-versions"]');

      // Check version timeline is displayed
      await expect(page.locator('[data-testid="version-timeline"]')).toBeVisible();
    });

    test('should show Compare Latest button when multiple versions exist', async ({ page }) => {
      await navigateToDocumentDetail(page, TEST_CASE_ID, TEST_DOCUMENT_ID);

      // Check for Compare Latest button (only visible with 2+ versions)
      const compareButton = page.locator('[data-testid="compare-latest-button"]');
      // Button visibility depends on version count, so we check it exists
      await expect(compareButton).toBeAttached();
    });
  });

  test.describe('Version Timeline', () => {
    test('should display list of document versions', async ({ page }) => {
      await navigateToDocumentDetail(page, TEST_CASE_ID, TEST_DOCUMENT_ID);
      await page.click('[data-testid="tab-versions"]');

      // Check for version items
      const versionItems = page.locator('[data-testid="version-item"]');
      await expect(versionItems.first()).toBeVisible();
    });

    test('should allow selecting two versions for comparison', async ({ page }) => {
      await navigateToDocumentDetail(page, TEST_CASE_ID, TEST_DOCUMENT_ID);
      await page.click('[data-testid="tab-versions"]');

      // Select first version
      const versionItems = page.locator('[data-testid="version-select-dot"]');
      await versionItems.first().click();

      // Select second version
      await versionItems.nth(1).click();

      // Check Compare Selected button is enabled
      const compareButton = page.locator('[data-testid="compare-selected-button"]');
      await expect(compareButton).toBeEnabled();
    });

    test('should show rollback option in version menu', async ({ page }) => {
      await navigateToDocumentDetail(page, TEST_CASE_ID, TEST_DOCUMENT_ID);
      await page.click('[data-testid="tab-versions"]');

      // Open version menu (not for current version)
      const versionMenuButtons = page.locator('[data-testid="version-menu-button"]');
      if ((await versionMenuButtons.count()) > 1) {
        await versionMenuButtons.nth(1).click();

        // Check rollback option exists
        await expect(page.locator('[data-testid="rollback-option"]')).toBeVisible();
      }
    });

    test('should show rollback confirmation dialog', async ({ page }) => {
      await navigateToDocumentDetail(page, TEST_CASE_ID, TEST_DOCUMENT_ID);
      await page.click('[data-testid="tab-versions"]');

      const versionMenuButtons = page.locator('[data-testid="version-menu-button"]');
      if ((await versionMenuButtons.count()) > 1) {
        await versionMenuButtons.nth(1).click();
        await page.click('[data-testid="rollback-option"]');

        // Check confirmation dialog
        await expect(page.locator('[data-testid="rollback-dialog"]')).toBeVisible();
        await expect(page.locator('[data-testid="rollback-confirm-button"]')).toBeVisible();
      }
    });
  });

  test.describe('Version Comparison Page', () => {
    test('should display semantic diff viewer', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Check diff viewer is displayed
      await expect(page.locator('[data-testid="semantic-diff-viewer"]')).toBeVisible();
    });

    test('should display change summary panel', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Check summary panel
      await expect(page.locator('[data-testid="change-summary-panel"]')).toBeVisible();
    });

    test('should show aggregate risk badge', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Check risk badge is displayed
      await expect(page.locator('[data-testid="aggregate-risk-badge"]')).toBeVisible();
    });

    test('should allow filtering changes by significance', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Open significance filter
      await page.click('[data-testid="significance-filter"]');

      // Select Critical Only
      await page.click('[data-testid="filter-critical"]');

      // Check filter is applied
      await expect(page.locator('[data-testid="significance-filter"]')).toContainText(
        'Critical'
      );
    });

    test('should toggle formatting changes visibility', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Check formatting toggle exists
      const formattingToggle = page.locator('[data-testid="formatting-toggle"]');
      await expect(formattingToggle).toBeVisible();

      // Click to toggle
      await formattingToggle.click();

      // Check toggle state changed
      await expect(formattingToggle).toHaveAttribute('data-state', 'checked');
    });

    test('should navigate between changes', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Check navigation buttons
      const prevButton = page.locator('[data-testid="prev-change-button"]');
      const nextButton = page.locator('[data-testid="next-change-button"]');

      await expect(prevButton).toBeVisible();
      await expect(nextButton).toBeVisible();

      // Check change counter
      await expect(page.locator('[data-testid="change-counter"]')).toBeVisible();
    });

    test('should display change details on click', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Click on a change
      const changeItem = page.locator('[data-testid="change-item"]').first();
      if (await changeItem.isVisible()) {
        await changeItem.click();

        // Check change is highlighted
        await expect(changeItem).toHaveClass(/ring-2|selected/);
      }
    });
  });

  test.describe('Response Suggestions', () => {
    test('should show response suggestion panel when change is selected', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Select a change
      const changeItem = page.locator('[data-testid="change-item"]').first();
      if (await changeItem.isVisible()) {
        await changeItem.click();

        // Check response panel opens
        await expect(page.locator('[data-testid="response-suggestion-panel"]')).toBeVisible();
      }
    });

    test('should allow generating AI suggestions', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Select a change
      const changeItem = page.locator('[data-testid="change-item"]').first();
      if (await changeItem.isVisible()) {
        await changeItem.click();

        // Click generate suggestions button
        const generateButton = page.locator('[data-testid="generate-suggestions-button"]');
        await generateButton.click();

        // Wait for loading to complete
        await page.waitForSelector('[data-testid="suggestion-item"]', { timeout: 30000 });

        // Check suggestions are displayed
        await expect(page.locator('[data-testid="suggestion-item"]')).toBeVisible();
      }
    });

    test('should allow selecting party role for suggestions', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Select a change
      const changeItem = page.locator('[data-testid="change-item"]').first();
      if (await changeItem.isVisible()) {
        await changeItem.click();

        // Check party role selector
        const partySelector = page.locator('[data-testid="party-role-selector"]');
        await expect(partySelector).toBeVisible();

        // Open and select opposing
        await partySelector.click();
        await page.click('[data-testid="role-opposing"]');

        // Verify selection
        await expect(partySelector).toContainText('Opposing');
      }
    });

    test('should allow selecting language for suggestions', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Select a change
      const changeItem = page.locator('[data-testid="change-item"]').first();
      if (await changeItem.isVisible()) {
        await changeItem.click();

        // Check language selector
        const languageSelector = page.locator('[data-testid="language-selector"]');
        await expect(languageSelector).toBeVisible();

        // Open and select English
        await languageSelector.click();
        await page.click('[data-testid="language-en"]');

        // Verify selection
        await expect(languageSelector).toContainText('English');
      }
    });

    test('should copy suggestion to clipboard', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Select a change and generate suggestions
      const changeItem = page.locator('[data-testid="change-item"]').first();
      if (await changeItem.isVisible()) {
        await changeItem.click();
        await page.click('[data-testid="generate-suggestions-button"]');
        await page.waitForSelector('[data-testid="suggestion-item"]', { timeout: 30000 });

        // Expand first suggestion
        await page.click('[data-testid="suggestion-item"]');

        // Click copy button
        await page.click('[data-testid="copy-suggestion-button"]');

        // Check for success indicator
        await expect(page.locator('[data-testid="copy-success"]')).toBeVisible();
      }
    });
  });

  test.describe('Change Summary Panel', () => {
    test('should display executive summary', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      await expect(page.locator('[data-testid="executive-summary"]')).toBeVisible();
    });

    test('should display change breakdown chart', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      await expect(page.locator('[data-testid="change-breakdown-chart"]')).toBeVisible();
    });

    test('should display change counts by significance', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Check significance count badges
      await expect(page.locator('[data-testid="critical-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="substantive-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="minor-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="formatting-count"]')).toBeVisible();
    });

    test('should group changes by significance level', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Check collapsible sections
      const criticalSection = page.locator('[data-testid="section-critical"]');
      const substantiveSection = page.locator('[data-testid="section-substantive"]');

      // Critical and substantive should be expanded by default
      if (await criticalSection.isVisible()) {
        await expect(criticalSection).toHaveAttribute('data-state', 'open');
      }
    });

    test('should allow toggling summary panel visibility', async ({ page }) => {
      await navigateToVersionComparison(
        page,
        TEST_CASE_ID,
        TEST_DOCUMENT_ID,
        'version-1',
        'version-2'
      );

      // Find toggle button
      const toggleButton = page.locator('[data-testid="toggle-summary-panel"]');
      await expect(toggleButton).toBeVisible();

      // Click to hide
      await toggleButton.click();

      // Check panel is hidden
      await expect(page.locator('[data-testid="change-summary-panel"]')).toBeHidden();

      // Click to show again
      await toggleButton.click();

      // Check panel is visible
      await expect(page.locator('[data-testid="change-summary-panel"]')).toBeVisible();
    });
  });

  test.describe('Access Control', () => {
    test('should restrict version comparison to Associates and Partners', async ({ page }) => {
      // Login as Paralegal
      await page.goto('/auth/signin');
      await page.fill('[data-testid="email-input"]', 'test.paralegal@example.com');
      await page.click('[data-testid="login-button"]');
      await page.waitForURL(/\/dashboard|\/cases/);

      // Try to access version comparison
      await page.goto(
        `/cases/${TEST_CASE_ID}/documents/${TEST_DOCUMENT_ID}/compare?from=v1&to=v2`
      );

      // Should see access denied or redirect
      await expect(
        page.locator('[data-testid="access-denied"]').or(page.locator('[data-testid="document-detail"]'))
      ).toBeVisible();
    });
  });
});
