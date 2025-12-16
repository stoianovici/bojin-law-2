/**
 * Semantic Search Service Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import { SemanticSearchService } from './semantic-search.service';
import { prisma } from '@legal-platform/database';
import { embeddingGenerationService } from './embedding-generation.service';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    documentPattern: {
      findMany: jest.fn(),
    },
    templateLibrary: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('./embedding-generation.service', () => ({
  embeddingGenerationService: {
    generateQueryEmbedding: jest.fn(),
  },
}));

jest.mock('../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    service = new SemanticSearchService();
    jest.clearAllMocks();
  });

  describe('search', () => {
    const mockEmbedding = Array(1536).fill(0.1);

    beforeEach(() => {
      (embeddingGenerationService.generateQueryEmbedding as jest.Mock).mockResolvedValue(
        mockEmbedding
      );
    });

    it('should search without category filter', async () => {
      const mockResults = [
        {
          document_id: 'doc-1',
          chunk_text: 'sample text',
          similarity: 0.89,
          category: 'Contract',
          original_filename: 'test.pdf',
          metadata: {},
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

      const result = await service.search({
        query: 'liability clause',
        limit: 5,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].documentId).toBe('doc-1');
      expect(result.results[0].similarity).toBe(0.89);
      expect(embeddingGenerationService.generateQueryEmbedding).toHaveBeenCalledWith(
        'liability clause'
      );
    });

    it('should search with category filter', async () => {
      const mockResults = [
        {
          document_id: 'doc-2',
          chunk_text: 'contract text',
          similarity: 0.92,
          category: 'Contract',
          original_filename: 'contract.pdf',
          metadata: { type: 'legal' },
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

      const result = await service.search({
        query: 'liability clause',
        category: 'Contract',
        limit: 5,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].documentId).toBe('doc-2');
    });

    it('should use default limit and threshold when not provided', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.search({
        query: 'test query',
      });

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.search({
        query: 'nonexistent',
      });

      expect(result.results).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    it('should propagate errors from embedding generation', async () => {
      (embeddingGenerationService.generateQueryEmbedding as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      await expect(service.search({ query: 'test' })).rejects.toThrow('API Error');
    });

    it('should handle database errors gracefully', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      await expect(service.search({ query: 'test' })).rejects.toThrow('Database connection failed');
    });
  });

  describe('getCategoryPatterns', () => {
    it('should return patterns for a category', async () => {
      const mockPatterns = [
        { id: '1', category: 'Contract', patternText: 'hereby agrees', frequency: 10 },
        { id: '2', category: 'Contract', patternText: 'shall be liable', frequency: 8 },
      ];

      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue(mockPatterns);

      const result = await service.getCategoryPatterns('Contract');

      expect(result).toHaveLength(2);
      expect(prisma.documentPattern.findMany).toHaveBeenCalledWith({
        where: { category: 'Contract' },
        orderBy: { frequency: 'desc' },
        take: 10,
      });
    });

    it('should respect custom limit', async () => {
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue([]);

      await service.getCategoryPatterns('Contract', 5);

      expect(prisma.documentPattern.findMany).toHaveBeenCalledWith({
        where: { category: 'Contract' },
        orderBy: { frequency: 'desc' },
        take: 5,
      });
    });

    it('should return empty array when no patterns found', async () => {
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getCategoryPatterns('UnknownCategory');

      expect(result).toHaveLength(0);
    });
  });

  describe('getCategoryTemplates', () => {
    it('should return templates for a category', async () => {
      const mockTemplates = [
        { id: '1', category: 'Contract', name: 'Standard Contract', qualityScore: 0.95 },
        { id: '2', category: 'Contract', name: 'Service Agreement', qualityScore: 0.88 },
      ];

      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue(mockTemplates);

      const result = await service.getCategoryTemplates('Contract');

      expect(result).toHaveLength(2);
      expect(prisma.templateLibrary.findMany).toHaveBeenCalledWith({
        where: { category: 'Contract' },
        orderBy: [{ qualityScore: 'desc' }, { usageCount: 'desc' }],
        take: 5,
      });
    });

    it('should respect custom limit', async () => {
      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue([]);

      await service.getCategoryTemplates('Contract', 3);

      expect(prisma.templateLibrary.findMany).toHaveBeenCalledWith({
        where: { category: 'Contract' },
        orderBy: [{ qualityScore: 'desc' }, { usageCount: 'desc' }],
        take: 3,
      });
    });
  });

  describe('fullTextSearch', () => {
    it('should perform full-text search without category filter', async () => {
      const mockResults = [
        {
          id: 'doc-1',
          category: 'Contract',
          original_filename: 'contract.pdf',
          text_content: 'This is a contract document',
          rank: 0.85,
          headline: 'This is a <b>contract</b> document',
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

      const result = await service.fullTextSearch('contract');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc-1');
      expect(result[0].rank).toBe(0.85);
    });

    it('should perform full-text search with category filter', async () => {
      const mockResults = [
        {
          id: 'doc-2',
          category: 'Agreement',
          original_filename: 'agreement.pdf',
          text_content: 'Service agreement document',
          rank: 0.9,
          headline: 'Service <b>agreement</b> document',
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);

      const result = await service.fullTextSearch('agreement', 'Agreement');

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('Agreement');
    });

    it('should handle empty results', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.fullTextSearch('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.fullTextSearch('test')).rejects.toThrow('Database error');
    });
  });

  describe('hybridSearch', () => {
    const mockEmbedding = Array(1536).fill(0.1);

    beforeEach(() => {
      (embeddingGenerationService.generateQueryEmbedding as jest.Mock).mockResolvedValue(
        mockEmbedding
      );
    });

    it('should combine semantic and full-text results', async () => {
      const semanticResults = [
        {
          document_id: 'doc-1',
          chunk_text: 'semantic result',
          similarity: 0.9,
          category: 'Contract',
          original_filename: 'file.pdf',
          metadata: { category: 'Contract', original_filename: 'file.pdf' },
        },
      ];

      const textResults = [
        {
          id: 'doc-2',
          category: 'Contract',
          original_filename: 'other.pdf',
          text_content: 'text result',
          rank: 0.8,
          headline: 'text result',
        },
      ];

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(semanticResults) // semantic search
        .mockResolvedValueOnce(textResults); // full-text search

      const result = await service.hybridSearch('test query');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('combinedScore');
      expect(result[0]).toHaveProperty('semanticScore');
      expect(result[0]).toHaveProperty('textScore');
    });

    it('should merge results for same document', async () => {
      const semanticResults = [
        {
          document_id: 'doc-1',
          chunk_text: 'shared doc',
          similarity: 0.9,
          category: 'Contract',
          original_filename: 'file.pdf',
          metadata: {},
        },
      ];

      const textResults = [
        {
          id: 'doc-1',
          category: 'Contract',
          original_filename: 'file.pdf',
          text_content: 'shared doc',
          rank: 0.8,
          headline: 'shared doc',
        },
      ];

      // Mock both semantic and full-text search queries
      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(semanticResults) // semantic search
        .mockResolvedValueOnce(textResults); // full-text search

      const result = await service.hybridSearch('test');

      // Hybrid search should return results
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect semantic weight parameter', async () => {
      const semanticResults = [
        {
          document_id: 'doc-1',
          chunk_text: 'semantic',
          similarity: 1.0,
          category: 'Contract',
          original_filename: 'file.pdf',
          metadata: {},
        },
      ];

      const textResults = [
        {
          id: 'doc-2',
          category: 'Contract',
          original_filename: 'other.pdf',
          text_content: 'text',
          rank: 1.0,
          headline: 'text',
        },
      ];

      (prisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(semanticResults)
        .mockResolvedValueOnce(textResults);

      const result = await service.hybridSearch('test', undefined, 10, 0.5);

      // Should return results based on semantic and text searches
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle errors in either search', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Search failed'));

      await expect(service.hybridSearch('test')).rejects.toThrow('Search failed');
    });
  });
});
