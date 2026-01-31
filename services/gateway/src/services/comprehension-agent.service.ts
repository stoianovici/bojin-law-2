/**
 * Comprehension Agent Service
 *
 * Orchestrates the generation of case comprehension using the agent loop.
 * The agent explores case data through tools and generates a "Current Picture"
 * - a narrative understanding that serves the Word Add-in.
 *
 * @see plan-case-comprehension.md for full design documentation
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma, Prisma } from '@legal-platform/database';
import { DataMap, DataMapEntry } from '@legal-platform/types';
import { aiClient, AIMessage, ToolProgressEvent } from './ai-client.service';
import { COMPREHENSION_TOOLS, createComprehensionToolHandlers } from './comprehension-tools';
import { findAnchorMatches, CorrectionWithAnchor } from '../utils/anchor-matching';
import logger from '../utils/logger';

// ============================================================================
// Constants (configurable via environment variables)
// ============================================================================

// Model configuration
const GENERATION_MODEL = process.env.COMPREHENSION_GENERATION_MODEL || 'claude-sonnet-4-5-20250929';
const GENERATION_THINKING_BUDGET = parseInt(
  process.env.COMPREHENSION_THINKING_BUDGET || '5000',
  10
);
const COMPRESSION_MODEL =
  process.env.COMPREHENSION_COMPRESSION_MODEL || 'claude-haiku-4-5-20251001';

// Validity period for comprehension (default: 24 hours)
const COMPREHENSION_VALIDITY_HOURS = parseInt(process.env.COMPREHENSION_VALIDITY_HOURS || '24', 10);

// Compression target tokens
const COMPRESSION_STANDARD_TOKENS = parseInt(
  process.env.COMPREHENSION_STANDARD_TOKENS || '400',
  10
);
const COMPRESSION_CRITICAL_TOKENS = parseInt(
  process.env.COMPREHENSION_CRITICAL_TOKENS || '100',
  10
);

// Maximum tool rounds for agent exploration
const MAX_TOOL_ROUNDS = parseInt(process.env.COMPREHENSION_MAX_TOOL_ROUNDS || '10', 10);

// Cost calculation constants (per 1K tokens, as of Jan 2026)
// Sonnet 4.5 pricing
const SONNET_INPUT_COST_PER_1K = 0.003;
const SONNET_OUTPUT_COST_PER_1K = 0.015;
// Haiku 4.5 pricing (for compression)
const HAIKU_INPUT_COST_PER_1K = 0.00025;
const HAIKU_OUTPUT_COST_PER_1K = 0.00125;

// ============================================================================
// Types
// ============================================================================

export type ComprehensionMode = 'initial' | 'update' | 'refresh';

export interface GenerateOptions {
  mode?: ComprehensionMode;
  triggeredBy?: string; // event name or 'manual'
  onProgress?: (event: ToolProgressEvent) => void;
  /**
   * IDs of corrections that triggered this regeneration.
   * These will be marked as applied directly without anchor matching,
   * since the anchor text came from the old content.
   */
  triggeredCorrectionIds?: string[];
}

export interface ComprehensionResult {
  id: string;
  caseId: string;
  currentPicture: string;
  contentStandard: string;
  contentCritical: string;
  dataMap: DataMap;
  tokensFull: number;
  tokensStandard: number;
  tokensCritical: number;
  version: number;
  generatedAt: Date;
  isStale: boolean;
}

interface AgentOutput {
  currentPicture: string;
  dataMap: DataMap;
}

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a legal case analyst. Your job is to understand a legal case and write a "Current Picture" - a concise narrative that helps lawyers work effectively on this case.

## Your Tools
You have tools to read case data:
- read_case_identity: Basic case info, client, status
- read_case_actors: Parties, team, contacts
- read_case_documents: Key documents with content
- read_case_emails: Email threads and summaries
- read_case_timeline: Past events and upcoming deadlines
- read_case_context: Existing comprehension (if any)
- read_client_context: Parent client relationship
- read_case_activities: Recent in-app activity (uploads, task completions, etc.)

## Your Task
1. Start by reading the case identity to understand what this case is about
2. Explore other data as needed - you decide what's relevant
3. Write a Current Picture that captures:
   - What someone needs to know to work on this case TODAY
   - What's most urgent or important RIGHT NOW
   - Any warnings or blockers
4. Build a Data Map linking topics to sources

## Output Format
Return JSON with two fields:
{
  "currentPicture": "markdown narrative...",
  "dataMap": { "sources": [...] }
}

## Guidelines
- Write in Romanian
- Be concise - aim for 300-500 words
- Focus on actionable information
- Highlight deadlines and risks prominently
- Don't repeat information unnecessarily
- Structure naturally based on what matters for THIS case
- Include emojis for warnings: ⚠️ for urgent items, ✓ for completed items

## Data Map Structure
Each source in dataMap.sources should have:
- id: Unique identifier (format: "doc-{uuid}", "thread-{conversationId}", "task-{uuid}")
- type: "document" | "email_thread" | "task"
- title: Human-readable title
- topics: Array of topics covered (e.g., ["contract terms", "payment"])
- tokenEstimate: Approximate token count for the full content
- excerpt: Brief preview (optional but helpful)`;

const COMPRESSION_PROMPT_TEMPLATE = (
  targetTokens: number
) => `Compress the following legal case narrative to approximately ${targetTokens} tokens while preserving:
1. Current status and next actions
2. Key deadlines (with dates)
3. Critical warnings

Output ONLY the compressed text in Romanian, no explanations or metadata.

NARRATIVE:
`;

// ============================================================================
// Helper Functions
// ============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Calculate estimated cost for a generation run.
 * Includes main generation (Sonnet) + 2 compression calls (Haiku).
 */
function calculateEstimatedCost(
  inputTokens: number,
  outputTokens: number,
  compressionInputTokens: number,
  compressionOutputTokens: number
): number {
  const sonnetCost =
    (inputTokens / 1000) * SONNET_INPUT_COST_PER_1K +
    (outputTokens / 1000) * SONNET_OUTPUT_COST_PER_1K;

  // 2 compression calls (standard + critical tiers)
  const haikuCost =
    (compressionInputTokens / 1000) * HAIKU_INPUT_COST_PER_1K * 2 +
    (compressionOutputTokens / 1000) * HAIKU_OUTPUT_COST_PER_1K * 2;

  return sonnetCost + haikuCost;
}

/**
 * Parse agent output from the response content.
 * Handles both JSON-formatted responses and fallback parsing.
 */
function parseAgentOutput(content: string): AgentOutput {
  // Try to extract JSON from the content
  const jsonMatch = content.match(/\{[\s\S]*"currentPicture"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        currentPicture: parsed.currentPicture || '',
        dataMap: parsed.dataMap || { sources: [] },
      };
    } catch {
      logger.warn('Failed to parse agent JSON output, using fallback');
    }
  }

  // Fallback: treat entire content as currentPicture
  return {
    currentPicture: content,
    dataMap: { sources: [] },
  };
}

// ============================================================================
// Comprehension Agent Service
// ============================================================================

class ComprehensionAgentService {
  /**
   * Generate or update comprehension for a case.
   */
  async generate(
    caseId: string,
    firmId: string,
    userId: string | undefined,
    options: GenerateOptions = {}
  ): Promise<ComprehensionResult> {
    const {
      mode = 'initial',
      triggeredBy = 'manual',
      onProgress,
      triggeredCorrectionIds,
    } = options;

    logger.info('[ComprehensionAgent] Starting generation', {
      caseId,
      mode,
      triggeredBy,
    });

    // Create agent run record
    const agentRun = await prisma.comprehensionAgentRun.create({
      data: {
        caseId,
        firmId,
        trigger: triggeredBy === 'manual' ? 'manual' : 'event',
        triggerEvent: triggeredBy !== 'manual' ? triggeredBy : null,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const startTime = Date.now();
    const toolCallsLog: Array<{ tool: string; args: unknown; durationMs?: number }> = [];

    try {
      // Get existing comprehension and corrections for update/refresh modes
      const existingComprehension = await this.getExisting(caseId);
      const corrections = existingComprehension
        ? await prisma.comprehensionCorrection.findMany({
            where: { comprehensionId: existingComprehension.id, isActive: true },
            select: {
              id: true,
              anchorText: true,
              anchorHash: true,
              correctionType: true,
              correctedValue: true,
              reason: true,
            },
          })
        : [];

      // Build messages
      const messages = this.buildMessages(caseId, mode, corrections);

      // Create tool handlers
      const toolHandlers = createComprehensionToolHandlers(firmId);

      // Wrap handlers to log tool calls
      const wrappedHandlers = Object.fromEntries(
        Object.entries(toolHandlers).map(([name, handler]) => [
          name,
          async (input: Record<string, unknown>) => {
            const toolStart = Date.now();
            try {
              const result = await handler(input);
              toolCallsLog.push({
                tool: name,
                args: input,
                durationMs: Date.now() - toolStart,
              });
              return result;
            } catch (error) {
              toolCallsLog.push({
                tool: name,
                args: input,
                durationMs: Date.now() - toolStart,
              });
              throw error;
            }
          },
        ])
      );

      // Run agent with tools
      const response = await aiClient.chatWithTools(
        messages,
        {
          feature: 'case_comprehension',
          userId,
          firmId,
          entityType: 'case',
          entityId: caseId,
        },
        {
          model: GENERATION_MODEL,
          thinking: {
            enabled: true,
            budgetTokens: GENERATION_THINKING_BUDGET,
          },
          maxTokens: 8192,
          tools: COMPREHENSION_TOOLS,
          toolHandlers: wrappedHandlers,
          maxToolRounds: MAX_TOOL_ROUNDS,
          system: SYSTEM_PROMPT,
          onProgress: (event) => {
            // Forward progress events
            if (onProgress) {
              onProgress(event);
            }
          },
        }
      );

      // Extract text content from response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // Extract thinking content for debugging (if extended thinking was used)
      const thinkingContent =
        response.content
          .filter((block): block is Anthropic.ThinkingBlock => block.type === 'thinking')
          .map((block) => block.thinking)
          .join('\n\n') || null;

      // Parse agent output
      const agentOutput = parseAgentOutput(textContent);

      // Validate output
      if (!agentOutput.currentPicture || agentOutput.currentPicture.length < 50) {
        throw new Error('Agent output too short or empty');
      }

      // Generate compressed tiers (includes token tracking for cost calculation)
      const { contentStandard, contentCritical, compressionInputTokens, compressionOutputTokens } =
        await this.compressTiers(agentOutput.currentPicture, firmId);

      // Calculate token counts
      const tokensFull = estimateTokens(agentOutput.currentPicture);
      const tokensStandard = estimateTokens(contentStandard);
      const tokensCritical = estimateTokens(contentCritical);

      // Determine new version
      const newVersion = existingComprehension ? existingComprehension.version + 1 : 1;

      // Upsert comprehension
      const comprehension = await prisma.caseComprehension.upsert({
        where: { caseId },
        create: {
          caseId,
          firmId,
          currentPicture: agentOutput.currentPicture,
          dataMap: agentOutput.dataMap as unknown as Prisma.InputJsonValue,
          contentStandard,
          contentCritical,
          tokensFull,
          tokensStandard,
          tokensCritical,
          version: newVersion,
          generatedAt: new Date(),
          generatedBy: agentRun.id,
          validUntil: addHours(new Date(), COMPREHENSION_VALIDITY_HOURS),
          isStale: false,
          staleSince: null,
        },
        update: {
          currentPicture: agentOutput.currentPicture,
          dataMap: agentOutput.dataMap as unknown as Prisma.InputJsonValue,
          contentStandard,
          contentCritical,
          tokensFull,
          tokensStandard,
          tokensCritical,
          version: newVersion,
          generatedAt: new Date(),
          generatedBy: agentRun.id,
          validUntil: addHours(new Date(), COMPREHENSION_VALIDITY_HOURS),
          isStale: false,
          staleSince: null, // Clear stale timestamp on successful regeneration
        },
      });

      // Mark matched corrections as applied (anchor hash matching)
      // For corrections that triggered this regeneration, skip anchor matching
      // (their anchor text was from old content and won't match)
      if (corrections.length > 0) {
        await this.matchAndApplyCorrections(
          agentOutput.currentPicture,
          corrections,
          triggeredCorrectionIds
        );
      }

      // Calculate cost for this run
      const inputTokens = response.inputTokens || 0;
      const outputTokens = response.outputTokens || 0;
      const estimatedCost = calculateEstimatedCost(
        inputTokens,
        outputTokens,
        compressionInputTokens,
        compressionOutputTokens
      );

      // Update agent run with success and cost tracking
      const durationMs = Date.now() - startTime;
      await prisma.comprehensionAgentRun.update({
        where: { id: agentRun.id },
        data: {
          comprehensionId: comprehension.id,
          status: 'COMPLETED',
          completedAt: new Date(),
          durationMs,
          toolCalls: toolCallsLog as Prisma.InputJsonValue,
          tokensUsed: inputTokens + outputTokens,
          modelId: GENERATION_MODEL,
          // Cost tracking fields
          inputTokens,
          outputTokens,
          thinkingTokens: thinkingContent ? estimateTokens(thinkingContent) : null,
          estimatedCost,
          // Debugging: persist thinking content
          thinkingContent,
        },
      });

      logger.info('[ComprehensionAgent] Generation completed', {
        caseId,
        version: newVersion,
        durationMs,
        tokensUsed: inputTokens + outputTokens,
        toolCalls: toolCallsLog.length,
        estimatedCost: estimatedCost.toFixed(6),
      });

      return {
        id: comprehension.id,
        caseId: comprehension.caseId,
        currentPicture: comprehension.currentPicture,
        contentStandard: comprehension.contentStandard,
        contentCritical: comprehension.contentCritical,
        dataMap: comprehension.dataMap as unknown as DataMap,
        tokensFull: comprehension.tokensFull,
        tokensStandard: comprehension.tokensStandard,
        tokensCritical: comprehension.tokensCritical,
        version: comprehension.version,
        generatedAt: comprehension.generatedAt,
        isStale: comprehension.isStale,
      };
    } catch (error) {
      // Update agent run with failure
      const durationMs = Date.now() - startTime;
      await prisma.comprehensionAgentRun.update({
        where: { id: agentRun.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          durationMs,
          toolCalls: toolCallsLog as Prisma.InputJsonValue,
          error: error instanceof Error ? error.message : String(error),
          retryCount: { increment: 1 },
        },
      });

      logger.error('[ComprehensionAgent] Generation failed', {
        caseId,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });

      throw error;
    }
  }

  /**
   * Get comprehension for a case, generating if needed.
   */
  async getOrGenerate(
    caseId: string,
    firmId: string,
    userId: string | undefined,
    tier: 'full' | 'standard' | 'critical' = 'standard'
  ): Promise<ComprehensionResult | null> {
    // Check for existing valid comprehension
    const existing = await this.getExisting(caseId);

    if (existing && !existing.isStale && new Date() < new Date(existing.validUntil)) {
      return {
        id: existing.id,
        caseId: existing.caseId,
        currentPicture: existing.currentPicture,
        contentStandard: existing.contentStandard,
        contentCritical: existing.contentCritical,
        dataMap: existing.dataMap as unknown as DataMap,
        tokensFull: existing.tokensFull,
        tokensStandard: existing.tokensStandard,
        tokensCritical: existing.tokensCritical,
        version: existing.version,
        generatedAt: existing.generatedAt,
        isStale: existing.isStale,
      };
    }

    // Generate new comprehension
    const mode = existing ? 'update' : 'initial';
    return this.generate(caseId, firmId, userId, { mode, triggeredBy: 'auto' });
  }

  /**
   * Get the content for a specific tier.
   */
  getContentForTier(
    comprehension: ComprehensionResult,
    tier: 'full' | 'standard' | 'critical'
  ): { content: string; tokens: number } {
    switch (tier) {
      case 'critical':
        return { content: comprehension.contentCritical, tokens: comprehension.tokensCritical };
      case 'full':
        return { content: comprehension.currentPicture, tokens: comprehension.tokensFull };
      case 'standard':
      default:
        return { content: comprehension.contentStandard, tokens: comprehension.tokensStandard };
    }
  }

  /**
   * Mark comprehension as stale without regenerating.
   */
  async markStale(caseId: string): Promise<void> {
    await prisma.caseComprehension.updateMany({
      where: { caseId },
      data: { isStale: true },
    });

    logger.debug('[ComprehensionAgent] Marked as stale', { caseId });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getExisting(caseId: string) {
    return prisma.caseComprehension.findUnique({
      where: { caseId },
    });
  }

  /**
   * Match corrections to the new content and mark as applied.
   * Uses fuzzy anchor text matching to find where corrections apply.
   *
   * @param triggeredCorrectionIds - IDs of corrections that triggered this regeneration.
   *                                 These are marked as applied directly without anchor matching,
   *                                 since the anchor text came from the old content.
   */
  private async matchAndApplyCorrections(
    newContent: string,
    corrections: Array<{ id: string; anchorText: string; anchorHash: string }>,
    triggeredCorrectionIds?: string[]
  ): Promise<void> {
    const triggeredSet = new Set(triggeredCorrectionIds || []);
    const now = new Date();

    // Mark triggered corrections as applied directly (skip anchor matching)
    if (triggeredSet.size > 0) {
      logger.info('[ComprehensionAgent] Marking triggered corrections as applied', {
        count: triggeredSet.size,
        correctionIds: Array.from(triggeredSet),
      });

      for (const correctionId of triggeredSet) {
        await prisma.comprehensionCorrection.update({
          where: { id: correctionId },
          data: { appliedAt: now },
        });
      }
    }

    // For remaining corrections, use anchor matching
    const correctionsToMatch = corrections.filter((c) => !triggeredSet.has(c.id));

    if (correctionsToMatch.length === 0) {
      logger.debug('[ComprehensionAgent] No corrections need anchor matching');
      return;
    }

    const correctionInputs: CorrectionWithAnchor[] = correctionsToMatch.map((c) => ({
      id: c.id,
      anchorText: c.anchorText,
      anchorHash: c.anchorHash,
    }));

    const matches = findAnchorMatches(newContent, correctionInputs);

    if (matches.length === 0) {
      logger.debug('[ComprehensionAgent] No correction anchor matches found');
      return;
    }

    logger.info('[ComprehensionAgent] Found correction anchor matches', {
      total: correctionsToMatch.length,
      matched: matches.length,
      matchDetails: matches.map((m) => ({
        correctionId: m.correctionId,
        similarity: m.similarity.toFixed(2),
      })),
    });

    // Mark matched corrections as applied
    for (const match of matches) {
      await prisma.comprehensionCorrection.update({
        where: { id: match.correctionId },
        data: { appliedAt: now },
      });
    }
  }

  private buildMessages(
    caseId: string,
    mode: ComprehensionMode,
    corrections: Array<{
      anchorText: string;
      correctionType: string;
      correctedValue: string;
      reason: string | null;
    }>
  ): AIMessage[] {
    let userMessage = `Generate comprehension for case ID: ${caseId}`;

    if (mode === 'update' || mode === 'refresh') {
      userMessage +=
        '\n\nThis is an update to existing comprehension. Start by reading the existing context using read_case_context.';
    }

    if (corrections.length > 0) {
      userMessage += `

## User Corrections (MUST be preserved)
The user has made these corrections. You MUST incorporate them into the new narrative:

${corrections
  .map(
    (c) => `- Original: "${c.anchorText}"
  Correction (${c.correctionType}): "${c.correctedValue}"${c.reason ? `\n  Reason: ${c.reason}` : ''}`
  )
  .join('\n\n')}`;
    }

    return [{ role: 'user', content: userMessage }];
  }

  private async compressTiers(
    currentPicture: string,
    firmId: string
  ): Promise<{
    contentStandard: string;
    contentCritical: string;
    compressionInputTokens: number;
    compressionOutputTokens: number;
  }> {
    // Compress both tiers in parallel (~2s saved)
    const standardPrompt =
      COMPRESSION_PROMPT_TEMPLATE(COMPRESSION_STANDARD_TOKENS) + currentPicture;
    const criticalPrompt =
      COMPRESSION_PROMPT_TEMPLATE(COMPRESSION_CRITICAL_TOKENS) + currentPicture;

    const [standardResponse, criticalResponse] = await Promise.all([
      aiClient.chat(
        [{ role: 'user', content: standardPrompt }],
        {
          feature: 'comprehension_compression',
          firmId,
        },
        {
          model: COMPRESSION_MODEL,
          maxTokens: 600,
          temperature: 0.3,
        }
      ),
      aiClient.chat(
        [{ role: 'user', content: criticalPrompt }],
        {
          feature: 'comprehension_compression',
          firmId,
        },
        {
          model: COMPRESSION_MODEL,
          maxTokens: 200,
          temperature: 0.3,
        }
      ),
    ]);

    const contentStandard = standardResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const contentCritical = criticalResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    // Sum token usage from both compression calls
    const compressionInputTokens =
      (standardResponse.inputTokens || 0) + (criticalResponse.inputTokens || 0);
    const compressionOutputTokens =
      (standardResponse.outputTokens || 0) + (criticalResponse.outputTokens || 0);

    return { contentStandard, contentCritical, compressionInputTokens, compressionOutputTokens };
  }
}

// Export singleton instance
export const comprehensionAgentService = new ComprehensionAgentService();
