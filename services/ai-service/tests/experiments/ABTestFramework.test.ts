import { ABTestFramework, ExperimentConfig, ExperimentMetrics, ExperimentVariant, Logger } from '../../src/experiments/ABTestFramework';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('ABTestFramework', () => {
  let framework: ABTestFramework;
  let baseConfig: ExperimentConfig;

  beforeEach(() => {
    framework = new ABTestFramework(mockLogger);
    baseConfig = {
      id: 'test-exp-001',
      name: 'Skills A/B Test',
      description: 'Testing skills vs no skills',
      assignmentStrategy: 'hash',
      significanceLevel: 0.05,
      minimumSampleSize: 30,
      startDate: new Date('2024-01-01'),
      active: true
    };
  });

  describe('Experiment Creation', () => {
    it('should create a new experiment successfully', () => {
      framework.createExperiment(baseConfig);
      const experiment = framework.getExperiment(baseConfig.id);
      expect(experiment).toEqual(baseConfig);
    });

    it('should throw error when creating duplicate experiment', () => {
      framework.createExperiment(baseConfig);
      expect(() => framework.createExperiment(baseConfig)).toThrow(
        `Experiment ${baseConfig.id} already exists`
      );
    });

    it('should log experiment creation', () => {
      framework.createExperiment(baseConfig);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Experiment created',
        expect.objectContaining({
          experimentId: baseConfig.id,
          name: baseConfig.name
        })
      );
    });
  });

  describe('User Assignment - Hash Strategy', () => {
    beforeEach(() => {
      framework.createExperiment(baseConfig);
    });

    it('should assign user to variant using hash strategy', () => {
      const variant = framework.assignUser(baseConfig.id, 'user123');
      expect(['control', 'treatment']).toContain(variant);
    });

    it('should consistently assign same user to same variant', () => {
      const variant1 = framework.assignUser(baseConfig.id, 'user123');
      const variant2 = framework.assignUser(baseConfig.id, 'user123');
      expect(variant1).toBe(variant2);
    });

    it('should create approximately 50/50 split across many users', () => {
      const assignments: { [key in ExperimentVariant]: number } = {
        control: 0,
        treatment: 0
      };

      // Assign 1000 users
      for (let i = 0; i < 1000; i++) {
        const variant = framework.assignUser(baseConfig.id, `user${i}`);
        assignments[variant]++;
      }

      // Should be roughly 50/50 (allowing 10% variance)
      const controlPercent = (assignments.control / 1000) * 100;
      expect(controlPercent).toBeGreaterThan(45);
      expect(controlPercent).toBeLessThan(55);
    });

    it('should throw error when experiment not found', () => {
      expect(() => framework.assignUser('non-existent', 'user123')).toThrow(
        'Experiment non-existent not found'
      );
    });

    it('should throw error when experiment is inactive', () => {
      const inactiveConfig = { ...baseConfig, id: 'inactive-exp', active: false };
      framework.createExperiment(inactiveConfig);
      expect(() => framework.assignUser(inactiveConfig.id, 'user123')).toThrow(
        `Experiment ${inactiveConfig.id} is not active`
      );
    });
  });

  describe('User Assignment - Random Strategy', () => {
    beforeEach(() => {
      const randomConfig = { ...baseConfig, assignmentStrategy: 'random' as const };
      framework.createExperiment(randomConfig);
    });

    it('should assign user to variant using random strategy', () => {
      const variant = framework.assignUser(baseConfig.id, 'user456');
      expect(['control', 'treatment']).toContain(variant);
    });

    it('should remember first assignment for user even with random strategy', () => {
      const variant1 = framework.assignUser(baseConfig.id, 'user456');
      const variant2 = framework.assignUser(baseConfig.id, 'user456');
      expect(variant1).toBe(variant2);
    });
  });

  describe('Metric Recording', () => {
    beforeEach(() => {
      framework.createExperiment(baseConfig);
    });

    it('should record metrics for control variant', () => {
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.015,
        executionTimeMs: 1200,
        tokenUsage: 5000,
        timestamp: new Date()
      };

      framework.recordMetrics(baseConfig.id, 'control', metrics);
      const sizes = framework.getSampleSizes(baseConfig.id);
      expect(sizes.control).toBe(1);
      expect(sizes.treatment).toBe(0);
    });

    it('should record metrics for treatment variant', () => {
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.008,
        executionTimeMs: 1000,
        tokenUsage: 3000,
        timestamp: new Date()
      };

      framework.recordMetrics(baseConfig.id, 'treatment', metrics);
      const sizes = framework.getSampleSizes(baseConfig.id);
      expect(sizes.control).toBe(0);
      expect(sizes.treatment).toBe(1);
    });

    it('should track multiple metrics for same variant', () => {
      const metrics1: ExperimentMetrics = {
        costPerRequest: 0.015,
        executionTimeMs: 1200,
        tokenUsage: 5000,
        timestamp: new Date()
      };

      const metrics2: ExperimentMetrics = {
        costPerRequest: 0.014,
        executionTimeMs: 1100,
        tokenUsage: 4800,
        timestamp: new Date()
      };

      framework.recordMetrics(baseConfig.id, 'control', metrics1);
      framework.recordMetrics(baseConfig.id, 'control', metrics2);

      const sizes = framework.getSampleSizes(baseConfig.id);
      expect(sizes.control).toBe(2);
    });

    it('should record optional quality metrics', () => {
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.015,
        executionTimeMs: 1200,
        tokenUsage: 5000,
        responseQuality: 0.95,
        timestamp: new Date()
      };

      expect(() => framework.recordMetrics(baseConfig.id, 'control', metrics)).not.toThrow();
    });

    it('should throw error when recording metrics for non-existent experiment', () => {
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.015,
        executionTimeMs: 1200,
        tokenUsage: 5000,
        timestamp: new Date()
      };

      expect(() => framework.recordMetrics('non-existent', 'control', metrics)).toThrow(
        'Experiment non-existent not found'
      );
    });
  });

  describe('Sample Size Tracking', () => {
    beforeEach(() => {
      framework.createExperiment(baseConfig);
    });

    it('should return zero sample sizes for new experiment', () => {
      const sizes = framework.getSampleSizes(baseConfig.id);
      expect(sizes.control).toBe(0);
      expect(sizes.treatment).toBe(0);
    });

    it('should track sample sizes correctly', () => {
      // Record 10 control metrics
      for (let i = 0; i < 10; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
      }

      // Record 15 treatment metrics
      for (let i = 0; i < 15; i++) {
        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.008,
          executionTimeMs: 1000,
          tokenUsage: 3000,
          timestamp: new Date()
        });
      }

      const sizes = framework.getSampleSizes(baseConfig.id);
      expect(sizes.control).toBe(10);
      expect(sizes.treatment).toBe(15);
    });
  });

  describe('Statistical Analysis', () => {
    beforeEach(() => {
      framework.createExperiment(baseConfig);
    });

    it('should throw error when sample size too small', () => {
      // Record only 10 metrics (less than minimumSampleSize of 30)
      for (let i = 0; i < 10; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.008,
          executionTimeMs: 1000,
          tokenUsage: 3000,
          timestamp: new Date()
        });
      }

      expect(() => framework.analyzeExperiment(baseConfig.id)).toThrow(
        /Insufficient sample size/
      );
    });

    it('should detect significant difference when treatment is clearly better', () => {
      // Control: expensive and slow
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015 + (Math.random() * 0.001), // ~$0.015
          executionTimeMs: 1200 + (Math.random() * 100),
          tokenUsage: 5000 + (Math.random() * 200),
          timestamp: new Date()
        });
      }

      // Treatment: much cheaper and faster
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.006 + (Math.random() * 0.001), // ~$0.006 (60% cheaper)
          executionTimeMs: 800 + (Math.random() * 100),
          tokenUsage: 2000 + (Math.random() * 200),
          timestamp: new Date()
        });
      }

      const analysis = framework.analyzeExperiment(baseConfig.id);

      expect(analysis.significant).toBe(true);
      expect(analysis.pValue).toBeLessThan(0.05);
      expect(analysis.relativeDifference.cost).toBeLessThan(-50); // Treatment saves >50%
      expect(analysis.recommendation).toBe('adopt_treatment');
    });

    it('should not detect significance when variants are similar', () => {
      // Both variants have similar metrics
      for (let i = 0; i < 50; i++) {
        const baseCost = 0.010 + (Math.random() * 0.002);
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: baseCost,
          executionTimeMs: 1000 + (Math.random() * 200),
          tokenUsage: 4000 + (Math.random() * 500),
          timestamp: new Date()
        });

        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: baseCost + (Math.random() * 0.001 - 0.0005), // Very similar
          executionTimeMs: 1000 + (Math.random() * 200),
          tokenUsage: 4000 + (Math.random() * 500),
          timestamp: new Date()
        });
      }

      const analysis = framework.analyzeExperiment(baseConfig.id);

      expect(analysis.significant).toBe(false);
      expect(analysis.recommendation).toBe('continue_testing');
    });

    it('should calculate correct relative differences', () => {
      // Control: $0.020 per request
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.020,
          executionTimeMs: 1000,
          tokenUsage: 5000,
          timestamp: new Date()
        });
      }

      // Treatment: $0.010 per request (50% cheaper)
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.010,
          executionTimeMs: 1000,
          tokenUsage: 5000,
          timestamp: new Date()
        });
      }

      const analysis = framework.analyzeExperiment(baseConfig.id);

      expect(analysis.relativeDifference.cost).toBeCloseTo(-50, 0); // -50% = 50% cheaper
    });

    it('should include quality metrics in analysis when available', () => {
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          responseQuality: 0.85,
          timestamp: new Date()
        });

        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.008,
          executionTimeMs: 1000,
          tokenUsage: 3000,
          responseQuality: 0.90,
          timestamp: new Date()
        });
      }

      const analysis = framework.analyzeExperiment(baseConfig.id);

      expect(analysis.control.metrics.avgQuality).toBeCloseTo(0.85, 2);
      expect(analysis.treatment.metrics.avgQuality).toBeCloseTo(0.90, 2);
      expect(analysis.relativeDifference.quality).toBeDefined();
    });
  });

  describe('Experiment Management', () => {
    it('should stop experiment and set end date', () => {
      framework.createExperiment(baseConfig);
      expect(baseConfig.active).toBe(true);

      framework.stopExperiment(baseConfig.id);

      const experiment = framework.getExperiment(baseConfig.id);
      expect(experiment?.active).toBe(false);
      expect(experiment?.endDate).toBeDefined();
    });

    it('should throw error when stopping non-existent experiment', () => {
      expect(() => framework.stopExperiment('non-existent')).toThrow(
        'Experiment non-existent not found'
      );
    });

    it('should get all active experiments', () => {
      const config1 = { ...baseConfig, id: 'exp1', active: true };
      const config2 = { ...baseConfig, id: 'exp2', active: false };
      const config3 = { ...baseConfig, id: 'exp3', active: true };

      framework.createExperiment(config1);
      framework.createExperiment(config2);
      framework.createExperiment(config3);

      const activeExperiments = framework.getActiveExperiments();

      expect(activeExperiments).toHaveLength(2);
      expect(activeExperiments.map(e => e.id)).toContain('exp1');
      expect(activeExperiments.map(e => e.id)).toContain('exp3');
      expect(activeExperiments.map(e => e.id)).not.toContain('exp2');
    });
  });

  describe('Data Export', () => {
    beforeEach(() => {
      framework.createExperiment(baseConfig);
    });

    it('should export complete experiment data', () => {
      // Assign users
      framework.assignUser(baseConfig.id, 'user1');
      framework.assignUser(baseConfig.id, 'user2');

      // Record metrics
      framework.recordMetrics(baseConfig.id, 'control', {
        costPerRequest: 0.015,
        executionTimeMs: 1200,
        tokenUsage: 5000,
        timestamp: new Date()
      });

      const exportData = framework.exportExperimentData(baseConfig.id);

      expect(exportData.config).toEqual(baseConfig);
      expect(exportData.assignments).toHaveLength(2);
      expect(exportData.metrics.control).toHaveLength(1);
      expect(exportData.metrics.treatment).toHaveLength(0);
    });

    it('should throw error when exporting non-existent experiment', () => {
      expect(() => framework.exportExperimentData('non-existent')).toThrow(
        'Experiment non-existent not found'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle experiment with only control metrics', () => {
      framework.createExperiment(baseConfig);

      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
      }

      // Should throw because treatment has no metrics
      expect(() => framework.analyzeExperiment(baseConfig.id)).toThrow(
        /Insufficient sample size/
      );
    });

    it('should handle very large datasets', () => {
      framework.createExperiment(baseConfig);

      // Record 1000 metrics for each variant
      for (let i = 0; i < 1000; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015 + (Math.random() * 0.001),
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });

        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.008 + (Math.random() * 0.001),
          executionTimeMs: 1000,
          tokenUsage: 3000,
          timestamp: new Date()
        });
      }

      const analysis = framework.analyzeExperiment(baseConfig.id);
      expect(analysis).toBeDefined();
      expect(analysis.control.sampleSize).toBe(1000);
      expect(analysis.treatment.sampleSize).toBe(1000);
    });

    it('should handle zero cost metrics', () => {
      framework.createExperiment(baseConfig);

      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });

        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0,
          executionTimeMs: 1000,
          tokenUsage: 3000,
          timestamp: new Date()
        });
      }

      const analysis = framework.analyzeExperiment(baseConfig.id);
      expect(analysis.control.metrics.avgCost).toBe(0);
      expect(analysis.treatment.metrics.avgCost).toBe(0);
    });
  });
});
