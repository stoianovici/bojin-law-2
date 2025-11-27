/**
 * Embedding Generation Service Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import { EmbeddingGenerationService } from './embedding-generation.service';

describe('EmbeddingGenerationService', () => {
  let service: EmbeddingGenerationService;

  beforeEach(() => {
    service = new EmbeddingGenerationService();
  });

  describe('calculateSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      expect(service.calculateSimilarity(a, b)).toBe(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(service.calculateSimilarity(a, b)).toBeCloseTo(0);
    });

    it('should throw error for mismatched dimensions', () => {
      const a = [1, 0];
      const b = [1, 0, 0];
      expect(() => service.calculateSimilarity(a, b)).toThrow();
    });
  });
});
