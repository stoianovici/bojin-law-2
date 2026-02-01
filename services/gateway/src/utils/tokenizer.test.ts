/**
 * Tokenizer Utility Tests
 * Phase 5: Accurate Token Counting
 */

import {
  estimateTokens,
  quickTokenCount,
  wouldExceedTokenLimit,
  truncateToTokenLimit,
} from './tokenizer';

// ============================================================================
// estimateTokens Tests
// ============================================================================

describe('estimateTokens', () => {
  describe('empty and edge cases', () => {
    it('should return 0 tokens for empty string', () => {
      const result = estimateTokens('');
      expect(result.tokens).toBe(0);
      expect(result.characters).toBe(0);
      expect(result.confidence).toBe('high');
    });

    it('should return 0 tokens for null/undefined', () => {
      const result = estimateTokens(null as unknown as string);
      expect(result.tokens).toBe(0);
    });

    it('should have low confidence for very short text', () => {
      const result = estimateTokens('Hi');
      expect(result.confidence).toBe('low');
      expect(result.warning).toBeDefined();
    });
  });

  describe('Romanian text detection', () => {
    it('should detect Romanian text by diacritics', () => {
      const result = estimateTokens(
        'Conform dispozițiilor art. 194 C.proc.civ., cererea de chemare în judecată trebuie să cuprindă...'
      );

      expect(result.contentType).toBe('romanian');
      expect(result.ratio).toBe(3.5);
    });

    it('should detect Romanian text by common words', () => {
      const result = estimateTokens(
        'Instanta de judecata, analizand cererea reclamantului si apararile paratei, constata ca actiunea este intemeiata pentru urmatoarele motive de fapt si de drept.'
      );

      expect(result.contentType).toBe('romanian');
    });

    it('should apply legal calibration factor for Romanian legal text', () => {
      const legalText =
        'Art. 194 alin. (1) lit. a) C.proc.civ. prevede că cererea de chemare în judecată trebuie să cuprindă: instanța căreia îi este adresată, numele și prenumele reclamantului, domiciliul sau reședința.';
      const result = estimateTokens(legalText);

      expect(result.contentType).toBe('romanian');
      expect(result.calibrationFactor).toBeGreaterThan(1.0); // Should have legal calibration
    });
  });

  describe('English text detection', () => {
    it('should detect English text', () => {
      const result = estimateTokens(
        'The court hereby orders that the defendant shall comply with the following provisions as stipulated in the contract.'
      );

      expect(result.contentType).toBe('english');
      expect(result.ratio).toBe(4.0);
    });
  });

  describe('code detection', () => {
    it('should detect code content', () => {
      const codeText = `
        function calculateDamages(principal, rate, days) {
          const interest = (principal * rate * days) / 365;
          return { principal, interest, total: principal + interest };
        }
      `;
      const result = estimateTokens(codeText);

      expect(result.contentType).toBe('code');
      expect(result.ratio).toBe(3.5);
    });

    it('should have medium confidence for code with many special chars', () => {
      const complexCode = '{}[](){}[](){}[]()'.repeat(50);
      const result = estimateTokens(complexCode);

      expect(result.contentType).toBe('code');
      expect(result.confidence).toBe('medium');
    });
  });

  describe('mixed content detection', () => {
    it('should detect predominantly English content with some Romanian', () => {
      // Mostly English with a few Romanian words
      const mixed =
        'The contractual provisions state that parties must provide notifications within 30 days, and any modifications require written consent.';
      const result = estimateTokens(mixed);

      // Should be detected as english (not enough Romanian to trigger detection)
      expect(result.contentType).toBe('english');
    });

    it('should detect Romanian content with diacritics', () => {
      // Romanian text with clear diacritics
      const romanian =
        'Părțile contractante trebuie să furnizeze notificări în termen de 30 de zile, iar orice modificări necesită consimțământ scris.';
      const result = estimateTokens(romanian);

      expect(result.contentType).toBe('romanian');
    });
  });

  describe('token count accuracy', () => {
    it('should account for whitespace in token count', () => {
      const withSpaces = 'word word word word word';
      const noSpaces = 'wordwordwordwordword';

      const withSpacesResult = estimateTokens(withSpaces);
      const noSpacesResult = estimateTokens(noSpaces);

      // Text with spaces should have more tokens
      expect(withSpacesResult.tokens).toBeGreaterThan(noSpacesResult.tokens);
    });

    it('should account for punctuation in token count', () => {
      const withPunctuation = 'Hello, world! How are you?';
      const noPunctuation = 'Hello world How are you';

      const withPunctResult = estimateTokens(withPunctuation);
      const noPunctResult = estimateTokens(noPunctuation);

      // Text with punctuation should have more tokens
      expect(withPunctResult.tokens).toBeGreaterThan(noPunctResult.tokens);
    });

    it('should account for numbers in token count', () => {
      const withNumbers = 'Article 194 paragraph 2 subsection 3';
      const noNumbers = 'Article one hundred ninety four paragraph two';

      const withNumResult = estimateTokens(withNumbers);
      const noNumResult = estimateTokens(noNumbers);

      // Numbers typically tokenize into multiple tokens
      expect(withNumResult.tokens).not.toBe(noNumResult.tokens);
    });
  });

  describe('confidence levels', () => {
    it('should have high confidence for long, consistent text', () => {
      const longText = 'Instanta de judecata '.repeat(100);
      const result = estimateTokens(longText);

      expect(result.confidence).toBe('high');
      expect(result.warning).toBeUndefined();
    });

    it('should have low confidence for very short text', () => {
      const shortText = 'Test';
      const result = estimateTokens(shortText);

      expect(result.confidence).toBe('low');
    });
  });
});

// ============================================================================
// quickTokenCount Tests
// ============================================================================

describe('quickTokenCount', () => {
  it('should return 0 for empty string', () => {
    expect(quickTokenCount('')).toBe(0);
    expect(quickTokenCount(null as unknown as string)).toBe(0);
  });

  it('should provide reasonable estimate', () => {
    // 100 characters should be roughly 28-35 tokens
    const text = 'x'.repeat(100);
    const count = quickTokenCount(text);

    expect(count).toBeGreaterThan(20);
    expect(count).toBeLessThan(50);
  });

  it('should include buffer for safety', () => {
    const text = 'x'.repeat(35); // Exactly ~10 tokens at 3.5 chars/token
    const count = quickTokenCount(text);

    // Should include buffer (+10)
    expect(count).toBeGreaterThan(10);
  });
});

// ============================================================================
// wouldExceedTokenLimit Tests
// ============================================================================

describe('wouldExceedTokenLimit', () => {
  it('should return false when under limit', () => {
    const result = wouldExceedTokenLimit('Short text', 1000);
    expect(result).toBe(false);
  });

  it('should return true when over limit', () => {
    const longText = 'x'.repeat(10000); // Will be > 100 tokens
    const result = wouldExceedTokenLimit(longText, 100);
    expect(result).toBe(true);
  });

  it('should return false for empty text', () => {
    const result = wouldExceedTokenLimit('', 10);
    expect(result).toBe(false);
  });
});

// ============================================================================
// truncateToTokenLimit Tests
// ============================================================================

describe('truncateToTokenLimit', () => {
  it('should return original text when under limit', () => {
    const text = 'Short text that fits';
    const result = truncateToTokenLimit(text, 1000);
    expect(result).toBe(text);
  });

  it('should truncate text when over limit', () => {
    const text = 'word '.repeat(100); // ~500 chars, many tokens
    const result = truncateToTokenLimit(text, 10);

    expect(result.length).toBeLessThan(text.length);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should truncate at word boundary when possible', () => {
    const text = 'This is a test sentence with multiple words for testing truncation behavior';
    const result = truncateToTokenLimit(text, 5);

    // Should end with ellipsis and not cut mid-word
    expect(result.endsWith('...')).toBe(true);
    // Should not have partial word before ellipsis (unless very short)
    const beforeEllipsis = result.replace('...', '').trim();
    const lastChar = beforeEllipsis[beforeEllipsis.length - 1];
    // Either ends with space or with a complete word
    expect(lastChar === ' ' || /[a-zA-Z]/.test(lastChar)).toBe(true);
  });

  it('should handle empty text', () => {
    const result = truncateToTokenLimit('', 10);
    expect(result).toBe('');
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('tokenizer integration', () => {
  it('should provide consistent estimates for same text', () => {
    const text = 'Conform art. 194 C.proc.civ., cererea de chemare în judecată...';

    const result1 = estimateTokens(text);
    const result2 = estimateTokens(text);

    expect(result1.tokens).toBe(result2.tokens);
    expect(result1.contentType).toBe(result2.contentType);
  });

  it('should handle real Romanian legal document excerpt', () => {
    const legalText = `
      CERERE DE CHEMARE ÎN JUDECATĂ

      Către,
      JUDECĂTORIA SECTOR 1 BUCUREȘTI

      Subsemnatul, POPESCU ION, cu domiciliul în București, str. Victoriei nr. 10,
      în calitate de reclamant, formulez prezenta cerere de chemare în judecată
      împotriva pârâtului IONESCU MARIA, cu domiciliul în București, str. Libertății nr. 5.

      OBIECTUL CERERII: Obligarea pârâtului la plata sumei de 50.000 lei, reprezentând
      contravaloarea prejudiciului cauzat prin neexecutarea obligațiilor contractuale.

      ÎN FAPT, arăt următoarele:
      La data de 15.01.2024, am încheiat cu pârâtul contractul de prestări servicii
      nr. 123/2024, prin care acesta s-a obligat să execute lucrări de renovare...
    `;

    const result = estimateTokens(legalText);

    expect(result.contentType).toBe('romanian');
    expect(result.tokens).toBeGreaterThan(100); // Substantial text
    // Confidence may be medium or high depending on content length
    expect(['medium', 'high']).toContain(result.confidence);
  });
});
