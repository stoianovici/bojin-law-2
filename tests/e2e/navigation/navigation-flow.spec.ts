/**
 * E2E Tests: Navigation Flow
 * Tests complete navigation workflows including role switching and section navigation
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
  });

  test('should navigate to each section and verify active state', async ({ page }) => {
    // Dashboard (default)
    await expect(page.locator('[aria-current="page"]')).toContainText('Dashboard');

    // Navigate to Cases
    await page.click('text=Cazuri');
    await expect(page).toHaveURL(/\/cases/);
    await expect(page.locator('[aria-current="page"]')).toContainText('Cazuri');

    // Navigate to Documents
    await page.click('text=Documente');
    await expect(page).toHaveURL(/\/documents/);
    await expect(page.locator('[aria-current="page"]')).toContainText('Documente');

    // Navigate to Tasks
    await page.click('text=Sarcini');
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.locator('[aria-current="page"]')).toContainText('Sarcini');

    // Navigate to Communications
    await page.click('text=Comunicări');
    await expect(page).toHaveURL(/\/communications/);
    await expect(page.locator('[aria-current="page"]')).toContainText('Comunicări');

    // Navigate to Time Tracking
    await page.click('text=Pontaj');
    await expect(page).toHaveURL(/\/time-tracking/);
    await expect(page.locator('[aria-current="page"]')).toContainText('Pontaj');

    // Navigate to Reports
    await page.click('text=Rapoarte');
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.locator('[aria-current="page"]')).toContainText('Rapoarte');

    // Navigate back to Dashboard
    await page.click('text=Dashboard');
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.locator('[aria-current="page"]')).toContainText('Dashboard');
  });

  test('should switch roles and verify navigation state persists', async ({ page }) => {
    // Start as Partner, navigate to Cases
    await page.click('text=Cazuri');
    await expect(page).toHaveURL(/\/cases/);

    // Open role switcher
    await page.click('[aria-label="Select role"]');

    // Switch to Associate
    await page.click('text=Associate');

    // Verify still on Cases page
    await expect(page).toHaveURL(/\/cases/);
    await expect(page.locator('[aria-current="page"]')).toContainText('Cazuri');

    // Verify role changed
    await expect(page.locator('text=Associate')).toBeVisible();
  });

  test('should open command palette with Cmd+K and navigate', async ({ page }) => {
    // Press Cmd+K (Mac) or Ctrl+K (Windows)
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');

    // Command palette should be open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Type to search for documents
    await page.fill('[role="textbox"]', 'documents');

    // Click on "Go to Documents" command
    await page.click('text=Go to Documents');

    // Should navigate to documents
    await expect(page).toHaveURL(/\/documents/);

    // Command palette should be closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should click quick action buttons for each role', async ({ page }) => {
    // Partner quick actions
    await expect(page.locator('text=New Case')).toBeVisible();
    await page.click('text=New Case');

    // Switch to Associate
    await page.click('[aria-label="Select role"]');
    await page.click('text=Associate');

    // Associate quick actions
    await expect(page.locator('text=New Document')).toBeVisible();
    await page.click('text=New Document');

    // Switch to Paralegal
    await page.click('[aria-label="Select role"]');
    await page.click('text=Paralegal');

    // Paralegal quick actions
    await expect(page.locator('text=Upload Document')).toBeVisible();
    await page.click('text=Upload Document');
  });

  test('should collapse sidebar and verify navigation still works', async ({ page }) => {
    // Click hamburger menu to collapse sidebar
    await page.click('[aria-label="Toggle sidebar"]');

    // Sidebar should be collapsed (width reduced)
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveCSS('width', '64px'); // Collapsed width

    // Navigation should still work
    await page.click('aside >> text=⚖️'); // Cases icon
    await expect(page).toHaveURL(/\/cases/);

    // Expand sidebar again
    await page.click('[aria-label="Toggle sidebar"]');
    await expect(sidebar).toHaveCSS('width', '256px'); // Expanded width
  });

  test('should display correct navigation items for Paralegal role', async ({ page }) => {
    // Switch to Paralegal
    await page.click('[aria-label="Select role"]');
    await page.click('text=Paralegal');

    // Paralegal should NOT see Reports section
    await expect(page.locator('text=Rapoarte')).not.toBeVisible();

    // But should see all other sections
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Cazuri')).toBeVisible();
    await expect(page.locator('text=Documente')).toBeVisible();
    await expect(page.locator('text=Sarcini')).toBeVisible();
    await expect(page.locator('text=Comunicări')).toBeVisible();
    await expect(page.locator('text=Pontaj')).toBeVisible();
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

  test('should show hamburger menu on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Hamburger button should be visible
    await expect(page.locator('[aria-label="Toggle sidebar"]')).toBeVisible();

    // Sidebar should be hidden by default on mobile
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();
  });

  test('should open sidebar as overlay on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Click hamburger menu
    await page.click('[aria-label="Toggle sidebar"]');

    // Sidebar should be visible as overlay
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Click backdrop to close
    await page.click('body', { position: { x: 10, y: 10 } }); // Click outside sidebar
    await expect(sidebar).not.toBeVisible();
  });

  test('should close sidebar after navigation on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Open sidebar
    await page.click('[aria-label="Toggle sidebar"]');
    await expect(page.locator('aside')).toBeVisible();

    // Click navigation item
    await page.click('text=Cazuri');

    // Sidebar should auto-close
    await expect(page.locator('aside')).not.toBeVisible();

    // Should navigate to Cases
    await expect(page).toHaveURL(/\/cases/);
  });

  test('should make command palette full-screen on mobile', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Open command palette
    await page.keyboard.press('Meta+k');

    // Dialog should be full-screen
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Should take full viewport width
    const boundingBox = await dialog.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(300); // At least mobile width
  });
});

test.describe('Keyboard Navigation', () => {
  test('should navigate with Tab key', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Tab through navigation items
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Continue tabbing
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('should activate navigation items with Enter', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Tab to Cases link
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter
    await page.keyboard.press('Enter');

    // Should navigate
    await expect(page).toHaveURL(/\/cases/);
  });

  test('should open command palette with keyboard shortcut', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Press Cmd/Ctrl + K
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');

    // Command palette should open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should navigate command palette with arrow keys', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Open command palette
    await page.keyboard.press('Meta+k');

    // First item should be selected
    await expect(page.locator('[data-selected="true"]')).toBeVisible();

    // Arrow down to next item
    await page.keyboard.press('ArrowDown');

    // Second item should be selected
    const selectedItems = page.locator('[data-selected="true"]');
    await expect(selectedItems).toHaveCount(1);

    // Press Enter to select
    await page.keyboard.press('Enter');

    // Dialog should close and navigate
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});

test.describe('Romanian Diacritics', () => {
  test('should display Romanian text correctly in navigation', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Verify Romanian diacritics render correctly
    await expect(page.locator('text=Cazuri')).toBeVisible(); // Cases
    await expect(page.locator('text=Documente')).toBeVisible(); // Documents
    await expect(page.locator('text=Sarcini')).toBeVisible(); // Tasks
    await expect(page.locator('text=Comunicări')).toBeVisible(); // Communications
    await expect(page.locator('text=Pontaj')).toBeVisible(); // Time Tracking
    await expect(page.locator('text=Rapoarte')).toBeVisible(); // Reports
  });

  test('should search with Romanian keywords in command palette', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Open command palette
    await page.keyboard.press('Meta+k');

    // Type Romanian keyword
    await page.fill('[role="textbox"]', 'cazuri'); // Romanian for "cases"

    // Should filter to show Cases command
    await expect(page.locator('text=Go to Cases')).toBeVisible();
    await expect(page.locator('text=Go to Documents')).not.toBeVisible();
  });
});
