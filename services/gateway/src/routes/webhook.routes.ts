/**
 * Webhook Routes for Microsoft Graph API Notifications
 * Story 2.5 - Task 8: Create Webhook Infrastructure
 * Story 2.9 - Task 7: OneDrive Document Sync Handler
 *
 * Handles webhook validation and notification processing from Graph API
 */

import express, { Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { webhookService } from '../services/webhook.service';
import { oneDriveService } from '../services/onedrive.service';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

const router: ExpressRouter = express.Router();

/**
 * Email processing queue (placeholder for future stories)
 * Future implementation will integrate with a proper queue system (e.g., Bull, BullMQ)
 */
interface EmailProcessingTask {
  messageId: string;
  changeType: string;
  resource: string;
  timestamp: string;
}

const emailProcessingQueue: EmailProcessingTask[] = [];

/**
 * File processing queue (placeholder for future stories)
 * Future implementation will integrate with a proper queue system (e.g., Bull, BullMQ)
 */
interface FileProcessingTask {
  itemId: string;
  changeType: string;
  resource: string;
  timestamp: string;
}

const fileProcessingQueue: FileProcessingTask[] = [];

/**
 * Process email change notification
 * Story 2.5 - Task 9: Implement Email Change Notifications
 *
 * @param notification - Webhook notification for email changes
 */
async function processEmailNotification(notification: WebhookNotification): Promise<void> {
  try {
    const messageId = notification.resourceData.id;
    const changeType = notification.changeType;
    const resource = notification.resource;

    logger.info('Processing email notification', {
      messageId,
      changeType,
      resource,
      subscriptionId: notification.subscriptionId,
    });

    // Extract message details from notification
    const emailTask: EmailProcessingTask = {
      messageId,
      changeType,
      resource,
      timestamp: new Date().toISOString(),
    };

    // Queue email processing task (placeholder for future stories)
    // Future implementation will:
    // - Push to proper queue system (e.g., Bull, BullMQ)
    // - Fetch full message details from Graph API
    // - Store email in database
    // - Trigger email analysis workflows
    emailProcessingQueue.push(emailTask);

    logger.info('Email processing task queued', {
      messageId,
      changeType,
      queueSize: emailProcessingQueue.length,
    });
  } catch (error) {
    logger.error('Error processing email notification', {
      error,
      notification,
    });
    throw error;
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
        // Mark document status as archived
        await prisma.$transaction(async (tx) => {
          await tx.document.update({
            where: { id: document.id },
            data: {
              status: 'ARCHIVED',
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
                statusChangedTo: 'ARCHIVED',
              },
              firmId: document.firmId,
            },
          });
        });

        logger.info('Document archived due to OneDrive deletion', {
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
