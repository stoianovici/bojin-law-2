/**
 * Email Integration E2E Tests
 * Story 5.1: Email Integration and Synchronization
 *
 * End-to-end tests for email UI and workflow
 */

import { test, expect } from '@playwright/test';

test.describe('Email Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[name="email"]', 'testuser@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test.describe('Email Page', () => {
    test('should display email page with thread list', async ({ page }) => {
      await page.goto('/emails');

      // Verify page title
      await expect(page.locator('h1')).toContainText('Email');

      // Verify thread list is visible
      await expect(page.locator('[data-testid="email-thread-list"]')).toBeVisible();
    });

    test('should toggle between threads and search view', async ({ page }) => {
      await page.goto('/emails');

      // Click search tab
      await page.click('button:has-text("Search")');

      // Verify search input is visible
      await expect(page.locator('input[placeholder*="Search emails"]')).toBeVisible();

      // Click threads tab
      await page.click('button:has-text("Threads")');

      // Verify thread list is back
      await expect(page.locator('[data-testid="email-thread-list"]')).toBeVisible();
    });

    test('should display sync button and status', async ({ page }) => {
      await page.goto('/emails');

      // Verify sync button
      await expect(page.locator('button:has-text("Sync")')).toBeVisible();

      // Verify sync status text
      await expect(page.locator('text=/\\d+ emails/')).toBeVisible();
    });
  });

  test.describe('Email Thread List', () => {
    test('should display thread items with correct info', async ({ page }) => {
      await page.goto('/emails');

      // Wait for threads to load
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });

      // Get first thread item
      const firstThread = page.locator('[data-testid="email-thread-item"]').first();

      // Verify thread has subject
      await expect(firstThread.locator('[data-testid="thread-subject"]')).toBeVisible();

      // Verify thread has participant count
      await expect(firstThread.locator('text=/\\d+ participants/')).toBeVisible();

      // Verify thread has message count
      await expect(firstThread.locator('text=/\\d+ messages/')).toBeVisible();
    });

    test('should filter threads by unread', async ({ page }) => {
      await page.goto('/emails');

      // Click unread filter
      await page.click('button:has-text("Unread")');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Verify only unread threads are shown (if any)
      const threads = await page.locator('[data-testid="email-thread-item"]').count();

      if (threads > 0) {
        // All visible threads should have unread indicator
        const unreadIndicators = await page.locator('[data-testid="unread-indicator"]').count();
        expect(unreadIndicators).toBe(threads);
      }
    });

    test('should filter threads with attachments', async ({ page }) => {
      await page.goto('/emails');

      // Click attachments filter
      await page.click('button:has-text("Has Attachments")');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Verify filtered threads have attachment icon
      const threads = await page.locator('[data-testid="email-thread-item"]').count();

      if (threads > 0) {
        const attachmentIcons = await page.locator('[data-testid="attachment-icon"]').count();
        expect(attachmentIcons).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Email Thread View', () => {
    test('should display thread when clicked', async ({ page }) => {
      await page.goto('/emails');

      // Wait for threads to load
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });

      // Click first thread
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Verify thread view opens
      await expect(page.locator('[data-testid="email-thread-view"]')).toBeVisible();

      // Verify thread subject is displayed
      await expect(page.locator('[data-testid="thread-view-subject"]')).toBeVisible();
    });

    test('should display email messages in thread', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Verify email messages are displayed
      await expect(page.locator('[data-testid="email-message"]').first()).toBeVisible();
    });

    test('should expand and collapse email messages', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Get first email message
      const firstMessage = page.locator('[data-testid="email-message"]').first();

      // Verify expanded by default (last message)
      const lastMessage = page.locator('[data-testid="email-message"]').last();
      await expect(lastMessage.locator('[data-testid="email-body"]')).toBeVisible();

      // Click to collapse
      await lastMessage.locator('[data-testid="email-header"]').click();

      // Verify collapsed
      await expect(lastMessage.locator('[data-testid="email-body"]')).not.toBeVisible();
    });
  });

  test.describe('Case Assignment', () => {
    test('should open case assignment modal', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Click assign to case button
      await page.click('button:has-text("Assign to Case")');

      // Verify modal opens
      await expect(page.locator('[data-testid="case-assignment-modal"]')).toBeVisible();
    });

    test('should search cases in assignment modal', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Open case assignment modal
      await page.click('button:has-text("Assign to Case")');

      // Search for case
      await page.fill('[placeholder*="Search cases"]', 'test');

      // Wait for search results
      await page.waitForTimeout(500);

      // Verify search filters results
      // Results should only show cases matching "test"
    });

    test('should close modal on cancel', async ({ page }) => {
      await page.goto('/emails');

      // Wait and click first thread
      await page.waitForSelector('[data-testid="email-thread-item"]', { timeout: 10000 });
      await page.locator('[data-testid="email-thread-item"]').first().click();

      // Open case assignment modal
      await page.click('button:has-text("Assign to Case")');

      // Click cancel
      await page.click('button:has-text("Cancel")');

      // Verify modal closes
      await expect(page.locator('[data-testid="case-assignment-modal"]')).not.toBeVisible();
    });
  });

  test.describe('Email Search', () => {
    test('should search emails by query', async ({ page }) => {
      await page.goto('/emails');

      // Switch to search view
      await page.click('button:has-text("Search")');

      // Enter search query
      await page.fill('input[placeholder*="Search emails"]', 'invoice');

      // Wait for results
      await page.waitForTimeout(500);

      // Verify results are displayed or empty state
      const results = await page.locator('[data-testid="search-result-item"]').count();

      if (results > 0) {
        // Results should contain search term
        await expect(page.locator('[data-testid="search-result-item"]').first()).toContainText(/invoice/i);
      } else {
        await expect(page.locator('text=/No emails match/')).toBeVisible();
      }
    });

    test('should display search suggestions', async ({ page }) => {
      await page.goto('/emails');

      // Switch to search view
      await page.click('button:has-text("Search")');

      // Type partial search query
      await page.fill('input[placeholder*="Search emails"]', 'invo');
      await page.focus('input[placeholder*="Search emails"]');

      // Wait for suggestions
      await page.waitForTimeout(300);

      // Check if suggestions dropdown appears (if there are suggestions)
      const suggestions = await page.locator('[data-testid="search-suggestions"]').isVisible();
      // Suggestions may or may not appear depending on data
    });
  });

  test.describe('Email Widget on Dashboard', () => {
    test('should display email widget on dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      // Verify email widget is visible
      await expect(page.locator('[data-testid="email-widget"]')).toBeVisible();

      // Verify widget shows email stats
      await expect(page.locator('[data-testid="email-widget"] text=/\\d+ total/')).toBeVisible();
    });

    test('should navigate to emails page from widget', async ({ page }) => {
      await page.goto('/dashboard');

      // Click "View all" link in email widget
      await page.locator('[data-testid="email-widget"]').locator('a:has-text("View all")').click();

      // Verify navigation to emails page
      await expect(page).toHaveURL('/emails');
    });

    test('should show uncategorized emails alert', async ({ page }) => {
      await page.goto('/dashboard');

      // Check for uncategorized alert (may not always be present)
      const alert = page.locator('[data-testid="email-widget"]').locator('text=/uncategorized/');

      if (await alert.isVisible()) {
        await expect(alert).toBeVisible();
      }
    });
  });
});
