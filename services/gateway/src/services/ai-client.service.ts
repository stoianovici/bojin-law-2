/**
 * AI Client Wrapper Service
 * OPS-233: AI Call Wrapper with Usage Logging
 *
 * Central wrapper for all Anthropic API calls that:
 * - Wraps all Anthropic API calls
 * - Calculates token costs based on model
 * - Logs every call to AIUsageLog
 * - Updates Redis running totals for real-time dashboard
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@legal-platform/database';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Types
// ============================================================================

// Query complexity levels for AI model routing (OPS-252)
export type QueryComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX';

export interface ClassificationResult {
  complexity: QueryComplexity;
  recommendedModel: string;
  confidence: number; // 0-1, for future analytics
  matchedPattern?: string; // Which pattern matched, for debugging
}

export interface AICallOptions {
  feature: string; // 'assistant_chat', 'search_index', 'morning_briefing', etc.
  userId?: string; // null for batch jobs
  firmId: string;
  entityType?: string; // 'document', 'case', 'email', etc.
  entityId?: string;
  batchJobId?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlockParam[];
}

export interface AIToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
}

export interface AIChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  tools?: AIToolDefinition[];
}

export interface AIChatResponse {
  content: Anthropic.ContentBlock[];
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
  model: string;
  costEur: number;
  durationMs: number;
}

// ============================================================================
// Cost Calculation
// ============================================================================

// ============================================================================
// Model Definitions
// ============================================================================

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';

// Full model metadata with names and categories
export interface AIModelInfo {
  id: string;
  name: string;
  category: 'haiku' | 'sonnet' | 'opus';
  input: number; // EUR per 1M tokens
  output: number; // EUR per 1M tokens
}

// Available Claude models (sorted by cost, cheapest first)
// Updated December 2025 pricing (converted from USD at ~0.92 rate)
// Source: https://claude.com/pricing
export const AI_MODELS: AIModelInfo[] = [
  // Haiku models (fastest, cheapest)
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    category: 'haiku',
    input: 0.23,
    output: 1.15,
  },
  {
    id: 'claude-haiku-4-5-20250514',
    name: 'Claude Haiku 4.5',
    category: 'haiku',
    input: 0.92,
    output: 4.6,
  },

  // Sonnet models (balanced)
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    category: 'sonnet',
    input: 2.76,
    output: 13.8,
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    category: 'sonnet',
    input: 2.76,
    output: 13.8,
  },
  {
    id: 'claude-sonnet-4-5-20250514',
    name: 'Claude Sonnet 4.5',
    category: 'sonnet',
    input: 2.76,
    output: 13.8,
  },

  // Opus models (most capable)
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    category: 'opus',
    input: 13.8,
    output: 69.0,
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    category: 'opus',
    input: 13.8,
    output: 69.0,
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    category: 'opus',
    input: 4.6,
    output: 23.0,
  },
];

// Build cost lookup from model list
const MODEL_COSTS: Record<string, { input: number; output: number }> = Object.fromEntries(
  AI_MODELS.map((m) => [m.id, { input: m.input, output: m.output }])
);

// Default costs for unknown models (use Sonnet pricing as fallback)
const DEFAULT_COSTS = { input: 2.76, output: 13.8 };

/**
 * Get all available models for admin selection
 */
export function getAvailableModels(): AIModelInfo[] {
  return AI_MODELS;
}

/**
 * Calculate cost in EUR for an API call
 */
export function calculateCostEur(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] || DEFAULT_COSTS;
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

// ============================================================================
// AI Client Service
// ============================================================================

export class AIClientService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Send a chat message to Claude with automatic usage logging.
   *
   * This is the primary method for all AI calls in the gateway.
   * It wraps the Anthropic SDK and logs usage to the database.
   */
  async chat(
    messages: AIMessage[],
    options: AICallOptions,
    chatOptions: AIChatOptions = {}
  ): Promise<AIChatResponse> {
    const model = chatOptions.model || DEFAULT_MODEL;
    const maxTokens = chatOptions.maxTokens || 1024;
    const startTime = Date.now();

    try {
      // Build request
      const request: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      if (chatOptions.system) {
        request.system = chatOptions.system;
      }

      if (chatOptions.temperature !== undefined) {
        request.temperature = chatOptions.temperature;
      }

      if (chatOptions.tools && chatOptions.tools.length > 0) {
        request.tools = chatOptions.tools;
      }

      // Make API call
      const response = await this.anthropic.messages.create(request);

      const durationMs = Date.now() - startTime;
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costEur = calculateCostEur(model, inputTokens, outputTokens);

      // Log usage to database (non-blocking)
      this.logUsage({
        feature: options.feature,
        model,
        inputTokens,
        outputTokens,
        costEur,
        userId: options.userId,
        firmId: options.firmId,
        entityType: options.entityType,
        entityId: options.entityId,
        batchJobId: options.batchJobId,
        durationMs,
      }).catch((err) => {
        console.error('[AIClient] Failed to log usage:', err);
      });

      return {
        content: response.content,
        inputTokens,
        outputTokens,
        stopReason: response.stop_reason,
        model,
        costEur,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error('[AIClient] API call failed:', {
        feature: options.feature,
        model,
        durationMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Simple completion - single prompt with optional system message.
   * Convenience wrapper around chat().
   */
  async complete(
    prompt: string,
    options: AICallOptions,
    chatOptions: AIChatOptions = {}
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    costEur: number;
  }> {
    const response = await this.chat([{ role: 'user', content: prompt }], options, chatOptions);

    // Extract text content from response
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content: textContent,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costEur: response.costEur,
    };
  }

  // ============================================================================
  // Usage Logging
  // ============================================================================

  /**
   * Log AI usage to the database.
   * Called after each successful API call.
   */
  private async logUsage(data: {
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costEur: number;
    userId?: string;
    firmId: string;
    entityType?: string;
    entityId?: string;
    batchJobId?: string;
    durationMs: number;
  }): Promise<void> {
    await prisma.aIUsageLog.create({
      data: {
        feature: data.feature,
        model: data.model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costEur: new Decimal(data.costEur),
        userId: data.userId,
        firmId: data.firmId,
        entityType: data.entityType,
        entityId: data.entityId,
        batchJobId: data.batchJobId,
        durationMs: data.durationMs,
      },
    });
  }

  // ============================================================================
  // Batch Job Helpers
  // ============================================================================

  /**
   * Start a batch job run and return its ID.
   * Use this when beginning batch processing.
   */
  async startBatchJob(firmId: string, feature: string): Promise<string> {
    const job = await prisma.aIBatchJobRun.create({
      data: {
        firmId,
        feature,
        status: 'running',
        startedAt: new Date(),
      },
    });
    return job.id;
  }

  /**
   * Update batch job progress.
   * Call periodically during batch processing.
   */
  async updateBatchJobProgress(
    jobId: string,
    data: {
      itemsProcessed?: number;
      itemsFailed?: number;
      totalTokens?: number;
      totalCostEur?: number;
    }
  ): Promise<void> {
    await prisma.aIBatchJobRun.update({
      where: { id: jobId },
      data: {
        itemsProcessed: data.itemsProcessed,
        itemsFailed: data.itemsFailed,
        totalTokens: data.totalTokens,
        totalCostEur: data.totalCostEur ? new Decimal(data.totalCostEur) : undefined,
      },
    });
  }

  /**
   * Complete a batch job run.
   * Call when batch processing finishes.
   */
  async completeBatchJob(
    jobId: string,
    data: {
      status: 'completed' | 'failed' | 'partial';
      itemsProcessed: number;
      itemsFailed: number;
      totalTokens: number;
      totalCostEur: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    await prisma.aIBatchJobRun.update({
      where: { id: jobId },
      data: {
        status: data.status,
        completedAt: new Date(),
        itemsProcessed: data.itemsProcessed,
        itemsFailed: data.itemsFailed,
        totalTokens: data.totalTokens,
        totalCostEur: new Decimal(data.totalCostEur),
        errorMessage: data.errorMessage,
      },
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const aiClient = new AIClientService();
