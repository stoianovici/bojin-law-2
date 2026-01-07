/**
 * Pattern Extraction Service Tests
 * Story 2.12.1 - AC4
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PatternExtractionService } from './pattern-extraction.service';

describe('PatternExtractionService', () => {
  let service: PatternExtractionService;

  beforeEach(() => {
    service = new PatternExtractionService();
  });

  describe('extractCommonPhrases', () => {
    it('should extract phrases with minimum 5 words', async () => {
      const documents = [
        {
          id: 'doc1',
          content:
            'Conform prevederilor Art. 1350 din Codul Civil, părțile au dreptul la reziliere.',
          typeId: 'type1',
        },
        {
          id: 'doc2',
          content: 'Conform prevederilor Art. 1350 din Codul Civil, obligațiile sunt clare.',
          typeId: 'type1',
        },
        {
          id: 'doc3',
          content: 'Conform prevederilor Art. 1350 din Codul Civil, drepturile sunt respectate.',
          typeId: 'type1',
        },
      ];

      const phrases = await service.extractCommonPhrases(documents);

      expect(phrases.length).toBeGreaterThan(0);
      phrases.forEach((phrase) => {
        expect(phrase.text.split(/\s+/).length).toBeGreaterThanOrEqual(5);
      });
    });

    it('should only include phrases from 3+ documents', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'Prin prezenta vă notificăm că aveți obligația de plată.',
          typeId: 'type1',
        },
        {
          id: 'doc2',
          content: 'Prin prezenta vă notificăm că aveți datorie restantă.',
          typeId: 'type1',
        },
        {
          id: 'doc3',
          content: 'Prin prezenta vă notificăm că trebuie să plătiți.',
          typeId: 'type1',
        },
      ];

      const phrases = await service.extractCommonPhrases(documents);

      phrases.forEach((phrase) => {
        expect(phrase.documents.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should calculate confidence scores', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'Solicităm achitarea sumei datorate conform contractului.',
          typeId: 'type1',
        },
        {
          id: 'doc2',
          content: 'Solicităm achitarea sumei datorate în termen legal.',
          typeId: 'type1',
        },
        {
          id: 'doc3',
          content: 'Solicităm achitarea sumei datorate și a dobânzii.',
          typeId: 'type1',
        },
      ];

      const phrases = await service.extractCommonPhrases(documents);

      phrases.forEach((phrase) => {
        expect(phrase.confidence).toBeGreaterThanOrEqual(0);
        expect(phrase.confidence).toBeLessThanOrEqual(100);
      });
    });

    it('should handle empty document set', async () => {
      const phrases = await service.extractCommonPhrases([]);
      expect(phrases).toEqual([]);
    });
  });

  describe('identifyClauseStructures', () => {
    it('should identify legal basis patterns', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'Potrivit prevederilor Art. 1350 din Codul Civil...',
          typeId: 'type1',
        },
        {
          id: 'doc2',
          content: 'Potrivit prevederilor articolului 1516 din Codul Civil...',
          typeId: 'type1',
        },
      ];

      const structures = await service.identifyClauseStructures(documents);

      const legalBasis = structures.find((s) => s.id === 'legal_basis');
      expect(legalBasis).toBeDefined();
      expect(legalBasis?.occurrences).toBeGreaterThan(0);
    });

    it('should identify request patterns', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'Solicităm achitarea sumei de 10,000 RON.',
          typeId: 'type1',
        },
        {
          id: 'doc2',
          content: 'Solicităm plata integrală a datoriei.',
          typeId: 'type1',
        },
      ];

      const structures = await service.identifyClauseStructures(documents);

      const request = structures.find((s) => s.id === 'request');
      expect(request).toBeDefined();
    });

    it('should identify deadline patterns', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'Plata trebuie efectuată în termen de 15 zile.',
          typeId: 'type1',
        },
        {
          id: 'doc2',
          content: 'Obligația se execută în termen de 30 zile.',
          typeId: 'type1',
        },
      ];

      const structures = await service.identifyClauseStructures(documents);

      const deadline = structures.find((s) => s.id === 'deadline');
      expect(deadline).toBeDefined();
    });
  });

  describe('buildClauseLibrary', () => {
    it('should create patterns from phrases and structures', async () => {
      const phrases = [
        {
          text: 'conform prevederilor legale în vigoare aplicabile',
          occurrences: 5,
          documents: ['doc1', 'doc2', 'doc3'],
          confidence: 85,
        },
      ];

      const structures = [
        {
          id: 'legal_basis',
          patternRo: 'Potrivit prevederilor Art. \\d+',
          patternEn: 'According to Article \\d+',
          category: 'legal_basis',
          occurrences: 3,
          documents: ['doc1', 'doc2'],
        },
      ];

      const patterns = await service.buildClauseLibrary(phrases, structures);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every((p) => p.pattern_text_ro)).toBe(true);
      expect(patterns.every((p) => p.pattern_text_en)).toBe(true);
    });

    it('should limit to top 50 phrases', async () => {
      const phrases = Array.from({ length: 100 }, (_, i) => ({
        text: `phrase number ${i} with at least five words here`,
        occurrences: 10 - i,
        documents: ['doc1', 'doc2', 'doc3'],
        confidence: 90 - i,
      }));

      const patterns = await service.buildClauseLibrary(phrases, []);

      expect(patterns.length).toBeLessThanOrEqual(50);
    });
  });

  describe('calculateTemplateQuality', () => {
    it('should calculate quality scores', async () => {
      const documents = [
        { id: 'doc1', content: 'Sample legal document content here.' },
        { id: 'doc2', content: 'Another sample legal document.' },
        { id: 'doc3', content: 'Third document with similar content.' },
      ];

      const patterns = [
        {
          id: '1',
          type_id: 'type1',
          pattern_type: 'common_phrase' as const,
          pattern_text_ro: 'sample phrase',
          pattern_text_en: 'sample phrase',
          occurrence_count: 3,
          occurrence_percentage: 100,
          min_word_count: 5,
          source_document_ids: ['doc1', 'doc2', 'doc3'],
          confidence_score: 0.9,
          extracted_at: new Date(),
          metadata: {},
        },
      ];

      const quality = await service.calculateTemplateQuality('type1', documents, patterns);

      expect(quality.typeId).toBe('type1');
      expect(quality.overallScore).toBeGreaterThanOrEqual(0);
      expect(quality.overallScore).toBeLessThanOrEqual(100);
      expect(quality.consistencyScore).toBeDefined();
      expect(quality.coverageScore).toBeDefined();
      expect(quality.clarityScore).toBeDefined();
      expect(['ready', 'needs_review', 'insufficient_data']).toContain(quality.recommendation);
    });

    it('should recommend ready for high quality', async () => {
      const documents = Array.from({ length: 10 }, (_, i) => ({
        id: `doc${i}`,
        content: 'Standard legal phrase appears in every document consistently.',
      }));

      const patterns = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        type_id: 'type1',
        pattern_type: 'common_phrase' as const,
        pattern_text_ro: `phrase ${i}`,
        pattern_text_en: `phrase ${i}`,
        occurrence_count: 10,
        occurrence_percentage: 100,
        min_word_count: 5,
        source_document_ids: documents.map((d) => d.id),
        confidence_score: 0.95,
        extracted_at: new Date(),
        metadata: {},
      }));

      const quality = await service.calculateTemplateQuality('type1', documents, patterns);

      expect(quality.overallScore).toBeGreaterThan(70);
    });
  });

  describe('generateTemplateStructure', () => {
    it('should generate template with sections', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'Antet: Company Name\nPărți: Ion Popescu\nPreambul: Subscrisa...',
        },
        {
          id: 'doc2',
          content: 'Antet: Other Company\nPărți: Maria Ionescu\nPreambul: Prin prezenta...',
        },
      ];

      const patterns = [
        {
          id: '1',
          type_id: 'type1',
          pattern_type: 'common_phrase' as const,
          pattern_text_ro: 'Subscrisa',
          pattern_text_en: 'The undersigned',
          occurrence_count: 2,
          occurrence_percentage: 100,
          min_word_count: 5,
          source_document_ids: ['doc1', 'doc2'],
          confidence_score: 0.9,
          extracted_at: new Date(),
          metadata: {},
        },
      ];

      const template = await service.generateTemplateStructure('Legal Notice', documents, patterns);

      expect(template.typeName).toBe('Legal Notice');
      expect(template.sections.length).toBeGreaterThan(0);
      expect(template.standardClauses).toBeDefined();
      expect(template.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('should extract variable placeholders', async () => {
      const documents = [
        {
          id: 'doc1',
          content: 'Către: Ion Popescu, Data: 19.11.2025, Suma: 10,000 RON',
        },
        {
          id: 'doc2',
          content: 'Către: Maria Ionescu, Data: 20.11.2025, Suma: 15,000 EUR',
        },
      ];

      const template = await service.generateTemplateStructure('Notice', documents, []);

      const hasVariables = template.sections.some((s) => s.variablePlaceholders.length > 0);
      expect(hasVariables).toBe(true);
    });
  });
});
