/**
 * Firm Operations Agent Service V2
 *
 * Orchestrates the generation of firm briefings using the agent loop.
 * V2: Editor-in-Chief model - agent makes editorial decisions about
 * visual hierarchy through slot placement (lead/secondary/tertiary).
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma, Prisma } from '@legal-platform/database';
import { aiClient, AIMessage, ToolProgressEvent } from './ai-client.service';
import { FIRM_OPERATIONS_TOOLS } from './firm-operations-tools.schema';
import { createFirmOperationsToolHandlers } from './firm-operations-tools.handlers';
import { FIRM_OPERATIONS_SYSTEM_PROMPT } from './firm-operations-agent.prompts';
import {
  QuickStats,
  FirmOperationsAgentOutputV2,
  BriefingEdition,
  StoryItem,
  BriefingSection,
  BRIEFING_CONSTRAINTS,
} from './firm-operations.types';
import {
  buildFirmOperationsContext,
  getTimeBasedGreeting,
  getUserFirstName,
  isBriefingEligible,
  getTodaysBriefing,
} from './firm-operations-context.service';
import { generateEntityHref, isValidEntityId, isValidHref } from './entity-routes';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

// Model configuration
const GENERATION_MODEL = process.env.FIRM_OPS_GENERATION_MODEL || 'claude-sonnet-4-5-20250929';
const GENERATION_THINKING_BUDGET = parseInt(process.env.FIRM_OPS_THINKING_BUDGET || '3000', 10);
const MAX_TOOL_ROUNDS = parseInt(process.env.FIRM_OPS_MAX_TOOL_ROUNDS || '8', 10);

// Cost calculation constants (per 1K tokens, as of Jan 2026)
// Sonnet 4.5 pricing
const SONNET_INPUT_COST_PER_1K = 0.003;
const SONNET_OUTPUT_COST_PER_1K = 0.015;
const SONNET_THINKING_COST_PER_1K = 0.015; // Thinking tokens billed at output rate

// Cost alert threshold (in EUR)
const DAILY_COST_ALERT_THRESHOLD_EUR = parseFloat(process.env.FIRM_OPS_DAILY_COST_ALERT_EUR || '5');

// Schema version for V2
const SCHEMA_VERSION = 2;

// ============================================================================
// Types
// ============================================================================

export interface GenerateBriefingOptions {
  force?: boolean; // Regenerate even if exists
  onProgress?: (event: ToolProgressEvent) => void;
  batchJobId?: string; // For batch processing correlation
}

export interface BriefingResultV2 {
  id: string;
  edition: BriefingEdition;
  lead: StoryItem[];
  secondary: BriefingSection;
  tertiary: BriefingSection;
  quickStats: QuickStats;
  totalTokens: number;
  totalCostEur: number | null;
  isStale: boolean;
  isViewed: boolean;
  generatedAt: Date;
  schemaVersion: number;
}

// Legacy result type for backwards compatibility
export interface BriefingResult {
  id: string;
  summary: string;
  items: unknown[];
  quickStats: QuickStats;
  totalTokens: number;
  totalCostEur: number | null;
  isStale: boolean;
  isViewed: boolean;
  generatedAt: Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate cost in EUR for API usage including thinking tokens.
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number = 0
): number {
  return (
    (inputTokens / 1000) * SONNET_INPUT_COST_PER_1K +
    (outputTokens / 1000) * SONNET_OUTPUT_COST_PER_1K +
    (thinkingTokens / 1000) * SONNET_THINKING_COST_PER_1K
  );
}

/**
 * Validate V2 output structure.
 */
function validateV2Output(parsed: unknown): FirmOperationsAgentOutputV2 {
  const obj = parsed as Record<string, unknown>;

  // Validate edition
  if (!obj.edition || typeof obj.edition !== 'object') {
    throw new Error('Invalid structure: missing edition object');
  }

  // Validate lead
  if (!Array.isArray(obj.lead) || obj.lead.length === 0) {
    throw new Error('Invalid structure: lead must be non-empty array');
  }
  if (obj.lead.length > BRIEFING_CONSTRAINTS.LEAD_MAX) {
    // Trim to max allowed
    obj.lead = obj.lead.slice(0, BRIEFING_CONSTRAINTS.LEAD_MAX);
  }

  // Validate secondary
  if (!obj.secondary || typeof obj.secondary !== 'object') {
    throw new Error('Invalid structure: missing secondary section');
  }
  const secondary = obj.secondary as Record<string, unknown>;
  if (!secondary.title || !Array.isArray(secondary.items)) {
    throw new Error('Invalid structure: secondary must have title and items');
  }

  // Validate tertiary
  if (!obj.tertiary || typeof obj.tertiary !== 'object') {
    throw new Error('Invalid structure: missing tertiary section');
  }
  const tertiary = obj.tertiary as Record<string, unknown>;
  if (!tertiary.title || !Array.isArray(tertiary.items)) {
    throw new Error('Invalid structure: tertiary must have title and items');
  }

  return {
    edition: obj.edition as BriefingEdition,
    lead: obj.lead as StoryItem[],
    secondary: obj.secondary as BriefingSection,
    tertiary: obj.tertiary as BriefingSection,
    quickStats: (obj.quickStats as QuickStats) || getDefaultQuickStats(),
  };
}

/**
 * Parse agent output from the response content.
 * Uses multiple strategies for robust extraction.
 */
function parseAgentOutputV2(content: string): FirmOperationsAgentOutputV2 {
  // Strategy 1: Find JSON code block (```json ... ```)
  const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      return validateV2Output(parsed);
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 2: Find outermost JSON object using bracket matching
  let depth = 0;
  let start = -1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          const parsed = JSON.parse(content.slice(start, i + 1));
          return validateV2Output(parsed);
        } catch {
          // Reset and continue searching for another JSON object
          start = -1;
        }
      }
    }
  }

  // Strategy 3: Simple regex fallback
  const jsonMatch = content.match(/\{[\s\S]*"edition"[\s\S]*"lead"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return validateV2Output(parsed);
    } catch {
      logger.warn('[FirmOperationsAgent] Failed to parse V2 JSON output, using fallback');
    }
  }

  // Fallback: create minimal V2 output
  logger.warn('[FirmOperationsAgent] No valid V2 JSON found, creating fallback output');
  return getDefaultV2Output(content.slice(0, 200));
}

function getDefaultQuickStats(): QuickStats {
  return {
    activeCases: 0,
    urgentTasks: 0,
    teamUtilization: 0,
    unreadEmails: 0,
    overdueItems: 0,
    upcomingDeadlines: 0,
  };
}

/**
 * Factory function to create the submit_briefing tool handler.
 * Uses closure to capture the briefing data when the tool is called.
 */
function createBriefingSubmitHandler(): {
  handler: (input: Record<string, unknown>) => Promise<string>;
  getBriefing: () => FirmOperationsAgentOutputV2 | null;
} {
  let capturedBriefing: FirmOperationsAgentOutputV2 | null = null;

  return {
    handler: async (input: Record<string, unknown>): Promise<string> => {
      try {
        capturedBriefing = validateV2Output(input);
        logger.info('[FirmOperationsAgent] Briefing captured via submit_briefing tool');
        return 'Briefing primit. Generarea este completă.';
      } catch (error) {
        logger.error('[FirmOperationsAgent] submit_briefing validation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    getBriefing: () => capturedBriefing,
  };
}

/**
 * Validate entity IDs in briefing items.
 * Returns list of invalid entity references for logging.
 */
function validateBriefingEntityIds(output: FirmOperationsAgentOutputV2): {
  valid: boolean;
  invalidRefs: Array<{ itemId: string; entityType?: string; entityId?: string; reason: string }>;
} {
  const invalidRefs: Array<{
    itemId: string;
    entityType?: string;
    entityId?: string;
    reason: string;
  }> = [];

  const validateItem = (item: StoryItem) => {
    if (item.entityType && item.entityId) {
      if (!isValidEntityId(item.entityType, item.entityId)) {
        invalidRefs.push({
          itemId: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          reason: `Invalid ${item.entityType} ID format`,
        });
      }
    }
  };

  // Validate all items
  output.lead.forEach(validateItem);
  output.secondary.items.forEach(validateItem);
  output.tertiary.items.forEach(validateItem);

  return {
    valid: invalidRefs.length === 0,
    invalidRefs,
  };
}

/**
 * Enrich story items with hrefs based on entityType/entityId.
 * This post-processing ensures clickable items even if AI doesn't generate hrefs.
 * Uses anchor-to-parent pattern: tasks/docs link to parent case or calendar.
 * Also validates existing hrefs and replaces invalid ones.
 */
function enrichWithHrefs(output: FirmOperationsAgentOutputV2): FirmOperationsAgentOutputV2 {
  const enrichItem = (item: StoryItem): StoryItem => {
    // Generate item href if missing or invalid using the entity route registry
    const generatedHref =
      item.entityType && item.entityId
        ? generateEntityHref(item.entityType, item.entityId, {
            parentId: item.parentId,
            dueDate: item.dueDate,
          })
        : undefined;
    const itemHref = isValidHref(item.href) ? item.href : generatedHref;

    // Enrich details - use item's entity/parent as fallback for details without their own
    const enrichedDetails = item.details.map((detail) => {
      // If detail has a valid href, keep it
      if (isValidHref(detail.href)) return detail;

      // Try to extract entity info from detail metadata or fall back to item's entity
      const detailMetadata = detail.metadata as Record<string, string> | undefined;
      const detailEntityType = detailMetadata?.entityType || item.entityType;
      const detailEntityId = detailMetadata?.entityId || item.entityId;
      const detailParentId = detailMetadata?.parentId || item.parentId;
      const detailDueDate = detailMetadata?.dueDate || item.dueDate;

      const detailHref =
        detailEntityType && detailEntityId
          ? generateEntityHref(detailEntityType, detailEntityId, {
              parentId: detailParentId,
              dueDate: detailDueDate,
            })
          : undefined;

      return {
        ...detail,
        href: detailHref || '',
      };
    });

    return {
      ...item,
      href: itemHref,
      details: enrichedDetails,
    };
  };

  return {
    ...output,
    lead: output.lead.map(enrichItem),
    secondary: {
      ...output.secondary,
      items: output.secondary.items.map(enrichItem),
    },
    tertiary: {
      ...output.tertiary,
      items: output.tertiary.items.map(enrichItem),
    },
  };
}

function getDefaultV2Output(fallbackText: string): FirmOperationsAgentOutputV2 {
  const today = new Date().toISOString().split('T')[0];
  return {
    edition: {
      date: today,
      mood: 'steady',
      editorNote: 'Fallback output due to parsing failure',
    },
    lead: [
      {
        id: 'lead-fallback',
        headline: 'Briefing disponibil',
        summary: fallbackText || 'Datele firmei sunt disponibile pentru explorare.',
        details: [],
        category: 'case',
        canAskFollowUp: false,
      },
    ],
    secondary: {
      title: 'Context',
      items: [],
    },
    tertiary: {
      title: 'Pe Scurt',
      items: [],
    },
    quickStats: getDefaultQuickStats(),
  };
}

/**
 * Send Discord alert if daily cost exceeds threshold.
 */
async function checkDailyCostAlert(firmId: string, costEur: number): Promise<void> {
  const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
  if (!discordWebhook) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get total cost for today
  const todaysRuns = await prisma.firmBriefingRun.aggregate({
    where: {
      firmId,
      startedAt: { gte: today },
      costEur: { not: null },
    },
    _sum: { costEur: true },
  });

  const totalDailyCost = (todaysRuns._sum.costEur || 0) + costEur;

  if (totalDailyCost > DAILY_COST_ALERT_THRESHOLD_EUR) {
    try {
      await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `⚠️ **Firm Briefing Cost Alert**\nFirm ID: ${firmId}\nDaily cost: €${totalDailyCost.toFixed(2)} (threshold: €${DAILY_COST_ALERT_THRESHOLD_EUR})`,
        }),
      });
      logger.warn('[FirmOperationsAgent] Daily cost alert sent', {
        firmId,
        totalDailyCost,
        threshold: DAILY_COST_ALERT_THRESHOLD_EUR,
      });
    } catch (error) {
      logger.error('[FirmOperationsAgent] Failed to send cost alert', { error });
    }
  }
}

// ============================================================================
// Firm Operations Agent Service
// ============================================================================

class FirmOperationsAgentService {
  /**
   * Generate a firm briefing for a user (V2 Editor-in-Chief model).
   */
  async generate(
    userId: string,
    firmId: string,
    options: GenerateBriefingOptions = {}
  ): Promise<BriefingResultV2> {
    const { force = false, onProgress } = options;

    logger.info('[FirmOperationsAgent] Starting V2 generation', {
      userId,
      firmId,
      force,
    });

    // Check eligibility
    const eligibility = await isBriefingEligible(userId, firmId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || 'User not eligible for firm briefing');
    }

    // Check for existing briefing
    if (!force) {
      const existing = await getTodaysBriefing(userId);
      if (existing && !existing.isStale) {
        logger.info('[FirmOperationsAgent] Using existing briefing', {
          userId,
          briefingId: existing.id,
        });
        return this.formatResultV2(existing);
      }
    }

    // Build context
    const ctx = await buildFirmOperationsContext(userId, firmId);
    const greeting = getTimeBasedGreeting();
    const firstName = await getUserFirstName(userId);

    // Create run record
    const run = await prisma.firmBriefingRun.create({
      data: {
        firmId,
        userId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    const startTime = Date.now();
    const toolCallsLog: Array<{ tool: string; args: unknown; durationMs?: number }> = [];

    try {
      // Create tool handlers
      const toolHandlers = createFirmOperationsToolHandlers(ctx);

      // Create the submit_briefing handler with closure-based capture
      const { handler: submitBriefingHandler, getBriefing } = createBriefingSubmitHandler();

      // Wrap handlers to log calls
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

      // Add the submit_briefing handler (also wrapped for logging)
      wrappedHandlers.submit_briefing = async (input: Record<string, unknown>) => {
        const toolStart = Date.now();
        try {
          const result = await submitBriefingHandler(input);
          toolCallsLog.push({
            tool: 'submit_briefing',
            args: { ...input, _truncated: true }, // Don't log full briefing
            durationMs: Date.now() - toolStart,
          });
          return result;
        } catch (error) {
          toolCallsLog.push({
            tool: 'submit_briefing',
            args: { error: error instanceof Error ? error.message : String(error) },
            durationMs: Date.now() - toolStart,
          });
          throw error;
        }
      };

      // Build user message
      const userMessage = `${greeting}, ${firstName}! Generează briefingul matinal pentru firmă.

Data de azi: ${new Date().toLocaleDateString('ro-RO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}

Folosește instrumentele disponibile pentru a explora datele firmei și generează un briefing V2 structurat cu edition, lead, secondary și tertiary.`;

      const messages: AIMessage[] = [{ role: 'user', content: userMessage }];

      // Run agent
      const response = await aiClient.chatWithTools(
        messages,
        {
          feature: 'firm_briefing',
          userId,
          firmId,
        },
        {
          model: GENERATION_MODEL,
          thinking: {
            enabled: true,
            budgetTokens: GENERATION_THINKING_BUDGET,
          },
          maxTokens: 4096,
          tools: FIRM_OPERATIONS_TOOLS,
          toolHandlers: wrappedHandlers,
          maxToolRounds: MAX_TOOL_ROUNDS,
          system: FIRM_OPERATIONS_SYSTEM_PROMPT,
          onProgress,
        }
      );

      // Try to get briefing from tool call first (preferred method)
      let parsedOutput = getBriefing();

      if (parsedOutput) {
        logger.info('[FirmOperationsAgent] Extracted briefing via submit_briefing tool');
      } else {
        // Fallback: Parse from text content (legacy method, for graceful degradation)
        logger.warn(
          '[FirmOperationsAgent] submit_briefing tool not called, falling back to text parsing'
        );
        const textContent = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');
        parsedOutput = parseAgentOutputV2(textContent);
      }

      // Enrich with hrefs
      const agentOutput = enrichWithHrefs(parsedOutput);

      // Validate entity IDs (log warnings for invalid references)
      const entityValidation = validateBriefingEntityIds(agentOutput);
      if (!entityValidation.valid) {
        logger.warn('[FirmOperationsAgent] Invalid entity IDs detected in briefing', {
          userId,
          firmId,
          invalidRefs: entityValidation.invalidRefs,
        });
      }

      // Calculate metrics (including thinking tokens for accurate cost)
      const inputTokens = response.inputTokens || 0;
      const outputTokens = response.outputTokens || 0;
      // thinkingTokens may not be on all response types, cast to access it
      const thinkingTokens = (response as { thinkingTokens?: number }).thinkingTokens || 0;
      const totalTokens = inputTokens + outputTokens + thinkingTokens;
      const costEur = calculateCost(inputTokens, outputTokens, thinkingTokens);

      // Get today's date (normalized)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build V2 items structure for storage
      const itemsV2 = {
        edition: agentOutput.edition,
        lead: agentOutput.lead,
        secondary: agentOutput.secondary,
        tertiary: agentOutput.tertiary,
      };

      // Generate summary from lead for backwards compatibility
      const summary =
        agentOutput.lead.length > 0
          ? `${agentOutput.lead[0].headline}. ${agentOutput.lead[0].summary}`
          : 'Briefing disponibil';

      // Upsert briefing with V2 structure
      const briefing = await prisma.firmBriefing.upsert({
        where: {
          userId_briefingDate: {
            userId,
            briefingDate: today,
          },
        },
        create: {
          firmId,
          userId,
          briefingDate: today,
          summary,
          items: itemsV2 as unknown as Prisma.InputJsonValue,
          quickStats: agentOutput.quickStats as unknown as Prisma.InputJsonValue,
          schemaVersion: SCHEMA_VERSION,
          totalTokens,
          totalCostEur: costEur,
          isStale: false,
          isViewed: false,
          generatedAt: new Date(),
        },
        update: {
          summary,
          items: itemsV2 as unknown as Prisma.InputJsonValue,
          quickStats: agentOutput.quickStats as unknown as Prisma.InputJsonValue,
          schemaVersion: SCHEMA_VERSION,
          totalTokens,
          totalCostEur: costEur,
          isStale: false,
          generatedAt: new Date(),
        },
      });

      // Update run record
      const durationMs = Date.now() - startTime;
      await prisma.firmBriefingRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          inputTokens,
          outputTokens,
          thinkingTokens,
          costEur,
          toolCalls: toolCallsLog as Prisma.InputJsonValue,
        },
      });

      // Check cost alert
      await checkDailyCostAlert(firmId, costEur);

      logger.info('[FirmOperationsAgent] V2 generation completed', {
        userId,
        briefingId: briefing.id,
        durationMs,
        totalTokens,
        thinkingTokens,
        costEur: costEur.toFixed(4),
        toolCalls: toolCallsLog.length,
        schemaVersion: SCHEMA_VERSION,
      });

      return this.formatResultV2(briefing);
    } catch (error) {
      // Update run with failure
      await prisma.firmBriefingRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
          toolCalls: toolCallsLog as Prisma.InputJsonValue,
        },
      });

      logger.error('[FirmOperationsAgent] V2 generation failed', {
        userId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get existing briefing or generate new one.
   */
  async getOrGenerate(
    userId: string,
    firmId: string,
    options: GenerateBriefingOptions = {}
  ): Promise<BriefingResultV2 | null> {
    // Check eligibility first
    const eligibility = await isBriefingEligible(userId, firmId);
    if (!eligibility.eligible) {
      return null;
    }

    // Check for existing
    const existing = await getTodaysBriefing(userId);

    if (existing && !existing.isStale && !options.force) {
      return this.formatResultV2(existing);
    }

    // Generate new
    return this.generate(userId, firmId, options);
  }

  /**
   * Mark briefing as viewed.
   */
  async markViewed(briefingId: string, userId: string): Promise<void> {
    await prisma.firmBriefing.updateMany({
      where: { id: briefingId, userId },
      data: {
        isViewed: true,
        viewedAt: new Date(),
      },
    });
  }

  /**
   * Mark briefing as stale (needs regeneration).
   */
  async markStale(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.firmBriefing.updateMany({
      where: {
        userId,
        briefingDate: today,
      },
      data: { isStale: true },
    });
  }

  /**
   * Format database record to V2 result type.
   * Handles both V1 and V2 stored formats.
   */
  private formatResultV2(briefing: {
    id: string;
    summary: string;
    items: Prisma.JsonValue;
    quickStats: Prisma.JsonValue;
    schemaVersion?: number;
    totalTokens: number;
    totalCostEur: number | null;
    isStale: boolean;
    isViewed: boolean;
    generatedAt: Date;
  }): BriefingResultV2 {
    const items = briefing.items as Record<string, unknown>;
    const schemaVersion = briefing.schemaVersion || 1;

    // V2 format: items contains { edition, lead, secondary, tertiary }
    if (schemaVersion === 2 && items.edition && items.lead) {
      // Enrich with hrefs for any items that don't have them
      const enriched = enrichWithHrefs({
        edition: items.edition as BriefingEdition,
        lead: items.lead as StoryItem[],
        secondary: items.secondary as BriefingSection,
        tertiary: items.tertiary as BriefingSection,
        quickStats: briefing.quickStats as unknown as QuickStats,
      });
      return {
        id: briefing.id,
        ...enriched,
        totalTokens: briefing.totalTokens,
        totalCostEur: briefing.totalCostEur,
        isStale: briefing.isStale,
        isViewed: briefing.isViewed,
        generatedAt: briefing.generatedAt,
        schemaVersion: 2,
      };
    }

    // V1 format: items is array of FirmBriefingItem with severity
    // Transform to V2 format for backwards compatibility
    const v1Items = Array.isArray(items) ? items : [];
    const today = new Date().toISOString().split('T')[0];

    // Group V1 items by severity to map to V2 slots
    const critical = v1Items.filter(
      (i: unknown) => (i as Record<string, unknown>).severity === 'critical'
    );
    const warning = v1Items.filter(
      (i: unknown) => (i as Record<string, unknown>).severity === 'warning'
    );
    const info = v1Items.filter((i: unknown) => (i as Record<string, unknown>).severity === 'info');

    // Transform V1 item to V2 StoryItem
    const transformItem = (item: Record<string, unknown>): StoryItem => ({
      id: String(item.id || `item-${Math.random().toString(36).slice(2)}`),
      headline: String(item.headline || ''),
      summary: String(item.summary || ''),
      details:
        (item.details as unknown[])?.map((d: unknown) => {
          const detail = d as Record<string, unknown>;
          return {
            id: String(detail.id || ''),
            title: String(detail.title || ''),
            subtitle: String(detail.subtitle || ''),
            dueDate: detail.dueDate as string | undefined,
            dueDateLabel: detail.dueDateLabel as string | undefined,
            status: detail.status as 'on_track' | 'at_risk' | 'overdue' | undefined,
            href: String(detail.href || ''),
          };
        }) || [],
      category: (item.category as StoryItem['category']) || 'case',
      urgency:
        item.severity === 'critical' ? 'HIGH' : item.severity === 'warning' ? 'MEDIUM' : undefined,
      href: item.href as string | undefined,
      entityType: item.entityType as StoryItem['entityType'],
      entityId: item.entityId as string | undefined,
      canAskFollowUp: Boolean(item.canAskFollowUp),
    });

    // Build V2 structure from V1 data
    const lead =
      critical.length > 0
        ? critical.slice(0, 2).map(transformItem)
        : warning.length > 0
          ? [warning[0]].map(transformItem)
          : [
              {
                id: 'lead-v1-compat',
                headline: 'Briefing disponibil',
                summary: briefing.summary || 'Datele firmei sunt disponibile.',
                details: [],
                category: 'case' as const,
                canAskFollowUp: false,
              },
            ];

    // Enrich with hrefs for any items that don't have them
    const enriched = enrichWithHrefs({
      edition: {
        date: today,
        mood: critical.length > 0 ? 'urgent' : warning.length > 0 ? 'cautious' : 'steady',
      },
      lead,
      secondary: {
        title: 'Atenție',
        items: (critical.length > 2 ? critical.slice(2) : warning).slice(0, 5).map(transformItem),
      },
      tertiary: {
        title: 'Pe Scurt',
        items: info.slice(0, 5).map(transformItem),
      },
      quickStats: briefing.quickStats as unknown as QuickStats,
    });

    return {
      id: briefing.id,
      ...enriched,
      totalTokens: briefing.totalTokens,
      totalCostEur: briefing.totalCostEur,
      isStale: briefing.isStale,
      isViewed: briefing.isViewed,
      generatedAt: briefing.generatedAt,
      schemaVersion: 1, // Mark as V1-to-V2 transformed
    };
  }
}

// Export singleton
export const firmOperationsAgentService = new FirmOperationsAgentService();
