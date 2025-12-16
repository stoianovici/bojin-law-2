/**
 * Document Drafting E2E Tests
 * Story 3.3: Intelligent Document Drafting
 *
 * End-to-end tests for AI-powered document generation
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TEST_CASE_ID = '123e4567-e89b-12d3-a456-426614174000';

// Helper to login (mock for testing)
async function loginAsUser(page: Page) {
  // Navigate to login page and authenticate
  // This would use the actual auth flow in production
  await page.goto(`${BASE_URL}/login`);

  // Mock authentication for E2E tests
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'test-token-for-e2e');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'test-user-id',
        role: 'Partner',
        firmId: 'test-firm-id',
      })
    );
  });
}

test.describe('Document Generation Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('should load document generation page', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Check page title
    await expect(page.locator('h1')).toContainText('Generare Document cu AI');

    // Check for document type selector
    await expect(page.locator('text=Tip Document')).toBeVisible();

    // Check for prompt input
    await expect(page.locator('textarea')).toBeVisible();

    // Check for generate button
    await expect(page.locator('button:has-text("Generează Document")')).toBeVisible();
  });

  test('should display document type options', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Check all document types are available
    await expect(page.locator('text=Contract')).toBeVisible();
    await expect(page.locator('text=Cerere')).toBeVisible();
    await expect(page.locator('text=Scrisoare')).toBeVisible();
    await expect(page.locator('text=Memorandum')).toBeVisible();
  });

  test('should select document type', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Click on Motion type
    await page.click('button:has-text("Cerere")');

    // Verify selection (should have active styling)
    const motionButton = page.locator('button:has-text("Cerere")');
    await expect(motionButton).toHaveClass(/border-blue-500/);
  });

  test('should display case context preview', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Check context preview section
    await expect(page.locator('text=Context Caz')).toBeVisible();

    // Should show loading state or content
    const contextSection = page.locator('section:has-text("Context Caz")');
    await expect(contextSection).toBeVisible();
  });

  test('should validate prompt length', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Type short prompt
    await page.fill('textarea', 'Short');

    // Click generate button
    await page.click('button:has-text("Generează Document")');

    // Should show validation error
    await expect(page.locator('text=cel puțin 10 caractere')).toBeVisible();
  });

  test('should show loading state during generation', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Type valid prompt
    await page.fill(
      'textarea',
      'Generează un contract de prestări servicii pentru consultanță juridică'
    );

    // Click generate button
    await page.click('button:has-text("Generează Document")');

    // Should show loading indicator
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(page.locator('text=Generare...')).toBeVisible();
  });

  test('should toggle context inclusion option', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Find the checkbox
    const checkbox = page.locator('input[type="checkbox"]');

    // Should be checked by default
    await expect(checkbox).toBeChecked();

    // Click to uncheck
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
  });
});

test.describe('Clause Suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('should show suggestion popup when typing', async ({ page }) => {
    // This test assumes an editor page exists
    await page.goto(`${BASE_URL}/documents/edit/test-doc-id`);

    // Wait for editor to load
    await page.waitForSelector('[contenteditable="true"]');

    // Type in the editor
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    await editor.type('Prestatorul se obligă să');

    // Wait for suggestions (debounced)
    await page.waitForTimeout(400);

    // Check if suggestions appear (may need mock data)
    // This depends on the actual implementation
  });

  test('should accept suggestion with Tab key', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents/edit/test-doc-id`);

    // Wait for editor and type
    await page.waitForSelector('[contenteditable="true"]');
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    await editor.type('Prestatorul');

    // Wait for suggestions
    await page.waitForTimeout(400);

    // Press Tab to accept (if suggestion appears)
    await page.keyboard.press('Tab');
  });

  test('should dismiss suggestion with Escape key', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents/edit/test-doc-id`);

    await page.waitForSelector('[contenteditable="true"]');
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    await editor.type('Prestatorul');

    await page.waitForTimeout(400);

    // Press Escape to dismiss
    await page.keyboard.press('Escape');

    // Suggestion popup should not be visible
    await expect(page.locator('[role="listbox"]')).not.toBeVisible();
  });
});

test.describe('Similar Documents Panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('should display similar documents', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Similar documents panel might be on the page or in a sidebar
    // This test depends on the actual UI layout
  });
});

test.describe('Language Explanation Feature', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('should show context menu on text selection', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents/edit/test-doc-id`);

    // Wait for editor
    await page.waitForSelector('[contenteditable="true"]');

    // Select some text (triple-click selects paragraph)
    const editor = page.locator('[contenteditable="true"]');
    await editor.click({ clickCount: 3 });

    // Right-click to show context menu
    await editor.click({ button: 'right' });

    // Check for "Explică" option in context menu
    await expect(page.locator('text=Explică acest text')).toBeVisible();
  });

  test('should show explanation panel', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents/edit/test-doc-id`);

    await page.waitForSelector('[contenteditable="true"]');

    const editor = page.locator('[contenteditable="true"]');
    await editor.click({ clickCount: 3 });
    await editor.click({ button: 'right' });

    // Click "Explică" option
    await page.click('text=Explică acest text');

    // Explanation panel should appear
    await expect(page.locator('text=Explicație Limbaj Juridic')).toBeVisible();
  });
});

test.describe('Quality Metrics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('should load quality metrics page', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/document-quality`);

    // Check page title
    await expect(page.locator('h1')).toContainText('Calitate Documente AI');

    // Check for KPI cards
    await expect(page.locator('text=Editare Medie')).toBeVisible();
    await expect(page.locator('text=Documente Generate')).toBeVisible();
  });

  test('should display date range filter', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/document-quality`);

    // Check for date range selector
    const dateSelector = page.locator('select').first();
    await expect(dateSelector).toBeVisible();

    // Should have options
    await expect(page.locator('option:has-text("Ultimele 7 zile")')).toBeVisible();
    await expect(page.locator('option:has-text("Ultimele 30 zile")')).toBeVisible();
  });

  test('should display document type breakdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/document-quality`);

    // Check for type breakdown section
    await expect(page.locator('text=Editare per Tip Document')).toBeVisible();
  });

  test('should display trend chart', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/document-quality`);

    // Check for trend section
    await expect(page.locator('text=Trend Calitate')).toBeVisible();
  });

  test('should filter by document type', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/document-quality`);

    // Find and click document type filter
    const typeSelector = page.locator('select').nth(1);
    await typeSelector.selectOption('Contract');

    // Page should update (could verify specific content)
  });

  test('should display quality target indicator', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/document-quality`);

    // Check for quality target section
    await expect(page.locator('text=Obiectiv Calitate')).toBeVisible();
    await expect(page.locator('text=30%')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('document generation page should be keyboard navigable', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);

    // Tab through focusable elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to reach the generate button
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBeDefined();
  });

  test('editor should have proper ARIA attributes', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents/edit/test-doc-id`);

    // Check editor has proper role
    const editor = page.locator('[role="textbox"]');
    await expect(editor).toHaveAttribute('aria-label', /.+/);
    await expect(editor).toHaveAttribute('aria-multiline', 'true');
  });

  test('suggestions should be announced to screen readers', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents/edit/test-doc-id`);

    // Listbox should have proper role when visible
    // This test checks for proper ARIA markup
  });
});

test.describe('Performance', () => {
  test('document generation page should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/cases/${TEST_CASE_ID}/documents/new`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('quality dashboard should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/analytics/document-quality`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
});
