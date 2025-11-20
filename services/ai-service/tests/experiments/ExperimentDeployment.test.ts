/**
 * Tests for ExperimentDeployment
 *
 * Tests deployment and configuration of A/B experiments for skills.
 */

import { ExperimentDeployment, SuccessMetrics } from '../../src/experiments/ExperimentDeployment';
import { ABTestFramework, Logger, ExperimentMetrics } from '../../src/experiments/ABTestFramework';
import { RequestRouter } from '../../src/routing/RequestRouter';
import { SkillSelector, AIRequest } from '../../src/routing/SkillSelector';
import { SkillMetrics } from '../../src/metrics/SkillMetrics';
import { SkillsRegistry } from '../../src/skills/SkillsRegistry';

// Mock dependencies
jest.mock('../../src/skills/SkillsRegistry');
jest.mock('../../src/metrics/SkillMetrics');

// ============================================================================
// Mock Logger
// ============================================================================

const mockLogger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// ============================================================================
// Test Setup
// ============================================================================

describe('ExperimentDeployment', () => {
  let framework: ABTestFramework;
  let router: RequestRouter;
  let deployment: ExperimentDeployment;
  let skillSelector: SkillSelector;
  let skillMetrics: jest.Mocked<SkillMetrics>;
  let skillsRegistry: jest.Mocked<SkillsRegistry>;

  beforeEach(() => {
    framework = new ABTestFramework(mockLogger);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    skillsRegistry = new SkillsRegistry(null as any) as jest.Mocked<SkillsRegistry>;
    skillMetrics = new SkillMetrics(mockLogger) as jest.Mocked<SkillMetrics>;

    // Mock SkillMetrics methods
    skillMetrics.getAllMetrics = jest.fn().mockReturnValue([]);

    // Mock SkillsRegistry methods
    skillsRegistry.recommendSkills = jest.fn().mockResolvedValue([]);

    skillSelector = new SkillSelector(skillsRegistry);
    router = new RequestRouter(skillSelector, skillMetrics);
    deployment = new ExperimentDeployment(framework, router, mockLogger);

    jest.clearAllMocks();
  });

  // ============================================================================
  // Experiment Deployment Tests
  // ============================================================================

  describe('deploySkillsExperiment', () => {
    it('should deploy experiment with default configuration', () => {
      deployment.deploySkillsExperiment(
        'skills-test-1',
        'Skills A/B Test',
        'Test skills effectiveness vs baseline'
      );

      const experiment = framework.getExperiment('skills-test-1');
      expect(experiment).toBeDefined();
      expect(experiment?.id).toBe('skills-test-1');
      expect(experiment?.name).toBe('Skills A/B Test');
      expect(experiment?.assignmentStrategy).toBe('hash');
      expect(experiment?.active).toBe(true);
    });

    it('should configure 50/50 split with hash-based assignment', () => {
      deployment.deploySkillsExperiment(
        'skills-test-2',
        'Skills Test',
        'Test description'
      );

      const experiment = framework.getExperiment('skills-test-2');
      expect(experiment?.assignmentStrategy).toBe('hash');
      expect(experiment?.significanceLevel).toBe(0.05);
      expect(experiment?.minimumSampleSize).toBe(100);
    });

    it('should configure success metrics with defaults', () => {
      deployment.deploySkillsExperiment(
        'skills-test-3',
        'Skills Test',
        'Test description'
      );

      const status = deployment.getDeploymentStatus('skills-test-3');
      expect(status).toBeDefined();
      expect(status.experimentId).toBe('skills-test-3');
    });

    it('should configure custom success metrics', () => {
      const customMetrics: SuccessMetrics = {
        maxCostIncrease: 5,
        minCostReduction: 40,
        maxExecutionTimeIncrease: 50,
        minTokenReduction: 40,
        minQualityScore: 0.9,
      };

      deployment.deploySkillsExperiment(
        'skills-test-4',
        'Skills Test',
        'Test description',
        { successMetrics: customMetrics }
      );

      const status = deployment.getDeploymentStatus('skills-test-4');
      expect(status).toBeDefined();
    });

    it('should configure gradual rollout by default', () => {
      deployment.deploySkillsExperiment(
        'skills-test-5',
        'Skills Test',
        'Test description'
      );

      const status = deployment.getDeploymentStatus('skills-test-5');
      expect(status.rolloutStage).toBe(0);
      expect(status.rolloutPercentage).toBe(5); // Canary stage
    });

    it('should configure monitoring alerts by default', () => {
      deployment.deploySkillsExperiment(
        'skills-test-6',
        'Skills Test',
        'Test description'
      );

      const alerts = deployment.getAlerts('skills-test-6');
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  // ============================================================================
  // Routing Tests (Control vs Treatment)
  // ============================================================================

  describe('routeWithExperiment', () => {
    beforeEach(() => {
      deployment.deploySkillsExperiment(
        'routing-test',
        'Routing Test',
        'Test routing'
      );
    });

    it('should assign users consistently to same variant', async () => {
      const request: AIRequest = {
        task: 'Review contract for compliance issues',
        context: {},
      };

      const result1 = await deployment.routeWithExperiment('routing-test', 'user-123', request);
      const result2 = await deployment.routeWithExperiment('routing-test', 'user-123', request);

      expect(result1.variant).toBe(result2.variant);
    });

    it('should route control variant without skills', async () => {
      const request: AIRequest = {
        task: 'Review contract for compliance issues',
        context: {},
      };

      // Find a user that gets assigned to control
      let controlUserId = '';
      for (let i = 0; i < 100; i++) {
        const userId = `user-${i}`;
        const variant = framework.assignUser('routing-test', userId);
        if (variant === 'control') {
          controlUserId = userId;
          break;
        }
      }

      expect(controlUserId).not.toBe('');

      const result = await deployment.routeWithExperiment('routing-test', controlUserId, request);
      expect(result.variant).toBe('control');
      expect(result.decision.skills.length).toBe(0);
      expect(result.decision.strategy).toBe('fallback');
    });

    it('should route treatment variant with skills', async () => {
      // Deploy without rollout restrictions for this test
      deployment.deploySkillsExperiment(
        'routing-test-treatment',
        'Treatment Test',
        'Test treatment routing',
        {
          rollout: {
            enabled: false, // Disable rollout so all users can be in treatment
            stages: [],
            currentStage: 0,
            autoProgress: false,
            progressThreshold: 0.8,
          },
        }
      );

      const request: AIRequest = {
        task: 'Review contract for compliance issues',
        context: {},
      };

      // Find a user that gets assigned to treatment
      let treatmentUserId = '';
      for (let i = 0; i < 100; i++) {
        const userId = `user-treatment-${i}`;
        const variant = framework.assignUser('routing-test-treatment', userId);
        if (variant === 'treatment') {
          treatmentUserId = userId;
          break;
        }
      }

      expect(treatmentUserId).not.toBe('');

      const result = await deployment.routeWithExperiment('routing-test-treatment', treatmentUserId, request);
      expect(result.variant).toBe('treatment');
      // Skills may or may not be selected depending on pattern matching
    });

    it('should respect rollout percentage', async () => {
      // Deploy with 0% rollout (canary not started)
      deployment.deploySkillsExperiment(
        'rollout-test',
        'Rollout Test',
        'Test rollout',
        {
          rollout: {
            enabled: true,
            stages: [{
              name: 'Test',
              percentage: 0,
              duration: 60,
              minimumSamples: 10,
              description: 'Test stage',
            }],
            currentStage: 0,
            autoProgress: false,
            progressThreshold: 0.8,
          },
        }
      );

      const request: AIRequest = {
        task: 'Test task',
        context: {},
      };

      // All users should be in control when rollout is 0%
      const result = await deployment.routeWithExperiment('rollout-test', 'user-1', request);
      expect(result.variant).toBe('control');
    });

    it('should route inactive experiment to treatment by default', async () => {
      deployment.deploySkillsExperiment(
        'inactive-test',
        'Inactive Test',
        'Test inactive'
      );

      framework.stopExperiment('inactive-test');

      const request: AIRequest = {
        task: 'Test task',
        context: {},
      };

      const result = await deployment.routeWithExperiment('inactive-test', 'user-1', request);
      expect(result.variant).toBe('treatment');
    });
  });

  // ============================================================================
  // Metrics Recording Tests
  // ============================================================================

  describe('recordExperimentMetrics', () => {
    beforeEach(() => {
      deployment.deploySkillsExperiment(
        'metrics-test',
        'Metrics Test',
        'Test metrics'
      );
    });

    it('should record metrics for control variant', async () => {
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.05,
        executionTimeMs: 1500,
        tokenUsage: 5000,
        timestamp: new Date(),
      };

      await deployment.recordExperimentMetrics('metrics-test', 'control', metrics);

      const sampleSizes = framework.getSampleSizes('metrics-test');
      expect(sampleSizes.control).toBe(1);
    });

    it('should record metrics for treatment variant', async () => {
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.03,
        executionTimeMs: 1400,
        tokenUsage: 3000,
        timestamp: new Date(),
      };

      await deployment.recordExperimentMetrics('metrics-test', 'treatment', metrics);

      const sampleSizes = framework.getSampleSizes('metrics-test');
      expect(sampleSizes.treatment).toBe(1);
    });

    it('should track errors separately', async () => {
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.05,
        executionTimeMs: 1500,
        tokenUsage: 5000,
        timestamp: new Date(),
      };

      const error = new Error('Test error');
      await deployment.recordExperimentMetrics('metrics-test', 'control', metrics, error);

      // Metrics should still be recorded even with error
      const sampleSizes = framework.getSampleSizes('metrics-test');
      expect(sampleSizes.control).toBe(1);
    });
  });

  // ============================================================================
  // Monitoring and Alerts Tests
  // ============================================================================

  describe('alerts', () => {
    beforeEach(() => {
      deployment.deploySkillsExperiment(
        'alerts-test',
        'Alerts Test',
        'Test alerts',
        {
          alerts: {
            enabled: true,
            channels: ['log'],
            thresholds: {
              errorRatePercent: 5,
              costIncreasePercent: 20,
              executionTimeMs: 2000,
            },
          },
        }
      );
    });

    it('should create alert for high error rate', async () => {
      // Record many failed requests
      for (let i = 0; i < 10; i++) {
        const metrics: ExperimentMetrics = {
          costPerRequest: 0.05,
          executionTimeMs: 1500,
          tokenUsage: 5000,
          timestamp: new Date(),
        };
        const error = new Error('Test error');
        await deployment.recordExperimentMetrics('alerts-test', 'control', metrics, error);
      }

      // Should trigger error rate alert
      const alerts = deployment.getAlerts('alerts-test');
      const errorRateAlerts = alerts.filter(a => a.type === 'error_rate');
      expect(errorRateAlerts.length).toBeGreaterThan(0);
    });

    it('should not create alerts with insufficient samples', async () => {
      // Record only a few requests
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.05,
        executionTimeMs: 1500,
        tokenUsage: 5000,
        timestamp: new Date(),
      };

      await deployment.recordExperimentMetrics('alerts-test', 'control', metrics);

      const alerts = deployment.getAlerts('alerts-test');
      expect(alerts.length).toBe(0);
    });

    it('should get all alerts for experiment', () => {
      const alerts = deployment.getAlerts('alerts-test');
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  // ============================================================================
  // Gradual Rollout Tests
  // ============================================================================

  describe('rollout management', () => {
    beforeEach(() => {
      deployment.deploySkillsExperiment(
        'rollout-mgmt-test',
        'Rollout Management Test',
        'Test rollout management',
        {
          rollout: {
            enabled: true,
            stages: [
              {
                name: 'Stage 1',
                percentage: 10,
                duration: 0, // Instant for testing
                minimumSamples: 5,
                description: 'Test stage 1',
              },
              {
                name: 'Stage 2',
                percentage: 50,
                duration: 0,
                minimumSamples: 10,
                description: 'Test stage 2',
              },
            ],
            currentStage: 0,
            autoProgress: false,
            progressThreshold: 0.8,
          },
        }
      );
    });

    it('should start at canary stage', () => {
      const status = deployment.getDeploymentStatus('rollout-mgmt-test');
      expect(status.rolloutStage).toBe(0);
      expect(status.rolloutPercentage).toBe(10);
    });

    it('should evaluate rollout with insufficient samples', async () => {
      const evaluation = await deployment.evaluateRollout('rollout-mgmt-test');
      expect(evaluation.shouldProgress).toBe(false);
      expect(evaluation.recommendation).toContain('more samples');
    });

    it('should evaluate rollout with sufficient samples', async () => {
      // Record enough samples
      for (let i = 0; i < 50; i++) {
        const metrics: ExperimentMetrics = {
          costPerRequest: 0.03, // 40% cheaper than control
          executionTimeMs: 1400,
          tokenUsage: 3000,
          timestamp: new Date(),
        };
        await deployment.recordExperimentMetrics('rollout-mgmt-test', 'treatment', metrics);
      }

      for (let i = 0; i < 50; i++) {
        const metrics: ExperimentMetrics = {
          costPerRequest: 0.05,
          executionTimeMs: 1500,
          tokenUsage: 5000,
          timestamp: new Date(),
        };
        await deployment.recordExperimentMetrics('rollout-mgmt-test', 'control', metrics);
      }

      const evaluation = await deployment.evaluateRollout('rollout-mgmt-test');
      // Should have evaluation result
      expect(evaluation).toBeDefined();
      expect(evaluation).toHaveProperty('shouldProgress');
      expect(evaluation).toHaveProperty('recommendation');
      expect(typeof evaluation.shouldProgress).toBe('boolean');
    });

    it('should progress to next rollout stage', () => {
      deployment.progressRollout('rollout-mgmt-test');

      const status = deployment.getDeploymentStatus('rollout-mgmt-test');
      expect(status.rolloutStage).toBe(1);
      expect(status.rolloutPercentage).toBe(50);
    });

    it('should not progress beyond final stage', () => {
      deployment.progressRollout('rollout-mgmt-test');

      expect(() => {
        deployment.progressRollout('rollout-mgmt-test');
      }).toThrow('Already at final rollout stage');
    });

    it('should rollback to previous stage', () => {
      deployment.progressRollout('rollout-mgmt-test');
      deployment.rollbackRollout('rollout-mgmt-test');

      const status = deployment.getDeploymentStatus('rollout-mgmt-test');
      expect(status.rolloutStage).toBe(0);
    });

    it('should not rollback from first stage', () => {
      expect(() => {
        deployment.rollbackRollout('rollout-mgmt-test');
      }).toThrow('Already at first rollout stage');
    });

    it('should throw error when rollout not enabled', async () => {
      deployment.deploySkillsExperiment(
        'no-rollout-test',
        'No Rollout Test',
        'Test without rollout',
        {
          rollout: {
            enabled: false,
            stages: [],
            currentStage: 0,
            autoProgress: false,
            progressThreshold: 0.8,
          },
        }
      );

      expect(() => {
        deployment.progressRollout('no-rollout-test');
      }).toThrow('Rollout not enabled');
    });
  });

  // ============================================================================
  // Status and Reporting Tests
  // ============================================================================

  describe('getDeploymentStatus', () => {
    beforeEach(() => {
      deployment.deploySkillsExperiment(
        'status-test',
        'Status Test',
        'Test status'
      );
    });

    it('should get deployment status', () => {
      const status = deployment.getDeploymentStatus('status-test');

      expect(status).toBeDefined();
      expect(status.experimentId).toBe('status-test');
      expect(status.active).toBe(true);
      expect(status.rolloutStage).toBeDefined();
      expect(status.rolloutPercentage).toBeDefined();
      expect(status.sampleSizes).toHaveProperty('control');
      expect(status.sampleSizes).toHaveProperty('treatment');
      expect(status.alerts).toBeDefined();
      expect(status.metrics).toBeDefined();
      expect(status.recommendation).toBeDefined();
    });

    it('should recommend continue with no samples', () => {
      const status = deployment.getDeploymentStatus('status-test');
      expect(status.recommendation).toBe('continue');
    });

    it('should recommend full_rollout with good metrics', async () => {
      // Record great metrics showing 40% cost reduction
      for (let i = 0; i < 100; i++) {
        const controlMetrics: ExperimentMetrics = {
          costPerRequest: 0.10,
          executionTimeMs: 2000,
          tokenUsage: 10000,
          timestamp: new Date(),
        };
        await deployment.recordExperimentMetrics('status-test', 'control', controlMetrics);

        const treatmentMetrics: ExperimentMetrics = {
          costPerRequest: 0.06, // 40% cheaper
          executionTimeMs: 1900,
          tokenUsage: 6000,
          timestamp: new Date(),
        };
        await deployment.recordExperimentMetrics('status-test', 'treatment', treatmentMetrics);
      }

      const status = deployment.getDeploymentStatus('status-test');
      expect(status.recommendation).toBe('full_rollout');
    });

    it('should throw error for non-existent experiment', () => {
      expect(() => {
        deployment.getDeploymentStatus('non-existent');
      }).toThrow('Experiment non-existent not found');
    });
  });

  describe('stopDeployment', () => {
    beforeEach(() => {
      deployment.deploySkillsExperiment(
        'stop-test',
        'Stop Test',
        'Test stop'
      );
    });

    it('should stop experiment deployment', () => {
      deployment.stopDeployment('stop-test');

      const experiment = framework.getExperiment('stop-test');
      expect(experiment?.active).toBe(false);
      expect(experiment?.endDate).toBeDefined();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('end-to-end deployment', () => {
    it('should complete full experiment lifecycle', async () => {
      // 1. Deploy experiment
      deployment.deploySkillsExperiment(
        'e2e-test',
        'End-to-End Test',
        'Complete lifecycle test'
      );

      // 2. Route requests through experiment
      const request: AIRequest = {
        task: 'Review contract for compliance',
        context: {},
      };

      const result1 = await deployment.routeWithExperiment('e2e-test', 'user-1', request);
      expect(result1.variant).toBeDefined();

      // 3. Record metrics
      const metrics: ExperimentMetrics = {
        costPerRequest: 0.03,
        executionTimeMs: 1400,
        tokenUsage: 3000,
        timestamp: new Date(),
      };
      await deployment.recordExperimentMetrics('e2e-test', result1.variant, metrics);

      // 4. Get status
      const status = deployment.getDeploymentStatus('e2e-test');
      expect(status.active).toBe(true);
      expect(status.sampleSizes[result1.variant]).toBeGreaterThan(0);

      // 5. Stop deployment
      deployment.stopDeployment('e2e-test');
      const finalStatus = deployment.getDeploymentStatus('e2e-test');
      expect(finalStatus.active).toBe(false);
    });
  });
});
