/**
 * Document Review AI Service Tests
 * Story 3.6: Document Review and Approval Workflow
 */

import { documentReviewAIService, DocumentReviewAIService } from './document-review-ai.service';
import { providerManager } from './provider-manager.service';
import { tokenTracker } from './token-tracker.service';
import type { DocumentContext } from '@legal-platform/types';

// Mock dependencies
jest.mock('./provider-manager.service', () => ({
  providerManager: {
    execute: jest.fn(),
  },
}));

jest.mock('./token-tracker.service', () => ({
  tokenTracker: {
    recordUsage: jest.fn(),
  },
}));

describe('DocumentReviewAIService', () => {
  const mockContext: DocumentContext = {
    documentType: 'Contract',
    language: 'en',
    firmId: 'firm-123',
    caseType: 'Commercial',
  };

  const mockDocumentContent = `
    COMMERCIAL SERVICES AGREEMENT

    Article 1. DEFINITIONS

    1.1 "Services" means the consulting services to be provided as appropriate.

    Article 2. OBLIGATIONS

    2.1 The Provider shall deliver services in a reasonable timeframe.
    2.2 Payment terms shall be determined as the case may be.

    Article 3. TERMINATION

    3.1 Either party may terminate with etc.
  `;

  const mockAIResponse = {
    content: JSON.stringify({
      concerns: [
        {
          concernType: 'AMBIGUOUS_LANGUAGE',
          severity: 'WARNING',
          description: 'The term "as appropriate" is vague and may lead to disputes',
          anchorText: 'as appropriate',
          suggestedFix: 'Replace with specific criteria',
          confidence: 0.85,
        },
        {
          concernType: 'AMBIGUOUS_LANGUAGE',
          severity: 'WARNING',
          description: 'The term "reasonable timeframe" lacks specificity',
          anchorText: 'reasonable timeframe',
          suggestedFix: 'Specify exact delivery deadlines',
          confidence: 0.82,
        },
        {
          concernType: 'AMBIGUOUS_LANGUAGE',
          severity: 'INFO',
          description: 'The abbreviation "etc." is informal for legal documents',
          anchorText: 'etc.',
          suggestedFix: 'Remove or list specific items',
          confidence: 0.75,
        },
      ],
    }),
    model: 'claude-3-5-sonnet',
    inputTokens: 500,
    outputTokens: 200,
    latencyMs: 1500,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (providerManager.execute as jest.Mock).mockResolvedValue(mockAIResponse);
    (tokenTracker.recordUsage as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('analyzeDocumentForConcerns', () => {
    it('should analyze document and return concerns', async () => {
      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.concerns).toBeInstanceOf(Array);
      expect(result.concerns.length).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should call AI provider with correct parameters', async () => {
      await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      expect(providerManager.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          maxTokens: expect.any(Number),
          temperature: 0.2,
        })
      );
    });

    it('should track token usage', async () => {
      await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      expect(tokenTracker.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          firmId: mockContext.firmId,
          operationType: expect.any(String),
          inputTokens: mockAIResponse.inputTokens,
          outputTokens: mockAIResponse.outputTokens,
        })
      );
    });

    it('should filter out low confidence concerns', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: JSON.stringify({
          concerns: [
            {
              concernType: 'AMBIGUOUS_LANGUAGE',
              severity: 'INFO',
              description: 'Low confidence concern',
              anchorText: 'some text',
              confidence: 0.4, // Below threshold
            },
            {
              concernType: 'HIGH_RISK_CLAUSE',
              severity: 'ERROR',
              description: 'High confidence concern',
              anchorText: 'other text',
              confidence: 0.9, // Above threshold
            },
          ],
        }),
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      // Only high confidence concerns should be included
      expect(result.concerns.length).toBe(1);
      expect(result.concerns[0].confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should handle Romanian language documents', async () => {
      const roContext: DocumentContext = {
        ...mockContext,
        language: 'ro',
      };

      await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        roContext
      );

      const call = (providerManager.execute as jest.Mock).mock.calls[0][0];
      expect(call.prompt).toContain('limba română');
    });

    it('should fall back to rule-based detection on AI failure', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      // Should still return results from rule-based detection
      expect(result).toBeDefined();
      expect(result.modelUsed).toBe('rule-based');
    });

    it('should handle empty AI response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: JSON.stringify({ concerns: [] }),
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      expect(result.concerns).toEqual([]);
    });

    it('should handle malformed AI response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: 'not valid json',
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      // Should return empty concerns array on parse failure
      expect(result.concerns).toEqual([]);
    });

    it('should truncate long documents', async () => {
      const longContent = 'A'.repeat(20000);

      await documentReviewAIService.analyzeDocumentForConcerns(
        longContent,
        'Contract',
        mockContext
      );

      const call = (providerManager.execute as jest.Mock).mock.calls[0][0];
      expect(call.prompt).toContain('[...content truncated...]');
    });

    it('should calculate anchor positions correctly', async () => {
      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        mockDocumentContent,
        'Contract',
        mockContext
      );

      for (const concern of result.concerns) {
        if (concern.anchorText && concern.anchorStart > 0) {
          // Verify the anchor text exists at the calculated position
          const foundText = mockDocumentContent.substring(
            concern.anchorStart,
            concern.anchorEnd
          );
          expect(foundText.toLowerCase()).toContain(
            concern.anchorText.toLowerCase().substring(0, 10)
          );
        }
      }
    });
  });

  describe('parseDocumentSections', () => {
    it('should parse document into sections', async () => {
      const sections = await documentReviewAIService.parseDocumentSections(
        mockDocumentContent
      );

      expect(sections).toBeInstanceOf(Array);
      expect(sections.length).toBeGreaterThan(0);
    });

    it('should identify article headers', async () => {
      const documentWithArticles = `
ARTICOLUL 1. DEFINIȚII

1.1 "Servicii" înseamnă serviciile de consultanță.

ARTICOLUL 2. OBLIGAȚII

2.1 Prestatorul va furniza servicii.
`;
      const sections = await documentReviewAIService.parseDocumentSections(
        documentWithArticles
      );

      const articleSections = sections.filter((s) =>
        s.title.toLowerCase().includes('articol')
      );
      expect(articleSections.length).toBeGreaterThan(0);
    });

    it('should track section positions', async () => {
      const sections = await documentReviewAIService.parseDocumentSections(
        mockDocumentContent
      );

      for (const section of sections) {
        expect(section.startIndex).toBeGreaterThanOrEqual(0);
        expect(section.endIndex).toBeGreaterThan(section.startIndex);
      }
    });
  });

  describe('Rule-based detection', () => {
    it('should detect ambiguous language patterns', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(
        new Error('Force rule-based')
      );

      const contentWithAmbiguity = 'Payment shall be reasonable and/or as appropriate.';

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        contentWithAmbiguity,
        'Contract',
        mockContext
      );

      const ambiguousConcerns = result.concerns.filter(
        (c) => c.concernType === 'AMBIGUOUS_LANGUAGE'
      );
      expect(ambiguousConcerns.length).toBeGreaterThan(0);
    });

    it('should check for missing clauses in contracts', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(
        new Error('Force rule-based')
      );

      const contractWithoutStandardClauses = 'Simple agreement with no standard clauses.';

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        contractWithoutStandardClauses,
        'Contract',
        mockContext
      );

      const missingClauses = result.concerns.filter(
        (c) => c.concernType === 'MISSING_CLAUSE'
      );
      expect(missingClauses.length).toBeGreaterThan(0);
    });

    it('should detect outdated Romanian law references', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(
        new Error('Force rule-based')
      );

      const contentWithOldLaw = 'În conformitate cu Legea nr. 31/1990 privind societățile comerciale.';

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        contentWithOldLaw,
        'Contract',
        { ...mockContext, language: 'ro' }
      );

      const outdatedRefs = result.concerns.filter(
        (c) => c.concernType === 'OUTDATED_REFERENCE'
      );
      expect(outdatedRefs.length).toBeGreaterThan(0);
    });

    it('should handle Romanian missing clauses', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(
        new Error('Force rule-based')
      );

      const roContract = 'Contract simplu fără clauze standard.';

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        roContract,
        'Contract',
        { ...mockContext, language: 'ro' }
      );

      const missingClauses = result.concerns.filter(
        (c) => c.concernType === 'MISSING_CLAUSE'
      );
      expect(missingClauses.length).toBeGreaterThan(0);
    });
  });

  describe('Concern types coverage', () => {
    const concernTypes = [
      'LEGAL_INCONSISTENCY',
      'AMBIGUOUS_LANGUAGE',
      'MISSING_CLAUSE',
      'OUTDATED_REFERENCE',
      'COMPLIANCE_ISSUE',
      'STYLE_VIOLATION',
      'HIGH_RISK_CLAUSE',
    ];

    it('should support all defined concern types', async () => {
      for (const concernType of concernTypes) {
        (providerManager.execute as jest.Mock).mockResolvedValue({
          ...mockAIResponse,
          content: JSON.stringify({
            concerns: [
              {
                concernType,
                severity: 'WARNING',
                description: `Test ${concernType}`,
                anchorText: 'test text',
                confidence: 0.8,
              },
            ],
          }),
        });

        const result = await documentReviewAIService.analyzeDocumentForConcerns(
          'Test content',
          'Contract',
          mockContext
        );

        expect(result.concerns[0].concernType).toBe(concernType);
      }
    });
  });

  describe('Severity levels', () => {
    it('should support ERROR severity', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: JSON.stringify({
          concerns: [
            {
              concernType: 'HIGH_RISK_CLAUSE',
              severity: 'ERROR',
              description: 'Critical issue',
              anchorText: 'text',
              confidence: 0.9,
            },
          ],
        }),
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        'Test',
        'Contract',
        mockContext
      );

      expect(result.concerns[0].severity).toBe('ERROR');
    });

    it('should support WARNING severity', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: JSON.stringify({
          concerns: [
            {
              concernType: 'AMBIGUOUS_LANGUAGE',
              severity: 'WARNING',
              description: 'Important issue',
              anchorText: 'text',
              confidence: 0.8,
            },
          ],
        }),
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        'Test',
        'Contract',
        mockContext
      );

      expect(result.concerns[0].severity).toBe('WARNING');
    });

    it('should support INFO severity', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: JSON.stringify({
          concerns: [
            {
              concernType: 'STYLE_VIOLATION',
              severity: 'INFO',
              description: 'Minor suggestion',
              anchorText: 'text',
              confidence: 0.7,
            },
          ],
        }),
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        'Test',
        'Contract',
        mockContext
      );

      expect(result.concerns[0].severity).toBe('INFO');
    });
  });

  describe('JSON extraction from AI response', () => {
    it('should handle JSON wrapped in markdown code blocks', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: '```json\n{"concerns": []}\n```',
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        'Test',
        'Contract',
        mockContext
      );

      expect(result.concerns).toEqual([]);
    });

    it('should handle raw JSON response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: '{"concerns": []}',
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        'Test',
        'Contract',
        mockContext
      );

      expect(result.concerns).toEqual([]);
    });

    it('should extract JSON from mixed text response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...mockAIResponse,
        content: 'Here is my analysis: {"concerns": []} That concludes my review.',
      });

      const result = await documentReviewAIService.analyzeDocumentForConcerns(
        'Test',
        'Contract',
        mockContext
      );

      expect(result.concerns).toEqual([]);
    });
  });
});

describe('Section path extraction', () => {
  it('should extract section path from position', async () => {
    const content = `
      ARTICLE 1. DEFINITIONS
      Some content here

      ARTICLE 2. OBLIGATIONS
      More content here with the target text
    `;

    const sections = await documentReviewAIService.parseDocumentSections(content);

    // Find section containing "target text"
    const targetPosition = content.indexOf('target text');
    const containingSection = sections.find(
      (s) => s.startIndex <= targetPosition && s.endIndex >= targetPosition
    );

    expect(containingSection).toBeDefined();
  });
});
