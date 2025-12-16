/**
 * Template Usage Tracking Service
 * Story 2.12.1 - AC6: Feedback Loop Implementation
 * Story 2.15: Refactored with Dependency Injection
 *
 * Tracks template usage, measures effectiveness, calculates ROI,
 * and generates reports for template optimization
 */

import { getDefaultDatabaseClient } from '@/lib/database/client';
import type {
  CreateTemplateUsageLog,
  RomanianTemplate,
  DatabaseClient,
} from '@legal-platform/types';

export interface UsageStatistics {
  templateId: string;
  templateName: string;
  totalUses: number;
  successRate: number;
  avgTimeSaved: number;
  totalTimeSaved: number;
  estimatedROI: number;
  lastUsed: Date | null;
}

export interface ROICalculation {
  templateId: string;
  templateName: string;
  actualROI: number;
  estimatedROI: number;
  variance: number; // percentage difference
  totalValueGenerated: number; // in hours saved
  costToMaintain: number; // estimated hours
  netValue: number;
}

export interface TemplateForReview {
  templateId: string;
  templateName: string;
  reason: 'low_usage' | 'high_failure_rate' | 'outdated' | 'user_feedback';
  priority: 'low' | 'medium' | 'high';
  metrics: {
    usageCount: number;
    successRate: number;
    daysSinceLastUse: number;
  };
}

export interface EffectivenessReport {
  periodStart: Date;
  periodEnd: Date;
  totalTemplates: number;
  totalUsages: number;
  totalTimeSaved: number;
  averageSuccessRate: number;
  topPerformers: UsageStatistics[];
  needsAttention: TemplateForReview[];
  recommendations: string[];
}

/**
 * Template Usage Tracking Service
 * Implements feedback loop for template optimization
 */
export class TemplateUsageTrackingService {
  private db: DatabaseClient;

  /**
   * Constructor with dependency injection support
   * @param db Database client (defaults to production PostgreSQL client)
   */
  constructor(db?: DatabaseClient) {
    this.db = db || getDefaultDatabaseClient();
  }

  /**
   * Track a template usage event
   * AC6: Track template usage frequency
   */
  async trackUsage(log: CreateTemplateUsageLog): Promise<void> {
    await this.db.query(
      `INSERT INTO template_usage_logs (
        template_id,
        user_id,
        execution_time_ms,
        time_saved_minutes,
        variables_provided,
        output_format,
        success,
        error_message,
        used_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        log.template_id,
        log.user_id || null,
        log.execution_time_ms || null,
        log.time_saved_minutes || null,
        JSON.stringify(log.variables_provided),
        log.output_format || null,
        log.success,
        log.error_message || null,
      ]
    );
  }

  /**
   * Measure time saved per template use
   * AC6: Measure time saved per template use
   */
  async measureTimeSaved(templateId: string, startTime: Date, endTime: Date): Promise<number> {
    // Get template metadata to estimate manual time
    const template = await this.getTemplateMetadata(templateId);
    if (!template) return 0;

    // Actual time taken (in minutes)
    const actualTime = (endTime.getTime() - startTime.getTime()) / 60000;

    // Estimated manual time based on template complexity
    const manualTime = this.estimateManualTime(template);

    // Time saved = manual time - actual time
    const timeSaved = Math.max(manualTime - actualTime, 0);

    return Math.round(timeSaved);
  }

  /**
   * Estimate manual drafting time for a template
   */
  private estimateManualTime(template: RomanianTemplate): number {
    // Base time: 60 minutes
    let baseTime = 60;

    // Adjust for complexity (stored in metadata)
    const metadata = template.variable_mappings as any;
    if (metadata?.complexity === 'high') baseTime *= 1.5;
    if (metadata?.complexity === 'low') baseTime *= 0.7;

    // Adjust for document length
    if (metadata?.averageLength) {
      baseTime = metadata.averageLength * 30; // 30 min per page
    }

    return Math.round(baseTime);
  }

  /**
   * Get template metadata from database
   */
  private async getTemplateMetadata(templateId: string): Promise<RomanianTemplate | null> {
    const result = await this.db.query<RomanianTemplate>(
      'SELECT * FROM romanian_templates WHERE id = $1',
      [templateId]
    );
    return result.rows[0] || null;
  }

  /**
   * Calculate actual vs estimated ROI
   * AC6: Calculate actual vs. estimated ROI
   */
  async calculateROI(templateId: string, periodDays: number = 30): Promise<ROICalculation> {
    // Get template info
    const template = await this.getTemplateMetadata(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Get usage statistics for period
    const stats = await this.getUsageStatistics(templateId, periodDays);

    // Calculate actual ROI (based on real usage data)
    const actualTimeSaved = stats.totalTimeSaved; // in minutes
    const actualValueGenerated = actualTimeSaved / 60; // in hours

    // Estimated ROI (from template metadata)
    const estimatedTimeSavingsPerUse = template.avg_time_savings_minutes || 60;
    const estimatedValueGenerated = (stats.totalUses * estimatedTimeSavingsPerUse) / 60;

    // Cost to maintain (estimated 2 hours per month for updates)
    const costToMaintain = 2;

    // Net value = value generated - cost to maintain
    const actualNetValue = actualValueGenerated - costToMaintain;
    const estimatedNetValue = estimatedValueGenerated - costToMaintain;

    // ROI percentage: (net value / cost) * 100
    const actualROI = costToMaintain > 0 ? (actualNetValue / costToMaintain) * 100 : 0;
    const estimatedROI = costToMaintain > 0 ? (estimatedNetValue / costToMaintain) * 100 : 0;

    // Variance between actual and estimated
    const variance = estimatedROI !== 0 ? ((actualROI - estimatedROI) / estimatedROI) * 100 : 0;

    return {
      templateId,
      templateName: `${template.template_name_ro} / ${template.template_name_en}`,
      actualROI: Math.round(actualROI),
      estimatedROI: Math.round(estimatedROI),
      variance: Math.round(variance),
      totalValueGenerated: Math.round(actualValueGenerated * 10) / 10,
      costToMaintain,
      netValue: Math.round(actualNetValue * 10) / 10,
    };
  }

  /**
   * Get usage statistics for a template
   */
  private async getUsageStatistics(
    templateId: string,
    periodDays: number
  ): Promise<UsageStatistics> {
    const result = await this.db.query<{
      total_uses: string;
      success_count: string;
      avg_time_saved: string;
      total_time_saved: string;
      last_used: Date;
    }>(
      `SELECT
        COUNT(*) as total_uses,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
        AVG(time_saved_minutes) as avg_time_saved,
        SUM(time_saved_minutes) as total_time_saved,
        MAX(used_at) as last_used
      FROM template_usage_logs
      WHERE template_id = $1
        AND used_at >= NOW() - INTERVAL '${periodDays} days'`,
      [templateId]
    );

    const row = result.rows[0];
    const totalUses = parseInt(row?.total_uses || '0');
    const successCount = parseInt(row?.success_count || '0');

    return {
      templateId,
      templateName: '',
      totalUses,
      successRate: totalUses > 0 ? (successCount / totalUses) * 100 : 0,
      avgTimeSaved: parseFloat(row?.avg_time_saved || '0'),
      totalTimeSaved: parseFloat(row?.total_time_saved || '0'),
      estimatedROI: 0,
      lastUsed: row?.last_used || null,
    };
  }

  /**
   * Identify templates needing updates
   * AC6: Identify templates needing updates
   */
  async identifyTemplatesNeedingUpdates(): Promise<TemplateForReview[]> {
    const templatesForReview: TemplateForReview[] = [];

    // Get all templates
    const templates = await this.db.query<RomanianTemplate>('SELECT * FROM romanian_templates');

    for (const template of templates.rows) {
      const stats = await this.getUsageStatistics(template.id, 90); // 90 days

      // Check for low usage (< 5 uses in 90 days)
      if (stats.totalUses < 5) {
        templatesForReview.push({
          templateId: template.id,
          templateName: template.template_name_ro,
          reason: 'low_usage',
          priority: 'medium',
          metrics: {
            usageCount: stats.totalUses,
            successRate: stats.successRate,
            daysSinceLastUse: stats.lastUsed
              ? Math.floor((Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24))
              : 999,
          },
        });
      }

      // Check for high failure rate (< 70% success)
      if (stats.totalUses >= 5 && stats.successRate < 70) {
        templatesForReview.push({
          templateId: template.id,
          templateName: template.template_name_ro,
          reason: 'high_failure_rate',
          priority: 'high',
          metrics: {
            usageCount: stats.totalUses,
            successRate: stats.successRate,
            daysSinceLastUse: stats.lastUsed
              ? Math.floor((Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24))
              : 999,
          },
        });
      }

      // Check for outdated (not used in 60+ days but had previous usage)
      if (stats.lastUsed) {
        const daysSinceLastUse = Math.floor(
          (Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceLastUse > 60 && stats.totalUses > 0) {
          templatesForReview.push({
            templateId: template.id,
            templateName: template.template_name_ro,
            reason: 'outdated',
            priority: 'low',
            metrics: {
              usageCount: stats.totalUses,
              successRate: stats.successRate,
              daysSinceLastUse,
            },
          });
        }
      }
    }

    return templatesForReview;
  }

  /**
   * Queue low-usage templates for review
   * AC6: Queue low-usage templates for review
   */
  async queueForReview(template: TemplateForReview): Promise<void> {
    // Insert into review queue (using metadata for now, could be separate table)
    await this.db.query(
      `UPDATE romanian_templates
      SET variable_mappings = jsonb_set(
        variable_mappings,
        '{reviewQueue}',
        $2::jsonb
      )
      WHERE id = $1`,
      [
        template.templateId,
        JSON.stringify({
          queuedAt: new Date().toISOString(),
          reason: template.reason,
          priority: template.priority,
          metrics: template.metrics,
        }),
      ]
    );
  }

  /**
   * Generate monthly effectiveness report
   * AC6: Generate monthly effectiveness reports
   */
  async generateEffectivenessReport(startDate: Date, endDate: Date): Promise<EffectivenessReport> {
    // Get all template usage for period
    const usageResult = await this.db.query<{
      template_id: string;
      total_uses: string;
      success_count: string;
      total_time_saved: string;
    }>(
      `SELECT
        template_id,
        COUNT(*) as total_uses,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count,
        SUM(time_saved_minutes) as total_time_saved
      FROM template_usage_logs
      WHERE used_at >= $1 AND used_at <= $2
      GROUP BY template_id`,
      [startDate, endDate]
    );

    // Calculate aggregate statistics
    const totalUsages = usageResult.rows.reduce((sum, row) => sum + parseInt(row.total_uses), 0);
    const totalTimeSaved = usageResult.rows.reduce(
      (sum, row) => sum + parseFloat(row.total_time_saved || '0'),
      0
    );

    // Get all templates
    const templatesResult = await this.db.query<RomanianTemplate>(
      'SELECT * FROM romanian_templates'
    );
    const totalTemplates = templatesResult.rows.length;

    // Build per-template statistics
    const templateStats: UsageStatistics[] = [];
    for (const row of usageResult.rows) {
      const template = templatesResult.rows.find((t) => t.id === row.template_id);
      if (!template) continue;

      const totalUses = parseInt(row.total_uses);
      const successCount = parseInt(row.success_count);

      templateStats.push({
        templateId: row.template_id,
        templateName: template.template_name_ro,
        totalUses,
        successRate: (successCount / totalUses) * 100,
        avgTimeSaved: parseFloat(row.total_time_saved) / totalUses,
        totalTimeSaved: parseFloat(row.total_time_saved || '0'),
        estimatedROI: 0,
        lastUsed: null,
      });
    }

    // Sort by usage and get top performers
    const topPerformers = templateStats.sort((a, b) => b.totalUses - a.totalUses).slice(0, 5);

    // Calculate average success rate
    const averageSuccessRate =
      templateStats.length > 0
        ? templateStats.reduce((sum, s) => sum + s.successRate, 0) / templateStats.length
        : 0;

    // Identify templates needing attention
    const needsAttention = await this.identifyTemplatesNeedingUpdates();

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      templateStats,
      needsAttention,
      totalTimeSaved
    );

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totalTemplates,
      totalUsages,
      totalTimeSaved: Math.round(totalTimeSaved),
      averageSuccessRate: Math.round(averageSuccessRate),
      topPerformers,
      needsAttention,
      recommendations,
    };
  }

  /**
   * Generate actionable recommendations based on report data
   */
  private generateRecommendations(
    stats: UsageStatistics[],
    needsAttention: TemplateForReview[],
    totalTimeSaved: number
  ): string[] {
    const recommendations: string[] = [];

    // High-value templates
    const highValueTemplates = stats.filter((s) => s.totalTimeSaved > 300); // 5+ hours
    if (highValueTemplates.length > 0) {
      recommendations.push(
        `${highValueTemplates.length} template(s) are high-value (>5 hours saved). Consider creating similar templates.`
      );
    }

    // Low usage templates
    const lowUsage = needsAttention.filter((t) => t.reason === 'low_usage');
    if (lowUsage.length > 0) {
      recommendations.push(
        `${lowUsage.length} template(s) have low usage. Consider user training or template improvements.`
      );
    }

    // High failure rate
    const highFailure = needsAttention.filter((t) => t.reason === 'high_failure_rate');
    if (highFailure.length > 0) {
      recommendations.push(
        `${highFailure.length} template(s) have high failure rates. Review template structure and variables.`
      );
    }

    // Overall productivity
    const hoursPerMonth = totalTimeSaved / 60;
    if (hoursPerMonth > 40) {
      recommendations.push(
        `Templates saved ${Math.round(hoursPerMonth)} hours this period - excellent ROI!`
      );
    } else if (hoursPerMonth < 10) {
      recommendations.push(
        `Templates saved only ${Math.round(hoursPerMonth)} hours. Consider expanding template library.`
      );
    }

    return recommendations;
  }

  /**
   * Get all templates queued for review
   */
  async getReviewQueue(): Promise<TemplateForReview[]> {
    const result = await this.db.query<RomanianTemplate & { review_queue: any }>(
      `SELECT id, template_name_ro, template_name_en, variable_mappings->'reviewQueue' as review_queue
      FROM romanian_templates
      WHERE variable_mappings->'reviewQueue' IS NOT NULL`
    );

    return result.rows.map((row) => {
      const reviewData = row.review_queue;
      return {
        templateId: row.id,
        templateName: row.template_name_ro,
        reason: reviewData.reason,
        priority: reviewData.priority,
        metrics: reviewData.metrics,
      };
    });
  }
}
