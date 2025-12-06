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
    },
    document: {
      findUnique: jest.fn(),
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
      (jest.mocked as any)(redis.get).mockResolvedValue(JSON.stringify(cachedEmbedding));

      const result = await embeddingService.generateEmbedding('test text');

      expect(result).toEqual(cachedEmbedding);
      expect(redis.get).toHaveBeenCalledWith(expect.stringContaining('embedding:'));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call Voyage AI API when embedding not cached', async () => {
      const embedding = Array(1536).fill(0.2);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
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
        }),
      });

      await embeddingService.generateEmbedding('test text');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('embedding:'),
        JSON.stringify(embedding),
        'EX',
        86400
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

    it('should truncate long text before generating embedding', async () => {
      const longText = 'a'.repeat(50000);
      const embedding = Array(1536).fill(0.4);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
        }),
      });

      await embeddingService.generateEmbedding(longText);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.input.length).toBeLessThan(longText.length);
    });

    it('should use chunking for very long texts', async () => {
      const longText = 'word '.repeat(10000);
      const embedding = Array(1536).fill(0.5);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
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

      (jest.mocked as any)(prisma.case.findUnique).mockResolvedValue(mockCase as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.generateCaseEmbedding('case-123', 'firm-123');

      expect(prisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-123', firmId: 'firm-123' },
        include: { client: true },
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should skip if case not found', async () => {
      (jest.mocked as any)(prisma.case.findUnique).mockResolvedValue(null);

      await embeddingService.generateCaseEmbedding('nonexistent', 'firm-123');

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

      (jest.mocked as any)(prisma.case.findUnique).mockResolvedValue(mockCase as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
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

      (jest.mocked as any)(prisma.document.findUnique).mockResolvedValue(mockDocument as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.generateDocumentEmbedding('doc-123', 'firm-123');

      expect(prisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-123', firmId: 'firm-123' },
        include: { client: true, case: true },
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should skip if document not found', async () => {
      (jest.mocked as any)(prisma.document.findUnique).mockResolvedValue(null);

      await embeddingService.generateDocumentEmbedding('nonexistent', 'firm-123');

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
        JSON.stringify({ type: 'case', id: 'case-789', firmId: 'firm-123' })
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
      (jest.mocked as any)(prisma.case.findUnique).mockResolvedValue(mockCase as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.processQueue();

      expect(redis.rpop).toHaveBeenCalledWith('embedding:queue');
      expect(prisma.case.findUnique).toHaveBeenCalled();
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
      (jest.mocked as any)(prisma.document.findUnique).mockResolvedValue(mockDocument as any);
      (jest.mocked as any)(redis.get).mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding }],
        }),
      });
      (jest.mocked as any)(prisma.$executeRaw).mockResolvedValue(1);

      await embeddingService.processQueue();

      expect(prisma.document.findUnique).toHaveBeenCalled();
    });

    it('should handle empty queue', async () => {
      (jest.mocked as any)(redis.rpop).mockResolvedValue(null);

      await embeddingService.processQueue();

      expect(prisma.case.findUnique).not.toHaveBeenCalled();
      expect(prisma.document.findUnique).not.toHaveBeenCalled();
    });
  });

});
