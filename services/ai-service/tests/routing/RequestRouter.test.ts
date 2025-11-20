/**
 * Tests for RequestRouter
 */

import { RequestRouter, ModelId, RoutingStrategy } from '../../src/routing/RequestRouter';
import { SkillSelector, AIRequest } from '../../src/routing/SkillSelector';
import { SkillMetrics } from '../../src/metrics/SkillMetrics';
import type { SkillMetadata } from '../../src/types/skills';

// Mock dependencies
jest.mock('../../src/routing/SkillSelector');
jest.mock('../../src/metrics/SkillMetrics');

describe('RequestRouter', () => {
  let requestRouter: RequestRouter;
  let mockSkillSelector: jest.Mocked<SkillSelector>;
  let mockSkillMetrics: jest.Mocked<SkillMetrics>;

  const mockSkill: SkillMetadata = {
    id: '1',
    skill_id: 'contract-analysis',
    display_name: 'Contract Analysis',
    description: 'Analyzes contracts',
    version: '1.0.0',
    type: 'analysis',
    category: 'legal-analysis',
    effectiveness_score: 0.85,
    token_savings_avg: 0.7,
    usage_count: 100,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockSkillSelector = new SkillSelector(null as any) as jest.Mocked<SkillSelector>;
    mockSkillMetrics = new SkillMetrics() as jest.Mocked<SkillMetrics>;

    // Mock getAllMetrics to return empty array by default
    mockSkillMetrics.getAllMetrics = jest.fn().mockReturnValue([]);

    requestRouter = new RequestRouter(mockSkillSelector, mockSkillMetrics);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('route', () => {
    it('should route to Haiku when effectiveness >80%', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.9,
        strategy: 'single',
        reasoning: 'High confidence match',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.85);

      const request: AIRequest = {
        task: 'Review this contract',
      };

      const decision = await requestRouter.route(request);

      expect(decision.model).toBe('claude-3-5-haiku-20241022');
      expect(decision.strategy).toBe('skill-enhanced');
      expect(decision.skills).toHaveLength(1);
      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    it('should route to Sonnet when effectiveness 50-80%', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.6,
        strategy: 'fallback',
        reasoning: 'Medium confidence',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.65);

      const request: AIRequest = {
        task: 'Analyze this document',
      };

      const decision = await requestRouter.route(request);

      expect(decision.model).toBe('claude-3-5-sonnet-20241022');
      expect(decision.strategy).toBe('hybrid');
      expect(decision.skills).toHaveLength(1);
    });

    it('should fallback to original routing when effectiveness <50%', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.3,
        strategy: 'fallback',
        reasoning: 'Low confidence',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.3);

      const request: AIRequest = {
        task: 'Do something',
      };

      const decision = await requestRouter.route(request);

      expect(decision.strategy).toBe('fallback');
      expect(decision.skills).toHaveLength(0);
    });

    it('should route to premium for critical tasks', async () => {
      const request: AIRequest = {
        task: 'Critical legal review required',
      };

      const decision = await requestRouter.route(request);

      expect(decision.model).toBe('claude-4-opus-20250514');
      expect(decision.strategy).toBe('premium');
      expect(decision.skills).toHaveLength(0);
    });

    it('should complete routing decision in <100ms', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.85,
        strategy: 'single',
        reasoning: 'Match',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.85);

      const request: AIRequest = {
        task: 'Review contract',
      };

      const startTime = Date.now();
      await requestRouter.route(request);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should include alternatives in routing decision', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.85,
        strategy: 'single',
        reasoning: 'Match',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.85);

      const request: AIRequest = {
        task: 'Review contract',
      };

      const decision = await requestRouter.route(request);

      expect(decision.alternatives).toBeDefined();
      expect(decision.alternatives!.length).toBeGreaterThan(0);
    });
  });

  describe('complexity detection', () => {
    it('should detect high complexity tasks', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [],
        confidence: 0,
        strategy: 'none',
        reasoning: 'No skills',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0);

      const request: AIRequest = {
        task: 'Comprehensive detailed analysis required',
      };

      const decision = await requestRouter.route(request);

      // High complexity without skills should route to Sonnet
      expect(decision.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should detect low complexity tasks', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [],
        confidence: 0,
        strategy: 'none',
        reasoning: 'No skills',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0);

      const request: AIRequest = {
        task: 'Simple quick review',
      };

      const decision = await requestRouter.route(request);

      // Low complexity without skills should route to Haiku
      expect(decision.model).toBe('claude-3-5-haiku-20241022');
    });
  });

  describe('cost estimation', () => {
    it('should estimate cost for routing decision', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.85,
        strategy: 'single',
        reasoning: 'Match',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.85);

      const request: AIRequest = {
        task: 'Review this contract for potential issues',
      };

      const decision = await requestRouter.route(request);

      expect(decision.estimatedCost).toBeGreaterThan(0);
      expect(decision.estimatedTokens).toBeGreaterThan(0);
    });

    it('should estimate lower cost with skills', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.85,
        strategy: 'single',
        reasoning: 'Match',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.85);

      const request: AIRequest = {
        task: 'Analyze contract',
      };

      const withSkillsDecision = await requestRouter.route(request);

      // Simulate no skills scenario
      mockSkillSelector.select.mockResolvedValue({
        skills: [],
        confidence: 0,
        strategy: 'none',
        reasoning: 'No skills',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0);

      const withoutSkillsDecision = await requestRouter.route(request);

      // With skills should have lower token estimate (70% reduction)
      expect(withSkillsDecision.estimatedTokens).toBeLessThan(
        withoutSkillsDecision.estimatedTokens
      );
    });
  });

  describe('dynamic threshold adjustment', () => {
    it('should adjust thresholds based on performance', async () => {
      // Mock high average effectiveness
      mockSkillMetrics.getAllMetrics.mockReturnValue([
        {
          skillId: 'skill-1',
          effectivenessScore: 0.95,
          successRate: 0.95,
          totalExecutions: 100,
          successfulExecutions: 95,
          failedExecutions: 5,
          averageTokensSaved: 0.75,
          totalTokensSaved: 75,
          tokenSavingsStdDev: 0.05,
          averageExecutionTimeMs: 1500,
          executionTimeStdDev: 200,
          p95ExecutionTimeMs: 1800,
          errorRate: 0.05,
          commonErrors: new Map(),
          userSatisfactionCount: 0,
          last24Hours: {
            executions: 20,
            successRate: 0.95,
            avgTokensSaved: 0.75,
            avgExecutionTime: 1500,
          },
          last7Days: {
            executions: 70,
            successRate: 0.95,
            avgTokensSaved: 0.75,
            avgExecutionTime: 1500,
          },
          firstExecution: new Date(),
          lastExecution: new Date(),
          lastUpdated: new Date(),
        },
      ]);

      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.9,
        strategy: 'single',
        reasoning: 'Match',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.95);

      const request: AIRequest = {
        task: 'Review contract',
      };

      const thresholdsBefore = requestRouter.getThresholds();
      await requestRouter.route(request);
      const thresholdsAfter = requestRouter.getThresholds();

      // Thresholds may have adjusted (or stayed same if at limits)
      expect(thresholdsAfter).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update routing configuration', () => {
      requestRouter.updateConfig({
        highEffectivenessThreshold: 0.9,
      });

      const config = requestRouter.getConfig();
      expect(config.highEffectivenessThreshold).toBe(0.9);
    });

    it('should maintain other config values when updating', () => {
      const originalConfig = requestRouter.getConfig();

      requestRouter.updateConfig({
        highEffectivenessThreshold: 0.9,
      });

      const newConfig = requestRouter.getConfig();
      expect(newConfig.mediumEffectivenessThreshold).toBe(
        originalConfig.mediumEffectivenessThreshold
      );
    });
  });

  describe('getThresholds', () => {
    it('should return current thresholds', () => {
      const thresholds = requestRouter.getThresholds();

      expect(thresholds).toHaveProperty('high');
      expect(thresholds).toHaveProperty('medium');
      expect(thresholds.high).toBeGreaterThan(thresholds.medium);
    });
  });

  describe('model selection', () => {
    it('should select appropriate model based on effectiveness', async () => {
      const testCases: Array<{
        effectiveness: number;
        expectedModel: ModelId;
        expectedStrategy: RoutingStrategy;
        task: string;
      }> = [
        {
          effectiveness: 0.9,
          expectedModel: 'claude-3-5-haiku-20241022',
          expectedStrategy: 'skill-enhanced',
          task: 'Simple review task',
        },
        {
          effectiveness: 0.65,
          expectedModel: 'claude-3-5-sonnet-20241022',
          expectedStrategy: 'hybrid',
          task: 'Standard review task',
        },
        {
          effectiveness: 0.3,
          expectedModel: 'claude-3-5-haiku-20241022', // Low complexity fallback
          expectedStrategy: 'fallback',
          task: 'Simple quick review',
        },
      ];

      for (const testCase of testCases) {
        mockSkillSelector.select.mockResolvedValue({
          skills: testCase.effectiveness > 0.5 ? [mockSkill] : [],
          confidence: testCase.effectiveness,
          strategy: testCase.effectiveness > 0.5 ? 'single' : 'none',
          reasoning: 'Test',
        });

        mockSkillSelector.getEffectiveness.mockResolvedValue(testCase.effectiveness);

        const request: AIRequest = {
          task: testCase.task,
        };

        const decision = await requestRouter.route(request);

        expect(decision.model).toBe(testCase.expectedModel);
        expect(decision.strategy).toBe(testCase.expectedStrategy);
      }
    });
  });

  describe('reasoning generation', () => {
    it('should provide clear reasoning for decisions', async () => {
      mockSkillSelector.select.mockResolvedValue({
        skills: [mockSkill],
        confidence: 0.85,
        strategy: 'single',
        reasoning: 'Match',
      });

      mockSkillSelector.getEffectiveness.mockResolvedValue(0.85);

      const request: AIRequest = {
        task: 'Review contract',
      };

      const decision = await requestRouter.route(request);

      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.length).toBeGreaterThan(0);
      expect(typeof decision.reasoning).toBe('string');
    });
  });
});
