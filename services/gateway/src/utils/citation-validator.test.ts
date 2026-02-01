// Mock the logger to avoid import issues in tests
jest.mock('./logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  extractRefs,
  extractSources,
  validateCitations,
  areCitationsValid,
  detectSuspiciousPatterns,
  getCitationStats,
} from './citation-validator';

describe('citation-validator', () => {
  describe('extractRefs', () => {
    it('should extract ref IDs from HTML', () => {
      const html = `
        <p>Text with citation<ref id="src1"/>.</p>
        <p>Another citation<ref id="src2"/>.</p>
      `;
      const refs = extractRefs(html);
      expect(refs).toEqual(['src1', 'src2']);
    });

    it('should handle both quote styles', () => {
      const html = `
        <p>Citation<ref id="src1"/>.</p>
        <p>Citation<ref id='src2'/>.</p>
      `;
      const refs = extractRefs(html);
      expect(refs).toContain('src1');
      expect(refs).toContain('src2');
    });

    it('should deduplicate repeated refs', () => {
      const html = `
        <p>First mention<ref id="src1"/>.</p>
        <p>Second mention<ref id="src1"/>.</p>
      `;
      const refs = extractRefs(html);
      expect(refs).toEqual(['src1']);
    });

    it('should return empty array for no refs', () => {
      const html = '<p>Text without citations.</p>';
      const refs = extractRefs(html);
      expect(refs).toEqual([]);
    });
  });

  describe('extractSources', () => {
    it('should extract source definitions', () => {
      const html = `
        <sources>
          <source id="src1" type="legislation">Art. 535 Cod Civil</source>
          <source id="src2" type="doctrine" author="V. Stoica">Drept civil, 2017</source>
        </sources>
      `;
      const sources = extractSources(html);

      expect(sources).toHaveLength(2);
      expect(sources[0]).toEqual({
        id: 'src1',
        type: 'legislation',
        author: undefined,
        url: undefined,
        text: 'Art. 535 Cod Civil',
      });
      expect(sources[1].author).toBe('V. Stoica');
    });

    it('should handle sources with URLs', () => {
      const html = `
        <sources>
          <source id="src1" type="comparative" url="https://eur-lex.europa.eu">Directive 2019/770</source>
        </sources>
      `;
      const sources = extractSources(html);

      expect(sources[0].url).toBe('https://eur-lex.europa.eu');
    });

    it('should return empty array for no sources', () => {
      const html = '<article><p>No sources block.</p></article>';
      const sources = extractSources(html);
      expect(sources).toEqual([]);
    });
  });

  describe('validateCitations', () => {
    it('should return valid for matching refs and sources', () => {
      const html = `
        <article>
          <p>Citation<ref id="src1"/>.</p>
          <sources>
            <source id="src1" type="legislation">Art. 535 Cod Civil</source>
          </sources>
        </article>
      `;
      const result = validateCitations(html);

      expect(result.isValid).toBe(true);
      expect(result.orphanedRefs).toEqual([]);
      expect(result.totalRefs).toBe(1);
      expect(result.totalSources).toBe(1);
    });

    it('should detect orphaned refs', () => {
      const html = `
        <article>
          <p>Citation<ref id="src1"/>.</p>
          <p>Orphan<ref id="src2"/>.</p>
          <sources>
            <source id="src1" type="legislation">Art. 535 Cod Civil</source>
          </sources>
        </article>
      `;
      const result = validateCitations(html);

      expect(result.isValid).toBe(false);
      expect(result.orphanedRefs).toContain('src2');
      expect(result.warnings.some((w) => w.includes('src2'))).toBe(true);
    });

    it('should detect unused sources', () => {
      const html = `
        <article>
          <p>Citation<ref id="src1"/>.</p>
          <sources>
            <source id="src1" type="legislation">Art. 535 Cod Civil</source>
            <source id="src2" type="doctrine">Unused source</source>
          </sources>
        </article>
      `;
      const result = validateCitations(html);

      expect(result.unusedSources).toContain('src2');
      expect(result.warnings.some((w) => w.includes('nefolosite'))).toBe(true);
    });

    it('should detect suspicious patterns', () => {
      const html = `
        <article>
          <p>Citation<ref id="src1"/>.</p>
          <sources>
            <source id="src1" type="jurisprudence">ÎCCJ, Decizia nr. 5000/2020</source>
          </sources>
        </article>
      `;
      const result = validateCitations(html);

      expect(result.suspiciousSources.length).toBeGreaterThan(0);
      expect(result.suspiciousSources[0].reason).toContain('rotund');
    });
  });

  describe('detectSuspiciousPatterns', () => {
    it('should detect round decision numbers', () => {
      const patterns = detectSuspiciousPatterns('ÎCCJ, Decizia nr. 1000/2023');
      expect(patterns.some((p) => p.reason.includes('rotund'))).toBe(true);
    });

    it('should detect generic dates', () => {
      const patterns = detectSuspiciousPatterns('din 1 ianuarie 2020');
      expect(patterns.some((p) => p.reason.includes('generică'))).toBe(true);
    });

    it('should detect round page numbers', () => {
      const patterns = detectSuspiciousPatterns('Ed. Juridică, 2020, p. 100');
      expect(patterns.some((p) => p.reason.includes('pagină'))).toBe(true);
    });

    it('should return empty for normal citations', () => {
      const patterns = detectSuspiciousPatterns(
        'V. Stoica, Drept civil. Drepturile reale, Ed. C.H. Beck, 2017, p. 123'
      );
      expect(patterns.length).toBe(0);
    });
  });

  describe('areCitationsValid', () => {
    it('should return true for valid document', () => {
      const html = `
        <article>
          <p>Citation<ref id="src1"/>.</p>
          <sources>
            <source id="src1" type="legislation">Art. 535 Cod Civil</source>
          </sources>
        </article>
      `;
      expect(areCitationsValid(html)).toBe(true);
    });

    it('should return false for orphaned refs', () => {
      const html = `
        <article>
          <p>Citation<ref id="src1"/>.</p>
          <p>Orphan<ref id="missing"/>.</p>
          <sources>
            <source id="src1" type="legislation">Art. 535 Cod Civil</source>
          </sources>
        </article>
      `;
      expect(areCitationsValid(html)).toBe(false);
    });
  });

  describe('getCitationStats', () => {
    it('should calculate citation statistics', () => {
      const html = `
        <article>
          <p>Text with citation<ref id="src1"/> and another<ref id="src2"/>.</p>
          <p>More text with citation<ref id="src1"/>.</p>
          <sources>
            <source id="src1" type="legislation">Art. 535 Cod Civil</source>
            <source id="src2" type="doctrine" author="Stoica">Drept civil, 2017</source>
          </sources>
        </article>
      `;
      const stats = getCitationStats(html);

      expect(stats.totalRefs).toBe(2); // Deduplicated
      expect(stats.totalSources).toBe(2);
      expect(stats.typeBreakdown.legislation).toBe(1);
      expect(stats.typeBreakdown.doctrine).toBe(1);
      expect(stats.citationDensity).toBeGreaterThan(0);
    });

    it('should handle empty document', () => {
      const html = '<article></article>';
      const stats = getCitationStats(html);

      expect(stats.totalRefs).toBe(0);
      expect(stats.totalSources).toBe(0);
    });
  });
});
