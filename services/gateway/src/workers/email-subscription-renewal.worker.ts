/**
 * Email Subscription Renewal Worker
 * Renews expiring Microsoft Graph email webhook subscriptions for all users.
 * Uses app-only tokens (client credentials flow) - NO user session required.
 *
 * Email subscriptions are stored in EmailSyncState (per-user), not GraphSubscription.
 * This worker:
 * 1. Finds subscriptions expiring within 24 hours
 * 2. Gets app-only Graph client (no user session needed)
 * 3. Renews the subscription via Graph API
 * 4. Updates EmailSyncState with new expiry
 *
 * Runs every hour. Subscriptions expire every ~3 days (4230 minutes).
 */

import { prisma } from '@legal-platform/database';
import { EmailWebhookService } from '../services/email-webhook.service';
import { GraphService } from '../services/graph.service';
import logger from '../utils/logger';

// Configuration
const CHECK_INTERVAL_MS = parseInt(
  process.env.EMAIL_SUBSCRIPTION_RENEWAL_INTERVAL_MS || '3600000',
  10
); // Default: 1 hour
const RENEWAL_THRESHOLD_HOURS = 24; // Renew subscriptions expiring within 24 hours

// Worker state
let workerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Renew all email subscriptions expiring within the threshold window
 * Uses app-only tokens - no user session required
 */
export async function renewExpiringEmailSubscriptions(): Promise<{
  total: number;
  renewed: number;
  skipped: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}> {
  const stats = {
    total: 0,
    renewed: 0,
    skipped: 0,
    failed: 0,
    errors: [] as Array<{ userId: string; error: string }>,
  };

  try {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() + RENEWAL_THRESHOLD_HOURS);

    // Find all email sync states with subscriptions expiring soon
    // Include user's azureAdId for app-only API calls
    const expiringSyncStates = await prisma.emailSyncState.findMany({
      where: {
        subscriptionId: { not: null },
        subscriptionExpiry: {
          not: null,
          lte: threshold,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, azureAdId: true },
        },
      },
    });

    stats.total = expiringSyncStates.length;

    if (expiringSyncStates.length === 0) {
      logger.info('[Email Subscription Renewal] No subscriptions need renewal');
      return stats;
    }

    logger.info(
      `[Email Subscription Renewal] Found ${expiringSyncStates.length} subscriptions to renew`,
      {
        subscriptions: expiringSyncStates.map((s) => ({
          userId: s.userId,
          subscriptionId: s.subscriptionId,
          expiry: s.subscriptionExpiry,
        })),
      }
    );

    // Create services for renewal
    const graphService = new GraphService();
    const emailWebhookService = new EmailWebhookService(
      prisma,
      (await import('@legal-platform/database')).redis,
      graphService
    );

    // Get app-only Graph client (no user session required)
    const appClient = await graphService.getAppClient();

    logger.info('[Email Subscription Renewal] Using app-only token for renewals');

    // Renew each subscription
    for (const syncState of expiringSyncStates) {
      try {
        // Check user has Azure AD ID (required for app-only access)
        if (!syncState.user?.azureAdId) {
          logger.warn(
            `[Email Subscription Renewal] Skipping user ${syncState.userId} - no Azure AD ID`
          );
          stats.skipped++;
          continue;
        }

        logger.info(
          `[Email Subscription Renewal] Renewing subscription for user ${syncState.userId}`,
          {
            subscriptionId: syncState.subscriptionId,
            currentExpiry: syncState.subscriptionExpiry,
          }
        );

        // Renew the subscription using app-only client
        const result = await emailWebhookService.renewSubscriptionWithClient(
          syncState.userId,
          syncState.user.azureAdId,
          appClient
        );

        if (result.success) {
          stats.renewed++;
          logger.info(
            `[Email Subscription Renewal] Successfully renewed subscription for user ${syncState.userId}`,
            {
              subscriptionId: result.subscriptionId,
              newExpiry: result.expirationDateTime,
            }
          );
        } else {
          stats.failed++;
          stats.errors.push({
            userId: syncState.userId,
            error: result.error || 'Unknown error',
          });
          logger.error(
            `[Email Subscription Renewal] Failed to renew subscription for user ${syncState.userId}`,
            { error: result.error }
          );
        }
      } catch (error: any) {
        stats.failed++;
        stats.errors.push({
          userId: syncState.userId,
          error: error.message || 'Unknown error',
        });
        logger.error(
          `[Email Subscription Renewal] Error renewing subscription for user ${syncState.userId}`,
          { error: error.message }
        );
      }
    }

    logger.info('[Email Subscription Renewal] Renewal batch completed', stats);
    return stats;
  } catch (error: any) {
    logger.error('[Email Subscription Renewal] Fatal error during renewal', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Start the email subscription renewal worker
 */
export function startEmailSubscriptionRenewalWorker(): void {
  if (isRunning) {
    logger.warn('[Email Subscription Renewal] Worker is already running');
    return;
  }

  logger.info('[Email Subscription Renewal] Starting worker', {
    checkIntervalMs: CHECK_INTERVAL_MS,
    thresholdHours: RENEWAL_THRESHOLD_HOURS,
  });

  isRunning = true;

  // Run immediately on startup
  renewExpiringEmailSubscriptions().catch((error) => {
    logger.error('[Email Subscription Renewal] Error during initial run', {
      error: error.message,
    });
  });

  // Schedule periodic renewals
  workerInterval = setInterval(() => {
    renewExpiringEmailSubscriptions().catch((error) => {
      logger.error('[Email Subscription Renewal] Error during scheduled run', {
        error: error.message,
      });
    });
  }, CHECK_INTERVAL_MS);

  logger.info('[Email Subscription Renewal] Worker started successfully');
}

/**
 * Stop the email subscription renewal worker
 */
export function stopEmailSubscriptionRenewalWorker(): void {
  if (!isRunning) {
    logger.warn('[Email Subscription Renewal] Worker is not running');
    return;
  }

  logger.info('[Email Subscription Renewal] Stopping worker');

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  isRunning = false;
  logger.info('[Email Subscription Renewal] Worker stopped');
}

/**
 * Check if the worker is running
 */
export function isEmailSubscriptionRenewalWorkerRunning(): boolean {
  return isRunning;
}
