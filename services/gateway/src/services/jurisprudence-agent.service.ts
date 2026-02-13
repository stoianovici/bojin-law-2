/**
 * Jurisprudence Agent Service
 *
 * Orchestrates jurisprudence research using Claude to search Romanian court databases
 * and produce properly formatted citations.
 */

import { aiClient, AIMessage, ToolProgressEvent, calculateCostEur } from './ai-client.service';
import { JURISPRUDENCE_AGENT_TOOLS } from './jurisprudence-agent-tools.schema';
import {
  createJurisprudenceToolHandlers,
  checkJurisprudenceRateLimit,
} from './jurisprudence-agent-tools.handlers';
import {
  JURISPRUDENCE_AGENT_SYSTEM_PROMPT,
  buildJurisprudenceUserMessage,
} from './jurisprudence-agent.prompts';
import {
  JurisprudenceAgentContext,
  JurisprudenceResearchOutput,
  JurisprudenceResearchResult,
  JurisprudenceResearchOptions,
  JurisprudenceProgressEvent,
  JURISPRUDENCE_CONSTRAINTS,
  JURISPRUDENCE_SOURCES,
} from './jurisprudence-agent.types';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

// Use Sonnet for better reasoning on citation extraction
const RESEARCH_MODEL = process.env.JURISPRUDENCE_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = JURISPRUDENCE_CONSTRAINTS.MAX_SEARCH_ROUNDS;

/**
 * Map ToolProgressEvent to JurisprudenceProgressEvent.
 */
function mapProgressEvent(
  event: ToolProgressEvent,
  onProgress?: (event: JurisprudenceProgressEvent) => void
): void {
  if (!onProgress) return;

  // Map tool events to our progress events
  if (event.type === 'tool_start' && event.tool === 'search_jurisprudence') {
    onProgress({
      type: 'search_start',
      message: `Căutare: ${(event.input as { query?: string })?.query || '...'}`,
      data: { searchQuery: (event.input as { query?: string })?.query },
    });
  } else if (event.type === 'tool_end' && event.tool === 'search_jurisprudence') {
    onProgress({
      type: 'search_complete',
      message: 'Căutare completată',
    });
  } else if (event.type === 'tool_start' && event.tool === 'submit_jurisprudence_notes') {
    onProgress({
      type: 'analysis_start',
      message: 'Finalizare notă jurisprudențială...',
    });
  }
}

// ============================================================================
// Main Service
// ============================================================================

/**
 * Run jurisprudence research on a given topic.
 *
 * @param topic - The legal topic to research
 * @param context - Additional context for the research
 * @param agentContext - User and firm context
 * @param options - Progress callback and other options
 * @returns Research result with citations and analysis
 */
export async function runJurisprudenceResearch(
  topic: string,
  context: string | undefined,
  agentContext: JurisprudenceAgentContext,
  options: JurisprudenceResearchOptions = {}
): Promise<JurisprudenceResearchResult> {
  const { onProgress, depth = 'deep' } = options;
  const startTime = Date.now();

  const { userId, firmId, correlationId } = agentContext;

  logger.info('[JurisprudenceAgent] Starting research', {
    correlationId,
    userId,
    topic: topic.slice(0, 100),
    hasContext: !!context,
    depth,
  });

  // Validate input sizes to prevent memory exhaustion
  if (topic.length > JURISPRUDENCE_CONSTRAINTS.MAX_TOPIC_LENGTH) {
    return {
      success: false,
      output: null,
      error: `Subiectul este prea lung (max ${JURISPRUDENCE_CONSTRAINTS.MAX_TOPIC_LENGTH} caractere)`,
      durationMs: Date.now() - startTime,
      tokenUsage: { input: 0, output: 0, total: 0 },
      costEur: 0,
    };
  }

  if (context && context.length > JURISPRUDENCE_CONSTRAINTS.MAX_CONTEXT_LENGTH) {
    return {
      success: false,
      output: null,
      error: `Contextul este prea lung (max ${JURISPRUDENCE_CONSTRAINTS.MAX_CONTEXT_LENGTH} caractere)`,
      durationMs: Date.now() - startTime,
      tokenUsage: { input: 0, output: 0, total: 0 },
      costEur: 0,
    };
  }

  // Check rate limit
  const rateLimitInfo = await checkJurisprudenceRateLimit(userId);
  if (!rateLimitInfo.allowed) {
    const retryAfterMinutes = Math.ceil(
      (rateLimitInfo.resetAt.getTime() - Date.now()) / (60 * 1000)
    );

    logger.warn('[JurisprudenceAgent] Rate limit exceeded', {
      correlationId,
      userId,
      remaining: rateLimitInfo.remaining,
      resetAt: rateLimitInfo.resetAt.toISOString(),
    });

    onProgress?.({
      type: 'rate_limited',
      message: `Limită atinsă. Poți efectua din nou cercetări în ${retryAfterMinutes} minute.`,
    });

    return {
      success: false,
      output: null,
      error: `Ai atins limita de cercetări. Încearcă din nou în ${retryAfterMinutes} minute.`,
      durationMs: Date.now() - startTime,
      tokenUsage: { input: 0, output: 0, total: 0 },
      costEur: 0,
    };
  }

  // Emit start event
  onProgress?.({
    type: 'search_start',
    message: 'Inițiere cercetare jurisprudențială...',
  });

  try {
    // Create tool handlers with output capture and progress callback
    const { handlers, getOutput, getSearchCount } = createJurisprudenceToolHandlers(
      agentContext,
      onProgress
    );

    // Track tool calls for logging
    const toolCallsLog: Array<{ tool: string; durationMs: number }> = [];

    // Wrap handlers to track timing
    const wrappedHandlers = Object.fromEntries(
      Object.entries(handlers).map(([name, handler]) => [
        name,
        async (input: Record<string, unknown>) => {
          const toolStart = Date.now();
          try {
            const result = await handler(input);
            toolCallsLog.push({
              tool: name,
              durationMs: Date.now() - toolStart,
            });
            return result;
          } catch (error) {
            toolCallsLog.push({
              tool: name,
              durationMs: Date.now() - toolStart,
            });
            throw error;
          }
        },
      ])
    );

    // Build messages
    const userMessage = buildJurisprudenceUserMessage(topic, context, depth);
    const messages: AIMessage[] = [{ role: 'user', content: userMessage }];

    // Progress wrapper
    const progressHandler = onProgress
      ? (event: ToolProgressEvent) => mapProgressEvent(event, onProgress)
      : undefined;

    // Run agent
    const response = await aiClient.chatWithTools(
      messages,
      {
        feature: 'jurisprudence-research',
        userId,
        firmId,
      },
      {
        model: RESEARCH_MODEL,
        maxTokens: 4096,
        tools: JURISPRUDENCE_AGENT_TOOLS,
        toolHandlers: wrappedHandlers,
        maxToolRounds: MAX_TOOL_ROUNDS,
        system: JURISPRUDENCE_AGENT_SYSTEM_PROMPT,
        onProgress: progressHandler,
      }
    );

    // Get captured output
    const output = getOutput();
    const searchCount = getSearchCount();

    if (!output) {
      logger.warn('[JurisprudenceAgent] submit_jurisprudence_notes not called', {
        correlationId,
        toolCalls: toolCallsLog.length,
      });

      onProgress?.({
        type: 'error',
        message: 'Cercetarea nu a produs rezultate structurate',
        data: { error: 'Output not captured' },
      });

      return {
        success: false,
        output: null,
        error: 'Agentul nu a trimis nota jurisprudențială',
        durationMs: Date.now() - startTime,
        tokenUsage: {
          input: response.inputTokens || 0,
          output: response.outputTokens || 0,
          total: (response.inputTokens || 0) + (response.outputTokens || 0),
        },
        costEur: calculateCostEur(
          RESEARCH_MODEL,
          response.inputTokens || 0,
          response.outputTokens || 0
        ),
      };
    }

    // Enrich metadata
    const durationMs = Date.now() - startTime;
    const inputTokens = response.inputTokens || 0;
    const outputTokens = response.outputTokens || 0;
    const costEur = calculateCostEur(RESEARCH_MODEL, inputTokens, outputTokens);

    output.metadata = {
      searchCount,
      sourcesSearched: [...JURISPRUDENCE_SOURCES],
      durationMs,
      costEur,
    };

    logger.info('[JurisprudenceAgent] Research completed', {
      correlationId,
      userId,
      topic: topic.slice(0, 50),
      durationMs,
      searchCount,
      citationCount: output.citations.length,
      gapCount: output.gaps.length,
      inputTokens,
      outputTokens,
      costEur: costEur.toFixed(4),
      toolCalls: toolCallsLog.length,
    });

    // Emit completion
    onProgress?.({
      type: 'complete',
      message: `Cercetare completată: ${output.citations.length} citări găsite`,
      data: { citationCount: output.citations.length },
    });

    return {
      success: true,
      output,
      durationMs,
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      costEur,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('[JurisprudenceAgent] Research failed', {
      correlationId,
      userId,
      topic: topic.slice(0, 50),
      durationMs,
      error: errorMessage,
    });

    onProgress?.({
      type: 'error',
      message: `Eroare: ${errorMessage}`,
      data: { error: errorMessage },
    });

    return {
      success: false,
      output: null,
      error: errorMessage,
      durationMs,
      tokenUsage: { input: 0, output: 0, total: 0 },
      costEur: 0,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const jurisprudenceAgentService = {
  runResearch: runJurisprudenceResearch,
};
