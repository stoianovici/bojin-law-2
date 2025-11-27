/**
 * Token Tracker Service
 * Story 3.1: AI Service Infrastructure
 *
 * Tracks token usage, calculates costs, and provides aggregation methods
 */

import { PrismaClient } from '@prisma/client';
import { ClaudeModel, AIOperationType, AITokenUsageRecord, AIUsageStats, AIModelUsage, AIOperationUsage, AIDateRange } from '@legal-platform/types';
import { config } from '../config';

// Initialize Prisma client (will be injected in production)
let prisma: PrismaClient;

export function initializePrisma(client: PrismaClient) {
  prisma = client;
}

// Model pricing (per 1M tokens in cents)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  [ClaudeModel.Haiku]: config.pricing.haiku,
  [ClaudeModel.Sonnet]: config.pricing.sonnet,
  [ClaudeModel.Opus]: config.pricing.opus,
  // Grok fallback pricing (approximation)
  'grok-beta': { input: 500, output: 1500 },
};

export interface TokenUsageInput {
  userId?: string;
  caseId?: string;
  firmId: string;
  operationType: AIOperationType;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached?: boolean;
}

export class TokenTrackerService {
  /**
   * Calculate cost in cents based on model and token counts
   */
  calculateCost(modelUsed: string, inputTokens: number, outputTokens: number): number {
    // Find pricing for the model
    let pricing = MODEL_PRICING[modelUsed];

    // If exact match not found, try to match by model family
    if (!pricing) {
      if (modelUsed.includes('haiku')) {
        pricing = MODEL_PRICING[ClaudeModel.Haiku];
      } else if (modelUsed.includes('sonnet')) {
        pricing = MODEL_PRICING[ClaudeModel.Sonnet];
      } else if (modelUsed.includes('opus')) {
        pricing = MODEL_PRICING[ClaudeModel.Opus];
      } else {
        // Default to Sonnet pricing for unknown models
        pricing = MODEL_PRICING[ClaudeModel.Sonnet];
      }
    }

    // Calculate cost: (tokens / 1M) * price_per_1M_in_cents
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    // Round to nearest cent
    return Math.round(inputCost + outputCost);
  }

  /**
   * Record token usage to database
   */
  async recordUsage(input: TokenUsageInput): Promise<AITokenUsageRecord> {
    const totalTokens = input.inputTokens + input.outputTokens;
    const costCents = this.calculateCost(input.modelUsed, input.inputTokens, input.outputTokens);

    const record = await prisma.aITokenUsage.create({
      data: {
        userId: input.userId,
        caseId: input.caseId,
        firmId: input.firmId,
        operationType: input.operationType,
        modelUsed: input.modelUsed,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens,
        costCents,
        latencyMs: input.latencyMs,
        cached: input.cached || false,
      },
    });

    return {
      id: record.id,
      userId: record.userId || undefined,
      caseId: record.caseId || undefined,
      firmId: record.firmId,
      operationType: record.operationType as AIOperationType,
      modelUsed: record.modelUsed,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      costCents: record.costCents,
      latencyMs: record.latencyMs,
      cached: record.cached,
      createdAt: record.createdAt,
    };
  }

  /**
   * Get usage statistics for a firm within a date range
   */
  async getUsageStats(firmId: string, dateRange: AIDateRange): Promise<AIUsageStats> {
    const where = {
      firmId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    };

    // Get overall aggregates
    const aggregates = await prisma.aITokenUsage.aggregate({
      where,
      _sum: {
        totalTokens: true,
        costCents: true,
      },
      _avg: {
        latencyMs: true,
      },
      _count: true,
    });

    // Get cache hit count
    const cacheHits = await prisma.aITokenUsage.count({
      where: {
        ...where,
        cached: true,
      },
    });

    // Get usage by model
    const byModel = await prisma.aITokenUsage.groupBy({
      by: ['modelUsed'],
      where,
      _sum: {
        totalTokens: true,
        costCents: true,
      },
      _count: true,
    });

    // Get usage by operation type
    const byOperation = await prisma.aITokenUsage.groupBy({
      by: ['operationType'],
      where,
      _sum: {
        totalTokens: true,
        costCents: true,
      },
      _count: true,
    });

    const totalRequests = aggregates._count || 0;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    return {
      totalTokens: aggregates._sum.totalTokens || 0,
      totalCostCents: aggregates._sum.costCents || 0,
      requestCount: totalRequests,
      avgLatencyMs: aggregates._avg.latencyMs || 0,
      cacheHitRate,
      byModel: byModel.map((m): AIModelUsage => ({
        model: m.modelUsed,
        tokens: m._sum.totalTokens || 0,
        costCents: m._sum.costCents || 0,
        requestCount: m._count,
      })),
      byOperation: byOperation.map((o): AIOperationUsage => ({
        operation: o.operationType as AIOperationType,
        tokens: o._sum.totalTokens || 0,
        costCents: o._sum.costCents || 0,
        requestCount: o._count,
      })),
    };
  }

  /**
   * Get usage by user
   */
  async getUsageByUser(firmId: string, dateRange: AIDateRange): Promise<Map<string, { tokens: number; costCents: number }>> {
    const results = await prisma.aITokenUsage.groupBy({
      by: ['userId'],
      where: {
        firmId,
        userId: { not: null },
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _sum: {
        totalTokens: true,
        costCents: true,
      },
    });

    const usage = new Map<string, { tokens: number; costCents: number }>();
    for (const r of results) {
      if (r.userId) {
        usage.set(r.userId, {
          tokens: r._sum.totalTokens || 0,
          costCents: r._sum.costCents || 0,
        });
      }
    }

    return usage;
  }

  /**
   * Get usage by case
   */
  async getUsageByCase(firmId: string, dateRange: AIDateRange): Promise<Map<string, { tokens: number; costCents: number }>> {
    const results = await prisma.aITokenUsage.groupBy({
      by: ['caseId'],
      where: {
        firmId,
        caseId: { not: null },
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      _sum: {
        totalTokens: true,
        costCents: true,
      },
    });

    const usage = new Map<string, { tokens: number; costCents: number }>();
    for (const r of results) {
      if (r.caseId) {
        usage.set(r.caseId, {
          tokens: r._sum.totalTokens || 0,
          costCents: r._sum.costCents || 0,
        });
      }
    }

    return usage;
  }

  /**
   * Get daily usage trend
   */
  async getDailyUsageTrend(firmId: string, dateRange: AIDateRange): Promise<Array<{ date: string; tokens: number; costCents: number; requests: number }>> {
    const records = await prisma.aITokenUsage.findMany({
      where: {
        firmId,
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
      select: {
        createdAt: true,
        totalTokens: true,
        costCents: true,
      },
    });

    // Group by date
    const dailyMap = new Map<string, { tokens: number; costCents: number; requests: number }>();

    for (const record of records) {
      const date = record.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { tokens: 0, costCents: 0, requests: 0 };
      dailyMap.set(date, {
        tokens: existing.tokens + record.totalTokens,
        costCents: existing.costCents + record.costCents,
        requests: existing.requests + 1,
      });
    }

    // Convert to sorted array
    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

// Singleton instance
export const tokenTracker = new TokenTrackerService();
