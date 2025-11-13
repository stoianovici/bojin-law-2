/**
 * ACCESSIBILITY (A11Y) TEST TEMPLATE
 *
 * This template demonstrates best practices for automated accessibility testing
 * using axe-core with Playwright. Accessibility testing ensures your application
 * is usable by everyone, including people with disabilities.
 *
 * WHEN TO USE A11Y TESTS:
 * - Testing WCAG 2.0/2.1/2.2 Level AA compliance
 * - Testing keyboard navigation
 * - Testing screen reader compatibility
 * - Testing color contrast ratios
 * - Testing focus management
 * - Testing semantic HTML structure
 * - Testing ARIA labels and roles
 *
 * TARGET: WCAG AA compliance with zero violations
 */

import { test, expect } from '@playwright/test';
import { testA11y, a11yTestScenarios } from '@legal-platform/test-utils/a11y';

// ============================================================================
// EXAMPLE 1: Basic Page Accessibility Test
// ============================================================================

/**
 * Every page should be tested for basic accessibility compliance.
 * This catches common issues like missing alt text, poor contrast, etc.
 */

test.describe('Login Page Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations', async ({ page }) => {
    // Run axe on the entire page
    await testA11y(page, 'Login Page');
  });

  test('should have proper heading structure', async ({ page }) => {
    // Check heading hierarchy (h1 -> h2 -> h3, no skipping)
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1); // Should have exactly one h1

    const h1Text = await page.locator('h1').textContent();
    expect(h1Text).toBeTruthy();
  });

  test('should have accessible form labels', async ({ page }) => {
    // All form inputs should have associated labels
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();

    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();

    // Submit button should have accessible name
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeVisible();
  });

  test('should have proper focus indicators', async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);

    // Focus the input
    await emailInput.focus();

    // Check that focus indicator is visible (outline or custom style)
    // This depends on your CSS implementation
    const isFocused = await emailInput.evaluate((el) => {
      return el === document.activeElement;
    });
    expect(isFocused).toBe(true);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through form fields
    await page.keyboard.press('Tab'); // Focus email
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('INPUT');

    await page.keyboard.press('Tab'); // Focus password
    focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('INPUT');

    await page.keyboard.press('Tab'); // Focus submit button
    focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe('BUTTON');

    // Should be able to submit with Enter
    await page.keyboard.press('Enter');
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // axe automatically checks color contrast
    // This test ensures all text has at least 4.5:1 ratio (AA standard)
    await testA11y(page, 'Login Page - Color Contrast');
  });
});

// ============================================================================
// EXAMPLE 2: Form Accessibility Testing
// ============================================================================

test.describe('Case Creation Form Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('partner@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/dashboard');

    // Navigate to case creation
    await page.goto('/cases/new');
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations', async ({ page }) => {
    await testA11y(page, 'Case Creation Form');
  });

  test('should have accessible form fields with labels', async ({ page }) => {
    // Test all form fields have proper labels
    await expect(page.getByLabel(/case title/i)).toBeVisible();
    await expect(page.getByLabel(/client/i)).toBeVisible();
    await expect(page.getByLabel(/case type/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
  });

  test('should show validation errors accessibly', async ({ page }) => {
    // Submit empty form
    await page.getByRole('button', { name: /create case/i }).click();

    // Errors should be announced to screen readers
    const errorElements = page.getByRole('alert');
    await expect(errorElements.first()).toBeVisible();

    // Error should be associated with input (aria-describedby or similar)
    const titleInput = page.getByLabel(/case title/i);
    const ariaDescribedBy = await titleInput.getAttribute('aria-describedby');
    expect(ariaDescribedBy).toBeTruthy();
  });

  test('should have accessible select dropdowns', async ({ page }) => {
    const clientSelect = page.getByLabel(/client/i);

    // Click to open dropdown
    await clientSelect.click();

    // Options should be accessible
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();

    // Should be navigable with keyboard
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Selected value should be announced
    const selectedValue = await clientSelect.inputValue();
    expect(selectedValue).toBeTruthy();
  });

  test('should have accessible textarea', async ({ page }) => {
    const description = page.getByLabel(/description/i);

    // Should have proper role
    const role = await description.getAttribute('role');
    // Textarea role is implicit, but can be explicitly set
    expect(role === 'textbox' || role === null).toBe(true);

    // Should be focusable and editable
    await description.focus();
    await description.fill('Test description');
    await expect(description).toHaveValue('Test description');
  });
});

// ============================================================================
// EXAMPLE 3: Interactive Component Accessibility
// ============================================================================

test.describe('Modal Dialog Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open a modal (adjust selector to your app)
    await page.getByRole('button', { name: /open settings/i }).click();
  });

  test('should have no accessibility violations in modal', async ({ page }) => {
    await testA11y(page, 'Settings Modal');
  });

  test('should trap focus within modal', async ({ page }) => {
    // Get all focusable elements in modal
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Tab should cycle through modal elements only
    const firstFocusable = modal.getByRole('button').first();
    await firstFocusable.focus();

    // Tab forward multiple times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should still be within modal
    const focusedElement = await page.evaluate(() => {
      const activeEl = document.activeElement;
      const dialog = document.querySelector('[role="dialog"]');
      return dialog?.contains(activeEl);
    });
    expect(focusedElement).toBe(true);
  });

  test('should close modal with Escape key', async ({ page }) => {
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(modal).not.toBeVisible();
  });

  test('should return focus after closing modal', async ({ page }) => {
    // Remember the trigger button
    const triggerButton = page.getByRole('button', { name: /open settings/i });

    // Open modal
    await triggerButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');

    // Focus should return to trigger button
    const isFocused = await triggerButton.evaluate((el) => {
      return el === document.activeElement;
    });
    expect(isFocused).toBe(true);
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    const modal = page.getByRole('dialog');

    // Should have aria-modal="true"
    const ariaModal = await modal.getAttribute('aria-modal');
    expect(ariaModal).toBe('true');

    // Should have aria-labelledby or aria-label
    const ariaLabel = await modal.getAttribute('aria-label');
    const ariaLabelledBy = await modal.getAttribute('aria-labelledby');
    expect(ariaLabel || ariaLabelledBy).toBeTruthy();
  });
});

// ============================================================================
// EXAMPLE 4: Data Table Accessibility
// ============================================================================

test.describe('Cases Table Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations in table', async ({ page }) => {
    await testA11y(page, 'Cases Table');
  });

  test('should have proper table structure', async ({ page }) => {
    const table = page.getByRole('table');
    await expect(table).toBeVisible();

    // Should have caption or aria-label
    const caption = table.locator('caption');
    const ariaLabel = await table.getAttribute('aria-label');
    expect((await caption.count()) > 0 || ariaLabel !== null).toBe(true);

    // Should have thead and tbody
    await expect(table.locator('thead')).toBeVisible();
    await expect(table.locator('tbody')).toBeVisible();
  });

  test('should have accessible column headers', async ({ page }) => {
    // Column headers should use <th> with scope="col"
    const headers = page.getByRole('columnheader');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);

    // Each header should have proper scope
    for (let i = 0; i < headerCount; i++) {
      const header = headers.nth(i);
      const scope = await header.getAttribute('scope');
      expect(scope).toBe('col');
    }
  });

  test('should have accessible row headers if applicable', async ({ page }) => {
    // If first column is row headers, they should use <th scope="row">
    const rowHeaders = page.getByRole('rowheader');
    const count = await rowHeaders.count();

    if (count > 0) {
      const firstRowHeader = rowHeaders.first();
      const scope = await firstRowHeader.getAttribute('scope');
      expect(scope).toBe('row');
    }
  });

  test('should support keyboard navigation in table', async ({ page }) => {
    // Focus first row
    const firstRow = page.getByRole('row').nth(1); // Skip header row
    const firstCell = firstRow.getByRole('cell').first();
    await firstCell.focus();

    // Should be able to navigate with arrow keys
    // Note: This requires custom keyboard handling in your table
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
  });

  test('should have accessible action buttons', async ({ page }) => {
    // Action buttons in each row should have accessible names
    const editButtons = page.getByRole('button', { name: /edit/i });
    expect(await editButtons.count()).toBeGreaterThan(0);

    // Verify first edit button has accessible name including case title
    const firstEditButton = editButtons.first();
    const accessibleName = await firstEditButton.getAttribute('aria-label');
    // Should be something like "Edit Case: Smith vs Jones"
    expect(accessibleName).toBeTruthy();
  });
});

// ============================================================================
// EXAMPLE 5: Rich Text Editor Accessibility
// ============================================================================

test.describe('Document Editor Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents/new');
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations in editor', async ({ page }) => {
    await testA11y(page, 'Document Editor');
  });

  test('should have accessible toolbar buttons', async ({ page }) => {
    // All toolbar buttons should have accessible names
    const boldButton = page.getByRole('button', { name: /bold/i });
    await expect(boldButton).toBeVisible();

    const italicButton = page.getByRole('button', { name: /italic/i });
    await expect(italicButton).toBeVisible();

    // Buttons should show pressed state
    await boldButton.click();
    const ariaPressed = await boldButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
  });

  test('should have accessible editor region', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: /document content/i });
    await expect(editor).toBeVisible();

    // Should be editable
    await editor.focus();
    await page.keyboard.type('Test content');

    // Should announce content to screen readers
    const content = await editor.textContent();
    expect(content).toContain('Test content');
  });

  test('should support keyboard shortcuts with proper announcements', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: /document content/i });
    await editor.focus();

    // Ctrl+B for bold
    await page.keyboard.press('Control+B');

    // Bold button should show active state
    const boldButton = page.getByRole('button', { name: /bold/i });
    const ariaPressed = await boldButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
  });
});

// ============================================================================
// EXAMPLE 6: Using Built-in Test Scenarios
// ============================================================================

/**
 * Use pre-defined accessibility test scenarios from test-utils
 */

test.describe('Component-Specific A11y Scenarios', () => {
  test('should test all landmark regions', async ({ page }) => {
    await page.goto('/dashboard');

    // Use pre-defined landmark test
    await a11yTestScenarios.landmarks(page);
  });

  test('should test all images have alt text', async ({ page }) => {
    await page.goto('/dashboard');

    // Use pre-defined image test
    await a11yTestScenarios.images(page);
  });

  test('should test form accessibility', async ({ page }) => {
    await page.goto('/cases/new');

    // Use pre-defined form test
    await a11yTestScenarios.forms(page);
  });

  test('should test color contrast', async ({ page }) => {
    await page.goto('/dashboard');

    // Use pre-defined color contrast test
    await a11yTestScenarios.colorContrast(page);
  });

  test('should test heading structure', async ({ page }) => {
    await page.goto('/dashboard');

    // Use pre-defined heading test
    await a11yTestScenarios.headings(page);
  });

  test('should test keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard');

    // Use pre-defined keyboard test
    await a11yTestScenarios.keyboard(page);
  });

  test('should test ARIA implementation', async ({ page }) => {
    await page.goto('/dashboard');

    // Use pre-defined ARIA test
    await a11yTestScenarios.aria(page);
  });
});

// ============================================================================
// EXAMPLE 7: Testing with Screen Reader Announcements
// ============================================================================

test.describe('Screen Reader Announcements', () => {
  test('should announce loading states', async ({ page }) => {
    await page.goto('/cases');

    // Check for aria-live region
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeAttached();

    // Trigger loading
    await page.getByRole('button', { name: /refresh/i }).click();

    // Loading message should appear in live region
    await expect(liveRegion).toContainText(/loading/i);
  });

  test('should announce success messages', async ({ page }) => {
    await page.goto('/cases/new');

    // Fill and submit form
    await page.getByLabel(/case title/i).fill('New Case');
    await page.getByRole('button', { name: /create/i }).click();

    // Success message should be in aria-live region
    const successRegion = page.locator('[role="status"]');
    await expect(successRegion).toContainText(/case created successfully/i);
  });

  test('should announce error messages', async ({ page }) => {
    await page.goto('/cases/new');

    // Submit invalid form
    await page.getByRole('button', { name: /create/i }).click();

    // Error should be announced
    const errorRegion = page.locator('[role="alert"]');
    await expect(errorRegion).toBeVisible();
  });
});

// ============================================================================
// EXAMPLE 8: Romanian Language Accessibility
// ============================================================================

test.describe('Romanian Language Accessibility', () => {
  test('should maintain accessibility with Romanian diacritics', async ({ page }) => {
    // Set Romanian language
    await page.goto('/ro/dashboard');

    // Test page with Romanian characters (ă, â, î, ș, ț)
    await testA11y(page, 'Romanian Dashboard');

    // Verify Romanian text is readable
    const heading = page.getByRole('heading', { level: 1 });
    const text = await heading.textContent();

    // Should contain Romanian characters if applicable
    expect(text).toBeTruthy();
  });

  test('should have proper lang attribute', async ({ page }) => {
    await page.goto('/ro/dashboard');

    // HTML should have lang="ro" or specific elements should have lang attribute
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toContain('ro');
  });
});

// ============================================================================
// ACCESSIBILITY TESTING BEST PRACTICES
// ============================================================================

/**
 * ✅ DO:
 * - Test every page for basic a11y compliance
 * - Use semantic HTML (nav, main, article, etc.)
 * - Provide text alternatives for images
 * - Ensure keyboard navigation works everywhere
 * - Test focus management for dynamic content
 * - Use proper ARIA attributes when needed
 * - Test with actual screen readers occasionally
 * - Ensure color contrast meets WCAG AA (4.5:1)
 * - Provide skip links for keyboard users
 * - Test form validation messages
 *
 * ❌ DON'T:
 * - Rely solely on automated testing
 * - Use div/span for interactive elements
 * - Remove focus indicators
 * - Use color as only indicator
 * - Disable keyboard navigation
 * - Overcomplicate ARIA (semantic HTML first)
 * - Forget to test with keyboard only
 * - Ignore axe violations
 */

/**
 * WCAG 2.1 LEVEL AA REQUIREMENTS:
 * - Perceivable: Content must be presentable to all users
 * - Operable: UI components must be operable by all users
 * - Understandable: Information must be understandable
 * - Robust: Content must work with assistive technologies
 *
 * COMMON WCAG VIOLATIONS TO CHECK:
 * - Missing alt text on images
 * - Insufficient color contrast
 * - Missing form labels
 * - Non-semantic HTML structure
 * - Keyboard traps
 * - Missing focus indicators
 * - Incorrect ARIA usage
 * - Missing page titles
 * - Missing language attributes
 * - Inaccessible modals/dialogs
 *
 * MANUAL TESTING CHECKLIST:
 * - ✓ Navigate entire app with keyboard only (Tab, Enter, Space, Arrow keys)
 * - ✓ Test with screen reader (NVDA, JAWS, VoiceOver)
 * - ✓ Test with browser zoom (200%+)
 * - ✓ Test with Windows High Contrast Mode
 * - ✓ Test with different text sizes
 * - ✓ Verify captions for video/audio content
 *
 * TOOLS:
 * - axe DevTools browser extension
 * - Lighthouse accessibility audit
 * - NVDA or JAWS screen reader
 * - Keyboard only navigation
 * - Color contrast analyzers
 *
 * Run: pnpm test:a11y
 * Run with UI: pnpm test:e2e:ui tests/e2e/accessibility/
 */
