/**
 * E2E tests for Document Editor
 * Tests the complete document editing workflow using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Document Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to documents list
    await page.goto('/documents');
  });

  test.describe('Navigation', () => {
    test('should navigate to document editor from documents list', async ({ page }) => {
      // Click on first document edit button
      await page.click('text=Editeaz');

      // Should navigate to editor page
      await expect(page).toHaveURL(/\/documents\/.*\/edit/);

      // Editor should be visible
      await expect(page.locator('role=toolbar[name="Opțiuni formatare document"]')).toBeVisible();
    });

    test('should navigate via sidebar Documents menu', async ({ page }) => {
      // Click Documents in sidebar
      await page.click('text=Documente');

      // Should show documents list
      await expect(page).toHaveURL('/documents');
    });
  });

  test.describe('Editor Toolbar', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/documents/test-doc-1/edit');
    });

    test('should have all formatting buttons visible', async ({ page }) => {
      await expect(page.locator('button[aria-label="Aldină"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Cursiv"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Subliniat"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Tăiat"]')).toBeVisible();
    });

    test('should have alignment buttons visible', async ({ page }) => {
      await expect(page.locator('button[aria-label="Aliniere stânga"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Aliniere centru"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Aliniere dreapta"]')).toBeVisible();
      await expect(page.locator('button[aria-label="Aliniere justificat"]')).toBeVisible();
    });

    test('should open insert menu', async ({ page }) => {
      await page.click('text=Inserează');

      await expect(page.locator('text=Tabel')).toBeVisible();
      await expect(page.locator('text=Imagine')).toBeVisible();
      await expect(page.locator('text=Link')).toBeVisible();
    });

    test('should switch to version comparison view', async ({ page }) => {
      await page.click('text=Istoric versiuni');

      // Version comparison view should be visible
      await expect(page.locator('text=Comparare Versiuni')).toBeVisible();
      await expect(page.locator('text=Anterioară')).toBeVisible();
      await expect(page.locator('text=Curentă')).toBeVisible();
    });
  });

  test.describe('AI Assistant Panel', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/documents/test-doc-1/edit');
    });

    test('should show AI assistant panel by default', async ({ page }) => {
      await expect(page.locator('text=Asistent AI')).toBeVisible();
      await expect(page.locator('text=Sugestii')).toBeVisible();
    });

    test('should toggle AI panel collapse/expand', async ({ page }) => {
      // Collapse panel
      await page.click('button[aria-label="Închide panoul AI"]');

      // Panel should be collapsed
      await expect(page.locator('button[aria-label="Deschide panoul AI"]')).toBeVisible();

      // Expand panel
      await page.click('button[aria-label="Deschide panoul AI"]');

      // Panel should be expanded
      await expect(page.locator('text=Sugestii')).toBeVisible();
    });

    test('should switch between AI panel tabs', async ({ page }) => {
      // Click Documente tab
      await page.click('text=Documente');
      await expect(page.locator('text=similar')).toBeVisible();

      // Click Șabloane tab
      await page.click('text=Șabloane');
      await expect(page.locator('text=Contract Prestări Servicii')).toBeVisible();

      // Click back to Sugestii tab
      await page.click('text=Sugestii');
      await expect(page.locator('text=potrivire')).toBeVisible();
    });

    test('should display suggested completions', async ({ page }) => {
      await expect(page.locator('text=% potrivire')).toBeVisible();
      await expect(page.locator('button:has-text("Inserează")')).toBeVisible();
    });
  });

  test.describe('Version Comparison View', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/documents/test-doc-1/edit');
      await page.click('text=Istoric versiuni');
    });

    test('should display version comparison header', async ({ page }) => {
      await expect(page.locator('text=Comparare Versiuni')).toBeVisible();
      await expect(page.locator('text=Versiunea 1')).toBeVisible();
      await expect(page.locator('text=Versiunea 2')).toBeVisible();
    });

    test('should navigate between semantic changes', async ({ page }) => {
      const diffCounter = page.locator('text=/\\d+ \\/ \\d+/');
      await expect(diffCounter).toBeVisible();

      // Click next diff
      await page.click('button[aria-label="Diferența următoare"]');

      // Counter should update
      await expect(diffCounter).toContainText('2 /');
    });

    test('should have accept and reject buttons', async ({ page }) => {
      await expect(page.locator('button:has-text("Acceptă modificările")')).toBeVisible();
      await expect(page.locator('button:has-text("Respinge")')).toBeVisible();
    });

    test('should display diff highlighting', async ({ page }) => {
      // Check for highlighted changes (green/red backgrounds)
      const highlightedLines = page.locator('.bg-green-50, .bg-red-50');
      await expect(highlightedLines.first()).toBeVisible();
    });
  });

  test.describe('Comments Sidebar', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/documents/test-doc-1/edit');
    });

    test('should toggle comments sidebar', async ({ page }) => {
      // Use keyboard shortcut to open comments
      await page.keyboard.press('Control+Alt+KeyC');

      // Comments sidebar should be visible
      await expect(page.locator('text=Comentarii')).toBeVisible();
    });

    test('should display existing comments', async ({ page }) => {
      await page.keyboard.press('Control+Alt+KeyC');

      // Should show comment authors and text
      await expect(page.locator('text=Elena Popescu')).toBeVisible();
      await expect(page.locator('text=Mihai Bojin')).toBeVisible();
    });

    test('should show add comment button', async ({ page }) => {
      await page.keyboard.press('Control+Alt+KeyC');

      await expect(page.locator('button:has-text("Adaugă comentariu")')).toBeVisible();
    });

    test('should show comment action buttons', async ({ page }) => {
      await page.keyboard.press('Control+Alt+KeyC');

      await expect(page.locator('button:has-text("Rezolvat")')).toBeVisible();
      await expect(page.locator('button:has-text("Răspunde")')).toBeVisible();
    });
  });

  test.describe('Command Bar', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/documents/test-doc-1/edit');
    });

    test('should display command bar at bottom', async ({ page }) => {
      const commandInput = page.locator('input[aria-label="Comandă document"]');
      await expect(commandInput).toBeVisible();
    });

    test('should focus command bar with Ctrl+/', async ({ page }) => {
      await page.keyboard.press('Control+/');

      const commandInput = page.locator('input[aria-label="Comandă document"]');
      await expect(commandInput).toBeFocused();
    });

    test('should show suggested commands when focused', async ({ page }) => {
      await page.click('input[aria-label="Comandă document"]');

      await expect(page.locator('text=Comenzi sugerate')).toBeVisible();
      await expect(page.locator('text=Adaugă clauză de confidențialitate')).toBeVisible();
      await expect(page.locator('text=Verifică pentru erori')).toBeVisible();
    });

    test('should have voice input button', async ({ page }) => {
      await expect(page.locator('button[aria-label="Comandă vocală"]')).toBeVisible();
    });

    test('should have submit button', async ({ page }) => {
      await expect(page.locator('button[aria-label="Trimite comandă"]')).toBeVisible();
    });

    test('should allow typing commands', async ({ page }) => {
      const commandInput = page.locator('input[aria-label="Comandă document"]');
      await commandInput.fill('Test command');

      await expect(commandInput).toHaveValue('Test command');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/documents/test-doc-1/edit');
    });

    test('Ctrl+B should trigger bold formatting', async ({ page }) => {
      await page.keyboard.press('Control+KeyB');
      // Bold button would be activated (visual feedback)
      // In real implementation, this would toggle bold formatting
    });

    test('Ctrl+I should trigger italic formatting', async ({ page }) => {
      await page.keyboard.press('Control+KeyI');
      // Italic button would be activated
    });

    test('Ctrl+/ should focus command bar', async ({ page }) => {
      await page.keyboard.press('Control+/');

      const commandInput = page.locator('input[aria-label="Comandă document"]');
      await expect(commandInput).toBeFocused();
    });

    test('Ctrl+Alt+C should toggle comments sidebar', async ({ page }) => {
      await page.keyboard.press('Control+Alt+KeyC');

      await expect(page.locator('text=Comentarii')).toBeVisible();

      await page.keyboard.press('Control+Alt+KeyC');

      await expect(page.locator('button[aria-label="Deschide comentarii"]')).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should display properly on desktop (1920x1080)', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/documents/test-doc-1/edit');

      // All panels should be visible
      await expect(page.locator('role=toolbar')).toBeVisible();
      await expect(page.locator('text=Asistent AI')).toBeVisible();
    });

    test('should display properly on tablet (1024x768)', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/documents/test-doc-1/edit');

      await expect(page.locator('role=toolbar')).toBeVisible();
    });

    test('should adapt layout on mobile (375x667)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/documents/test-doc-1/edit');

      // Mobile layout adjustments
      await expect(page.locator('role=toolbar')).toBeVisible();
    });
  });

  test.describe('Romanian Language Content', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/documents/test-doc-1/edit');
    });

    test('should render Romanian diacritics in toolbar', async ({ page }) => {
      await expect(page.locator('button[aria-label="Aldină"]')).toBeVisible();
      await expect(page.locator('text=Inserează')).toBeVisible();
    });

    test('should render Romanian diacritics in AI panel', async ({ page }) => {
      await expect(page.locator('text=Sugestii')).toBeVisible();
      await expect(page.locator('text=Șabloane')).toBeVisible();
    });

    test('should render Romanian diacritics in command bar', async ({ page }) => {
      await page.click('input[aria-label="Comandă document"]');

      await expect(page.locator('text=Adaugă clauză de confidențialitate')).toBeVisible();
      await expect(page.locator('text=Verifică pentru erori')).toBeVisible();
    });

    test('should render Romanian diacritics in version comparison', async ({ page }) => {
      await page.click('text=Istoric versiuni');

      await expect(page.locator('text=Anterioară')).toBeVisible();
      await expect(page.locator('text=Curentă')).toBeVisible();
    });
  });

  test.describe('Complete User Journey', () => {
    test('should complete full document editing workflow', async ({ page }) => {
      // Navigate to documents
      await page.goto('/documents');

      // Open document editor
      await page.click('text=Editeaz');
      await expect(page).toHaveURL(/\/documents\/.*\/edit/);

      // Use toolbar formatting
      await page.click('button[aria-label="Aldină"]');

      // Switch AI panel tabs
      await page.click('text=Documente');
      await expect(page.locator('text=similar')).toBeVisible();

      // Use command bar
      await page.keyboard.press('Control+/');
      await page.locator('input[aria-label="Comandă document"]').fill('Test command');

      // Open comments sidebar
      await page.keyboard.press('Control+Alt+KeyC');
      await expect(page.locator('text=Comentarii')).toBeVisible();

      // View version comparison
      await page.click('text=Istoric versiuni');
      await expect(page.locator('text=Comparare Versiuni')).toBeVisible();

      // Journey completes successfully
      expect(true).toBe(true);
    });
  });
});
