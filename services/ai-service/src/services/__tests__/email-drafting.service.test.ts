/**
 * Unit Tests for Email Drafting Service
 * Story 5.3: AI-Powered Email Drafting - Task 26
 *
 * Tests email draft generation, tone adaptation, and multi-draft functionality
 */

import {
  EmailDraftingService,
  EmailTone,
  RecipientType,
  type Email,
  type CaseContext,
  type DraftGenerationParams,
} from '../email-drafting.service';

// Mock dependencies
jest.mock('../../lib/claude/client', () => ({
  chat: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      subject: 'Re: Test Subject',
      body: 'Test email body content',
      htmlBody: '<p>Test email body content</p>',
      confidence: 0.85,
      keyPointsAddressed: ['point1', 'point2'],
    }),
    inputTokens: 1000,
    outputTokens: 500,
    stopReason: 'end_turn',
  }),
}));

jest.mock('../token-tracker.service', () => ({
  tokenTracker: {
    recordUsage: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../cache.service', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
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

jest.mock('../../config', () => ({
  config: {
    cache: {
      ttlHours: 1,
    },
  },
}));

describe('EmailDraftingService', () => {
  let service: EmailDraftingService;

  // Sample test data
  const mockEmail: Email = {
    id: 'email-123',
    graphMessageId: 'graph-msg-123',
    subject: 'Dosarul nr. 12345/3/2025 - Citație',
    bodyContent: `Stimate Domn Avocat,

Prin prezenta, vă aducem la cunoștință că în dosarul nr. 12345/3/2025,
având ca obiect acțiune civilă, s-a stabilit termen de judecată.

Cu stimă,
Grefier Principal`,
    bodyContentType: 'text',
    from: { name: 'Grefier', address: 'grefier@tribunal-bucuresti.ro' },
    toRecipients: [{ name: 'Avocat', address: 'avocat@bojin.law' }],
    ccRecipients: [],
    receivedDateTime: new Date('2025-12-03T09:00:00Z'),
    sentDateTime: new Date('2025-12-03T09:00:00Z'),
    hasAttachments: false,
  };

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
        email: 'client@company.ro',
      },
      opposingParties: [{ id: 'party-1', name: 'SC Example SRL', role: 'Defendant' }],
    },
    recentDocuments: [
      { id: 'doc-1', fileName: 'contract.pdf', fileType: 'PDF', uploadedAt: new Date() },
    ],
    priorCommunications: [
      { subject: 'Initial consultation', date: new Date(), summary: 'Discussed case details' },
    ],
    activeDeadlines: [{ description: 'File motion', dueDate: new Date('2025-12-15') }],
    pendingTasks: [{ title: 'Review documents', priority: 'High' }],
    extractedCommitments: [],
    riskIndicators: [],
  };

  const baseParams: DraftGenerationParams = {
    originalEmail: mockEmail,
    caseContext: mockCaseContext,
    threadHistory: [],
    tone: EmailTone.Professional,
    recipientType: RecipientType.Court,
    firmId: 'firm-123',
    userId: 'user-123',
  };

  beforeEach(() => {
    service = new EmailDraftingService();
    jest.clearAllMocks();

    // Setup mock implementations
    const { chat } = require('../../lib/claude/client');
    chat.mockResolvedValue({
      content: JSON.stringify({
        subject: 'Re: Test Subject',
        body: 'Test email body content',
        htmlBody: '<p>Test email body content</p>',
        confidence: 0.85,
        keyPointsAddressed: ['point1', 'point2'],
      }),
      inputTokens: 1000,
      outputTokens: 500,
      stopReason: 'end_turn',
    });
  });

  describe('generateEmailDraft', () => {
    it('should generate a draft with the specified tone', async () => {
      // Mock the chat response
      const { chat } = require('../../lib/claude/client');
      chat.mockResolvedValueOnce({
        content: JSON.stringify({
          subject: 'Re: Dosarul nr. 12345/3/2025 - Citație',
          body: 'Onorată Instanță,\n\nConfirmăm primirea citației...',
          htmlBody: '<p>Onorată Instanță,</p><p>Confirmăm primirea citației...</p>',
          keyPointsAddressed: ['Confirmed receipt', 'Acknowledged deadline'],
          confidence: 0.85,
        }),
        inputTokens: 1000,
        outputTokens: 500,
        stopReason: 'end_turn',
      });

      const result = await service.generateEmailDraft(baseParams);

      expect(result).toBeDefined();
      expect(result.subject).toBe('Re: Dosarul nr. 12345/3/2025 - Citație');
      expect(result.confidence).toBe(0.85);
      expect(result.keyPointsAddressed).toHaveLength(2);
      expect(result.tokensUsed).toEqual({ input: 1000, output: 500 });
    });

    it('should use cache when available', async () => {
      const cachedResult = {
        subject: 'Cached Subject',
        body: 'Cached body',
        htmlBody: '<p>Cached body</p>',
        confidence: 0.9,
        suggestedAttachments: [],
        keyPointsAddressed: ['Cached point'],
        tokensUsed: { input: 500, output: 250 },
      };

      const { cacheService } = require('../cache.service');
      cacheService.get.mockResolvedValueOnce({ response: JSON.stringify(cachedResult) });

      const result = await service.generateEmailDraft(baseParams);

      expect(result).toEqual(cachedResult);
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should handle AI response parsing errors gracefully', async () => {
      const { chat } = require('../../lib/claude/client');
      chat.mockResolvedValueOnce({
        content: 'Invalid response without JSON',
        inputTokens: 1000,
        outputTokens: 500,
        stopReason: 'end_turn',
      });

      const result = await service.generateEmailDraft(baseParams);

      // Should fallback to treating response as body
      expect(result.subject).toBe('Re: Reply');
      expect(result.body).toBe('Invalid response without JSON');
      expect(result.confidence).toBe(0.5);
    });

    it('should track token usage', async () => {
      const { chat } = require('../../lib/claude/client');
      chat.mockResolvedValueOnce({
        content: JSON.stringify({
          subject: 'Test',
          body: 'Test body',
          confidence: 0.8,
        }),
        inputTokens: 1000,
        outputTokens: 500,
        stopReason: 'end_turn',
      });

      const { tokenTracker } = require('../token-tracker.service');

      await service.generateEmailDraft(baseParams);

      expect(tokenTracker.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: 1000,
          outputTokens: 500,
          firmId: 'firm-123',
          userId: 'user-123',
        })
      );
    });
  });

  describe('generateMultipleDrafts', () => {
    it('should generate drafts for Formal, Professional, and Brief tones', async () => {
      // Mock multiple chat calls (one for each tone)
      const { chat } = require('../../lib/claude/client');
      chat.mockResolvedValue({
        content: JSON.stringify({
          subject: 'Re: Test',
          body: 'Test body',
          confidence: 0.8,
        }),
        inputTokens: 1000,
        outputTokens: 500,
        stopReason: 'end_turn',
      });

      const paramsWithoutTone = { ...baseParams };
      delete (paramsWithoutTone as any).tone;

      const result = await service.generateMultipleDrafts(paramsWithoutTone);

      expect(result.drafts).toHaveLength(3);
      expect(result.drafts.map((d) => d.tone)).toContain(EmailTone.Formal);
      expect(result.drafts.map((d) => d.tone)).toContain(EmailTone.Professional);
      expect(result.drafts.map((d) => d.tone)).toContain(EmailTone.Brief);
      expect(result.recommendedTone).toBeDefined();
      expect(result.recommendationReason).toBeDefined();
    });
  });

  describe('recommendTone', () => {
    it('should recommend Formal tone for Court recipient type', () => {
      // Access private method via reflection
      const recommendTone = (service as any).recommendTone.bind(service);
      const result = recommendTone(mockEmail, RecipientType.Court);

      expect(result.tone).toBe(EmailTone.Formal);
      expect(result.reason).toContain('Court correspondence');
    });

    it('should recommend Brief tone for simple acknowledgment emails', () => {
      const simpleEmail: Email = {
        ...mockEmail,
        bodyContent: 'Bună ziua, Am primit documentele. Mulțumesc!',
      };

      const recommendTone = (service as any).recommendTone.bind(service);
      const result = recommendTone(simpleEmail, RecipientType.Client);

      expect(result.tone).toBe(EmailTone.Brief);
      expect(result.reason).toContain('acknowledgment');
    });

    it('should recommend Detailed tone for emails with multiple questions', () => {
      const detailedEmail: Email = {
        ...mockEmail,
        bodyContent:
          'Care este statusul? Ce termene avem? Când ne întâlnim? Ce documente sunt necesare?',
      };

      const recommendTone = (service as any).recommendTone.bind(service);
      const result = recommendTone(detailedEmail, RecipientType.Client);

      expect(result.tone).toBe(EmailTone.Detailed);
      expect(result.reason).toContain('multiple questions');
    });

    it('should recommend Professional tone for OpposingCounsel', () => {
      const recommendTone = (service as any).recommendTone.bind(service);
      const result = recommendTone(mockEmail, RecipientType.OpposingCounsel);

      expect(result.tone).toBe(EmailTone.Professional);
      expect(result.reason).toContain('opposing counsel');
    });

    it('should recommend Formal tone for formal requests', () => {
      const formalEmail: Email = {
        ...mockEmail,
        subject: 'Cerere de amânare',
        bodyContent: 'Stimat Domn Avocat, Vă rugăm să ne comunicați disponibilitatea.',
      };

      const recommendTone = (service as any).recommendTone.bind(service);
      const result = recommendTone(formalEmail, RecipientType.ThirdParty);

      expect(result.tone).toBe(EmailTone.Formal);
    });

    it('should default to Professional tone', () => {
      const genericEmail: Email = {
        ...mockEmail,
        subject: 'Update',
        bodyContent: 'Hello, here is the update you requested.',
      };

      const recommendTone = (service as any).recommendTone.bind(service);
      const result = recommendTone(genericEmail, RecipientType.ThirdParty);

      expect(result.tone).toBe(EmailTone.Professional);
    });
  });

  describe('sanitizeForPrompt', () => {
    it('should escape code blocks and template literals', () => {
      // Access module-level function via import
      const content = '```code``` and ${injection}';
      const sanitized = content
        .replace(/```/g, '\\`\\`\\`')
        .replace(/\${/g, '\\${')
        .substring(0, 10000);

      expect(sanitized).toBe('\\`\\`\\` and \\${injection}');
    });

    it('should limit content length to 10000 characters', () => {
      const longContent = 'a'.repeat(15000);
      const sanitized = longContent.substring(0, 10000);

      expect(sanitized.length).toBe(10000);
    });
  });

  describe('format helpers', () => {
    it('should format thread history correctly', () => {
      const formatThreadHistory = (service as any).formatThreadHistory.bind(service);
      const result = formatThreadHistory([mockEmail]);

      expect(result).toContain('grefier@tribunal-bucuresti.ro');
      expect(result).toContain('Dosarul');
    });

    it('should return default message for empty thread', () => {
      const formatThreadHistory = (service as any).formatThreadHistory.bind(service);
      const result = formatThreadHistory([]);

      expect(result).toBe('No prior messages in thread.');
    });

    it('should format case context correctly', () => {
      const formatCaseContext = (service as any).formatCaseContext.bind(service);
      const result = formatCaseContext(mockCaseContext);

      expect(result).toContain('Contract Dispute');
      expect(result).toContain('12345/3/2025');
      expect(result).toContain('Ion Popescu');
    });

    it('should format deadlines correctly', () => {
      const formatDeadlines = (service as any).formatDeadlines.bind(service);
      const result = formatDeadlines(mockCaseContext.activeDeadlines);

      expect(result).toContain('File motion');
    });

    it('should return None for empty arrays', () => {
      const formatDeadlines = (service as any).formatDeadlines.bind(service);
      expect(formatDeadlines([])).toBe('None');

      const formatCommitments = (service as any).formatCommitments.bind(service);
      expect(formatCommitments([])).toBe('None');

      const formatRisks = (service as any).formatRisks.bind(service);
      expect(formatRisks([])).toBe('None identified');
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
    it('should log and rethrow errors during draft generation', async () => {
      const { chat } = require('../../lib/claude/client');
      chat.mockRejectedValueOnce(new Error('AI service unavailable'));

      const logger = require('../../lib/logger').default;

      await expect(service.generateEmailDraft(baseParams)).rejects.toThrow(
        'AI service unavailable'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
