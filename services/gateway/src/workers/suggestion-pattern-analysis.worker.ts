/**
 * Suggestion Pattern Analysis Worker
 * Story 5.4: Proactive AI Suggestions System (AC: 3)
 *
 * Analyzes user action patterns weekly to detect recurring behaviors
 * that can be used for proactive AI suggestions. Stores patterns in
 * UserActionPattern table and generates pattern-based suggestions.
 *
 * Schedule: Weekly on Sunday at 2:00 AM (configurable)
 */

import { prisma } from '@legal-platform/database';
import * as cron from 'node-cron';
import Redis from 'ioredis';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

interface PatternAnalysisConfig {
  enabled: boolean;
  cronSchedule: string;
  timezone: string;
  lookbackDays: number;
  minOccurrences: number; // Minimum occurrences before suggesting pattern
  minConfidence: number; // Minimum confidence threshold
  aiServiceUrl: string;
}

const DEFAULT_CONFIG: PatternAnalysisConfig = {
  enabled: process.env.SUGGESTION_PATTERN_WORKER_ENABLED !== 'false',
  cronSchedule: process.env.SUGGESTION_PATTERN_CRON || '0 2 * * 0', // Sunday 2 AM
  timezone: process.env.PATTERN_ANALYSIS_TIMEZONE || 'Europe/Bucharest',
  lookbackDays: parseInt(process.env.PATTERN_LOOKBACK_DAYS || '90', 10),
  minOccurrences: 3, // As per story requirements
  minConfidence: 0.6,
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:3004',
};

const WORKER_NAME = 'suggestion-pattern-analysis';
const REDIS_STATE_KEY = `proactive:worker:${WORKER_NAME}:lastRun`;
const REDIS_ERROR_KEY = `proactive:worker:${WORKER_NAME}:errors`;

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let isProcessing = false;
let redis: Redis | null = null;

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the pattern analysis worker
 */
export function startSuggestionPatternWorker(config: Partial<PatternAnalysisConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    logger.info(`[${WORKER_NAME}] Worker is disabled`);
    return;
  }

  if (isRunning) {
    logger.info(`[${WORKER_NAME}] Worker is already running`);
    return;
  }

  logger.info(`[${WORKER_NAME}] Starting worker...`);
  logger.info(`[${WORKER_NAME}] Schedule: ${finalConfig.cronSchedule}`);
  logger.info(`[${WORKER_NAME}] Lookback days: ${finalConfig.lookbackDays}`);
  logger.info(`[${WORKER_NAME}] Min occurrences: ${finalConfig.minOccurrences}`);

  // Initialize Redis
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      redis = new Redis(redisUrl);
    }
  } catch (error) {
    logger.warn(`[${WORKER_NAME}] Redis not available, state tracking disabled`);
  }

  isRunning = true;

  // Schedule weekly cron job
  cronJob = cron.schedule(
    finalConfig.cronSchedule,
    () => {
      runPatternAnalysis(finalConfig).catch((error) => {
        logError(error as Error);
      });
    },
    {
      timezone: finalConfig.timezone,
    }
  );

  logger.info(`[${WORKER_NAME}] Worker started successfully`);
}

/**
 * Stop the pattern analysis worker
 */
export function stopSuggestionPatternWorker(): void {
  if (!isRunning) {
    logger.info(`[${WORKER_NAME}] Worker is not running`);
    return;
  }

  logger.info(`[${WORKER_NAME}] Stopping worker...`);

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  if (redis) {
    redis.disconnect();
    redis = null;
  }

  isRunning = false;

  logger.info(`[${WORKER_NAME}] Worker stopped successfully`);
}

/**
 * Check if the worker is running
 */
export function isSuggestionPatternWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger pattern analysis (for testing/admin)
 */
export async function triggerPatternAnalysis(): Promise<void> {
  if (isProcessing) {
    logger.warn(`[${WORKER_NAME}] Already processing`);
    return;
  }
  await runPatternAnalysis(DEFAULT_CONFIG);
}

// ============================================================================
// Pattern Analysis Logic
// ============================================================================

async function runPatternAnalysis(config: PatternAnalysisConfig): Promise<void> {
  if (isProcessing) {
    logger.warn(`[${WORKER_NAME}] Already processing, skipping`);
    return;
  }

  isProcessing = true;
  const startTime = Date.now();

  logger.info(`[${WORKER_NAME}] Running pattern analysis...`);

  let newPatterns = 0;
  let updatedPatterns = 0;
  let deactivatedPatterns = 0;

  try {
    // Get all firms
    const firms = await prisma.firm.findMany({
      select: { id: true },
    });

    logger.info(`[${WORKER_NAME}] Analyzing ${firms.length} firms`);

    for (const firm of firms) {
      // Get active users in the firm
      const users = await prisma.user.findMany({
        where: {
          firmId: firm.id,
          status: 'Active',
        },
        select: { id: true },
      });

      for (const user of users) {
        const result = await analyzeUserPatterns(user.id, firm.id, config);
        newPatterns += result.newPatterns;
        updatedPatterns += result.updatedPatterns;
        deactivatedPatterns += result.deactivatedPatterns;
      }

      // Small delay between firms
      await sleep(500);
    }

    // Update last run
    await updateLastRun();

    const duration = Date.now() - startTime;
    logger.info(`[${WORKER_NAME}] Analysis complete in ${duration}ms`);
    logger.info(
      `[${WORKER_NAME}] Results: ${newPatterns} new, ${updatedPatterns} updated, ${deactivatedPatterns} deactivated`
    );
  } catch (error) {
    await logError(error as Error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

/**
 * Analyze patterns for a specific user
 */
async function analyzeUserPatterns(
  userId: string,
  firmId: string,
  config: PatternAnalysisConfig
): Promise<{ newPatterns: number; updatedPatterns: number; deactivatedPatterns: number }> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - config.lookbackDays);

  // Get suggestion feedback to analyze user behavior
  const feedbackHistory = await prisma.suggestionFeedback.findMany({
    where: {
      userId,
      firmId,
      createdAt: { gte: lookbackDate },
    },
    include: {
      suggestion: {
        select: {
          type: true,
          category: true,
          actionPayload: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Get task completion patterns
  const rawTaskHistory = await prisma.task.findMany({
    where: {
      assignedTo: userId,
      firmId,
      completedAt: { gte: lookbackDate },
    },
    select: {
      type: true,
      completedAt: true,
      caseId: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  // Map to expected format
  const taskHistory = rawTaskHistory.map((t) => ({
    type: t.type,
    completedAt: t.completedAt,
    caseId: t.caseId,
    case: null as { caseType: { name: string } | null } | null, // Simplified - we'll skip caseType patterns
  }));

  // Detect patterns
  const detectedPatterns = detectPatternsFromHistory(feedbackHistory, taskHistory, config);

  // Get existing patterns
  const existingPatterns = await prisma.userActionPattern.findMany({
    where: { userId, firmId },
  });

  let newPatterns = 0;
  let updatedPatterns = 0;
  let deactivatedPatterns = 0;

  // Update or create patterns
  for (const pattern of detectedPatterns) {
    const existing = existingPatterns.find(
      (p) =>
        p.patternType === pattern.patternType &&
        JSON.stringify(p.triggerContext) === JSON.stringify(pattern.triggerContext)
    );

    if (existing) {
      // Update existing pattern
      await prisma.userActionPattern.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: pattern.occurrenceCount,
          confidence: pattern.confidence,
          actionSequence: JSON.parse(JSON.stringify(pattern.actionSequence)),
          lastOccurrence: pattern.lastOccurrence,
          isActive: pattern.confidence >= config.minConfidence,
        },
      });
      updatedPatterns++;
    } else if (pattern.occurrenceCount >= config.minOccurrences) {
      // Create new pattern
      await prisma.userActionPattern.create({
        data: {
          userId,
          firmId,
          patternType: pattern.patternType,
          triggerContext: JSON.parse(JSON.stringify(pattern.triggerContext)),
          actionSequence: JSON.parse(JSON.stringify(pattern.actionSequence)),
          occurrenceCount: pattern.occurrenceCount,
          confidence: pattern.confidence,
          lastOccurrence: pattern.lastOccurrence,
          isActive: pattern.confidence >= config.minConfidence,
        },
      });
      newPatterns++;
    }
  }

  // Deactivate patterns that weren't detected
  for (const existing of existingPatterns) {
    const stillDetected = detectedPatterns.find(
      (p) =>
        p.patternType === existing.patternType &&
        JSON.stringify(p.triggerContext) === JSON.stringify(existing.triggerContext)
    );

    if (!stillDetected && existing.isActive) {
      await prisma.userActionPattern.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      deactivatedPatterns++;
    }
  }

  return { newPatterns, updatedPatterns, deactivatedPatterns };
}

/**
 * Detect patterns from user history
 */
function detectPatternsFromHistory(
  feedbackHistory: Array<{
    action: string;
    createdAt: Date;
    suggestion: {
      type: string;
      category: string;
      actionPayload: unknown;
    } | null;
  }>,
  taskHistory: Array<{
    type: string;
    completedAt: Date | null;
    caseId: string;
    case: { caseType: { name: string } | null } | null;
  }>,
  config: PatternAnalysisConfig
): Array<{
  patternType: string;
  description: string;
  triggerContext: Record<string, unknown>;
  actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
  occurrenceCount: number;
  confidence: number;
  lastOccurrence: Date;
}> {
  const patterns: Array<{
    patternType: string;
    description: string;
    triggerContext: Record<string, unknown>;
    actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
    occurrenceCount: number;
    confidence: number;
    lastOccurrence: Date;
  }> = [];

  // Pattern 1: Post-task completion actions
  const postTaskPatterns = detectPostTaskPatterns(taskHistory, feedbackHistory);
  patterns.push(...postTaskPatterns);

  // Pattern 2: Time-based routines
  const timePatterns = detectTimeBasedPatterns(feedbackHistory);
  patterns.push(...timePatterns);

  // Pattern 3: Case type workflows
  const caseTypePatterns = detectCaseTypePatterns(taskHistory);
  patterns.push(...caseTypePatterns);

  // Pattern 4: Suggestion acceptance patterns
  const acceptancePatterns = detectAcceptancePatterns(feedbackHistory, config.minOccurrences);
  patterns.push(...acceptancePatterns);

  return patterns;
}

/**
 * Detect patterns after task completion
 */
function detectPostTaskPatterns(
  taskHistory: Array<{
    type: string;
    completedAt: Date | null;
    caseId: string;
  }>,
  feedbackHistory: Array<{
    action: string;
    createdAt: Date;
    suggestion: { type: string; category: string } | null;
  }>
): Array<{
  patternType: string;
  description: string;
  triggerContext: Record<string, unknown>;
  actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
  occurrenceCount: number;
  confidence: number;
  lastOccurrence: Date;
}> {
  const patterns: Array<{
    patternType: string;
    description: string;
    triggerContext: Record<string, unknown>;
    actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
    occurrenceCount: number;
    confidence: number;
    lastOccurrence: Date;
  }> = [];

  // Group by task type
  const tasksByType = new Map<string, typeof taskHistory>();
  for (const task of taskHistory) {
    if (!tasksByType.has(task.type)) {
      tasksByType.set(task.type, []);
    }
    tasksByType.get(task.type)!.push(task);
  }

  // Look for accepted suggestions after task completions
  for (const [taskType, tasks] of tasksByType) {
    if (tasks.length < 3) continue;

    // Find accepted suggestions within 24 hours of task completion
    const followingActions: Array<{ suggestionType: string; category: string }> = [];
    let lastOccurrence = new Date(0);

    for (const task of tasks) {
      if (!task.completedAt) continue;

      const completedTime = task.completedAt.getTime();
      const followUp = feedbackHistory.find(
        (fb) =>
          fb.action === 'accepted' &&
          fb.suggestion &&
          fb.createdAt.getTime() > completedTime &&
          fb.createdAt.getTime() < completedTime + 24 * 60 * 60 * 1000
      );

      if (followUp?.suggestion) {
        followingActions.push({
          suggestionType: followUp.suggestion.type,
          category: followUp.suggestion.category,
        });
        if (followUp.createdAt > lastOccurrence) {
          lastOccurrence = followUp.createdAt;
        }
      }
    }

    if (followingActions.length >= 3) {
      // Find most common follow-up action
      const actionCounts = new Map<string, number>();
      for (const action of followingActions) {
        const key = `${action.suggestionType}:${action.category}`;
        actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
      }

      const mostCommon = [...actionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (mostCommon && mostCommon[1] >= 3) {
        const [suggestionType, category] = mostCommon[0].split(':');
        patterns.push({
          patternType: 'PostTaskAction',
          description: `After completing ${taskType} tasks, user often accepts ${category} suggestions`,
          triggerContext: { taskType, event: 'task_completed' },
          actionSequence: [{ action: 'accept_suggestion', context: { suggestionType, category } }],
          occurrenceCount: mostCommon[1],
          confidence: mostCommon[1] / tasks.length,
          lastOccurrence,
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect time-based patterns
 */
function detectTimeBasedPatterns(
  feedbackHistory: Array<{
    action: string;
    createdAt: Date;
    suggestion: { type: string; category: string } | null;
  }>
): Array<{
  patternType: string;
  description: string;
  triggerContext: Record<string, unknown>;
  actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
  occurrenceCount: number;
  confidence: number;
  lastOccurrence: Date;
}> {
  const patterns: Array<{
    patternType: string;
    description: string;
    triggerContext: Record<string, unknown>;
    actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
    occurrenceCount: number;
    confidence: number;
    lastOccurrence: Date;
  }> = [];

  // Group accepted suggestions by hour of day
  const hourCounts = new Map<number, Array<{ type: string; category: string; date: Date }>>();

  for (const fb of feedbackHistory) {
    if (fb.action !== 'accepted' || !fb.suggestion) continue;

    const hour = fb.createdAt.getHours();
    if (!hourCounts.has(hour)) {
      hourCounts.set(hour, []);
    }
    hourCounts.get(hour)!.push({
      type: fb.suggestion.type,
      category: fb.suggestion.category,
      date: fb.createdAt,
    });
  }

  // Find peak hours with consistent suggestion types
  for (const [hour, suggestions] of hourCounts) {
    if (suggestions.length < 3) continue;

    // Group by type
    const typeCounts = new Map<string, number>();
    for (const s of suggestions) {
      typeCounts.set(s.type, (typeCounts.get(s.type) || 0) + 1);
    }

    const mostCommon = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (mostCommon && mostCommon[1] >= 3) {
      const lastOccurrence = suggestions
        .filter((s) => s.type === mostCommon[0])
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0].date;

      patterns.push({
        patternType: 'TimeRoutine',
        description: `User typically engages with ${mostCommon[0]} suggestions around ${hour}:00`,
        triggerContext: { hour, timeWindow: [hour - 1, hour + 1] },
        actionSequence: [{ action: 'show_suggestion', context: { suggestionType: mostCommon[0] } }],
        occurrenceCount: mostCommon[1],
        confidence: mostCommon[1] / suggestions.length,
        lastOccurrence,
      });
    }
  }

  return patterns;
}

/**
 * Detect case type workflow patterns
 */
function detectCaseTypePatterns(
  taskHistory: Array<{
    type: string;
    completedAt: Date | null;
    case: { caseType: { name: string } | null } | null;
  }>
): Array<{
  patternType: string;
  description: string;
  triggerContext: Record<string, unknown>;
  actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
  occurrenceCount: number;
  confidence: number;
  lastOccurrence: Date;
}> {
  const patterns: Array<{
    patternType: string;
    description: string;
    triggerContext: Record<string, unknown>;
    actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
    occurrenceCount: number;
    confidence: number;
    lastOccurrence: Date;
  }> = [];

  // Group by case type and look for task sequences
  const caseTypeSequences = new Map<string, Array<{ tasks: string[]; lastDate: Date }>>();

  for (const task of taskHistory) {
    if (!task.case?.caseType?.name || !task.completedAt) continue;

    const caseType = task.case.caseType.name;
    if (!caseTypeSequences.has(caseType)) {
      caseTypeSequences.set(caseType, []);
    }
    caseTypeSequences.get(caseType)!.push({
      tasks: [task.type],
      lastDate: task.completedAt,
    });
  }

  // Find consistent task sequences
  for (const [caseType, sequences] of caseTypeSequences) {
    if (sequences.length < 3) continue;

    const taskCounts = new Map<string, number>();
    for (const seq of sequences) {
      for (const t of seq.tasks) {
        taskCounts.set(t, (taskCounts.get(t) || 0) + 1);
      }
    }

    const commonTasks = [...taskCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    if (commonTasks.length >= 2) {
      const lastOccurrence = sequences.sort(
        (a, b) => b.lastDate.getTime() - a.lastDate.getTime()
      )[0].lastDate;

      patterns.push({
        patternType: 'CaseTypeWorkflow',
        description: `For ${caseType} cases, user follows pattern: ${commonTasks.join(' → ')}`,
        triggerContext: { caseType },
        actionSequence: commonTasks.map((t) => ({
          action: 'create_task',
          context: { taskType: t },
        })),
        occurrenceCount: Math.min(...commonTasks.map((t) => taskCounts.get(t) || 0)),
        confidence: 0.7,
        lastOccurrence,
      });
    }
  }

  return patterns;
}

/**
 * Detect suggestion acceptance patterns
 */
function detectAcceptancePatterns(
  feedbackHistory: Array<{
    action: string;
    createdAt: Date;
    suggestion: { type: string; category: string } | null;
  }>,
  minOccurrences: number
): Array<{
  patternType: string;
  description: string;
  triggerContext: Record<string, unknown>;
  actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
  occurrenceCount: number;
  confidence: number;
  lastOccurrence: Date;
}> {
  const patterns: Array<{
    patternType: string;
    description: string;
    triggerContext: Record<string, unknown>;
    actionSequence: Array<{ action: string; context: Record<string, unknown> }>;
    occurrenceCount: number;
    confidence: number;
    lastOccurrence: Date;
  }> = [];

  // Group by suggestion type
  const typeStats = new Map<string, { accepted: number; total: number; lastDate: Date }>();

  for (const fb of feedbackHistory) {
    if (!fb.suggestion) continue;

    const type = fb.suggestion.type;
    if (!typeStats.has(type)) {
      typeStats.set(type, { accepted: 0, total: 0, lastDate: new Date(0) });
    }

    const stats = typeStats.get(type)!;
    stats.total++;
    if (fb.action === 'accepted' || fb.action === 'modified') {
      stats.accepted++;
    }
    if (fb.createdAt > stats.lastDate) {
      stats.lastDate = fb.createdAt;
    }
  }

  // Create patterns for high-acceptance types
  for (const [type, stats] of typeStats) {
    if (stats.total < minOccurrences) continue;

    const acceptanceRate = stats.accepted / stats.total;
    if (acceptanceRate >= 0.7) {
      patterns.push({
        patternType: 'HighAcceptance',
        description: `User frequently accepts ${type} suggestions (${Math.round(acceptanceRate * 100)}% rate)`,
        triggerContext: { suggestionType: type },
        actionSequence: [{ action: 'prioritize_suggestion', context: { suggestionType: type } }],
        occurrenceCount: stats.accepted,
        confidence: acceptanceRate,
        lastOccurrence: stats.lastDate,
      });
    }
  }

  return patterns;
}

// ============================================================================
// State Management
// ============================================================================

async function updateLastRun(): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(REDIS_STATE_KEY, new Date().toISOString());
  } catch {
    // Ignore Redis errors
  }
}

async function logError(error: Error): Promise<void> {
  logger.error(`[${WORKER_NAME}] Error:`, { message: error.message, stack: error.stack });

  if (!redis) return;

  try {
    const errorEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
    });
    await redis.lpush(REDIS_ERROR_KEY, errorEntry);
    await redis.ltrim(REDIS_ERROR_KEY, 0, 99);
  } catch {
    // Ignore Redis errors
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function getWorkerHealth(): Promise<{
  workerName: string;
  lastRunAt: Date | null;
  status: 'HEALTHY' | 'STALE' | 'ERROR' | 'DISABLED';
  lastError: string | null;
}> {
  const enabled = process.env.SUGGESTION_PATTERN_WORKER_ENABLED !== 'false';
  if (!enabled) {
    return {
      workerName: WORKER_NAME,
      lastRunAt: null,
      status: 'DISABLED',
      lastError: null,
    };
  }

  let lastRunAt: Date | null = null;
  let lastError: string | null = null;

  if (redis) {
    try {
      const lastRun = await redis.get(REDIS_STATE_KEY);
      if (lastRun) lastRunAt = new Date(lastRun);

      const errors = await redis.lrange(REDIS_ERROR_KEY, 0, 0);
      if (errors.length > 0) {
        lastError = JSON.parse(errors[0]).message;
      }
    } catch {
      // Ignore Redis errors
    }
  }

  let status: 'HEALTHY' | 'STALE' | 'ERROR' | 'DISABLED' = 'HEALTHY';
  if (lastError) {
    status = 'ERROR';
  } else if (lastRunAt) {
    const daysSinceRun = (Date.now() - lastRunAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceRun > 14) {
      status = 'STALE';
    }
  }

  return { workerName: WORKER_NAME, lastRunAt, status, lastError };
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Exports
// ============================================================================

export default {
  start: startSuggestionPatternWorker,
  stop: stopSuggestionPatternWorker,
  isRunning: isSuggestionPatternWorkerRunning,
  trigger: triggerPatternAnalysis,
  getHealth: getWorkerHealth,
};
