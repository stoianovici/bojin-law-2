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
import logger from '../utils/logger';

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

/**
 * Handler function for executing a tool call.
 * Returns the result as a string to be sent back to Claude.
 */
export type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

/**
 * Progress event during tool execution
 */
export interface ToolProgressEvent {
  type: 'tool_start' | 'tool_end' | 'thinking';
  tool?: string;
  input?: Record<string, unknown>;
  result?: string;
  text?: string;
}

/**
 * Extended chat options for chatWithTools method.
 */
export interface AIChatWithToolsOptions extends AIChatOptions {
  /** Map of tool name to handler function */
  toolHandlers?: Record<string, ToolHandler>;
  /** Maximum number of tool-calling rounds (default: 5) */
  maxToolRounds?: number;
  /** Callback for progress events during tool execution */
  onProgress?: (event: ToolProgressEvent) => void;
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

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// Full model metadata with names and categories
export interface AIModelInfo {
  id: string;
  name: string;
  category: 'haiku' | 'sonnet' | 'opus';
  input: number; // EUR per 1M tokens
  output: number; // EUR per 1M tokens
}

// Available Claude models (sorted by cost, cheapest first)
// Pricing in USD per MTok - Source: https://claude.com/pricing (January 2026)
export const AI_MODELS: AIModelInfo[] = [
  // Haiku models (fastest, cheapest)
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    category: 'haiku',
    input: 0.25,
    output: 1.25,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    category: 'haiku',
    input: 1.0,
    output: 5.0,
  },

  // Sonnet models (balanced)
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    category: 'sonnet',
    input: 3.0,
    output: 15.0,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    category: 'sonnet',
    input: 3.0,
    output: 15.0,
  },

  // Opus models (most capable)
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    category: 'opus',
    input: 15.0,
    output: 75.0,
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    category: 'opus',
    input: 5.0,
    output: 25.0,
  },
];

// Build cost lookup from model list
const MODEL_COSTS: Record<string, { input: number; output: number }> = Object.fromEntries(
  AI_MODELS.map((m) => [m.id, { input: m.input, output: m.output }])
);

// Default costs for unknown models (use Sonnet 4 pricing as fallback)
const DEFAULT_COSTS = { input: 3.0, output: 15.0 };

/**
 * Get all available models for admin selection
 */
export function getAvailableModels(): AIModelInfo[] {
  return AI_MODELS;
}

// ============================================================================
// Model Override Resolution
// ============================================================================

// Valid model IDs that can be used directly
const VALID_MODEL_IDS = new Set(AI_MODELS.map((m) => m.id));

// Map legacy model category to the latest model ID for that category
const CATEGORY_TO_MODEL: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
};

/**
 * Get the model to use for a feature based on firm-level config overrides.
 * Checks AIModelConfig table first, then AIFeatureConfig.model as fallback.
 *
 * @param firmId - Firm ID
 * @param feature - Feature key (e.g., 'word_draft', 'document_summary')
 * @returns Model ID to use (falls back to DEFAULT_MODEL if no override)
 */
export async function getModelForFeature(firmId: string, feature: string): Promise<string> {
  try {
    // Check for model override in AIModelConfig (set via dropdown in admin UI)
    const override = await prisma.aIModelConfig.findUnique({
      where: {
        operationType_firmId: {
          operationType: feature,
          firmId,
        },
      },
    });

    if (override?.model) {
      // If it's a valid full model ID, use it directly
      if (VALID_MODEL_IDS.has(override.model)) {
        logger.debug('Using model override from AIModelConfig', {
          firmId,
          feature,
          model: override.model,
        });
        return override.model;
      }

      // Legacy support: map category (haiku/sonnet/opus) to actual model ID
      const category = override.model.toLowerCase();
      const modelId = CATEGORY_TO_MODEL[category];
      if (modelId) {
        logger.debug('Using model from category override', {
          firmId,
          feature,
          category,
          model: modelId,
        });
        return modelId;
      }

      logger.warn('Unknown model override value in AIModelConfig', {
        firmId,
        feature,
        model: override.model,
      });
    }

    // Fallback: check AIFeatureConfig.model (set via edit modal in admin UI)
    const featureConfig = await prisma.aIFeatureConfig.findUnique({
      where: {
        firmId_feature: {
          firmId,
          feature,
        },
      },
      select: { model: true },
    });

    if (featureConfig?.model) {
      if (VALID_MODEL_IDS.has(featureConfig.model)) {
        logger.debug('Using model from AIFeatureConfig', {
          firmId,
          feature,
          model: featureConfig.model,
        });
        return featureConfig.model;
      }

      // Legacy support for category names
      const category = featureConfig.model.toLowerCase();
      const modelId = CATEGORY_TO_MODEL[category];
      if (modelId) {
        logger.debug('Using model from AIFeatureConfig category', {
          firmId,
          feature,
          category,
          model: modelId,
        });
        return modelId;
      }

      logger.warn('Unknown model value in AIFeatureConfig', {
        firmId,
        feature,
        model: featureConfig.model,
      });
    }

    return DEFAULT_MODEL;
  } catch (error) {
    logger.warn('Failed to get model override, using default', { firmId, feature, error });
    return DEFAULT_MODEL;
  }
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

  /**
   * Stream a completion response, yielding text chunks as they arrive.
   * Used for real-time UI feedback (e.g., Word add-in draft streaming).
   *
   * @param prompt - The user prompt
   * @param options - AI call options (feature, userId, firmId, etc.)
   * @param chatOptions - Chat options (model, maxTokens, etc.)
   * @param onText - Callback for each text chunk
   * @returns Final aggregated response
   */
  async completeStream(
    prompt: string,
    options: AICallOptions,
    chatOptions: AIChatOptions = {},
    onText: (text: string) => void
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    costEur: number;
  }> {
    const model = chatOptions.model || DEFAULT_MODEL;
    const maxTokens = chatOptions.maxTokens || 4096;
    const startTime = Date.now();

    try {
      // Build streaming request
      const request: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      };

      if (chatOptions.system) {
        request.system = chatOptions.system;
      }

      if (chatOptions.temperature !== undefined) {
        request.temperature = chatOptions.temperature;
      }

      // Create streaming response
      const stream = await this.anthropic.messages.stream(request);

      let fullContent = '';

      // Process stream events
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          fullContent += text;
          onText(text);
        }
      }

      // Get final message for token counts
      const finalMessage = await stream.finalMessage();
      const durationMs = Date.now() - startTime;
      const inputTokens = finalMessage.usage.input_tokens;
      const outputTokens = finalMessage.usage.output_tokens;
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
        content: fullContent,
        inputTokens,
        outputTokens,
        costEur,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error('[AIClient] Streaming API call failed:', {
        feature: options.feature,
        model,
        durationMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Chat with automatic tool execution loop.
   *
   * This method handles multi-turn conversations where Claude may request
   * to use tools. It automatically executes tool handlers and continues
   * the conversation until Claude provides a final response.
   *
   * @param messages - Initial conversation messages
   * @param options - AI call options (feature, userId, firmId, etc.)
   * @param chatOptions - Chat options including tool handlers
   * @returns Final response after all tool calls are complete
   */
  async chatWithTools(
    messages: AIMessage[],
    options: AICallOptions,
    chatOptions: AIChatWithToolsOptions = {}
  ): Promise<AIChatResponse> {
    const { toolHandlers = {}, maxToolRounds = 5, onProgress, ...restOptions } = chatOptions;

    let currentMessages = [...messages];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalDurationMs = 0;
    let finalResponse: AIChatResponse | null = null;
    const model = restOptions.model || DEFAULT_MODEL;

    for (let round = 0; round < maxToolRounds; round++) {
      logger.debug('chatWithTools round', { round, messageCount: currentMessages.length });

      const response = await this.chat(currentMessages, options, restOptions);

      totalInputTokens += response.inputTokens;
      totalOutputTokens += response.outputTokens;
      totalDurationMs += response.durationMs;

      // Check if Claude wants to use tools (can be multiple in one response)
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Check for any text content (Claude's thinking/reasoning)
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      if (textBlocks.length > 0 && onProgress) {
        const thinkingText = textBlocks.map((b) => b.text).join('');
        if (thinkingText.trim()) {
          onProgress({ type: 'thinking', text: thinkingText });
        }
      }

      if (toolUseBlocks.length === 0) {
        // No tool calls - we're done
        finalResponse = response;
        break;
      }

      logger.info('Tool calls requested', {
        tools: toolUseBlocks.map((b) => b.name),
        count: toolUseBlocks.length,
        round,
        feature: options.feature,
      });

      // Execute all tools and collect results
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const toolUseBlock of toolUseBlocks) {
        // Find the handler for this tool
        const handler = toolHandlers[toolUseBlock.name];
        if (!handler) {
          logger.error('No handler for tool', { tool: toolUseBlock.name });
          throw new Error(`No handler registered for tool: ${toolUseBlock.name}`);
        }

        // Emit tool_start event
        if (onProgress) {
          onProgress({
            type: 'tool_start',
            tool: toolUseBlock.name,
            input: toolUseBlock.input as Record<string, unknown>,
          });
        }

        // Execute the tool
        let toolResult: string;
        try {
          toolResult = await handler(toolUseBlock.input as Record<string, unknown>);
          logger.debug('Tool executed successfully', {
            tool: toolUseBlock.name,
            resultLength: toolResult.length,
          });
        } catch (error) {
          logger.error('Tool execution failed', {
            tool: toolUseBlock.name,
            error: error instanceof Error ? error.message : String(error),
          });
          toolResult = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }

        // Emit tool_end event
        if (onProgress) {
          onProgress({
            type: 'tool_end',
            tool: toolUseBlock.name,
            result: toolResult.substring(0, 500), // Truncate for display
          });
        }

        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      // Add assistant response and ALL tool results to messages for next round
      currentMessages = [
        ...currentMessages,
        {
          role: 'assistant' as const,
          content: response.content,
        },
        {
          role: 'user' as const,
          content: toolResults,
        },
      ];
    }

    if (!finalResponse) {
      logger.warn('Max tool rounds exceeded', { maxToolRounds, feature: options.feature });
      throw new Error(`Max tool rounds (${maxToolRounds}) exceeded without final response`);
    }

    // Return aggregated response
    return {
      ...finalResponse,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costEur: calculateCostEur(model, totalInputTokens, totalOutputTokens),
      durationMs: totalDurationMs,
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
