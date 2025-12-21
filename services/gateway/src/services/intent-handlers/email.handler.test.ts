/**
 * Email Intent Handler Tests
 * OPS-074: Email Intent Handler
 */

import type { AssistantContext, UserContext } from './types';

// ============================================================================
// Mocks
// ============================================================================

// Mock functions must be hoisted to the top of jest.mock()
const mockSearchEmails = jest.fn();
const mockGenerateDraft = jest.fn();
const mockAiGenerate = jest.fn();

jest.mock('@legal-platform/database', () => ({
  prisma: {
    email: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@legal-platform/types', () => ({
  AIOperationType: {
    CommunicationIntelligence: 'communication_intelligence',
    ThreadAnalysis: 'thread_analysis',
    TextGeneration: 'text_generation',
  },
}));

// Use a class that stores mock in prototype
jest.mock('../email-search.service', () => {
  // Reference to the outer mock function
  const searchEmailsMock = mockSearchEmails;
  return {
    EmailSearchService: class {
      searchEmails(...args: unknown[]) {
        return searchEmailsMock(...args);
      }
    },
  };
});

jest.mock('../email-drafting.service', () => ({
  emailDraftingService: {
    generateDraft: mockGenerateDraft,
  },
}));

jest.mock('../ai.service', () => ({
  aiService: {
    generate: mockAiGenerate,
  },
}));

// Import after mocks are set up
import { EmailIntentHandler } from './email.handler';

const { prisma } = jest.requireMock('@legal-platform/database');

// ============================================================================
// Test Fixtures
// ============================================================================

const mockUserContext: UserContext = {
  userId: 'user-123',
  firmId: 'firm-123',
  role: 'associate',
  email: 'lawyer@firm.com',
};

const mockAssistantContext: AssistantContext = {
  currentScreen: '/cases/case-123/communications',
  currentCaseId: 'case-123',
  selectedEmailId: 'email-1',
};

const mockEmails = [
  {
    id: 'email-1',
    graphMessageId: 'graph-1',
    conversationId: 'conv-1',
    subject: 'Contract Review Request',
    bodyPreview: 'Please review the attached contract...',
    from: { name: 'John Client', address: 'john@client.com' },
    toRecipients: [{ name: 'Lawyer', address: 'lawyer@firm.com' }],
    receivedDateTime: new Date('2025-12-20T10:00:00'),
    hasAttachments: true,
    isRead: false,
    importance: 'high',
    caseId: 'case-123',
    caseName: 'Ionescu vs. ABC SRL',
  },
  {
    id: 'email-2',
    graphMessageId: 'graph-2',
    conversationId: 'conv-1',
    subject: 'Re: Contract Review Request',
    bodyPreview: 'Here are my comments on the contract...',
    from: { name: 'Maria Lawyer', address: 'lawyer@firm.com' },
    toRecipients: [{ name: 'John Client', address: 'john@client.com' }],
    receivedDateTime: new Date('2025-12-20T14:00:00'),
    hasAttachments: false,
    isRead: true,
    importance: 'normal',
    caseId: 'case-123',
    caseName: 'Ionescu vs. ABC SRL',
  },
];

const mockDraft = {
  id: 'draft-123',
  emailId: 'email-1',
  caseId: 'case-123',
  subject: 'Re: Contract Review Request',
  body: 'Stimate domnule Client,\n\nVă mulțumesc pentru mesaj. Am analizat contractul și...',
  htmlBody: null,
  tone: 'Professional',
  recipientType: 'Client',
  confidence: 0.85,
  status: 'Generated',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================================================
// Tests
// ============================================================================

describe('EmailIntentHandler', () => {
  let handler: EmailIntentHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new EmailIntentHandler();

    // Default mock implementations
    mockSearchEmails.mockResolvedValue({
      emails: mockEmails,
      totalCount: 2,
      hasMore: false,
    });

    mockGenerateDraft.mockResolvedValue(mockDraft);

    mockAiGenerate.mockResolvedValue({
      content: JSON.stringify({
        summary: 'Conversație despre revizuirea contractului de vânzare-cumpărare.',
        keyPoints: [
          'Clientul a solicitat revizuirea contractului',
          'S-au identificat 3 clauze problematice',
          'Se așteaptă modificări până vineri',
        ],
      }),
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    // Mock prisma email lookups
    prisma.email.findUnique.mockResolvedValue({
      id: 'email-1',
      conversationId: 'conv-1',
      caseId: 'case-123',
      caseLinks: [{ caseId: 'case-123' }],
    });

    prisma.email.findMany.mockResolvedValue([
      {
        id: 'email-1',
        receivedDateTime: new Date('2025-12-20T10:00:00'),
        from: { name: 'John Client', address: 'john@client.com' },
        bodyPreview: 'Please review the attached contract...',
        subject: 'Contract Review Request',
      },
      {
        id: 'email-2',
        receivedDateTime: new Date('2025-12-20T14:00:00'),
        from: { name: 'Maria Lawyer', address: 'lawyer@firm.com' },
        bodyPreview: 'Here are my comments on the contract...',
        subject: 'Re: Contract Review Request',
      },
    ]);
  });

  // ==========================================================================
  // handleSearchEmails Tests
  // ==========================================================================

  describe('handleSearchEmails', () => {
    it('should search emails with query', async () => {
      const result = await handler.handleSearchEmails(
        { query: 'contract' },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.message).toContain('2 emailuri');
    });

    it('should combine query and sender in search', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      const newHandler = new EmailIntentHandler();
      await newHandler.handleSearchEmails(
        { query: 'contract', sender: 'john@client.com' },
        mockAssistantContext,
        mockUserContext
      );

      expect(mockSearchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'contract john@client.com',
        }),
        10
      );
    });

    it('should return empty message when no results', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      const result = await handler.handleSearchEmails(
        { query: 'nonexistent' },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu am găsit emailuri');
    });

    it('should filter by date range', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleSearchEmails(
        { timeRange: 'today' },
        mockAssistantContext,
        mockUserContext
      );

      expect(mockSearchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: expect.any(Date),
        }),
        10
      );
    });

    it('should filter by attachments', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleSearchEmails(
        { hasAttachments: true },
        mockAssistantContext,
        mockUserContext
      );

      expect(mockSearchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAttachments: true,
        }),
        10
      );
    });

    it('should filter by unread status', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleSearchEmails({ isUnread: true }, mockAssistantContext, mockUserContext);

      expect(mockSearchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          isUnread: true,
        }),
        10
      );
    });
  });

  // ==========================================================================
  // handleSummarizeThread Tests
  // ==========================================================================

  describe('handleSummarizeThread', () => {
    it('should summarize thread from context emailId', async () => {
      const result = await handler.handleSummarizeThread({}, mockAssistantContext, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Rezumat conversație');
      expect(result.message).toContain('Puncte cheie');
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('keyPoints');
    });

    it('should use provided emailId over context', async () => {
      await handler.handleSummarizeThread(
        { emailId: 'email-specific' },
        mockAssistantContext,
        mockUserContext
      );

      expect(prisma.email.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'email-specific' },
        })
      );
    });

    it('should fail when no email selected', async () => {
      const result = await handler.handleSummarizeThread(
        {},
        { currentScreen: '/communications' }, // No selectedEmailId
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Selectați un email');
    });

    it('should fail when email not found', async () => {
      prisma.email.findUnique.mockResolvedValue(null);

      const result = await handler.handleSummarizeThread(
        { emailId: 'nonexistent' },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('nu a fost găsit');
    });

    it('should fail when email has no case', async () => {
      prisma.email.findUnique.mockResolvedValue({
        id: 'email-1',
        conversationId: 'conv-1',
        caseId: null,
        caseLinks: [],
      });

      const result = await handler.handleSummarizeThread(
        { emailId: 'email-1' },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('nu este asociat');
    });

    it('should handle AI response without JSON format', async () => {
      mockAiGenerate.mockResolvedValue({
        content: 'This is a plain text summary without JSON format.',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const result = await handler.handleSummarizeThread({}, mockAssistantContext, mockUserContext);

      expect(result.success).toBe(true);
      expect((result.data as { summary: string }).summary).toBe(
        'This is a plain text summary without JSON format.'
      );
      expect((result.data as { keyPoints: string[] }).keyPoints).toEqual([]);
    });
  });

  // ==========================================================================
  // handleDraftEmail Tests
  // ==========================================================================

  describe('handleDraftEmail', () => {
    it('should generate draft with proposed action', async () => {
      const result = await handler.handleDraftEmail({}, mockAssistantContext, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.proposedAction).toBeDefined();
      expect(result.proposedAction?.type).toBe('DraftEmail');
      expect(result.proposedAction?.confirmationPrompt).toContain('Folosiți');
      expect(result.proposedAction?.entityPreview).toHaveProperty('subiect');
      expect(result.proposedAction?.entityPreview).toHaveProperty('ton');
      expect(result.proposedAction?.entityPreview).toHaveProperty('previzualizare');
    });

    it('should use replyToEmailId from params', async () => {
      await handler.handleDraftEmail(
        { replyToEmailId: 'email-specific' },
        mockAssistantContext,
        mockUserContext
      );

      expect(mockGenerateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          emailId: 'email-specific',
        }),
        expect.any(Object)
      );
    });

    it('should fail when no email selected', async () => {
      const result = await handler.handleDraftEmail(
        {},
        { currentScreen: '/communications' }, // No selectedEmailId
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Selectați emailul');
    });

    it('should apply tone setting', async () => {
      await handler.handleDraftEmail({ tone: 'formal' }, mockAssistantContext, mockUserContext);

      expect(mockGenerateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'Formal',
        }),
        expect.any(Object)
      );
    });

    it('should apply recipient type setting', async () => {
      await handler.handleDraftEmail(
        { recipientType: 'Court' },
        mockAssistantContext,
        mockUserContext
      );

      expect(mockGenerateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientType: 'Court',
        }),
        expect.any(Object)
      );
    });

    it('should include instructions in draft request', async () => {
      await handler.handleDraftEmail(
        { instructions: 'Menționează termenul de 30 de zile' },
        mockAssistantContext,
        mockUserContext
      );

      expect(mockGenerateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: 'Menționează termenul de 30 de zile',
        }),
        expect.any(Object)
      );
    });

    it('should translate tone to Romanian in preview', async () => {
      const result = await handler.handleDraftEmail(
        { tone: 'professional' },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.proposedAction?.entityPreview).toMatchObject({
        ton: 'Profesional',
      });
    });

    it('should truncate long preview', async () => {
      mockGenerateDraft.mockResolvedValue({
        ...mockDraft,
        body: 'A'.repeat(300), // Long body
      });

      const result = await handler.handleDraftEmail({}, mockAssistantContext, mockUserContext);

      const preview = result.proposedAction?.entityPreview?.previzualizare as string;
      expect(preview.length).toBeLessThanOrEqual(203); // 200 chars + '...'
      expect(preview).toContain('...');
    });
  });

  // ==========================================================================
  // handleRecentEmails Tests
  // ==========================================================================

  describe('handleRecentEmails', () => {
    it('should return recent unread emails', async () => {
      const result = await handler.handleRecentEmails(mockAssistantContext, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.message).toContain('emailuri noi');
    });

    it('should return empty message when no recent emails', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      const result = await handler.handleRecentEmails(mockAssistantContext, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu aveți emailuri necitite');
    });

    it('should filter by last 24 hours', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleRecentEmails(mockAssistantContext, mockUserContext);

      const callArgs = mockSearchEmails.mock.calls[0][0];
      const dateFrom = callArgs.dateFrom as Date;
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance for test timing
      expect(dateFrom.getTime()).toBeGreaterThanOrEqual(dayAgo.getTime() - 1000);
      expect(dateFrom.getTime()).toBeLessThanOrEqual(dayAgo.getTime() + 1000);
    });

    it('should filter by unread status', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleRecentEmails(mockAssistantContext, mockUserContext);

      expect(mockSearchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          isUnread: true,
        }),
        10
      );
    });

    it('should filter by current case if available', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleRecentEmails({ currentCaseId: 'case-456' }, mockUserContext);

      expect(mockSearchEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-456',
        }),
        10
      );
    });
  });

  // ==========================================================================
  // Helper Method Tests
  // ==========================================================================

  describe('date formatting', () => {
    it('should format date in Romanian locale', async () => {
      const result = await handler.handleSearchEmails(
        { query: 'test' },
        mockAssistantContext,
        mockUserContext
      );

      // Check that dates are formatted (the mock has Dec 20 dates)
      expect(result.message).toMatch(/\d+ \w+/); // e.g., "20 dec."
    });
  });

  describe('time range parsing', () => {
    it('should parse today time range', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleSearchEmails(
        { timeRange: 'today' },
        mockAssistantContext,
        mockUserContext
      );

      const callArgs = mockSearchEmails.mock.calls[0][0];
      const dateFrom = callArgs.dateFrom as Date;

      // Should be start of today
      expect(dateFrom.getHours()).toBe(0);
      expect(dateFrom.getMinutes()).toBe(0);
    });

    it('should parse week time range', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleSearchEmails(
        { timeRange: 'week' },
        mockAssistantContext,
        mockUserContext
      );

      const callArgs = mockSearchEmails.mock.calls[0][0];
      const dateFrom = callArgs.dateFrom as Date;
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance
      expect(dateFrom.getTime()).toBeGreaterThanOrEqual(weekAgo.getTime() - 1000);
      expect(dateFrom.getTime()).toBeLessThanOrEqual(weekAgo.getTime() + 1000);
    });

    it('should parse month time range', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleSearchEmails(
        { timeRange: 'month' },
        mockAssistantContext,
        mockUserContext
      );

      const callArgs = mockSearchEmails.mock.calls[0][0];
      const dateFrom = callArgs.dateFrom as Date;
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance
      expect(dateFrom.getTime()).toBeGreaterThanOrEqual(monthAgo.getTime() - 1000);
      expect(dateFrom.getTime()).toBeLessThanOrEqual(monthAgo.getTime() + 1000);
    });

    it('should return empty range for "all" or unknown', async () => {
      mockSearchEmails.mockResolvedValue({
        emails: [],
        totalCount: 0,
        hasMore: false,
      });

      await handler.handleSearchEmails({ timeRange: 'all' }, mockAssistantContext, mockUserContext);

      const callArgs = mockSearchEmails.mock.calls[0][0];
      expect(callArgs.dateFrom).toBeUndefined();
      expect(callArgs.dateTo).toBeUndefined();
    });
  });
});
