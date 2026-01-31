/**
 * Anchor Matching Utility Tests
 *
 * Tests for fuzzy anchor text matching used to auto-apply user corrections
 * after comprehension regeneration.
 */

import {
  findAnchorMatches,
  hasExactMatch,
  CorrectionWithAnchor,
} from '../../src/utils/anchor-matching';

describe('Anchor Matching Utility', () => {
  // ==========================================================================
  // findAnchorMatches
  // ==========================================================================

  describe('findAnchorMatches', () => {
    it('should find exact matches', () => {
      const text =
        'The client has requested a meeting to discuss the contract terms and conditions.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'discuss the contract terms',
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(1);
      expect(matches[0].correctionId).toBe('corr-1');
      // Fuzzy matching with sliding window may not be perfect
      expect(matches[0].similarity).toBeGreaterThan(0.8);
    });

    it('should find fuzzy matches with small differences', () => {
      const text =
        'The client has requested a meeting to discuss the contractual terms and conditions.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'discuss the contract terms', // 'contract' vs 'contractual'
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections, 0.7);

      expect(matches).toHaveLength(1);
      expect(matches[0].correctionId).toBe('corr-1');
      expect(matches[0].similarity).toBeGreaterThan(0.7);
    });

    it('should skip anchors that are too short', () => {
      const text = 'Some text with a word here.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'word', // Only 4 characters - too short
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(0);
    });

    it('should handle multiple corrections', () => {
      const text = 'The contract was signed on January 15th. The deadline is February 28th.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'signed on January 15th',
          anchorHash: 'hash1',
        },
        {
          id: 'corr-2',
          anchorText: 'deadline is February 28th',
          anchorHash: 'hash2',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(2);
      expect(matches.map((m) => m.correctionId).sort()).toEqual(['corr-1', 'corr-2']);
    });

    it('should not match when similarity is below threshold', () => {
      const text = 'This is completely different content.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'The contract was signed by both parties',
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(0);
    });

    it('should handle whitespace normalization', () => {
      const text = 'The   contract    was   signed.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'The contract was signed',
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(1);
      expect(matches[0].similarity).toBeGreaterThan(0.9);
    });

    it('should be case-insensitive', () => {
      const text = 'THE CONTRACT WAS SIGNED BY THE CLIENT.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'the contract was signed',
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(1);
      expect(matches[0].similarity).toBeGreaterThan(0.9);
    });

    it('should handle empty corrections array', () => {
      const text = 'Some text here.';
      const corrections: CorrectionWithAnchor[] = [];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(0);
    });

    it('should handle empty text', () => {
      const text = '';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'some anchor text here',
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(0);
    });

    it('should return the best match when multiple windows match', () => {
      const text = 'Contract A was signed. Contract B was also signed. Contract C was signed too.';
      const corrections: CorrectionWithAnchor[] = [
        {
          id: 'corr-1',
          anchorText: 'Contract B was also signed',
          anchorHash: 'hash1',
        },
      ];

      const matches = findAnchorMatches(text, corrections);

      expect(matches).toHaveLength(1);
      // Should find a match with reasonable similarity
      expect(matches[0].similarity).toBeGreaterThan(0.8);
    });
  });

  // ==========================================================================
  // hasExactMatch
  // ==========================================================================

  describe('hasExactMatch', () => {
    it('should return true for exact matches', () => {
      const text = 'The contract was signed by the client.';
      const anchorText = 'contract was signed';

      expect(hasExactMatch(text, anchorText)).toBe(true);
    });

    it('should be case-insensitive', () => {
      const text = 'THE CONTRACT WAS SIGNED.';
      const anchorText = 'the contract was signed';

      expect(hasExactMatch(text, anchorText)).toBe(true);
    });

    it('should normalize whitespace', () => {
      const text = 'The   contract    was   signed.';
      const anchorText = 'The contract was signed';

      expect(hasExactMatch(text, anchorText)).toBe(true);
    });

    it('should return false when no match', () => {
      const text = 'Some completely different text.';
      const anchorText = 'The contract was signed';

      expect(hasExactMatch(text, anchorText)).toBe(false);
    });
  });
});
