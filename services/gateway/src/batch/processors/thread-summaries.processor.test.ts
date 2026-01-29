/**
 * Thread Summaries Processor Tests
 * OPS-240: Thread Summaries Processor
 */

// Mock dependencies before imports
jest.mock('@legal-platform/database', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    email: {
      findMany: jest.fn(),
    },
    threadSummary: {
      upsert: jest.fn(),
    },
  },
}));

jest.mock('../../services/ai-client.service', () => ({
  aiClient: {
    complete: jest.fn(),
  },
  getModelForFeature: jest.fn().mockResolvedValue('claude-3-haiku-20240307'),
}));

import { ThreadSummariesProcessor } from './thread-summaries.processor';
import type { BatchProcessorContext } from '../batch-processor.interface';
import { prisma } from '@legal-platform/database';
import { aiClient } from '../../services/ai-client.service';

// ============================================================================
// Test Data
// ============================================================================

const testFirmId = 'firm-123';
const testBatchJobId = 'batch-456';
const testConversationId = 'conv-789';

const mockEmails = [
  {
    id: 'email-1',
    subject: 'Test Discussion',
    bodyPreview: 'First message in the thread',
    bodyContent: 'First message in the thread',
    bodyContentClean: null,
    from: { name: 'John Doe', address: 'john@example.com' },
    toRecipients: [{ name: 'Jane Smith', address: 'jane@example.com' }],
    ccRecipients: [],
    receivedDateTime: new Date('2024-01-15T10:00:00Z'),
    caseId: 'case-123',
  },
  {
    id: 'email-2',
    subject: 'Re: Test Discussion',
    bodyPreview: 'Second message response',
    bodyContent: 'Second message response with details',
    bodyContentClean: 'Second message - cleaned',
    from: { name: 'Jane Smith', address: 'jane@example.com' },
    toRecipients: [{ name: 'John Doe', address: 'john@example.com' }],
    ccRecipients: [],
    receivedDateTime: new Date('2024-01-15T11:00:00Z'),
    caseId: 'case-123',
  },
];

const mockAIResponse = {
  content: JSON.stringify({
    overview: 'Discuție despre proiectul test.',
    keyPoints: ['Punct 1', 'Punct 2'],
    actionItems: ['Acțiune 1'],
    sentiment: 'positive',
    participants: ['John Doe <john@example.com>', 'Jane Smith <jane@example.com>'],
  }),
  inputTokens: 500,
  outputTokens: 150,
  costEur: 0.001,
};

// ============================================================================
// Tests
// ============================================================================

describe('ThreadSummariesProcessor', () => {
  let processor: ThreadSummariesProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new ThreadSummariesProcessor();

    // Default mocks
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ conversationId: testConversationId }]);
    (prisma.email.findMany as jest.Mock).mockResolvedValue(mockEmails);
    (prisma.threadSummary.upsert as jest.Mock).mockResolvedValue({});
    (aiClient.complete as jest.Mock).mockResolvedValue(mockAIResponse);
  });

  // ============================================================================
  // Basic Properties
  // ============================================================================

  describe('properties', () => {
    it('should have correct name', () => {
      expect(processor.name).toBe('Thread Summaries Generator');
    });

    it('should have correct feature key', () => {
      expect(processor.feature).toBe('thread_summaries');
    });
  });

  // ============================================================================
  // Processing
  // ============================================================================

  describe('process', () => {
    it('should process stale threads and generate summaries', async () => {
      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      const result = await processor.process(ctx);

      expect(result.itemsProcessed).toBe(1);
      expect(result.itemsFailed).toBe(0);
      expect(result.totalTokens).toBe(650); // 500 input + 150 output
      expect(result.totalCost).toBe(0.001);
    });

    it('should call progress callback', async () => {
      const progressCalls: [number, number][] = [];
      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
        onProgress: (processed, total) => progressCalls.push([processed, total]),
      };

      await processor.process(ctx);

      expect(progressCalls).toContainEqual([1, 1]);
    });

    it('should skip when no stale threads', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      const result = await processor.process(ctx);

      expect(result.itemsProcessed).toBe(0);
      expect(result.itemsFailed).toBe(0);
      expect(aiClient.complete).not.toHaveBeenCalled();
    });

    it('should handle AI call errors gracefully', async () => {
      (aiClient.complete as jest.Mock).mockRejectedValue(new Error('AI service error'));

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      const result = await processor.process(ctx);

      expect(result.itemsProcessed).toBe(0);
      expect(result.itemsFailed).toBe(1);
      expect(result.errors).toContain(`Thread ${testConversationId}: AI service error`);
    });
  });

  // ============================================================================
  // AI Response Parsing
  // ============================================================================

  describe('AI response parsing', () => {
    it('should parse JSON response correctly', async () => {
      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      expect(prisma.threadSummary.upsert).toHaveBeenCalledWith({
        where: { conversationId: testConversationId },
        create: expect.objectContaining({
          overview: 'Discuție despre proiectul test.',
          keyPoints: ['Punct 1', 'Punct 2'],
          actionItems: ['Acțiune 1'],
          sentiment: 'positive',
          participants: ['John Doe <john@example.com>', 'Jane Smith <jane@example.com>'],
        }),
        update: expect.objectContaining({
          overview: 'Discuție despre proiectul test.',
        }),
      });
    });

    it('should handle markdown code blocks in response', async () => {
      (aiClient.complete as jest.Mock).mockResolvedValue({
        content:
          '```json\n' +
          JSON.stringify({
            overview: 'Test overview',
            keyPoints: [],
            actionItems: [],
            sentiment: 'neutral',
            participants: [],
          }) +
          '\n```',
        inputTokens: 100,
        outputTokens: 50,
        costEur: 0.0001,
      });

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      expect(prisma.threadSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            overview: 'Test overview',
          }),
        })
      );
    });

    it('should fallback on invalid JSON response', async () => {
      (aiClient.complete as jest.Mock).mockResolvedValue({
        content: 'This is not valid JSON',
        inputTokens: 100,
        outputTokens: 50,
        costEur: 0.0001,
      });

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      expect(prisma.threadSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            overview: 'Rezumat indisponibil.',
            keyPoints: [],
            actionItems: [],
            sentiment: 'neutral',
            participants: [],
          }),
        })
      );
    });

    it('should normalize invalid sentiment values', async () => {
      (aiClient.complete as jest.Mock).mockResolvedValue({
        content: JSON.stringify({
          overview: 'Test',
          keyPoints: [],
          actionItems: [],
          sentiment: 'invalid_value',
          participants: [],
        }),
        inputTokens: 100,
        outputTokens: 50,
        costEur: 0.0001,
      });

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      expect(prisma.threadSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            sentiment: 'neutral',
          }),
        })
      );
    });
  });

  // ============================================================================
  // Thread Summary Storage
  // ============================================================================

  describe('thread summary storage', () => {
    it('should upsert thread summary with correct data', async () => {
      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      expect(prisma.threadSummary.upsert).toHaveBeenCalledWith({
        where: { conversationId: testConversationId },
        create: {
          conversationId: testConversationId,
          firmId: testFirmId,
          caseId: 'case-123',
          messageCount: 2,
          lastAnalyzedAt: expect.any(Date),
          overview: expect.any(String),
          keyPoints: expect.any(Array),
          actionItems: expect.any(Array),
          sentiment: expect.any(String),
          participants: expect.any(Array),
        },
        update: {
          caseId: 'case-123',
          messageCount: 2,
          lastAnalyzedAt: expect.any(Date),
          overview: expect.any(String),
          keyPoints: expect.any(Array),
          actionItems: expect.any(Array),
          sentiment: expect.any(String),
          participants: expect.any(Array),
        },
      });
    });

    it('should handle null caseId', async () => {
      (prisma.email.findMany as jest.Mock).mockResolvedValue(
        mockEmails.map((e) => ({ ...e, caseId: null }))
      );

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      expect(prisma.threadSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            caseId: null,
          }),
        })
      );
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should skip threads with less than 2 emails', async () => {
      (prisma.email.findMany as jest.Mock).mockResolvedValue([mockEmails[0]]);

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      const result = await processor.process(ctx);

      // Should return early without calling AI
      expect(aiClient.complete).not.toHaveBeenCalled();
      // No error since it's a valid skip
      expect(result.itemsFailed).toBe(0);
    });

    it('should prefer bodyContentClean over bodyContent', async () => {
      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      // The second email has bodyContentClean set
      const aiCall = (aiClient.complete as jest.Mock).mock.calls[0];
      const prompt = aiCall[0] as string;
      expect(prompt).toContain('Second message - cleaned');
    });

    it('should truncate long email bodies', async () => {
      const longBody = 'x'.repeat(5000);
      (prisma.email.findMany as jest.Mock).mockResolvedValue([
        { ...mockEmails[0], bodyContent: longBody, bodyContentClean: null, bodyPreview: '' },
        { ...mockEmails[1], bodyContent: longBody, bodyContentClean: null, bodyPreview: '' },
      ]);

      const ctx: BatchProcessorContext = {
        firmId: testFirmId,
        batchJobId: testBatchJobId,
      };

      await processor.process(ctx);

      const aiCall = (aiClient.complete as jest.Mock).mock.calls[0];
      const prompt = aiCall[0] as string;
      // Both emails would be 10000 chars total if not truncated
      // With truncation at 2000 chars each + "...", prompt should be much smaller
      expect(prompt.length).toBeLessThan(7000);
      expect(prompt).toContain('...');
    });
  });
});
