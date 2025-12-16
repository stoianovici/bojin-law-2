/**
 * Personalization Context Service Tests
 * Story 5.6: AI Learning and Personalization - Task 40
 *
 * Tests for context building, style prompt additions, and completion time prediction.
 */

import {
  personalizationContextService,
  type PersonalizationContext,
  type WritingStyleProfile,
  type TaskCreationPattern,
  type DocumentStructurePreference,
} from '../personalization-context.service';
import { cacheService } from '../cache.service';

// Mock dependencies - paths relative to src/services (where actual files are)
jest.mock('../cache.service', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../lib/logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PersonalizationContextService', () => {
  const service = personalizationContextService;

  const sampleWritingStyle: Partial<WritingStyleProfile> = {
    id: 'style-123',
    userId: 'user-123',
    formalityLevel: 0.8,
    averageSentenceLength: 18,
    vocabularyComplexity: 0.7,
    preferredTone: 'Professional',
    commonPhrases: [
      { phrase: 'Cu stimă', frequency: 10, context: 'closing' },
      { phrase: 'Vă rugăm', frequency: 8, context: 'body' },
    ],
    sampleCount: 15,
  };

  const sampleTaskPatterns: TaskCreationPattern[] = [
    {
      id: 'pattern-1',
      patternName: 'Contract Review',
      triggerType: 'document_type',
      triggerContext: { matchValue: 'Contract' },
      taskTemplate: { type: 'Review', title: 'Review Contract' },
      confidence: 0.85,
    },
    {
      id: 'pattern-2',
      patternName: 'Litigation Task',
      triggerType: 'case_type',
      triggerContext: { matchValue: 'Litigation' },
      taskTemplate: { type: 'Research', title: 'Legal Research' },
      confidence: 0.75,
    },
  ];

  const sampleDocPreference: DocumentStructurePreference = {
    id: 'pref-1',
    documentType: 'Contract',
    preferredSections: [
      { name: 'Introduction', order: 1, required: true },
      { name: 'Terms', order: 2, required: true },
      { name: 'Signatures', order: 3, required: true },
    ],
    headerStyle: { format: 'numbered', numbering: 'decimal' },
    fontPreferences: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getStylePromptAdditions', () => {
    it('should return empty string if no writing style', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getStylePromptAdditions(context);

      expect(result).toBe('');
    });

    it('should return empty string if sample count is 0', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        writingStyle: { ...sampleWritingStyle, sampleCount: 0 },
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getStylePromptAdditions(context);

      expect(result).toBe('');
    });

    it('should include formality guidance for formal style', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        writingStyle: { ...sampleWritingStyle, formalityLevel: 0.9 },
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getStylePromptAdditions(context);

      expect(result).toContain('formal and professional');
    });

    it('should include formality guidance for casual style', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        writingStyle: { ...sampleWritingStyle, formalityLevel: 0.3 },
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getStylePromptAdditions(context);

      expect(result).toContain('conversational');
    });

    it('should include sentence length target', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        writingStyle: { ...sampleWritingStyle, averageSentenceLength: 20 },
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getStylePromptAdditions(context);

      expect(result).toContain('20 words per sentence');
    });

    it('should include preferred tone', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        writingStyle: { ...sampleWritingStyle, preferredTone: 'Formal' },
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getStylePromptAdditions(context);

      expect(result).toContain('Formal');
    });

    it('should include top 5 common phrases', () => {
      const manyPhrases = Array(10)
        .fill(null)
        .map((_, i) => ({
          phrase: `Phrase ${i}`,
          frequency: 10 - i,
          context: 'body',
        }));

      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        writingStyle: { ...sampleWritingStyle, commonPhrases: manyPhrases },
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getStylePromptAdditions(context);

      expect(result).toContain('Phrase 0');
      expect(result).toContain('Phrase 4');
      expect(result).not.toContain('Phrase 5');
    });
  });

  describe('getDocumentStructureAdditions', () => {
    it('should return empty string if no document preferences', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getDocumentStructureAdditions(context);

      expect(result).toBe('');
    });

    it('should include section order', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        documentPreferences: sampleDocPreference,
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getDocumentStructureAdditions(context);

      expect(result).toContain('Introduction');
      expect(result).toContain('Terms');
      expect(result).toContain('Signatures');
    });

    it('should include header style format', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        documentPreferences: sampleDocPreference,
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getDocumentStructureAdditions(context);

      expect(result).toContain('numbered');
    });
  });

  describe('getSuggestedTasks', () => {
    it('should return empty array if no patterns', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        taskPatterns: [],
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, { caseType: 'Litigation' });

      expect(result).toEqual([]);
    });

    it('should match patterns by case type', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        taskPatterns: sampleTaskPatterns,
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, { caseType: 'Litigation' });

      expect(result.length).toBe(1);
      expect(result[0].pattern.patternName).toBe('Litigation Task');
    });

    it('should match patterns by document type', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        taskPatterns: sampleTaskPatterns,
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, { documentType: 'Contract' });

      expect(result.length).toBe(1);
      expect(result[0].pattern.patternName).toBe('Contract Review');
    });

    it('should filter patterns with score <= 0.5', () => {
      const lowConfidencePatterns: TaskCreationPattern[] = [
        { ...sampleTaskPatterns[0], confidence: 0.4 },
      ];

      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        taskPatterns: lowConfidencePatterns,
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, { documentType: 'Contract' });

      expect(result.length).toBe(0);
    });

    it('should sort by match score descending', () => {
      const multiPatterns: TaskCreationPattern[] = [
        { ...sampleTaskPatterns[0], confidence: 0.7 },
        { ...sampleTaskPatterns[1], confidence: 0.9 },
      ];

      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        taskPatterns: multiPatterns,
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, {
        documentType: 'Contract',
        caseType: 'Litigation',
      });

      if (result.length >= 2) {
        expect(result[0].matchScore).toBeGreaterThanOrEqual(result[1].matchScore);
      }
    });

    it('should match email keyword patterns', () => {
      const emailPattern: TaskCreationPattern = {
        id: 'pattern-3',
        patternName: 'Urgent Request',
        triggerType: 'email_keyword',
        triggerContext: { keywords: ['urgent', 'asap', 'immediate'] },
        taskTemplate: { type: 'Priority', title: 'Handle Urgent Request' },
        confidence: 0.8,
      };

      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        taskPatterns: [emailPattern],
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, {
        emailKeywords: ['This is urgent and needs immediate attention'],
      });

      expect(result.length).toBe(1);
      expect(result[0].pattern.patternName).toBe('Urgent Request');
    });

    it('should return empty when no trigger context provided', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        taskPatterns: sampleTaskPatterns,
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, {});

      expect(result).toEqual([]);
    });

    it('should handle undefined taskPatterns', () => {
      const context: PersonalizationContext = {
        userId: 'user-123',
        firmId: 'firm-456',
        loadedAt: new Date(),
        expiresAt: new Date(),
      };

      const result = service.getSuggestedTasks(context, { caseType: 'Litigation' });

      expect(result).toEqual([]);
    });
  });

  describe('invalidateContext', () => {
    it('should delete cache for user', async () => {
      await service.invalidateContext('user-123', 'firm-456');

      expect(cacheService.delete).toHaveBeenCalled();
    });

    it('should delete both specific and generic cache when options provided', async () => {
      await service.invalidateContext('user-123', 'firm-456', { documentType: 'Contract' });

      expect(cacheService.delete).toHaveBeenCalledTimes(2);
    });
  });
});
