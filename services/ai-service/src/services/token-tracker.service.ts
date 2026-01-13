/**
 * Token Tracker Service
 * Story 3.1: AI Service Infrastructure
 *
 * NOTE: AITokenUsage model was removed from schema as dead code.
 * This service is now a no-op stub that maintains the interface
 * but doesn't persist usage data. Cost calculation still works.
 */

import { PrismaClient } from '@prisma/client';
import {
  ClaudeModel,
  AIOperationType,
  AITokenUsageRecord,
  AIUsageStats,
  AIDateRange,
} from '@legal-platform/types';
import { config } from '../config';

// Initialize Prisma client (kept for interface compatibility)
let _prisma: PrismaClient;

export function initializePrisma(client: PrismaClient) {
  _prisma = client;
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
   * Record token usage
   * NOTE: AITokenUsage model removed - this is now a no-op that returns a mock record
   */
  async recordUsage(input: TokenUsageInput): Promise<AITokenUsageRecord> {
    const totalTokens = input.inputTokens + input.outputTokens;
    const costCents = this.calculateCost(input.modelUsed, input.inputTokens, input.outputTokens);

    // Return a mock record without persisting
    return {
      id: `mock-${Date.now()}`,
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
      createdAt: new Date(),
    };
  }

  /**
   * Get usage statistics for a firm
   * NOTE: AITokenUsage model removed - returns empty stats
   */
  async getUsageStats(_firmId: string, _dateRange: AIDateRange): Promise<AIUsageStats> {
    return {
      totalTokens: 0,
      totalCostCents: 0,
      requestCount: 0,
      avgLatencyMs: 0,
      cacheHitRate: 0,
      byModel: [],
      byOperation: [],
    };
  }

  /**
   * Get usage by user
   * NOTE: AITokenUsage model removed - returns empty map
   */
  async getUsageByUser(
    _firmId: string,
    _dateRange: AIDateRange
  ): Promise<Map<string, { tokens: number; costCents: number }>> {
    return new Map();
  }

  /**
   * Get usage by case
   * NOTE: AITokenUsage model removed - returns empty map
   */
  async getUsageByCase(
    _firmId: string,
    _dateRange: AIDateRange
  ): Promise<Map<string, { tokens: number; costCents: number }>> {
    return new Map();
  }

  /**
   * Get daily usage trend
   * NOTE: AITokenUsage model removed - returns empty array
   */
  async getDailyUsageTrend(
    _firmId: string,
    _dateRange: AIDateRange
  ): Promise<Array<{ date: string; tokens: number; costCents: number; requests: number }>> {
    return [];
  }
}

// Singleton instance
export const tokenTracker = new TokenTrackerService();
