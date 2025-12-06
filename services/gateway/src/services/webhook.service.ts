/**
 * Webhook Service for Microsoft Graph API Subscriptions
 * Story 2.5 - Task 8: Create Webhook Infrastructure
 *
 * Manages Graph API webhook subscriptions for email and file change notifications.
 * Subscriptions expire every 3 days (4320 minutes) and require renewal.
 */

import { prisma, GraphSubscription } from '@legal-platform/database';
import { Client } from '@microsoft/microsoft-graph-client';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError } from '../utils/graph-error-handler';
import logger from '../utils/logger';

// Subscription configuration based on Graph API limits
const SUBSCRIPTION_EXPIRY_MINUTES = 4320; // 3 days
const RENEWAL_THRESHOLD_HOURS = 24; // Renew 24 hours before expiry

export interface CreateSubscriptionParams {
  resource: string;
  changeTypes: string[];
  accessToken: string;
  clientState?: string;
}

export interface SubscriptionResponse {
  id: string;
  resource: string;
  changeType: string;
  clientState?: string;
  notificationUrl: string;
  expirationDateTime: string;
}

export class WebhookService {
  /**
   * Create a new Graph API webhook subscription
   * @param params - Subscription parameters
   * @returns Created subscription from database
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<GraphSubscription> {
    const { resource, changeTypes, accessToken, clientState } = params;

    try {
      // Build notification URL from environment
      const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
      const notificationUrl = `${baseUrl}/webhooks/graph`;

      // Calculate expiration (3 days from now)
      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(expirationDateTime.getMinutes() + SUBSCRIPTION_EXPIRY_MINUTES);

      // Create Graph API client
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      // Call Graph API to create subscription
      const subscriptionRequest = {
        changeType: changeTypes.join(','),
        notificationUrl,
        resource,
        expirationDateTime: expirationDateTime.toISOString(),
        clientState: clientState || process.env.WEBHOOK_CLIENT_STATE,
      };

      logger.info('Creating Graph API subscription', {
        resource,
        changeTypes,
        expirationDateTime: expirationDateTime.toISOString(),
      });

      const graphSubscription: SubscriptionResponse = await retryWithBackoff(
        async () => {
          return await client.api('/subscriptions').post(subscriptionRequest);
        },
        {},
        'createGraphSubscription'
      );

      // Store subscription in database
      const dbSubscription = await prisma.graphSubscription.create({
        data: {
          subscriptionId: graphSubscription.id,
          resource: graphSubscription.resource,
          changeTypes: graphSubscription.changeType,
          notificationUrl: graphSubscription.notificationUrl,
          clientState: graphSubscription.clientState,
          expirationDateTime: new Date(graphSubscription.expirationDateTime),
          isActive: true,
        },
      });

      logger.info('Graph API subscription created successfully', {
        subscriptionId: dbSubscription.subscriptionId,
        resource: dbSubscription.resource,
        expirationDateTime: dbSubscription.expirationDateTime,
      });

      return dbSubscription;
    } catch (error) {
      const parsedError = parseGraphError(error);
      logger.error('Failed to create Graph API subscription', {
        error: parsedError,
        resource,
        changeTypes,
      });
      throw error;
    }
  }

  /**
   * Renew an existing Graph API subscription
   * @param subscriptionId - Database subscription ID
   * @param accessToken - Graph API access token
   * @returns Updated subscription from database
   */
  async renewSubscription(subscriptionId: string, accessToken: string): Promise<GraphSubscription> {
    try {
      // Get subscription from database
      const dbSubscription = await prisma.graphSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!dbSubscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      // Calculate new expiration (3 days from now)
      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(expirationDateTime.getMinutes() + SUBSCRIPTION_EXPIRY_MINUTES);

      // Create Graph API client
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      logger.info('Renewing Graph API subscription', {
        subscriptionId: dbSubscription.subscriptionId,
        resource: dbSubscription.resource,
        newExpirationDateTime: expirationDateTime.toISOString(),
      });

      // Call Graph API to renew subscription
      const graphSubscription: SubscriptionResponse = await retryWithBackoff(
        async () => {
          return await client.api(`/subscriptions/${dbSubscription.subscriptionId}`).patch({
            expirationDateTime: expirationDateTime.toISOString(),
          });
        },
        {},
        'renewGraphSubscription'
      );

      // Update subscription in database
      const updatedSubscription = await prisma.graphSubscription.update({
        where: { id: subscriptionId },
        data: {
          expirationDateTime: new Date(graphSubscription.expirationDateTime),
          lastRenewedAt: new Date(),
        },
      });

      logger.info('Graph API subscription renewed successfully', {
        subscriptionId: updatedSubscription.subscriptionId,
        expirationDateTime: updatedSubscription.expirationDateTime,
      });

      return updatedSubscription;
    } catch (error) {
      const parsedError = parseGraphError(error);
      logger.error('Failed to renew Graph API subscription', {
        error: parsedError,
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Delete a Graph API subscription
   * @param subscriptionId - Database subscription ID
   * @param accessToken - Graph API access token
   */
  async deleteSubscription(subscriptionId: string, accessToken: string): Promise<void> {
    try {
      // Get subscription from database
      const dbSubscription = await prisma.graphSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!dbSubscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      // Create Graph API client
      const client = Client.init({
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      logger.info('Deleting Graph API subscription', {
        subscriptionId: dbSubscription.subscriptionId,
        resource: dbSubscription.resource,
      });

      // Call Graph API to delete subscription
      await retryWithBackoff(
        async () => {
          await client.api(`/subscriptions/${dbSubscription.subscriptionId}`).delete();
        },
        {},
        'deleteGraphSubscription'
      );

      // Mark subscription as inactive in database
      await prisma.graphSubscription.update({
        where: { id: subscriptionId },
        data: { isActive: false },
      });

      logger.info('Graph API subscription deleted successfully', {
        subscriptionId: dbSubscription.subscriptionId,
      });
    } catch (error) {
      const parsedError = parseGraphError(error);
      logger.error('Failed to delete Graph API subscription', {
        error: parsedError,
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Get subscriptions expiring within a specified time window
   * @param hoursUntilExpiry - Time window in hours (default: 24)
   * @returns Array of subscriptions expiring soon
   */
  async getExpiringSubscriptions(
    hoursUntilExpiry: number = RENEWAL_THRESHOLD_HOURS
  ): Promise<GraphSubscription[]> {
    try {
      const threshold = new Date();
      threshold.setHours(threshold.getHours() + hoursUntilExpiry);

      const subscriptions = await prisma.graphSubscription.findMany({
        where: {
          isActive: true,
          expirationDateTime: {
            lte: threshold,
          },
        },
        orderBy: {
          expirationDateTime: 'asc',
        },
      });

      logger.debug('Retrieved expiring subscriptions', {
        count: subscriptions.length,
        hoursUntilExpiry,
      });

      return subscriptions;
    } catch (error) {
      logger.error('Failed to get expiring subscriptions', { error });
      throw error;
    }
  }

  /**
   * Get all active subscriptions
   * @returns Array of active subscriptions
   */
  async getActiveSubscriptions(): Promise<GraphSubscription[]> {
    try {
      const subscriptions = await prisma.graphSubscription.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      logger.debug('Retrieved active subscriptions', {
        count: subscriptions.length,
      });

      return subscriptions;
    } catch (error) {
      logger.error('Failed to get active subscriptions', { error });
      throw error;
    }
  }

  /**
   * Get subscription by ID
   * @param subscriptionId - Database subscription ID
   * @returns Subscription or null
   */
  async getSubscriptionById(subscriptionId: string): Promise<GraphSubscription | null> {
    try {
      const subscription = await prisma.graphSubscription.findUnique({
        where: { id: subscriptionId },
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to get subscription by ID', {
        error,
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Get subscription by Graph API subscription ID
   * @param graphSubscriptionId - Graph API subscription ID
   * @returns Subscription or null
   */
  async getSubscriptionByGraphId(graphSubscriptionId: string): Promise<GraphSubscription | null> {
    try {
      const subscription = await prisma.graphSubscription.findUnique({
        where: { subscriptionId: graphSubscriptionId },
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to get subscription by Graph ID', {
        error,
        graphSubscriptionId,
      });
      throw error;
    }
  }

  /**
   * Validate webhook notification (called by webhook endpoint)
   * @param validationToken - Token from Graph API validation request
   * @returns Validation token to echo back
   */
  validateWebhook(validationToken: string): string {
    logger.info('Validating webhook subscription', { validationToken });
    return validationToken;
  }

  /**
   * Create email change notification subscription
   * Story 2.5 - Task 9: Implement Email Change Notifications
   *
   * Subscribes to /me/messages resource for created and updated events
   *
   * @param accessToken - Graph API access token
   * @param clientState - Optional client state for validation
   * @returns Created subscription from database
   */
  async createEmailSubscription(
    accessToken: string,
    clientState?: string
  ): Promise<GraphSubscription> {
    logger.info('Creating email subscription for /me/messages');

    return await this.createSubscription({
      resource: '/me/messages',
      changeTypes: ['created', 'updated'],
      accessToken,
      clientState,
    });
  }

  /**
   * Create file change notification subscription
   * Story 2.5 - Task 10: Implement File Change Notifications
   *
   * Subscribes to /me/drive/root resource for created, updated, and deleted events
   *
   * @param accessToken - Graph API access token
   * @param clientState - Optional client state for validation
   * @returns Created subscription from database
   */
  async createFileSubscription(
    accessToken: string,
    clientState?: string
  ): Promise<GraphSubscription> {
    logger.info('Creating file subscription for /me/drive/root');

    return await this.createSubscription({
      resource: '/me/drive/root',
      changeTypes: ['created', 'updated', 'deleted'],
      accessToken,
      clientState,
    });
  }

  /**
   * Handle drive item change notification
   * Story 3.4 - Task 3: OneDrive Webhook Handler for Real-time Sync
   *
   * Processes notifications when files are modified in OneDrive
   * and triggers document synchronization.
   *
   * @param notification - Drive item change notification from Graph API
   * @returns Processing result
   */
  async handleDriveItemChange(notification: {
    subscriptionId: string;
    clientState?: string;
    changeType: string;
    resource: string;
    resourceData?: {
      id: string;
      '@odata.type': string;
      '@odata.id': string;
    };
  }): Promise<{ processed: boolean; documentId?: string }> {
    try {
      // Validate client state
      const expectedClientState = process.env.ONEDRIVE_WEBHOOK_SECRET;
      if (expectedClientState && notification.clientState !== expectedClientState) {
        logger.warn('Invalid webhook client state', {
          subscriptionId: notification.subscriptionId,
        });
        return { processed: false };
      }

      // Verify subscription exists
      const subscription = await this.getSubscriptionByGraphId(notification.subscriptionId);
      if (!subscription || !subscription.isActive) {
        logger.warn('Webhook subscription not found or inactive', {
          subscriptionId: notification.subscriptionId,
        });
        return { processed: false };
      }

      // Only process 'updated' changes for document sync
      if (notification.changeType !== 'updated') {
        logger.debug('Ignoring non-update change type', {
          changeType: notification.changeType,
        });
        return { processed: false };
      }

      // Extract OneDrive item ID from resource path or resourceData
      let oneDriveId: string | undefined;

      if (notification.resourceData?.id) {
        oneDriveId = notification.resourceData.id;
      } else if (notification.resource) {
        // Parse resource path like "/me/drive/items/{item-id}"
        const match = notification.resource.match(/items\/([^/]+)/);
        if (match) {
          oneDriveId = match[1];
        }
      }

      if (!oneDriveId) {
        logger.warn('Could not extract OneDrive ID from notification', {
          resource: notification.resource,
        });
        return { processed: false };
      }

      // Find document by OneDrive ID
      const document = await prisma.document.findFirst({
        where: { oneDriveId },
        select: { id: true, oneDriveId: true },
      });

      if (!document) {
        // Not a tracked document - ignore
        logger.debug('OneDrive item not tracked', { oneDriveId });
        return { processed: false };
      }

      logger.info('Processing OneDrive change notification', {
        documentId: document.id,
        oneDriveId,
        changeType: notification.changeType,
      });

      // Queue sync job (would use BullMQ in production)
      // For now, we just log and return the document ID
      // The actual sync should be triggered by a background worker

      return { processed: true, documentId: document.id };
    } catch (error) {
      logger.error('Failed to process drive item change', {
        error,
        subscriptionId: notification.subscriptionId,
      });
      return { processed: false };
    }
  }

  /**
   * Create drive item change subscription for document sync
   * Story 3.4 - Task 3
   *
   * @param accessToken - Graph API access token
   * @returns Created subscription
   */
  async createDriveItemSubscription(
    accessToken: string
  ): Promise<GraphSubscription> {
    logger.info('Creating drive item subscription for document sync');

    return await this.createSubscription({
      resource: '/me/drive/root',
      changeTypes: ['updated'],
      accessToken,
      clientState: process.env.ONEDRIVE_WEBHOOK_SECRET,
    });
  }
}

export const webhookService = new WebhookService();
