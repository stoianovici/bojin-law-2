/**
 * Reference Extractor Tests
 * OPS-029: AI Email Classification Service
 */

import {
  extractReferences,
  extractCourtFiles,
  containsReference,
  matchReferences,
  getEmailDomain,
  matchesDomain,
  ExtractedReference,
} from '../reference-extractor';

describe('extractReferences', () => {
  describe('court file extraction', () => {
    it('should extract standard court file format', () => {
      const text = 'Referitor la dosarul nr. 1234/3/2024, vă informăm că...';
      const refs = extractReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0].type).toBe('court_file');
      expect(refs[0].normalized).toBe('1234/3/2024');
    });

    it('should extract court file with "dosar" prefix', () => {
      const text = 'În dosar 1234/3/2024 s-a pronunțat...';
      const refs = extractReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0].type).toBe('court_file');
      expect(refs[0].normalized).toBe('1234/3/2024');
    });

    it('should extract court file with "dosarul" prefix', () => {
      const text = 'Dosarul 5678/2/2023 a fost finalizat.';
      const refs = extractReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0].type).toBe('court_file');
      expect(refs[0].normalized).toBe('5678/2/2023');
    });

    it('should extract multiple court files', () => {
      const text = 'În dosarul 1234/3/2024 și dosarul 5678/2/2023, se va dispune...';
      const refs = extractReferences(text);

      expect(refs).toHaveLength(2);
      expect(refs.map((r) => r.normalized)).toContain('1234/3/2024');
      expect(refs.map((r) => r.normalized)).toContain('5678/2/2023');
    });

    it('should extract standalone court file format', () => {
      const text = 'Re: 12345/1/2024 - Comunicare';
      const refs = extractReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0].normalized).toBe('12345/1/2024');
    });

    it('should handle spaces in court file format', () => {
      const text = 'Dosar nr. 1234 / 3 / 2024';
      const refs = extractReferences(text);

      expect(refs).toHaveLength(1);
      expect(refs[0].normalized).toBe('1234/3/2024');
    });

    it('should not duplicate references', () => {
      const text = 'Dosar 1234/3/2024, referitor la dosarul nr. 1234/3/2024';
      const refs = extractReferences(text);

      expect(refs).toHaveLength(1);
    });
  });

  describe('contract extraction', () => {
    it('should extract contract number with year', () => {
      const text = 'Contract nr. 123/2024 semnat la...';
      const refs = extractReferences(text);

      expect(refs.some((r) => r.type === 'contract')).toBe(true);
    });

    it('should extract contract without year', () => {
      const text = 'Contractul nr. 456 prevede că...';
      const refs = extractReferences(text);

      expect(refs.some((r) => r.type === 'contract')).toBe(true);
    });
  });

  describe('invoice extraction', () => {
    it('should extract invoice number', () => {
      const text = 'Factura 123456 din 15.10.2024';
      const refs = extractReferences(text);

      expect(refs.some((r) => r.type === 'invoice')).toBe(true);
    });

    it('should extract invoice with prefix', () => {
      const text = 'Fact. nr. 789012 emisă de...';
      const refs = extractReferences(text);

      expect(refs.some((r) => r.type === 'invoice')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty text', () => {
      expect(extractReferences('')).toEqual([]);
    });

    it('should return empty array for null/undefined', () => {
      expect(extractReferences(null as unknown as string)).toEqual([]);
      expect(extractReferences(undefined as unknown as string)).toEqual([]);
    });

    it('should return empty array for text with no references', () => {
      const text = 'Bună ziua, vă trimitem anexat documentele solicitate.';
      expect(extractReferences(text)).toEqual([]);
    });
  });
});

describe('extractCourtFiles', () => {
  it('should only return court file references', () => {
    const text = 'Dosar 1234/3/2024 și Contract nr. 567/2024';
    const refs = extractCourtFiles(text);

    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('court_file');
  });
});

describe('containsReference', () => {
  it('should find reference when present', () => {
    const text = 'În dosarul nr. 1234/3/2024 s-a decis...';
    expect(containsReference(text, '1234/3/2024')).toBe(true);
  });

  it('should find reference with different formatting', () => {
    const text = 'Dosar 1234 / 3 / 2024';
    expect(containsReference(text, '1234/3/2024')).toBe(true);
  });

  it('should return false when reference not present', () => {
    const text = 'Un email fără referințe specifice.';
    expect(containsReference(text, '1234/3/2024')).toBe(false);
  });
});

describe('matchReferences', () => {
  it('should match extracted references against case references', () => {
    const extracted: ExtractedReference[] = [
      { type: 'court_file', value: 'dosar 1234/3/2024', normalized: '1234/3/2024', position: 0 },
      { type: 'court_file', value: 'dosar 5678/2/2023', normalized: '5678/2/2023', position: 50 },
    ];
    const caseRefs = ['1234/3/2024', '9999/1/2024'];

    const matches = matchReferences(extracted, caseRefs);

    expect(matches).toHaveLength(1);
    expect(matches[0].normalized).toBe('1234/3/2024');
  });

  it('should handle case references with different formatting', () => {
    const extracted: ExtractedReference[] = [
      { type: 'court_file', value: 'dosar 1234/3/2024', normalized: '1234/3/2024', position: 0 },
    ];
    const caseRefs = ['1234 / 3 / 2024']; // With spaces

    const matches = matchReferences(extracted, caseRefs);

    expect(matches).toHaveLength(1);
  });

  it('should return empty array when no matches', () => {
    const extracted: ExtractedReference[] = [
      { type: 'court_file', value: 'dosar 1234/3/2024', normalized: '1234/3/2024', position: 0 },
    ];
    const caseRefs = ['9999/1/2024'];

    const matches = matchReferences(extracted, caseRefs);

    expect(matches).toHaveLength(0);
  });
});

describe('getEmailDomain', () => {
  it('should extract domain from email address', () => {
    expect(getEmailDomain('user@example.com')).toBe('example.com');
  });

  it('should lowercase domain', () => {
    expect(getEmailDomain('User@EXAMPLE.COM')).toBe('example.com');
  });

  it('should return empty string for invalid email', () => {
    expect(getEmailDomain('not-an-email')).toBe('');
  });

  it('should handle subdomain', () => {
    expect(getEmailDomain('user@mail.example.com')).toBe('mail.example.com');
  });
});

describe('matchesDomain', () => {
  it('should match exact domain', () => {
    expect(matchesDomain('user@just.ro', ['just.ro'])).toBe(true);
  });

  it('should not match different domain', () => {
    expect(matchesDomain('user@gmail.com', ['just.ro'])).toBe(false);
  });

  it('should match with wildcard pattern', () => {
    expect(matchesDomain('user@tribunalul-bucuresti.ro', ['tribunalul-*.ro'])).toBe(true);
    expect(matchesDomain('user@tribunalul-cluj.ro', ['tribunalul-*.ro'])).toBe(true);
  });

  it('should match any of multiple domains', () => {
    expect(matchesDomain('user@example.com', ['just.ro', 'example.com'])).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(matchesDomain('User@JUST.RO', ['just.ro'])).toBe(true);
  });

  it('should return false for invalid email', () => {
    expect(matchesDomain('invalid', ['just.ro'])).toBe(false);
  });
});
