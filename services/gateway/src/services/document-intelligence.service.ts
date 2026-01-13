/**
 * Document Intelligence Analytics Service
 * Story 3.7: AI Document Intelligence Dashboard
 *
 * Provides comprehensive analytics for document creation patterns, AI usage,
 * error detection, time savings, template usage, and quality trends.
 *
 * Authorization: Partner, BusinessOwner, or Admin roles
 * Data isolation: All queries filtered by firmId
 */

import { prisma } from '@legal-platform/database';
import { ConcernType, ConcernSeverity } from '@prisma/client';
import type {
  DocumentVelocityStats,
  AIUtilizationStats,
  ErrorDetectionStats,
  TimeSavingsStats,
  TemplateUsageStats,
  DocumentQualityTrends,
  DocumentIntelligenceDashboard,
  DocumentIntelligenceFilters,
  UserDocumentVelocity,
  DocumentTypeVelocity,
  UserAIUtilization,
  AdoptionTrendPoint,
  SeverityBreakdown,
  ConcernTypeBreakdown,
  ErrorDetectionTrendPoint,
} from '@legal-platform/types';
import type { Context } from '../graphql/resolvers/case.resolvers';

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const dashboardCache = new Map<string, CacheEntry<DocumentIntelligenceDashboard>>();
const metricsCache = new Map<string, CacheEntry<unknown>>();

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const METRICS_CACHE_TTL_MS = 1 * 60 * 1000; // 1 minute

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of dashboardCache.entries()) {
    if (entry.expiry < now) {
      dashboardCache.delete(key);
    }
  }
  for (const [key, entry] of metricsCache.entries()) {
    if (entry.expiry < now) {
      metricsCache.delete(key);
    }
  }
}

setInterval(cleanExpiredCache, 60 * 1000);

export function clearDocumentIntelligenceCache(): void {
  dashboardCache.clear();
  metricsCache.clear();
}

// ============================================================================
// Service Implementation
// ============================================================================

export class DocumentIntelligenceService {
  private context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  private getFirmId(): string {
    const user = this.context.user;
    if (!user?.firmId) {
      throw new Error('User must belong to a firm');
    }
    return user.firmId;
  }

  private getCacheKey(type: string, filters: DocumentIntelligenceFilters): string {
    const firmId = this.getFirmId();
    const filtersStr = JSON.stringify({
      start: filters.dateRange.startDate,
      end: filters.dateRange.endDate,
      users: filters.userIds,
      types: filters.documentTypes,
    });
    return `doc-intel:${type}:${firmId}:${filtersStr}`;
  }

  // ============================================================================
  // Main Dashboard Query
  // ============================================================================

  async getDashboardMetrics(
    filters: DocumentIntelligenceFilters
  ): Promise<DocumentIntelligenceDashboard> {
    const cacheKey = this.getCacheKey('dashboard', filters);
    const cached = dashboardCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Calculate all metrics in parallel
    const [velocity, aiUtilization, errorDetection, timeSavings, templateUsage, qualityTrends] =
      await Promise.all([
        this.getDocumentVelocityStats(filters),
        this.getAIUtilizationStats(filters),
        this.getErrorDetectionStats(filters),
        this.getTimeSavingsStats(filters),
        this.getTemplateUsageStats(filters),
        this.getDocumentQualityTrends(filters),
      ]);

    const result: DocumentIntelligenceDashboard = {
      dateRange: {
        startDate: new Date(filters.dateRange.startDate),
        endDate: new Date(filters.dateRange.endDate),
      },
      velocity,
      aiUtilization,
      errorDetection,
      timeSavings,
      templateUsage,
      qualityTrends,
      lastUpdated: new Date(),
    };

    dashboardCache.set(cacheKey, {
      data: result,
      expiry: Date.now() + DASHBOARD_CACHE_TTL_MS,
    });

    return result;
  }

  // ============================================================================
  // Document Velocity Stats (AC: 1)
  // ============================================================================

  async getDocumentVelocityStats(
    filters: DocumentIntelligenceFilters
  ): Promise<DocumentVelocityStats> {
    const cacheKey = this.getCacheKey('velocity', filters);
    const cached = metricsCache.get(cacheKey) as CacheEntry<DocumentVelocityStats> | undefined;
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const firmId = this.getFirmId();
    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    // Get documents in the date range
    const documents = await prisma.document.findMany({
      where: {
        firmId,
        uploadedAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(filters.userIds?.length ? { uploadedBy: { in: filters.userIds } } : {}),
        ...(filters.documentTypes?.length ? { fileType: { in: filters.documentTypes } } : {}),
      },
      select: {
        id: true,
        uploadedBy: true,
        fileType: true,
        uploadedAt: true,
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Calculate days in range
    const daysInRange = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Group by user
    const userMap = new Map<
      string,
      { name: string; role: string; count: number; userId: string }
    >();
    for (const doc of documents) {
      const userId = doc.uploadedBy;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          name: `${doc.uploader.firstName} ${doc.uploader.lastName}`,
          role: doc.uploader.role,
          count: 0,
        });
      }
      userMap.get(userId)!.count++;
    }

    const byUser: UserDocumentVelocity[] = Array.from(userMap.values()).map((u) => ({
      userId: u.userId,
      userName: u.name,
      userRole: u.role,
      documentCount: u.count,
      averagePerWeek: (u.count / daysInRange) * 7,
      trend: 0, // Would need previous period comparison
    }));

    // Group by document type
    const typeMap = new Map<string, number>();
    for (const doc of documents) {
      const type = doc.fileType || 'Other';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    }

    // Note: DocumentDraftMetrics model has been removed
    // Average creation time data is no longer available
    const byType: DocumentTypeVelocity[] = Array.from(typeMap.entries()).map(([type, count]) => {
      return {
        documentType: type,
        documentCount: count,
        averageCreationTimeMinutes: 0, // No longer tracked
        trend: 0,
      };
    });

    // Calculate previous period for trend (if enabled)
    let trendPercentage = 0;
    if (filters.compareWithPrevious !== false) {
      const periodLength = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodLength);
      const prevEndDate = startDate;

      const prevCount = await prisma.document.count({
        where: {
          firmId,
          uploadedAt: {
            gte: prevStartDate,
            lt: prevEndDate,
          },
        },
      });

      if (prevCount > 0) {
        trendPercentage = ((documents.length - prevCount) / prevCount) * 100;
      }
    }

    const result: DocumentVelocityStats = {
      byUser: byUser.sort((a, b) => b.documentCount - a.documentCount).slice(0, 10),
      byType: byType.sort((a, b) => b.documentCount - a.documentCount),
      totalDocuments: documents.length,
      averagePerDay: documents.length / daysInRange,
      trendPercentage,
    };

    metricsCache.set(cacheKey, { data: result, expiry: Date.now() + METRICS_CACHE_TTL_MS });
    return result;
  }

  // ============================================================================
  // AI Utilization Stats (AC: 2)
  // ============================================================================

  async getAIUtilizationStats(filters: DocumentIntelligenceFilters): Promise<AIUtilizationStats> {
    const cacheKey = this.getCacheKey('aiUtilization', filters);
    const cached = metricsCache.get(cacheKey) as CacheEntry<AIUtilizationStats> | undefined;
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const firmId = this.getFirmId();
    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    // Note: DocumentDraftMetrics model has been removed
    // AI utilization tracking is no longer available - return empty/zero stats

    // Get total documents
    const totalDocuments = await prisma.document.count({
      where: {
        firmId,
        uploadedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Without DocumentDraftMetrics, we cannot track AI-assisted documents
    const totalAIAssistedDocuments = 0;
    const totalManualDocuments = totalDocuments;
    const overallUtilizationRate = 0;

    const byUser: UserAIUtilization[] = [];
    const adoptionTrend: AdoptionTrendPoint[] = [];

    const result: AIUtilizationStats = {
      overallUtilizationRate,
      byUser: byUser.sort((a, b) => b.utilizationRate - a.utilizationRate),
      adoptionTrend,
      totalAIAssistedDocuments,
      totalManualDocuments,
    };

    metricsCache.set(cacheKey, { data: result, expiry: Date.now() + METRICS_CACHE_TTL_MS });
    return result;
  }

  // ============================================================================
  // Error Detection Stats (AC: 3)
  // ============================================================================

  async getErrorDetectionStats(filters: DocumentIntelligenceFilters): Promise<ErrorDetectionStats> {
    const cacheKey = this.getCacheKey('errorDetection', filters);
    const cached = metricsCache.get(cacheKey) as CacheEntry<ErrorDetectionStats> | undefined;
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const firmId = this.getFirmId();
    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    // Get AI concerns from document reviews in the firm
    const concerns = await prisma.aIReviewConcern.findMany({
      where: {
        review: {
          firmId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      select: {
        id: true,
        concernType: true,
        severity: true,
        dismissed: true,
        createdAt: true,
      },
    });

    const totalConcernsDetected = concerns.length;
    const concernsResolvedBeforeFiling = concerns.filter((c) => c.dismissed).length;
    const detectionRate =
      totalConcernsDetected > 0 ? (concernsResolvedBeforeFiling / totalConcernsDetected) * 100 : 0;

    // Group by severity
    const severityMap = new Map<ConcernSeverity, number>();
    for (const concern of concerns) {
      severityMap.set(concern.severity, (severityMap.get(concern.severity) || 0) + 1);
    }

    const bySeverity: SeverityBreakdown[] = ['ERROR', 'WARNING', 'INFO'].map((sev) => ({
      severity: sev,
      count: severityMap.get(sev as ConcernSeverity) || 0,
      percentage:
        totalConcernsDetected > 0
          ? ((severityMap.get(sev as ConcernSeverity) || 0) / totalConcernsDetected) * 100
          : 0,
    }));

    // Group by type
    const typeMap = new Map<ConcernType, number>();
    for (const concern of concerns) {
      typeMap.set(concern.concernType, (typeMap.get(concern.concernType) || 0) + 1);
    }

    const byType: ConcernTypeBreakdown[] = Array.from(typeMap.entries())
      .map(([type, count]) => ({
        concernType: type,
        count,
        percentage: totalConcernsDetected > 0 ? (count / totalConcernsDetected) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate trend data
    const dailyData = new Map<string, { detected: number; resolved: number }>();
    for (const concern of concerns) {
      const dateStr = concern.createdAt.toISOString().split('T')[0];
      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, { detected: 0, resolved: 0 });
      }
      dailyData.get(dateStr)!.detected++;
      if (concern.dismissed) {
        dailyData.get(dateStr)!.resolved++;
      }
    }

    const trendData: ErrorDetectionTrendPoint[] = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        detected: data.detected,
        resolved: data.resolved,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result: ErrorDetectionStats = {
      totalConcernsDetected,
      concernsResolvedBeforeFiling,
      detectionRate,
      bySeverity,
      byType,
      trendData,
    };

    metricsCache.set(cacheKey, { data: result, expiry: Date.now() + METRICS_CACHE_TTL_MS });
    return result;
  }

  // ============================================================================
  // Time Savings Stats (AC: 4)
  // ============================================================================

  async getTimeSavingsStats(filters: DocumentIntelligenceFilters): Promise<TimeSavingsStats> {
    const cacheKey = this.getCacheKey('timeSavings', filters);
    const cached = metricsCache.get(cacheKey) as CacheEntry<TimeSavingsStats> | undefined;
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Note: DocumentDraftMetrics model has been removed
    // Time savings tracking is no longer available - return empty stats

    const result: TimeSavingsStats = {
      totalMinutesSaved: 0,
      averageMinutesSavedPerDocument: 0,
      estimatedCostSavings: 0,
      byUser: [],
      byDocumentType: [],
      methodology: 'Time savings tracking is no longer available. The DocumentDraftMetrics model has been removed.',
    };

    metricsCache.set(cacheKey, { data: result, expiry: Date.now() + METRICS_CACHE_TTL_MS });
    return result;
  }

  // ============================================================================
  // Template Usage Stats (AC: 5)
  // ============================================================================

  async getTemplateUsageStats(filters: DocumentIntelligenceFilters): Promise<TemplateUsageStats> {
    const cacheKey = this.getCacheKey('templateUsage', filters);
    const cached = metricsCache.get(cacheKey) as CacheEntry<TemplateUsageStats> | undefined;
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Note: TemplateLibrary, DocumentPattern, and DocumentDraftMetrics models have been removed
    // Template usage tracking is no longer available - return empty stats

    const result: TemplateUsageStats = {
      topTemplates: [],
      topClauses: [],
      totalTemplateUsage: 0,
      templateAdoptionRate: 0,
    };

    metricsCache.set(cacheKey, { data: result, expiry: Date.now() + METRICS_CACHE_TTL_MS });
    return result;
  }

  // ============================================================================
  // Document Quality Trends (AC: 6)
  // ============================================================================

  async getDocumentQualityTrends(
    filters: DocumentIntelligenceFilters
  ): Promise<DocumentQualityTrends> {
    const cacheKey = this.getCacheKey('quality', filters);
    const cached = metricsCache.get(cacheKey) as CacheEntry<DocumentQualityTrends> | undefined;
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Note: DocumentDraftMetrics model has been removed
    // Document quality tracking is no longer available - return default stats

    const result: DocumentQualityTrends = {
      overallQualityScore: 0,
      averageRevisionCount: 0,
      qualityTrend: [],
      byDocumentType: [],
      qualityThreshold: 30, // Target: < 30% edit
    };

    metricsCache.set(cacheKey, { data: result, expiry: Date.now() + METRICS_CACHE_TTL_MS });
    return result;
  }
}

// Export factory function
export function createDocumentIntelligenceService(context: Context): DocumentIntelligenceService {
  return new DocumentIntelligenceService(context);
}
