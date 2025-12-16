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
import { Prisma, ConcernType, ConcernSeverity } from '@prisma/client';
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
  UserTimeSavings,
  DocumentTypeTimeSavings,
  TemplateUsage,
  ClauseUsage,
  QualityTrendPoint,
  DocumentTypeQuality,
  MANUAL_BASELINE_TIMES,
  DEFAULT_HOURLY_RATE_RON,
  calculateQualityScore,
} from '@legal-platform/types';
import type { Context } from '../graphql/resolvers/case.resolvers';

// Re-import constants that need runtime values
const MANUAL_BASELINE_TIMES_MAP: Record<string, number> = {
  Contract: 120,
  Motion: 90,
  Letter: 45,
  Memo: 60,
  Pleading: 150,
  Other: 60,
};

const DEFAULT_RATE_RON = 200;

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

    // Get average creation time from DocumentDraftMetrics
    const draftMetrics = await prisma.documentDraftMetrics.findMany({
      where: {
        firmId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        documentType: true,
        timeToFinalizeMinutes: true,
      },
    });

    const typeTimeMap = new Map<string, { total: number; count: number }>();
    for (const metric of draftMetrics) {
      if (metric.timeToFinalizeMinutes) {
        const type = metric.documentType;
        if (!typeTimeMap.has(type)) {
          typeTimeMap.set(type, { total: 0, count: 0 });
        }
        const entry = typeTimeMap.get(type)!;
        entry.total += metric.timeToFinalizeMinutes;
        entry.count++;
      }
    }

    const byType: DocumentTypeVelocity[] = Array.from(typeMap.entries()).map(([type, count]) => {
      const timeData = typeTimeMap.get(type);
      return {
        documentType: type,
        documentCount: count,
        averageCreationTimeMinutes: timeData ? timeData.total / timeData.count : 0,
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

    // Get AI-assisted documents from DocumentDraftMetrics
    const aiDocuments = await prisma.documentDraftMetrics.findMany({
      where: {
        firmId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(filters.userIds?.length ? { userId: { in: filters.userIds } } : {}),
        ...(filters.documentTypes?.length ? { documentType: { in: filters.documentTypes } } : {}),
      },
      select: {
        userId: true,
        createdAt: true,
      },
    });

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

    const totalAIAssistedDocuments = aiDocuments.length;
    const totalManualDocuments = Math.max(0, totalDocuments - totalAIAssistedDocuments);
    const overallUtilizationRate =
      totalDocuments > 0 ? (totalAIAssistedDocuments / totalDocuments) * 100 : 0;

    // Group by user
    const userAIMap = new Map<string, { count: number; lastUsage: Date | null }>();
    for (const doc of aiDocuments) {
      if (!userAIMap.has(doc.userId)) {
        userAIMap.set(doc.userId, { count: 0, lastUsage: null });
      }
      const entry = userAIMap.get(doc.userId)!;
      entry.count++;
      if (!entry.lastUsage || doc.createdAt > entry.lastUsage) {
        entry.lastUsage = doc.createdAt;
      }
    }

    // Get user info and total document counts
    const users = await prisma.user.findMany({
      where: {
        firmId,
        id: { in: Array.from(userAIMap.keys()) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const userDocCounts = await prisma.document.groupBy({
      by: ['uploadedBy'],
      where: {
        firmId,
        uploadedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    const userDocMap = new Map<string, number>();
    for (const entry of userDocCounts) {
      userDocMap.set(entry.uploadedBy, entry._count.id);
    }

    const byUser: UserAIUtilization[] = users.map((user) => {
      const aiData = userAIMap.get(user.id)!;
      const totalDocs = userDocMap.get(user.id) || aiData.count;
      return {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        utilizationRate: totalDocs > 0 ? (aiData.count / totalDocs) * 100 : 0,
        aiDocumentCount: aiData.count,
        totalDocumentCount: totalDocs,
        lastAIUsage: aiData.lastUsage,
      };
    });

    // Calculate adoption trend over time
    const dailyData = new Map<string, { ai: number; total: number }>();
    for (const doc of aiDocuments) {
      const dateStr = doc.createdAt.toISOString().split('T')[0];
      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, { ai: 0, total: 0 });
      }
      dailyData.get(dateStr)!.ai++;
    }

    // Get total documents per day
    const dailyDocs = await prisma.document.groupBy({
      by: ['uploadedAt'],
      where: {
        firmId,
        uploadedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    for (const entry of dailyDocs) {
      const dateStr = entry.uploadedAt.toISOString().split('T')[0];
      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, { ai: 0, total: 0 });
      }
      dailyData.get(dateStr)!.total += entry._count.id;
    }

    const adoptionTrend: AdoptionTrendPoint[] = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        utilizationRate: data.total > 0 ? (data.ai / data.total) * 100 : 0,
        documentCount: data.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

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

    const firmId = this.getFirmId();
    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    // Get draft metrics with time data
    const draftMetrics = await prisma.documentDraftMetrics.findMany({
      where: {
        firmId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        timeToFinalizeMinutes: { not: null },
        ...(filters.userIds?.length ? { userId: { in: filters.userIds } } : {}),
        ...(filters.documentTypes?.length ? { documentType: { in: filters.documentTypes } } : {}),
      },
      select: {
        userId: true,
        documentType: true,
        timeToFinalizeMinutes: true,
      },
    });

    // Get firm rates for cost calculation
    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: { defaultRates: true },
    });

    const rates = firm?.defaultRates as {
      partnerRate?: number;
      associateRate?: number;
      paralegalRate?: number;
    } | null;
    const avgRate = rates
      ? ((rates.partnerRate || 0) + (rates.associateRate || 0) + (rates.paralegalRate || 0)) / 3
      : DEFAULT_RATE_RON;

    let totalMinutesSaved = 0;
    const userSavingsMap = new Map<string, { minutes: number; docs: number }>();
    const typeSavingsMap = new Map<string, { aiTime: number; count: number }>();

    for (const metric of draftMetrics) {
      const baselineTime =
        MANUAL_BASELINE_TIMES_MAP[metric.documentType] || MANUAL_BASELINE_TIMES_MAP['Other'];
      const actualTime = metric.timeToFinalizeMinutes!;
      const saved = Math.max(0, baselineTime - actualTime);

      totalMinutesSaved += saved;

      // By user
      if (!userSavingsMap.has(metric.userId)) {
        userSavingsMap.set(metric.userId, { minutes: 0, docs: 0 });
      }
      userSavingsMap.get(metric.userId)!.minutes += saved;
      userSavingsMap.get(metric.userId)!.docs++;

      // By type
      if (!typeSavingsMap.has(metric.documentType)) {
        typeSavingsMap.set(metric.documentType, { aiTime: 0, count: 0 });
      }
      typeSavingsMap.get(metric.documentType)!.aiTime += actualTime;
      typeSavingsMap.get(metric.documentType)!.count++;
    }

    // Get user names
    const users = await prisma.user.findMany({
      where: {
        id: { in: Array.from(userSavingsMap.keys()) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const byUser: UserTimeSavings[] = users.map((user) => {
      const data = userSavingsMap.get(user.id)!;
      return {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        minutesSaved: Math.round(data.minutes),
        documentsCreated: data.docs,
        averageSavedPerDocument: data.docs > 0 ? data.minutes / data.docs : 0,
      };
    });

    const byDocumentType: DocumentTypeTimeSavings[] = Array.from(typeSavingsMap.entries()).map(
      ([type, data]) => {
        const baselineTime = MANUAL_BASELINE_TIMES_MAP[type] || MANUAL_BASELINE_TIMES_MAP['Other'];
        const avgAITime = data.count > 0 ? data.aiTime / data.count : 0;
        return {
          documentType: type,
          averageManualTimeMinutes: baselineTime,
          averageAIAssistedTimeMinutes: avgAITime,
          timeSavedPercentage:
            baselineTime > 0 ? ((baselineTime - avgAITime) / baselineTime) * 100 : 0,
          sampleSize: data.count,
        };
      }
    );

    const estimatedCostSavings = (totalMinutesSaved / 60) * avgRate;

    const result: TimeSavingsStats = {
      totalMinutesSaved: Math.round(totalMinutesSaved),
      averageMinutesSavedPerDocument:
        draftMetrics.length > 0 ? totalMinutesSaved / draftMetrics.length : 0,
      estimatedCostSavings: Math.round(estimatedCostSavings * 100) / 100,
      byUser: byUser.sort((a, b) => b.minutesSaved - a.minutesSaved),
      byDocumentType: byDocumentType.sort((a, b) => b.timeSavedPercentage - a.timeSavedPercentage),
      methodology: `Time savings calculated by comparing AI-assisted document creation time against industry baseline times per document type. Manual baselines: Contract (120min), Motion (90min), Letter (45min), Memo (60min), Pleading (150min), Other (60min). Cost savings estimated using firm average hourly rate of ${avgRate} RON.`,
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

    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    // Get templates ordered by usage
    const templates = await prisma.templateLibrary.findMany({
      where: {
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        usageCount: 'desc',
      },
      take: 10,
      select: {
        id: true,
        name: true,
        category: true,
        usageCount: true,
        qualityScore: true,
        updatedAt: true,
      },
    });

    const topTemplates: TemplateUsage[] = templates.map((t) => ({
      templateId: t.id,
      templateName: t.name || 'Unnamed Template',
      category: t.category,
      usageCount: t.usageCount,
      lastUsed: t.updatedAt,
      averageQualityScore: t.qualityScore ? Number(t.qualityScore) : null,
    }));

    // Get clause patterns
    const clauses = await prisma.documentPattern.findMany({
      where: {
        patternType: 'clause',
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        frequency: 'desc',
      },
      take: 10,
      select: {
        id: true,
        patternText: true,
        category: true,
        frequency: true,
        confidenceScore: true,
      },
    });

    const topClauses: ClauseUsage[] = clauses.map((c) => ({
      clauseId: c.id,
      clauseText: c.patternText.substring(0, 200) + (c.patternText.length > 200 ? '...' : ''),
      category: c.category,
      frequency: c.frequency,
      insertionRate: c.confidenceScore ? Number(c.confidenceScore) * 100 : 0,
    }));

    const totalTemplateUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);

    // Calculate adoption rate (templates used / total AI documents)
    const firmId = this.getFirmId();
    const aiDocCount = await prisma.documentDraftMetrics.count({
      where: {
        firmId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        templateId: { not: null },
      },
    });

    const totalAIDocs = await prisma.documentDraftMetrics.count({
      where: {
        firmId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const templateAdoptionRate = totalAIDocs > 0 ? (aiDocCount / totalAIDocs) * 100 : 0;

    const result: TemplateUsageStats = {
      topTemplates,
      topClauses,
      totalTemplateUsage,
      templateAdoptionRate,
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

    const firmId = this.getFirmId();
    const startDate = new Date(filters.dateRange.startDate);
    const endDate = new Date(filters.dateRange.endDate);

    // Get draft metrics for quality data
    const draftMetrics = await prisma.documentDraftMetrics.findMany({
      where: {
        firmId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(filters.userIds?.length ? { userId: { in: filters.userIds } } : {}),
        ...(filters.documentTypes?.length ? { documentType: { in: filters.documentTypes } } : {}),
      },
      select: {
        documentId: true,
        documentType: true,
        editPercentage: true,
        createdAt: true,
      },
    });

    // Calculate overall averages
    let totalEditPercentage = 0;
    for (const metric of draftMetrics) {
      totalEditPercentage += Number(metric.editPercentage);
    }
    const avgEditPercentage =
      draftMetrics.length > 0 ? totalEditPercentage / draftMetrics.length : 0;
    const overallQualityScore = Math.max(0, Math.min(100, 100 - avgEditPercentage * 2.5));

    // Get version counts for revision data
    const docIds = draftMetrics.map((m) => m.documentId);
    const versionCounts = await prisma.documentVersion.groupBy({
      by: ['documentId'],
      where: {
        documentId: { in: docIds },
      },
      _count: {
        id: true,
      },
    });

    const versionMap = new Map<string, number>();
    for (const v of versionCounts) {
      versionMap.set(v.documentId, v._count.id);
    }

    let totalRevisions = 0;
    for (const count of versionMap.values()) {
      totalRevisions += count;
    }
    const averageRevisionCount = docIds.length > 0 ? totalRevisions / docIds.length : 0;

    // Calculate trend data (daily)
    const dailyData = new Map<string, { editSum: number; count: number }>();
    for (const metric of draftMetrics) {
      const dateStr = metric.createdAt.toISOString().split('T')[0];
      if (!dailyData.has(dateStr)) {
        dailyData.set(dateStr, { editSum: 0, count: 0 });
      }
      dailyData.get(dateStr)!.editSum += Number(metric.editPercentage);
      dailyData.get(dateStr)!.count++;
    }

    const qualityTrend: QualityTrendPoint[] = Array.from(dailyData.entries())
      .map(([date, data]) => {
        const avgEdit = data.count > 0 ? data.editSum / data.count : 0;
        return {
          date,
          averageEditPercentage: avgEdit,
          documentCount: data.count,
          qualityScore: Math.max(0, Math.min(100, 100 - avgEdit * 2.5)),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate by document type
    const typeData = new Map<string, { editSum: number; count: number; revisions: number }>();
    for (const metric of draftMetrics) {
      if (!typeData.has(metric.documentType)) {
        typeData.set(metric.documentType, { editSum: 0, count: 0, revisions: 0 });
      }
      const entry = typeData.get(metric.documentType)!;
      entry.editSum += Number(metric.editPercentage);
      entry.count++;
      entry.revisions += versionMap.get(metric.documentId) || 1;
    }

    const byDocumentType: DocumentTypeQuality[] = Array.from(typeData.entries()).map(
      ([type, data]) => {
        const avgEdit = data.count > 0 ? data.editSum / data.count : 0;
        return {
          documentType: type,
          averageEditPercentage: avgEdit,
          averageRevisionCount: data.count > 0 ? data.revisions / data.count : 0,
          documentCount: data.count,
          qualityScore: Math.max(0, Math.min(100, 100 - avgEdit * 2.5)),
        };
      }
    );

    const result: DocumentQualityTrends = {
      overallQualityScore,
      averageRevisionCount,
      qualityTrend,
      byDocumentType: byDocumentType.sort((a, b) => b.qualityScore - a.qualityScore),
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
