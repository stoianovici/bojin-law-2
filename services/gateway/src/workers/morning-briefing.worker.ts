/**
 * Morning Briefing Worker
 * Story 5.4: Proactive AI Suggestions System (AC: 1)
 *
 * Generates daily morning briefings for all active users at 5:00 AM
 * in their respective timezones. Sends notifications when briefings
 * are ready and handles timezone differences appropriately.
 */

import { prisma } from '@legal-platform/database';
import * as cron from 'node-cron';
import Redis from 'ioredis';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

interface MorningBriefingWorkerConfig {
  enabled: boolean;
  cronSchedule: string; // Cron expression for morning briefing
  defaultTimezone: string; // Default timezone
  batchSize: number; // Users to process per batch
  concurrency: number; // Parallel briefing generations
  aiServiceUrl: string; // URL of the AI service
}

const DEFAULT_CONFIG: MorningBriefingWorkerConfig = {
  enabled: process.env.MORNING_BRIEFING_WORKER_ENABLED !== 'false',
  cronSchedule: process.env.MORNING_BRIEFING_CRON || '0 5 * * *', // 5 AM daily
  defaultTimezone: process.env.MORNING_BRIEFING_TIMEZONE || 'Europe/Bucharest',
  batchSize: parseInt(process.env.MORNING_BRIEFING_BATCH_SIZE || '50', 10),
  concurrency: parseInt(process.env.MORNING_BRIEFING_CONCURRENCY || '5', 10),
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:3004',
};

const WORKER_NAME = 'morning-briefing';
const REDIS_STATE_KEY = `proactive:worker:${WORKER_NAME}:lastRun`;
const REDIS_ERROR_KEY = `proactive:worker:${WORKER_NAME}:errors`;
const REDIS_GENERATED_KEY = `proactive:worker:${WORKER_NAME}:generated`;

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let isProcessing = false;
let redis: Redis | null = null;

// Track generated briefings to prevent duplicates
const generatedToday = new Set<string>();

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the morning briefing worker
 */
export function startMorningBriefingWorker(
  config: Partial<MorningBriefingWorkerConfig> = {}
): void {
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
  logger.info(`[${WORKER_NAME}] Timezone: ${finalConfig.defaultTimezone}`);
  logger.info(`[${WORKER_NAME}] Batch size: ${finalConfig.batchSize}`);

  // Initialize Redis for state tracking
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      redis = new Redis(redisUrl);
    }
  } catch (error) {
    logger.warn(`[${WORKER_NAME}] Redis not available, state tracking disabled`);
  }

  isRunning = true;

  // Schedule cron job
  cronJob = cron.schedule(
    finalConfig.cronSchedule,
    () => {
      processMorningBriefings(finalConfig).catch((error) => {
        logError(error as Error);
      });
    },
    {
      timezone: finalConfig.defaultTimezone,
    }
  );

  logger.info(`[${WORKER_NAME}] Worker started successfully`);
}

/**
 * Stop the morning briefing worker
 */
export function stopMorningBriefingWorker(): void {
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
  generatedToday.clear();

  logger.info(`[${WORKER_NAME}] Worker stopped successfully`);
}

/**
 * Check if the worker is running
 */
export function isMorningBriefingWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger briefing generation (for testing/admin)
 */
export async function triggerMorningBriefings(): Promise<void> {
  if (isProcessing) {
    logger.warn(`[${WORKER_NAME}] Already processing briefings`);
    return;
  }
  await processMorningBriefings(DEFAULT_CONFIG);
}

// ============================================================================
// Briefing Processing
// ============================================================================

async function processMorningBriefings(config: MorningBriefingWorkerConfig): Promise<void> {
  if (isProcessing) {
    logger.warn(`[${WORKER_NAME}] Already processing, skipping`);
    return;
  }

  isProcessing = true;
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];

  logger.info(`[${WORKER_NAME}] Processing morning briefings for ${today}...`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    // Get all active users who should receive briefings
    const users = await getActiveUsersForBriefings();
    logger.info(`[${WORKER_NAME}] Found ${users.length} active users`);

    // Process in batches
    for (let i = 0; i < users.length; i += config.batchSize) {
      const batch = users.slice(i, i + config.batchSize);

      // Process batch with limited concurrency
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const briefingKey = `${user.id}:${today}`;

          // Skip if already generated today
          if (generatedToday.has(briefingKey)) {
            return { status: 'skipped' as const, userId: user.id };
          }

          // Check user timezone to see if it's morning for them
          const userTimezone = getUserTimezone(user);
          if (!isMorningForUser(userTimezone)) {
            return { status: 'skipped' as const, userId: user.id, reason: 'not morning' };
          }

          try {
            // Generate briefing via AI service
            await generateBriefingForUser(user.id, user.firmId, config.aiServiceUrl);

            // Send notification
            await sendBriefingNotification(user.id, user.firmId);

            // Track as generated
            generatedToday.add(briefingKey);
            await trackGeneratedBriefing(user.id, today);

            return { status: 'success' as const, userId: user.id };
          } catch (error) {
            logger.error(`[${WORKER_NAME}] Failed to generate briefing for user ${user.id}`, {
              error: error instanceof Error ? error.message : String(error),
            });
            return { status: 'error' as const, userId: user.id, error };
          }
        })
      );

      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'success') successCount++;
          else if (result.value.status === 'skipped') skipCount++;
          else errorCount++;
        } else {
          errorCount++;
        }
      }

      // Small delay between batches to avoid overloading
      if (i + config.batchSize < users.length) {
        await sleep(1000);
      }
    }

    // Update last run timestamp
    await updateLastRun();

    const duration = Date.now() - startTime;
    logger.info(`[${WORKER_NAME}] Processing complete in ${duration}ms`);
    logger.info(
      `[${WORKER_NAME}] Results: ${successCount} generated, ${skipCount} skipped, ${errorCount} errors`
    );
  } catch (error) {
    await logError(error as Error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

/**
 * Get active users who should receive morning briefings
 */
async function getActiveUsersForBriefings(): Promise<
  Array<{
    id: string;
    firmId: string;
    email: string;
    firstName: string;
    preferences: Record<string, unknown> | null;
  }>
> {
  const users = await prisma.user.findMany({
    where: {
      status: 'Active',
      firmId: { not: null },
    },
    select: {
      id: true,
      firmId: true,
      email: true,
      firstName: true,
      preferences: true,
    },
  });

  // Filter out users who explicitly disabled AI suggestions
  return users
    .filter((u) => {
      if (!u.preferences) return true; // Default to enabled
      const prefs = u.preferences as Record<string, unknown>;
      return prefs.aiSuggestionLevel !== 'minimal';
    })
    .filter((u) => u.firmId !== null)
    .map((u) => ({
      id: u.id,
      firmId: u.firmId as string,
      email: u.email,
      firstName: u.firstName,
      preferences: u.preferences as Record<string, unknown> | null,
    }));
}

/**
 * Get user's timezone from preferences
 */
function getUserTimezone(user: { preferences: Record<string, unknown> | null }): string {
  if (user.preferences && typeof user.preferences.timezone === 'string') {
    return user.preferences.timezone;
  }
  return DEFAULT_CONFIG.defaultTimezone;
}

/**
 * Check if it's morning (5-7 AM) for a user's timezone
 */
function isMorningForUser(timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    return hour >= 5 && hour <= 7;
  } catch {
    return true; // Default to true if timezone is invalid
  }
}

/**
 * Generate briefing for a user via AI service
 */
async function generateBriefingForUser(
  userId: string,
  firmId: string,
  aiServiceUrl: string
): Promise<void> {
  // Call the AI service to generate the briefing
  const response = await fetch(`${aiServiceUrl}/api/morning-briefing/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': process.env.INTERNAL_SERVICE_KEY || '',
    },
    body: JSON.stringify({ userId, firmId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI service error: ${response.status} - ${errorText}`);
  }

  logger.debug(`[${WORKER_NAME}] Generated briefing for user ${userId}`);
}

/**
 * Send notification that briefing is ready
 */
async function sendBriefingNotification(userId: string, _firmId: string): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: 'MorningBriefingReady',
      title: 'Your Morning Briefing is Ready',
      message:
        'Your AI-powered morning briefing has been generated with prioritized tasks and key insights for today.',
      link: '/dashboard?view=briefing',
    },
  });

  logger.debug(`[${WORKER_NAME}] Sent briefing notification to user ${userId}`);
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

async function trackGeneratedBriefing(userId: string, date: string): Promise<void> {
  if (!redis) return;

  try {
    const key = `${REDIS_GENERATED_KEY}:${date}`;
    await redis.sadd(key, userId);
    await redis.expire(key, 86400 * 2); // Keep for 2 days
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
  briefingsGeneratedToday: number;
}> {
  const enabled = process.env.MORNING_BRIEFING_WORKER_ENABLED !== 'false';
  if (!enabled) {
    return {
      workerName: WORKER_NAME,
      lastRunAt: null,
      status: 'DISABLED',
      lastError: null,
      briefingsGeneratedToday: 0,
    };
  }

  let lastRunAt: Date | null = null;
  let lastError: string | null = null;
  let briefingsGeneratedToday = 0;

  if (redis) {
    try {
      const lastRun = await redis.get(REDIS_STATE_KEY);
      if (lastRun) lastRunAt = new Date(lastRun);

      const errors = await redis.lrange(REDIS_ERROR_KEY, 0, 0);
      if (errors.length > 0) {
        lastError = JSON.parse(errors[0]).message;
      }

      const today = new Date().toISOString().split('T')[0];
      briefingsGeneratedToday = (await redis.scard(`${REDIS_GENERATED_KEY}:${today}`)) || 0;
    } catch {
      // Ignore Redis errors
    }
  }

  let status: 'HEALTHY' | 'STALE' | 'ERROR' | 'DISABLED' = 'HEALTHY';
  if (lastError) {
    status = 'ERROR';
  } else if (lastRunAt) {
    const hoursSinceRun = (Date.now() - lastRunAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceRun > 48) {
      status = 'STALE';
    }
  }

  return { workerName: WORKER_NAME, lastRunAt, status, lastError, briefingsGeneratedToday };
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Clean up old tracking data daily
setInterval(
  () => {
    if (generatedToday.size > 10000) {
      const before = generatedToday.size;
      generatedToday.clear();
      logger.info(`[${WORKER_NAME}] Cleared ${before} tracking entries`);
    }
  },
  24 * 60 * 60 * 1000 // Once per day
);

// ============================================================================
// Exports
// ============================================================================

export default {
  start: startMorningBriefingWorker,
  stop: stopMorningBriefingWorker,
  isRunning: isMorningBriefingWorkerRunning,
  trigger: triggerMorningBriefings,
  getHealth: getWorkerHealth,
};
