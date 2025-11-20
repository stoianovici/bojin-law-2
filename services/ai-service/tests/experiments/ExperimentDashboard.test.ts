import { ABTestFramework, ExperimentConfig, Logger } from '../../src/experiments/ABTestFramework';
import { ExperimentDashboard } from '../../src/experiments/ExperimentDashboard';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('ExperimentDashboard', () => {
  let framework: ABTestFramework;
  let dashboard: ExperimentDashboard;
  let baseConfig: ExperimentConfig;

  beforeEach(() => {
    framework = new ABTestFramework(mockLogger);
    dashboard = new ExperimentDashboard(framework, mockLogger);

    baseConfig = {
      id: 'test-exp-001',
      name: 'Skills A/B Test',
      description: 'Testing skills vs no skills',
      assignmentStrategy: 'hash',
      significanceLevel: 0.05,
      minimumSampleSize: 30,
      startDate: new Date('2024-01-01T00:00:00Z'),
      active: true
    };

    framework.createExperiment(baseConfig);
  });

  describe('Dashboard Summary', () => {
    it('should generate dashboard summary for new experiment', () => {
      const summary = dashboard.getDashboardSummary(baseConfig.id);

      expect(summary.experimentId).toBe(baseConfig.id);
      expect(summary.experimentName).toBe(baseConfig.name);
      expect(summary.status).toBe('active');
      expect(summary.sampleSizes.total).toBe(0);
      expect(summary.progress.percentComplete).toBe(0);
    });

    it('should calculate correct sample sizes', () => {
      // Record 10 control and 15 treatment metrics
      for (let i = 0; i < 10; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
      }

      for (let i = 0; i < 15; i++) {
        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.008,
          executionTimeMs: 1000,
          tokenUsage: 3000,
          timestamp: new Date()
        });
      }

      const summary = dashboard.getDashboardSummary(baseConfig.id);

      expect(summary.sampleSizes.control).toBe(10);
      expect(summary.sampleSizes.treatment).toBe(15);
      expect(summary.sampleSizes.total).toBe(25);
    });

    it('should calculate progress percentage correctly', () => {
      // minimumSampleSize is 30 per variant, so total target is 60
      // Record 30 total metrics (50% progress)
      for (let i = 0; i < 15; i++) {
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

      const summary = dashboard.getDashboardSummary(baseConfig.id);

      expect(summary.progress.percentComplete).toBeCloseTo(50, 0);
    });

    it('should cap progress at 100%', () => {
      // Record more than minimum sample size
      for (let i = 0; i < 100; i++) {
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

      const summary = dashboard.getDashboardSummary(baseConfig.id);

      expect(summary.progress.percentComplete).toBe(100);
    });

    it('should calculate average metrics correctly', () => {
      framework.recordMetrics(baseConfig.id, 'control', {
        costPerRequest: 0.010,
        executionTimeMs: 1000,
        tokenUsage: 4000,
        timestamp: new Date()
      });

      framework.recordMetrics(baseConfig.id, 'control', {
        costPerRequest: 0.020,
        executionTimeMs: 2000,
        tokenUsage: 6000,
        timestamp: new Date()
      });

      const summary = dashboard.getDashboardSummary(baseConfig.id);

      expect(summary.currentMetrics.control.avgCostPerRequest).toBe(0.015);
      expect(summary.currentMetrics.control.avgExecutionTimeMs).toBe(1500);
      expect(summary.currentMetrics.control.avgTokenUsage).toBe(5000);
      expect(summary.currentMetrics.control.totalRequests).toBe(2);
    });

    it('should handle experiments with quality metrics', () => {
      framework.recordMetrics(baseConfig.id, 'control', {
        costPerRequest: 0.015,
        executionTimeMs: 1200,
        tokenUsage: 5000,
        responseQuality: 0.85,
        timestamp: new Date()
      });

      framework.recordMetrics(baseConfig.id, 'control', {
        costPerRequest: 0.015,
        executionTimeMs: 1200,
        tokenUsage: 5000,
        responseQuality: 0.95,
        timestamp: new Date()
      });

      const summary = dashboard.getDashboardSummary(baseConfig.id);

      expect(summary.currentMetrics.control.avgQuality).toBeCloseTo(0.90, 2);
    });

    it('should show completed status for inactive experiments', () => {
      framework.stopExperiment(baseConfig.id);

      const summary = dashboard.getDashboardSummary(baseConfig.id);

      expect(summary.status).toBe('completed');
      expect(summary.endDate).toBeDefined();
    });
  });

  describe('Comparison Report', () => {
    beforeEach(() => {
      // Create sufficient sample size for analysis
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.015,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });

        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.008, // ~47% cheaper
          executionTimeMs: 1000, // ~17% faster
          tokenUsage: 3000, // ~40% fewer tokens
          timestamp: new Date()
        });
      }
    });

    it('should generate comparison report with correct winner', () => {
      const report = dashboard.generateComparisonReport(baseConfig.id);

      expect(report.summary.winner).toBe('treatment');
      expect(report.summary.costSavings).toBeGreaterThan(40); // Treatment saves >40%
      expect(report.recommendation.action).toBe('adopt_treatment');
    });

    it('should calculate cost savings correctly', () => {
      const report = dashboard.generateComparisonReport(baseConfig.id);

      // Treatment costs $0.008 vs control $0.015 = ~46.7% savings
      expect(report.summary.costSavings).toBeCloseTo(46.7, 0);
    });

    it('should calculate speed improvement correctly', () => {
      const report = dashboard.generateComparisonReport(baseConfig.id);

      // Treatment 1000ms vs control 1200ms = ~16.7% improvement
      expect(report.summary.speedImprovement).toBeCloseTo(16.7, 0);
    });

    it('should calculate token reduction correctly', () => {
      const report = dashboard.generateComparisonReport(baseConfig.id);

      // Treatment 3000 tokens vs control 5000 tokens = 40% reduction
      expect(report.summary.tokenReduction).toBeCloseTo(40, 0);
    });

    it('should recommend continue testing when not significant', () => {
      // Create new experiment with similar metrics
      const newConfig = { ...baseConfig, id: 'test-exp-002' };
      framework.createExperiment(newConfig);

      for (let i = 0; i < 50; i++) {
        const baseCost = 0.010 + (Math.random() * 0.002);
        framework.recordMetrics(newConfig.id, 'control', {
          costPerRequest: baseCost,
          executionTimeMs: 1000,
          tokenUsage: 4000,
          timestamp: new Date()
        });

        framework.recordMetrics(newConfig.id, 'treatment', {
          costPerRequest: baseCost + (Math.random() * 0.001 - 0.0005),
          executionTimeMs: 1000,
          tokenUsage: 4000,
          timestamp: new Date()
        });
      }

      const report = dashboard.generateComparisonReport(newConfig.id);

      expect(report.summary.winner).toBe('inconclusive');
      expect(report.recommendation.action).toBe('continue_testing');
      expect(report.recommendation.reason).toContain('not yet significant');
    });
  });

  describe('Real-time Metrics', () => {
    it('should record real-time snapshot', () => {
      const snapshot = {
        experimentId: baseConfig.id,
        timestamp: new Date(),
        requestsPerMinute: {
          control: 10,
          treatment: 12
        },
        costPerMinute: {
          control: 0.15,
          treatment: 0.10
        },
        currentVariantDistribution: {
          control: 48,
          treatment: 52
        }
      };

      dashboard.recordRealtimeSnapshot(baseConfig.id, snapshot);

      const metrics = dashboard.getRealtimeMetrics(baseConfig.id);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(snapshot);
    });

    it('should keep only last 60 minutes of data', () => {
      // Record 70 snapshots
      for (let i = 0; i < 70; i++) {
        dashboard.recordRealtimeSnapshot(baseConfig.id, {
          experimentId: baseConfig.id,
          timestamp: new Date(),
          requestsPerMinute: { control: 10, treatment: 10 },
          costPerMinute: { control: 0.15, treatment: 0.10 },
          currentVariantDistribution: { control: 50, treatment: 50 }
        });
      }

      const metrics = dashboard.getRealtimeMetrics(baseConfig.id);
      expect(metrics).toHaveLength(60); // Only last 60
    });

    it('should return empty array when no metrics recorded', () => {
      const metrics = dashboard.getRealtimeMetrics(baseConfig.id);
      expect(metrics).toEqual([]);
    });

    it('should limit returned metrics based on minutes parameter', () => {
      // Record 50 snapshots
      for (let i = 0; i < 50; i++) {
        dashboard.recordRealtimeSnapshot(baseConfig.id, {
          experimentId: baseConfig.id,
          timestamp: new Date(),
          requestsPerMinute: { control: 10, treatment: 10 },
          costPerMinute: { control: 0.15, treatment: 0.10 },
          currentVariantDistribution: { control: 50, treatment: 50 }
        });
      }

      const last10 = dashboard.getRealtimeMetrics(baseConfig.id, 10);
      expect(last10).toHaveLength(10);
    });
  });

  describe('Active Experiments', () => {
    it('should return all active experiments summaries', () => {
      const config2 = { ...baseConfig, id: 'exp2', name: 'Experiment 2', active: true };
      const config3 = { ...baseConfig, id: 'exp3', name: 'Experiment 3', active: false };

      framework.createExperiment(config2);
      framework.createExperiment(config3);

      const summaries = dashboard.getAllActiveSummaries();

      expect(summaries).toHaveLength(2); // exp1 and exp2
      expect(summaries.map(s => s.experimentId)).toContain(baseConfig.id);
      expect(summaries.map(s => s.experimentId)).toContain('exp2');
      expect(summaries.map(s => s.experimentId)).not.toContain('exp3');
    });
  });

  describe('Leaderboard', () => {
    beforeEach(() => {
      // Create multiple experiments with different savings
      const config2 = { ...baseConfig, id: 'exp2', name: 'Experiment 2', minimumSampleSize: 30 };
      const config3 = { ...baseConfig, id: 'exp3', name: 'Experiment 3', minimumSampleSize: 30 };

      framework.createExperiment(config2);
      framework.createExperiment(config3);

      // Experiment 1: 50% savings
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.020,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.010, // 50% cheaper
          executionTimeMs: 1000,
          tokenUsage: 3000,
          timestamp: new Date()
        });
      }

      // Experiment 2: 30% savings
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(config2.id, 'control', {
          costPerRequest: 0.020,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
        framework.recordMetrics(config2.id, 'treatment', {
          costPerRequest: 0.014, // 30% cheaper
          executionTimeMs: 1100,
          tokenUsage: 4000,
          timestamp: new Date()
        });
      }

      // Experiment 3: 70% savings
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(config3.id, 'control', {
          costPerRequest: 0.020,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
        framework.recordMetrics(config3.id, 'treatment', {
          costPerRequest: 0.006, // 70% cheaper
          executionTimeMs: 900,
          tokenUsage: 2000,
          timestamp: new Date()
        });
      }
    });

    it('should rank experiments by cost savings', () => {
      const leaderboard = dashboard.generateLeaderboard();

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].experimentId).toBe('exp3'); // 70% savings - rank 1
      expect(leaderboard[1].experimentId).toBe(baseConfig.id); // 50% savings - rank 2
      expect(leaderboard[2].experimentId).toBe('exp2'); // 30% savings - rank 3
    });

    it('should include rank in leaderboard', () => {
      const leaderboard = dashboard.generateLeaderboard();

      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[2].rank).toBe(3);
    });

    it('should exclude experiments without enough data', () => {
      const newConfig = { ...baseConfig, id: 'exp-new', minimumSampleSize: 30 };
      framework.createExperiment(newConfig);

      // Only record 5 metrics (not enough for analysis)
      for (let i = 0; i < 5; i++) {
        framework.recordMetrics(newConfig.id, 'control', {
          costPerRequest: 0.020,
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });
      }

      const leaderboard = dashboard.generateLeaderboard();

      expect(leaderboard.map(e => e.experimentId)).not.toContain('exp-new');
    });
  });

  describe('Projected Savings', () => {
    beforeEach(() => {
      // Setup experiment with known savings
      for (let i = 0; i < 50; i++) {
        framework.recordMetrics(baseConfig.id, 'control', {
          costPerRequest: 0.020, // $0.020 per request
          executionTimeMs: 1200,
          tokenUsage: 5000,
          timestamp: new Date()
        });

        framework.recordMetrics(baseConfig.id, 'treatment', {
          costPerRequest: 0.010, // $0.010 per request (50% cheaper)
          executionTimeMs: 1000,
          tokenUsage: 3000,
          timestamp: new Date()
        });
      }
    });

    it('should calculate projected monthly savings', () => {
      const monthlyVolume = 100000; // 100k requests per month
      const projection = dashboard.calculateProjectedSavings(baseConfig.id, monthlyVolume);

      expect(projection.currentMonthlyCost).toBeCloseTo(2000, 1); // $0.020 × 100k
      expect(projection.projectedMonthlyCost).toBeCloseTo(1000, 1); // $0.010 × 100k
      expect(projection.monthlySavings).toBeCloseTo(1000, 1); // $1000/month
      expect(projection.annualSavings).toBeCloseTo(12000, 1); // $12k/year
    });

    it('should handle zero volume', () => {
      const projection = dashboard.calculateProjectedSavings(baseConfig.id, 0);

      expect(projection.currentMonthlyCost).toBe(0);
      expect(projection.projectedMonthlyCost).toBe(0);
      expect(projection.monthlySavings).toBe(0);
      expect(projection.annualSavings).toBe(0);
    });

    it('should handle large volumes', () => {
      const monthlyVolume = 10000000; // 10M requests per month
      const projection = dashboard.calculateProjectedSavings(baseConfig.id, monthlyVolume);

      expect(projection.currentMonthlyCost).toBeCloseTo(200000, 1); // $200k
      expect(projection.monthlySavings).toBeCloseTo(100000, 1); // $100k/month
      expect(projection.annualSavings).toBeCloseTo(1200000, 1); // $1.2M/year
    });
  });

  describe('Dashboard Data Export', () => {
    beforeEach(() => {
      for (let i = 0; i < 50; i++) {
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

      // Add real-time data
      dashboard.recordRealtimeSnapshot(baseConfig.id, {
        experimentId: baseConfig.id,
        timestamp: new Date(),
        requestsPerMinute: { control: 10, treatment: 12 },
        costPerMinute: { control: 0.15, treatment: 0.10 },
        currentVariantDistribution: { control: 48, treatment: 52 }
      });
    });

    it('should export complete dashboard data', () => {
      const exportData = dashboard.exportDashboardData(baseConfig.id);

      expect(exportData.summary).toBeDefined();
      expect(exportData.comparison).toBeDefined();
      expect(exportData.realtimeMetrics).toBeDefined();
    });

    it('should include all summary fields', () => {
      const exportData = dashboard.exportDashboardData(baseConfig.id);

      expect(exportData.summary.experimentId).toBe(baseConfig.id);
      expect(exportData.summary.sampleSizes.total).toBe(100);
      expect(exportData.summary.currentMetrics).toBeDefined();
    });

    it('should include comparison analysis', () => {
      const exportData = dashboard.exportDashboardData(baseConfig.id);

      expect(exportData.comparison.analysis).toBeDefined();
      expect(exportData.comparison.summary.winner).toBeDefined();
      expect(exportData.comparison.recommendation).toBeDefined();
    });

    it('should include real-time metrics', () => {
      const exportData = dashboard.exportDashboardData(baseConfig.id);

      expect(exportData.realtimeMetrics).toHaveLength(1);
      expect(exportData.realtimeMetrics[0].requestsPerMinute).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent experiment in dashboard summary', () => {
      expect(() => dashboard.getDashboardSummary('non-existent')).toThrow(
        'Experiment non-existent not found'
      );
    });

    it('should throw error for non-existent experiment in comparison report', () => {
      expect(() => dashboard.generateComparisonReport('non-existent')).toThrow();
    });

    it('should throw error when generating report with insufficient data', () => {
      const newConfig = { ...baseConfig, id: 'exp-insufficient' };
      framework.createExperiment(newConfig);

      expect(() => dashboard.generateComparisonReport(newConfig.id)).toThrow(
        /Insufficient sample size/
      );
    });
  });
});
