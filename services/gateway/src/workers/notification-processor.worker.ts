/**
 * Notification Processor Worker
 * OPS-120: Notification Engine
 *
 * Runs every 5 minutes to:
 * - Process pending user activity events
 * - Route notifications to appropriate channels
 * - Queue normal events for daily digest
 *
 * Also runs daily at 7:00 AM to send digest emails.
 */

import { activityNotificationService } from '../services/activity-notification.service';

// ============================================================================
// Configuration
// ============================================================================

let notificationIntervalHandle: NodeJS.Timeout | null = null;
let digestIntervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

// Processing interval: 5 minutes
const NOTIFICATION_INTERVAL_MS = 5 * 60 * 1000;

// Digest check interval: 1 hour (actual sending determined by scheduled time)
const DIGEST_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the notification processor worker
 * @param options - Configuration options
 */
export function startNotificationProcessorWorker(options?: {
  notificationIntervalMs?: number;
  digestCheckIntervalMs?: number;
  skipInitialRun?: boolean;
}): void {
  if (isRunning) {
    console.log('[NotificationProcessorWorker] Already running');
    return;
  }

  console.log('[NotificationProcessorWorker] Starting...');

  const notificationInterval = options?.notificationIntervalMs ?? NOTIFICATION_INTERVAL_MS;
  const digestInterval = options?.digestCheckIntervalMs ?? DIGEST_CHECK_INTERVAL_MS;

  console.log(
    '[NotificationProcessorWorker] Notification interval:',
    notificationInterval / 1000 / 60,
    'minutes'
  );
  console.log(
    '[NotificationProcessorWorker] Digest check interval:',
    digestInterval / 1000 / 60,
    'minutes'
  );

  isRunning = true;

  // Run notification processing immediately (unless skipped)
  if (!options?.skipInitialRun) {
    processNotifications().catch((error) => {
      console.error(
        '[NotificationProcessorWorker] Error in initial notification processing:',
        error
      );
    });
  }

  // Run notification processing on interval
  notificationIntervalHandle = setInterval(() => {
    processNotifications().catch((error) => {
      console.error('[NotificationProcessorWorker] Error in notification processing:', error);
    });
  }, notificationInterval);

  // Run digest check on interval
  digestIntervalHandle = setInterval(() => {
    checkAndSendDigests().catch((error) => {
      console.error('[NotificationProcessorWorker] Error in digest processing:', error);
    });
  }, digestInterval);

  console.log('[NotificationProcessorWorker] Started successfully');
}

/**
 * Stop the notification processor worker
 */
export function stopNotificationProcessorWorker(): void {
  if (!isRunning) {
    console.log('[NotificationProcessorWorker] Not running');
    return;
  }

  console.log('[NotificationProcessorWorker] Stopping...');

  if (notificationIntervalHandle) {
    clearInterval(notificationIntervalHandle);
    notificationIntervalHandle = null;
  }

  if (digestIntervalHandle) {
    clearInterval(digestIntervalHandle);
    digestIntervalHandle = null;
  }

  isRunning = false;

  console.log('[NotificationProcessorWorker] Stopped');
}

export function isNotificationProcessorWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// Processing Functions
// ============================================================================

/**
 * Process pending notifications for all users
 */
async function processNotifications(): Promise<void> {
  console.log('[NotificationProcessorWorker] Processing notifications...');
  const startTime = Date.now();

  try {
    const stats = await activityNotificationService.processAllPendingEvents();
    const elapsed = Date.now() - startTime;

    console.log(
      `[NotificationProcessorWorker] Completed in ${elapsed}ms. ` +
        `Users: ${stats.usersProcessed}, Urgent: ${stats.urgentSent}, ` +
        `High: ${stats.highSent}, Queued: ${stats.normalQueued}, Errors: ${stats.errors}`
    );
  } catch (error) {
    console.error('[NotificationProcessorWorker] Error processing notifications:', error);
    throw error;
  }
}

/**
 * Check if it's time to send digests and send them
 */
async function checkAndSendDigests(): Promise<void> {
  console.log('[NotificationProcessorWorker] Checking for pending digests...');

  try {
    const result = await activityNotificationService.sendDailyDigests();
    if (result.sent > 0 || result.errors > 0) {
      console.log(
        `[NotificationProcessorWorker] Digest results - Sent: ${result.sent}, Errors: ${result.errors}`
      );
    }
  } catch (error) {
    console.error('[NotificationProcessorWorker] Error sending digests:', error);
    throw error;
  }
}

/**
 * Run cleanup of old notifications and digest entries
 */
export async function runNotificationCleanup(options?: {
  olderThanDays?: number;
}): Promise<{ deleted: number }> {
  console.log('[NotificationProcessorWorker] Running cleanup...');

  try {
    const result = await activityNotificationService.cleanup(options);
    console.log(`[NotificationProcessorWorker] Cleanup complete. Deleted ${result.deleted} items.`);
    return result;
  } catch (error) {
    console.error('[NotificationProcessorWorker] Error during cleanup:', error);
    throw error;
  }
}
