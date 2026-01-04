/**
 * Chat Cleanup Worker
 *
 * Performs scheduled cleanup of expired team chat messages.
 * Runs daily at 2:00 AM by default (configurable via environment variables).
 *
 * Schedule: Daily at 2:00 AM (configurable)
 */

import * as cron from 'node-cron';
import { teamChatService } from '../services/team-chat.service';

// ============================================================================
// Configuration
// ============================================================================

const CHAT_CLEANUP_CRON = process.env.CHAT_CLEANUP_CRON || '0 2 * * *';
const CHAT_CLEANUP_TIMEZONE = process.env.CHAT_CLEANUP_TIMEZONE || 'Europe/Bucharest';

let cleanupTask: cron.ScheduledTask | null = null;

// ============================================================================
// Cleanup Logic
// ============================================================================

/**
 * Run the chat cleanup process
 * Cleans up expired team chat messages
 */
export async function runChatCleanup(): Promise<void> {
  const startTime = Date.now();
  console.log('[ChatCleanup] Starting cleanup of expired team chat messages...');

  try {
    const deletedCount = await teamChatService.cleanupExpiredMessages();
    const duration = Date.now() - startTime;
    console.log(`[ChatCleanup] Cleaned up ${deletedCount} expired messages in ${duration}ms`);
  } catch (error) {
    console.error('[ChatCleanup] Error during cleanup:', error);
    throw error;
  }
}

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the chat cleanup worker
 */
export function startChatCleanupWorker(): void {
  if (cleanupTask) {
    console.log('[ChatCleanup] Worker already running');
    return;
  }

  console.log(
    `[ChatCleanup] Starting worker with schedule: ${CHAT_CLEANUP_CRON} (${CHAT_CLEANUP_TIMEZONE})`
  );

  cleanupTask = cron.schedule(CHAT_CLEANUP_CRON, runChatCleanup, {
    timezone: CHAT_CLEANUP_TIMEZONE,
  });

  console.log('[ChatCleanup] Worker started successfully');
}

/**
 * Stop the chat cleanup worker
 */
export function stopChatCleanupWorker(): void {
  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = null;
    console.log('[ChatCleanup] Worker stopped');
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  start: startChatCleanupWorker,
  stop: stopChatCleanupWorker,
  runCleanup: runChatCleanup,
};
