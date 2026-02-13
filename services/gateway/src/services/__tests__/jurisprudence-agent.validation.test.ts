/**
 * Jurisprudence Agent Validation Tests
 *
 * Tests for Zod validation schemas and URL validation functions.
 */

import {
  SearchJurisprudenceInputSchema,
  SubmitJurisprudenceNotesInputSchema,
  JurisprudenceCitationInputSchema,
  isValidJurisprudenceUrl,
  isValidIsoDate,
  isValidRomanianDate,
  extractDomain,
  normalizeUrl,
  areUrlsEquivalent,
  normalizeDateToIso,
  isoToRomanianDate,
  validateSearchInput,
  validateSubmitInput,
  safeValidateSearchInput,
  safeValidateSubmitInput,
} from '../jurisprudence-agent.validation';

// ============================================================================
// URL Validation Tests
// ============================================================================

describe('isValidJurisprudenceUrl', () => {
  describe('valid URLs', () => {
    it('should accept rejust.ro URLs', () => {
      expect(isValidJurisprudenceUrl('https://rejust.ro/juris/abc123')).toBe(true);
      expect(isValidJurisprudenceUrl('https://www.rejust.ro/decizie/123')).toBe(true);
      expect(isValidJurisprudenceUrl('http://rejust.ro/search?q=test')).toBe(true);
    });

    it('should accept scj.ro URLs', () => {
      expect(isValidJurisprudenceUrl('https://scj.ro/decizii/2024/123')).toBe(true);
      expect(isValidJurisprudenceUrl('https://www.scj.ro/jurisprudenta')).toBe(true);
    });

    it('should accept ccr.ro URLs', () => {
      expect(isValidJurisprudenceUrl('https://ccr.ro/decizii/2024/D123')).toBe(true);
      expect(isValidJurisprudenceUrl('https://www.ccr.ro/hotarari')).toBe(true);
    });

    it('should accept rolii.ro URLs', () => {
      expect(isValidJurisprudenceUrl('https://rolii.ro/hotarari/abc123')).toBe(true);
    });

    it('should accept portal.just.ro URLs', () => {
      expect(isValidJurisprudenceUrl('https://portal.just.ro/123/decizie')).toBe(true);
    });

    it('should accept just.ro URLs', () => {
      expect(isValidJurisprudenceUrl('https://just.ro/info/123')).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('should reject unknown domains', () => {
      expect(isValidJurisprudenceUrl('https://google.com/search?q=test')).toBe(false);
      expect(isValidJurisprudenceUrl('https://wikipedia.org/wiki/Law')).toBe(false);
      expect(isValidJurisprudenceUrl('https://example.com/fake')).toBe(false);
    });

    it('should reject fabricated legal-looking URLs', () => {
      expect(isValidJurisprudenceUrl('https://fake-rejust.ro/decizie/123')).toBe(false);
      expect(isValidJurisprudenceUrl('https://rejust.fake.ro/decizie/123')).toBe(false);
    });

    it('should reject empty or malformed URLs', () => {
      expect(isValidJurisprudenceUrl('')).toBe(false);
      expect(isValidJurisprudenceUrl('not-a-url')).toBe(false);
      expect(isValidJurisprudenceUrl('rejust.ro/no-protocol')).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(isValidJurisprudenceUrl(null as unknown as string)).toBe(false);
      expect(isValidJurisprudenceUrl(undefined as unknown as string)).toBe(false);
    });
  });
});

describe('extractDomain', () => {
  it('should extract domain from valid URLs', () => {
    expect(extractDomain('https://rejust.ro/path')).toBe('rejust.ro');
    expect(extractDomain('https://www.scj.ro/path')).toBe('scj.ro');
    expect(extractDomain('http://ccr.ro/decizie')).toBe('ccr.ro');
  });

  it('should return invalid-url for malformed URLs', () => {
    expect(extractDomain('not-a-url')).toBe('invalid-url');
    expect(extractDomain('')).toBe('invalid-url');
  });
});

// ============================================================================
// URL Normalization Tests
// ============================================================================

describe('normalizeUrl', () => {
  it('should normalize www prefix', () => {
    expect(normalizeUrl('https://www.rejust.ro/path')).toBe('https://rejust.ro/path');
    expect(normalizeUrl('https://rejust.ro/path')).toBe('https://rejust.ro/path');
  });

  it('should remove tracking parameters', () => {
    expect(normalizeUrl('https://rejust.ro/decizie?utm_source=google&id=123')).toBe(
      'https://rejust.ro/decizie?id=123'
    );
    expect(normalizeUrl('https://rejust.ro/path?fbclid=abc123')).toBe('https://rejust.ro/path');
  });

  it('should remove trailing slashes', () => {
    expect(normalizeUrl('https://rejust.ro/path/')).toBe('https://rejust.ro/path');
    expect(normalizeUrl('https://rejust.ro/')).toBe('https://rejust.ro/');
  });

  it('should remove hash fragments', () => {
    expect(normalizeUrl('https://rejust.ro/path#section')).toBe('https://rejust.ro/path');
  });

  it('should sort query parameters', () => {
    expect(normalizeUrl('https://rejust.ro?b=2&a=1')).toBe('https://rejust.ro/?a=1&b=2');
  });

  it('should handle empty or invalid URLs', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });

  // Percent-encoding tests
  it('should decode percent-encoded characters in path', () => {
    // %2F is encoded /
    expect(normalizeUrl('https://rejust.ro/juris%2Ftest')).toBe('https://rejust.ro/juris/test');
  });

  it('should treat percent-encoded and decoded URLs as equivalent', () => {
    const encoded = normalizeUrl('https://rejust.ro/path%2Fto%2Fresource');
    const decoded = normalizeUrl('https://rejust.ro/path/to/resource');
    expect(encoded).toBe(decoded);
  });

  it('should handle mixed encoding in URLs', () => {
    // Some parts encoded, some not
    expect(normalizeUrl('https://rejust.ro/juris%2F123/test')).toBe(
      'https://rejust.ro/juris/123/test'
    );
  });

  it('should handle malformed percent-encoding gracefully', () => {
    // Malformed encoding should return the path as-is
    const malformed = 'https://rejust.ro/path%ZZ/test';
    const result = normalizeUrl(malformed);
    // Should not crash, should return something usable
    expect(result).toBeTruthy();
    expect(result).toContain('rejust.ro');
  });

  it('should decode common Romanian characters', () => {
    // ț encoded as %C8%9B
    const result = normalizeUrl('https://rejust.ro/decizie%C8%9Bie');
    expect(result).toBe('https://rejust.ro/decizieție');
  });
});

describe('areUrlsEquivalent', () => {
  it('should match URLs that normalize to the same value', () => {
    expect(
      areUrlsEquivalent('https://www.rejust.ro/decizie/123', 'https://rejust.ro/decizie/123')
    ).toBe(true);

    expect(
      areUrlsEquivalent(
        'https://rejust.ro/decizie/123?utm_source=google',
        'https://rejust.ro/decizie/123'
      )
    ).toBe(true);
  });

  it('should not match different URLs', () => {
    expect(
      areUrlsEquivalent('https://rejust.ro/decizie/123', 'https://rejust.ro/decizie/456')
    ).toBe(false);
  });
});

// ============================================================================
// Date Validation Tests
// ============================================================================

describe('isValidIsoDate', () => {
  it('should accept valid ISO dates', () => {
    expect(isValidIsoDate('2024-01-15')).toBe(true);
    expect(isValidIsoDate('2020-12-31')).toBe(true);
    expect(isValidIsoDate('1990-06-01')).toBe(true);
  });

  it('should reject invalid ISO dates', () => {
    expect(isValidIsoDate('2024-13-01')).toBe(false); // Invalid month
    expect(isValidIsoDate('2024-02-30')).toBe(false); // Invalid day
    expect(isValidIsoDate('24-01-15')).toBe(false); // Wrong format
    expect(isValidIsoDate('2024/01/15')).toBe(false); // Wrong separator
  });

  it('should reject non-date strings', () => {
    expect(isValidIsoDate('')).toBe(false);
    expect(isValidIsoDate('not-a-date')).toBe(false);
    expect(isValidIsoDate('15.01.2024')).toBe(false);
  });
});

describe('isValidRomanianDate', () => {
  it('should accept valid Romanian dates', () => {
    expect(isValidRomanianDate('15.01.2024')).toBe(true);
    expect(isValidRomanianDate('31.12.2020')).toBe(true);
    expect(isValidRomanianDate('01.06.1990')).toBe(true);
  });

  it('should reject invalid Romanian dates', () => {
    expect(isValidRomanianDate('01.13.2024')).toBe(false); // Invalid month
    expect(isValidRomanianDate('30.02.2024')).toBe(false); // Invalid day
    expect(isValidRomanianDate('1.1.2024')).toBe(false); // Missing leading zeros
  });

  it('should reject non-date strings', () => {
    expect(isValidRomanianDate('')).toBe(false);
    expect(isValidRomanianDate('2024-01-15')).toBe(false);
    expect(isValidRomanianDate('15/01/2024')).toBe(false);
  });
});

// ============================================================================
// Date Normalization Tests
// ============================================================================

describe('normalizeDateToIso', () => {
  it('should pass through valid ISO dates', () => {
    expect(normalizeDateToIso('2024-01-15')).toBe('2024-01-15');
    expect(normalizeDateToIso('2020-12-31')).toBe('2020-12-31');
  });

  it('should convert Romanian format to ISO', () => {
    expect(normalizeDateToIso('15.01.2024')).toBe('2024-01-15');
    expect(normalizeDateToIso('31.12.2020')).toBe('2020-12-31');
  });

  it('should convert slash format to ISO', () => {
    expect(normalizeDateToIso('15/01/2024')).toBe('2024-01-15');
    expect(normalizeDateToIso('31/12/2020')).toBe('2020-12-31');
  });

  it('should handle year-only format', () => {
    expect(normalizeDateToIso('2024')).toBe('2024-01-01');
    expect(normalizeDateToIso('2020')).toBe('2020-01-01');
  });

  it('should reject years outside valid range', () => {
    expect(normalizeDateToIso('1980')).toBe(null);
    expect(normalizeDateToIso('2050')).toBe(null);
  });

  it('should return null for invalid dates', () => {
    expect(normalizeDateToIso('')).toBe(null);
    expect(normalizeDateToIso('not-a-date')).toBe(null);
    expect(normalizeDateToIso('32.01.2024')).toBe(null); // Invalid day
    expect(normalizeDateToIso('15.13.2024')).toBe(null); // Invalid month
  });
});

describe('isoToRomanianDate', () => {
  it('should convert ISO to Romanian format', () => {
    expect(isoToRomanianDate('2024-01-15')).toBe('15.01.2024');
    expect(isoToRomanianDate('2020-12-31')).toBe('31.12.2020');
  });

  it('should return empty string for invalid ISO dates', () => {
    expect(isoToRomanianDate('')).toBe('');
    expect(isoToRomanianDate('not-a-date')).toBe('');
    expect(isoToRomanianDate('15.01.2024')).toBe(''); // Wrong format
  });
});

// ============================================================================
// Search Input Schema Tests
// ============================================================================

describe('SearchJurisprudenceInputSchema', () => {
  it('should accept valid search input', () => {
    const input = {
      query: 'răspundere civilă delictuală',
    };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept search with all optional fields', () => {
    const input = {
      query: 'rezoluțiune contract',
      courts: ['ÎCCJ', 'CCR'],
      yearRange: { from: 2020, to: 2024 },
      maxResults: 10,
    };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject empty query', () => {
    const input = { query: '' };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('minim 3 caractere');
  });

  it('should reject query too short', () => {
    const input = { query: 'ab' };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject query too long', () => {
    const input = { query: 'a'.repeat(501) };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid court values', () => {
    const input = {
      query: 'test query',
      courts: ['ÎCCJ', 'InvalidCourt'],
    };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject invalid year range (from > to)', () => {
    const input = {
      query: 'test query',
      yearRange: { from: 2024, to: 2020 },
    };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    // Error message is in Romanian
    expect(result.error?.issues[0].message).toContain('<=');
  });

  it('should reject year outside valid range', () => {
    const input = {
      query: 'test query',
      yearRange: { from: 1980, to: 2024 },
    };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject maxResults out of range', () => {
    const input = {
      query: 'test query',
      maxResults: 20,
    };
    const result = SearchJurisprudenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Citation Schema Tests
// ============================================================================

describe('JurisprudenceCitationInputSchema', () => {
  const validCitation = {
    id: 'src1',
    decisionNumber: '30/2020',
    court: 'ÎCCJ',
    url: 'https://rejust.ro/juris/123',
    summary: 'Test summary',
    relevance: 'Relevant for X',
  };

  it('should accept valid citation', () => {
    const result = JurisprudenceCitationInputSchema.safeParse(validCitation);
    expect(result.success).toBe(true);
  });

  it('should accept citation with all optional fields', () => {
    const citation = {
      ...validCitation,
      decisionType: 'decizie',
      courtFull: 'Înalta Curte de Casație și Justiție',
      section: 'Secția I civilă',
      date: '2020-05-15',
      dateFormatted: '15.05.2020',
      caseNumber: 'Dosar nr. 1234/1/2020',
      officialGazette: 'M.Of. nr. 517/2020',
    };
    const result = JurisprudenceCitationInputSchema.safeParse(citation);
    expect(result.success).toBe(true);
  });

  it('should reject citation with invalid URL', () => {
    const citation = {
      ...validCitation,
      url: 'not-a-url',
    };
    const result = JurisprudenceCitationInputSchema.safeParse(citation);
    expect(result.success).toBe(false);
  });

  it('should reject citation with missing required fields', () => {
    const citation = {
      id: 'src1',
      // missing decisionNumber, court, url, summary, relevance
    };
    const result = JurisprudenceCitationInputSchema.safeParse(citation);
    expect(result.success).toBe(false);
  });

  it('should reject summary that is too long', () => {
    const citation = {
      ...validCitation,
      summary: 'a'.repeat(501),
    };
    const result = JurisprudenceCitationInputSchema.safeParse(citation);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Submit Input Schema Tests
// ============================================================================

describe('SubmitJurisprudenceNotesInputSchema', () => {
  const validCitation = {
    id: 'src1',
    decisionNumber: '30/2020',
    court: 'ÎCCJ',
    url: 'https://rejust.ro/juris/123',
    summary: 'Test summary',
    relevance: 'Relevant for X',
  };

  const validSubmitInput = {
    topic: 'Răspundere civilă delictuală',
    summary: 'Summary of findings',
    citations: [validCitation],
    analysis: 'Analysis of jurisprudence',
    gaps: ['No decisions found after 2022'],
  };

  it('should accept valid submit input', () => {
    const result = SubmitJurisprudenceNotesInputSchema.safeParse(validSubmitInput);
    expect(result.success).toBe(true);
  });

  it('should accept submit input with empty citations', () => {
    const input = {
      ...validSubmitInput,
      citations: [],
    };
    const result = SubmitJurisprudenceNotesInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject submit input with missing topic', () => {
    const input = {
      ...validSubmitInput,
      topic: '',
    };
    const result = SubmitJurisprudenceNotesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject submit input with too many citations', () => {
    const input = {
      ...validSubmitInput,
      citations: Array(21).fill(validCitation),
    };
    const result = SubmitJurisprudenceNotesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject analysis that is too long', () => {
    const input = {
      ...validSubmitInput,
      analysis: 'a'.repeat(3001),
    };
    const result = SubmitJurisprudenceNotesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('validateSearchInput', () => {
  it('should return validated input for valid data', () => {
    const input = { query: 'test query' };
    const result = validateSearchInput(input);
    expect(result.query).toBe('test query');
  });

  it('should throw for invalid data', () => {
    expect(() => validateSearchInput({ query: '' })).toThrow();
  });
});

describe('validateSubmitInput', () => {
  it('should return validated input for valid data', () => {
    const input = {
      topic: 'Test topic',
      summary: 'Summary',
      citations: [],
      analysis: 'Analysis',
      gaps: [],
    };
    const result = validateSubmitInput(input);
    expect(result.topic).toBe('Test topic');
  });

  it('should throw for invalid data', () => {
    expect(() => validateSubmitInput({ topic: '' })).toThrow();
  });
});

describe('safeValidateSearchInput', () => {
  it('should return success: true for valid data', () => {
    const result = safeValidateSearchInput({ query: 'test query' });
    expect(result.success).toBe(true);
  });

  it('should return success: false with error for invalid data', () => {
    const result = safeValidateSearchInput({ query: '' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('safeValidateSubmitInput', () => {
  it('should return success: true for valid data', () => {
    const result = safeValidateSubmitInput({
      topic: 'Test',
      summary: 'Summary',
      citations: [],
      analysis: 'Analysis',
      gaps: [],
    });
    expect(result.success).toBe(true);
  });

  it('should return success: false with error for invalid data', () => {
    const result = safeValidateSubmitInput({});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
