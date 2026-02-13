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

/**
 * Split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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
  cacheEnabled?: boolean; // Enable prompt caching for system messages
  thinking?: {
    enabled: boolean;
    budgetTokens: number; // e.g., 10000 for deep research
  };
  /** Callback for real-time thinking/text events during streaming */
  onThinking?: (text: string) => void;
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
  /** Maximum number of parallel tool executions (default: 3) */
  maxParallelTools?: number;
  /** Callback for progress events during tool execution */
  onProgress?: (event: ToolProgressEvent) => void;
  /** Optional callback to check if the loop should stop early (e.g., output captured) */
  shouldStop?: () => boolean;
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
        if (chatOptions.cacheEnabled) {
          // Use cache_control for prompt caching (ephemeral = 5 minute TTL)
          request.system = [
            {
              type: 'text',
              text: chatOptions.system,
              cache_control: { type: 'ephemeral' },
            },
          ];
        } else {
          request.system = chatOptions.system;
        }
      }

      if (chatOptions.temperature !== undefined) {
        request.temperature = chatOptions.temperature;
      }

      if (chatOptions.tools && chatOptions.tools.length > 0) {
        request.tools = chatOptions.tools;
      }

      // Add thinking if enabled (Extended Thinking for deep research)
      if (chatOptions.thinking?.enabled) {
        (request as unknown as Record<string, unknown>).thinking = {
          type: 'enabled',
          budget_tokens: chatOptions.thinking.budgetTokens,
        };
        // Temperature must be unset or 1 for extended thinking
        delete request.temperature;
      }

      // Make API call
      // Use streaming for tool-based requests to avoid 10-minute timeout
      // (Anthropic requires streaming for operations that may exceed 10 minutes)
      let response: Anthropic.Message;
      if (chatOptions.tools && chatOptions.tools.length > 0) {
        // Stream and emit thinking events in real-time
        const stream = this.anthropic.messages.stream(request);

        // Process stream events to emit thinking progress
        // Only emit actual thinking content (thinking_delta), not document text (text_delta)
        if (chatOptions.onThinking) {
          // Accumulate thinking text and emit in readable chunks
          let thinkingBuffer = '';
          const CHUNK_SIZE = 80; // Emit every ~80 chars for readable progress
          let eventCount = 0;
          let thinkingDeltaCount = 0;

          console.log('[AI-Client] Starting stream iteration with onThinking callback');
          const fs = await import('fs');
          fs.appendFileSync(
            '/tmp/ai-debug.log',
            `[${new Date().toISOString()}] Starting stream iteration\n`
          );

          // Track text_delta events for progress updates when no thinking
          let textDeltaCount = 0;
          let lastProgressTime = Date.now();

          for await (const event of stream) {
            eventCount++;
            // Log every event to debug file to track stream progress
            if (eventCount <= 3 || eventCount % 20 === 0) {
              fs.appendFileSync(
                '/tmp/ai-debug.log',
                `[${new Date().toISOString()}] Event ${eventCount}: ${event.type}\n`
              );
            }
            if (event.type === 'content_block_delta') {
              const deltaType = (event.delta as { type: string }).type;
              if (eventCount <= 5 || eventCount % 50 === 0) {
                console.log(
                  `[AI-Client] Event ${eventCount}: content_block_delta, delta.type=${deltaType}`
                );
              }

              // Only handle extended thinking content (thinking_delta)
              // text_delta contains document content (HTML), not thoughts
              if (deltaType === 'thinking_delta') {
                thinkingDeltaCount++;
                const thinking = (event.delta as { thinking: string }).thinking;
                if (thinking && thinking.length > 0) {
                  thinkingBuffer += thinking;

                  // Emit when buffer is large enough or hits sentence boundary
                  if (
                    thinkingBuffer.length >= CHUNK_SIZE ||
                    (thinkingBuffer.length > 20 &&
                      (thinkingBuffer.endsWith('. ') ||
                        thinkingBuffer.endsWith('.\n') ||
                        thinkingBuffer.endsWith('? ') ||
                        thinkingBuffer.endsWith('! ')))
                  ) {
                    console.log(
                      `[AI-Client] Emitting thinking chunk: ${thinkingBuffer.substring(0, 50)}...`
                    );
                    chatOptions.onThinking(thinkingBuffer.trim());
                    thinkingBuffer = '';
                    lastProgressTime = Date.now();
                  }
                }
              } else if (deltaType === 'text_delta') {
                textDeltaCount++;
                // Emit periodic progress for text generation (every 3 seconds)
                // This keeps the connection alive and shows the UI is still working
                if (Date.now() - lastProgressTime > 3000) {
                  chatOptions.onThinking('Redactează documentul...');
                  lastProgressTime = Date.now();
                }
              }
            }
          }

          console.log(
            `[AI-Client] Stream complete. Events: ${eventCount}, thinking_delta: ${thinkingDeltaCount}`
          );
          fs.appendFileSync(
            '/tmp/ai-debug.log',
            `[${new Date().toISOString()}] Stream complete. Events: ${eventCount}, thinking_delta: ${thinkingDeltaCount}\n`
          );

          // Emit any remaining buffer
          if (thinkingBuffer.trim().length > 0) {
            console.log(`[AI-Client] Emitting final buffer: ${thinkingBuffer.substring(0, 50)}...`);
            chatOptions.onThinking(thinkingBuffer.trim());
          }
        }

        // Get final message (stream is already consumed if we iterated, but finalMessage() still works)
        console.log('[AI-Client] Calling stream.finalMessage()...');
        const fs2 = await import('fs');
        fs2.appendFileSync(
          '/tmp/ai-debug.log',
          `[${new Date().toISOString()}] Calling stream.finalMessage()...\n`
        );
        response = await stream.finalMessage();
        fs2.appendFileSync(
          '/tmp/ai-debug.log',
          `[${new Date().toISOString()}] finalMessage returned: stopReason=${response.stop_reason}, blocks=${response.content.length}\n`
        );
        console.log('[AI-Client] stream.finalMessage() returned', {
          stopReason: response.stop_reason,
          contentBlocks: response.content.length,
          hasToolUse: response.content.some((b) => b.type === 'tool_use'),
        });
      } else {
        response = await this.anthropic.messages.create(request);
      }

      const durationMs = Date.now() - startTime;
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costEur = calculateCostEur(model, inputTokens, outputTokens);

      // Extract cache info from response (when prompt caching is enabled)
      const cacheReadTokens =
        (response.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0;
      const cacheCreationTokens =
        (response.usage as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens ??
        0;

      // Extract thinking tokens from response (when extended thinking is enabled)
      const thinkingTokens = (response.usage as { thinking_tokens?: number })?.thinking_tokens ?? 0;

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
        cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
        cacheCreationTokens: cacheCreationTokens > 0 ? cacheCreationTokens : undefined,
        thinkingTokens: thinkingTokens > 0 ? thinkingTokens : undefined,
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
    const {
      toolHandlers = {},
      maxToolRounds = 5,
      maxParallelTools = 3,
      onProgress,
      shouldStop,
      ...restOptions
    } = chatOptions;

    let currentMessages = [...messages];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalDurationMs = 0;
    let finalResponse: AIChatResponse | null = null;
    const model = restOptions.model || DEFAULT_MODEL;

    for (let round = 0; round < maxToolRounds; round++) {
      logger.debug('chatWithTools round', { round, messageCount: currentMessages.length });

      // Pass onThinking to emit real-time thinking events during streaming
      const chatOptionsWithThinking = {
        ...restOptions,
        onThinking: onProgress
          ? (text: string) => {
              // Emit thinking event for each text chunk
              onProgress({ type: 'thinking', text });
            }
          : undefined,
      };

      const response = await this.chat(currentMessages, options, chatOptionsWithThinking);

      totalInputTokens += response.inputTokens;
      totalOutputTokens += response.outputTokens;
      totalDurationMs += response.durationMs;

      // Check if Claude wants to use tools (can be multiple in one response)
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Note: Text/thinking content is now streamed in real-time via onThinking callback
      // No need to emit it again here after the response is complete

      if (toolUseBlocks.length === 0) {
        // No tool calls - we're done
        finalResponse = response;
        break;
      }

      logger.info('Tool calls requested', {
        tools: toolUseBlocks.map((b) => b.name),
        count: toolUseBlocks.length,
        maxParallel: maxParallelTools,
        chunks: Math.ceil(toolUseBlocks.length / maxParallelTools),
        round,
        feature: options.feature,
      });

      // Execute all tools and collect results
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      // Process tool calls in parallel batches
      const chunks = chunkArray(toolUseBlocks, maxParallelTools);

      for (const chunk of chunks) {
        // Emit progress for parallel batch
        if (onProgress && chunk.length > 1) {
          onProgress({
            type: 'tool_start',
            tool: `parallel(${chunk.length})`,
            text: `Executing ${chunk.length} tool calls in parallel`,
          });
        }

        // Execute all tools in this chunk in parallel
        const chunkResults = await Promise.all(
          chunk.map(async (toolUseBlock) => {
            // Find the handler for this tool
            const handler = toolHandlers[toolUseBlock.name];
            if (!handler) {
              logger.error('No handler for tool', { tool: toolUseBlock.name });
              return {
                tool_use_id: toolUseBlock.id,
                content: `Error: No handler registered for tool: ${toolUseBlock.name}`,
                error: true,
              };
            }

            // Emit tool_start event for individual tool
            if (onProgress) {
              onProgress({
                type: 'tool_start',
                tool: toolUseBlock.name,
                input: toolUseBlock.input as Record<string, unknown>,
              });
            }

            // Execute the tool
            try {
              const result = await handler(toolUseBlock.input as Record<string, unknown>);
              logger.debug('Tool executed successfully', {
                tool: toolUseBlock.name,
                resultLength: result.length,
              });

              // Emit tool_end event
              if (onProgress) {
                onProgress({
                  type: 'tool_end',
                  tool: toolUseBlock.name,
                  result: result.substring(0, 500), // Truncate for display
                });
              }

              return {
                tool_use_id: toolUseBlock.id,
                content: result,
                error: false,
              };
            } catch (error) {
              logger.error('Tool execution failed', {
                tool: toolUseBlock.name,
                error: error instanceof Error ? error.message : String(error),
              });

              // Emit tool_end with error
              if (onProgress) {
                onProgress({
                  type: 'tool_end',
                  tool: toolUseBlock.name,
                  result: `Error: ${error instanceof Error ? error.message : String(error)}`,
                });
              }

              return {
                tool_use_id: toolUseBlock.id,
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                error: true,
              };
            }
          })
        );

        // Check for partial failures and log warning
        const failedCount = chunkResults.filter((r) => r.error).length;
        if (failedCount > 0 && onProgress) {
          onProgress({
            type: 'thinking',
            text: `${failedCount} din ${chunk.length} căutări au eșuat, se continuă cu rezultatele disponibile...`,
          });
        }

        // Add all results to toolResults
        for (const result of chunkResults) {
          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: result.tool_use_id,
            content: result.content,
          });
        }
      }

      // Check if caller wants to stop early (e.g., output already captured)
      if (shouldStop?.()) {
        logger.info('chatWithTools: shouldStop returned true, exiting loop early', {
          round,
          feature: options.feature,
        });
        finalResponse = response;
        break;
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
      // Max rounds exceeded - force a final response by calling without tools
      logger.warn('Max tool rounds exceeded, forcing final response', {
        maxToolRounds,
        feature: options.feature,
      });

      // Add a message to tell the AI to stop researching and write the document
      currentMessages.push({
        role: 'user' as const,
        content:
          'ATENȚIE: Ai atins limita de căutări. NU mai folosi tool-uri. Scrie documentul final ACUM cu informațiile pe care le ai.',
      });

      // Call without tools to force text output
      // chat() expects: messages, options, chatOptions
      const forcedResponse = await this.chat(currentMessages, options, {
        ...restOptions,
        // No tools - force text output
      });

      totalInputTokens += forcedResponse.inputTokens;
      totalOutputTokens += forcedResponse.outputTokens;
      totalDurationMs += forcedResponse.durationMs;

      finalResponse = forcedResponse;
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
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    thinkingTokens?: number;
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
        cacheReadTokens: data.cacheReadTokens,
        cacheCreationTokens: data.cacheCreationTokens,
        thinkingTokens: data.thinkingTokens,
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
