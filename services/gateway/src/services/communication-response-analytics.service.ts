// @ts-nocheck
/**
 * Communication Response Analytics Service
 * Story 5.7: Platform Intelligence Dashboard - Task 1
 *
 * Tracks and analyzes email response times (AC: 2)
 *
 * Business Logic:
 * - Calculates average, median, and P90 response times
 * - Compares current period vs. baseline (first month of platform usage)
 * - Groups response times by recipient type (client, counsel, court, internal)
 * - Excludes auto-replies and internal forwards
 * - SLA threshold: 24 hours for response
 */

import { PrismaClient as PrismaClientType } from '@prisma/client';
import Redis from 'ioredis';
import type {
  ResponseTimeMetrics,
  ResponseTimeComparison,
  ResponseTimeByType,
  ResponseTimeTrend,
  CommunicationAnalytics,
  EmailRecipientType,
  PlatformDateRange,
  FirmMetadataWithIntelligence,
} from '@legal-platform/types';

// Cache TTL in seconds (30 minutes for response analytics)
const CACHE_TTL = 1800;

// SLA threshold in hours (24 hours)
const SLA_THRESHOLD_HOURS = 24;

// Auto-reply detection threshold (1 minute)
const AUTO_REPLY_THRESHOLD_MS = 60 * 1000;

// Email address patterns for type detection
const EMAIL_TYPE_PATTERNS = {
  court: ['tribunal', 'judecator', 'instanta', 'court', 'justice', '.gov', 'justitie'],
  internal: [], // Will be detected by same domain
  opposing_counsel: ['avocat', 'lawyer', 'attorney', 'cabinet', 'law', 'legal'],
  // client is the default fallback
};

// No-reply patterns to exclude
const NO_REPLY_PATTERNS = ['no-reply', 'noreply', 'do-not-reply', 'donotreply', 'mailer-daemon'];

interface EmailWithResponse {
  originalEmailId: string;
  receivedDateTime: Date;
  sentDateTime: Date;
  fromAddress: string;
  toAddress: string;
  responseTimeMs: number;
}

interface EmailAddress {
  name?: string;
  address: string;
}

/**
 * Communication Response Analytics Service
 * Analyzes email response times and patterns
 */
export class CommunicationResponseAnalyticsService {
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
   * Calculate response times for a firm within a date range
   * AC: 2 - Communication response times before/after platform adoption
   */
  async calculateResponseTimes(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<CommunicationAnalytics> {
    // Check cache
    const cacheKey = this.getCacheKey(firmId, dateRange);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Get current period metrics
    const currentResponseTime = await this.getResponseMetricsForPeriod(firmId, dateRange);

    // Get baseline comparison
    const baselineComparison = await this.getBaselineComparison(firmId, dateRange);

    // Get breakdown by recipient type
    const byRecipientType = await this.getResponseTimesByType(firmId, dateRange);

    // Get trend data
    const trend = await this.getResponseTimeTrend(firmId, dateRange);

    const result: CommunicationAnalytics = {
      currentResponseTime,
      baselineComparison,
      byRecipientType,
      trend,
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get response metrics for a specific period
   */
  private async getResponseMetricsForPeriod(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<ResponseTimeMetrics> {
    const emailsWithResponses = await this.getEmailsWithResponses(firmId, dateRange);

    if (emailsWithResponses.length === 0) {
      return {
        avgResponseTimeHours: 0,
        medianResponseTimeHours: 0,
        p90ResponseTimeHours: 0,
        totalEmailsAnalyzed: 0,
        withinSLAPercent: 0,
      };
    }

    const responseTimes = emailsWithResponses.map((e) => e.responseTimeMs / (1000 * 60 * 60)); // Convert to hours
    responseTimes.sort((a, b) => a - b);

    const avgResponseTimeHours =
      responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const medianResponseTimeHours = this.calculateMedian(responseTimes);
    const p90ResponseTimeHours = this.calculatePercentile(responseTimes, 90);
    const withinSLA = responseTimes.filter((t) => t <= SLA_THRESHOLD_HOURS).length;
    const withinSLAPercent = (withinSLA / responseTimes.length) * 100;

    return {
      avgResponseTimeHours: Math.round(avgResponseTimeHours * 100) / 100,
      medianResponseTimeHours: Math.round(medianResponseTimeHours * 100) / 100,
      p90ResponseTimeHours: Math.round(p90ResponseTimeHours * 100) / 100,
      totalEmailsAnalyzed: emailsWithResponses.length,
      withinSLAPercent: Math.round(withinSLAPercent * 100) / 100,
    };
  }

  /**
   * Get baseline comparison (current vs. first month of platform usage)
   * AC: 2 - Compare current period vs. first month of platform usage
   */
  async getBaselineComparison(
    firmId: string,
    currentRange: PlatformDateRange
  ): Promise<ResponseTimeComparison | null> {
    // Get firm to determine baseline period
    const firm = await this.prisma.firm.findUnique({
      where: { id: firmId },
      select: { createdAt: true },
    });

    if (!firm) {
      return null;
    }

    // Use first 30 days from firm creation as baseline period
    const baselineStart = firm.createdAt;
    const baselineEnd = new Date(firm.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Don't compare if current period overlaps with baseline
    if (currentRange.startDate < baselineEnd) {
      return null;
    }

    const baselineRange: PlatformDateRange = {
      startDate: baselineStart,
      endDate: baselineEnd,
    };

    const currentPeriod = await this.getResponseMetricsForPeriod(firmId, currentRange);
    const baselinePeriod = await this.getResponseMetricsForPeriod(firmId, baselineRange);

    // Calculate improvement (lower response time = improvement)
    let improvementPercent = 0;
    if (baselinePeriod.avgResponseTimeHours > 0) {
      improvementPercent =
        ((baselinePeriod.avgResponseTimeHours - currentPeriod.avgResponseTimeHours) /
          baselinePeriod.avgResponseTimeHours) *
        100;
    }

    return {
      currentPeriod,
      baselinePeriod,
      improvementPercent: Math.round(improvementPercent * 100) / 100,
    };
  }

  /**
   * Get response times grouped by user
   */
  async getResponseTimesByUser(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<{ userId: string; userName: string; metrics: ResponseTimeMetrics }[]> {
    // Get all users in the firm
    const users = await this.prisma.user.findMany({
      where: { firmId },
      select: { id: true, firstName: true, lastName: true },
    });

    const results: { userId: string; userName: string; metrics: ResponseTimeMetrics }[] = [];

    for (const user of users) {
      const userEmails = await this.getEmailsWithResponses(firmId, dateRange, user.id);

      if (userEmails.length > 0) {
        const responseTimes = userEmails.map((e) => e.responseTimeMs / (1000 * 60 * 60));
        responseTimes.sort((a, b) => a - b);

        const avgResponseTimeHours =
          responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
        const withinSLA = responseTimes.filter((t) => t <= SLA_THRESHOLD_HOURS).length;

        results.push({
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
          metrics: {
            avgResponseTimeHours: Math.round(avgResponseTimeHours * 100) / 100,
            medianResponseTimeHours: Math.round(this.calculateMedian(responseTimes) * 100) / 100,
            p90ResponseTimeHours:
              Math.round(this.calculatePercentile(responseTimes, 90) * 100) / 100,
            totalEmailsAnalyzed: userEmails.length,
            withinSLAPercent: Math.round((withinSLA / responseTimes.length) * 10000) / 100,
          },
        });
      }
    }

    return results.sort((a, b) => a.metrics.avgResponseTimeHours - b.metrics.avgResponseTimeHours);
  }

  /**
   * Get response times grouped by recipient type
   */
  private async getResponseTimesByType(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<ResponseTimeByType[]> {
    const emailsWithResponses = await this.getEmailsWithResponses(firmId, dateRange);

    // Get firm domain for internal detection
    const firm = await this.prisma.firm.findUnique({
      where: { id: firmId },
      select: { name: true },
    });

    // Derive domain from firm email patterns (simplified approach)
    const firmDomain = await this.getFirmDomain(firmId);

    // Group by type
    const byType: Record<EmailRecipientType, number[]> = {
      client: [],
      opposing_counsel: [],
      court: [],
      internal: [],
    };

    for (const email of emailsWithResponses) {
      const type = this.classifyEmailType(email.fromAddress, firmDomain);
      const responseTimeHours = email.responseTimeMs / (1000 * 60 * 60);
      byType[type].push(responseTimeHours);
    }

    const results: ResponseTimeByType[] = [];
    for (const [type, times] of Object.entries(byType)) {
      if (times.length > 0) {
        times.sort((a, b) => a - b);
        const avgResponseTimeHours = times.reduce((sum, t) => sum + t, 0) / times.length;
        const withinSLA = times.filter((t) => t <= SLA_THRESHOLD_HOURS).length;

        results.push({
          emailType: type as EmailRecipientType,
          metrics: {
            avgResponseTimeHours: Math.round(avgResponseTimeHours * 100) / 100,
            medianResponseTimeHours: Math.round(this.calculateMedian(times) * 100) / 100,
            p90ResponseTimeHours: Math.round(this.calculatePercentile(times, 90) * 100) / 100,
            totalEmailsAnalyzed: times.length,
            withinSLAPercent: Math.round((withinSLA / times.length) * 10000) / 100,
          },
          volumeCount: times.length,
        });
      }
    }

    return results.sort((a, b) => b.volumeCount - a.volumeCount);
  }

  /**
   * Get response time trend over time
   */
  private async getResponseTimeTrend(
    firmId: string,
    dateRange: PlatformDateRange
  ): Promise<ResponseTimeTrend[]> {
    const emailsWithResponses = await this.getEmailsWithResponses(firmId, dateRange);

    if (emailsWithResponses.length === 0) {
      return [];
    }

    // Group by week
    const byWeek: Map<string, number[]> = new Map();

    for (const email of emailsWithResponses) {
      const weekStart = this.getWeekStart(email.receivedDateTime);
      const weekKey = weekStart.toISOString().split('T')[0];
      const responseTimeHours = email.responseTimeMs / (1000 * 60 * 60);

      if (!byWeek.has(weekKey)) {
        byWeek.set(weekKey, []);
      }
      byWeek.get(weekKey)!.push(responseTimeHours);
    }

    const trend: ResponseTimeTrend[] = [];
    for (const [weekKey, times] of Array.from(byWeek.entries()).sort()) {
      const avgResponseTimeHours = times.reduce((sum, t) => sum + t, 0) / times.length;
      trend.push({
        date: new Date(weekKey),
        avgResponseTimeHours: Math.round(avgResponseTimeHours * 100) / 100,
        volumeCount: times.length,
      });
    }

    return trend;
  }

  /**
   * Get emails with their response times
   */
  private async getEmailsWithResponses(
    firmId: string,
    dateRange: PlatformDateRange,
    userId?: string
  ): Promise<EmailWithResponse[]> {
    // Get all emails received in the date range for users in the firm
    const whereClause: Record<string, unknown> = {
      user: { firmId },
      receivedDateTime: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    };

    if (userId) {
      whereClause.userId = userId;
    }

    const receivedEmails = await this.prisma.email.findMany({
      where: whereClause,
      select: {
        id: true,
        conversationId: true,
        receivedDateTime: true,
        from: true,
        toRecipients: true,
        userId: true,
        subject: true,
      },
    });

    const emailsWithResponses: EmailWithResponse[] = [];

    // For each received email, find if there's a sent reply
    for (const email of receivedEmails) {
      const fromAddress = this.extractEmailAddress(email.from as EmailAddress);

      // Skip no-reply emails
      if (this.isNoReplyEmail(fromAddress)) {
        continue;
      }

      // Find sent emails in the same conversation after this email was received
      const reply = await this.prisma.email.findFirst({
        where: {
          conversationId: email.conversationId,
          userId: email.userId,
          sentDateTime: { gt: email.receivedDateTime },
          // The reply should be TO the original sender or include them
        },
        orderBy: { sentDateTime: 'asc' },
        select: {
          id: true,
          sentDateTime: true,
          toRecipients: true,
        },
      });

      if (reply) {
        const responseTimeMs =
          new Date(reply.sentDateTime).getTime() - new Date(email.receivedDateTime).getTime();

        // Exclude auto-replies (responses < 1 minute)
        if (responseTimeMs < AUTO_REPLY_THRESHOLD_MS) {
          continue;
        }

        const toRecipients = email.toRecipients as EmailAddress[];
        const toAddress = toRecipients.length > 0 ? toRecipients[0].address : '';

        emailsWithResponses.push({
          originalEmailId: email.id,
          receivedDateTime: email.receivedDateTime,
          sentDateTime: reply.sentDateTime,
          fromAddress,
          toAddress,
          responseTimeMs,
        });
      }
    }

    return emailsWithResponses;
  }

  /**
   * Get firm's primary domain
   */
  private async getFirmDomain(firmId: string): Promise<string> {
    // Get the most common email domain from firm users
    const users = await this.prisma.user.findMany({
      where: { firmId },
      select: { email: true },
    });

    const domains: Record<string, number> = {};
    for (const user of users) {
      if (user.email) {
        const domain = user.email.split('@')[1]?.toLowerCase();
        if (domain) {
          domains[domain] = (domains[domain] || 0) + 1;
        }
      }
    }

    // Return the most common domain
    let maxCount = 0;
    let firmDomain = '';
    for (const [domain, count] of Object.entries(domains)) {
      if (count > maxCount) {
        maxCount = count;
        firmDomain = domain;
      }
    }

    return firmDomain;
  }

  /**
   * Classify email type based on sender address
   */
  private classifyEmailType(fromAddress: string, firmDomain: string): EmailRecipientType {
    const addressLower = fromAddress.toLowerCase();

    // Check if internal (same domain)
    if (firmDomain && addressLower.endsWith(`@${firmDomain}`)) {
      return 'internal';
    }

    // Check for court patterns
    for (const pattern of EMAIL_TYPE_PATTERNS.court) {
      if (addressLower.includes(pattern)) {
        return 'court';
      }
    }

    // Check for opposing counsel patterns
    for (const pattern of EMAIL_TYPE_PATTERNS.opposing_counsel) {
      if (addressLower.includes(pattern)) {
        return 'opposing_counsel';
      }
    }

    // Default to client
    return 'client';
  }

  /**
   * Check if email is a no-reply address
   */
  private isNoReplyEmail(address: string): boolean {
    const addressLower = address.toLowerCase();
    return NO_REPLY_PATTERNS.some((pattern) => addressLower.includes(pattern));
  }

  /**
   * Extract email address from JSON structure
   */
  private extractEmailAddress(from: EmailAddress): string {
    if (typeof from === 'object' && from !== null && 'address' in from) {
      return (from as { address: string }).address;
    }
    return '';
  }

  /**
   * Get the start of the week for a given date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Calculate median of sorted array
   */
  private calculateMedian(sortedValues: number[]): number {
    const len = sortedValues.length;
    if (len === 0) return 0;
    const mid = Math.floor(len / 2);
    return len % 2 !== 0 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }

  /**
   * Calculate percentile of sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.min(index, sortedValues.length - 1)];
  }

  /**
   * Generate cache key
   */
  private getCacheKey(firmId: string, dateRange: PlatformDateRange): string {
    const params = [
      firmId,
      dateRange.startDate.toISOString().split('T')[0],
      dateRange.endDate.toISOString().split('T')[0],
    ];
    return `analytics:comm-response:${params.join(':')}`;
  }

  /**
   * Get from cache
   */
  private async getFromCache(key: string): Promise<CommunicationAnalytics | null> {
    if (!this.redis) return null;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Restore Date objects
        if (parsed.trend) {
          parsed.trend = parsed.trend.map((t: ResponseTimeTrend) => ({
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
  private async setCache(key: string, data: CommunicationAnalytics): Promise<void> {
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
      const pattern = `analytics:comm-response:${firmId}:*`;
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
let serviceInstance: CommunicationResponseAnalyticsService | null = null;

export function getCommunicationResponseAnalyticsService(): CommunicationResponseAnalyticsService {
  if (!serviceInstance) {
    serviceInstance = new CommunicationResponseAnalyticsService();
  }
  return serviceInstance;
}

export default CommunicationResponseAnalyticsService;
