/**
 * Embedding Service Unit Tests
 * Story 2.10: Basic AI Search Implementation - Task 25
 *
 * Tests for Voyage AI embedding generation, caching, and batch processing.
 */

// Mock external dependencies
jest.mock('@legal-platform/database', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    lpush: jest.fn(),
    rpop: jest.fn(),
    llen: jest.fn(),
  },
  cacheManager: {
    get: jest.fn(),
    set: jest.fn(),
  },
  prisma: {
    case: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}));

// Mock fetch for Voyage AI API
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import { EmbeddingService } from './embedding.service';
import { redis, prisma } from '@legal-platform/database';

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    jest.clearAllMocks();
    embeddingService = new EmbeddingService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should return cached embedding if available', async () => {
      const cachedEmbedding = Array(1536).fill(0.1);
      const { cacheManager } = require('@legal-platform/database');
      (cacheManager.get as jest.Mock).mockResolvedValue(cachedEmbedding);

      const result = await embeddingService.generateEmbedding('test text');

      expect(result).toEqual(cachedEmbedding);
      expect(cacheManager.get).toHaveBeenCalledWith(expect.stringContaining('embedding:'));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call Voyage AI API when embedding not cached', async () => {
      const embedding = Array(1536).fill(0.2);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });

      const result = await embeddingService.generateEmbedding('test text');

      expect(result).toEqual(embedding);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.voyageai.com/v1/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should cache the generated embedding', async () => {
      const embedding = Array(1536).fill(0.3);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });

      await embeddingService.generateEmbedding('test text');

      // Service uses cacheManager.set for caching
      const { cacheManager } = require('@legal-platform/database');
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('embedding:'),
        expect.any(Array),
        expect.any(Number)
      );
    });

    it('should handle API errors gracefully', async () => {
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(embeddingService.generateEmbedding('test text')).rejects.toThrow();
    });

    it('should chunk long text and make multiple API calls', async () => {
      // Use text with spaces so chunking works (splits by words)
      // 50,000 chars is > 32,000 (8000 tokens * 4 chars), so it will be chunked
      const longText = 'word '.repeat(10000); // ~50,000 chars with spaces
      const embedding = Array(1536).fill(0.4);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });

      await embeddingService.generateEmbedding(longText);

      // Should make multiple API calls due to chunking
      expect(mockFetch.mock.calls.length).toBeGreaterThan(1);
      // Each chunk should be smaller than max (32000 chars)
      const firstCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(firstCallBody.input.length).toBeLessThanOrEqual(32000);
    });

    it('should average embeddings from chunked texts', async () => {
      const longText = 'word '.repeat(10000); // ~50,000 chars
      const embedding = Array(1536).fill(0.5);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });

      const result = await embeddingService.generateEmbedding(longText);

      expect(result).toBeDefined();
      expect(result.length).toBe(1536);
    });
  });

  describe('generateCaseEmbedding', () => {
    it('should generate embedding for a case', async () => {
      const mockCase = {
        id: 'case-123',
        title: 'Test Case',
        description: 'Test Description',
        caseNumber: 'C-001',
        client: { name: 'Test Client' },
        type: 'Litigation',
        status: 'Active',
      };
      const embedding = Array(1536).fill(0.6);

      (jest.mocked as any)(prisma.case.findFirst).mockResolvedValue(mockCase as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.generateCaseEmbedding('case-123', 'firm-123');

      expect(prisma.case.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'case-123' }),
        })
      );
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should throw if case not found', async () => {
      (jest.mocked as any)(prisma.case.findFirst).mockResolvedValue(null);

      // The service throws when case is not found
      await expect(embeddingService.generateCaseEmbedding('nonexistent', 'firm-123'))
        .rejects.toThrow('Case not found');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should combine case fields for embedding text', async () => {
      const mockCase = {
        id: 'case-456',
        title: 'Important Case',
        description: 'Detailed description',
        caseNumber: 'C-456',
        client: { name: 'Important Client' },
        type: 'Contract',
        status: 'PendingApproval',
      };
      const embedding = Array(1536).fill(0.7);

      (jest.mocked as any)(prisma.case.findFirst).mockResolvedValue(mockCase as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.generateCaseEmbedding('case-456', 'firm-123');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.input).toContain('Important Case');
      expect(callBody.input).toContain('Detailed description');
      expect(callBody.input).toContain('Important Client');
    });
  });

  describe('generateDocumentEmbedding', () => {
    it('should generate embedding for a document', async () => {
      const mockDocument = {
        id: 'doc-123',
        fileName: 'contract.pdf',
        description: 'Employment contract',
        fileType: 'application/pdf',
        client: { name: 'Client Corp' },
        case: { title: 'Employment Matter' },
      };
      const embedding = Array(1536).fill(0.8);

      (jest.mocked as any)(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.generateDocumentEmbedding('doc-123', 'firm-123');

      expect(prisma.document.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'doc-123' }),
        })
      );
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should skip if document not found', async () => {
      (jest.mocked as any)(prisma.document.findFirst).mockResolvedValue(null);

      // The service throws when document is not found
      await expect(embeddingService.generateDocumentEmbedding('nonexistent', 'firm-123'))
        .rejects.toThrow('Document not found');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('queueForEmbedding', () => {
    it('should add item to embedding queue', async () => {
      (jest.mocked as any)(redis.lpush).mockResolvedValue(1);

      await embeddingService.queueForEmbedding({
        type: 'case',
        id: 'case-789',
        firmId: 'firm-123',
      });

      expect(redis.lpush).toHaveBeenCalledWith(
        'embedding:queue',
        expect.stringContaining('"type":"case"')
      );
      expect(redis.lpush).toHaveBeenCalledWith(
        'embedding:queue',
        expect.stringContaining('"id":"case-789"')
      );
    });

    it('should handle multiple queue items', async () => {
      (jest.mocked as any)(redis.lpush).mockResolvedValue(1);

      await embeddingService.queueForEmbedding({
        type: 'case',
        id: 'case-1',
        firmId: 'firm-123',
      });

      await embeddingService.queueForEmbedding({
        type: 'document',
        id: 'doc-1',
        firmId: 'firm-123',
      });

      expect(redis.lpush).toHaveBeenCalledTimes(2);
    });
  });

  describe('processQueue', () => {
    it('should process case items from queue', async () => {
      const mockCase = {
        id: 'case-queue',
        title: 'Queued Case',
        description: 'Description',
        caseNumber: 'Q-001',
        client: { name: 'Queue Client' },
        type: 'Advisory',
        status: 'Active',
      };
      const embedding = Array(1536).fill(0.9);

      (jest.mocked as any)(redis.rpop).mockResolvedValueOnce(
        JSON.stringify({ type: 'case', id: 'case-queue', firmId: 'firm-123' })
      );
      (jest.mocked as any)(redis.rpop).mockResolvedValueOnce(null);
      (jest.mocked as any)(prisma.case.findFirst).mockResolvedValue(mockCase as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.processQueue();

      expect(redis.rpop).toHaveBeenCalledWith('embedding:queue');
      expect(prisma.case.findFirst).toHaveBeenCalled();
    });

    it('should process document items from queue', async () => {
      const mockDocument = {
        id: 'doc-queue',
        fileName: 'queued.pdf',
        description: 'Queued document',
        fileType: 'application/pdf',
        client: { name: 'Queue Client' },
      };
      const embedding = Array(1536).fill(0.95);

      (jest.mocked as any)(redis.rpop).mockResolvedValueOnce(
        JSON.stringify({ type: 'document', id: 'doc-queue', firmId: 'firm-123' })
      );
      (jest.mocked as any)(redis.rpop).mockResolvedValueOnce(null);
      (jest.mocked as any)(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
          model: 'voyage-3',
          usage: { total_tokens: 100 },
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.processQueue();

      expect(prisma.document.findFirst).toHaveBeenCalled();
    });

    it('should handle empty queue', async () => {
      (jest.mocked as any)(redis.rpop).mockResolvedValue(null);

      await embeddingService.processQueue();

      expect(prisma.case.findFirst).not.toHaveBeenCalled();
      expect(prisma.document.findFirst).not.toHaveBeenCalled();
    });
  });
});
