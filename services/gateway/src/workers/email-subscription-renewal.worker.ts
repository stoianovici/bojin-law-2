/**
 * Email Subscription Renewal Worker
 * Creates and renews Microsoft Graph email webhook subscriptions for all users.
 * Uses app-only tokens (client credentials flow) - NO user session required.
 *
 * Email subscriptions are stored in EmailSyncState (per-user), not GraphSubscription.
 * This worker:
 * 1. Creates subscriptions for users who don't have one yet
 * 2. Finds subscriptions expiring within 24 hours
 * 3. Gets app-only Graph client (no user session needed)
 * 4. Renews the subscription via Graph API
 * 5. Updates EmailSyncState with new expiry
 *
 * Runs every hour. Subscriptions expire every ~3 days (4230 minutes).
 */

import { prisma } from '@legal-platform/database';
import { EmailWebhookService } from '../services/email-webhook.service';
import { EmailSyncService } from '../services/email-sync.service';
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
 * Create email subscriptions for users who don't have one yet.
 * Finds users with Azure AD IDs but no active subscription.
 * Uses app-only tokens - no user session required.
 */
export async function createMissingEmailSubscriptions(): Promise<{
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}> {
  const stats = {
    total: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [] as Array<{ userId: string; error: string }>,
  };

  try {
    // Find users who have email sync state but no subscription
    const syncStatesWithoutSubscription = await prisma.emailSyncState.findMany({
      where: {
        subscriptionId: { equals: null },
      },
      include: {
        user: {
          select: { id: true, email: true, azureAdId: true },
        },
      },
    });

    // Filter to only users with Azure AD ID and convert to expected format
    const usersWithoutSubscription = syncStatesWithoutSubscription
      .filter((state) => state.user.azureAdId !== null)
      .map((state) => ({
        id: state.user.id,
        email: state.user.email,
        azureAdId: state.user.azureAdId,
        emailSyncState: { id: state.id, subscriptionId: state.subscriptionId },
      }));

    stats.total = usersWithoutSubscription.length;

    if (usersWithoutSubscription.length === 0) {
      logger.info('[Email Subscription] All users have active subscriptions');
      return stats;
    }

    logger.info(
      `[Email Subscription] Found ${usersWithoutSubscription.length} users without subscriptions`,
      {
        users: usersWithoutSubscription.map((u) => ({
          userId: u.id,
          email: u.email,
          hasAzureAdId: !!u.azureAdId,
        })),
      }
    );

    // Create services
    const graphService = new GraphService();
    const emailWebhookService = new EmailWebhookService(
      prisma,
      (await import('@legal-platform/database')).redis,
      graphService
    );

    // Get app-only Graph client (no user session required)
    const appClient = await graphService.getAppClient();

    logger.info('[Email Subscription] Using app-only token for subscription creation');

    // Create subscription for each user
    for (const user of usersWithoutSubscription) {
      try {
        if (!user.azureAdId) {
          logger.warn(`[Email Subscription] Skipping user ${user.id} - no Azure AD ID`);
          stats.skipped++;
          continue;
        }

        logger.info(`[Email Subscription] Creating subscription for user ${user.id}`, {
          email: user.email,
        });

        // Create the subscription using app-only client
        const result = await emailWebhookService.createSubscriptionWithClient(
          user.id,
          user.azureAdId,
          appClient
        );

        if (result.success) {
          stats.created++;
          logger.info(
            `[Email Subscription] Successfully created subscription for user ${user.id}`,
            {
              subscriptionId: result.subscriptionId,
              expiry: result.expirationDateTime,
            }
          );
        } else {
          stats.failed++;
          stats.errors.push({
            userId: user.id,
            error: result.error || 'Unknown error',
          });
          logger.error(`[Email Subscription] Failed to create subscription for user ${user.id}`, {
            error: result.error,
          });
        }
      } catch (error: any) {
        stats.failed++;
        stats.errors.push({
          userId: user.id,
          error: error.message || 'Unknown error',
        });
        logger.error(`[Email Subscription] Error creating subscription for user ${user.id}`, {
          error: error.message,
        });
      }
    }

    logger.info('[Email Subscription] Creation batch completed', stats);
    return stats;
  } catch (error: any) {
    logger.error('[Email Subscription] Fatal error during subscription creation', {
      error: error.message,
    });
    throw error;
  }
}

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
 * Sync recent emails for users who might have missed emails while webhook was down.
 * Uses app-only tokens to fetch emails from the last 7 days.
 */
export async function syncMissedEmails(): Promise<{
  total: number;
  synced: number;
  failed: number;
  emailCount: number;
}> {
  const stats = { total: 0, synced: 0, failed: 0, emailCount: 0 };

  try {
    // Find users with active subscriptions who haven't synced recently (> 1 day)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const usersNeedingSync = await prisma.emailSyncState.findMany({
      where: {
        subscriptionId: { not: null },
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: oneDayAgo } }],
      },
      include: {
        user: {
          select: { id: true, email: true, azureAdId: true, firmId: true },
        },
      },
    });

    stats.total = usersNeedingSync.length;

    if (usersNeedingSync.length === 0) {
      logger.info('[Email Catchup] All users are up to date');
      return stats;
    }

    logger.info(`[Email Catchup] Found ${usersNeedingSync.length} users needing email sync`);

    const graphService = new GraphService();
    const emailSyncService = new EmailSyncService(prisma, graphService);

    for (const syncState of usersNeedingSync) {
      if (!syncState.user.azureAdId) {
        logger.warn(`[Email Catchup] Skipping user ${syncState.userId} - no Azure AD ID`);
        continue;
      }

      try {
        logger.info(`[Email Catchup] Syncing emails for ${syncState.user.email}`);

        const result = await emailSyncService.syncRecentEmailsWithAppToken(
          syncState.userId,
          syncState.user.azureAdId,
          7 // 7 days back
        );

        if (result.success) {
          stats.synced++;
          stats.emailCount += result.emailsSynced;
          logger.info(
            `[Email Catchup] Synced ${result.emailsSynced} emails for ${syncState.user.email}`
          );
        } else {
          stats.failed++;
          logger.error(`[Email Catchup] Failed for ${syncState.user.email}: ${result.error}`);
        }
      } catch (error: any) {
        stats.failed++;
        logger.error(`[Email Catchup] Error for ${syncState.user.email}:`, {
          error: error.message,
        });
      }
    }

    logger.info('[Email Catchup] Completed', stats);
    return stats;
  } catch (error: any) {
    logger.error('[Email Catchup] Fatal error:', { error: error.message });
    throw error;
  }
}

/**
 * Run both subscription creation and renewal
 */
async function runSubscriptionMaintenance(): Promise<void> {
  // First, create subscriptions for users who don't have one
  const created = await createMissingEmailSubscriptions().catch((error) => {
    logger.error('[Email Subscription] Error creating missing subscriptions', {
      error: error.message,
    });
    return null;
  });

  // Sync missed emails for any users who haven't synced recently
  // This catches up on emails missed during subscription downtime
  await syncMissedEmails().catch((error) => {
    logger.error('[Email Catchup] Error syncing missed emails', {
      error: error.message,
    });
  });

  // Then, renew expiring subscriptions
  await renewExpiringEmailSubscriptions().catch((error) => {
    logger.error('[Email Subscription Renewal] Error renewing subscriptions', {
      error: error.message,
    });
  });
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
  runSubscriptionMaintenance();

  // Schedule periodic maintenance (create + renew)
  workerInterval = setInterval(() => {
    runSubscriptionMaintenance();
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
