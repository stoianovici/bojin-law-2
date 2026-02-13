/**
 * Flipboard Agent Service
 *
 * Orchestrates the generation of user-scoped Flipboard items using the agent loop.
 * Uses Claude Haiku for fast, cost-effective generation.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma, Prisma } from '@legal-platform/database';
import crypto from 'crypto';
import { aiClient, AIMessage, ToolProgressEvent } from './ai-client.service';
import { FLIPBOARD_AGENT_TOOLS } from './flipboard-agent-tools.schema';
import { createFlipboardAgentToolHandlers } from './flipboard-agent-tools.handlers';
import {
  FLIPBOARD_AGENT_SYSTEM_PROMPT,
  buildFlipboardUserMessage,
  buildPortfolioContext,
  CasePortfolioItem,
} from './flipboard-agent.prompts';
import { isUserPartner } from './firm-operations-context.service';
import { caseBriefingService } from './case-briefing.service';
import type { RichCaseContext } from '@legal-platform/types';
import {
  FlipboardAgentContext,
  FlipboardAgentOutput,
  FlipboardItem,
  FlipboardTriggerType,
  FlipboardTriggerEvent,
  FLIPBOARD_CONSTRAINTS,
} from './flipboard-agent.types';
import { generateEntityHref, isValidHref } from './entity-routes';
import logger from '../utils/logger';

// ============================================================================
// Constants
// ============================================================================

// Model configuration - use Haiku for speed and cost
const GENERATION_MODEL = process.env.FLIPBOARD_GENERATION_MODEL || 'claude-3-5-haiku-20241022';
const MAX_TOOL_ROUNDS = parseInt(process.env.FLIPBOARD_MAX_TOOL_ROUNDS || '8', 10);

// Cost calculation constants (per 1K tokens, Haiku 3.5 pricing)
const HAIKU_INPUT_COST_PER_1K = 0.001;
const HAIKU_OUTPUT_COST_PER_1K = 0.005;

// ============================================================================
// Types
// ============================================================================

export interface GenerateFlipboardOptions {
  triggerType: FlipboardTriggerType;
  triggerEventType?: FlipboardTriggerEvent;
  onProgress?: (event: ToolProgressEvent) => void;
}

export interface FlipboardResult {
  id: string;
  items: FlipboardItem[];
  isRefreshing: boolean;
  generatedAt: Date;
  totalTokens: number;
  totalCostEur: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate cost in EUR for API usage.
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1000) * HAIKU_INPUT_COST_PER_1K +
    (outputTokens / 1000) * HAIKU_OUTPUT_COST_PER_1K
  );
}

/**
 * Validate and parse the agent output.
 */
function validateFlipboardOutput(parsed: unknown): FlipboardItem[] {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid output: expected object');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.items)) {
    throw new Error('Invalid output: items must be an array');
  }

  // Validate and truncate items
  const items = obj.items.slice(0, FLIPBOARD_CONSTRAINTS.MAX_ITEMS) as FlipboardItem[];

  for (const item of items) {
    if (!item.id || !item.headline || !item.summary) {
      throw new Error('Invalid item: missing required fields');
    }

    // Truncate headline and summary if needed
    item.headline = item.headline.slice(0, FLIPBOARD_CONSTRAINTS.HEADLINE_MAX_CHARS);
    item.summary = item.summary.slice(0, FLIPBOARD_CONSTRAINTS.SUMMARY_MAX_CHARS);

    // Ensure suggestedActions is an array
    if (!Array.isArray(item.suggestedActions)) {
      item.suggestedActions = [];
    }

    // Limit actions
    item.suggestedActions = item.suggestedActions.slice(
      0,
      FLIPBOARD_CONSTRAINTS.MAX_ACTIONS_PER_ITEM
    );
  }

  return items;
}

/**
 * Enrich items with hrefs based on entityType/entityId.
 */
function enrichWithHrefs(items: FlipboardItem[]): FlipboardItem[] {
  return items.map((item) => {
    // Generate hrefs for actions that need navigation
    const enrichedActions = item.suggestedActions.map((action) => {
      if (
        action.type === 'navigate' ||
        action.type === 'view_email' ||
        action.type === 'view_document'
      ) {
        if (!isValidHref(action.href)) {
          action.href = generateEntityHref(item.entityType, item.entityId, {
            parentId: item.caseId,
          });
        }
      }
      return action;
    });

    return {
      ...item,
      suggestedActions: enrichedActions,
    };
  });
}

/**
 * Get user's first name for greeting.
 */
async function getUserFirstName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });
  return user?.firstName || 'utilizator';
}

// ============================================================================
// Portfolio Context (OPS-XXX: Smarter Briefing Agent)
// ============================================================================

/**
 * Get user's active portfolio - top 5 cases with rich context.
 * Selection criteria: pending tasks, recent activity, upcoming deadlines.
 */
async function getUserActivePortfolio(
  userId: string,
  firmId: string,
  isPartner: boolean
): Promise<CasePortfolioItem[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Get user's visible cases with activity metrics
  let caseFilter: Prisma.CaseWhereInput = {
    firmId,
    status: 'Active',
  };

  // Non-partners only see assigned cases
  if (!isPartner) {
    caseFilter = {
      ...caseFilter,
      teamMembers: { some: { userId } },
    };
  }

  // Fetch cases with metrics for scoring
  const cases = await prisma.case.findMany({
    where: caseFilter,
    include: {
      client: { select: { name: true } },
      tasks: {
        where: {
          status: { not: 'Completed' },
          OR: [
            { dueDate: { lte: fourteenDaysFromNow } }, // Upcoming deadline
            { dueDate: { lt: now } }, // Overdue
          ],
        },
        select: { id: true, dueDate: true },
      },
      _count: {
        select: {
          tasks: { where: { status: { not: 'Completed' } } },
        },
      },
    },
  });

  // Get recent activity counts per case
  const recentActivity = await prisma.caseActivityEntry.groupBy({
    by: ['caseId'],
    where: {
      caseId: { in: cases.map((c) => c.id) },
      createdAt: { gte: sevenDaysAgo },
    },
    _count: { id: true },
  });
  const activityMap = new Map(recentActivity.map((a) => [a.caseId, a._count.id]));

  // Score cases for prioritization
  const scoredCases = cases.map((c) => {
    let score = 0;

    // Overdue tasks: +30 points each
    const overdueTasks = c.tasks.filter((t) => t.dueDate && t.dueDate < now);
    score += overdueTasks.length * 30;

    // Upcoming deadlines (next 7 days): +20 points each
    const urgentDeadlines = c.tasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate >= now &&
        t.dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    );
    score += urgentDeadlines.length * 20;

    // Pending tasks: +5 points each (capped at 25)
    score += Math.min(c._count.tasks * 5, 25);

    // Recent activity: +2 points per activity (capped at 20)
    const activityCount = activityMap.get(c.id) || 0;
    score += Math.min(activityCount * 2, 20);

    return {
      caseId: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      clientName: c.client?.name || null,
      richContext: null as RichCaseContext | null,
      score,
    };
  });

  // Sort by score descending, take top 5
  scoredCases.sort((a, b) => b.score - a.score);
  const topCases = scoredCases.slice(0, 5);

  // Fetch rich context for top cases in parallel
  await Promise.all(
    topCases.map(async (caseItem) => {
      try {
        const richContext = await caseBriefingService.getRichContext(caseItem.caseId);
        caseItem.richContext = richContext;
      } catch (error) {
        logger.warn('[FlipboardAgent] Failed to get rich context for case', {
          caseId: caseItem.caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );

  logger.debug('[FlipboardAgent] Portfolio loaded', {
    userId,
    casesTotal: cases.length,
    topCasesCount: topCases.length,
    casesWithContext: topCases.filter((c) => c.richContext).length,
  });

  return topCases;
}

/**
 * Create submit_flipboard handler that captures the output.
 */
function createFlipboardSubmitHandler(): {
  handler: (input: Record<string, unknown>) => Promise<string>;
  getOutput: () => FlipboardItem[] | null;
} {
  let capturedItems: FlipboardItem[] | null = null;

  return {
    handler: async (input: Record<string, unknown>): Promise<string> => {
      try {
        capturedItems = validateFlipboardOutput(input);
        logger.info('[FlipboardAgent] Items captured via submit_flipboard tool', {
          itemCount: capturedItems.length,
        });
        return 'Lista Flipboard primită. Generarea este completă.';
      } catch (error) {
        logger.error('[FlipboardAgent] submit_flipboard validation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    getOutput: () => capturedItems,
  };
}

// ============================================================================
// Flipboard Agent Service
// ============================================================================

class FlipboardAgentService {
  /**
   * Generate Flipboard items for a user.
   */
  async generate(
    userId: string,
    firmId: string,
    options: GenerateFlipboardOptions
  ): Promise<FlipboardResult> {
    const { triggerType, triggerEventType, onProgress } = options;
    const correlationId = crypto.randomUUID();

    logger.info('[FlipboardAgent] Starting generation', {
      userId,
      firmId,
      triggerType,
      triggerEventType,
      correlationId,
    });

    // Mark as refreshing
    await this.setRefreshing(userId, firmId, true);

    // Create run record
    const run = await prisma.userFlipboardRun.create({
      data: {
        firmId,
        userId,
        triggerType,
        triggerEventType: triggerEventType || null,
        status: 'running',
        startedAt: new Date(),
      },
    });

    const startTime = Date.now();
    const toolCallsLog: Array<{ tool: string; args: unknown; durationMs?: number }> = [];

    try {
      // Check if user is a partner (partners see all firm cases)
      const isPartner = await isUserPartner(userId, firmId);

      // Build context
      const ctx: FlipboardAgentContext = {
        userId,
        firmId,
        correlationId,
        isPartner,
      };

      // Create tool handlers
      const toolHandlers = createFlipboardAgentToolHandlers(ctx);

      // Create the submit_flipboard handler
      const { handler: submitHandler, getOutput } = createFlipboardSubmitHandler();

      // Wrap handlers for logging
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

      // Add submit_flipboard handler
      wrappedHandlers.submit_flipboard = async (input: Record<string, unknown>) => {
        const toolStart = Date.now();
        try {
          const result = await submitHandler(input);
          toolCallsLog.push({
            tool: 'submit_flipboard',
            args: { itemCount: (input.items as unknown[])?.length },
            durationMs: Date.now() - toolStart,
          });
          return result;
        } catch (error) {
          toolCallsLog.push({
            tool: 'submit_flipboard',
            args: { error: error instanceof Error ? error.message : String(error) },
            durationMs: Date.now() - toolStart,
          });
          throw error;
        }
      };

      // Get user name for greeting
      const userName = await getUserFirstName(userId);

      // Fetch portfolio context for smarter briefings
      const portfolio = await getUserActivePortfolio(userId, firmId, isPartner);
      const portfolioContext = buildPortfolioContext(portfolio);

      // Build enhanced system prompt with portfolio context
      const systemPrompt = portfolioContext
        ? `${FLIPBOARD_AGENT_SYSTEM_PROMPT}\n\n${portfolioContext}`
        : FLIPBOARD_AGENT_SYSTEM_PROMPT;

      logger.debug('[FlipboardAgent] System prompt built', {
        userId,
        portfolioCases: portfolio.length,
        hasPortfolioContext: !!portfolioContext,
        systemPromptLength: systemPrompt.length,
      });

      // Build user message
      const userMessage = buildFlipboardUserMessage(userName);
      const messages: AIMessage[] = [{ role: 'user', content: userMessage }];

      // Run agent
      const response = await aiClient.chatWithTools(
        messages,
        {
          feature: 'flipboard',
          userId,
          firmId,
        },
        {
          model: GENERATION_MODEL,
          maxTokens: 2048,
          tools: FLIPBOARD_AGENT_TOOLS,
          toolHandlers: wrappedHandlers,
          maxToolRounds: MAX_TOOL_ROUNDS,
          system: systemPrompt,
          onProgress,
        }
      );

      // Get captured items
      let items = getOutput();

      if (!items) {
        logger.warn('[FlipboardAgent] submit_flipboard not called, creating empty output');
        items = [];
      }

      // Enrich with hrefs
      items = enrichWithHrefs(items);

      // Calculate metrics
      const inputTokens = response.inputTokens || 0;
      const outputTokens = response.outputTokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const costEur = calculateCost(inputTokens, outputTokens);

      // Upsert flipboard
      const flipboard = await prisma.userFlipboard.upsert({
        where: { userId },
        create: {
          firmId,
          userId,
          items: items as unknown as Prisma.InputJsonValue,
          totalTokens,
          totalCostEur: costEur,
          isRefreshing: false,
          generatedAt: new Date(),
          refreshedAt: new Date(),
        },
        update: {
          items: items as unknown as Prisma.InputJsonValue,
          totalTokens,
          totalCostEur: costEur,
          isRefreshing: false,
          generatedAt: new Date(),
          refreshedAt: new Date(),
        },
      });

      // Update run record
      const durationMs = Date.now() - startTime;
      await prisma.userFlipboardRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          inputTokens,
          outputTokens,
          costEur,
          toolCalls: toolCallsLog as Prisma.InputJsonValue,
        },
      });

      logger.info('[FlipboardAgent] Generation completed', {
        userId,
        flipboardId: flipboard.id,
        durationMs,
        totalTokens,
        costEur: costEur.toFixed(4),
        itemCount: items.length,
        toolCalls: toolCallsLog.length,
      });

      return {
        id: flipboard.id,
        items,
        isRefreshing: false,
        generatedAt: flipboard.generatedAt,
        totalTokens,
        totalCostEur: costEur,
      };
    } catch (error) {
      // Update run with failure
      await prisma.userFlipboardRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
          toolCalls: toolCallsLog as Prisma.InputJsonValue,
        },
      });

      // Clear refreshing state
      await this.setRefreshing(userId, firmId, false);

      logger.error('[FlipboardAgent] Generation failed', {
        userId,
        firmId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get existing flipboard or return null.
   */
  async get(userId: string): Promise<FlipboardResult | null> {
    const flipboard = await prisma.userFlipboard.findUnique({
      where: { userId },
    });

    if (!flipboard) {
      return null;
    }

    return {
      id: flipboard.id,
      items: flipboard.items as unknown as FlipboardItem[],
      isRefreshing: flipboard.isRefreshing,
      generatedAt: flipboard.generatedAt,
      totalTokens: flipboard.totalTokens,
      totalCostEur: flipboard.totalCostEur,
    };
  }

  /**
   * Get existing flipboard and trigger refresh if needed.
   * Returns existing data immediately while refresh happens in background.
   */
  async getAndRefresh(
    userId: string,
    firmId: string,
    options: GenerateFlipboardOptions
  ): Promise<FlipboardResult | null> {
    const existing = await this.get(userId);

    // If already refreshing, just return existing
    if (existing?.isRefreshing) {
      logger.debug('[FlipboardAgent] Already refreshing, returning existing', { userId });
      return existing;
    }

    // Trigger background refresh
    this.generate(userId, firmId, options).catch((error) => {
      logger.error('[FlipboardAgent] Background refresh failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Return existing immediately (or null if none)
    return existing;
  }

  /**
   * Set the refreshing state.
   */
  private async setRefreshing(
    userId: string,
    firmId: string,
    isRefreshing: boolean
  ): Promise<void> {
    await prisma.userFlipboard.upsert({
      where: { userId },
      create: {
        firmId,
        userId,
        items: [],
        isRefreshing,
        generatedAt: new Date(),
      },
      update: {
        isRefreshing,
      },
    });
  }

  /**
   * Trigger regeneration for a high-priority event.
   * This is called when events like court emails or overdue tasks occur.
   */
  async triggerForEvent(
    userId: string,
    firmId: string,
    eventType: FlipboardTriggerEvent
  ): Promise<void> {
    logger.info('[FlipboardAgent] Triggering for event', { userId, eventType });

    // Don't await - run in background
    this.generate(userId, firmId, {
      triggerType: 'event',
      triggerEventType: eventType,
    }).catch((error) => {
      logger.error('[FlipboardAgent] Event-triggered generation failed', {
        userId,
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Trigger regeneration for user login.
   */
  async triggerForLogin(userId: string, firmId: string): Promise<FlipboardResult | null> {
    logger.info('[FlipboardAgent] Triggering for login', { userId });

    return this.getAndRefresh(userId, firmId, {
      triggerType: 'login',
    });
  }
}

// Export singleton
export const flipboardAgentService = new FlipboardAgentService();
