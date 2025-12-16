/**
 * Tests for SkillMetrics
 */

import { SkillMetrics, SkillExecutionRecord } from '../../src/metrics/SkillMetrics';

describe('SkillMetrics', () => {
  let skillMetrics: SkillMetrics;

  beforeEach(() => {
    skillMetrics = new SkillMetrics();
  });

  afterEach(() => {
    skillMetrics.clearCache();
  });

  describe('recordExecution', () => {
    it('should record a successful execution', async () => {
      const record: SkillExecutionRecord = {
        skillId: 'contract-analysis',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 2000,
        tokensUsed: 500,
        tokensSaved: 0.7,
      };

      await skillMetrics.recordExecution(record);

      const metrics = await skillMetrics.getEffectiveness('contract-analysis');
      expect(metrics).not.toBeNull();
      expect(metrics!.totalExecutions).toBe(1);
      expect(metrics!.successfulExecutions).toBe(1);
      expect(metrics!.successRate).toBe(1.0);
    });

    it('should record a failed execution', async () => {
      const record: SkillExecutionRecord = {
        skillId: 'contract-analysis',
        timestamp: new Date(),
        success: false,
        executionTimeMs: 1500,
        tokensUsed: 300,
        tokensSaved: 0,
        errorMessage: 'Timeout error',
      };

      await skillMetrics.recordExecution(record);

      const metrics = await skillMetrics.getEffectiveness('contract-analysis');
      expect(metrics).not.toBeNull();
      expect(metrics!.totalExecutions).toBe(1);
      expect(metrics!.failedExecutions).toBe(1);
      expect(metrics!.successRate).toBe(0);
      expect(metrics!.errorRate).toBe(1.0);
    });

    it('should track user satisfaction when provided', async () => {
      const record: SkillExecutionRecord = {
        skillId: 'contract-analysis',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 2000,
        tokensUsed: 500,
        tokensSaved: 0.7,
        userSatisfaction: 4.5,
      };

      await skillMetrics.recordExecution(record);

      const metrics = await skillMetrics.getEffectiveness('contract-analysis');
      expect(metrics!.averageUserSatisfaction).toBe(4.5);
      expect(metrics!.userSatisfactionCount).toBe(1);
    });

    it('should update metrics for multiple executions', async () => {
      const records: SkillExecutionRecord[] = [
        {
          skillId: 'contract-analysis',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 500,
          tokensSaved: 0.7,
        },
        {
          skillId: 'contract-analysis',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 1800,
          tokensUsed: 450,
          tokensSaved: 0.65,
        },
        {
          skillId: 'contract-analysis',
          timestamp: new Date(),
          success: false,
          executionTimeMs: 3000,
          tokensUsed: 600,
          tokensSaved: 0,
          errorMessage: 'Parse error',
        },
      ];

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('contract-analysis');
      expect(metrics!.totalExecutions).toBe(3);
      expect(metrics!.successfulExecutions).toBe(2);
      expect(metrics!.failedExecutions).toBe(1);
      expect(metrics!.successRate).toBeCloseTo(0.667, 2);
      expect(metrics!.errorRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('effectiveness calculation', () => {
    it('should calculate effectiveness score correctly', async () => {
      const records: SkillExecutionRecord[] = [
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2200,
          tokensUsed: 320,
          tokensSaved: 0.68,
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 1900,
          tokensUsed: 290,
          tokensSaved: 0.72,
        },
      ];

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('test-skill');
      expect(metrics!.effectivenessScore).toBeGreaterThan(0.7);
      expect(metrics!.effectivenessScore).toBeLessThanOrEqual(1.0);
    });

    it('should penalize high error rates', async () => {
      const records: SkillExecutionRecord[] = [
        {
          skillId: 'unreliable-skill',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
        },
        {
          skillId: 'unreliable-skill',
          timestamp: new Date(),
          success: false,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0,
          errorMessage: 'Error 1',
        },
        {
          skillId: 'unreliable-skill',
          timestamp: new Date(),
          success: false,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0,
          errorMessage: 'Error 2',
        },
      ];

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('unreliable-skill');
      expect(metrics!.effectivenessScore).toBeLessThan(0.5);
    });

    it('should boost score with high user satisfaction', async () => {
      const recordsWithSatisfaction: SkillExecutionRecord[] = [
        {
          skillId: 'skill-with-satisfaction',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
          userSatisfaction: 5,
        },
        {
          skillId: 'skill-with-satisfaction',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
          userSatisfaction: 5,
        },
      ];

      const recordsWithoutSatisfaction: SkillExecutionRecord[] = [
        {
          skillId: 'skill-without-satisfaction',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
        },
        {
          skillId: 'skill-without-satisfaction',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
        },
      ];

      await skillMetrics.recordBatch(recordsWithSatisfaction);
      await skillMetrics.recordBatch(recordsWithoutSatisfaction);

      const metricsWithSat = await skillMetrics.getEffectiveness('skill-with-satisfaction');
      const metricsWithoutSat = await skillMetrics.getEffectiveness('skill-without-satisfaction');

      expect(metricsWithSat!.effectivenessScore).toBeGreaterThan(
        metricsWithoutSat!.effectivenessScore
      );
    });
  });

  describe('rolling averages', () => {
    it('should calculate 24-hour rolling metrics', async () => {
      const now = Date.now();
      const records: SkillExecutionRecord[] = [
        {
          skillId: 'test-skill',
          timestamp: new Date(now - 2 * 60 * 60 * 1000), // 2 hours ago
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(now - 1 * 60 * 60 * 1000), // 1 hour ago
          success: true,
          executionTimeMs: 1800,
          tokensUsed: 280,
          tokensSaved: 0.75,
        },
      ];

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('test-skill');
      expect(metrics!.last24Hours.executions).toBe(2);
      expect(metrics!.last24Hours.successRate).toBe(1.0);
      expect(metrics!.last24Hours.avgTokensSaved).toBeGreaterThan(0);
    });

    it('should exclude old records from 24-hour window', async () => {
      const now = Date.now();
      const records: SkillExecutionRecord[] = [
        {
          skillId: 'test-skill',
          timestamp: new Date(now - 48 * 60 * 60 * 1000), // 48 hours ago
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(now - 1 * 60 * 60 * 1000), // 1 hour ago
          success: true,
          executionTimeMs: 1800,
          tokensUsed: 280,
          tokensSaved: 0.75,
        },
      ];

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('test-skill');
      expect(metrics!.last24Hours.executions).toBe(1); // Only the recent one
      expect(metrics!.totalExecutions).toBe(2); // Both in total
    });
  });

  describe('statistics calculations', () => {
    it('should calculate token savings statistics', async () => {
      const records: SkillExecutionRecord[] = [
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.6,
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.7,
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.8,
        },
      ];

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('test-skill');
      expect(metrics!.averageTokensSaved).toBeCloseTo(0.7, 2);
      expect(metrics!.tokenSavingsStdDev).toBeGreaterThan(0);
      expect(metrics!.totalTokensSaved).toBeCloseTo(2.1, 2);
    });

    it('should calculate execution time percentiles', async () => {
      const records: SkillExecutionRecord[] = Array.from({ length: 100 }, (_, i) => ({
        skillId: 'test-skill',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 1000 + i * 10, // 1000ms to 1990ms
        tokensUsed: 300,
        tokensSaved: 0.7,
      }));

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('test-skill');
      expect(metrics!.p95ExecutionTimeMs).toBeGreaterThan(metrics!.averageExecutionTimeMs);
      expect(metrics!.p95ExecutionTimeMs).toBeLessThanOrEqual(1990);
    });
  });

  describe('error tracking', () => {
    it('should track common errors', async () => {
      const records: SkillExecutionRecord[] = [
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: false,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0,
          errorMessage: 'Timeout',
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: false,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0,
          errorMessage: 'Timeout',
        },
        {
          skillId: 'test-skill',
          timestamp: new Date(),
          success: false,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0,
          errorMessage: 'Parse error',
        },
      ];

      await skillMetrics.recordBatch(records);

      const metrics = await skillMetrics.getEffectiveness('test-skill');
      expect(metrics!.commonErrors.get('Timeout')).toBe(2);
      expect(metrics!.commonErrors.get('Parse error')).toBe(1);
    });
  });

  describe('getTopSkills', () => {
    beforeEach(async () => {
      // Create metrics for multiple skills
      await skillMetrics.recordBatch([
        {
          skillId: 'high-effectiveness',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 1500,
          tokensUsed: 200,
          tokensSaved: 0.8,
        },
        {
          skillId: 'high-effectiveness',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 1600,
          tokensUsed: 210,
          tokensSaved: 0.75,
        },
        {
          skillId: 'high-usage',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2000,
          tokensUsed: 300,
          tokensSaved: 0.6,
        },
        {
          skillId: 'high-usage',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2100,
          tokensUsed: 310,
          tokensSaved: 0.58,
        },
        {
          skillId: 'high-usage',
          timestamp: new Date(),
          success: true,
          executionTimeMs: 2050,
          tokensUsed: 305,
          tokensSaved: 0.59,
        },
      ]);
    });

    it('should return top skills by effectiveness', () => {
      const topSkills = skillMetrics.getTopSkills(2, 'effectiveness');

      expect(topSkills).toHaveLength(2);
      expect(topSkills[0].effectivenessScore).toBeGreaterThanOrEqual(
        topSkills[1].effectivenessScore
      );
    });

    it('should return top skills by usage', () => {
      const topSkills = skillMetrics.getTopSkills(2, 'usage');

      expect(topSkills).toHaveLength(2);
      expect(topSkills[0].skillId).toBe('high-usage');
      expect(topSkills[0].totalExecutions).toBe(3);
    });

    it('should return top skills by savings', () => {
      const topSkills = skillMetrics.getTopSkills(2, 'savings');

      expect(topSkills).toHaveLength(2);
      expect(topSkills[0].totalTokensSaved).toBeGreaterThanOrEqual(topSkills[1].totalTokensSaved);
    });
  });

  describe('getEffectivenessForSkills', () => {
    it('should return metrics for multiple skills', async () => {
      await skillMetrics.recordExecution({
        skillId: 'skill-1',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 2000,
        tokensUsed: 300,
        tokensSaved: 0.7,
      });

      await skillMetrics.recordExecution({
        skillId: 'skill-2',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 1800,
        tokensUsed: 280,
        tokensSaved: 0.65,
      });

      const metricsMap = await skillMetrics.getEffectivenessForSkills(['skill-1', 'skill-2']);

      expect(metricsMap.size).toBe(2);
      expect(metricsMap.has('skill-1')).toBe(true);
      expect(metricsMap.has('skill-2')).toBe(true);
    });

    it('should handle missing skills', async () => {
      await skillMetrics.recordExecution({
        skillId: 'skill-1',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 2000,
        tokensUsed: 300,
        tokensSaved: 0.7,
      });

      const metricsMap = await skillMetrics.getEffectivenessForSkills(['skill-1', 'non-existent']);

      expect(metricsMap.size).toBe(1);
      expect(metricsMap.has('skill-1')).toBe(true);
      expect(metricsMap.has('non-existent')).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      await skillMetrics.recordExecution({
        skillId: 'skill-1',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 2000,
        tokensUsed: 300,
        tokensSaved: 0.7,
      });

      await skillMetrics.recordExecution({
        skillId: 'skill-2',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 1800,
        tokensUsed: 280,
        tokensSaved: 0.65,
      });

      const stats = skillMetrics.getCacheStats();

      expect(stats.skillsTracked).toBe(2);
      expect(stats.totalExecutions).toBe(2);
      expect(stats.cacheSize).toBe(2);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      await skillMetrics.recordExecution({
        skillId: 'test-skill',
        timestamp: new Date(),
        success: true,
        executionTimeMs: 2000,
        tokensUsed: 300,
        tokensSaved: 0.7,
      });

      expect(skillMetrics.getCacheStats().totalExecutions).toBe(1);

      skillMetrics.clearCache();

      expect(skillMetrics.getCacheStats().totalExecutions).toBe(0);
      expect(skillMetrics.getCacheStats().skillsTracked).toBe(0);
    });
  });
});
