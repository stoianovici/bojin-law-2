/**
 * Model Router Service Unit Tests
 * Story 3.1: AI Service Infrastructure
 */

import { ModelRouterService } from './model-router.service';
import { TaskComplexity, ClaudeModel, AIOperationType } from '@legal-platform/types';

describe('ModelRouterService', () => {
  let router: ModelRouterService;

  beforeEach(() => {
    router = new ModelRouterService();
    // Clear environment overrides
    delete process.env.AI_MODEL_OVERRIDE;
    delete process.env.AI_MODEL_OVERRIDE_TEXT_GENERATION;
  });

  describe('classifyComplexity', () => {
    it('should return Simple for classification operations with short prompts', () => {
      const result = router.classifyComplexity({
        operationType: AIOperationType.Classification,
        promptLength: 500,
      });

      expect(result).toBe(TaskComplexity.Simple);
    });

    it('should return Simple for extraction operations with short prompts', () => {
      const result = router.classifyComplexity({
        operationType: AIOperationType.Extraction,
        promptLength: 800,
      });

      expect(result).toBe(TaskComplexity.Simple);
    });

    it('should return Standard for document summary operations', () => {
      const result = router.classifyComplexity({
        operationType: AIOperationType.DocumentSummary,
      });

      expect(result).toBe(TaskComplexity.Standard);
    });

    it('should return Complex for legal analysis operations', () => {
      const result = router.classifyComplexity({
        operationType: AIOperationType.LegalAnalysis,
      });

      expect(result).toBe(TaskComplexity.Complex);
    });

    it('should return Complex when requiresLegalReasoning is true', () => {
      const result = router.classifyComplexity({
        operationType: AIOperationType.TextGeneration,
        requiresLegalReasoning: true,
      });

      expect(result).toBe(TaskComplexity.Complex);
    });

    it('should return Complex when hasMultipleDocuments is true', () => {
      const result = router.classifyComplexity({
        operationType: AIOperationType.TextGeneration,
        hasMultipleDocuments: true,
      });

      expect(result).toBe(TaskComplexity.Complex);
    });

    it('should use explicit complexity when provided', () => {
      const result = router.classifyComplexity({
        operationType: AIOperationType.Classification,
        complexity: TaskComplexity.Complex,
      });

      expect(result).toBe(TaskComplexity.Complex);
    });
  });

  describe('selectModel', () => {
    it('should select Haiku for simple tasks', () => {
      const result = router.selectModel({
        operationType: AIOperationType.Classification,
        promptLength: 500,
      });

      expect(result.model).toBe(ClaudeModel.Haiku);
      expect(result.complexity).toBe(TaskComplexity.Simple);
    });

    it('should select Sonnet for standard tasks', () => {
      const result = router.selectModel({
        operationType: AIOperationType.DocumentSummary,
      });

      expect(result.model).toBe(ClaudeModel.Sonnet);
      expect(result.complexity).toBe(TaskComplexity.Standard);
    });

    it('should select Opus for complex tasks', () => {
      const result = router.selectModel({
        operationType: AIOperationType.LegalAnalysis,
      });

      expect(result.model).toBe(ClaudeModel.Opus);
      expect(result.complexity).toBe(TaskComplexity.Complex);
    });

    it('should use model override from request', () => {
      const result = router.selectModel({
        operationType: AIOperationType.Classification,
        promptLength: 500,
        modelOverride: ClaudeModel.Opus,
      });

      expect(result.model).toBe(ClaudeModel.Opus);
      expect(result.reason).toBe('Request model override');
    });

    it('should use global environment override', () => {
      process.env.AI_MODEL_OVERRIDE = 'haiku';

      const result = router.selectModel({
        operationType: AIOperationType.LegalAnalysis,
      });

      expect(result.model).toBe(ClaudeModel.Haiku);
      expect(result.reason).toBe('Environment variable override');
    });

    it('should provide routing reason', () => {
      const result = router.selectModel({
        operationType: AIOperationType.DocumentSummary,
      });

      expect(result.reason).toContain('Standard task');
    });
  });

  describe('getModelRateLimits', () => {
    it('should return Haiku rate limits', () => {
      const limits = router.getModelRateLimits(ClaudeModel.Haiku);

      expect(limits.requestsPerMin).toBe(1000);
      expect(limits.tokensPerMin).toBe(100000);
    });

    it('should return Sonnet rate limits', () => {
      const limits = router.getModelRateLimits(ClaudeModel.Sonnet);

      expect(limits.requestsPerMin).toBe(200);
      expect(limits.tokensPerMin).toBe(40000);
    });

    it('should return Opus rate limits', () => {
      const limits = router.getModelRateLimits(ClaudeModel.Opus);

      expect(limits.requestsPerMin).toBe(50);
      expect(limits.tokensPerMin).toBe(10000);
    });
  });
});
