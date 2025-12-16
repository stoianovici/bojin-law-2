/**
 * SkillsMetricsCollector Tests
 *
 * Tests for New Relic metrics collection including:
 * - Skill execution metrics recording
 * - Cost metrics tracking
 * - Model distribution analysis
 * - Cache performance monitoring
 * - Error and timeout tracking
 */

import {
  SkillsMetricsCollector,
  SkillExecutionMetrics,
  CostMetrics,
} from '../../src/monitoring/SkillsMetricsCollector';

describe('SkillsMetricsCollector', () => {
  let collector: SkillsMetricsCollector;

  beforeEach(() => {
    // Use mock New Relic (not production)
    collector = new SkillsMetricsCollector({ useRealNewRelic: false });
  });

  afterEach(() => {
    collector.clearHistory();
  });

  // ============================================================================
  // Skill Execution Metrics
  // ============================================================================

  describe('Skill Execution Metrics', () => {
    it('should record skill execution metrics', () => {
      const metrics: SkillExecutionMetrics = {
        skillId: 'contract-analysis',
        model: 'claude-3-5-sonnet',
        executionTime: 2500,
        tokenSavings: 500,
        tokensUsed: 1000,
        cost: 0.015,
        success: true,
        timestamp: new Date(),
      };

      collector.recordSkillExecution(metrics);

      const history = collector.getHistory();
      expect(history.length).toBe(1);
      expect(history[0]).toMatchObject(metrics);
    });

    it('should track execution statistics', () => {
      const executions: SkillExecutionMetrics[] = [
        {
          skillId: 'contract-analysis',
          model: 'claude-3-5-sonnet',
          executionTime: 2000,
          tokenSavings: 500,
          tokensUsed: 1000,
          cost: 0.015,
          success: true,
          timestamp: new Date(),
        },
        {
          skillId: 'document-drafting',
          model: 'claude-3-5-haiku',
          executionTime: 1500,
          tokenSavings: 300,
          tokensUsed: 800,
          cost: 0.008,
          success: true,
          timestamp: new Date(),
        },
        {
          skillId: 'contract-analysis',
          model: 'claude-3-5-sonnet',
          executionTime: 3000,
          tokenSavings: 600,
          tokensUsed: 1200,
          cost: 0.018,
          success: false, // Failed execution
          timestamp: new Date(),
        },
      ];

      executions.forEach((e) => collector.recordSkillExecution(e));

      const stats = collector.getExecutionStats(60 * 60 * 1000); // Last hour

      expect(stats.totalExecutions).toBe(3);
      expect(stats.successRate).toBeCloseTo(2 / 3, 2);
      expect(stats.averageExecutionTime).toBeCloseTo(2166.67, 1);
      expect(stats.averageTokenSavings).toBeCloseTo(466.67, 1);
      expect(stats.totalCost).toBeCloseTo(0.041, 3);
    });

    it('should limit execution history', () => {
      // Add more than historyLimit executions
      for (let i = 0; i < 11000; i++) {
        collector.recordSkillExecution({
          skillId: 'test-skill',
          model: 'claude-3-5-sonnet',
          executionTime: 1000,
          tokenSavings: 100,
          tokensUsed: 500,
          cost: 0.005,
          success: true,
          timestamp: new Date(),
        });
      }

      const history = collector.getHistory();
      expect(history.length).toBeLessThanOrEqual(10000);
    });
  });

  // ============================================================================
  // Error and Timeout Tracking
  // ============================================================================

  describe('Error and Timeout Tracking', () => {
    it('should record skill errors', () => {
      const error = new Error('Skill execution failed');
      const context = {
        skillId: 'contract-analysis',
        model: 'claude-3-5-sonnet',
        executionTime: 2500,
      };

      expect(() => {
        collector.recordSkillError(error, context);
      }).not.toThrow();
    });

    it('should record skill timeouts', () => {
      const context = {
        skillId: 'document-drafting',
        model: 'claude-3-5-sonnet',
        timeoutDuration: 30000,
      };

      expect(() => {
        collector.recordSkillTimeout(context);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Cost Metrics (AC#5)
  // ============================================================================

  describe('Cost Metrics', () => {
    it('should record cost metrics', () => {
      const costMetrics: CostMetrics = {
        totalCost: 10.5,
        costWithSkills: 6.5,
        costWithoutSkills: 10.5,
        savingsPercent: 38.1, // >35% target
        tokensSaved: 5000,
        tokensUsed: 8000,
      };

      expect(() => {
        collector.recordCostMetrics(costMetrics);
      }).not.toThrow();
    });

    it('should calculate cost savings for timeframe', async () => {
      // Record some executions
      const executions: SkillExecutionMetrics[] = [
        {
          skillId: 'skill-1',
          model: 'claude-3-5-sonnet',
          executionTime: 2000,
          tokenSavings: 500,
          tokensUsed: 1000,
          cost: 0.015,
          success: true,
          timestamp: new Date(),
        },
        {
          skillId: 'skill-2',
          model: 'claude-3-5-haiku',
          executionTime: 1500,
          tokenSavings: 300,
          tokensUsed: 800,
          cost: 0.008,
          success: true,
          timestamp: new Date(),
        },
      ];

      executions.forEach((e) => collector.recordSkillExecution(e));

      const savings = await collector.calculateCostSavings('hourly');

      expect(savings.costWithSkills).toBeCloseTo(0.023, 3);
      expect(savings.tokensSaved).toBe(800);
      expect(savings.tokensUsed).toBe(1800);
      expect(savings.savingsPercent).toBeGreaterThan(0);
    });

    it('should return zero metrics when no data available', async () => {
      const savings = await collector.calculateCostSavings('daily');

      expect(savings.totalCost).toBe(0);
      expect(savings.savingsPercent).toBe(0);
    });
  });

  // ============================================================================
  // Model Distribution
  // ============================================================================

  describe('Model Distribution', () => {
    it('should calculate model distribution', () => {
      const executions: SkillExecutionMetrics[] = [
        {
          skillId: 'skill-1',
          model: 'claude-3-5-sonnet',
          executionTime: 2000,
          tokenSavings: 500,
          tokensUsed: 1000,
          cost: 0.015,
          success: true,
          timestamp: new Date(),
        },
        {
          skillId: 'skill-2',
          model: 'claude-3-5-sonnet',
          executionTime: 2500,
          tokenSavings: 600,
          tokensUsed: 1200,
          cost: 0.018,
          success: true,
          timestamp: new Date(),
        },
        {
          skillId: 'skill-3',
          model: 'claude-3-5-haiku',
          executionTime: 1500,
          tokenSavings: 300,
          tokensUsed: 800,
          cost: 0.008,
          success: true,
          timestamp: new Date(),
        },
      ];

      executions.forEach((e) => collector.recordSkillExecution(e));

      const distribution = collector.getModelDistribution();

      expect(distribution.length).toBe(2);

      const sonnet = distribution.find((d) => d.model === 'claude-3-5-sonnet');
      expect(sonnet).toBeDefined();
      expect(sonnet?.requestCount).toBe(2);
      expect(sonnet?.percentage).toBeCloseTo(66.67, 1);

      const haiku = distribution.find((d) => d.model === 'claude-3-5-haiku');
      expect(haiku).toBeDefined();
      expect(haiku?.requestCount).toBe(1);
      expect(haiku?.percentage).toBeCloseTo(33.33, 1);
    });

    it('should record model distribution metrics', () => {
      const distributions = [
        {
          model: 'claude-3-5-sonnet',
          requestCount: 100,
          totalCost: 1.5,
          percentage: 60,
        },
        {
          model: 'claude-3-5-haiku',
          requestCount: 67,
          totalCost: 0.67,
          percentage: 40,
        },
      ];

      expect(() => {
        collector.recordModelDistribution(distributions);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Cache Performance
  // ============================================================================

  describe('Cache Performance', () => {
    it('should record cache metrics', () => {
      const cacheMetrics = {
        hitRate: 0.65,
        missRate: 0.35,
        totalRequests: 1000,
        hits: 650,
        misses: 350,
      };

      expect(() => {
        collector.recordCacheMetrics(cacheMetrics);
      }).not.toThrow();
    });

    it('should record cache hits', () => {
      expect(() => {
        collector.recordCacheHit('contract-analysis');
      }).not.toThrow();
    });

    it('should record cache misses', () => {
      expect(() => {
        collector.recordCacheMiss('document-drafting');
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Performance Tracking (AC#4)
  // ============================================================================

  describe('Performance Tracking', () => {
    it('should record routing performance', () => {
      const metrics = {
        routingTime: 85, // <100ms target from Story 2.13
        skillsSelected: 2,
        cacheHit: true,
      };

      expect(() => {
        collector.recordRoutingPerformance(metrics);
      }).not.toThrow();
    });

    it('should record request latency', () => {
      const metrics = {
        totalLatency: 4500, // <5s target (AC#4)
        skillExecutionTime: 3000,
        apiLatency: 1400,
        routingLatency: 100,
      };

      expect(() => {
        collector.recordRequestLatency(metrics);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Analytics
  // ============================================================================

  describe('Analytics', () => {
    it('should identify top skills by savings', () => {
      const executions: SkillExecutionMetrics[] = [
        {
          skillId: 'contract-analysis',
          model: 'claude-3-5-sonnet',
          executionTime: 2000,
          tokenSavings: 1000, // High savings
          tokensUsed: 1000,
          cost: 0.015,
          success: true,
          timestamp: new Date(),
        },
        {
          skillId: 'document-drafting',
          model: 'claude-3-5-haiku',
          executionTime: 1500,
          tokenSavings: 300, // Lower savings
          tokensUsed: 800,
          cost: 0.008,
          success: true,
          timestamp: new Date(),
        },
        {
          skillId: 'contract-analysis',
          model: 'claude-3-5-sonnet',
          executionTime: 2500,
          tokenSavings: 1200, // High savings
          tokensUsed: 1200,
          cost: 0.018,
          success: true,
          timestamp: new Date(),
        },
      ];

      executions.forEach((e) => collector.recordSkillExecution(e));

      const topSkills = collector.getTopSkillsBySavings(5);

      expect(topSkills.length).toBe(2);
      expect(topSkills[0].skillId).toBe('contract-analysis');
      expect(topSkills[0].totalSavings).toBe(2200);
      expect(topSkills[0].executionCount).toBe(2);
    });

    it('should limit top skills results', () => {
      // Add 20 different skills
      for (let i = 0; i < 20; i++) {
        collector.recordSkillExecution({
          skillId: `skill-${i}`,
          model: 'claude-3-5-sonnet',
          executionTime: 2000,
          tokenSavings: 500 + i * 10,
          tokensUsed: 1000,
          cost: 0.015,
          success: true,
          timestamp: new Date(),
        });
      }

      const topSkills = collector.getTopSkillsBySavings(10);

      expect(topSkills.length).toBe(10);
    });
  });

  // ============================================================================
  // Utility Methods
  // ============================================================================

  describe('Utility Methods', () => {
    it('should provide access to New Relic instance', () => {
      const newrelic = collector.getNewRelic();
      expect(newrelic).toBeDefined();
      expect(newrelic.recordMetric).toBeDefined();
      expect(newrelic.recordCustomEvent).toBeDefined();
    });

    it('should clear execution history', () => {
      collector.recordSkillExecution({
        skillId: 'test-skill',
        model: 'claude-3-5-sonnet',
        executionTime: 2000,
        tokenSavings: 500,
        tokensUsed: 1000,
        cost: 0.015,
        success: true,
        timestamp: new Date(),
      });

      expect(collector.getHistory().length).toBe(1);

      collector.clearHistory();

      expect(collector.getHistory().length).toBe(0);
    });

    it('should limit returned history', () => {
      for (let i = 0; i < 100; i++) {
        collector.recordSkillExecution({
          skillId: 'test-skill',
          model: 'claude-3-5-sonnet',
          executionTime: 2000,
          tokenSavings: 500,
          tokensUsed: 1000,
          cost: 0.015,
          success: true,
          timestamp: new Date(),
        });
      }

      const limitedHistory = collector.getHistory(10);
      expect(limitedHistory.length).toBe(10);
    });
  });
});
