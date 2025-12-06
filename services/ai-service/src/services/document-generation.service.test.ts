/**
 * Document Generation Service Tests
 * Story 3.3: Intelligent Document Drafting
 */

import { documentGenerationService } from './document-generation.service';
import { contextAggregatorService } from './context-aggregator.service';
import { precedentFinderService } from './precedent-finder.service';
import { tokenTracker } from './token-tracker.service';
import { cacheService } from './cache.service';
import type { DocumentGenerationInput, GeneratedDocument, DocumentContext } from '@legal-platform/types';

// Mock dependencies
jest.mock('./context-aggregator.service');
jest.mock('./precedent-finder.service');
jest.mock('./token-tracker.service');
jest.mock('./cache.service');
jest.mock('../lib/langchain/client', () => ({
  createClaudeModel: jest.fn().mockReturnValue({
    pipe: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        invoke: jest.fn().mockResolvedValue('Generated document content'),
      }),
    }),
  }),
  AICallbackHandler: jest.fn().mockImplementation(() => ({
    getMetrics: () => ({ inputTokens: 100, outputTokens: 500 }),
  })),
}));

describe('DocumentGenerationService', () => {
  const mockInput: DocumentGenerationInput = {
    caseId: '123e4567-e89b-12d3-a456-426614174000',
    prompt: 'Generate a service contract for consulting services',
    documentType: 'Contract',
    userId: '123e4567-e89b-12d3-a456-426614174001',
    firmId: '123e4567-e89b-12d3-a456-426614174002',
    includeContext: true,
  };

  const mockContext: DocumentContext = {
    caseId: mockInput.caseId,
    case: {
      id: mockInput.caseId,
      caseNumber: 'C-2024-001',
      title: 'Contract Case',
      type: 'Contract',
      status: 'Active',
      description: 'Commercial contract dispute',
      openedDate: new Date(),
    },
    client: {
      id: 'client-1',
      name: 'Test Client SRL',
      contactInfo: {},
      address: 'Bucharest, Romania',
    },
    teamMembers: [
      { id: 'user-1', name: 'John Doe', email: 'john@example.com', role: 'Partner' },
    ],
    relatedDocuments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    (cacheService.set as jest.Mock).mockResolvedValue(undefined);
    (contextAggregatorService.aggregateCaseContext as jest.Mock).mockResolvedValue(mockContext);
    (precedentFinderService.findSimilarDocuments as jest.Mock).mockResolvedValue([
      {
        documentId: 'doc-1',
        title: 'Similar Contract',
        similarity: 0.85,
        relevantSections: ['Section 1'],
        category: 'Contract',
      },
    ]);
    (tokenTracker.recordUsage as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateDocument', () => {
    it('should generate a document successfully', async () => {
      const result = await documentGenerationService.generateDocument(mockInput);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe('Generated document content');
      expect(result.tokensUsed).toBe(600); // 100 + 500
      expect(result.generationTimeMs).toBeGreaterThan(0);
    });

    it('should aggregate case context when includeContext is true', async () => {
      await documentGenerationService.generateDocument(mockInput);

      expect(contextAggregatorService.aggregateCaseContext).toHaveBeenCalledWith(
        mockInput.caseId,
        mockInput.firmId
      );
    });

    it('should not aggregate context when includeContext is false', async () => {
      const inputWithoutContext = { ...mockInput, includeContext: false };
      await documentGenerationService.generateDocument(inputWithoutContext);

      expect(contextAggregatorService.aggregateCaseContext).not.toHaveBeenCalled();
    });

    it('should find precedent documents', async () => {
      await documentGenerationService.generateDocument(mockInput);

      expect(precedentFinderService.findSimilarDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: mockInput.caseId,
          documentType: mockInput.documentType,
          query: mockInput.prompt,
          limit: 5,
          firmId: mockInput.firmId,
        })
      );
    });

    it('should track token usage', async () => {
      await documentGenerationService.generateDocument(mockInput);

      expect(tokenTracker.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockInput.userId,
          caseId: mockInput.caseId,
          firmId: mockInput.firmId,
          inputTokens: 100,
          outputTokens: 500,
        })
      );
    });

    it('should return cached response if available', async () => {
      const cachedResult: GeneratedDocument = {
        id: 'cached-id',
        title: 'Cached Document',
        content: 'Cached content',
        suggestedTitle: 'Cached Title',
        precedentsReferenced: [],
        tokensUsed: 100,
        generationTimeMs: 50,
      };

      (cacheService.get as jest.Mock).mockResolvedValue({
        response: JSON.stringify(cachedResult),
      });

      const result = await documentGenerationService.generateDocument(mockInput);

      expect(result).toEqual(cachedResult);
      expect(contextAggregatorService.aggregateCaseContext).not.toHaveBeenCalled();
    });

    it('should cache the generated result', async () => {
      await documentGenerationService.generateDocument(mockInput);

      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should generate suggested title based on document type and context', async () => {
      const result = await documentGenerationService.generateDocument(mockInput);

      expect(result.suggestedTitle).toBeDefined();
      expect(result.suggestedTitle).toContain('Contract');
    });
  });

  describe('validateInput', () => {
    it('should validate valid input', () => {
      const validation = documentGenerationService.validateInput(mockInput);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject missing caseId', () => {
      const invalidInput = { ...mockInput, caseId: '' };
      const validation = documentGenerationService.validateInput(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Case ID is required');
    });

    it('should reject missing prompt', () => {
      const invalidInput = { ...mockInput, prompt: '' };
      const validation = documentGenerationService.validateInput(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Prompt is required');
    });

    it('should reject prompt that is too short', () => {
      const invalidInput = { ...mockInput, prompt: 'Short' };
      const validation = documentGenerationService.validateInput(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Prompt must be at least 10 characters');
    });

    it('should reject prompt that is too long', () => {
      const invalidInput = { ...mockInput, prompt: 'a'.repeat(10001) };
      const validation = documentGenerationService.validateInput(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Prompt must be less than 10,000 characters');
    });

    it('should reject invalid document type', () => {
      const invalidInput = { ...mockInput, documentType: 'Invalid' as any };
      const validation = documentGenerationService.validateInput(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('Document type must be one of');
    });

    it('should reject missing userId', () => {
      const invalidInput = { ...mockInput, userId: '' };
      const validation = documentGenerationService.validateInput(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('User ID is required');
    });

    it('should reject missing firmId', () => {
      const invalidInput = { ...mockInput, firmId: '' };
      const validation = documentGenerationService.validateInput(invalidInput);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Firm ID is required');
    });
  });
});
