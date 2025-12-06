/**
 * Daily Digest Worker
 * Story 4.6: Task Collaboration and Updates (AC: 6)
 *
 * Sends daily digest emails summarizing case activity to subscribed users.
 * Runs daily at a configurable time (default: 7 AM local timezone).
 */

import { prisma } from '@legal-platform/database';
import { caseSubscriptionService } from '../services/case-subscription.service';
import { sendDailyDigestEmail } from '../services/email.service';
import * as cron from 'node-cron';

// ============================================================================
// Configuration
// ============================================================================

interface DigestWorkerConfig {
  enabled: boolean;
  cronSchedule: string; // Cron expression (default: "0 7 * * *" = 7 AM daily)
  timezone: string; // Timezone for cron (default: Europe/Bucharest)
}

const DEFAULT_CONFIG: DigestWorkerConfig = {
  enabled: process.env.DIGEST_WORKER_ENABLED !== 'false',
  cronSchedule: process.env.DIGEST_WORKER_CRON || '0 7 * * *', // 7 AM daily
  timezone: process.env.DIGEST_WORKER_TIMEZONE || 'Europe/Bucharest',
};

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;

// Track sent digests to prevent duplicates within same run
const sentDigests = new Set<string>();

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the daily digest worker
 * @param config - Optional configuration overrides
 */
export function startDailyDigestWorker(config: Partial<DigestWorkerConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log('[Daily Digest Worker] Worker is disabled');
    return;
  }

  if (isRunning) {
    console.log('[Daily Digest Worker] Worker is already running');
    return;
  }

  console.log('[Daily Digest Worker] Starting worker...');
  console.log(`[Daily Digest Worker] Schedule: ${finalConfig.cronSchedule}`);
  console.log(`[Daily Digest Worker] Timezone: ${finalConfig.timezone}`);

  isRunning = true;

  // Schedule cron job
  cronJob = cron.schedule(
    finalConfig.cronSchedule,
    () => {
      processDigests().catch((error) => {
        console.error('[Daily Digest Worker] Error processing digests:', error);
      });
    },
    {
      timezone: finalConfig.timezone,
    }
  );

  console.log('[Daily Digest Worker] Worker started successfully');
}

/**
 * Stop the daily digest worker
 */
export function stopDailyDigestWorker(): void {
  if (!isRunning) {
    console.log('[Daily Digest Worker] Worker is not running');
    return;
  }

  console.log('[Daily Digest Worker] Stopping worker...');

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  isRunning = false;
  sentDigests.clear();

  console.log('[Daily Digest Worker] Worker stopped successfully');
}

/**
 * Check if the worker is running
 */
export function isDailyDigestWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger digest processing (for testing)
 */
export async function triggerDigestProcessing(): Promise<void> {
  await processDigests();
}

// ============================================================================
// Digest Processing
// ============================================================================

async function processDigests(): Promise<void> {
  console.log('[Daily Digest Worker] Processing digests...');

  const startTime = Date.now();
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    // Get all users who should receive digests
    const userIds = await caseSubscriptionService.getUsersForDailyDigest();
    console.log(`[Daily Digest Worker] Found ${userIds.length} users with digest subscriptions`);

    // Get access token for sending emails
    const accessToken = process.env.GRAPH_SERVICE_TOKEN || '';
    if (!accessToken) {
      console.warn('[Daily Digest Worker] No GRAPH_SERVICE_TOKEN configured, skipping email send');
    }

    // Yesterday's date for digest
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Process each user
    for (const userId of userIds) {
      const digestKey = `${userId}:${yesterday.toISOString().split('T')[0]}`;

      // Skip if already sent
      if (sentDigests.has(digestKey)) {
        skipCount++;
        continue;
      }

      try {
        // Get user info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        if (!user) {
          console.warn(`[Daily Digest Worker] User not found: ${userId}`);
          continue;
        }

        // Generate digest
        const digest = await caseSubscriptionService.generateDailyDigest(userId, yesterday);

        // Skip if no updates
        if (digest.cases.length === 0) {
          skipCount++;
          sentDigests.add(digestKey);
          continue;
        }

        // Send email
        if (accessToken) {
          const userName = `${user.firstName} ${user.lastName}`;
          const success = await sendDailyDigestEmail(
            user.email,
            userName,
            digest,
            accessToken
          );

          if (success) {
            successCount++;
            sentDigests.add(digestKey);
            console.log(`[Daily Digest Worker] Sent digest to ${user.email}`);
          } else {
            errorCount++;
            console.error(`[Daily Digest Worker] Failed to send digest to ${user.email}`);
          }
        } else {
          // Log what would have been sent
          console.log(`[Daily Digest Worker] Would send digest to ${user.email} (${digest.cases.length} cases)`);
          successCount++;
          sentDigests.add(digestKey);
        }
      } catch (error) {
        errorCount++;
        console.error(`[Daily Digest Worker] Error processing user ${userId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Daily Digest Worker] Processing complete in ${duration}ms`);
    console.log(`[Daily Digest Worker] Results: ${successCount} sent, ${skipCount} skipped, ${errorCount} errors`);
  } catch (error) {
    console.error('[Daily Digest Worker] Fatal error:', error);
    throw error;
  }
}

// ============================================================================
// Cleanup
// ============================================================================

// Clean up old sent digest keys daily (prevent memory leak)
setInterval(
  () => {
    if (sentDigests.size > 10000) {
      // Clear all - they're keyed by date so old ones won't be re-sent
      const before = sentDigests.size;
      sentDigests.clear();
      console.log(`[Daily Digest Worker] Cleared ${before} digest tracking entries`);
    }
  },
  24 * 60 * 60 * 1000 // Once per day
);
