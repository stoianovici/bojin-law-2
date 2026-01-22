/**
 * Document Quality Analytics Service
 * Story 5.7: Platform Intelligence Dashboard - Task 2
 *
 * Tracks document revision metrics and error rates (AC: 3)
 *
 * Business Logic:
 * - Calculates first-time-right percentage (documents with zero revisions)
 * - Tracks average revisions per document
 * - Categorizes review issues (spelling, legal_reference, formatting, content)
 * - Measures issue resolution time
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import Redis from 'ioredis';
import type {
  DocumentRevisionMetrics,
  DocumentErrorMetrics,
  DocumentQualityTrend,
  DocumentQualityAnalytics,
  IssueCategory,
  PlatformDateRange,
  CategoryClassification,
  ISSUE_CATEGORY_KEYWORDS,
} from '@legal-platform/types';

// Cache TTL in seconds (30 minutes for document quality data)
const CACHE_TTL = 1800;

// Category cache TTL (24 hours for comment classifications)
const CATEGORY_CACHE_TTL = 86400;

// Keywords for rule-based classification
const ISSUE_KEYWORDS: Record<IssueCategory, string[]> = {
  spelling: ['typo', 'spelling', 'grammar', 'punctuation', 'ortografie', 'greșeală', 'corecție'],
  legal_reference: [
    'citation',
    'reference',
    'article',
    'articol',
    'lege',
    'cod',
    'decret',
    'citare',
    'hotărâre',
  ],
  formatting: ['format', 'layout', 'spacing', 'font', 'margin', 'aliniere', 'formatare', 'indent'],
  content: [
    'incorrect',
    'wrong',
    'error',
    'missing',
    'conținut',
    'greșit',
    'lipsește',
    'modificare',
    'actualizare',
  ],
};

/**
 * Document Quality Analytics Service
 * Analyzes document revisions and quality metrics
 */
export class DocumentQualityAnalyticsService {
  private prisma: PrismaClientType;
  private redis: Redis | null = null;

  constructor(prismaClient?: PrismaClientType, redisClient?: Redis) {
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
  }

  /**
   * Get complete document quality analytics
   * AC: 3 - Document error rates and revision statistics
   */
  async getDocumentQualityAnalytics(
    firmId: string,
    dateRange: PlatformDateRange,
    interval: 'day' | 'week' | 'month' = 'week'
  ): Promise<DocumentQualityAnalytics> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, dateRange, interval);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const revisionMetrics = await this.getRevisionMetrics(firmId, dateRange);
    const errorMetrics = await this.getErrorMetrics(firmId, dateRange);
    const qualityTrend = await this.getQualityTrend(firmId, dateRange, interval);

    const result: DocumentQualityAnalytics = {
      revisionMetrics,
      errorMetrics,
      qualityTrend,
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get revision metrics
   * AC: 3 - Document revision statistics
   */
  async getRevisionMetrics(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<DocumentRevisionMetrics> {
    // Get all documents created in the date range
    const documents = await this.prisma.document.findMany({
      where: {
        firmId,
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        id: true,
        _count: {
          select: { versions: true },
        },
      },
    });

    const totalDocumentsCreated = documents.length;

    if (totalDocumentsCreated === 0) {
      return {
        totalDocumentsCreated: 0,
        avgRevisionsPerDocument: 0,
        documentsWithZeroRevisions: 0,
        documentsWithMultipleRevisions: 0,
        firstTimeRightPercent: 0,
      };
    }

    // Count revisions (version count - 1, since first version is creation)
    let totalRevisions = 0;
    let documentsWithZeroRevisions = 0;
    let documentsWithMultipleRevisions = 0;

    for (const doc of documents) {
      const revisions = doc._count.versions - 1; // Subtract initial version
      totalRevisions += Math.max(0, revisions);

      if (revisions <= 0) {
        documentsWithZeroRevisions++;
      } else if (revisions > 1) {
        documentsWithMultipleRevisions++;
      }
    }

    const avgRevisionsPerDocument = totalRevisions / totalDocumentsCreated;
    const firstTimeRightPercent = (documentsWithZeroRevisions / totalDocumentsCreated) * 100;

    return {
      totalDocumentsCreated,
      avgRevisionsPerDocument: Math.round(avgRevisionsPerDocument * 100) / 100,
      documentsWithZeroRevisions,
      documentsWithMultipleRevisions,
      firstTimeRightPercent: Math.round(firstTimeRightPercent * 100) / 100,
    };
  }

  /**
   * Get error metrics from review comments
   * AC: 3 - Document error rates
   * Note: Review comments have been removed in simplified review workflow.
   * Returns empty stats for backward compatibility.
   */
  async getErrorMetrics(
    _firmId: string,
    _dateRange: PlatformDateRange
  ): Promise<DocumentErrorMetrics> {
    // Review comments have been removed - return empty stats
    return {
      totalReviewsCompleted: 0,
      reviewsWithIssues: 0,
      issuesByCategory: {
        spelling: 0,
        legal_reference: 0,
        formatting: 0,
        content: 0,
      },
      avgIssuesPerReview: 0,
      issueResolutionTimeHours: 0,
    };
  }

  /**
   * Get quality trend over time
   * Note: Review comments have been removed. Issue counts will be 0.
   */
  async getQualityTrend(
    firmId: string,
    dateRange: PlatformDateRange,
    interval: 'day' | 'week' | 'month'
  ): Promise<DocumentQualityTrend[]> {
    const trend: DocumentQualityTrend[] = [];
    let currentDate = new Date(dateRange.startDate);

    while (currentDate <= dateRange.endDate) {
      const periodEnd = this.getIntervalEnd(currentDate, interval);
      const periodDateRange: PlatformDateRange = {
        startDate: new Date(currentDate),
        endDate: periodEnd > dateRange.endDate ? dateRange.endDate : periodEnd,
      };

      // Get documents created in this period
      const documents = await this.prisma.document.findMany({
        where: {
          firmId,
          createdAt: {
            gte: periodDateRange.startDate,
            lte: periodDateRange.endDate,
          },
        },
        select: {
          id: true,
          _count: {
            select: { versions: true },
          },
        },
      });

      if (documents.length > 0) {
        const zeroRevisions = documents.filter((d) => d._count.versions <= 1).length;
        const firstTimeRightPercent = (zeroRevisions / documents.length) * 100;
        const totalRevisions = documents.reduce(
          (sum, d) => sum + Math.max(0, d._count.versions - 1),
          0
        );
        const avgRevisions = totalRevisions / documents.length;

        trend.push({
          date: new Date(currentDate),
          firstTimeRightPercent: Math.round(firstTimeRightPercent * 100) / 100,
          avgRevisions: Math.round(avgRevisions * 100) / 100,
          issueCount: 0, // Review comments removed
        });
      }

      // Move to next interval
      currentDate = this.getNextInterval(currentDate, interval);
    }

    return trend;
  }

  /**
   * Categorize a review comment using rule-based classification
   * Caches the classification for efficiency
   */
  private async categorizeComment(commentId: string, content: string): Promise<IssueCategory> {
    // Check cache first
    const cacheKey = `comment:category:${commentId}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return cached as IssueCategory;
        }
      } catch {
        // Cache error
      }
    }

    // Rule-based classification
    const contentLower = content.toLowerCase();
    let maxScore = 0;
    let category: IssueCategory = 'content'; // Default category

    for (const [cat, keywords] of Object.entries(ISSUE_KEYWORDS) as [IssueCategory, string[]][]) {
      let score = 0;
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        category = cat;
      }
    }

    // Cache the classification
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, CATEGORY_CACHE_TTL, category);
      } catch {
        // Cache error
      }
    }

    return category;
  }

  /**
   * Get interval end date
   */
  private getIntervalEnd(date: Date, interval: 'day' | 'week' | 'month'): Date {
    const end = new Date(date);
    switch (interval) {
      case 'day':
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
    }
    return end;
  }

  /**
   * Get next interval start date
   */
  private getNextInterval(date: Date, interval: 'day' | 'week' | 'month'): Date {
    const next = new Date(date);
    switch (interval) {
      case 'day':
        next.setDate(next.getDate() + 1);
        break;
      case 'week':
        next.setDate(next.getDate() + 7);
        break;
      case 'month':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    next.setHours(0, 0, 0, 0);
    return next;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(firmId: string, dateRange: PlatformDateRange, interval: string): string {
    const params = [
      firmId,
      dateRange.startDate.toISOString().split('T')[0],
      dateRange.endDate.toISOString().split('T')[0],
      interval,
    ];
    return `analytics:doc-quality:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<DocumentQualityAnalytics | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date objects in trend
        if (parsed.qualityTrend) {
          parsed.qualityTrend = parsed.qualityTrend.map((t: DocumentQualityTrend) => ({
            ...t,
            date: new Date(t.date),
          }));
        }
        return parsed;
      }
    } catch {
      // Cache error
    }
    return null;
  }

  /**
   * Set cache
   */
  private async setCache(key: string, data: DocumentQualityAnalytics): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, CACHE_TTL, JSON.stringify(data));
    } catch {
      // Cache error
    }
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(firmId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const pattern = `analytics:doc-quality:${firmId}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Cache error
    }
  }
}

// Export singleton
let serviceInstance: DocumentQualityAnalyticsService | null = null;

export function getDocumentQualityAnalyticsService(): DocumentQualityAnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new DocumentQualityAnalyticsService();
  }
  return serviceInstance;
}

export default DocumentQualityAnalyticsService;
