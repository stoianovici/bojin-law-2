import crypto from 'crypto';

/**
 * Simple logger interface for dependency injection
 */
export interface Logger {
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}

/**
 * Experiment variant types
 */
export type ExperimentVariant = 'control' | 'treatment';

/**
 * User assignment strategy
 */
export type AssignmentStrategy = 'hash' | 'random';

/**
 * Experiment metrics collected per request
 */
export interface ExperimentMetrics {
  costPerRequest: number;
  responseQuality?: number; // Optional manual review score
  executionTimeMs: number;
  tokenUsage: number;
  timestamp: Date;
}

/**
 * Experiment configuration
 */
export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  assignmentStrategy: AssignmentStrategy;
  significanceLevel: number; // P-value threshold (default 0.05)
  minimumSampleSize: number; // Minimum requests before analysis
  startDate: Date;
  endDate?: Date;
  active: boolean;
}

/**
 * Experiment assignment record
 */
export interface ExperimentAssignment {
  experimentId: string;
  userId: string;
  variant: ExperimentVariant;
  assignedAt: Date;
}

/**
 * Experiment results for a single variant
 */
export interface VariantResults {
  variant: ExperimentVariant;
  sampleSize: number;
  metrics: {
    avgCost: number;
    avgExecutionTime: number;
    avgTokenUsage: number;
    avgQuality?: number;
  };
  standardDeviations: {
    cost: number;
    executionTime: number;
    tokenUsage: number;
    quality?: number;
  };
}

/**
 * Statistical analysis results
 */
export interface StatisticalAnalysis {
  experimentId: string;
  control: VariantResults;
  treatment: VariantResults;
  pValue: number;
  significant: boolean;
  confidenceLevel: number;
  relativeDifference: {
    cost: number; // % difference
    executionTime: number;
    tokenUsage: number;
    quality?: number;
  };
  recommendation: 'adopt_treatment' | 'keep_control' | 'continue_testing';
}

/**
 * A/B Test Framework for Skills Experiments
 *
 * Implements user assignment, metric collection, and statistical analysis
 * for comparing control (no skills) vs treatment (with skills) variants.
 */
export class ABTestFramework {
  private experiments: Map<string, ExperimentConfig> = new Map();
  private assignments: Map<string, Map<string, ExperimentAssignment>> = new Map(); // experimentId -> userId -> assignment
  private metrics: Map<string, Map<ExperimentVariant, ExperimentMetrics[]>> = new Map(); // experimentId -> variant -> metrics[]
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create a new experiment
   */
  createExperiment(config: ExperimentConfig): void {
    if (this.experiments.has(config.id)) {
      throw new Error(`Experiment ${config.id} already exists`);
    }

    this.experiments.set(config.id, config);
    this.assignments.set(config.id, new Map());
    this.metrics.set(config.id, new Map([
      ['control', []],
      ['treatment', []]
    ]));

    this.logger.info('Experiment created', {
      experimentId: config.id,
      name: config.name,
      strategy: config.assignmentStrategy
    });
  }

  /**
   * Get experiment configuration
   */
  getExperiment(experimentId: string): ExperimentConfig | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * Assign user to experiment variant
   * Uses consistent hashing for 50/50 split to ensure same user always gets same variant
   */
  assignUser(experimentId: string, userId: string): ExperimentVariant {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (!experiment.active) {
      throw new Error(`Experiment ${experimentId} is not active`);
    }

    // Check if user already assigned
    const experimentAssignments = this.assignments.get(experimentId)!;
    const existingAssignment = experimentAssignments.get(userId);
    if (existingAssignment) {
      return existingAssignment.variant;
    }

    // Assign based on strategy
    let variant: ExperimentVariant;
    if (experiment.assignmentStrategy === 'hash') {
      variant = this.hashAssignment(userId);
    } else {
      variant = this.randomAssignment();
    }

    // Store assignment
    const assignment: ExperimentAssignment = {
      experimentId,
      userId,
      variant,
      assignedAt: new Date()
    };
    experimentAssignments.set(userId, assignment);

    this.logger.debug('User assigned to experiment', {
      experimentId,
      userId,
      variant,
      strategy: experiment.assignmentStrategy
    });

    return variant;
  }

  /**
   * Hash-based user assignment for consistent 50/50 split
   * Same user always gets same variant
   */
  private hashAssignment(userId: string): ExperimentVariant {
    const hash = crypto.createHash('sha256').update(userId).digest('hex');
    const numericHash = parseInt(hash.substring(0, 8), 16);
    return (numericHash % 2 === 0) ? 'control' : 'treatment';
  }

  /**
   * Random assignment for 50/50 split
   * User may get different variant on subsequent requests
   */
  private randomAssignment(): ExperimentVariant {
    return Math.random() < 0.5 ? 'control' : 'treatment';
  }

  /**
   * Record metrics for an experiment request
   */
  recordMetrics(
    experimentId: string,
    variant: ExperimentVariant,
    metrics: ExperimentMetrics
  ): void {
    const experimentMetrics = this.metrics.get(experimentId);
    if (!experimentMetrics) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const variantMetrics = experimentMetrics.get(variant)!;
    variantMetrics.push(metrics);

    this.logger.debug('Metrics recorded', {
      experimentId,
      variant,
      sampleSize: variantMetrics.length,
      cost: metrics.costPerRequest,
      executionTime: metrics.executionTimeMs
    });
  }

  /**
   * Get current sample sizes for an experiment
   */
  getSampleSizes(experimentId: string): { control: number; treatment: number } {
    const experimentMetrics = this.metrics.get(experimentId);
    if (!experimentMetrics) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    return {
      control: experimentMetrics.get('control')!.length,
      treatment: experimentMetrics.get('treatment')!.length
    };
  }

  /**
   * Calculate variant results (mean and standard deviation)
   */
  private calculateVariantResults(
    variant: ExperimentVariant,
    metrics: ExperimentMetrics[]
  ): VariantResults {
    if (metrics.length === 0) {
      throw new Error(`No metrics available for variant ${variant}`);
    }

    // Calculate means
    const avgCost = this.mean(metrics.map(m => m.costPerRequest));
    const avgExecutionTime = this.mean(metrics.map(m => m.executionTimeMs));
    const avgTokenUsage = this.mean(metrics.map(m => m.tokenUsage));
    const qualityMetrics = metrics.filter(m => m.responseQuality !== undefined).map(m => m.responseQuality!);
    const avgQuality = qualityMetrics.length > 0 ? this.mean(qualityMetrics) : undefined;

    // Calculate standard deviations
    const stdCost = this.standardDeviation(metrics.map(m => m.costPerRequest));
    const stdExecutionTime = this.standardDeviation(metrics.map(m => m.executionTimeMs));
    const stdTokenUsage = this.standardDeviation(metrics.map(m => m.tokenUsage));
    const stdQuality = qualityMetrics.length > 0 ? this.standardDeviation(qualityMetrics) : undefined;

    return {
      variant,
      sampleSize: metrics.length,
      metrics: {
        avgCost,
        avgExecutionTime,
        avgTokenUsage,
        avgQuality
      },
      standardDeviations: {
        cost: stdCost,
        executionTime: stdExecutionTime,
        tokenUsage: stdTokenUsage,
        quality: stdQuality
      }
    };
  }

  /**
   * Perform statistical analysis using Welch's t-test
   * Tests if treatment is significantly different from control
   */
  analyzeExperiment(experimentId: string): StatisticalAnalysis {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const experimentMetrics = this.metrics.get(experimentId)!;
    const controlMetrics = experimentMetrics.get('control')!;
    const treatmentMetrics = experimentMetrics.get('treatment')!;

    // Verify minimum sample size
    if (controlMetrics.length < experiment.minimumSampleSize ||
        treatmentMetrics.length < experiment.minimumSampleSize) {
      throw new Error(
        `Insufficient sample size. Need ${experiment.minimumSampleSize}, ` +
        `have control=${controlMetrics.length}, treatment=${treatmentMetrics.length}`
      );
    }

    // Calculate variant results
    const control = this.calculateVariantResults('control', controlMetrics);
    const treatment = this.calculateVariantResults('treatment', treatmentMetrics);

    // Perform Welch's t-test on cost (primary metric)
    const pValue = this.welchTTest(
      controlMetrics.map(m => m.costPerRequest),
      treatmentMetrics.map(m => m.costPerRequest)
    );

    const significant = pValue < experiment.significanceLevel;
    const confidenceLevel = 1 - experiment.significanceLevel;

    // Calculate relative differences (%)
    const relativeDifference = {
      cost: ((treatment.metrics.avgCost - control.metrics.avgCost) / control.metrics.avgCost) * 100,
      executionTime: ((treatment.metrics.avgExecutionTime - control.metrics.avgExecutionTime) / control.metrics.avgExecutionTime) * 100,
      tokenUsage: ((treatment.metrics.avgTokenUsage - control.metrics.avgTokenUsage) / control.metrics.avgTokenUsage) * 100,
      quality: (control.metrics.avgQuality && treatment.metrics.avgQuality)
        ? ((treatment.metrics.avgQuality - control.metrics.avgQuality) / control.metrics.avgQuality) * 100
        : undefined
    };

    // Make recommendation
    let recommendation: StatisticalAnalysis['recommendation'];
    if (!significant) {
      recommendation = 'continue_testing';
    } else if (relativeDifference.cost < -10) { // Treatment is >10% cheaper
      recommendation = 'adopt_treatment';
    } else if (relativeDifference.cost > 10) { // Treatment is >10% more expensive
      recommendation = 'keep_control';
    } else {
      recommendation = 'continue_testing';
    }

    const analysis: StatisticalAnalysis = {
      experimentId,
      control,
      treatment,
      pValue,
      significant,
      confidenceLevel,
      relativeDifference,
      recommendation
    };

    this.logger.info('Experiment analyzed', {
      experimentId,
      pValue,
      significant,
      recommendation,
      costDifference: `${relativeDifference.cost.toFixed(2)}%`
    });

    return analysis;
  }

  /**
   * Calculate mean of values
   */
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const variance = this.mean(squareDiffs);
    return Math.sqrt(variance);
  }

  /**
   * Welch's t-test for unequal variances
   * Returns p-value (two-tailed test)
   */
  private welchTTest(sample1: number[], sample2: number[]): number {
    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const std1 = this.standardDeviation(sample1);
    const std2 = this.standardDeviation(sample2);
    const n1 = sample1.length;
    const n2 = sample2.length;

    // Calculate t-statistic
    const variance1 = Math.pow(std1, 2) / n1;
    const variance2 = Math.pow(std2, 2) / n2;
    const tStat = (mean1 - mean2) / Math.sqrt(variance1 + variance2);

    // Calculate degrees of freedom (Welch-Satterthwaite equation)
    // Using normal approximation for p-value calculation (works well for large samples)
    const _df = Math.pow(variance1 + variance2, 2) / (
      Math.pow(variance1, 2) / (n1 - 1) +
      Math.pow(variance2, 2) / (n2 - 1)
    );

    // Convert t-statistic to p-value (two-tailed)
    // Using approximation: p ≈ 2 * P(T > |t|)
    // For simplicity, using normal approximation (works well for df > 30)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));

    return pValue;
  }

  /**
   * Normal cumulative distribution function (CDF)
   * Approximation using error function
   */
  private normalCDF(x: number): number {
    // Using approximation for standard normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }

  /**
   * Stop an experiment
   */
  stopExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.active = false;
    experiment.endDate = new Date();

    this.logger.info('Experiment stopped', {
      experimentId,
      name: experiment.name,
      endDate: experiment.endDate
    });
  }

  /**
   * Get all active experiments
   */
  getActiveExperiments(): ExperimentConfig[] {
    return Array.from(this.experiments.values()).filter(exp => exp.active);
  }

  /**
   * Export experiment data for external analysis
   */
  exportExperimentData(experimentId: string): {
    config: ExperimentConfig;
    assignments: ExperimentAssignment[];
    metrics: {
      control: ExperimentMetrics[];
      treatment: ExperimentMetrics[];
    };
  } {
    const config = this.experiments.get(experimentId);
    if (!config) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const assignmentMap = this.assignments.get(experimentId)!;
    const assignments = Array.from(assignmentMap.values());

    const metricsMap = this.metrics.get(experimentId)!;
    const metrics = {
      control: metricsMap.get('control')!,
      treatment: metricsMap.get('treatment')!
    };

    return { config, assignments, metrics };
  }
}
