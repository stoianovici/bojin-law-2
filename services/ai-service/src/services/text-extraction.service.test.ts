/**
 * Text Extraction Service Tests
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 */

import { TextExtractionService } from './text-extraction.service';

describe('TextExtractionService', () => {
  let service: TextExtractionService;

  beforeEach(() => {
    service = new TextExtractionService();
  });

  describe('validateFile', () => {
    it('should validate supported file types', () => {
      expect(service.validateFile('pdf', 1024)).toBe(true);
      expect(service.validateFile('docx', 1024)).toBe(true);
      expect(service.validateFile('doc', 1024)).toBe(true);
    });

    it('should reject unsupported file types', () => {
      expect(service.validateFile('txt', 1024)).toBe(false);
      expect(service.validateFile('xlsx', 1024)).toBe(false);
    });

    it('should reject files that are too large', () => {
      const maxSize = 100 * 1024 * 1024;
      expect(service.validateFile('pdf', maxSize + 1)).toBe(false);
    });
  });
});
