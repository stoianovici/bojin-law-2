/**
 * Subscription Renewal Worker
 * Story 2.5 - Task 11: Implement Subscription Renewal Worker
 *
 * Background worker that periodically renews expiring Graph API subscriptions.
 * Subscriptions expire every 3 days (4320 minutes) and must be renewed.
 *
 * Runs every hour and renews subscriptions expiring within 24 hours.
 */

import { webhookService } from '../services/webhook.service';
import logger from '../utils/logger';

// Configuration
const RENEWAL_CHECK_INTERVAL_MS = parseInt(
  process.env.SUBSCRIPTION_RENEWAL_CHECK_INTERVAL_MS || '3600000',
  10
); // Default: 1 hour
const RENEWAL_THRESHOLD_HOURS = 24; // Renew subscriptions expiring within 24 hours

// Worker state
let workerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Renew all subscriptions expiring within the threshold window
 * @param accessToken - Graph API access token for renewal calls
 * @returns Statistics about renewal operations
 */
export async function renewExpiringSubscriptions(accessToken: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}> {
  const stats = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ subscriptionId: string; error: string }>,
  };

  try {
    logger.info(
      `[Subscription Renewal Worker] Checking for expiring subscriptions (threshold: ${RENEWAL_THRESHOLD_HOURS} hours)`
    );

    // Get all subscriptions expiring within threshold
    const expiringSubscriptions =
      await webhookService.getExpiringSubscriptions(RENEWAL_THRESHOLD_HOURS);

    stats.total = expiringSubscriptions.length;

    if (expiringSubscriptions.length === 0) {
      logger.info('[Subscription Renewal Worker] No subscriptions need renewal');
      return stats;
    }

    logger.info(
      `[Subscription Renewal Worker] Found ${expiringSubscriptions.length} subscriptions to renew`,
      {
        subscriptions: expiringSubscriptions.map((s) => ({
          id: s.id,
          subscriptionId: s.subscriptionId,
          resource: s.resource,
          expiresAt: s.expirationDateTime,
        })),
      }
    );

    // Renew each subscription
    for (const subscription of expiringSubscriptions) {
      try {
        logger.info(
          `[Subscription Renewal Worker] Renewing subscription ${subscription.subscriptionId}`,
          {
            id: subscription.id,
            resource: subscription.resource,
            currentExpiration: subscription.expirationDateTime,
          }
        );

        const renewed = await webhookService.renewSubscription(subscription.id, accessToken);

        stats.successful++;

        logger.info(
          `[Subscription Renewal Worker] Successfully renewed subscription ${subscription.subscriptionId}`,
          {
            id: renewed.id,
            newExpiration: renewed.expirationDateTime,
            renewedAt: renewed.lastRenewedAt,
          }
        );
      } catch (error) {
        stats.failed++;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        stats.errors.push({
          subscriptionId: subscription.subscriptionId,
          error: errorMessage,
        });

        logger.error(
          `[Subscription Renewal Worker] Failed to renew subscription ${subscription.subscriptionId}`,
          {
            id: subscription.id,
            error: errorMessage,
            resource: subscription.resource,
          }
        );
      }
    }

    logger.info('[Subscription Renewal Worker] Renewal batch completed', stats);

    return stats;
  } catch (error) {
    logger.error('[Subscription Renewal Worker] Fatal error during renewal', {
      error,
    });
    throw error;
  }
}

/**
 * Start the subscription renewal worker
 * @param getAccessToken - Function that returns a valid access token for Graph API
 */
export function startRenewalWorker(getAccessToken: () => Promise<string> | string): void {
  if (isRunning) {
    logger.warn('[Subscription Renewal Worker] Worker is already running');
    return;
  }

  logger.info('[Subscription Renewal Worker] Starting worker', {
    checkIntervalMs: RENEWAL_CHECK_INTERVAL_MS,
    thresholdHours: RENEWAL_THRESHOLD_HOURS,
  });

  isRunning = true;

  // Run immediately on startup
  (async () => {
    try {
      const accessToken = await getAccessToken();
      await renewExpiringSubscriptions(accessToken);
    } catch (error) {
      logger.error('[Subscription Renewal Worker] Error during initial renewal run', { error });
    }
  })();

  // Schedule periodic renewals
  workerInterval = setInterval(async () => {
    try {
      const accessToken = await getAccessToken();
      await renewExpiringSubscriptions(accessToken);
    } catch (error) {
      logger.error('[Subscription Renewal Worker] Error during scheduled renewal run', { error });
    }
  }, RENEWAL_CHECK_INTERVAL_MS);

  logger.info('[Subscription Renewal Worker] Worker started successfully');
}

/**
 * Stop the subscription renewal worker
 */
export function stopRenewalWorker(): void {
  if (!isRunning) {
    logger.warn('[Subscription Renewal Worker] Worker is not running');
    return;
  }

  logger.info('[Subscription Renewal Worker] Stopping worker');

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  isRunning = false;

  logger.info('[Subscription Renewal Worker] Worker stopped successfully');
}

/**
 * Check if the renewal worker is currently running
 */
export function isWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Get worker configuration
 */
export function getWorkerConfig() {
  return {
    checkIntervalMs: RENEWAL_CHECK_INTERVAL_MS,
    thresholdHours: RENEWAL_THRESHOLD_HOURS,
    isRunning,
  };
}
