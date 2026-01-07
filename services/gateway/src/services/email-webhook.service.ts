/**
 * Email Webhook Subscription Service
 * Story 5.1: Email Integration and Synchronization
 *
 * Manages Microsoft Graph API webhook subscriptions for real-time email notifications.
 * Handles subscription creation, renewal, and webhook event processing.
 *
 * Subscription lifetime: max 4230 minutes (~2.9 days) for mail resources
 * [Source: docs/architecture/external-apis.md#microsoft-graph-api]
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { Subscription } from '@microsoft/microsoft-graph-types';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { graphEndpoints } from '../config/graph.config';
import { GraphService } from './graph.service';
import { EmailSyncService } from './email-sync.service';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';

// ============================================================================
// Types
// ============================================================================

export interface WebhookNotification {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
  clientState: string;
  tenantId: string;
}

export interface WebhookPayload {
  value: WebhookNotification[];
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  expirationDateTime?: Date;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

// Max subscription lifetime for mail: 4230 minutes (~2.9 days)
const SUBSCRIPTION_LIFETIME_MINUTES = 4200; // Leave buffer
const SUBSCRIPTION_RENEWAL_BUFFER_MS = 30 * 60 * 1000; // Renew 30 min before expiry

// Dead-letter queue key
const DLQ_KEY = 'email:webhook:dlq';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // Exponential backoff

// Alert threshold
const FAILURE_ALERT_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Email Webhook Service
// ============================================================================

export class EmailWebhookService {
  private prisma: PrismaClient;
  private redis: Redis;
  private graphService: GraphService;
  private emailSyncService: EmailSyncService;
  private webhookBaseUrl: string;
  private clientState: string;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    graphService?: GraphService,
    emailSyncService?: EmailSyncService
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.graphService = graphService || new GraphService();
    this.emailSyncService = emailSyncService || new EmailSyncService(prisma, this.graphService);
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL || '';
    this.clientState = process.env.WEBHOOK_CLIENT_STATE || 'legal-platform-email-webhook';
  }

  /**
   * Create a subscription for email change notifications (AC: 1)
   *
   * Subscribes to created, updated, and deleted email notifications.
   * Stores subscription state for renewal tracking.
   *
   * @param userId - Internal user ID
   * @param accessToken - User's OAuth access token
   * @returns Subscription result with ID and expiry
   */
  async createSubscription(userId: string, accessToken: string): Promise<SubscriptionResult> {
    try {
      const client = this.graphService.getAuthenticatedClient(accessToken);

      // Calculate expiration (max 4230 minutes for mail)
      const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_LIFETIME_MINUTES * 60 * 1000);

      const subscription: Partial<Subscription> = {
        changeType: 'created,updated,deleted',
        notificationUrl: `${this.webhookBaseUrl}/webhooks/graph`,
        resource: '/me/messages',
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: this.clientState,
      };

      const result = await retryWithBackoff(
        async () => {
          try {
            return await client.api(graphEndpoints.subscriptions).post(subscription);
          } catch (error: any) {
            const parsedError = parseGraphError(error);
            logGraphError(parsedError);
            throw parsedError;
          }
        },
        {},
        'email-webhook-create-subscription'
      );

      // Store subscription state
      await this.updateSubscriptionState(userId, {
        subscriptionId: result.id,
        subscriptionExpiry: new Date(result.expirationDateTime),
      });

      return {
        success: true,
        subscriptionId: result.id,
        expirationDateTime: new Date(result.expirationDateTime),
      };
    } catch (error: any) {
      const parsedError = parseGraphError(error);
      logGraphError(parsedError);

      return {
        success: false,
        error: parsedError.message,
      };
    }
  }

  /**
   * Renew an existing subscription before expiry (AC: 1)
   *
   * @param userId - Internal user ID
   * @param accessToken - User's OAuth access token
   * @returns Subscription result with new expiry
   */
  async renewSubscription(userId: string, accessToken: string): Promise<SubscriptionResult> {
    try {
      const syncState = await this.prisma.emailSyncState.findUnique({
        where: { userId },
      });

      if (!syncState?.subscriptionId) {
        // No existing subscription, create new one
        return this.createSubscription(userId, accessToken);
      }

      const client = this.graphService.getAuthenticatedClient(accessToken);

      // Calculate new expiration
      const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_LIFETIME_MINUTES * 60 * 1000);

      const result = await retryWithBackoff(
        async () => {
          try {
            return await client
              .api(graphEndpoints.subscriptionById(syncState.subscriptionId!))
              .patch({
                expirationDateTime: expirationDateTime.toISOString(),
              });
          } catch (error: any) {
            const parsedError = parseGraphError(error);

            // Subscription expired or deleted - recreate
            if (parsedError.statusCode === 404) {
              throw { code: 'subscriptionNotFound', ...parsedError };
            }

            logGraphError(parsedError);
            throw parsedError;
          }
        },
        {},
        'email-webhook-renew-subscription'
      );

      // Update subscription state
      await this.updateSubscriptionState(userId, {
        subscriptionExpiry: new Date(result.expirationDateTime),
      });

      return {
        success: true,
        subscriptionId: result.id,
        expirationDateTime: new Date(result.expirationDateTime),
      };
    } catch (error: any) {
      // Handle subscription not found - recreate
      if (error.code === 'subscriptionNotFound') {
        await this.updateSubscriptionState(userId, {
          subscriptionId: null,
          subscriptionExpiry: null,
        });
        return this.createSubscription(userId, accessToken);
      }

      const parsedError = parseGraphError(error);
      logGraphError(parsedError);

      // Handle rate limit - backoff and retry
      if (parsedError.statusCode === 429) {
        const retryAfter = parseInt(error.headers?.['Retry-After'] || '60', 10);
        await this.scheduleRenewalRetry(userId, retryAfter * 1000);
      }

      return {
        success: false,
        error: parsedError.message,
      };
    }
  }

  /**
   * Delete a subscription (cleanup)
   *
   * @param userId - Internal user ID
   * @param accessToken - User's OAuth access token
   */
  async deleteSubscription(userId: string, accessToken: string): Promise<boolean> {
    try {
      const syncState = await this.prisma.emailSyncState.findUnique({
        where: { userId },
      });

      if (!syncState?.subscriptionId) {
        return true; // Nothing to delete
      }

      const client = this.graphService.getAuthenticatedClient(accessToken);

      await client.api(graphEndpoints.subscriptionById(syncState.subscriptionId)).delete();

      // Clear subscription state
      await this.updateSubscriptionState(userId, {
        subscriptionId: null,
        subscriptionExpiry: null,
      });

      return true;
    } catch (error: any) {
      const parsedError = parseGraphError(error);

      // If subscription already gone, consider success
      if (parsedError.statusCode === 404) {
        await this.updateSubscriptionState(userId, {
          subscriptionId: null,
          subscriptionExpiry: null,
        });
        return true;
      }

      logGraphError(parsedError);
      return false;
    }
  }

  /**
   * Handle incoming webhook validation request
   *
   * Graph API sends a validation token that must be echoed back.
   *
   * @param validationToken - Token from query parameter
   * @returns Validation token to echo back
   */
  handleValidation(validationToken: string): string {
    return validationToken;
  }

  /**
   * Process incoming webhook notification (AC: 1)
   *
   * Handles email change notifications and triggers sync.
   * Implements dead-letter queue for failed notifications.
   *
   * @param payload - Webhook payload from Graph API
   * @param clientStateHeader - Client state for validation
   * @returns Processing success
   */
  async processNotification(payload: WebhookPayload, clientStateHeader: string): Promise<boolean> {
    // Validate client state
    if (clientStateHeader !== this.clientState) {
      console.warn('Invalid client state in webhook notification');
      return false;
    }

    const notifications = payload.value || [];
    let allSuccess = true;

    for (const notification of notifications) {
      try {
        await this.handleSingleNotification(notification);
      } catch (error) {
        console.error('Failed to process webhook notification:', error);

        // Add to dead-letter queue for retry
        await this.addToDeadLetterQueue(notification, error);
        allSuccess = false;
      }
    }

    return allSuccess;
  }

  /**
   * Process items from dead-letter queue
   *
   * Should be called periodically by a worker.
   */
  async processDeadLetterQueue(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    while (true) {
      const item = await this.redis.lpop(DLQ_KEY);
      if (!item) break;

      try {
        const { notification, retryCount, error: lastError } = JSON.parse(item);

        if (retryCount >= MAX_RETRIES) {
          // Max retries exceeded - log and alert
          console.error('Max retries exceeded for notification:', {
            notification,
            lastError,
            retryCount,
          });
          await this.checkAndAlert();
          failed++;
          continue;
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1])
        );

        await this.handleSingleNotification(notification);
        processed++;
      } catch (error) {
        // Re-add with incremented retry count
        const parsed = JSON.parse(item);
        parsed.retryCount = (parsed.retryCount || 0) + 1;
        parsed.error = error instanceof Error ? error.message : String(error);
        await this.redis.rpush(DLQ_KEY, JSON.stringify(parsed));
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Get subscriptions due for renewal
   *
   * Returns users whose subscriptions expire within the buffer period.
   */
  async getSubscriptionsDueForRenewal(): Promise<string[]> {
    const renewalThreshold = new Date(Date.now() + SUBSCRIPTION_RENEWAL_BUFFER_MS);

    const syncStates = await this.prisma.emailSyncState.findMany({
      where: {
        subscriptionId: { not: null },
        subscriptionExpiry: { lt: renewalThreshold },
      },
      select: { userId: true },
    });

    return syncStates.map((s) => s.userId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Handle a single webhook notification
   */
  private async handleSingleNotification(notification: WebhookNotification): Promise<void> {
    // Find user by subscription ID
    const syncState = await this.prisma.emailSyncState.findFirst({
      where: { subscriptionId: notification.subscriptionId },
      include: { user: true },
    });

    if (!syncState) {
      console.warn('Unknown subscription ID:', notification.subscriptionId);
      return;
    }

    // Extract message ID from resource path
    const messageId = this.extractMessageIdFromResource(notification.resource);

    switch (notification.changeType) {
      case 'created':
      case 'updated':
        // Trigger incremental sync for this user
        // Note: In production, you'd queue this and get a fresh access token
        console.log(`Email ${notification.changeType} for user ${syncState.userId}:`, messageId);
        // The actual sync would be triggered by a worker with proper token management
        await this.queueIncrementalSync(syncState.userId);
        break;

      case 'deleted':
        // Remove email from database
        if (messageId) {
          await this.prisma.email.deleteMany({
            where: {
              graphMessageId: messageId,
              userId: syncState.userId,
            },
          });
        }
        break;
    }
  }

  /**
   * Extract message ID from Graph API resource path
   */
  private extractMessageIdFromResource(resource: string): string | null {
    // Resource format: /me/messages('messageId')  or Users('userId')/messages('messageId')
    const match = resource.match(/messages\('([^']+)'\)/);
    return match ? match[1] : null;
  }

  /**
   * Queue incremental sync for a user
   */
  private async queueIncrementalSync(userId: string): Promise<void> {
    // Add to sync queue in Redis
    await this.redis.rpush(
      'email:sync:pending',
      JSON.stringify({
        userId,
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Add failed notification to dead-letter queue
   */
  private async addToDeadLetterQueue(
    notification: WebhookNotification,
    error: unknown
  ): Promise<void> {
    const dlqItem = {
      notification,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      retryCount: 0,
    };

    await this.redis.rpush(DLQ_KEY, JSON.stringify(dlqItem));
  }

  /**
   * Check failure rate and alert if threshold exceeded
   */
  private async checkAndAlert(): Promise<void> {
    const failureKey = 'email:webhook:failures';
    const now = Date.now();

    // Add current failure
    await this.redis.zadd(failureKey, now, now.toString());

    // Remove old failures outside window
    await this.redis.zremrangebyscore(failureKey, 0, now - FAILURE_WINDOW_MS);

    // Count recent failures
    const failureCount = await this.redis.zcard(failureKey);

    if (failureCount >= FAILURE_ALERT_THRESHOLD) {
      // Alert! (In production, this would send to alerting system)
      console.error(`ALERT: ${failureCount} webhook failures in last 10 minutes`);
      // Could integrate with New Relic, PagerDuty, etc.
    }
  }

  /**
   * Schedule a renewal retry after rate limit
   */
  private async scheduleRenewalRetry(userId: string, delayMs: number): Promise<void> {
    await this.redis.zadd('email:subscription:renewal:scheduled', Date.now() + delayMs, userId);
  }

  /**
   * Update subscription state in database
   */
  private async updateSubscriptionState(
    userId: string,
    data: {
      subscriptionId?: string | null;
      subscriptionExpiry?: Date | null;
    }
  ): Promise<void> {
    await this.prisma.emailSyncState.upsert({
      where: { userId },
      create: {
        userId,
        subscriptionId: data.subscriptionId,
        subscriptionExpiry: data.subscriptionExpiry,
      },
      update: data,
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailWebhookServiceInstance: EmailWebhookService | null = null;

export function getEmailWebhookService(prisma: PrismaClient, redis: Redis): EmailWebhookService {
  if (!emailWebhookServiceInstance) {
    emailWebhookServiceInstance = new EmailWebhookService(prisma, redis);
  }
  return emailWebhookServiceInstance;
}
