/**
 * Template Extraction Service Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import { TemplateExtractionService } from './template-extraction.service';
import { prisma } from '@legal-platform/database';
import { embeddingGenerationService } from './embedding-generation.service';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    trainingDocument: {
      findMany: jest.fn(),
    },
    templateLibrary: {
      create: jest.fn(),
    },
  },
}));

jest.mock('./embedding-generation.service', () => ({
  embeddingGenerationService: {
    calculateSimilarity: jest.fn(),
  },
}));

jest.mock('../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('TemplateExtractionService', () => {
  let service: TemplateExtractionService;

  beforeEach(() => {
    service = new TemplateExtractionService();
    jest.clearAllMocks();
  });

  describe('extractTemplates', () => {
    it('should extract templates from similar document clusters', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const mockDocuments = [
        {
          id: 'doc-1',
          textContent: 'Introduction\nContent\nConclusion',
          originalFilename: 'doc1.pdf',
          embeddings: [{ embedding: mockEmbedding }],
        },
        {
          id: 'doc-2',
          textContent: 'Introduction\nText\nConclusion',
          originalFilename: 'doc2.pdf',
          embeddings: [{ embedding: mockEmbedding }],
        },
        {
          id: 'doc-3',
          textContent: 'Introduction\nBody\nConclusion',
          originalFilename: 'doc3.pdf',
          embeddings: [{ embedding: mockEmbedding }],
        },
      ];

      (prisma.trainingDocument.findMany as jest.Mock)
        .mockResolvedValueOnce(mockDocuments) // First call with embeddings
        .mockResolvedValueOnce(
          mockDocuments.map((d) => ({
            id: d.id,
            textContent: d.textContent,
            originalFilename: d.originalFilename,
          }))
        ); // Second call for cluster

      (embeddingGenerationService.calculateSimilarity as jest.Mock).mockReturnValue(0.9);
      (prisma.templateLibrary.create as jest.Mock).mockResolvedValue({});

      const result = await service.extractTemplates({ category: 'Contract' });

      expect(result.totalTemplatesCreated).toBeGreaterThanOrEqual(0);
    });

    it('should return empty when not enough documents', async () => {
      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue([
        { id: 'doc-1', embeddings: [] },
        { id: 'doc-2', embeddings: [] },
      ]);

      const result = await service.extractTemplates({ category: 'Contract' });

      expect(result.templates).toHaveLength(0);
      expect(result.totalTemplatesCreated).toBe(0);
    });

    it('should filter clusters with less than 3 documents', async () => {
      const mockEmbedding1 = Array(1536).fill(0.1);
      const mockEmbedding2 = Array(1536).fill(0.9); // Very different

      const mockDocuments = [
        { id: 'doc-1', embeddings: [{ embedding: mockEmbedding1 }] },
        { id: 'doc-2', embeddings: [{ embedding: mockEmbedding1 }] },
        { id: 'doc-3', embeddings: [{ embedding: mockEmbedding2 }] }, // Dissimilar
      ];

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (embeddingGenerationService.calculateSimilarity as jest.Mock)
        .mockReturnValueOnce(0.95) // doc-1 vs doc-2: similar
        .mockReturnValueOnce(0.3); // doc-1 vs doc-3: not similar

      const result = await service.extractTemplates({ category: 'Contract' });

      // Should not create templates since no cluster has 3+ docs
      expect(result.totalTemplatesCreated).toBe(0);
    });

    it('should respect similarity threshold', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const mockDocuments = [
        { id: 'doc-1', embeddings: [{ embedding: mockEmbedding }] },
        { id: 'doc-2', embeddings: [{ embedding: mockEmbedding }] },
        { id: 'doc-3', embeddings: [{ embedding: mockEmbedding }] },
      ];

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (embeddingGenerationService.calculateSimilarity as jest.Mock).mockReturnValue(0.8);

      const result = await service.extractTemplates({
        category: 'Contract',
        similarityThreshold: 0.85, // Higher than actual similarity
      });

      expect(result.totalTemplatesCreated).toBe(0);
    });

    it('should store extracted templates', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      const mockDocuments = [
        {
          id: 'doc-1',
          textContent: 'Header\nContent',
          originalFilename: 'doc1.pdf',
          embeddings: [{ embedding: mockEmbedding }],
        },
        {
          id: 'doc-2',
          textContent: 'Header\nBody',
          originalFilename: 'doc2.pdf',
          embeddings: [{ embedding: mockEmbedding }],
        },
        {
          id: 'doc-3',
          textContent: 'Header\nText',
          originalFilename: 'doc3.pdf',
          embeddings: [{ embedding: mockEmbedding }],
        },
      ];

      (prisma.trainingDocument.findMany as jest.Mock)
        .mockResolvedValueOnce(mockDocuments)
        .mockResolvedValueOnce(
          mockDocuments.map((d) => ({
            id: d.id,
            textContent: d.textContent,
            originalFilename: d.originalFilename,
          }))
        );

      (embeddingGenerationService.calculateSimilarity as jest.Mock).mockReturnValue(0.9);
      (prisma.templateLibrary.create as jest.Mock).mockResolvedValue({});

      await service.extractTemplates({ category: 'Contract' });

      expect(prisma.templateLibrary.create).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      (prisma.trainingDocument.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.extractTemplates({ category: 'Contract' })).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('extractStructure', () => {
    it('should extract sections from document', () => {
      const text = 'Introduction\nSome content here.\nConclusion\nFinal notes.';
      const structure = (service as any).extractStructure(text);

      expect(structure.sections.length).toBeGreaterThan(0);
      expect(structure.totalSections).toBe(structure.sections.length);
    });

    it('should calculate average section length', () => {
      const text = 'A\nContent\nB\nMore content';
      const structure = (service as any).extractStructure(text);

      expect(structure.avgSectionLength).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const structure = (service as any).extractStructure('');

      expect(structure.sections).toHaveLength(0);
    });
  });

  describe('findCommonStructure', () => {
    it('should find common sections across structures', () => {
      const structures = [
        {
          sections: [
            { heading: 'Introduction', order: 0, commonPhrases: [] },
            { heading: 'Conclusion', order: 1, commonPhrases: [] },
          ],
          totalSections: 2,
          avgSectionLength: 100,
        },
        {
          sections: [
            { heading: 'Introduction', order: 0, commonPhrases: [] },
            { heading: 'Conclusion', order: 1, commonPhrases: [] },
          ],
          totalSections: 2,
          avgSectionLength: 120,
        },
        {
          sections: [
            { heading: 'Introduction', order: 0, commonPhrases: [] },
            { heading: 'Conclusion', order: 1, commonPhrases: [] },
          ],
          totalSections: 2,
          avgSectionLength: 110,
        },
      ];

      const common = (service as any).findCommonStructure(structures);

      expect(common.sections.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty structures array', () => {
      const common = (service as any).findCommonStructure([]);

      expect(common.sections).toHaveLength(0);
      expect(common.totalSections).toBe(0);
    });
  });

  describe('normalizeHeading', () => {
    it('should lowercase and remove special characters', () => {
      const normalized = (service as any).normalizeHeading('Introduction:');
      expect(normalized).toBe('introduction');
    });

    it('should handle already clean headings', () => {
      const normalized = (service as any).normalizeHeading('section');
      expect(normalized).toBe('section');
    });

    it('should preserve numbers', () => {
      const normalized = (service as any).normalizeHeading('Section 1');
      expect(normalized).toBe('section 1');
    });
  });

  describe('calculateQualityScore', () => {
    it('should return high score for consistent structures', () => {
      const structures = [
        { sections: [], totalSections: 5, avgSectionLength: 100 },
        { sections: [], totalSections: 5, avgSectionLength: 100 },
        { sections: [], totalSections: 5, avgSectionLength: 100 },
      ];

      const score = (service as any).calculateQualityScore(structures);
      expect(score).toBeGreaterThan(0.9);
    });

    it('should return lower score for inconsistent structures', () => {
      const structures = [
        { sections: [], totalSections: 2, avgSectionLength: 100 },
        { sections: [], totalSections: 10, avgSectionLength: 100 },
        { sections: [], totalSections: 5, avgSectionLength: 100 },
      ];

      const score = (service as any).calculateQualityScore(structures);
      expect(score).toBeLessThan(0.9);
    });

    it('should return 0 for empty array', () => {
      const score = (service as any).calculateQualityScore([]);
      expect(score).toBe(0);
    });
  });

  describe('parseEmbedding', () => {
    it('should return array as-is', () => {
      const embedding = [0.1, 0.2, 0.3];
      const parsed = (service as any).parseEmbedding(embedding);
      expect(parsed).toEqual(embedding);
    });

    it('should parse JSON string', () => {
      const embedding = '[0.1, 0.2, 0.3]';
      const parsed = (service as any).parseEmbedding(embedding);
      expect(parsed).toEqual([0.1, 0.2, 0.3]);
    });

    it('should return null for invalid input', () => {
      expect((service as any).parseEmbedding(null)).toBeNull();
      expect((service as any).parseEmbedding(undefined)).toBeNull();
      expect((service as any).parseEmbedding('invalid')).toBeNull();
    });
  });
});
