/**
 * Email Drafting Integration Tests
 * Story 5.3: AI-Powered Email Drafting - Task 28
 *
 * Tests GraphQL resolvers for draft generation, refinement, and sending
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';
process.env.AI_SERVICE_URL = 'http://localhost:3002';

// Mock fetch for AI and Graph API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    email: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    emailDraft: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    attachmentSuggestion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// Mock attachment suggestion service
jest.mock('../../src/services/attachment-suggestion.service', () => ({
  attachmentSuggestionService: {
    suggestAttachments: jest.fn().mockResolvedValue([]),
  },
}));

import { prisma } from '@legal-platform/database';
import { emailDraftingResolvers } from '../../src/graphql/resolvers/email-drafting.resolvers';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test data
const testFirm = {
  id: 'firm-test-123',
  name: 'Test Law Firm',
};

const testUser = {
  id: 'user-test-123',
  email: 'avocat@bojin.law',
  firstName: 'Test',
  lastName: 'Avocat',
  role: 'Associate' as const,
  firmId: testFirm.id,
};

const testCase = {
  id: 'case-test-123',
  caseNumber: '12345/3/2025',
  title: 'Contract Dispute',
  client: { id: 'client-123', name: 'Ion Popescu' },
  firmId: testFirm.id,
  status: 'Active',
};

const testEmail = {
  id: 'email-test-123',
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
  caseId: testCase.id,
  case: testCase,
  userId: testUser.id,
};

const testDraft = {
  id: 'draft-test-123',
  emailId: testEmail.id,
  caseId: testCase.id,
  firmId: testFirm.id,
  userId: testUser.id,
  tone: 'Professional',
  recipientType: 'Court',
  subject: 'Re: Dosarul nr. 12345/3/2025 - Citație',
  body: 'Onorată Instanță,\n\nConfirmăm primirea citației...',
  htmlBody: '<p>Onorată Instanță,</p><p>Confirmăm primirea citației...</p>',
  confidence: 0.85,
  status: 'Generated',
  suggestedAttachments: [],
  email: testEmail,
  case: testCase,
  refinements: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testContext = {
  user: {
    id: testUser.id,
    role: testUser.role,
    firmId: testFirm.id,
    accessToken: 'test-access-token',
  },
};

describe('Email Drafting Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query: emailDraft', () => {
    it('should return a draft by ID', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);

      const result = await emailDraftingResolvers.Query.emailDraft(
        {},
        { id: testDraft.id },
        testContext
      );

      expect(result).toEqual(testDraft);
      expect(mockPrisma.emailDraft.findFirst).toHaveBeenCalledWith({
        where: {
          id: testDraft.id,
          firmId: testFirm.id,
        },
        include: expect.any(Object),
      });
    });

    it('should throw NOT_FOUND when draft does not exist', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        emailDraftingResolvers.Query.emailDraft({}, { id: 'non-existent' }, testContext)
      ).rejects.toThrow('Draft not found');
    });

    it('should throw UNAUTHENTICATED without user context', async () => {
      await expect(
        emailDraftingResolvers.Query.emailDraft({}, { id: testDraft.id }, { user: null } as any)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Query: emailDrafts', () => {
    it('should return all drafts for a firm', async () => {
      (mockPrisma.emailDraft.findMany as jest.Mock).mockResolvedValue([testDraft]);

      const result = await emailDraftingResolvers.Query.emailDrafts({}, {}, testContext);

      expect(result).toHaveLength(1);
      expect(mockPrisma.emailDraft.findMany).toHaveBeenCalledWith({
        where: { firmId: testFirm.id },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should filter by emailId', async () => {
      (mockPrisma.emailDraft.findMany as jest.Mock).mockResolvedValue([testDraft]);

      await emailDraftingResolvers.Query.emailDrafts({}, { emailId: testEmail.id }, testContext);

      expect(mockPrisma.emailDraft.findMany).toHaveBeenCalledWith({
        where: { firmId: testFirm.id, emailId: testEmail.id },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      (mockPrisma.emailDraft.findMany as jest.Mock).mockResolvedValue([]);

      await emailDraftingResolvers.Query.emailDrafts({}, { status: 'Sent' }, testContext);

      expect(mockPrisma.emailDraft.findMany).toHaveBeenCalledWith({
        where: { firmId: testFirm.id, status: 'Sent' },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('Query: attachmentSuggestions', () => {
    const testSuggestions = [
      {
        id: 'sugg-1',
        draftId: testDraft.id,
        documentId: 'doc-1',
        title: 'Contract.pdf',
        reason: 'Relevant to discussion',
        relevanceScore: 0.85,
        isSelected: false,
        document: { id: 'doc-1', fileName: 'Contract.pdf' },
      },
    ];

    it('should return attachment suggestions for a draft', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.attachmentSuggestion.findMany as jest.Mock).mockResolvedValue(testSuggestions);

      const result = await emailDraftingResolvers.Query.attachmentSuggestions(
        {},
        { draftId: testDraft.id },
        testContext
      );

      expect(result).toEqual(testSuggestions);
    });

    it('should throw NOT_FOUND when draft does not exist', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        emailDraftingResolvers.Query.attachmentSuggestions(
          {},
          { draftId: 'non-existent' },
          testContext
        )
      ).rejects.toThrow('Draft not found');
    });
  });

  describe('Mutation: generateEmailDraft', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should generate a draft with specified tone', async () => {
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValue(testEmail);
      (mockPrisma.emailDraft.create as jest.Mock).mockResolvedValue(testDraft);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          subject: testDraft.subject,
          body: testDraft.body,
          htmlBody: testDraft.htmlBody,
          confidence: 0.85,
          suggestedAttachments: [],
        }),
      });

      const result = await emailDraftingResolvers.Mutation.generateEmailDraft(
        {},
        {
          input: {
            emailId: testEmail.id,
            tone: 'Formal',
            recipientType: 'Court',
          },
        },
        testContext
      );

      expect(result).toEqual(testDraft);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/email-drafting/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw NOT_FOUND when email does not exist', async () => {
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        emailDraftingResolvers.Mutation.generateEmailDraft(
          {},
          { input: { emailId: 'non-existent' } },
          testContext
        )
      ).rejects.toThrow('Email not found');
    });

    it('should throw AI_SERVICE_ERROR when AI service fails', async () => {
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValue(testEmail);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        emailDraftingResolvers.Mutation.generateEmailDraft(
          {},
          { input: { emailId: testEmail.id } },
          testContext
        )
      ).rejects.toThrow('Failed to generate draft');
    });
  });

  describe('Mutation: generateMultipleDrafts', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should generate multiple drafts with different tones', async () => {
      const draftsResult = {
        drafts: [
          { tone: 'Formal', draft: { ...testDraft, tone: 'Formal' } },
          { tone: 'Professional', draft: { ...testDraft, tone: 'Professional' } },
          { tone: 'Brief', draft: { ...testDraft, tone: 'Brief' } },
        ],
        recommendedTone: 'Formal',
        recommendationReason: 'Court correspondence requires formal tone',
      };

      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValue(testEmail);
      (mockPrisma.emailDraft.create as jest.Mock)
        .mockResolvedValueOnce({ ...testDraft, tone: 'Formal' })
        .mockResolvedValueOnce({ ...testDraft, tone: 'Professional' })
        .mockResolvedValueOnce({ ...testDraft, tone: 'Brief' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => draftsResult,
      });

      const result = await emailDraftingResolvers.Mutation.generateMultipleDrafts(
        {},
        { emailId: testEmail.id },
        testContext
      );

      expect(result.drafts).toHaveLength(3);
      expect(result.recommendedTone).toBe('Formal');
    });

    it('should throw NOT_FOUND when email does not exist', async () => {
      (mockPrisma.email.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        emailDraftingResolvers.Mutation.generateMultipleDrafts(
          {},
          { emailId: 'non-existent' },
          testContext
        )
      ).rejects.toThrow('Email not found');
    });
  });

  describe('Mutation: refineDraft', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should refine a draft with given instruction', async () => {
      const refinedDraft = {
        ...testDraft,
        body: 'Refined text',
        status: 'Editing',
      };

      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.emailDraft.update as jest.Mock).mockResolvedValue(refinedDraft);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          refinedBody: 'Refined text',
          refinedHtmlBody: '<p>Refined text</p>',
          tokensUsed: 500,
        }),
      });

      const result = await emailDraftingResolvers.Mutation.refineDraft(
        {},
        {
          input: {
            draftId: testDraft.id,
            instruction: 'Make it shorter',
          },
        },
        testContext
      );

      expect(result.body).toBe('Refined text');
      expect(result.status).toBe('Editing');
    });

    it('should throw NOT_FOUND when draft does not exist', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        emailDraftingResolvers.Mutation.refineDraft(
          {},
          { input: { draftId: 'non-existent', instruction: 'Make it shorter' } },
          testContext
        )
      ).rejects.toThrow('Draft not found');
    });
  });

  describe('Mutation: updateDraft', () => {
    it('should update draft content manually', async () => {
      const updatedDraft = {
        ...testDraft,
        body: 'Updated manually',
        status: 'Ready',
      };

      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.emailDraft.update as jest.Mock).mockResolvedValue(updatedDraft);

      const result = await emailDraftingResolvers.Mutation.updateDraft(
        {},
        {
          input: {
            draftId: testDraft.id,
            body: 'Updated manually',
            status: 'Ready',
          },
        },
        testContext
      );

      expect(result.body).toBe('Updated manually');
      expect(result.status).toBe('Ready');
    });

    it('should update selected attachments', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.emailDraft.update as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.attachmentSuggestion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await emailDraftingResolvers.Mutation.updateDraft(
        {},
        {
          input: {
            draftId: testDraft.id,
            selectedAttachmentIds: ['sugg-1', 'sugg-2'],
          },
        },
        testContext
      );

      expect(mockPrisma.attachmentSuggestion.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('Mutation: sendDraft', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should send draft via Graph API', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.attachmentSuggestion.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.emailDraft.update as jest.Mock).mockResolvedValue({
        ...testDraft,
        status: 'Sent',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await emailDraftingResolvers.Mutation.sendDraft(
        {},
        { draftId: testDraft.id },
        testContext
      );

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/sendMail',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testContext.user.accessToken}`,
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should throw UNAUTHENTICATED without access token', async () => {
      const contextWithoutToken = {
        user: {
          ...testContext.user,
          accessToken: undefined,
        },
      };

      await expect(
        emailDraftingResolvers.Mutation.sendDraft(
          {},
          { draftId: testDraft.id },
          contextWithoutToken as any
        )
      ).rejects.toThrow('Authentication required with valid access token');
    });

    it('should throw GRAPH_API_ERROR when Graph API fails', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.attachmentSuggestion.findMany as jest.Mock).mockResolvedValue([]);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Graph API error',
      });

      await expect(
        emailDraftingResolvers.Mutation.sendDraft({}, { draftId: testDraft.id }, testContext)
      ).rejects.toThrow('Failed to send email');
    });
  });

  describe('Mutation: discardDraft', () => {
    it('should mark draft as discarded', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);
      (mockPrisma.emailDraft.update as jest.Mock).mockResolvedValue({
        ...testDraft,
        status: 'Discarded',
      });

      const result = await emailDraftingResolvers.Mutation.discardDraft(
        {},
        { draftId: testDraft.id },
        testContext
      );

      expect(result).toBe(true);
      expect(mockPrisma.emailDraft.update).toHaveBeenCalledWith({
        where: { id: testDraft.id },
        data: { status: 'Discarded' },
      });
    });

    it('should throw NOT_FOUND when draft does not exist', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        emailDraftingResolvers.Mutation.discardDraft({}, { draftId: 'non-existent' }, testContext)
      ).rejects.toThrow('Draft not found');
    });
  });

  describe('Mutation: selectAttachment', () => {
    const testSuggestion = {
      id: 'sugg-1',
      draftId: testDraft.id,
      documentId: 'doc-1',
      isSelected: false,
      draft: testDraft,
    };

    it('should toggle attachment selection', async () => {
      (mockPrisma.attachmentSuggestion.findFirst as jest.Mock).mockResolvedValue(testSuggestion);
      (mockPrisma.attachmentSuggestion.update as jest.Mock).mockResolvedValue({
        ...testSuggestion,
        isSelected: true,
      });

      const result = await emailDraftingResolvers.Mutation.selectAttachment(
        {},
        { suggestionId: 'sugg-1', selected: true },
        testContext
      );

      expect(result.isSelected).toBe(true);
    });

    it('should throw NOT_FOUND when suggestion does not exist', async () => {
      (mockPrisma.attachmentSuggestion.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        emailDraftingResolvers.Mutation.selectAttachment(
          {},
          { suggestionId: 'non-existent', selected: true },
          testContext
        )
      ).rejects.toThrow('Attachment suggestion not found');
    });
  });

  describe('Mutation: getInlineSuggestion', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should return inline suggestion', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'completion',
          suggestion: ' and we will respond within 48 hours.',
          confidence: 0.85,
          reason: 'Common phrase completion',
        }),
      });

      const result = await emailDraftingResolvers.Mutation.getInlineSuggestion(
        {},
        {
          input: {
            draftId: testDraft.id,
            partialText: 'We have reviewed your request',
          },
        },
        testContext
      );

      expect(result).toEqual({
        type: 'completion',
        suggestion: ' and we will respond within 48 hours.',
        confidence: 0.85,
        reason: 'Common phrase completion',
      });
    });

    it('should return null when AI service fails', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await emailDraftingResolvers.Mutation.getInlineSuggestion(
        {},
        {
          input: {
            draftId: testDraft.id,
            partialText: 'Test text',
          },
        },
        testContext
      );

      expect(result).toBeNull();
    });

    it('should return null when no suggestion available', async () => {
      (mockPrisma.emailDraft.findFirst as jest.Mock).mockResolvedValue(testDraft);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await emailDraftingResolvers.Mutation.getInlineSuggestion(
        {},
        {
          input: {
            draftId: testDraft.id,
            partialText: 'Hi',
          },
        },
        testContext
      );

      expect(result).toBeNull();
    });
  });

  describe('Type resolvers', () => {
    describe('EmailDraft resolvers', () => {
      it('should resolve email from parent', async () => {
        const draftWithEmail = { ...testDraft, email: testEmail };
        const result = await emailDraftingResolvers.EmailDraft.email(
          draftWithEmail,
          {},
          testContext
        );
        expect(result).toEqual(testEmail);
      });

      it('should fetch email if not in parent', async () => {
        (mockPrisma.email.findUnique as jest.Mock).mockResolvedValue(testEmail);

        const result = await emailDraftingResolvers.EmailDraft.email(
          { emailId: testEmail.id },
          {},
          { ...testContext, loaders: undefined }
        );

        expect(result).toEqual(testEmail);
      });

      it('should resolve case from parent', async () => {
        const draftWithCase = { ...testDraft, case: testCase };
        const result = await emailDraftingResolvers.EmailDraft.case(draftWithCase, {}, testContext);
        expect(result).toEqual(testCase);
      });

      it('should fetch case if not in parent', async () => {
        (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(testCase);

        const result = await emailDraftingResolvers.EmailDraft.case(
          { caseId: testCase.id },
          {},
          testContext
        );

        expect(result).toEqual(testCase);
      });
    });
  });

  describe('Enum resolvers', () => {
    it('should have correct EmailTone values', () => {
      expect(emailDraftingResolvers.EmailTone).toEqual({
        Formal: 'Formal',
        Professional: 'Professional',
        Brief: 'Brief',
        Detailed: 'Detailed',
      });
    });

    it('should have correct RecipientType values', () => {
      expect(emailDraftingResolvers.RecipientType).toEqual({
        Client: 'Client',
        OpposingCounsel: 'OpposingCounsel',
        Court: 'Court',
        ThirdParty: 'ThirdParty',
        Internal: 'Internal',
      });
    });

    it('should have correct DraftStatus values', () => {
      expect(emailDraftingResolvers.DraftStatus).toEqual({
        Generated: 'Generated',
        Editing: 'Editing',
        Ready: 'Ready',
        Sent: 'Sent',
        Discarded: 'Discarded',
      });
    });
  });
});
