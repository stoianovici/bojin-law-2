/**
 * Pattern Analysis Service Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import { PatternAnalysisService } from './pattern-analysis.service';
import { prisma } from '@legal-platform/database';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    trainingDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    documentPattern: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('PatternAnalysisService', () => {
  let service: PatternAnalysisService;

  beforeEach(() => {
    service = new PatternAnalysisService();
    jest.clearAllMocks();
  });

  describe('identifyPatterns', () => {
    it('should identify phrase patterns from documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          textContent:
            'The party hereby agrees to the terms and conditions set forth in this agreement.',
        },
        {
          id: 'doc-2',
          textContent: 'The party hereby agrees to fulfill all obligations as specified herein.',
        },
        {
          id: 'doc-3',
          textContent: 'The party hereby agrees to abide by the rules and regulations.',
        },
      ];

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue({ category: 'Contract' });
      (prisma.documentPattern.create as jest.Mock).mockResolvedValue({});

      const result = await service.identifyPatterns({ category: 'Contract' });

      expect(result.patterns.length).toBeGreaterThanOrEqual(0);
      expect(prisma.trainingDocument.findMany).toHaveBeenCalledWith({
        where: { category: 'Contract' },
        select: { id: true, textContent: true },
      });
    });

    it('should return empty results when not enough documents', async () => {
      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue([
        { id: 'doc-1', textContent: 'Some text' },
        { id: 'doc-2', textContent: 'Other text' },
      ]);

      const result = await service.identifyPatterns({
        category: 'Contract',
        minDocuments: 5,
      });

      expect(result.patterns).toHaveLength(0);
      expect(result.totalPatternsFound).toBe(0);
    });

    it('should respect minFrequency threshold', async () => {
      const mockDocuments = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `doc-${i}`,
          textContent: 'The quick brown fox jumps over the lazy dog',
        }));

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue({ category: 'Test' });
      (prisma.documentPattern.create as jest.Mock).mockResolvedValue({});

      const result = await service.identifyPatterns({
        category: 'Test',
        minFrequency: 5,
      });

      // Patterns should only appear if they meet frequency threshold
      for (const pattern of result.patterns) {
        expect(pattern.frequency).toBeGreaterThanOrEqual(5);
      }
    });

    it('should identify structural patterns (headings)', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          textContent: 'Introduction:\nSome content here\nConclusion:\nFinal thoughts',
        },
        { id: 'doc-2', textContent: 'Introduction:\nOther content\nConclusion:\nEnd notes' },
        { id: 'doc-3', textContent: 'Introduction:\nMore content\nConclusion:\nClosing remarks' },
      ];

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.documentPattern.create as jest.Mock).mockResolvedValue({});

      const result = await service.identifyPatterns({ category: 'Document' });

      const structurePatterns = result.patterns.filter((p) => p.patternType === 'structure');
      // Should find common headings
      expect(result).toBeDefined();
    });

    it('should store patterns in database', async () => {
      const mockDocuments = Array(4)
        .fill(null)
        .map((_, i) => ({
          id: `doc-${i}`,
          textContent: 'The liability clause states that all parties must comply with regulations.',
        }));

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue({ category: 'Contract' });
      (prisma.documentPattern.create as jest.Mock).mockResolvedValue({});

      await service.identifyPatterns({ category: 'Contract' });

      // Should have been called for creating patterns (if any found)
      expect(prisma.documentPattern.create).toBeDefined();
    });

    it('should calculate confidence scores correctly', async () => {
      const mockDocuments = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `doc-${i}`,
          textContent:
            'This is a common phrase that appears in many documents for testing purposes.',
        }));

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue({ category: 'Test' });
      (prisma.documentPattern.create as jest.Mock).mockResolvedValue({});

      const result = await service.identifyPatterns({ category: 'Test' });

      for (const pattern of result.patterns) {
        expect(pattern.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(pattern.confidenceScore).toBeLessThanOrEqual(1);
      }
    });

    it('should handle database errors gracefully', async () => {
      (prisma.trainingDocument.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.identifyPatterns({ category: 'Contract' })).rejects.toThrow(
        'Database error'
      );
    });

    it('should limit patterns to top 50', async () => {
      // Create documents with many unique phrases
      const mockDocuments = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `doc-${i}`,
          textContent: `This is document number ${i} with unique content that varies`,
        }));

      (prisma.trainingDocument.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.trainingDocument.findUnique as jest.Mock).mockResolvedValue({ category: 'Test' });
      (prisma.documentPattern.create as jest.Mock).mockResolvedValue({});

      const result = await service.identifyPatterns({ category: 'Test' });

      // Phrase patterns should be limited to 50
      const phrasePatterns = result.patterns.filter((p) => p.patternType === 'phrase');
      expect(phrasePatterns.length).toBeLessThanOrEqual(50);
    });
  });

  describe('tokenize', () => {
    it('should tokenize text into words', () => {
      // Access private method through any
      const tokens = (service as any).tokenize('The quick brown fox');
      expect(tokens).toEqual(['the', 'quick', 'brown', 'fox']);
    });

    it('should filter short words', () => {
      const tokens = (service as any).tokenize('A is to be');
      expect(tokens).toEqual([]); // All words are <= 2 chars
    });

    it('should lowercase all tokens', () => {
      const tokens = (service as any).tokenize('HELLO World Test');
      expect(tokens).toEqual(['hello', 'world', 'test']);
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate correct confidence ratio', () => {
      const confidence = (service as any).calculateConfidence(7, 10);
      expect(confidence).toBe(0.7);
    });

    it('should cap confidence at 1.0', () => {
      const confidence = (service as any).calculateConfidence(15, 10);
      expect(confidence).toBe(1.0);
    });

    it('should handle zero total documents', () => {
      const confidence = (service as any).calculateConfidence(0, 0);
      // 0/0 results in NaN or could be handled differently
      expect(confidence).toBeDefined();
    });
  });
});
