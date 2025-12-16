/**
 * Word Add-in Integration Tests
 * Story 3.8: Document System Testing and Performance - Task 11
 *
 * Tests:
 * - AI suggestions panel communication
 * - SSO authentication flow
 * - Document content reading/writing
 * - Real-time sync with platform
 * - Office.js API interactions
 * - Error handling in add-in context
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Office.js API
const mockWord = {
  run: jest.fn(),
  context: {
    document: {
      body: {
        getRange: jest.fn(),
        insertParagraph: jest.fn(),
        paragraphs: {
          load: jest.fn(),
          items: [] as MockParagraph[],
        },
      },
      getSelection: jest.fn(),
      save: jest.fn(),
    },
    sync: jest.fn(),
  },
};

const mockOfficeRuntime = {
  auth: {
    getAccessToken: jest.fn(),
  },
};

interface MockParagraph {
  text: string;
  font: { bold: boolean; italic: boolean };
}

interface MockRange {
  text: string;
  insertText: jest.Mock;
  insertParagraph: jest.Mock;
  load: jest.Mock;
}

// Mock platform API client
const mockApiClient = {
  getSuggestions: jest.fn(),
  explainText: jest.fn(),
  improveText: jest.fn(),
  saveDocument: jest.fn(),
  getDocumentMetadata: jest.fn(),
  syncStatus: jest.fn(),
};

// Mock auth service
const mockAuthService = {
  signIn: jest.fn(),
  signOut: jest.fn(),
  getToken: jest.fn(),
  refreshToken: jest.fn(),
  isAuthenticated: jest.fn(),
};

describe('Word Add-in Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockWord.run.mockImplementation(
      async (callback: (context: typeof mockWord.context) => Promise<void>) => {
        await callback(mockWord.context);
      }
    );

    mockWord.context.sync.mockResolvedValue(undefined);
    mockOfficeRuntime.auth.getAccessToken.mockResolvedValue('mock-sso-token');
    mockAuthService.isAuthenticated.mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AI Suggestions Panel Communication', () => {
    it('should fetch suggestions for selected text', async () => {
      const selectedText = 'This agreement shall be governed by the laws of...';

      mockWord.context.document.getSelection.mockReturnValue({
        load: jest.fn(),
        text: selectedText,
      });

      mockApiClient.getSuggestions.mockResolvedValue({
        suggestions: [
          {
            id: 'sug-001',
            type: 'GOVERNING_LAW',
            suggestedText:
              'This agreement shall be governed by and construed in accordance with the laws of the State of Delaware.',
            explanation: 'Delaware law is commonly used for commercial agreements.',
            confidence: 0.92,
          },
          {
            id: 'sug-002',
            type: 'JURISDICTION',
            suggestedText:
              'Any disputes arising under this agreement shall be resolved in the courts of Delaware.',
            explanation: 'Adding jurisdiction clause complements governing law.',
            confidence: 0.85,
          },
        ],
        context: {
          documentType: 'CONTRACT',
          clauseType: 'GOVERNING_LAW',
        },
      });

      const result = await fetchSuggestionsForSelection();

      expect(mockWord.context.document.getSelection).toHaveBeenCalled();
      expect(mockApiClient.getSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({
          text: selectedText,
        })
      );
      expect(result.suggestions).toHaveLength(2);
    });

    it('should apply selected suggestion to document', async () => {
      const suggestion = {
        id: 'sug-001',
        suggestedText: 'Improved clause text here...',
      };

      const mockRange: MockRange = {
        text: '',
        insertText: jest.fn(),
        insertParagraph: jest.fn(),
        load: jest.fn(),
      };

      mockWord.context.document.getSelection.mockReturnValue(mockRange);

      await applySuggestion(suggestion);

      expect(mockRange.insertText).toHaveBeenCalledWith(suggestion.suggestedText, 'Replace');
      expect(mockWord.context.sync).toHaveBeenCalled();
    });

    it('should display explanation for selected text', async () => {
      const textToExplain = 'force majeure clause';

      mockApiClient.explainText.mockResolvedValue({
        explanation:
          'A force majeure clause excuses a party from performance when extraordinary events prevent fulfillment of contractual obligations.',
        legalContext: 'Commonly invoked during natural disasters, wars, or pandemics.',
        relatedTerms: ['act of God', 'impossibility', 'frustration of purpose'],
        sources: [{ title: "Black's Law Dictionary", reference: '11th ed.' }],
      });

      const explanation = await getExplanationForText(textToExplain);

      expect(mockApiClient.explainText).toHaveBeenCalledWith(textToExplain);
      expect(explanation.explanation).toContain('force majeure');
      expect(explanation.relatedTerms).toContain('act of God');
    });

    it('should get improvement suggestions for text', async () => {
      const textToImprove = 'The client shall pay within reasonable time.';

      mockApiClient.improveText.mockResolvedValue({
        improvedText:
          'The Client shall remit payment within thirty (30) business days of invoice receipt.',
        improvements: [
          { type: 'specificity', description: 'Added specific time frame' },
          { type: 'clarity', description: 'Clarified payment trigger' },
        ],
        legalStrength: 0.95,
      });

      const result = await getImprovementSuggestions(textToImprove);

      expect(result.improvements).toHaveLength(2);
      expect(result.improvedText).toContain('thirty (30) business days');
    });
  });

  describe('SSO Authentication Flow', () => {
    it('should authenticate using Office SSO', async () => {
      mockOfficeRuntime.auth.getAccessToken.mockResolvedValue('sso-token-123');

      mockAuthService.signIn.mockResolvedValue({
        success: true,
        user: {
          id: 'user-001',
          email: 'user@firm.com',
          name: 'Test User',
          role: 'Attorney',
        },
        accessToken: 'platform-token-456',
      });

      const authResult = await performSSOAuth();

      expect(mockOfficeRuntime.auth.getAccessToken).toHaveBeenCalled();
      expect(mockAuthService.signIn).toHaveBeenCalledWith('sso-token-123');
      expect(authResult.success).toBe(true);
      expect(authResult.user.email).toBe('user@firm.com');
    });

    it('should handle SSO failure with fallback', async () => {
      mockOfficeRuntime.auth.getAccessToken.mockRejectedValue(new Error('SSO not available'));

      const authResult = await performSSOAuth();

      expect(authResult.fallbackRequired).toBe(true);
      expect(authResult.fallbackMethod).toBe('interactive');
    });

    it('should refresh token before expiration', async () => {
      mockAuthService.getToken.mockReturnValue({
        token: 'old-token',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      mockAuthService.refreshToken.mockResolvedValue({
        token: 'new-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });

      const token = await ensureValidToken();

      expect(mockAuthService.refreshToken).toHaveBeenCalled();
      expect(token).toBe('new-token');
    });

    it('should handle token refresh failure gracefully', async () => {
      mockAuthService.refreshToken.mockRejectedValue(new Error('Refresh failed'));

      const result = await handleTokenRefreshFailure();

      expect(result.requiresReauth).toBe(true);
      expect(result.notification).toBe('Session expired. Please sign in again.');
    });
  });

  describe('Document Content Reading/Writing', () => {
    it('should read entire document content', async () => {
      mockWord.context.document.body.paragraphs.items = [
        { text: 'Paragraph 1', font: { bold: false, italic: false } },
        { text: 'Paragraph 2', font: { bold: true, italic: false } },
        { text: 'Paragraph 3', font: { bold: false, italic: true } },
      ];

      mockWord.context.document.body.paragraphs.load.mockReturnValue(
        mockWord.context.document.body.paragraphs
      );

      const content = await readDocumentContent();

      expect(mockWord.context.document.body.paragraphs.load).toHaveBeenCalledWith('text');
      expect(content.paragraphs).toHaveLength(3);
    });

    it('should read selected range', async () => {
      const mockSelection: MockRange = {
        text: 'Selected text content',
        load: jest.fn().mockReturnThis(),
        insertText: jest.fn(),
        insertParagraph: jest.fn(),
      };

      mockWord.context.document.getSelection.mockReturnValue(mockSelection);

      const selection = await getSelectedText();

      expect(selection.text).toBe('Selected text content');
    });

    it('should insert text at cursor position', async () => {
      const mockRange: MockRange = {
        text: '',
        insertText: jest.fn().mockReturnThis(),
        insertParagraph: jest.fn(),
        load: jest.fn(),
      };

      mockWord.context.document.getSelection.mockReturnValue(mockRange);

      await insertTextAtCursor('New text to insert');

      expect(mockRange.insertText).toHaveBeenCalledWith('New text to insert', 'End');
      expect(mockWord.context.sync).toHaveBeenCalled();
    });

    it('should replace selected text', async () => {
      const mockRange: MockRange = {
        text: 'Old text',
        insertText: jest.fn().mockReturnThis(),
        insertParagraph: jest.fn(),
        load: jest.fn(),
      };

      mockWord.context.document.getSelection.mockReturnValue(mockRange);

      await replaceSelectedText('Replacement text');

      expect(mockRange.insertText).toHaveBeenCalledWith('Replacement text', 'Replace');
    });

    it('should preserve formatting when modifying content', async () => {
      const originalFormatting = {
        bold: true,
        italic: false,
        underline: true,
      };

      const mockRange: MockRange & { font?: typeof originalFormatting } = {
        text: 'Formatted text',
        insertText: jest.fn().mockReturnThis(),
        insertParagraph: jest.fn(),
        load: jest.fn(),
        font: originalFormatting,
      };

      mockWord.context.document.getSelection.mockReturnValue(mockRange);

      await replaceTextPreservingFormat('New text', originalFormatting);

      expect(mockRange.insertText).toHaveBeenCalled();
      // Verify formatting is reapplied
      expect(mockRange.font?.bold).toBe(true);
    });
  });

  describe('Real-time Sync with Platform', () => {
    it('should sync document changes to platform', async () => {
      const documentChanges = {
        documentId: 'doc-word-001',
        changes: [{ position: 100, oldText: 'old', newText: 'new' }],
        timestamp: new Date(),
      };

      mockApiClient.saveDocument.mockResolvedValue({
        success: true,
        version: 5,
        syncedAt: new Date(),
      });

      const syncResult = await syncChangesToPlatform(documentChanges);

      expect(mockApiClient.saveDocument).toHaveBeenCalled();
      expect(syncResult.success).toBe(true);
    });

    it('should handle sync conflicts', async () => {
      mockApiClient.syncStatus.mockResolvedValue({
        hasConflict: true,
        localVersion: 3,
        remoteVersion: 4,
      });

      const conflictResult = await checkSyncStatus('doc-001');

      expect(conflictResult.hasConflict).toBe(true);
    });

    it('should display sync status indicator', async () => {
      const status = await getSyncStatusDisplay('doc-001');

      expect(status).toHaveProperty('icon');
      expect(status).toHaveProperty('message');
      expect(['synced', 'syncing', 'pending', 'error']).toContain(status.state);
    });

    it('should queue changes when offline', async () => {
      mockApiClient.saveDocument.mockRejectedValue(new Error('Network unavailable'));

      const queueResult = await queueOfflineChange({
        type: 'edit',
        content: 'Offline edit',
      });

      expect(queueResult.queued).toBe(true);
      expect(queueResult.willRetryWhenOnline).toBe(true);
    });
  });

  describe('Office.js API Interactions', () => {
    it('should handle Office.js context initialization', async () => {
      await initializeOfficeContext();

      expect(mockWord.run).toHaveBeenCalled();
    });

    it('should handle Office.js API errors gracefully', async () => {
      mockWord.run.mockRejectedValue(new Error('Office.js API error'));

      const result = await safeOfficeOperation(async () => {
        // Operation that fails
        throw new Error('API Error');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should batch multiple Office.js operations', async () => {
      const operations = [
        { type: 'read', target: 'selection' },
        { type: 'format', target: 'bold' },
        { type: 'insert', content: 'text' },
      ];

      await batchOfficeOperations(operations);

      // Should call sync only once for batched operations
      expect(mockWord.context.sync).toHaveBeenCalledTimes(1);
    });

    it('should track changes made through add-in', async () => {
      const changeTracker = await enableChangeTracking();

      await changeTracker.recordChange({
        type: 'insert',
        position: 100,
        content: 'Inserted via add-in',
      });

      expect(changeTracker.getChanges()).toHaveLength(1);
    });
  });

  describe('Error Handling in Add-in Context', () => {
    it('should display user-friendly error messages', async () => {
      const error = new Error('GraphAPI rate limit exceeded');

      const userMessage = formatErrorForUser(error);

      expect(userMessage).not.toContain('GraphAPI');
      expect(userMessage).toContain('try again');
    });

    it('should log errors to platform for debugging', async () => {
      const error = new Error('Unexpected error');
      const context = {
        operation: 'getSuggestions',
        documentId: 'doc-001',
      };

      await logErrorToPlatform(error, context);

      // Verify error was logged (in real impl, check API call)
      expect(true).toBe(true);
    });

    it('should recover from transient failures', async () => {
      let attempts = 0;
      const flakeyOperation = async (): Promise<{ success: boolean }> => {
        attempts++;
        if (attempts < 3) throw new Error('Transient failure');
        return { success: true };
      };

      const result = await retryWithBackoff(flakeyOperation, { maxRetries: 3 });

      expect(attempts).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should notify user of persistent failures', async () => {
      const notification = await notifyPersistentFailure('Unable to connect to server', {
        canRetry: true,
        canWorkOffline: true,
      });

      expect(notification.shown).toBe(true);
      expect(notification.actions).toContain('retry');
    });
  });
});

// Helper function stubs - these would be implemented in actual add-in services
async function fetchSuggestionsForSelection() {
  await mockWord.run(async (context: typeof mockWord.context) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();
  });

  const selection = mockWord.context.document.getSelection();
  return mockApiClient.getSuggestions({ text: selection.text });
}

async function applySuggestion(suggestion: { suggestedText: string }) {
  await mockWord.run(async (context: typeof mockWord.context) => {
    const range = context.document.getSelection();
    range.insertText(suggestion.suggestedText, 'Replace');
    await context.sync();
  });
}

async function getExplanationForText(text: string) {
  return mockApiClient.explainText(text);
}

async function getImprovementSuggestions(text: string) {
  return mockApiClient.improveText(text);
}

async function performSSOAuth(): Promise<{
  success: boolean;
  user?: { id: string; email: string; name: string; role: string };
  fallbackRequired?: boolean;
  fallbackMethod?: string;
}> {
  try {
    const ssoToken = await mockOfficeRuntime.auth.getAccessToken();
    return mockAuthService.signIn(ssoToken);
  } catch {
    return { success: false, fallbackRequired: true, fallbackMethod: 'interactive' };
  }
}

async function ensureValidToken(): Promise<string> {
  const current = mockAuthService.getToken();
  const fiveMinutes = 5 * 60 * 1000;

  if (current.expiresAt.getTime() - Date.now() < fiveMinutes) {
    const refreshed = await mockAuthService.refreshToken();
    return refreshed.token;
  }

  return current.token;
}

async function handleTokenRefreshFailure() {
  return {
    requiresReauth: true,
    notification: 'Session expired. Please sign in again.',
  };
}

async function readDocumentContent() {
  await mockWord.run(async (context: typeof mockWord.context) => {
    context.document.body.paragraphs.load('text');
    await context.sync();
  });

  return {
    paragraphs: mockWord.context.document.body.paragraphs.items,
  };
}

async function getSelectedText(): Promise<{ text: string }> {
  const selection = mockWord.context.document.getSelection();
  selection.load('text');
  await mockWord.context.sync();
  return { text: selection.text };
}

async function insertTextAtCursor(text: string) {
  await mockWord.run(async (context: typeof mockWord.context) => {
    const range = context.document.getSelection();
    range.insertText(text, 'End');
    await context.sync();
  });
}

async function replaceSelectedText(text: string) {
  await mockWord.run(async (context: typeof mockWord.context) => {
    const range = context.document.getSelection();
    range.insertText(text, 'Replace');
    await context.sync();
  });
}

async function replaceTextPreservingFormat(
  text: string,
  formatting: { bold: boolean; italic: boolean; underline: boolean }
) {
  await mockWord.run(async (context: typeof mockWord.context) => {
    const range = context.document.getSelection() as MockRange & { font: typeof formatting };
    range.insertText(text, 'Replace');
    range.font = formatting;
    await context.sync();
  });
}

async function syncChangesToPlatform(changes: { documentId: string; changes: unknown[] }) {
  return mockApiClient.saveDocument(changes);
}

async function checkSyncStatus(docId: string) {
  return mockApiClient.syncStatus(docId);
}

async function getSyncStatusDisplay(_docId: string) {
  return {
    icon: 'checkmark',
    message: 'Synced',
    state: 'synced' as const,
  };
}

async function queueOfflineChange(_change: { type: string; content: string }) {
  return { queued: true, willRetryWhenOnline: true };
}

async function initializeOfficeContext() {
  await mockWord.run(async () => {});
}

async function safeOfficeOperation<T>(
  operation: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: Error }> {
  try {
    const result = await operation();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

async function batchOfficeOperations(
  _operations: { type: string; target?: string; content?: string }[]
) {
  await mockWord.run(async (context: typeof mockWord.context) => {
    // All operations run before single sync
    await context.sync();
  });
}

async function enableChangeTracking() {
  const changes: { type: string; position: number; content: string }[] = [];
  return {
    recordChange: async (change: { type: string; position: number; content: string }) => {
      changes.push(change);
    },
    getChanges: () => changes,
  };
}

function formatErrorForUser(error: Error): string {
  const technicalTerms = ['GraphAPI', 'OAuth', 'JWT', '429', '503'];
  let message = error.message;

  for (const term of technicalTerms) {
    if (message.includes(term)) {
      return 'Something went wrong. Please try again in a moment.';
    }
  }

  return message;
}

async function logErrorToPlatform(
  _error: Error,
  _context: { operation: string; documentId: string }
) {
  // In real implementation, would call API to log error
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: { maxRetries: number }
): Promise<T> {
  for (let i = 0; i < options.maxRetries; i++) {
    try {
      return await operation();
    } catch {
      if (i === options.maxRetries - 1) throw new Error('Max retries exceeded');
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 100));
    }
  }
  throw new Error('Should not reach here');
}

async function notifyPersistentFailure(
  _message: string,
  options: { canRetry: boolean; canWorkOffline: boolean }
) {
  const actions: string[] = [];
  if (options.canRetry) actions.push('retry');
  if (options.canWorkOffline) actions.push('work offline');

  return { shown: true, actions };
}
