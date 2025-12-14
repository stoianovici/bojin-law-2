// @ts-nocheck
/**
 * Dashboard Export Service
 * Story 5.7: Platform Intelligence Dashboard - Task 7
 *
 * Exports platform intelligence dashboard to various formats (AC: 1-6)
 *
 * Business Logic:
 * - Generates PDF, Excel, or CSV exports
 * - Uploads to R2 storage with 24-hour expiry
 * - Returns signed URL for download
 * - Rate limited to 10 exports per hour per firm
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import Redis from 'ioredis';
import type {
  ExportOptions,
  ExportResult,
  ExportFormat,
  ExportSection,
  PlatformDateRange,
  PlatformIntelligenceDashboard,
} from '@legal-platform/types';
import { getPlatformIntelligenceService, PlatformIntelligenceService } from './platform-intelligence.service';
import { R2StorageService, getR2StorageService } from './r2-storage.service';

// Export rate limit: 10 per hour per firm
const EXPORT_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

// URL expiry: 24 hours
const URL_EXPIRY_HOURS = 24;

/**
 * Dashboard Export Service
 * Generates and stores dashboard exports
 */
export class DashboardExportService {
  private prisma: PrismaClientType;
  private redis: Redis | null = null;
  private platformService: PlatformIntelligenceService;
  private r2Service: R2StorageService;

  constructor(
    prismaClient?: PrismaClientType,
    redisClient?: Redis,
    platformService?: PlatformIntelligenceService,
    r2Service?: R2StorageService
  ) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }

    if (redisClient) {
      this.redis = redisClient;
    } else {
      try {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          this.redis = new Redis(redisUrl);
        }
      } catch {
        // Redis not available
      }
    }

    this.platformService = platformService ?? getPlatformIntelligenceService();
    this.r2Service = r2Service ?? getR2StorageService();
  }

  /**
   * Export dashboard to specified format
   */
  async exportDashboard(
    firmId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Check rate limit
    await this.checkRateLimit(firmId);

    // Get dashboard data
    const dashboard = await this.platformService.getDashboard(firmId, options.dateRange);

    // Filter sections if specified
    const filteredData = options.sections
      ? this.filterSections(dashboard, options.sections)
      : dashboard;

    // Generate export based on format
    let content: Buffer;
    let contentType: string;
    let extension: string;

    switch (options.format) {
      case 'pdf':
        content = await this.generatePDF(filteredData);
        contentType = 'application/pdf';
        extension = 'pdf';
        break;
      case 'excel':
        content = await this.generateExcel(filteredData);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      case 'csv':
        content = await this.generateCSV(filteredData);
        contentType = 'text/csv';
        extension = 'csv';
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    // Upload to R2
    const filename = `platform-intelligence-${firmId}-${Date.now()}.${extension}`;
    const path = `exports/${firmId}/${filename}`;

    const url = await this.r2Service.uploadFile(path, content, contentType, {
      expiresIn: URL_EXPIRY_HOURS * 3600,
    });

    // Increment rate limit counter
    await this.incrementRateLimit(firmId);

    return {
      url,
      expiresAt: new Date(Date.now() + URL_EXPIRY_HOURS * 60 * 60 * 1000),
      format: options.format,
    };
  }

  /**
   * Filter dashboard to include only specified sections
   */
  private filterSections(
    dashboard: PlatformIntelligenceDashboard,
    sections: ExportSection[]
  ): Partial<PlatformIntelligenceDashboard> {
    const filtered: Partial<PlatformIntelligenceDashboard> = {
      dateRange: dashboard.dateRange,
      firmId: dashboard.firmId,
      generatedAt: dashboard.generatedAt,
      platformHealthScore: dashboard.platformHealthScore,
      recommendations: dashboard.recommendations,
    };

    if (sections.includes('efficiency')) {
      filtered.efficiency = dashboard.efficiency;
    }
    if (sections.includes('communication')) {
      filtered.communication = dashboard.communication;
    }
    if (sections.includes('quality')) {
      filtered.documentQuality = dashboard.documentQuality;
    }
    if (sections.includes('tasks')) {
      filtered.taskCompletion = dashboard.taskCompletion;
    }
    if (sections.includes('ai')) {
      filtered.aiUtilization = dashboard.aiUtilization;
    }
    if (sections.includes('roi')) {
      filtered.roi = dashboard.roi;
    }

    return filtered;
  }

  /**
   * Generate PDF export
   * Note: Full implementation would use puppeteer or pdfkit
   */
  private async generatePDF(
    data: Partial<PlatformIntelligenceDashboard>
  ): Promise<Buffer> {
    // Create a simple text-based PDF for now
    // In production, this would use puppeteer to render HTML or pdfkit for native PDF
    const content = this.generateTextReport(data);

    // Minimal PDF structure
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${content.length + 50} >>
stream
BT
/F1 10 Tf
50 750 Td
${content.split('\n').map((line, i) => `(${line.replace(/[()\\]/g, '\\$&')}) Tj 0 -12 Td`).join('\n')}
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
%%EOF`;

    return Buffer.from(pdfContent, 'utf-8');
  }

  /**
   * Generate Excel export
   * Note: Full implementation would use xlsx library
   */
  private async generateExcel(
    data: Partial<PlatformIntelligenceDashboard>
  ): Promise<Buffer> {
    // For now, generate CSV content (xlsx library would be used in production)
    return this.generateCSV(data);
  }

  /**
   * Generate CSV export
   */
  private async generateCSV(
    data: Partial<PlatformIntelligenceDashboard>
  ): Promise<Buffer> {
    const lines: string[] = [];

    // Header
    lines.push('Platform Intelligence Dashboard Export');
    lines.push(`Generated: ${data.generatedAt?.toISOString()}`);
    lines.push(`Date Range: ${data.dateRange?.startDate.toISOString()} to ${data.dateRange?.endDate.toISOString()}`);
    lines.push(`Health Score: ${data.platformHealthScore}`);
    lines.push('');

    // Efficiency Metrics
    if (data.efficiency) {
      lines.push('EFFICIENCY METRICS');
      lines.push('Metric,Value');
      lines.push(`Time Saved (hours),${data.efficiency.totalTimeSavedHours}`);
      lines.push(`AI Assisted Actions,${data.efficiency.aiAssistedActions}`);
      lines.push(`Automation Triggers,${data.efficiency.automationTriggers}`);
      lines.push(`Manual vs Automated Ratio,${data.efficiency.manualVsAutomatedRatio}`);
      lines.push('');
    }

    // Communication Analytics
    if (data.communication) {
      lines.push('COMMUNICATION ANALYTICS');
      lines.push('Metric,Value');
      lines.push(`Avg Response Time (hours),${data.communication.currentResponseTime.avgResponseTimeHours}`);
      lines.push(`Median Response Time (hours),${data.communication.currentResponseTime.medianResponseTimeHours}`);
      lines.push(`P90 Response Time (hours),${data.communication.currentResponseTime.p90ResponseTimeHours}`);
      lines.push(`Emails Analyzed,${data.communication.currentResponseTime.totalEmailsAnalyzed}`);
      lines.push(`Within SLA %,${data.communication.currentResponseTime.withinSLAPercent}`);
      if (data.communication.baselineComparison) {
        lines.push(`Improvement %,${data.communication.baselineComparison.improvementPercent}`);
      }
      lines.push('');
    }

    // Document Quality
    if (data.documentQuality) {
      lines.push('DOCUMENT QUALITY');
      lines.push('Metric,Value');
      lines.push(`Documents Created,${data.documentQuality.revisionMetrics.totalDocumentsCreated}`);
      lines.push(`Avg Revisions,${data.documentQuality.revisionMetrics.avgRevisionsPerDocument}`);
      lines.push(`First Time Right %,${data.documentQuality.revisionMetrics.firstTimeRightPercent}`);
      lines.push(`Reviews Completed,${data.documentQuality.errorMetrics.totalReviewsCompleted}`);
      lines.push(`Reviews with Issues,${data.documentQuality.errorMetrics.reviewsWithIssues}`);
      lines.push('');
    }

    // Task Completion
    if (data.taskCompletion) {
      lines.push('TASK COMPLETION');
      lines.push('Metric,Value');
      lines.push(`Completion Rate %,${data.taskCompletion.completionRate}`);
      lines.push(`Deadline Adherence %,${data.taskCompletion.deadlineAdherence}`);
      lines.push(`Avg Completion Time (hours),${data.taskCompletion.avgCompletionTimeHours}`);
      lines.push(`Overdue Count,${data.taskCompletion.overdueCount}`);
      lines.push('');
    }

    // AI Utilization
    if (data.aiUtilization) {
      lines.push('AI UTILIZATION');
      lines.push('Metric,Value');
      lines.push(`Total Requests,${data.aiUtilization.firmTotal.totalRequests}`);
      lines.push(`Total Tokens,${data.aiUtilization.firmTotal.totalTokens}`);
      lines.push(`Total Cost (cents),${data.aiUtilization.firmTotal.totalCostCents}`);
      lines.push(`Avg Requests/User,${data.aiUtilization.firmTotal.avgRequestsPerUser}`);
      lines.push('');
      lines.push('User,Requests,Tokens,Adoption Score');
      for (const user of data.aiUtilization.byUser) {
        lines.push(`${user.userName},${user.totalRequests},${user.totalTokens},${user.adoptionScore}`);
      }
      lines.push('');
    }

    // ROI
    if (data.roi) {
      lines.push('ROI SUMMARY');
      lines.push('Metric,Value');
      lines.push(`Total Value Saved,${data.roi.totalValueSaved}`);
      lines.push(`Billable Hours Recovered,${data.roi.billableHoursRecovered}`);
      lines.push(`Projected Annual Savings,${data.roi.projectedAnnualSavings}`);
      lines.push('');
    }

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS');
      lines.push('Priority,Category,Message');
      for (const rec of data.recommendations) {
        lines.push(`${rec.priority},${rec.category},"${rec.message.replace(/"/g, '""')}"`);
      }
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Generate text report for PDF
   */
  private generateTextReport(data: Partial<PlatformIntelligenceDashboard>): string {
    const lines: string[] = [];

    lines.push('Platform Intelligence Dashboard');
    lines.push(`Health Score: ${data.platformHealthScore}`);
    lines.push('');

    if (data.efficiency) {
      lines.push(`Time Saved: ${data.efficiency.totalTimeSavedHours} hours`);
    }

    if (data.communication) {
      lines.push(`Avg Response: ${data.communication.currentResponseTime.avgResponseTimeHours} hours`);
    }

    if (data.documentQuality) {
      lines.push(`First Time Right: ${data.documentQuality.revisionMetrics.firstTimeRightPercent}%`);
    }

    if (data.taskCompletion) {
      lines.push(`Completion Rate: ${data.taskCompletion.completionRate}%`);
    }

    if (data.roi) {
      lines.push(`Value Saved: ${data.roi.totalValueSaved}`);
    }

    return lines.join('\n');
  }

  /**
   * Check rate limit for exports
   */
  private async checkRateLimit(firmId: string): Promise<void> {
    if (!this.redis) return;

    const key = `export:ratelimit:${firmId}`;
    const count = await this.redis.get(key);

    if (count && parseInt(count, 10) >= EXPORT_RATE_LIMIT) {
      throw new Error(`Export rate limit exceeded. Maximum ${EXPORT_RATE_LIMIT} exports per hour.`);
    }
  }

  /**
   * Increment rate limit counter
   */
  private async incrementRateLimit(firmId: string): Promise<void> {
    if (!this.redis) return;

    const key = `export:ratelimit:${firmId}`;
    const exists = await this.redis.exists(key);

    if (exists) {
      await this.redis.incr(key);
    } else {
      await this.redis.setex(key, RATE_LIMIT_WINDOW_SECONDS, '1');
    }
  }
}

// Export singleton
let serviceInstance: DashboardExportService | null = null;

export function getDashboardExportService(): DashboardExportService {
  if (!serviceInstance) {
    serviceInstance = new DashboardExportService();
  }
  return serviceInstance;
}

export default DashboardExportService;
