/**
 * Document Completeness Service Tests
 * Story 5.4: Proactive AI Suggestions System - Task 35
 *
 * Tests for document completeness checking and missing item detection.
 */

import {
  DocumentCompletenessService,
  type CompletenessCheckResult,
  type MissingItem,
  DOCUMENT_COMPLETENESS_RULES,
} from '../document-completeness.service';
import { providerManager } from '../provider-manager.service';
import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import { ClaudeModel } from '@legal-platform/types';

// Mock dependencies
jest.mock('../provider-manager.service');
jest.mock('@legal-platform/database', () => ({
  prisma: {
    document: { findUnique: jest.fn() },
    documentCompletenessCheck: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

describe('DocumentCompletenessService', () => {
  let service: DocumentCompletenessService;
  let mockRedis: jest.Mocked<Redis>;

  const sampleContractContent = `
    CONTRACT DE VÂNZARE-CUMPĂRARE

    PĂRȚILE CONTRACTANTE:
    1. SC Example SRL, cu sediul în București
    2. Ion Popescu, domiciliat în București

    OBIECTUL CONTRACTULUI:
    Vânzătorul vinde cumpărătorului imobilul situat în București.

    PREȚUL:
    Prețul total este de 100.000 EUR.

    DATA: 15 decembrie 2024

    SEMNĂTURI:
    _______________     _______________
    Vânzător            Cumpărător
  `;

  const incompleteContractContent = `
    CONTRACT DE VÂNZARE-CUMPĂRARE

    PĂRȚILE CONTRACTANTE:
    1. SC Example SRL

    OBIECTUL CONTRACTULUI:
    Vânzătorul vinde cumpărătorului imobilul.

    DATA: 15 decembrie 2024
  `;

  const sampleAIResponse = {
    content: JSON.stringify({
      completenessScore: 0.85,
      missingItems: [
        {
          item: 'Witnesse signatures',
          severity: 'recommended',
          section: 'SIGNATURES',
          suggestion: 'Consider adding witness signatures for additional legal protection.',
        },
      ],
      suggestions: [
        'Add notarization clause for stronger legal validity.',
        'Include dispute resolution mechanism.',
      ],
    }),
    model: ClaudeModel.Sonnet,
    inputTokens: 400,
    outputTokens: 200,
    latencyMs: 1500,
  };

  const incompleteAIResponse = {
    content: JSON.stringify({
      completenessScore: 0.45,
      missingItems: [
        {
          item: 'Second party details',
          severity: 'required',
          section: 'PARTIES',
          suggestion: 'Add complete details for the buyer party.',
        },
        {
          item: 'Price clause',
          severity: 'required',
          section: 'PRICE',
          suggestion: 'Add the contract price and payment terms.',
        },
        {
          item: 'Signatures',
          severity: 'required',
          section: 'SIGNATURES',
          suggestion: 'Both parties must sign the contract.',
        },
        {
          item: 'Witnesses',
          severity: 'recommended',
          section: 'SIGNATURES',
          suggestion: 'Consider adding witness signatures.',
        },
      ],
      suggestions: [
        'Add detailed property description.',
        'Include warranty clauses.',
        'Add force majeure provisions.',
      ],
    }),
    model: ClaudeModel.Sonnet,
    inputTokens: 300,
    outputTokens: 250,
    latencyMs: 1800,
  };

  beforeEach(() => {
    service = new DocumentCompletenessService();
    mockRedis = new Redis() as jest.Mocked<Redis>;

    jest.clearAllMocks();

    // Default mock implementations
    (mockRedis.get as jest.Mock).mockResolvedValue(null);
    (mockRedis.setex as jest.Mock).mockResolvedValue('OK');

    (prisma.documentCompletenessCheck.create as jest.Mock).mockResolvedValue({
      id: 'check-123',
      documentId: 'doc-123',
    });

    (providerManager.execute as jest.Mock).mockResolvedValue(sampleAIResponse);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('checkDocumentCompleteness', () => {
    it('should return completeness score for a document', async () => {
      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract',
        'Contract de vânzare'
      );

      expect(result.completenessScore).toBeDefined();
      expect(result.completenessScore).toBeGreaterThanOrEqual(0);
      expect(result.completenessScore).toBeLessThanOrEqual(1);
    });

    it('should identify missing required items', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue(incompleteAIResponse);

      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        incompleteContractContent,
        'Contract'
      );

      const requiredItems = result.missingItems.filter((i) => i.severity === 'required');
      expect(requiredItems.length).toBeGreaterThan(0);
    });

    it('should identify missing recommended items', async () => {
      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      const recommendedItems = result.missingItems.filter((i) => i.severity === 'recommended');
      expect(recommendedItems.length).toBeGreaterThan(0);
    });

    it('should provide suggestions for improvement', async () => {
      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should include section information for missing items', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue(incompleteAIResponse);

      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        incompleteContractContent,
        'Contract'
      );

      const itemWithSection = result.missingItems.find((i) => i.section);
      expect(itemWithSection).toBeDefined();
      expect(itemWithSection?.section).toBeTruthy();
    });

    it('should return cached result if available', async () => {
      const cachedResult: CompletenessCheckResult = {
        documentId: 'doc-123',
        documentType: 'Contract',
        completenessScore: 0.9,
        missingItems: [],
        suggestions: ['Cached suggestion'],
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(providerManager.execute).not.toHaveBeenCalled();
      expect(result.suggestions[0]).toBe('Cached suggestion');
    });

    it('should bypass cache when forceRefresh is true', async () => {
      const cachedResult: CompletenessCheckResult = {
        documentId: 'doc-123',
        documentType: 'Contract',
        completenessScore: 0.9,
        missingItems: [],
        suggestions: ['Cached'],
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedResult));

      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract',
        'Test Contract',
        true // forceRefresh
      );

      expect(providerManager.execute).toHaveBeenCalled();
    });

    it('should return low score for empty or very short content', async () => {
      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        'Short content', // Less than 50 chars
        'Contract'
      );

      expect(result.completenessScore).toBe(0);
      expect(result.missingItems[0].item).toBe('Document content');
    });

    it('should handle different document types', async () => {
      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Motion'
      );

      expect(providerManager.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Motion'),
        })
      );
    });

    it('should store completeness check in database', async () => {
      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(prisma.documentCompletenessCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId: 'doc-123',
            firmId: 'firm-456',
            documentType: 'Contract',
            completenessScore: expect.any(Number),
          }),
        })
      );
    });

    it('should handle AI API errors gracefully', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      // Should return a result with low score on error
      expect(result.completenessScore).toBe(0);
    });

    it('should handle invalid JSON response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: 'Invalid JSON',
      });

      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(result.completenessScore).toBe(0);
    });

    it('should truncate very long documents', async () => {
      const longContent = 'A'.repeat(20000); // Exceeds MAX_CONTENT_LENGTH

      await service.checkDocumentCompleteness('doc-123', 'firm-456', longContent, 'Contract');

      // Verify the prompt sent to AI is truncated
      expect(providerManager.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.not.stringContaining('A'.repeat(20000)),
        })
      );
    });
  });

  describe('document type mapping', () => {
    it('should map Contract type correctly', async () => {
      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(providerManager.execute).toHaveBeenCalled();
    });

    it('should map VanzareCumparare to Contract rules', async () => {
      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'VanzareCumparare'
      );

      expect(providerManager.execute).toHaveBeenCalled();
    });

    it('should map Motion type correctly', async () => {
      const motionContent = `
        TRIBUNALUL BUCUREȘTI
        SECȚIA I CIVILĂ

        DOSAR NR. 1234/3/2024

        CERERE DE CHEMARE ÎN JUDECATĂ

        Subsemnatul, Ion Popescu...
      `;

      await service.checkDocumentCompleteness('doc-123', 'firm-456', motionContent, 'Motion');

      expect(providerManager.execute).toHaveBeenCalled();
    });

    it('should use Contract rules as default for unknown types', async () => {
      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'UnknownType'
      );

      expect(providerManager.execute).toHaveBeenCalled();
    });
  });

  describe('DOCUMENT_COMPLETENESS_RULES', () => {
    it('should have Contract rules defined', () => {
      expect(DOCUMENT_COMPLETENESS_RULES.Contract).toBeDefined();
      expect(DOCUMENT_COMPLETENESS_RULES.Contract.required).toContain('parties');
      expect(DOCUMENT_COMPLETENESS_RULES.Contract.required).toContain('signatures');
    });

    it('should have Motion rules defined', () => {
      expect(DOCUMENT_COMPLETENESS_RULES.Motion).toBeDefined();
      expect(DOCUMENT_COMPLETENESS_RULES.Motion.required).toContain('caption');
      expect(DOCUMENT_COMPLETENESS_RULES.Motion.required).toContain('certificateOfService');
    });

    it('should have Pleading rules defined', () => {
      expect(DOCUMENT_COMPLETENESS_RULES.Pleading).toBeDefined();
      expect(DOCUMENT_COMPLETENESS_RULES.Pleading.required).toContain('allegations');
    });

    it('should have Letter rules defined', () => {
      expect(DOCUMENT_COMPLETENESS_RULES.Letter).toBeDefined();
      expect(DOCUMENT_COMPLETENESS_RULES.Letter.required).toContain('salutation');
    });
  });

  describe('severity scoring', () => {
    it('should weight required items higher in score calculation', async () => {
      const manyRequiredMissing = {
        content: JSON.stringify({
          completenessScore: 0.3,
          missingItems: [
            { item: 'Parties', severity: 'required', suggestion: 'Add parties' },
            { item: 'Price', severity: 'required', suggestion: 'Add price' },
            { item: 'Signatures', severity: 'required', suggestion: 'Add signatures' },
          ],
          suggestions: [],
        }),
      };
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        ...manyRequiredMissing,
      });

      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        incompleteContractContent,
        'Contract'
      );

      // Score should be low with many required items missing
      expect(result.completenessScore).toBeLessThan(0.5);
    });

    it('should have higher score with only recommended items missing', async () => {
      const onlyRecommendedMissing = {
        content: JSON.stringify({
          completenessScore: 0.85,
          missingItems: [
            { item: 'Witnesses', severity: 'recommended', suggestion: 'Add witnesses' },
            { item: 'Notarization', severity: 'recommended', suggestion: 'Add notarization' },
          ],
          suggestions: [],
        }),
      };
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        ...onlyRecommendedMissing,
      });

      const result = await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(result.completenessScore).toBeGreaterThan(0.7);
    });
  });

  describe('caching', () => {
    it('should cache results for 1 hour', async () => {
      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('doc-123'),
        3600, // 1 hour
        expect.any(String)
      );
    });

    it('should use document ID in cache key', async () => {
      await service.checkDocumentCompleteness(
        'doc-123',
        'firm-456',
        sampleContractContent,
        'Contract'
      );

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('doc-123'),
        expect.any(Number),
        expect.any(String)
      );
    });
  });
});
