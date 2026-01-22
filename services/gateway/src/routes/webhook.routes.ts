/**
 * Webhook Routes for Microsoft Graph API Notifications
 * Story 2.5 - Task 8: Create Webhook Infrastructure
 * Story 2.9 - Task 7: OneDrive Document Sync Handler
 *
 * Handles webhook validation and notification processing from Graph API
 */

import express, { Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { Client } from '@microsoft/microsoft-graph-client';
import type { Message, MailFolder } from '@microsoft/microsoft-graph-types';
import { webhookService } from '../services/webhook.service';
import { oneDriveService } from '../services/onedrive.service';
import { prisma } from '@legal-platform/database';
import { getGraphToken } from '../utils/token-helpers';
import logger from '../utils/logger';

const router: ExpressRouter = express.Router();

// Cache folder names for a short period to avoid repeated API calls
const folderNameCache = new Map<string, { name: string; expiresAt: number }>();
const FOLDER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * File processing queue (placeholder for untracked OneDrive files)
 */
interface FileProcessingTask {
  itemId: string;
  changeType: string;
  resource: string;
  timestamp: string;
}

const fileProcessingQueue: FileProcessingTask[] = [];

/**
 * Get folder name from Graph API (with caching)
 */
async function getFolderName(client: Client, folderId: string, userId: string): Promise<string> {
  const cacheKey = `${userId}:${folderId}`;
  const cached = folderNameCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.name;
  }

  try {
    const folder = (await client.api(`/me/mailFolders/${folderId}`).get()) as MailFolder;
    const name = folder.displayName || 'Unknown';

    folderNameCache.set(cacheKey, {
      name,
      expiresAt: Date.now() + FOLDER_CACHE_TTL_MS,
    });

    return name;
  } catch (error) {
    logger.warn('Failed to get folder name', { folderId, error });
    return 'Unknown';
  }
}

/**
 * Process email change notification
 * Fetches email from Graph API and stores in database
 *
 * @param notification - Webhook notification for email changes
 */
async function processEmailNotification(notification: WebhookNotification): Promise<void> {
  const messageId = notification.resourceData.id;
  const changeType = notification.changeType;

  logger.info('Processing email notification', {
    messageId,
    changeType,
    subscriptionId: notification.subscriptionId,
  });

  try {
    // Find the user by subscription ID (from EmailSyncState)
    const syncState = await prisma.emailSyncState.findFirst({
      where: { subscriptionId: notification.subscriptionId },
      include: { user: { select: { id: true, firmId: true } } },
    });

    if (!syncState) {
      logger.warn('No sync state found for subscription', {
        subscriptionId: notification.subscriptionId,
      });
      return;
    }

    const userId = syncState.userId;
    const firmId = syncState.user.firmId;

    // Handle delete - just remove from database
    if (changeType === 'deleted') {
      await prisma.email.deleteMany({
        where: { graphMessageId: messageId, userId },
      });
      logger.info('Email deleted from webhook', { messageId, userId });
      return;
    }

    // For created/updated, fetch the email from Graph API
    let accessToken: string;
    try {
      accessToken = await getGraphToken(userId);
    } catch (tokenError: any) {
      // User doesn't have an active session - skip processing
      // Email will be synced when they next log in
      logger.debug('Cannot process email notification - no active session', {
        userId,
        messageId,
        error: tokenError.message,
      });
      return;
    }

    // Create Graph API client
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    });

    // Fetch the full email
    const message = (await client
      .api(`/me/messages/${messageId}`)
      .select(
        'id,conversationId,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,importance,isRead,parentFolderId'
      )
      .get()) as Message;

    if (!message) {
      logger.warn('Email not found in Graph API', { messageId });
      return;
    }

    // Get folder name
    const parentFolderId = message.parentFolderId || '';
    const parentFolderName = parentFolderId
      ? await getFolderName(client, parentFolderId, userId)
      : 'Unknown';

    // Determine folder type
    const folderLower = parentFolderName.toLowerCase();
    const folderType =
      folderLower === 'inbox'
        ? 'inbox'
        : folderLower === 'sent items' || folderLower === 'sent'
          ? 'sent'
          : null;

    // Upsert the email
    await prisma.email.upsert({
      where: { graphMessageId: message.id! },
      create: {
        graphMessageId: message.id!,
        conversationId: message.conversationId || '',
        internetMessageId: message.internetMessageId || null,
        subject: message.subject || '(No Subject)',
        bodyPreview: message.bodyPreview || '',
        bodyContent: message.body?.content || '',
        bodyContentType: message.body?.contentType || 'text',
        from: message.from?.emailAddress
          ? { name: message.from.emailAddress.name, address: message.from.emailAddress.address }
          : { address: '' },
        toRecipients:
          message.toRecipients?.map((r) => ({
            name: r.emailAddress?.name,
            address: r.emailAddress?.address,
          })) || [],
        ccRecipients:
          message.ccRecipients?.map((r) => ({
            name: r.emailAddress?.name,
            address: r.emailAddress?.address,
          })) || [],
        bccRecipients:
          message.bccRecipients?.map((r) => ({
            name: r.emailAddress?.name,
            address: r.emailAddress?.address,
          })) || [],
        receivedDateTime: message.receivedDateTime
          ? new Date(message.receivedDateTime)
          : new Date(),
        sentDateTime: message.sentDateTime ? new Date(message.sentDateTime) : new Date(),
        hasAttachments: message.hasAttachments || false,
        importance: message.importance || 'normal',
        isRead: message.isRead || false,
        folderType,
        parentFolderId,
        parentFolderName,
        userId,
        firmId,
      },
      update: {
        subject: message.subject || '(No Subject)',
        bodyPreview: message.bodyPreview || '',
        bodyContent: message.body?.content || '',
        isRead: message.isRead || false,
        importance: message.importance || 'normal',
        folderType,
        parentFolderId,
        parentFolderName,
      },
    });

    logger.info('Email synced from webhook', {
      messageId,
      changeType,
      userId,
      subject: message.subject,
    });
  } catch (error: any) {
    logger.error('Error processing email notification', {
      error: error.message,
      messageId,
      subscriptionId: notification.subscriptionId,
    });
    // Don't throw - we don't want to fail the entire webhook batch
  }
}

/**
 * Process file change notification
 * Story 2.5 - Task 10: Implement File Change Notifications
 * Story 2.9 - Task 7: OneDrive Document Sync Handler
 *
 * @param notification - Webhook notification for file changes
 */
async function processFileNotification(notification: WebhookNotification): Promise<void> {
  try {
    const itemId = notification.resourceData.id;
    const changeType = notification.changeType;
    const resource = notification.resource;

    logger.info('Processing file notification', {
      itemId,
      changeType,
      resource,
      subscriptionId: notification.subscriptionId,
    });

    // Story 2.9: Sync document changes from OneDrive
    // Find document by OneDrive ID
    const document = await prisma.document.findFirst({
      where: { oneDriveId: itemId },
      include: {
        caseLinks: {
          include: { case: true },
        },
      },
    });

    if (!document) {
      // Document not tracked in system, add to queue for potential future processing
      const fileTask: FileProcessingTask = {
        itemId,
        changeType,
        resource,
        timestamp: new Date().toISOString(),
      };
      fileProcessingQueue.push(fileTask);

      logger.info('File not tracked in system, queued for reference', {
        itemId,
        changeType,
      });
      return;
    }

    logger.info('Found tracked document for OneDrive file', {
      documentId: document.id,
      fileName: document.fileName,
      oneDriveId: itemId,
      changeType,
    });

    switch (changeType) {
      case 'updated':
        // Document was modified in OneDrive
        // Note: Actual sync requires user's access token
        // This creates an audit log entry; sync will happen on next user access
        await prisma.documentAuditLog.create({
          data: {
            documentId: document.id,
            userId: document.uploadedBy,
            action: 'MetadataUpdated',
            caseId: document.caseLinks[0]?.caseId || null,
            details: {
              source: 'OneDriveWebhook',
              changeType: 'updated',
              timestamp: new Date().toISOString(),
              syncPending: true,
            },
            firmId: document.firmId,
          },
        });

        logger.info('OneDrive update notification recorded', {
          documentId: document.id,
          oneDriveId: itemId,
        });
        break;

      case 'deleted':
        // Document was deleted in OneDrive
        // Clear OneDrive reference (document record remains in database)
        await prisma.$transaction(async (tx) => {
          await tx.document.update({
            where: { id: document.id },
            data: {
              oneDriveId: null, // Clear OneDrive reference
            },
          });

          await tx.documentAuditLog.create({
            data: {
              documentId: document.id,
              userId: document.uploadedBy,
              action: 'MetadataUpdated',
              caseId: document.caseLinks[0]?.caseId || null,
              details: {
                source: 'OneDriveWebhook',
                changeType: 'deleted',
                timestamp: new Date().toISOString(),
                previousOneDriveId: itemId,
              },
              firmId: document.firmId,
            },
          });
        });

        logger.info('Document OneDrive reference cleared due to deletion', {
          documentId: document.id,
          oneDriveId: itemId,
        });
        break;

      default:
        logger.warn('Unknown changeType for file notification', {
          changeType,
          itemId,
        });
    }
  } catch (error) {
    logger.error('Error processing file notification', {
      error,
      notification,
    });
    throw error;
  }
}

// Webhook notification payload interface
interface WebhookNotification {
  subscriptionId: string;
  clientState?: string;
  changeType: string;
  resource: string;
  resourceData: {
    id: string;
    '@odata.type': string;
  };
}

interface WebhookPayload {
  value: WebhookNotification[];
  validationToken?: string;
}

/**
 * POST /webhooks/graph
 * Webhook endpoint for Graph API change notifications
 *
 * Handles two scenarios:
 * 1. Subscription validation: Returns validation token
 * 2. Change notifications: Processes webhook payload
 */
router.post('/graph', async (req: Request, res: Response) => {
  try {
    const payload = req.body as WebhookPayload;
    const validationToken = req.query.validationToken as string | undefined;

    // Scenario 1: Subscription validation
    // Graph API sends validation token during subscription creation
    if (validationToken) {
      logger.info('Received webhook validation request', { validationToken });
      const token = webhookService.validateWebhook(validationToken);
      return res.status(200).type('text/plain').send(token);
    }

    // Scenario 2: Change notification processing
    if (!payload || !payload.value || payload.value.length === 0) {
      logger.warn('Received invalid webhook payload', { payload });
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    logger.info('Received Graph API webhook notifications', {
      count: payload.value.length,
      notifications: payload.value.map((n) => ({
        subscriptionId: n.subscriptionId,
        changeType: n.changeType,
        resource: n.resource,
      })),
    });

    // Process each notification
    for (const notification of payload.value) {
      try {
        // Validate client state if configured
        const expectedClientState = process.env.WEBHOOK_CLIENT_STATE;
        if (expectedClientState && notification.clientState !== expectedClientState) {
          logger.warn('Invalid client state in webhook notification', {
            expected: expectedClientState,
            received: notification.clientState,
            subscriptionId: notification.subscriptionId,
          });
          continue;
        }

        // Verify subscription exists in database
        const subscription = await webhookService.getSubscriptionByGraphId(
          notification.subscriptionId
        );

        if (!subscription) {
          logger.warn('Received notification for unknown subscription', {
            subscriptionId: notification.subscriptionId,
          });
          continue;
        }

        if (!subscription.isActive) {
          logger.warn('Received notification for inactive subscription', {
            subscriptionId: notification.subscriptionId,
          });
          continue;
        }

        logger.info('Processing webhook notification', {
          subscriptionId: notification.subscriptionId,
          changeType: notification.changeType,
          resource: notification.resource,
          resourceType: notification.resourceData['@odata.type'],
          resourceId: notification.resourceData.id,
        });

        // Route notification to appropriate handler based on resource type
        const resourceType = notification.resourceData['@odata.type'];

        if (
          resourceType === '#Microsoft.Graph.Message' ||
          notification.resource.includes('/messages')
        ) {
          // Email notification (Story 2.5 - Task 9)
          await processEmailNotification(notification);
        } else if (
          resourceType === '#Microsoft.Graph.DriveItem' ||
          notification.resource.includes('/drive')
        ) {
          // File notification (Story 2.5 - Task 10)
          await processFileNotification(notification);
        } else {
          logger.warn('Unknown notification resource type', {
            resourceType,
            resource: notification.resource,
          });
        }
      } catch (error) {
        logger.error('Error processing webhook notification', {
          error,
          notification,
        });
        // Continue processing other notifications even if one fails
      }
    }

    // Return 202 Accepted to acknowledge receipt
    // Graph API expects response within 30 seconds
    res.status(202).json({ message: 'Notifications received' });
  } catch (error) {
    logger.error('Error handling webhook request', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
