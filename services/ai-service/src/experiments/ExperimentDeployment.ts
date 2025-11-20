/**
 * Experiment Deployment
 *
 * Manages the deployment and configuration of A/B experiments for skills:
 * - 50/50 split test configuration
 * - Control (no skills) vs Treatment (with skills) setup
 * - Success metrics definition
 * - Monitoring alerts
 * - Gradual rollout logic (canary deployment)
 */

import { ABTestFramework, ExperimentConfig, ExperimentMetrics, ExperimentVariant, Logger } from './ABTestFramework';
import { RequestRouter, RoutingDecision } from '../routing/RequestRouter';
import { AIRequest } from '../routing/SkillSelector';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Experiment success metrics thresholds
 */
export interface SuccessMetrics {
  maxCostIncrease: number;        // Maximum acceptable cost increase (%)
  minCostReduction: number;        // Minimum required cost reduction (%)
  maxExecutionTimeIncrease: number; // Maximum acceptable time increase (ms)
  minTokenReduction: number;       // Minimum required token reduction (%)
  minQualityScore?: number;        // Minimum quality score (optional)
}

/**
 * Gradual rollout configuration
 */
export interface RolloutConfig {
  enabled: boolean;
  stages: RolloutStage[];
  currentStage: number;
  autoProgress: boolean;          // Automatically progress to next stage
  progressThreshold: number;      // Success threshold to progress (0-1)
}

/**
 * Rollout stage definition
 */
export interface RolloutStage {
  name: string;
  percentage: number;             // Percentage of users in treatment (0-100)
  duration: number;               // Duration in minutes
  minimumSamples: number;         // Minimum samples before evaluation
  description: string;
}

/**
 * Monitoring alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  thresholds: {
    errorRatePercent: number;     // Alert if error rate exceeds this
    costIncreasePercent: number;  // Alert if cost increases beyond this
    executionTimeMs: number;      // Alert if execution time exceeds this
  };
}

/**
 * Alert channel types
 */
export type AlertChannel = 'log' | 'email' | 'slack' | 'webhook';

/**
 * Alert notification
 */
export interface Alert {
  id: string;
  experimentId: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'error_rate' | 'cost_increase' | 'execution_time' | 'quality_degradation';
  message: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

/**
 * Experiment deployment status
 */
export interface DeploymentStatus {
  experimentId: string;
  active: boolean;
  rolloutStage: number;
  rolloutPercentage: number;
  sampleSizes: { control: number; treatment: number };
  alerts: Alert[];
  metrics: {
    avgCost: { control: number; treatment: number };
    avgExecutionTime: { control: number; treatment: number };
    errorRate: { control: number; treatment: number };
  };
  recommendation: 'continue' | 'stop' | 'rollback' | 'full_rollout';
}

// ============================================================================
// ExperimentDeployment Class
// ============================================================================

export class ExperimentDeployment {
  private readonly framework: ABTestFramework;
  private readonly router: RequestRouter;
  private readonly logger: Logger;

  // Experiment configurations
  private successMetrics: Map<string, SuccessMetrics> = new Map();
  private rolloutConfigs: Map<string, RolloutConfig> = new Map();
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private alerts: Map<string, Alert[]> = new Map();

  // Deployment tracking
  private rolloutStartTimes: Map<string, Date> = new Map();
  private errorCounts: Map<string, Map<ExperimentVariant, number>> = new Map();

  constructor(framework: ABTestFramework, router: RequestRouter, logger: Logger) {
    this.framework = framework;
    this.router = router;
    this.logger = logger;
  }

  // ============================================================================
  // Public Methods - Experiment Deployment
  // ============================================================================

  /**
   * Deploy a new skills experiment with 50/50 split
   */
  deploySkillsExperiment(
    experimentId: string,
    name: string,
    description: string,
    options?: {
      successMetrics?: SuccessMetrics;
      rollout?: Partial<RolloutConfig>;
      alerts?: Partial<AlertConfig>;
    }
  ): void {
    // Create experiment configuration (50/50 split with hash-based assignment)
    const config: ExperimentConfig = {
      id: experimentId,
      name,
      description,
      assignmentStrategy: 'hash', // Consistent user assignment
      significanceLevel: 0.05,    // 95% confidence
      minimumSampleSize: 100,     // Minimum 100 samples per variant
      startDate: new Date(),
      active: true,
    };

    // Create experiment in framework
    this.framework.createExperiment(config);

    // Configure success metrics (defaults from story AC#10)
    const successMetrics: SuccessMetrics = {
      maxCostIncrease: 10,        // Max 10% cost increase
      minCostReduction: 35,        // Target 35% cost reduction (AC#10)
      maxExecutionTimeIncrease: 100, // Max 100ms overhead (AC#8)
      minTokenReduction: 30,       // Min 30% token reduction
      minQualityScore: 0.8,        // Min 80% quality score
      ...options?.successMetrics,
    };
    this.successMetrics.set(experimentId, successMetrics);

    // Configure gradual rollout (canary deployment)
    const rolloutConfig: RolloutConfig = {
      enabled: true,
      stages: this.getDefaultRolloutStages(),
      currentStage: 0,
      autoProgress: true,
      progressThreshold: 0.8, // 80% success rate to progress
      ...options?.rollout,
    };
    this.rolloutConfigs.set(experimentId, rolloutConfig);

    // Configure monitoring alerts
    const alertConfig: AlertConfig = {
      enabled: true,
      channels: ['log'],
      thresholds: {
        errorRatePercent: 5,      // Alert if >5% error rate
        costIncreasePercent: 20,   // Alert if >20% cost increase
        executionTimeMs: 5000,     // Alert if >5s execution time
      },
      ...options?.alerts,
    };
    this.alertConfigs.set(experimentId, alertConfig);

    // Initialize tracking
    this.errorCounts.set(experimentId, new Map([
      ['control', 0],
      ['treatment', 0],
    ]));
    this.alerts.set(experimentId, []);
    this.rolloutStartTimes.set(experimentId, new Date());

    this.logger.info('Skills experiment deployed', {
      experimentId,
      name,
      rolloutEnabled: rolloutConfig.enabled,
      currentStage: rolloutConfig.stages.length > 0 ? rolloutConfig.stages[0].name : 'None',
    });
  }

  /**
   * Get default rollout stages for gradual deployment
   */
  private getDefaultRolloutStages(): RolloutStage[] {
    return [
      {
        name: 'Canary',
        percentage: 5,              // Start with 5% of users
        duration: 60,               // 1 hour
        minimumSamples: 50,
        description: 'Initial canary deployment to detect critical issues',
      },
      {
        name: 'Small Rollout',
        percentage: 25,             // Expand to 25% of users
        duration: 180,              // 3 hours
        minimumSamples: 200,
        description: 'Small-scale rollout to validate metrics',
      },
      {
        name: 'Half Rollout',
        percentage: 50,             // 50% of users (standard A/B test)
        duration: 720,              // 12 hours
        minimumSamples: 500,
        description: 'Half rollout for full A/B test comparison',
      },
      {
        name: 'Full Rollout',
        percentage: 100,            // All users
        duration: -1,               // Indefinite
        minimumSamples: 1000,
        description: 'Full deployment after successful validation',
      },
    ];
  }

  /**
   * Route request through experiment
   * Returns routing decision based on assigned variant
   */
  async routeWithExperiment(
    experimentId: string,
    userId: string,
    request: AIRequest
  ): Promise<{ variant: ExperimentVariant; decision: RoutingDecision }> {
    // Check if experiment is active
    const experiment = this.framework.getExperiment(experimentId);
    if (!experiment || !experiment.active) {
      // No active experiment - use normal routing with skills
      const decision = await this.router.route(request);
      return { variant: 'treatment', decision };
    }

    // Check rollout percentage
    const rolloutConfig = this.rolloutConfigs.get(experimentId);
    if (rolloutConfig && rolloutConfig.enabled) {
      const currentStage = rolloutConfig.stages[rolloutConfig.currentStage];
      const shouldParticipate = this.shouldParticipateInRollout(userId, currentStage.percentage);

      if (!shouldParticipate) {
        // User not in rollout - use control (no skills)
        const decision = await this.routeWithoutSkills(request);
        return { variant: 'control', decision };
      }
    }

    // Assign user to variant
    const variant = this.framework.assignUser(experimentId, userId);

    // Route based on variant
    let decision: RoutingDecision;
    if (variant === 'control') {
      // Control: Route WITHOUT skills
      decision = await this.routeWithoutSkills(request);
    } else {
      // Treatment: Route WITH skills
      decision = await this.router.route(request);
    }

    this.logger.debug('Request routed through experiment', {
      experimentId,
      userId,
      variant,
      model: decision.model,
      skillsUsed: decision.skills.length,
    });

    return { variant, decision };
  }

  /**
   * Route request without skills (control variant)
   */
  private async routeWithoutSkills(request: AIRequest): Promise<RoutingDecision> {
    // Get routing decision from router
    const decision = await this.router.route(request);

    // Override to ensure no skills are used (control variant)
    return {
      ...decision,
      skills: [],
      strategy: 'fallback',
      reasoning: `Control variant: ${decision.reasoning} (without skills)`,
    };
  }

  /**
   * Determine if user should participate in rollout based on percentage
   */
  private shouldParticipateInRollout(userId: string, percentage: number): boolean {
    if (percentage >= 100) {
      return true;
    }

    // Use hash of userId to determine participation (consistent across requests)
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(userId).digest('hex');
    const numericHash = parseInt(hash.substring(0, 8), 16);
    const userPercentile = (numericHash % 100);

    return userPercentile < percentage;
  }

  /**
   * Record experiment metrics after request completion
   */
  async recordExperimentMetrics(
    experimentId: string,
    variant: ExperimentVariant,
    metrics: ExperimentMetrics,
    error?: Error
  ): Promise<void> {
    // Record metrics in framework
    this.framework.recordMetrics(experimentId, variant, metrics);

    // Track errors
    if (error) {
      const errorCount = this.errorCounts.get(experimentId)!;
      errorCount.set(variant, errorCount.get(variant)! + 1);
    }

    // Check for alerts
    await this.checkAlerts(experimentId);

    this.logger.debug('Experiment metrics recorded', {
      experimentId,
      variant,
      cost: metrics.costPerRequest,
      executionTime: metrics.executionTimeMs,
      hasError: !!error,
    });
  }

  // ============================================================================
  // Public Methods - Monitoring and Alerts
  // ============================================================================

  /**
   * Check if any alert thresholds are exceeded
   */
  private async checkAlerts(experimentId: string): Promise<void> {
    const alertConfig = this.alertConfigs.get(experimentId);
    if (!alertConfig || !alertConfig.enabled) {
      return;
    }

    const sampleSizes = this.framework.getSampleSizes(experimentId);
    const totalSamples = sampleSizes.control + sampleSizes.treatment;

    if (totalSamples < 10) {
      return; // Not enough samples yet
    }

    // Check error rate
    const errorCounts = this.errorCounts.get(experimentId)!;
    const totalErrors = errorCounts.get('control')! + errorCounts.get('treatment')!;
    const errorRate = (totalErrors / totalSamples) * 100;

    if (errorRate > alertConfig.thresholds.errorRatePercent) {
      this.createAlert(experimentId, {
        severity: 'critical',
        type: 'error_rate',
        message: `Error rate (${errorRate.toFixed(1)}%) exceeds threshold (${alertConfig.thresholds.errorRatePercent}%)`,
        data: { errorRate, threshold: alertConfig.thresholds.errorRatePercent },
      });
    }

    // Check if enough samples to analyze
    const experiment = this.framework.getExperiment(experimentId)!;
    if (sampleSizes.control >= experiment.minimumSampleSize &&
        sampleSizes.treatment >= experiment.minimumSampleSize) {

      try {
        const analysis = this.framework.analyzeExperiment(experimentId);

        // Check cost increase
        if (analysis.relativeDifference.cost > alertConfig.thresholds.costIncreasePercent) {
          this.createAlert(experimentId, {
            severity: 'warning',
            type: 'cost_increase',
            message: `Cost increase (${analysis.relativeDifference.cost.toFixed(1)}%) exceeds threshold (${alertConfig.thresholds.costIncreasePercent}%)`,
            data: { costDifference: analysis.relativeDifference.cost },
          });
        }

        // Check execution time
        if (analysis.treatment.metrics.avgExecutionTime > alertConfig.thresholds.executionTimeMs) {
          this.createAlert(experimentId, {
            severity: 'warning',
            type: 'execution_time',
            message: `Execution time (${analysis.treatment.metrics.avgExecutionTime.toFixed(0)}ms) exceeds threshold (${alertConfig.thresholds.executionTimeMs}ms)`,
            data: { executionTime: analysis.treatment.metrics.avgExecutionTime },
          });
        }
      } catch (_error) {
        // Not enough samples for analysis yet
        this.logger.debug('Cannot analyze experiment yet', { experimentId });
      }
    }
  }

  /**
   * Create and emit an alert
   */
  private createAlert(
    experimentId: string,
    alert: Omit<Alert, 'id' | 'experimentId' | 'timestamp'>
  ): void {
    const fullAlert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      experimentId,
      timestamp: new Date(),
      ...alert,
    };

    // Store alert
    const experimentAlerts = this.alerts.get(experimentId)!;
    experimentAlerts.push(fullAlert);

    // Emit alert to configured channels
    const alertConfig = this.alertConfigs.get(experimentId)!;
    this.emitAlert(fullAlert, alertConfig.channels);
  }

  /**
   * Emit alert to configured channels
   */
  private emitAlert(alert: Alert, channels: AlertChannel[]): void {
    for (const channel of channels) {
      switch (channel) {
        case 'log':
          this.logger.warn(`[ALERT] ${alert.type}: ${alert.message}`, alert.data);
          break;
        case 'email':
          // TODO: Implement email notification
          this.logger.info('Email alert not implemented', { alert });
          break;
        case 'slack':
          // TODO: Implement Slack notification
          this.logger.info('Slack alert not implemented', { alert });
          break;
        case 'webhook':
          // TODO: Implement webhook notification
          this.logger.info('Webhook alert not implemented', { alert });
          break;
      }
    }
  }

  /**
   * Get all alerts for an experiment
   */
  getAlerts(experimentId: string): Alert[] {
    return this.alerts.get(experimentId) || [];
  }

  // ============================================================================
  // Public Methods - Rollout Management
  // ============================================================================

  /**
   * Evaluate rollout stage and potentially progress to next stage
   */
  async evaluateRollout(experimentId: string): Promise<{
    shouldProgress: boolean;
    currentStage: RolloutStage;
    recommendation: string;
  }> {
    const rolloutConfig = this.rolloutConfigs.get(experimentId);
    if (!rolloutConfig || !rolloutConfig.enabled) {
      return {
        shouldProgress: false,
        currentStage: { name: 'None', percentage: 100, duration: -1, minimumSamples: 0, description: 'Rollout not enabled' },
        recommendation: 'Rollout not enabled',
      };
    }

    const currentStage = rolloutConfig.stages[rolloutConfig.currentStage];
    const sampleSizes = this.framework.getSampleSizes(experimentId);

    // Check if enough samples collected
    if (sampleSizes.treatment < currentStage.minimumSamples) {
      return {
        shouldProgress: false,
        currentStage,
        recommendation: `Need ${currentStage.minimumSamples - sampleSizes.treatment} more samples`,
      };
    }

    // Check if stage duration has passed
    const startTime = this.rolloutStartTimes.get(experimentId)!;
    const elapsedMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
    if (currentStage.duration > 0 && elapsedMinutes < currentStage.duration) {
      return {
        shouldProgress: false,
        currentStage,
        recommendation: `Stage duration not completed (${elapsedMinutes.toFixed(0)}/${currentStage.duration} minutes)`,
      };
    }

    // Evaluate metrics
    try {
      const analysis = this.framework.analyzeExperiment(experimentId);
      const successMetrics = this.successMetrics.get(experimentId)!;

      // Check if metrics meet success criteria
      const meetsSuccessCriteria =
        analysis.relativeDifference.cost <= -successMetrics.minCostReduction &&
        analysis.treatment.metrics.avgExecutionTime <= successMetrics.maxExecutionTimeIncrease;

      if (meetsSuccessCriteria && rolloutConfig.autoProgress) {
        return {
          shouldProgress: true,
          currentStage,
          recommendation: 'Metrics meet success criteria - ready to progress',
        };
      } else {
        return {
          shouldProgress: false,
          currentStage,
          recommendation: `Metrics do not meet criteria: cost reduction ${analysis.relativeDifference.cost.toFixed(1)}% (target: -${successMetrics.minCostReduction}%)`,
        };
      }
    } catch (_error) {
      return {
        shouldProgress: false,
        currentStage,
        recommendation: 'Insufficient samples for analysis',
      };
    }
  }

  /**
   * Progress to next rollout stage
   */
  progressRollout(experimentId: string): void {
    const rolloutConfig = this.rolloutConfigs.get(experimentId);
    if (!rolloutConfig || !rolloutConfig.enabled) {
      throw new Error(`Rollout not enabled for experiment ${experimentId}`);
    }

    if (rolloutConfig.currentStage >= rolloutConfig.stages.length - 1) {
      throw new Error(`Already at final rollout stage for experiment ${experimentId}`);
    }

    rolloutConfig.currentStage += 1;
    this.rolloutStartTimes.set(experimentId, new Date());

    const newStage = rolloutConfig.stages[rolloutConfig.currentStage];
    this.logger.info('Rollout progressed to next stage', {
      experimentId,
      stage: newStage.name,
      percentage: newStage.percentage,
    });
  }

  /**
   * Rollback to previous rollout stage
   */
  rollbackRollout(experimentId: string): void {
    const rolloutConfig = this.rolloutConfigs.get(experimentId);
    if (!rolloutConfig || !rolloutConfig.enabled) {
      throw new Error(`Rollout not enabled for experiment ${experimentId}`);
    }

    if (rolloutConfig.currentStage === 0) {
      throw new Error(`Already at first rollout stage for experiment ${experimentId}`);
    }

    rolloutConfig.currentStage -= 1;
    this.rolloutStartTimes.set(experimentId, new Date());

    const newStage = rolloutConfig.stages[rolloutConfig.currentStage];
    this.logger.warn('Rollout rolled back to previous stage', {
      experimentId,
      stage: newStage.name,
      percentage: newStage.percentage,
    });
  }

  // ============================================================================
  // Public Methods - Status and Reporting
  // ============================================================================

  /**
   * Get deployment status for an experiment
   */
  getDeploymentStatus(experimentId: string): DeploymentStatus {
    const experiment = this.framework.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const rolloutConfig = this.rolloutConfigs.get(experimentId);
    const sampleSizes = this.framework.getSampleSizes(experimentId);
    const alerts = this.getAlerts(experimentId);

    let metrics = {
      avgCost: { control: 0, treatment: 0 },
      avgExecutionTime: { control: 0, treatment: 0 },
      errorRate: { control: 0, treatment: 0 },
    };

    let recommendation: DeploymentStatus['recommendation'] = 'continue';

    // Try to get analysis if enough samples
    if (sampleSizes.control >= experiment.minimumSampleSize &&
        sampleSizes.treatment >= experiment.minimumSampleSize) {
      try {
        const analysis = this.framework.analyzeExperiment(experimentId);

        metrics = {
          avgCost: {
            control: analysis.control.metrics.avgCost,
            treatment: analysis.treatment.metrics.avgCost,
          },
          avgExecutionTime: {
            control: analysis.control.metrics.avgExecutionTime,
            treatment: analysis.treatment.metrics.avgExecutionTime,
          },
          errorRate: { control: 0, treatment: 0 }, // TODO: Calculate from error counts
        };

        // Determine recommendation
        const successMetrics = this.successMetrics.get(experimentId)!;
        if (analysis.relativeDifference.cost <= -successMetrics.minCostReduction) {
          recommendation = 'full_rollout';
        } else if (analysis.relativeDifference.cost > successMetrics.maxCostIncrease) {
          recommendation = 'rollback';
        } else if (alerts.some(a => a.severity === 'critical')) {
          recommendation = 'stop';
        }
      } catch (_error) {
        // Not enough samples yet
      }
    }

    return {
      experimentId,
      active: experiment.active,
      rolloutStage: rolloutConfig?.currentStage || 0,
      rolloutPercentage: rolloutConfig?.stages[rolloutConfig.currentStage]?.percentage || 100,
      sampleSizes,
      alerts,
      metrics,
      recommendation,
    };
  }

  /**
   * Stop experiment deployment
   */
  stopDeployment(experimentId: string): void {
    this.framework.stopExperiment(experimentId);

    this.logger.info('Experiment deployment stopped', {
      experimentId,
    });
  }
}
