import { ABTestFramework, StatisticalAnalysis, Logger } from './ABTestFramework';

/**
 * Dashboard metrics summary
 */
export interface DashboardSummary {
  experimentId: string;
  experimentName: string;
  status: 'active' | 'completed';
  startDate: Date;
  endDate?: Date;
  sampleSizes: {
    control: number;
    treatment: number;
    total: number;
  };
  currentMetrics: {
    control: VariantMetricsSummary;
    treatment: VariantMetricsSummary;
  };
  progress: {
    percentComplete: number; // Based on minimum sample size
    daysRunning: number;
  };
}

/**
 * Variant metrics summary for dashboard
 */
export interface VariantMetricsSummary {
  avgCostPerRequest: number;
  avgExecutionTimeMs: number;
  avgTokenUsage: number;
  avgQuality?: number;
  totalRequests: number;
}

/**
 * Real-time experiment metrics
 */
export interface RealtimeMetrics {
  experimentId: string;
  timestamp: Date;
  requestsPerMinute: {
    control: number;
    treatment: number;
  };
  costPerMinute: {
    control: number;
    treatment: number;
  };
  currentVariantDistribution: {
    control: number; // percentage
    treatment: number; // percentage
  };
}

/**
 * Experiment comparison report
 */
export interface ComparisonReport {
  experimentId: string;
  analysis: StatisticalAnalysis;
  summary: {
    winner: 'control' | 'treatment' | 'inconclusive';
    costSavings: number; // % savings (negative if treatment more expensive)
    speedImprovement: number; // % improvement (negative if slower)
    tokenReduction: number; // % reduction (negative if more tokens)
    confidenceLevel: number;
  };
  recommendation: {
    action: 'adopt_treatment' | 'keep_control' | 'continue_testing';
    reason: string;
  };
}

/**
 * Experiment Dashboard
 *
 * Provides data aggregation and visualization support for A/B test experiments
 */
export class ExperimentDashboard {
  private framework: ABTestFramework;
  private logger: Logger;
  private realtimeData: Map<string, RealtimeMetrics[]> = new Map();

  constructor(framework: ABTestFramework, logger: Logger) {
    this.framework = framework;
    this.logger = logger;
  }

  /**
   * Get dashboard summary for an experiment
   */
  getDashboardSummary(experimentId: string): DashboardSummary {
    const experiment = this.framework.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const sampleSizes = this.framework.getSampleSizes(experimentId);
    const exportData = this.framework.exportExperimentData(experimentId);

    // Calculate current metrics for each variant
    const controlMetrics = this.calculateVariantSummary(exportData.metrics.control);
    const treatmentMetrics = this.calculateVariantSummary(exportData.metrics.treatment);

    // Calculate progress
    const totalSamples = sampleSizes.control + sampleSizes.treatment;
    const targetSamples = experiment.minimumSampleSize * 2; // Both variants need minimum
    const percentComplete = Math.min(100, (totalSamples / targetSamples) * 100);

    const now = new Date();
    const daysRunning = Math.floor((now.getTime() - experiment.startDate.getTime()) / (1000 * 60 * 60 * 24));

    const summary: DashboardSummary = {
      experimentId,
      experimentName: experiment.name,
      status: experiment.active ? 'active' : 'completed',
      startDate: experiment.startDate,
      endDate: experiment.endDate,
      sampleSizes: {
        control: sampleSizes.control,
        treatment: sampleSizes.treatment,
        total: totalSamples
      },
      currentMetrics: {
        control: controlMetrics,
        treatment: treatmentMetrics
      },
      progress: {
        percentComplete,
        daysRunning
      }
    };

    return summary;
  }

  /**
   * Calculate variant metrics summary
   */
  private calculateVariantSummary(metrics: any[]): VariantMetricsSummary {
    if (metrics.length === 0) {
      return {
        avgCostPerRequest: 0,
        avgExecutionTimeMs: 0,
        avgTokenUsage: 0,
        totalRequests: 0
      };
    }

    const avgCost = metrics.reduce((sum, m) => sum + m.costPerRequest, 0) / metrics.length;
    const avgTime = metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / metrics.length;
    const avgTokens = metrics.reduce((sum, m) => sum + m.tokenUsage, 0) / metrics.length;

    const qualityMetrics = metrics.filter(m => m.responseQuality !== undefined);
    const avgQuality = qualityMetrics.length > 0
      ? qualityMetrics.reduce((sum, m) => sum + m.responseQuality!, 0) / qualityMetrics.length
      : undefined;

    return {
      avgCostPerRequest: avgCost,
      avgExecutionTimeMs: avgTime,
      avgTokenUsage: avgTokens,
      avgQuality,
      totalRequests: metrics.length
    };
  }

  /**
   * Generate comparison report with analysis
   */
  generateComparisonReport(experimentId: string): ComparisonReport {
    const analysis = this.framework.analyzeExperiment(experimentId);

    // Determine winner
    let winner: 'control' | 'treatment' | 'inconclusive';
    if (!analysis.significant) {
      winner = 'inconclusive';
    } else if (analysis.relativeDifference.cost < 0) {
      // Treatment is cheaper
      winner = 'treatment';
    } else {
      winner = 'control';
    }

    // Calculate summary metrics (treatment vs control)
    const costSavings = -analysis.relativeDifference.cost; // Negative difference = savings
    const speedImprovement = -analysis.relativeDifference.executionTime; // Negative = faster
    const tokenReduction = -analysis.relativeDifference.tokenUsage; // Negative = fewer tokens

    // Generate recommendation
    let action: ComparisonReport['recommendation']['action'];
    let reason: string;

    if (analysis.recommendation === 'adopt_treatment') {
      action = 'adopt_treatment';
      reason = `Treatment shows significant cost savings (${costSavings.toFixed(2)}%) with p-value ${analysis.pValue.toFixed(4)}`;
    } else if (analysis.recommendation === 'keep_control') {
      action = 'keep_control';
      reason = `Control performs better. Treatment increases cost by ${(-costSavings).toFixed(2)}%`;
    } else {
      action = 'continue_testing';
      reason = `Results not yet significant (p-value ${analysis.pValue.toFixed(4)}). Continue testing to reach ${(analysis.confidenceLevel * 100)}% confidence.`;
    }

    const report: ComparisonReport = {
      experimentId,
      analysis,
      summary: {
        winner,
        costSavings,
        speedImprovement,
        tokenReduction,
        confidenceLevel: analysis.confidenceLevel
      },
      recommendation: {
        action,
        reason
      }
    };

    this.logger.info('Comparison report generated', {
      experimentId,
      winner,
      costSavings: `${costSavings.toFixed(2)}%`,
      recommendation: action
    });

    return report;
  }

  /**
   * Record real-time metrics snapshot
   */
  recordRealtimeSnapshot(experimentId: string, metrics: RealtimeMetrics): void {
    if (!this.realtimeData.has(experimentId)) {
      this.realtimeData.set(experimentId, []);
    }

    const snapshots = this.realtimeData.get(experimentId)!;
    snapshots.push(metrics);

    // Keep only last 60 minutes of data (1 minute intervals)
    if (snapshots.length > 60) {
      snapshots.shift();
    }
  }

  /**
   * Get real-time metrics for the last N minutes
   */
  getRealtimeMetrics(experimentId: string, minutes: number = 60): RealtimeMetrics[] {
    const snapshots = this.realtimeData.get(experimentId) || [];
    return snapshots.slice(-minutes);
  }

  /**
   * Get all active experiments summaries
   */
  getAllActiveSummaries(): DashboardSummary[] {
    const activeExperiments = this.framework.getActiveExperiments();
    return activeExperiments.map(exp => this.getDashboardSummary(exp.id));
  }

  /**
   * Generate experiment leaderboard
   * Ranks experiments by cost savings potential
   */
  generateLeaderboard(): Array<{
    experimentId: string;
    experimentName: string;
    costSavings: number;
    confidence: number;
    status: 'active' | 'completed';
    rank: number;
  }> {
    const experiments = this.framework.getActiveExperiments();
    const leaderboard = experiments
      .map(exp => {
        try {
          const report = this.generateComparisonReport(exp.id);
          return {
            experimentId: exp.id,
            experimentName: exp.name,
            costSavings: report.summary.costSavings,
            confidence: report.summary.confidenceLevel,
            status: exp.active ? 'active' as const : 'completed' as const
          };
        } catch (_error) {
          // Experiment not ready for analysis yet
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.costSavings - a.costSavings)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    return leaderboard;
  }

  /**
   * Calculate projected monthly savings based on current experiment results
   */
  calculateProjectedSavings(experimentId: string, monthlyRequestVolume: number): {
    currentMonthlyCost: number;
    projectedMonthlyCost: number;
    monthlySavings: number;
    annualSavings: number;
  } {
    // Validate experiment has sufficient data for analysis
    this.generateComparisonReport(experimentId);
    const summary = this.getDashboardSummary(experimentId);

    const currentCostPerRequest = summary.currentMetrics.control.avgCostPerRequest;
    const projectedCostPerRequest = summary.currentMetrics.treatment.avgCostPerRequest;

    const currentMonthlyCost = currentCostPerRequest * monthlyRequestVolume;
    const projectedMonthlyCost = projectedCostPerRequest * monthlyRequestVolume;
    const monthlySavings = currentMonthlyCost - projectedMonthlyCost;
    const annualSavings = monthlySavings * 12;

    this.logger.info('Projected savings calculated', {
      experimentId,
      monthlyVolume: monthlyRequestVolume,
      monthlySavings,
      annualSavings
    });

    return {
      currentMonthlyCost,
      projectedMonthlyCost,
      monthlySavings,
      annualSavings
    };
  }

  /**
   * Export dashboard data as JSON for external visualization
   */
  exportDashboardData(experimentId: string): {
    summary: DashboardSummary;
    comparison: ComparisonReport;
    realtimeMetrics: RealtimeMetrics[];
  } {
    return {
      summary: this.getDashboardSummary(experimentId),
      comparison: this.generateComparisonReport(experimentId),
      realtimeMetrics: this.getRealtimeMetrics(experimentId)
    };
  }
}
