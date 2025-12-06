/**
 * Email Drafting E2E Tests
 * Story 5.3: AI-Powered Email Drafting - Task 30
 *
 * End-to-end tests for AI-powered email drafting features.
 *
 * NOTE: These tests use mocked GraphQL responses for CI/CD environments.
 * For production validation, use the manual test plan below.
 *
 * =============================================================================
 * MANUAL TEST PLAN - AI Email Drafting Testing
 * =============================================================================
 *
 * PREREQUISITES:
 * 1. Platform running with authentication enabled
 * 2. Microsoft Graph API connected with valid OAuth token
 * 3. AI service running with Claude API access
 * 4. Test email account with received emails
 *
 * TEST SCENARIOS:
 *
 * TC-1: Basic Draft Generation
 * ----------------------------------------
 * Steps:
 * 1. Navigate to email inbox
 * 2. Open an email thread
 * 3. Click "Reply with AI" button
 * 4. Wait for draft generation panel to appear
 * 5. Select "Professional" tone
 * 6. Click "Generate"
 * 7. Review generated draft
 * Expected Result:
 * - Draft generated within 5 seconds
 * - Subject prefixed with "Re:"
 * - Body addresses email content
 * - Confidence score displayed
 *
 * TC-2: Multiple Drafts Generation
 * ----------------------------------------
 * Steps:
 * 1. Open an email thread
 * 2. Click "Reply with AI"
 * 3. Click "Generate 3 Variations"
 * 4. Wait for all drafts to generate
 * 5. Review each draft variant
 * Expected Result:
 * - Three drafts generated (Formal, Professional, Brief)
 * - Recommended tone highlighted
 * - Can switch between drafts
 *
 * TC-3: Draft Refinement
 * ----------------------------------------
 * Steps:
 * 1. Generate a draft
 * 2. Type refinement instruction: "Make it shorter"
 * 3. Click "Refine"
 * 4. Review refined draft
 * Expected Result:
 * - Draft updated with shorter content
 * - Refinement history tracked
 * - Token usage updated
 *
 * TC-4: Quick Refinement Actions
 * ----------------------------------------
 * Steps:
 * 1. Generate a draft
 * 2. Click "More Formal" quick action
 * 3. Click "More Detailed" quick action
 * 4. Click "Translate to Romanian"
 * Expected Result:
 * - Each action refines the draft
 * - Changes visible immediately
 *
 * TC-5: Attachment Suggestions
 * ----------------------------------------
 * Steps:
 * 1. Open email related to a case with documents
 * 2. Generate a draft
 * 3. Review attachment suggestions panel
 * 4. Select suggested attachments
 * Expected Result:
 * - Relevant documents suggested
 * - Relevance scores displayed
 * - Selection persists
 *
 * TC-6: Inline Suggestions
 * ----------------------------------------
 * Steps:
 * 1. Generate a draft
 * 2. Start editing the draft body
 * 3. Type partial sentence
 * 4. Wait for inline suggestion to appear
 * 5. Press Tab to accept
 * Expected Result:
 * - Suggestion appears after typing
 * - Tab inserts suggestion
 * - Escape dismisses suggestion
 *
 * TC-7: Send Draft
 * ----------------------------------------
 * Steps:
 * 1. Generate a draft
 * 2. Review and optionally edit
 * 3. Click "Send"
 * 4. Confirm sending
 * Expected Result:
 * - Email sent via Graph API
 * - Draft status updated to "Sent"
 * - Email appears in Sent folder
 *
 * TC-8: Discard Draft
 * ----------------------------------------
 * Steps:
 * 1. Generate a draft
 * 2. Click "Discard"
 * 3. Confirm discarding
 * Expected Result:
 * - Draft status updated to "Discarded"
 * - User returns to email view
 *
 * TC-9: Tone Selection for Court
 * ----------------------------------------
 * Steps:
 * 1. Open email from court (instanță)
 * 2. Click "Reply with AI"
 * 3. Verify "Formal" is recommended
 * 4. Generate draft
 * Expected Result:
 * - Formal tone auto-recommended
 * - Draft uses formal Romanian language
 * - Proper court salutation used
 *
 * TC-10: Recipient Type Detection
 * ----------------------------------------
 * Steps:
 * 1. Open email from opposing counsel
 * 2. Click "Reply with AI"
 * 3. Review detected recipient type
 * Expected Result:
 * - Recipient type shown as "Opposing Counsel"
 * - Appropriate tone suggested
 *
 * =============================================================================
 */

import { test, expect } from '@playwright/test';

// Base URL for tests
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test data
const mockEmail = {
  id: 'email-test-123',
  graphMessageId: 'graph-msg-123',
  subject: 'Dosarul nr. 12345/3/2025 - Citație',
  bodyContent: `Stimate Domn Avocat,

Prin prezenta, vă aducem la cunoștință că în dosarul nr. 12345/3/2025,
având ca obiect acțiune civilă, s-a stabilit termen de judecată pentru data de 15.12.2025.

Cu stimă,
Grefier Principal`,
  from: { name: 'Grefier', address: 'grefier@tribunal-bucuresti.ro' },
  toRecipients: [{ name: 'Avocat', address: 'avocat@bojin.law' }],
  receivedDateTime: new Date().toISOString(),
};

const mockGeneratedDraft = {
  id: 'draft-test-123',
  emailId: mockEmail.id,
  subject: 'Re: Dosarul nr. 12345/3/2025 - Citație',
  body: `Onorată Instanță,

Confirmăm primirea citației pentru termenul din data de 15.12.2025 în dosarul nr. 12345/3/2025.

Vom fi prezenți la termen și vom depune întâmpinarea în termenul legal.

Cu deosebit respect,
Avocat`,
  htmlBody: `<p>Onorată Instanță,</p><p>Confirmăm primirea citației pentru termenul din data de 15.12.2025 în dosarul nr. 12345/3/2025.</p><p>Vom fi prezenți la termen și vom depune întâmpinarea în termenul legal.</p><p>Cu deosebit respect,<br>Avocat</p>`,
  tone: 'Formal',
  recipientType: 'Court',
  confidence: 0.88,
  status: 'Generated',
  keyPointsAddressed: [
    'Confirmed receipt of citation',
    'Acknowledged court date',
    'Stated intent to file response',
  ],
  tokensUsed: { input: 800, output: 400 },
};

const mockMultipleDrafts = {
  drafts: [
    {
      tone: 'Formal',
      draft: { ...mockGeneratedDraft, tone: 'Formal' },
    },
    {
      tone: 'Professional',
      draft: {
        ...mockGeneratedDraft,
        id: 'draft-test-124',
        tone: 'Professional',
        body: 'Professional version of the draft...',
      },
    },
    {
      tone: 'Brief',
      draft: {
        ...mockGeneratedDraft,
        id: 'draft-test-125',
        tone: 'Brief',
        body: 'Brief version of the draft...',
      },
    },
  ],
  recommendedTone: 'Formal',
  recommendationReason: 'Court correspondence requires formal tone',
};

const mockRefinedDraft = {
  ...mockGeneratedDraft,
  body: 'Refined and shortened draft content...',
  status: 'Editing',
};

const mockAttachmentSuggestions = [
  {
    id: 'sugg-1',
    documentId: 'doc-1',
    title: 'Contract Agreement.pdf',
    reason: 'Highly relevant - mentioned in case documents',
    relevanceScore: 0.92,
    isSelected: false,
    document: { id: 'doc-1', fileName: 'Contract Agreement.pdf', fileType: 'PDF' },
  },
  {
    id: 'sugg-2',
    documentId: 'doc-2',
    title: 'Prior Correspondence.pdf',
    reason: 'Previous court communication',
    relevanceScore: 0.75,
    isSelected: false,
    document: { id: 'doc-2', fileName: 'Prior Correspondence.pdf', fileType: 'PDF' },
  },
];

const mockInlineSuggestion = {
  type: 'completion',
  suggestion: ' și vom depune documentele solicitate.',
  confidence: 0.82,
  reason: 'Common phrase completion in legal context',
};

// GraphQL response helpers
function getMockEmailResponse() {
  return {
    data: {
      email: mockEmail,
    },
  };
}

function getMockDraftResponse() {
  return {
    data: {
      generateEmailDraft: mockGeneratedDraft,
    },
  };
}

function getMockMultipleDraftsResponse() {
  return {
    data: {
      generateMultipleDrafts: mockMultipleDrafts,
    },
  };
}

function getMockRefinedDraftResponse() {
  return {
    data: {
      refineDraft: mockRefinedDraft,
    },
  };
}

function getMockAttachmentSuggestionsResponse() {
  return {
    data: {
      attachmentSuggestions: mockAttachmentSuggestions,
    },
  };
}

function getMockInlineSuggestionResponse() {
  return {
    data: {
      getInlineSuggestion: mockInlineSuggestion,
    },
  };
}

function getMockSendDraftResponse() {
  return {
    data: {
      sendDraft: true,
    },
  };
}

test.describe('Email Drafting', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      (window as any).__mockUser = {
        id: 'user-test-123',
        role: 'Associate',
        firstName: 'Test',
        lastName: 'Avocat',
        firmId: 'firm-test-123',
        accessToken: 'mock-access-token',
      };
    });
  });

  test.describe('Draft Generation Panel', () => {
    test('should display Reply with AI button in email view', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('email')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.waitForLoadState('networkidle');

      // Check for Reply with AI button
      const replyButton = page.locator('button:has-text("Răspunde cu AI")');
      await expect(replyButton).toBeVisible({ timeout: 10000 });
    });

    test('should open draft generation panel on button click', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('email')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.waitForLoadState('networkidle');

      // Click Reply with AI
      await page.click('button:has-text("Răspunde cu AI")');

      // Verify panel appears
      await expect(page.locator('[data-testid="draft-generation-panel"]')).toBeVisible();
      await expect(page.locator('text=Ton')).toBeVisible();
    });

    test('should display tone selection options', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockEmailResponse()),
        });
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');

      // Check tone options
      await expect(page.locator('button:has-text("Formal")')).toBeVisible();
      await expect(page.locator('button:has-text("Profesional")')).toBeVisible();
      await expect(page.locator('button:has-text("Concis")')).toBeVisible();
      await expect(page.locator('button:has-text("Detaliat")')).toBeVisible();
    });
  });

  test.describe('Single Draft Generation', () => {
    test('should generate draft with selected tone', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else if (body?.query?.includes('email')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');

      // Select Formal tone
      await page.click('button:has-text("Formal")');

      // Generate draft
      await page.click('button:has-text("Generează")');

      // Wait for draft to appear
      await expect(page.locator('[data-testid="email-composer"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Onorată Instanță')).toBeVisible();
    });

    test('should display confidence score', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Check confidence score
      await expect(page.locator('text=88%')).toBeVisible();
    });

    test('should show loading state during generation', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('generateEmailDraft')) {
          // Delay response to see loading state
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Check loading indicator
      await expect(page.locator('.animate-spin')).toBeVisible();
    });
  });

  test.describe('Multiple Drafts', () => {
    test('should generate three draft variations', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('generateMultipleDrafts')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockMultipleDraftsResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');

      // Generate multiple
      await page.click('button:has-text("3 Variante")');

      // Check all three drafts appear
      await expect(page.locator('[data-testid="draft-option-Formal"]')).toBeVisible();
      await expect(page.locator('[data-testid="draft-option-Professional"]')).toBeVisible();
      await expect(page.locator('[data-testid="draft-option-Brief"]')).toBeVisible();
    });

    test('should highlight recommended tone', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('generateMultipleDrafts')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockMultipleDraftsResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("3 Variante")');

      // Check recommended badge
      await expect(page.locator('text=Recomandat')).toBeVisible();
    });
  });

  test.describe('Draft Refinement', () => {
    test('should refine draft with instruction', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('refineDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockRefinedDraftResponse()),
          });
        } else if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Wait for composer
      await expect(page.locator('[data-testid="email-composer"]')).toBeVisible();

      // Type refinement instruction
      await page.fill('input[placeholder*="rafinare"]', 'Mai scurt');
      await page.click('button:has-text("Rafinează")');

      // Wait for refined content
      await expect(page.locator('text=Refined')).toBeVisible({ timeout: 10000 });
    });

    test('should use quick refinement actions', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('refineDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockRefinedDraftResponse()),
          });
        } else if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Click quick action
      await page.click('button:has-text("Mai formal")');

      // Verify refinement triggered
      await expect(page.locator('[data-testid="draft-status"]')).toContainText('Editing');
    });
  });

  test.describe('Attachment Suggestions', () => {
    test('should display attachment suggestions', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('attachmentSuggestions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockAttachmentSuggestionsResponse()),
          });
        } else if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Check suggestions panel
      await expect(page.locator('text=Contract Agreement.pdf')).toBeVisible();
      await expect(page.locator('text=Prior Correspondence.pdf')).toBeVisible();
    });

    test('should toggle attachment selection', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('attachmentSuggestions')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockAttachmentSuggestionsResponse()),
          });
        } else if (body?.query?.includes('selectAttachment')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                selectAttachment: { ...mockAttachmentSuggestions[0], isSelected: true },
              },
            }),
          });
        } else if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Click checkbox
      const checkbox = page.locator('input[type="checkbox"]').first();
      await checkbox.click();

      // Verify checked
      await expect(checkbox).toBeChecked();
    });
  });

  test.describe('Send and Discard', () => {
    test('should send draft successfully', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('sendDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockSendDraftResponse()),
          });
        } else if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');
      await expect(page.locator('[data-testid="email-composer"]')).toBeVisible();

      // Send draft
      await page.click('button:has-text("Trimite")');

      // Check success message or redirect
      await expect(page.locator('text=trimis')).toBeVisible({ timeout: 10000 });
    });

    test('should discard draft successfully', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('discardDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { discardDraft: true } }),
          });
        } else if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockDraftResponse()),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');
      await expect(page.locator('[data-testid="email-composer"]')).toBeVisible();

      // Discard draft
      await page.click('button:has-text("Anulează")');

      // Check composer closed
      await expect(page.locator('[data-testid="email-composer"]')).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper focus management', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockEmailResponse()),
        });
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');

      // Check focus is in panel
      const panel = page.locator('[data-testid="draft-generation-panel"]');
      await expect(panel).toBeVisible();

      // Tab through elements
      await page.keyboard.press('Tab');
      await expect(page.locator('button:has-text("Formal")')).toBeFocused();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(getMockEmailResponse()),
        });
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');

      // Use keyboard to select tone
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Select Formal

      // Verify selection
      const formalButton = page.locator('button:has-text("Formal")');
      await expect(formalButton).toHaveClass(/border-blue-500/);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message on AI failure', async ({ page }) => {
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('generateEmailDraft')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'AI service unavailable' }],
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Check error message
      await expect(page.locator('text=eroare')).toBeVisible({ timeout: 10000 });
    });

    test('should allow retry after error', async ({ page }) => {
      let callCount = 0;
      await page.route('**/graphql**', async (route) => {
        const request = route.request();
        const body = request.postDataJSON();

        if (body?.query?.includes('generateEmailDraft')) {
          callCount++;
          if (callCount === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ errors: [{ message: 'Error' }] }),
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(getMockDraftResponse()),
            });
          }
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockEmailResponse()),
          });
        }
      });

      await page.goto(`${BASE_URL}/emails/${mockEmail.id}`);
      await page.click('button:has-text("Răspunde cu AI")');
      await page.click('button:has-text("Generează")');

      // Wait for error
      await expect(page.locator('text=eroare')).toBeVisible();

      // Retry
      await page.click('button:has-text("Generează")');

      // Should succeed
      await expect(page.locator('[data-testid="email-composer"]')).toBeVisible({ timeout: 10000 });
    });
  });
});
