import {
  smartTruncate,
  truncateExistingContent,
  truncateCaseContext,
  estimateTokens,
  exceedsLimit,
  getTruncationStats,
  CONTEXT_LIMITS,
} from './context-truncator';

describe('context-truncator', () => {
  describe('smartTruncate', () => {
    it('should return empty string for falsy input', () => {
      expect(smartTruncate('')).toBe('');
      expect(smartTruncate(null as any)).toBe('');
    });

    it('should return text unchanged if under limit', () => {
      const text = 'Short text that fits';
      const result = smartTruncate(text, { maxChars: 100 });
      expect(result).toBe(text);
    });

    it('should truncate long text with ellipsis', () => {
      const text = 'a'.repeat(1000);
      const result = smartTruncate(text, { maxChars: 500 });
      expect(result.length).toBeLessThanOrEqual(500);
      expect(result).toContain('[... conținut trunchiat ...]');
    });

    it('should preserve start and end portions', () => {
      // Create text where start/end markers are clearly at the boundaries
      const start = 'START_MARKER_' + 'a'.repeat(100);
      const middle =
        'b'.repeat(100) +
        '_ONLY_IN_MIDDLE_SECTION_' +
        'x'.repeat(3000) +
        '_MIDDLE_END_MARKER_' +
        'y'.repeat(100);
      const end = 'z'.repeat(100) + '_END_MARKER';
      const text = start + middle + end;

      const result = smartTruncate(text, {
        maxChars: 400,
        preserveStart: 150,
        preserveEnd: 150,
      });

      expect(result).toContain('START_MARKER');
      expect(result).toContain('END_MARKER');
      expect(result).toContain('[... conținut trunchiat ...]');
      // The unique middle content should be removed
      expect(result).not.toContain('_ONLY_IN_MIDDLE_SECTION_');
      expect(result).not.toContain('_MIDDLE_END_MARKER_');
    });

    it('should use type-based limits when type is provided', () => {
      const longText = 'a'.repeat(10000);
      const result = smartTruncate(longText, { type: 'clientContext' }); // 2000 limit
      expect(result.length).toBeLessThanOrEqual(CONTEXT_LIMITS.clientContext);
    });

    it('should skip ellipsis when disabled', () => {
      const text = 'a'.repeat(1000);
      const result = smartTruncate(text, { maxChars: 500, addEllipsis: false });
      expect(result).not.toContain('[... conținut trunchiat ...]');
    });
  });

  describe('truncateExistingContent', () => {
    it('should use existingContent limit', () => {
      const longText = 'a'.repeat(10000);
      const result = truncateExistingContent(longText);
      expect(result.length).toBeLessThanOrEqual(CONTEXT_LIMITS.existingContent);
    });

    it('should preserve more at the end', () => {
      const start = 'START_' + 'a'.repeat(500);
      const middle = 'b'.repeat(5000);
      const end = 'c'.repeat(500) + '_END';
      const text = start + middle + end;

      const result = truncateExistingContent(text);
      expect(result).toContain('START_');
      expect(result).toContain('_END');
    });
  });

  describe('truncateCaseContext', () => {
    it('should use caseContext limit', () => {
      const longText = 'a'.repeat(20000);
      const result = truncateCaseContext(longText);
      expect(result.length).toBeLessThanOrEqual(CONTEXT_LIMITS.caseContext);
    });
  });

  describe('estimateTokens', () => {
    it('should return 0 for empty input', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(null as any)).toBe(0);
    });

    it('should estimate approximately 4 chars per token', () => {
      const text = 'a'.repeat(400);
      expect(estimateTokens(text)).toBe(100);
    });

    it('should round up', () => {
      const text = 'a'.repeat(401);
      expect(estimateTokens(text)).toBe(101);
    });
  });

  describe('exceedsLimit', () => {
    it('should return false for empty input', () => {
      expect(exceedsLimit('', 'caseContext')).toBe(false);
      expect(exceedsLimit(null as any, 'caseContext')).toBe(false);
    });

    it('should return true when text exceeds limit', () => {
      const longText = 'a'.repeat(CONTEXT_LIMITS.clientContext + 100);
      expect(exceedsLimit(longText, 'clientContext')).toBe(true);
    });

    it('should return false when text is under limit', () => {
      const shortText = 'a'.repeat(CONTEXT_LIMITS.clientContext - 100);
      expect(exceedsLimit(shortText, 'clientContext')).toBe(false);
    });
  });

  describe('getTruncationStats', () => {
    it('should calculate correct stats for truncated text', () => {
      const original = 'a'.repeat(1000);
      const truncated = 'a'.repeat(500);

      const stats = getTruncationStats(original, truncated);

      expect(stats.originalLength).toBe(1000);
      expect(stats.truncatedLength).toBe(500);
      expect(stats.reductionPercent).toBe(50);
      expect(stats.wasTruncated).toBe(true);
    });

    it('should handle identical text', () => {
      const text = 'Same text';
      const stats = getTruncationStats(text, text);

      expect(stats.reductionPercent).toBe(0);
      expect(stats.wasTruncated).toBe(false);
    });

    it('should handle empty inputs', () => {
      const stats = getTruncationStats('', '');

      expect(stats.originalLength).toBe(0);
      expect(stats.truncatedLength).toBe(0);
      expect(stats.reductionPercent).toBe(0);
      expect(stats.wasTruncated).toBe(false);
    });

    it('should calculate token estimates', () => {
      const original = 'a'.repeat(400);
      const truncated = 'a'.repeat(200);

      const stats = getTruncationStats(original, truncated);

      expect(stats.originalTokens).toBe(100);
      expect(stats.truncatedTokens).toBe(50);
    });
  });

  describe('CONTEXT_LIMITS', () => {
    it('should have all expected limits defined', () => {
      expect(CONTEXT_LIMITS.existingContent).toBe(4000);
      expect(CONTEXT_LIMITS.caseContext).toBe(8000);
      expect(CONTEXT_LIMITS.clientContext).toBe(2000);
      expect(CONTEXT_LIMITS.selectedText).toBe(10000);
      expect(CONTEXT_LIMITS.cursorContext).toBe(3000);
      expect(CONTEXT_LIMITS.prompt).toBe(10000);
      expect(CONTEXT_LIMITS.researchResults).toBe(15000);
    });
  });
});
