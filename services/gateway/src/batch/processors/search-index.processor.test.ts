/**
 * Search Index Processor Tests
 * OPS-237: Search Index Processor (Nightly)
 */

import { SearchIndexProcessor } from './search-index.processor';
import type { BatchProcessorContext } from '../batch-processor.interface';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    aIBatchJobRun: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../services/ai-client.service', () => ({
  aiClient: {
    complete: jest.fn(),
  },
  getModelForFeature: jest.fn().mockResolvedValue('claude-3-haiku-20240307'),
}));

// Import mocked modules
import { prisma } from '@legal-platform/database';
import { aiClient } from '../../services/ai-client.service';

// ============================================================================
// Test Data
// ============================================================================

const testFirmId = 'firm-123';
const testBatchJobId = 'batch-job-456';

const testDocument = {
  id: 'doc-1',
  fileName: 'Act Constitutiv TT Solaria SRL.docx',
  metadata: { description: 'Act de constituire societate cu răspundere limitată' },
  updatedAt: new Date('2024-01-15'),
  searchTermsUpdatedAt: null,
};

const testCase = {
  id: 'case-1',
  title: 'Litigiu civil Popescu vs Ionescu',
  description: 'Acțiune în pretenții pentru recuperarea datoriilor',
  caseNumber: 'LC-2024-001',
  keywords: ['pretenții', 'datorii'],
  referenceNumbers: ['1234/5/2024'],
  updatedAt: new Date('2024-01-15'),
  searchTermsUpdatedAt: null,
  client: { name: 'SC TT Solaria SRL' },
  actors: [
    { name: 'Ion Popescu', role: 'CLIENT' },
    { name: 'Maria Ionescu', role: 'OPPONENT' },
  ],
};

const mockAIResponse = {
  content: JSON.stringify({
    abbreviations: ['act constit', 'AC', 'TT Sol'],
    alternates: ['constitutiv', 'constituire', 'solaria'],
    entities: ['TT Solaria SRL', 'Solaria'],
    tags: ['SRL', 'constituire societate', 'act fondare'],
  }),
  inputTokens: 150,
  outputTokens: 80,
  costEur: 0.0002,
};

// ============================================================================
// Tests
// ============================================================================

describe('SearchIndexProcessor', () => {
  let processor: SearchIndexProcessor;

  const ctx: BatchProcessorContext = {
    firmId: testFirmId,
    batchJobId: testBatchJobId,
    onProgress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new SearchIndexProcessor();

    // Default mock implementations
    (prisma.aIBatchJobRun.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.document.update as jest.Mock).mockResolvedValue({} as any);
    (prisma.case.update as jest.Mock).mockResolvedValue({} as any);
    (aiClient.complete as jest.Mock).mockResolvedValue(mockAIResponse);
  });

  // ============================================================================
  // Basic Properties
  // ============================================================================

  describe('properties', () => {
    it('should have correct name and feature', () => {
      expect(processor.name).toBe('Search Index Generator');
      expect(processor.feature).toBe('search_index');
    });
  });

  // ============================================================================
  // Document Processing
  // ============================================================================

  describe('document processing', () => {
    it('should process documents without searchTerms', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([testDocument as any]);

      const result = await processor.process(ctx);

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirmId,
          }),
        })
      );
      expect(aiClient.complete).toHaveBeenCalledTimes(1);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          searchTerms: expect.stringContaining('act constit'),
          searchTermsUpdatedAt: expect.any(Date),
        },
      });
      expect(result.itemsProcessed).toBe(1);
      expect(result.itemsFailed).toBe(0);
    });

    it('should skip documents with up-to-date searchTerms', async () => {
      const docWithTerms = {
        ...testDocument,
        searchTermsUpdatedAt: new Date('2024-01-20'), // After updatedAt
      };
      (prisma.document.findMany as jest.Mock).mockResolvedValue([docWithTerms as any]);

      const result = await processor.process(ctx);

      expect(aiClient.complete).not.toHaveBeenCalled();
      expect(result.itemsProcessed).toBe(0);
    });

    it('should handle AI call errors gracefully', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([testDocument as any]);
      (aiClient.complete as jest.Mock).mockRejectedValue(new Error('API error'));

      const result = await processor.process(ctx);

      expect(result.itemsProcessed).toBe(0);
      expect(result.itemsFailed).toBe(1);
      expect(result.errors).toContain('Doc doc-1: API error');
    });

    it('should generate search terms string from AI response', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([testDocument as any]);

      await processor.process(ctx);

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          searchTerms: expect.any(String),
          searchTermsUpdatedAt: expect.any(Date),
        },
      });

      // Verify the search terms string contains expected terms
      const updateCall = (prisma.document.update as jest.Mock).mock.calls[0][0];
      const searchTerms = updateCall.data.searchTerms as string;
      expect(searchTerms).toContain('act constit');
      expect(searchTerms).toContain('solaria');
      expect(searchTerms).toContain('srl');
    });
  });

  // ============================================================================
  // Case Processing
  // ============================================================================

  describe('case processing', () => {
    it('should process cases without searchTerms', async () => {
      (prisma.case.findMany as jest.Mock).mockResolvedValue([testCase as any]);

      const result = await processor.process(ctx);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirmId,
          }),
        })
      );
      expect(aiClient.complete).toHaveBeenCalledTimes(1);
      expect(prisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: {
          searchTerms: expect.any(String),
          searchTermsUpdatedAt: expect.any(Date),
        },
      });
      expect(result.itemsProcessed).toBe(1);
    });

    it('should include actor names in prompt', async () => {
      (prisma.case.findMany as jest.Mock).mockResolvedValue([testCase as any]);

      await processor.process(ctx);

      const completeCall = (aiClient.complete as jest.Mock).mock.calls[0];
      const prompt = completeCall[0] as string;
      expect(prompt).toContain('Ion Popescu');
      expect(prompt).toContain('Maria Ionescu');
    });
  });

  // ============================================================================
  // Incremental Processing
  // ============================================================================

  describe('incremental processing', () => {
    it('should use last successful run time for incremental queries', async () => {
      const lastRunTime = new Date('2024-01-10');
      (prisma.aIBatchJobRun.findFirst as jest.Mock).mockResolvedValue({
        id: 'prev-job',
        completedAt: lastRunTime,
      } as any);

      await processor.process(ctx);

      expect(prisma.aIBatchJobRun.findFirst).toHaveBeenCalledWith({
        where: {
          firmId: testFirmId,
          feature: 'search_index',
          status: 'completed',
        },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
    });
  });

  // ============================================================================
  // Response Parsing
  // ============================================================================

  describe('response parsing', () => {
    it('should handle malformed JSON response', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([testDocument as any]);
      (aiClient.complete as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: 'Invalid JSON response',
      });

      await processor.process(ctx);

      // Should still update with empty terms
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          searchTerms: '', // Empty string when parsing fails
          searchTermsUpdatedAt: expect.any(Date),
        },
      });
    });

    it('should extract JSON from mixed response', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([testDocument as any]);
      (aiClient.complete as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content:
          'Here is the result:\n' +
          JSON.stringify({
            abbreviations: ['test abbrev'],
            alternates: [],
            entities: [],
            tags: [],
          }),
      });

      await processor.process(ctx);

      const updateCall = (prisma.document.update as jest.Mock).mock.calls[0][0];
      const searchTerms = updateCall.data.searchTerms as string;
      expect(searchTerms).toContain('test abbrev');
    });

    it('should deduplicate terms', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([testDocument as any]);
      (aiClient.complete as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: JSON.stringify({
          abbreviations: ['test', 'Test', 'TEST'],
          alternates: ['test'],
          entities: [],
          tags: [],
        }),
      });

      await processor.process(ctx);

      const updateCall = (prisma.document.update as jest.Mock).mock.calls[0][0];
      const searchTerms = updateCall.data.searchTerms as string;
      // Should only have one 'test' (case-insensitive deduplication)
      const testCount = searchTerms.split(' ').filter((t) => t === 'test').length;
      expect(testCount).toBe(1);
    });
  });

  // ============================================================================
  // Progress Tracking
  // ============================================================================

  describe('progress tracking', () => {
    it('should call onProgress during processing', async () => {
      const docs = [
        { ...testDocument, id: 'doc-1' },
        { ...testDocument, id: 'doc-2' },
      ];
      (prisma.document.findMany as jest.Mock).mockResolvedValue(docs as any);

      await processor.process(ctx);

      expect(ctx.onProgress).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Token/Cost Aggregation
  // ============================================================================

  describe('token/cost aggregation', () => {
    it('should aggregate tokens and cost from all calls', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue([
        { ...testDocument, id: 'doc-1' },
        { ...testDocument, id: 'doc-2' },
      ] as any);

      const result = await processor.process(ctx);

      expect(result.totalTokens).toBe(
        2 * (mockAIResponse.inputTokens + mockAIResponse.outputTokens)
      );
      expect(result.totalCost).toBe(2 * mockAIResponse.costEur);
    });
  });
});
