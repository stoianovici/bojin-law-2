/**
 * Word AI Validation Service Tests
 * Phase 1.4: Post-Generation Validation
 */

import { validateCourtFiling, validateCourtFilingWithMetadata } from './word-ai-validation.service';
import type { CourtFilingTemplateMetadata } from '@legal-platform/types';

// ============================================================================
// validateCourtFiling Tests
// ============================================================================

describe('validateCourtFiling', () => {
  describe('basic validation', () => {
    it('should return valid when all required sections are found', () => {
      const content = `
        CERERE DE CHEMARE ÎN JUDECATĂ

        Către Judecătoria Sector 1 București
        Dosar nr. 1234/2024

        Reclamant: Ion Popescu
        Pârât: Maria Ionescu

        OBIECTUL CERERII
        Prezenta cerere are ca obiect obligarea pârâtului la plata sumei de 50.000 lei.

        SITUAȚIA DE FAPT
        În fapt, arăt următoarele...

        TEMEIUL DE DREPT
        În drept, invocăm dispozițiile art. 194 C.proc.civ.
      `;

      const result = validateCourtFiling(content, [
        'Identificare Reclamant',
        'Identificare Parat',
        'Obiect',
        'Situatia de fapt',
        'Temeiul de drept',
      ]);

      expect(result.valid).toBe(true);
      expect(result.missingSections).toHaveLength(0);
      expect(result.foundSections).toContain('Identificare Reclamant');
      expect(result.foundSections).toContain('Situatia de fapt');
    });

    it('should return invalid when required sections are missing', () => {
      const content = `
        CERERE

        Reclamant: Ion Popescu

        Prezenta cerere are ca obiect...
      `;

      const result = validateCourtFiling(content, [
        'Identificare Reclamant',
        'Identificare Parat',
        'Situatia de fapt',
        'Temeiul de drept',
      ]);

      expect(result.valid).toBe(false);
      expect(result.missingSections).toContain('Identificare Parat');
      expect(result.missingSections).toContain('Situatia de fapt');
      expect(result.missingSections).toContain('Temeiul de drept');
    });

    it('should find sections using pattern matching', () => {
      const content = `
        Subsemnatul, în calitate de reclamant, formulez...
        În contradictoriu cu pârâtul...
        Solicitam instanței...
        Motivele de fapt sunt următoarele...
        Baza legală a cererii...
      `;

      const result = validateCourtFiling(content, [
        'Identificare Reclamant',
        'Identificare Parat',
        'Solicitare',
        'Situatia de fapt',
        'Temeiul de drept',
      ]);

      expect(result.foundSections).toContain('Identificare Reclamant');
      expect(result.foundSections).toContain('Identificare Parat');
      expect(result.foundSections).toContain('Solicitare');
    });
  });

  describe('fuzzy matching with diacritics', () => {
    it('should match sections using alternative patterns', () => {
      const content = `
        Motivele de fapt sunt următoarele...
        Baza legală a cererii o constituie art. 194 C.proc.civ.
      `;

      const result = validateCourtFiling(content, ['Situatia de fapt', 'Temeiul de drept']);

      expect(result.valid).toBe(true);
    });

    it('should match sections with diacritics', () => {
      const content = `
        Situația de fapt este următoarea...
        În drept, invocăm dispozițiile art. 194 C.proc.civ.
      `;

      const result = validateCourtFiling(content, ['Situatia de fapt', 'Temeiul de drept']);

      expect(result.valid).toBe(true);
    });
  });

  describe('fallback to direct text matching', () => {
    it('should use direct text matching for sections without predefined patterns', () => {
      const content = `
        Sectiunea Speciala Custom
        Acest document conține o secțiune specială care nu are pattern predefinit.
      `;

      const result = validateCourtFiling(content, ['Sectiunea Speciala Custom']);

      // Direct text matching should find the section (without diacritics)
      expect(result.foundSections).toContain('Sectiunea Speciala Custom');
      // When section is found via direct text match, no warning is added (only on miss)
      expect(result.valid).toBe(true);
    });

    it('should add warning when section has no pattern and is not found', () => {
      const content = 'This content has nothing relevant.';

      const result = validateCourtFiling(content, ['Custom Undefined Section']);

      expect(result.missingSections).toContain('Custom Undefined Section');
      // Warning is added only when section is NOT found via direct text match
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('nu are pattern definit'))).toBe(true);
    });
  });

  describe('content safety', () => {
    it('should truncate overly long content', () => {
      // Create content larger than 100KB limit
      const longContent = 'Reclamant: Ion Popescu. '.repeat(10000);

      // Should not throw, should process truncated content
      const result = validateCourtFiling(longContent, ['Identificare Reclamant']);

      expect(result).toBeDefined();
      expect(result.foundSections).toContain('Identificare Reclamant');
    });

    it('should truncate too many required sections', () => {
      const content = 'Test content';
      const manySections = Array(60)
        .fill(null)
        .map((_, i) => `Section ${i}`);

      // Should not throw, should process with truncated sections list
      const result = validateCourtFiling(content, manySections);

      expect(result).toBeDefined();
      // First 50 sections should be processed
      expect(result.missingSections.length + result.foundSections.length).toBeLessThanOrEqual(50);
    });

    it('should filter out overly long section names', () => {
      const content = 'Test content';
      const sections = ['Normal Section', 'x'.repeat(150)]; // Second one too long

      const result = validateCourtFiling(content, sections);

      // Only the first section should be processed
      expect(result.missingSections.length + result.foundSections.length).toBe(1);
    });
  });

  describe('appeal-specific sections', () => {
    it('should detect appeal sections', () => {
      const content = `
        APEL

        Hotărârea atacată este Sentința civilă nr. 123/2024 pronunțată de
        Judecătoria Sector 1 București.

        Motivele de nelegalitate sunt următoarele...

        Dezvoltăm motivele de apel în continuare...
      `;

      const result = validateCourtFiling(content, [
        'Hotararea atacata',
        'Motivele de nelegalitate',
        'Dezvoltarea motivelor',
      ]);

      expect(result.foundSections).toContain('Hotararea atacata');
      expect(result.foundSections).toContain('Motivele de nelegalitate');
      expect(result.foundSections).toContain('Dezvoltarea motivelor');
    });
  });

  describe('execution-specific sections', () => {
    it('should detect execution sections', () => {
      const content = `
        CERERE DE EXECUTARE SILITĂ

        Titlul executoriu este Sentința civilă nr. 456/2024

        Suma datorată este de 100.000 lei

        Solicitam modalitatea de executare prin poprire.
      `;

      const result = validateCourtFiling(content, [
        'Titlul executoriu',
        'Suma datorata',
        'Modalitatea de executare',
      ]);

      expect(result.foundSections).toContain('Titlul executoriu');
      expect(result.foundSections).toContain('Suma datorata');
      expect(result.foundSections).toContain('Modalitatea de executare');
    });
  });
});

// ============================================================================
// validateCourtFilingWithMetadata Tests
// ============================================================================

describe('validateCourtFilingWithMetadata', () => {
  const baseMetadata: CourtFilingTemplateMetadata = {
    name: 'Cerere de chemare în judecată',
    cpcArticles: ['Art. 194', 'Art. 195'],
    partyLabels: { party1: 'Reclamant', party2: 'Pârât' },
    requiredSections: ['Obiect', 'Situatia de fapt'],
    formCategory: 'A',
  };

  it('should include base validation results', () => {
    const content = `
      Obiectul cererii este...
      Situația de fapt...
      Reclamant: Ion Popescu
      Pârât: Maria Ionescu
    `;

    const result = validateCourtFilingWithMetadata(content, baseMetadata);

    expect(result.valid).toBe(true);
    expect(result.foundSections).toContain('Obiect');
    expect(result.foundSections).toContain('Situatia de fapt');
  });

  describe('form category warnings', () => {
    it('should warn when complex form A has many missing sections', () => {
      const content = 'Obiectul cererii este...';
      const metadata: CourtFilingTemplateMetadata = {
        ...baseMetadata,
        formCategory: 'A',
        requiredSections: ['Obiect', 'Situatia de fapt', 'Temeiul de drept', 'Dovezi', 'Anexe'],
      };

      const result = validateCourtFilingWithMetadata(content, metadata);

      expect(result.valid).toBe(false);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('Cererea de tip A'))).toBe(true);
    });

    it('should not add form category warning for simple forms', () => {
      const content = 'Simple content';
      const metadata: CourtFilingTemplateMetadata = {
        ...baseMetadata,
        formCategory: 'C', // Simple form
        requiredSections: ['Section1', 'Section2', 'Section3', 'Section4'],
      };

      const result = validateCourtFilingWithMetadata(content, metadata);

      // Should not have form category warning even with missing sections
      expect(result.warnings?.some((w) => w.includes('tip A'))).toBeFalsy();
    });
  });

  describe('CPC article warnings', () => {
    it('should warn when document lacks CPC article references', () => {
      const content = `
        Obiectul cererii...
        Situația de fapt...
        Reclamant: Ion
        Pârât: Maria
      `;

      const result = validateCourtFilingWithMetadata(content, baseMetadata);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('articolele CPC'))).toBe(true);
    });

    it('should not warn when CPC articles are referenced', () => {
      const content = `
        Conform Art. 194 C.proc.civ...
        Obiectul cererii...
        Situația de fapt...
        Reclamant: Ion
        Pârât: Maria
      `;

      const result = validateCourtFilingWithMetadata(content, baseMetadata);

      expect(result.warnings?.some((w) => w.includes('articolele CPC'))).toBeFalsy();
    });

    it('should handle empty CPC articles array', () => {
      const content = 'Test content with Reclamant and Pârât';
      const metadata: CourtFilingTemplateMetadata = {
        ...baseMetadata,
        cpcArticles: [],
      };

      const result = validateCourtFilingWithMetadata(content, metadata);

      // Should not throw and should not have CPC warning
      expect(result.warnings?.some((w) => w.includes('articolele CPC'))).toBeFalsy();
    });
  });

  describe('party label warnings', () => {
    it('should warn when party1 role is not mentioned', () => {
      const content = `
        Obiectul cererii...
        Pârât: Maria Ionescu
      `;

      const result = validateCourtFilingWithMetadata(content, baseMetadata);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('Reclamant'))).toBe(true);
    });

    it('should warn when party2 role is not mentioned', () => {
      const content = `
        Obiectul cererii...
        Reclamant: Ion Popescu
      `;

      const result = validateCourtFilingWithMetadata(content, baseMetadata);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes('Pârât'))).toBe(true);
    });

    it('should not warn when both parties are mentioned', () => {
      const content = `
        Reclamant: Ion Popescu
        Pârât: Maria Ionescu
        Art. 194 C.proc.civ.
        Obiectul cererii...
        Situația de fapt...
      `;

      const result = validateCourtFilingWithMetadata(content, baseMetadata);

      expect(
        result.warnings?.some((w) => w.includes('Reclamant') && w.includes('nu menționează'))
      ).toBeFalsy();
      expect(
        result.warnings?.some((w) => w.includes('Pârât') && w.includes('nu menționează'))
      ).toBeFalsy();
    });
  });

  describe('custom party labels', () => {
    it('should check for custom party labels', () => {
      const content = `
        Apelant: Ion Popescu
        Intimat: Maria Ionescu
        Obiectul cererii...
        Situația de fapt...
        Art. 194
      `;
      const metadata: CourtFilingTemplateMetadata = {
        ...baseMetadata,
        partyLabels: { party1: 'Apelant', party2: 'Intimat' },
      };

      const result = validateCourtFilingWithMetadata(content, metadata);

      expect(
        result.warnings?.some((w) => w.includes('Apelant') && w.includes('nu menționează'))
      ).toBeFalsy();
      expect(
        result.warnings?.some((w) => w.includes('Intimat') && w.includes('nu menționează'))
      ).toBeFalsy();
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty content', () => {
    const result = validateCourtFiling('', ['Obiect']);

    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('Obiect');
  });

  it('should handle empty required sections', () => {
    const result = validateCourtFiling('Some content', []);

    expect(result.valid).toBe(true);
    expect(result.missingSections).toHaveLength(0);
    expect(result.foundSections).toHaveLength(0);
  });

  it('should handle content with only whitespace', () => {
    const result = validateCourtFiling('   \n\t   ', ['Obiect']);

    expect(result.valid).toBe(false);
  });

  it('should be case-insensitive in pattern matching', () => {
    const content = 'RECLAMANT: ION POPESCU';
    const result = validateCourtFiling(content, ['Identificare Reclamant']);

    expect(result.foundSections).toContain('Identificare Reclamant');
  });
});
