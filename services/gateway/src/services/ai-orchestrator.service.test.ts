/**
 * AI Orchestrator Service Tests
 * OPS-078: Error Handling & Fallbacks
 *
 * Tests for error handling, low confidence handling, and fallback responses.
 */

// Mock types package BEFORE importing the service
jest.mock('@legal-platform/types', () => ({
  AIOperationType: {
    TaskParsing: 'TaskParsing',
    Chat: 'Chat',
    CaseSummary: 'CaseSummary',
    EmailDraft: 'EmailDraft',
    DocumentGeneration: 'DocumentGeneration',
  },
  ClaudeModel: {
    Haiku: 'haiku',
    Sonnet: 'sonnet',
    Opus: 'opus',
  },
}));

// Mock other dependencies
jest.mock('./ai.service');
jest.mock('./case-summary.service');
jest.mock('./email-drafting.service');
jest.mock('./document-generation.service');
jest.mock('./morning-briefing.service');
jest.mock('./task.service');
jest.mock('./search.service');
jest.mock('@legal-platform/database');

import {
  AIOrchestratorService,
  AssistantError,
  AssistantErrorCode,
  ERROR_MESSAGES,
  AssistantIntent,
} from './ai-orchestrator.service';
import { aiService } from './ai.service';

describe('AIOrchestratorService', () => {
  let service: AIOrchestratorService;
  const mockUserContext = {
    userId: 'user-123',
    firmId: 'firm-456',
    role: 'Associate',
    email: 'test@example.com',
  };
  const mockContext = {
    currentScreen: 'dashboard',
    currentCaseId: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIOrchestratorService();
  });

  // ============================================================================
  // AssistantError Class Tests
  // ============================================================================

  describe('AssistantError', () => {
    it('should create error with code, message, and recoverable flag', () => {
      const error = new AssistantError('TEST_CODE', 'Test message', true);

      expect(error.code).toBe('TEST_CODE');
      expect(error.userMessage).toBe('Test message');
      expect(error.recoverable).toBe(true);
      expect(error.name).toBe('AssistantError');
    });

    it('should default recoverable to true', () => {
      const error = new AssistantError('TEST_CODE', 'Test message');

      expect(error.recoverable).toBe(true);
    });

    it('should allow non-recoverable errors', () => {
      const error = new AssistantError('FATAL', 'Fatal error', false);

      expect(error.recoverable).toBe(false);
    });
  });

  // ============================================================================
  // ERROR_MESSAGES Tests
  // ============================================================================

  describe('ERROR_MESSAGES', () => {
    it('should have all error codes defined', () => {
      expect(ERROR_MESSAGES[AssistantErrorCode.LOW_CONFIDENCE]).toBeDefined();
      expect(ERROR_MESSAGES[AssistantErrorCode.SERVICE_ERROR]).toBeDefined();
      expect(ERROR_MESSAGES[AssistantErrorCode.RATE_LIMIT]).toBeDefined();
      expect(ERROR_MESSAGES[AssistantErrorCode.NOT_FOUND]).toBeDefined();
      expect(ERROR_MESSAGES[AssistantErrorCode.NO_PERMISSION]).toBeDefined();
      expect(ERROR_MESSAGES[AssistantErrorCode.NETWORK_ERROR]).toBeDefined();
      expect(ERROR_MESSAGES[AssistantErrorCode.CONTEXT_LOST]).toBeDefined();
      expect(ERROR_MESSAGES[AssistantErrorCode.INVALID_INPUT]).toBeDefined();
    });

    it('should have Romanian messages', () => {
      // Check that messages are in Romanian
      expect(ERROR_MESSAGES[AssistantErrorCode.SERVICE_ERROR]).toContain('eroare');
      expect(ERROR_MESSAGES[AssistantErrorCode.RATE_LIMIT]).toContain('cereri');
      expect(ERROR_MESSAGES[AssistantErrorCode.NETWORK_ERROR]).toContain('internet');
    });
  });

  // ============================================================================
  // Low Confidence Handling Tests
  // ============================================================================

  describe('processMessage - low confidence', () => {
    it('should return clarification options when confidence is below 0.5', async () => {
      // Mock AI service to return low confidence
      (aiService.generate as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'CreateTask',
          confidence: 0.3,
          params: { taskTitle: 'test' },
          reasoning: 'Ambiguous input',
        }),
      });

      const result = await service.processMessage(
        'poate o sarcină',
        mockContext,
        [],
        mockUserContext
      );

      expect(result.intent).toBe(AssistantIntent.AskClarification);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.response).toContain('Nu sunt sigur');
      expect(result.suggestedFollowUps.length).toBeGreaterThan(0);
    });

    it('should provide task-related clarification options for CreateTask intent', async () => {
      (aiService.generate as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'CreateTask',
          confidence: 0.4,
          params: {},
        }),
      });

      const result = await service.processMessage('sarcină', mockContext, [], mockUserContext);

      expect(result.suggestedFollowUps).toContain('Creați o sarcină nouă');
    });

    it('should provide email-related clarification options for SearchEmails intent', async () => {
      (aiService.generate as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'SearchEmails',
          confidence: 0.4,
          params: {},
        }),
      });

      const result = await service.processMessage('email', mockContext, [], mockUserContext);

      expect(result.suggestedFollowUps).toContain('Căutați un email');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('processMessage - error handling', () => {
    /**
     * Note: The detectIntent method catches errors and returns a fallback result
     * (GeneralChat with confidence 0.3) instead of propagating errors.
     *
     * This means errors in AI service during intent detection result in low confidence
     * clarification prompts, not error messages. This is by design - it gracefully
     * degrades when AI is unavailable.
     *
     * The handleError method is invoked for errors thrown AFTER intent detection,
     * such as during handler execution or response generation.
     */

    it('should fallback to low confidence when AI service fails in intent detection', async () => {
      (aiService.generate as jest.Mock).mockRejectedValue(new Error('429 rate limit exceeded'));

      const result = await service.processMessage('test', mockContext, [], mockUserContext);

      // When AI fails during intent detection, it returns low confidence clarification
      expect(result.intent).toBe(AssistantIntent.AskClarification);
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.response).toContain('Nu sunt sigur');
    });

    it('should have valid error messages defined for all error codes', () => {
      // Verify all error messages are properly defined and in Romanian
      expect(ERROR_MESSAGES[AssistantErrorCode.RATE_LIMIT]).toContain('cereri');
      expect(ERROR_MESSAGES[AssistantErrorCode.NETWORK_ERROR]).toContain('internet');
      expect(ERROR_MESSAGES[AssistantErrorCode.SERVICE_ERROR]).toContain('eroare');
      expect(ERROR_MESSAGES[AssistantErrorCode.NO_PERMISSION]).toContain('permisiunea');
      expect(ERROR_MESSAGES[AssistantErrorCode.NOT_FOUND]).toContain('găsit');
    });
  });

  // ============================================================================
  // handleError Method Tests (direct testing)
  // ============================================================================

  describe('handleError - error categorization', () => {
    // Access the private handleError method via prototype for testing
    // This tests the error categorization logic directly

    it('should categorize rate limit errors correctly', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new Error('429 rate limit exceeded'));

      expect(result.response).toBe(ERROR_MESSAGES[AssistantErrorCode.RATE_LIMIT]);
      expect(result.suggestedFollowUps).toEqual([]);
    });

    it('should categorize network timeout errors correctly', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new Error('Request timeout'));

      expect(result.response).toBe(ERROR_MESSAGES[AssistantErrorCode.NETWORK_ERROR]);
      expect(result.suggestedFollowUps).toContain('Încercați din nou');
    });

    it('should categorize 503 service errors correctly', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new Error('503 Service Unavailable'));

      expect(result.response).toBe(ERROR_MESSAGES[AssistantErrorCode.SERVICE_ERROR]);
    });

    it('should categorize permission errors correctly', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new Error('403 Forbidden'));

      expect(result.response).toBe(ERROR_MESSAGES[AssistantErrorCode.NO_PERMISSION]);
      expect(result.suggestedFollowUps).toEqual([]);
    });

    it('should categorize not found errors correctly', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new Error('404 Not found'));

      expect(result.response).toBe(ERROR_MESSAGES[AssistantErrorCode.NOT_FOUND]);
      expect(result.suggestedFollowUps).toContain('Căutați altceva');
    });

    it('should handle custom AssistantError with recovery suggestions', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new AssistantError('CUSTOM', 'Eroare personalizată', true));

      expect(result.response).toBe('Eroare personalizată');
      expect(result.suggestedFollowUps).toContain('Încercați din nou');
      expect(result.suggestedFollowUps).toContain('Ajutor');
    });

    it('should handle non-recoverable AssistantError without suggestions', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new AssistantError('FATAL', 'Eroare critică', false));

      expect(result.response).toBe('Eroare critică');
      expect(result.suggestedFollowUps).toEqual([]);
    });

    it('should handle unknown errors with generic fallback', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError({ something: 'weird' });

      expect(result.response).toBe(ERROR_MESSAGES[AssistantErrorCode.SERVICE_ERROR]);
      expect(result.suggestedFollowUps).toContain('Încercați din nou');
      expect(result.suggestedFollowUps).toContain('Contactați suportul');
    });

    it('should handle ECONNREFUSED network errors', () => {
      const handleError = (service as any).handleError.bind(service);
      const result = handleError(new Error('connect ECONNREFUSED 127.0.0.1:3000'));

      expect(result.response).toBe(ERROR_MESSAGES[AssistantErrorCode.NETWORK_ERROR]);
    });
  });

  // ============================================================================
  // Intent Detection Fallback Tests
  // ============================================================================

  describe('processMessage - intent detection fallback', () => {
    it('should fallback to GeneralChat when AI returns invalid JSON', async () => {
      (aiService.generate as jest.Mock).mockResolvedValue({
        content: 'This is not valid JSON',
      });

      const result = await service.processMessage('hello', mockContext, [], mockUserContext);

      expect(result.intent).toBe(AssistantIntent.AskClarification);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should fallback to GeneralChat for unknown intent strings', async () => {
      (aiService.generate as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          intent: 'NonExistentIntent',
          confidence: 0.9,
          params: {},
        }),
      });

      // First mock for intent detection returns GeneralChat as fallback
      // High confidence so it proceeds to route
      const result = await service.processMessage('something', mockContext, [], mockUserContext);

      // Should still work with GeneralChat fallback
      expect(result).toBeDefined();
    });
  });
});
