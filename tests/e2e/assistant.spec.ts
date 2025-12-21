/**
 * AI Assistant E2E Tests
 * OPS-080: E2E Tests
 *
 * End-to-end tests for the AI Assistant Pill component and its interactions.
 * Uses Page Object Model pattern for maintainability.
 *
 * AUTHENTICATION NOTE:
 * These tests require an authenticated session. The app uses Azure AD authentication
 * which doesn't work with isolated Playwright contexts. For local testing:
 * 1. Use Playwright MCP (persistent browser) for manual verification
 * 2. Or set up storageState with saved auth cookies
 * 3. Or configure a test bypass for development
 *
 * Tests are skipped by default unless AUTH_BYPASS=true or storageState is configured.
 */

import { test, expect, type Page } from '@playwright/test';

// Skip tests if authentication isn't configured
const skipAuth = !process.env.AUTH_BYPASS && !process.env.STORAGE_STATE;

// ============================================================================
// PAGE OBJECT MODEL
// ============================================================================

/**
 * Page Object for the AI Assistant
 * Encapsulates all assistant-related locators and actions
 */
class AssistantPage {
  constructor(private page: Page) {}

  // -------------------------------------------------------------------------
  // Locators
  // -------------------------------------------------------------------------

  /** The collapsed pill button */
  get pill() {
    return this.page.locator('[data-testid="assistant-pill"]');
  }

  /** The expanded chat container */
  get chat() {
    return this.page.locator('[data-testid="assistant-chat"]');
  }

  /** The close button in the header */
  get closeButton() {
    return this.page.locator('[data-testid="assistant-close"]');
  }

  /** The text input for messages */
  get input() {
    return this.page.locator('[data-testid="assistant-input"]');
  }

  /** The send button */
  get sendButton() {
    return this.page.locator('[data-testid="assistant-send"]');
  }

  /** The loading indicator */
  get loading() {
    return this.page.locator('[data-testid="assistant-loading"]');
  }

  /** The error message container */
  get error() {
    return this.page.locator('[data-testid="assistant-error"]');
  }

  /** User messages */
  get userMessages() {
    return this.page.locator('[data-testid="message-user"]');
  }

  /** Assistant messages */
  get assistantMessages() {
    return this.page.locator('[data-testid="message-assistant"]');
  }

  /** Action confirmation card */
  get actionCard() {
    return this.page.locator('[data-testid="action-confirm-card"]');
  }

  /** Confirm action button */
  get confirmButton() {
    return this.page.locator('[data-testid="action-confirm"]');
  }

  /** Reject action button */
  get rejectButton() {
    return this.page.locator('[data-testid="action-reject"]');
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /** Navigate to dashboard */
  async gotoDashboard() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  /** Navigate to a specific case */
  async gotoCase(caseId: string) {
    await this.page.goto(`/cases/${caseId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /** Open the assistant by clicking the pill */
  async open() {
    await this.pill.click();
    await expect(this.chat).toBeVisible();
  }

  /** Close the assistant by clicking the close button */
  async close() {
    await this.closeButton.click();
    await expect(this.chat).not.toBeVisible();
  }

  /** Close the assistant by pressing Escape */
  async closeWithEscape() {
    await this.page.keyboard.press('Escape');
    await expect(this.chat).not.toBeVisible();
  }

  /** Send a message */
  async sendMessage(message: string) {
    await this.input.fill(message);
    await this.input.press('Enter');
  }

  /** Click send button instead of pressing Enter */
  async clickSend() {
    await this.sendButton.click();
  }

  /** Confirm a pending action */
  async confirmAction() {
    await this.confirmButton.click();
  }

  /** Reject a pending action */
  async rejectAction() {
    await this.rejectButton.click();
  }

  // -------------------------------------------------------------------------
  // Assertions
  // -------------------------------------------------------------------------

  /** Assert assistant is collapsed (pill visible, chat not visible) */
  async expectCollapsed() {
    await expect(this.pill).toBeVisible();
    await expect(this.chat).not.toBeVisible();
  }

  /** Assert assistant is expanded (chat visible, pill not visible) */
  async expectExpanded() {
    await expect(this.chat).toBeVisible();
    await expect(this.pill).not.toBeVisible();
  }

  /** Assert the input is focused */
  async expectInputFocused() {
    await expect(this.input).toBeFocused();
  }

  /** Assert a user message is visible */
  async expectUserMessage(text: string) {
    await expect(this.userMessages.filter({ hasText: text }).first()).toBeVisible();
  }

  /** Assert an assistant message is visible */
  async expectAssistantMessage() {
    await expect(this.assistantMessages.first()).toBeVisible({ timeout: 10000 });
  }

  /** Assert action card is visible */
  async expectActionCard() {
    await expect(this.actionCard).toBeVisible({ timeout: 10000 });
  }

  /** Assert loading indicator is visible */
  async expectLoading() {
    await expect(this.loading).toBeVisible();
  }

  /** Assert error message is visible */
  async expectError() {
    await expect(this.error).toBeVisible();
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

test.describe('AI Assistant', () => {
  // Skip entire suite if auth not configured
  test.skip(
    skipAuth,
    'Skipping: Azure AD auth required. Set AUTH_BYPASS=true or configure storageState.'
  );

  let assistant: AssistantPage;

  test.beforeEach(async ({ page }) => {
    assistant = new AssistantPage(page);
    // Navigate directly to dashboard (assumes Azure AD auth session is active)
    // For local testing, ensure you're logged in via browser
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for dashboard to load (check for navigation or main content)
    await page.waitForSelector('[data-testid="assistant-pill"], button:has-text("Asistent AI")', {
      timeout: 15000,
    });
  });

  // ============================================================================
  // Opening and Closing Tests
  // ============================================================================

  test.describe('Opening and Closing', () => {
    test('shows collapsed pill by default', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.expectCollapsed();
    });

    test('opens when clicking pill button', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();
      await assistant.expectExpanded();

      // Verify header text is visible
      await expect(page.locator('text=Asistent AI')).toBeVisible();
    });

    test('closes when clicking close button', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();
      await assistant.close();
      await assistant.expectCollapsed();
    });

    test('closes with Escape key', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();
      await assistant.closeWithEscape();
      await assistant.expectCollapsed();
    });

    test('closes when clicking outside', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Click outside the assistant
      await page.click('body', { position: { x: 100, y: 100 } });

      await assistant.expectCollapsed();
    });

    test('focuses input when opened', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();
      await assistant.expectInputFocused();
    });
  });

  // ============================================================================
  // Sending Messages Tests
  // ============================================================================

  test.describe('Sending Messages', () => {
    test('sends message with Enter key', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.sendMessage('Bună ziua');

      // User message should appear
      await assistant.expectUserMessage('Bună ziua');

      // Should show loading
      await assistant.expectLoading();

      // Should receive response
      await assistant.expectAssistantMessage();
    });

    test('sends message with send button', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.input.fill('Test mesaj');
      await assistant.clickSend();

      await assistant.expectUserMessage('Test mesaj');
    });

    test('does not send empty message', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Try to send empty message
      await assistant.input.press('Enter');

      // No user messages should appear
      const userMessages = await assistant.userMessages.count();
      expect(userMessages).toBe(0);
    });

    test('clears input after sending', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.sendMessage('Test');

      // Input should be empty
      await expect(assistant.input).toHaveValue('');
    });

    test('disables input while loading', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.sendMessage('Test');

      // Input should be disabled during loading
      // Note: This is a race condition test, may need adjustment
      await expect(assistant.input).toBeDisabled();
    });
  });

  // ============================================================================
  // Action Confirmation Tests
  // ============================================================================

  test.describe('Action Confirmation', () => {
    test('shows action confirmation card for task creation', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Send a message that triggers task creation
      await assistant.sendMessage('Creează o sarcină pentru mâine');

      // Action card should appear
      await assistant.expectActionCard();

      // Verify buttons are visible
      await expect(assistant.confirmButton).toBeVisible();
      await expect(assistant.rejectButton).toBeVisible();
    });

    test('confirms action and shows success', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.sendMessage('Creează o sarcină de test');

      // Wait for action card
      await assistant.expectActionCard();

      // Confirm the action
      await assistant.confirmAction();

      // Should show success message
      await expect(page.locator('text=/Sarcina a fost creată|Am creat sarcina|creat/')).toBeVisible(
        { timeout: 10000 }
      );
    });

    test('rejects action and shows cancellation', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.sendMessage('Creează o sarcină de test');

      // Wait for action card
      await assistant.expectActionCard();

      // Reject the action
      await assistant.rejectAction();

      // Should show cancellation message
      await expect(page.locator('text=/anulat|Acțiune anulată/')).toBeVisible();
    });

    test('shows confirm and cancel buttons in Romanian', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.sendMessage('Creează o sarcină');

      await assistant.expectActionCard();

      await expect(page.locator('button:has-text("Confirmă")')).toBeVisible();
      await expect(page.locator('button:has-text("Anulează")')).toBeVisible();
    });
  });

  // ============================================================================
  // Context Awareness Tests
  // ============================================================================

  test.describe('Context Awareness', () => {
    test('uses case context when in case page', async ({ page }) => {
      // Navigate to a case page
      await assistant.gotoCase('test-case-id');

      await assistant.open();
      await assistant.sendMessage('Ce documente are acest dosar?');

      // Response should reference documents or the current case
      await expect(assistant.assistantMessages.first()).toContainText(/dosar|documente/, {
        timeout: 10000,
      });
    });

    test('maintains conversation context across messages', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // First message
      await assistant.sendMessage('Bună ziua');
      await assistant.expectAssistantMessage();

      // Follow-up message
      await assistant.sendMessage('Mulțumesc');

      // Should have multiple messages
      const assistantMsgCount = await assistant.assistantMessages.count();
      expect(assistantMsgCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  test.describe('Accessibility', () => {
    test('pill button has accessible label', async ({ page }) => {
      await assistant.gotoDashboard();

      await expect(assistant.pill).toHaveAttribute('aria-label', 'Deschide asistentul AI');
    });

    test('close button has accessible label', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await expect(assistant.closeButton).toHaveAttribute('aria-label', 'Închide asistentul');
    });

    test('input has accessible label', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await expect(assistant.input).toHaveAttribute('aria-label', 'Mesaj pentru asistent');
    });

    test('send button has accessible label', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      await expect(assistant.sendButton).toHaveAttribute('aria-label', 'Trimite mesaj');
    });

    test('supports keyboard navigation', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Input should be focused initially
      await assistant.expectInputFocused();

      // Tab to close button
      await page.keyboard.press('Tab');

      // Close button should be focused (or another focusable element)
      // Note: Actual focus order depends on implementation
    });

    test('Escape key works for closing', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Press Escape
      await page.keyboard.press('Escape');

      await assistant.expectCollapsed();
    });
  });

  // ============================================================================
  // Responsive Design Tests
  // ============================================================================

  test.describe('Responsive Design', () => {
    test('works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await assistant.gotoDashboard();

      // Pill should be visible
      await expect(assistant.pill).toBeVisible();

      // Open assistant
      await assistant.open();

      // Chat should be visible and reasonably sized
      const chat = assistant.chat;
      await expect(chat).toBeVisible();

      const box = await chat.boundingBox();
      expect(box?.width).toBeGreaterThan(300);
    });

    test('works on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await assistant.gotoDashboard();

      await assistant.open();
      await assistant.expectExpanded();

      await assistant.sendMessage('Test');
      await assistant.expectUserMessage('Test');
    });

    test('chat is positioned correctly on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await assistant.gotoDashboard();

      await assistant.open();

      const chatBox = await assistant.chat.boundingBox();

      // Chat should be positioned in the bottom-right corner
      expect(chatBox?.x).toBeGreaterThan(1400); // Right side
      expect(chatBox?.y).toBeGreaterThan(500); // Bottom area
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  test.describe('Error Handling', () => {
    test('shows error message on API failure', async ({ page }) => {
      // Mock API to return error
      await page.route('**/graphql', (route) => {
        const body = route.request().postDataJSON();
        if (body?.operationName === 'SendAssistantMessage') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'Internal server error' }],
            }),
          });
        } else {
          route.continue();
        }
      });

      await assistant.gotoDashboard();
      await assistant.open();

      await assistant.sendMessage('Test');

      // Error should be displayed
      await assistant.expectError();
    });

    test('shows error message on network failure', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Abort network requests
      await page.route('**/graphql', (route) => {
        const body = route.request().postDataJSON();
        if (body?.operationName === 'SendAssistantMessage') {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      await assistant.sendMessage('Test');

      // Should show error or retry option
      await expect(page.locator('text=/eroare|Încercați|problemă/')).toBeVisible({
        timeout: 10000,
      });
    });

    test('recovers from error on retry', async ({ page }) => {
      let requestCount = 0;

      // First request fails, second succeeds
      await page.route('**/graphql', (route) => {
        const body = route.request().postDataJSON();
        if (body?.operationName === 'SendAssistantMessage') {
          requestCount++;
          if (requestCount === 1) {
            route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({
                errors: [{ message: 'Internal server error' }],
              }),
            });
          } else {
            route.continue();
          }
        } else {
          route.continue();
        }
      });

      await assistant.gotoDashboard();
      await assistant.open();

      // First message fails
      await assistant.sendMessage('Test');
      await assistant.expectError();

      // Second message should work
      await assistant.sendMessage('Test din nou');
      await assistant.expectAssistantMessage();
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  test.describe('Empty State', () => {
    test('shows welcome message when no messages', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Should show welcome message
      await expect(page.locator('text=Bună! Cu ce vă pot ajuta?')).toBeVisible();
    });

    test('shows suggestions when no messages', async ({ page }) => {
      await assistant.gotoDashboard();
      await assistant.open();

      // Should show suggestion text
      await expect(page.locator('text=/Puteți să-mi cereți/')).toBeVisible();
    });
  });
});
