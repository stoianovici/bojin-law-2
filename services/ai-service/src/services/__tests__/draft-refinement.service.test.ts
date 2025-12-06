/**
 * Unit Tests for Draft Refinement Service
 * Story 5.3: AI-Powered Email Drafting - Task 26
 *
 * Tests draft refinement and inline suggestion functionality
 */

import {
  DraftRefinementService,
  type RefinementParams,
  type DraftContext,
  type InlineSuggestion,
} from '../draft-refinement.service';
import type { CaseContext } from '../email-drafting.service';

// Mock invoke function that we can configure in tests
let mockInvokeResponse: any = '';

// Mock dependencies - use factory functions to properly handle hoisting
jest.mock('../../lib/langchain/client', () => {
  const mockChain = {
    invoke: jest.fn().mockImplementation(() => Promise.resolve(mockInvokeResponse)),
  };
  const mockPipeResult = {
    pipe: jest.fn().mockReturnValue(mockChain),
  };
  return {
    createClaudeModel: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue(mockPipeResult),
    }),
    AICallbackHandler: jest.fn().mockImplementation(() => ({
      getMetrics: jest.fn().mockReturnValue({
        inputTokens: 500,
        outputTokens: 300,
        latencyMs: 800,
      }),
    })),
  };
});

jest.mock('@langchain/core/prompts', () => {
  const createMockPrompt = () => {
    const mockChain = {
      invoke: jest.fn().mockImplementation(() => Promise.resolve(mockInvokeResponse)),
    };
    const mockPipeResult = {
      pipe: jest.fn().mockReturnValue(mockChain),
    };
    return {
      pipe: jest.fn().mockReturnValue(mockPipeResult),
    };
  };
  return {
    ChatPromptTemplate: {
      fromMessages: jest.fn().mockImplementation(createMockPrompt),
    },
    SystemMessagePromptTemplate: {
      fromTemplate: jest.fn().mockReturnValue({}),
    },
    HumanMessagePromptTemplate: {
      fromTemplate: jest.fn().mockReturnValue({}),
    },
  };
});

jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../token-tracker.service', () => ({
  tokenTracker: {
    trackUsage: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../lib/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DraftRefinementService', () => {
  let service: DraftRefinementService;

  const mockCaseContext: CaseContext = {
    case: {
      id: 'case-123',
      title: 'Contract Dispute',
      caseNumber: '12345/3/2025',
      type: 'Civil',
      status: 'Active',
      client: {
        id: 'client-123',
        name: 'Ion Popescu',
      },
      opposingParties: [],
    },
    recentDocuments: [],
    priorCommunications: [],
    activeDeadlines: [],
    pendingTasks: [],
    extractedCommitments: [],
    riskIndicators: [],
  };

  const baseRefinementParams: RefinementParams = {
    draftId: 'draft-123',
    currentBody: 'Bună ziua,\n\nVă mulțumim pentru mesaj. Vom reveni cu un răspuns în curând.\n\nCu stimă,\nAvocat',
    instruction: 'Make it shorter',
    caseContext: mockCaseContext,
    firmId: 'firm-123',
    userId: 'user-123',
  };

  const baseDraftContext: DraftContext = {
    originalEmailSubject: 'Question about case status',
    originalEmailBody: 'Hello, I wanted to ask about the status of my case.',
    recipientType: 'Client',
    tone: 'Professional',
    caseTitle: 'Contract Dispute',
  };

  beforeEach(() => {
    service = new DraftRefinementService();
    jest.clearAllMocks();
  });

  describe('refineDraft', () => {
    // Helper to create properly chained mock
    const setupChainMock = (mockResponse: string) => {
      const mockChain = {
        invoke: jest.fn().mockResolvedValue(mockResponse),
      };
      // chatPrompt.pipe(model) returns { pipe: () => chain }
      // chatPrompt.pipe(model).pipe(parser) returns chain
      const mockModelWithPipe = {
        pipe: jest.fn().mockReturnValue(mockChain),
      };
      const { ChatPromptTemplate } = require('@langchain/core/prompts');
      ChatPromptTemplate.fromMessages.mockReturnValue({
        pipe: jest.fn().mockReturnValue(mockModelWithPipe),
      });
      return mockChain;
    };

    it('should refine a draft with the given instruction', async () => {
      const mockResponse = JSON.stringify({
        refinedBody: 'Bună ziua,\n\nVă mulțumim. Revenim curând.\n\nCu stimă',
        refinedHtmlBody: '<p>Bună ziua,</p><p>Vă mulțumim. Revenim curând.</p><p>Cu stimă</p>',
        changesApplied: ['Shortened greeting', 'Condensed main message'],
      });

      setupChainMock(mockResponse);

      const result = await service.refineDraft(baseRefinementParams);

      expect(result.refinedBody).toBe('Bună ziua,\n\nVă mulțumim. Revenim curând.\n\nCu stimă');
      expect(result.changesApplied).toHaveLength(2);
      expect(result.tokensUsed).toBe(800); // input + output
    });

    it('should track token usage', async () => {
      const mockResponse = JSON.stringify({
        refinedBody: 'Refined text',
        changesApplied: ['Changed'],
      });

      setupChainMock(mockResponse);

      const { tokenTracker } = require('../token-tracker.service');

      await service.refineDraft(baseRefinementParams);

      expect(tokenTracker.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 500,
          outputTokens: 300,
          firmId: 'firm-123',
          userId: 'user-123',
        })
      );
    });

    it('should handle parsing errors gracefully', async () => {
      setupChainMock('Invalid response without JSON');

      const result = await service.refineDraft(baseRefinementParams);

      // Should fallback to treating response as body
      expect(result.refinedBody).toBe('Invalid response without JSON');
    });

    it('should generate HTML if not provided in response', async () => {
      const mockResponse = JSON.stringify({
        refinedBody: 'First paragraph.\n\nSecond paragraph.',
        changesApplied: ['Simplified'],
      });

      setupChainMock(mockResponse);

      const result = await service.refineDraft(baseRefinementParams);

      expect(result.refinedHtmlBody).toContain('<p>First paragraph.</p>');
      expect(result.refinedHtmlBody).toContain('<p>Second paragraph.</p>');
    });
  });

  describe('getInlineSuggestions', () => {
    // Helper to create properly chained mock for inline suggestions
    const setupInlineMock = (mockResponse: string | Error) => {
      const mockChain = {
        invoke: mockResponse instanceof Error
          ? jest.fn().mockRejectedValue(mockResponse)
          : jest.fn().mockResolvedValue(mockResponse),
      };
      const mockModelWithPipe = {
        pipe: jest.fn().mockReturnValue(mockChain),
      };
      const { ChatPromptTemplate } = require('@langchain/core/prompts');
      ChatPromptTemplate.fromMessages.mockReturnValue({
        pipe: jest.fn().mockReturnValue(mockModelWithPipe),
      });
      return mockChain;
    };

    it('should return null for very short text', async () => {
      const result = await service.getInlineSuggestions(
        'Hi',
        baseDraftContext,
        'firm-123',
        'user-123'
      );

      expect(result).toBeNull();
    });

    it('should return completion suggestion', async () => {
      const mockResponse = JSON.stringify({
        type: 'completion',
        suggestion: 'We will review your case and respond within 48 hours.',
        confidence: 0.85,
        reason: 'Completing the sentence based on context',
      });

      setupInlineMock(mockResponse);

      const result = await service.getInlineSuggestions(
        'Thank you for your email. We will',
        baseDraftContext,
        'firm-123',
        'user-123'
      );

      expect(result).not.toBeNull();
      expect(result?.type).toBe('completion');
      expect(result?.confidence).toBe(0.85);
      expect(result?.suggestion).toContain('48 hours');
    });

    it('should return correction suggestion', async () => {
      const mockResponse = JSON.stringify({
        type: 'correction',
        suggestion: 'Thank you for your',
        confidence: 0.9,
        reason: 'Fixed grammatical error',
      });

      setupInlineMock(mockResponse);

      const result = await service.getInlineSuggestions(
        'Thank you for you message about the case.',
        baseDraftContext,
        'firm-123',
        'user-123'
      );

      expect(result?.type).toBe('correction');
    });

    it('should return null on AI error', async () => {
      setupInlineMock(new Error('AI unavailable'));

      const result = await service.getInlineSuggestions(
        'This is a test email draft.',
        baseDraftContext,
        'firm-123',
        'user-123'
      );

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON response', async () => {
      setupInlineMock('Not a valid JSON response');

      const result = await service.getInlineSuggestions(
        'This is a test email draft.',
        baseDraftContext,
        'firm-123',
        'user-123'
      );

      expect(result).toBeNull();
    });

    it('should track token usage', async () => {
      const mockResponse = JSON.stringify({
        type: 'improvement',
        suggestion: 'Consider adding a deadline',
        confidence: 0.75,
      });

      setupInlineMock(mockResponse);

      const { tokenTracker } = require('../token-tracker.service');

      await service.getInlineSuggestions(
        'This is a test email draft.',
        baseDraftContext,
        'firm-123',
        'user-123'
      );

      expect(tokenTracker.recordUsage).toHaveBeenCalled();
    });
  });

  describe('normalizeInstruction', () => {
    it('should normalize "shorter" instructions', () => {
      const normalizeInstruction = (service as any).normalizeInstruction.bind(service);

      expect(normalizeInstruction('Make it shorter')).toContain('shorter and more concise');
      expect(normalizeInstruction('mai scurt')).toContain('shorter and more concise');
      expect(normalizeInstruction('Make it concis')).toContain('shorter and more concise');
    });

    it('should normalize "formal" instructions', () => {
      const normalizeInstruction = (service as any).normalizeInstruction.bind(service);

      expect(normalizeInstruction('Make it more formal')).toContain('formal and professional');
      expect(normalizeInstruction('Be professional')).toContain('formal and professional');
    });

    it('should normalize "details" instructions', () => {
      const normalizeInstruction = (service as any).normalizeInstruction.bind(service);

      expect(normalizeInstruction('Add more details')).toContain('more details and explanations');
      expect(normalizeInstruction('Please explain more')).toContain('more details and explanations');
      expect(normalizeInstruction('Adaugă detalii')).toContain('more details and explanations');
    });

    it('should normalize translation instructions', () => {
      const normalizeInstruction = (service as any).normalizeInstruction.bind(service);

      expect(normalizeInstruction('Translate to Romanian')).toContain('Translate this email to Romanian');
      expect(normalizeInstruction('În română')).toContain('Translate this email to Romanian');
      expect(normalizeInstruction('Translate to English')).toContain('Translate this email to English');
      expect(normalizeInstruction('În engleză')).toContain('Translate this email to English');
    });

    it('should return original instruction if no pattern matches', () => {
      const normalizeInstruction = (service as any).normalizeInstruction.bind(service);

      const customInstruction = 'Change the greeting to include client name';
      expect(normalizeInstruction(customInstruction)).toBe(customInstruction);
    });
  });

  describe('formatCaseContext', () => {
    it('should format case context correctly', () => {
      const formatCaseContext = (service as any).formatCaseContext.bind(service);
      const result = formatCaseContext(mockCaseContext);

      expect(result).toContain('Contract Dispute');
      expect(result).toContain('12345/3/2025');
      expect(result).toContain('Ion Popescu');
      expect(result).toContain('Active');
    });
  });

  describe('convertToHtml', () => {
    it('should convert plain text to HTML paragraphs', () => {
      const convertToHtml = (service as any).convertToHtml.bind(service);
      const text = 'First paragraph.\n\nSecond paragraph.\nWith line break.';
      const result = convertToHtml(text);

      expect(result).toContain('<p>First paragraph.</p>');
      expect(result).toContain('<p>Second paragraph.<br>With line break.</p>');
    });
  });

  describe('error handling', () => {
    // Helper to setup error mock
    const setupErrorMock = (error: Error) => {
      const mockChain = {
        invoke: jest.fn().mockRejectedValue(error),
      };
      const mockModelWithPipe = {
        pipe: jest.fn().mockReturnValue(mockChain),
      };
      const { ChatPromptTemplate } = require('@langchain/core/prompts');
      ChatPromptTemplate.fromMessages.mockReturnValue({
        pipe: jest.fn().mockReturnValue(mockModelWithPipe),
      });
    };

    it('should log and rethrow errors during refinement', async () => {
      setupErrorMock(new Error('AI service unavailable'));

      const logger = require('../../lib/logger').default;

      await expect(service.refineDraft(baseRefinementParams)).rejects.toThrow(
        'AI service unavailable'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should log warning and return null for inline suggestion errors', async () => {
      setupErrorMock(new Error('Timeout'));

      const logger = require('../../lib/logger').default;

      const result = await service.getInlineSuggestions(
        'This is a test draft',
        baseDraftContext,
        'firm-123',
        'user-123'
      );

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
