/**
 * Client Attachment Sync Worker
 *
 * Background worker that syncs email attachments for emails reclassified to ClientInbox.
 * When a new client is created and emails are moved to their inbox, this worker
 * downloads attachments from Graph API and uploads them to SharePoint.
 *
 * Uses app-only tokens (client credentials flow) - NO user session required.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@legal-platform/database';
import { GraphService } from '../services/graph.service';
import { getEmailAttachmentService } from '../services/email-attachment.service';
import logger from '../utils/logger';

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'client-attachment-sync';

// Job data interface
export interface ClientAttachmentSyncJobData {
  emailId: string;
  userId: string;
  clientId: string;
}

// Create queue
export const clientAttachmentSyncQueue = new Queue<ClientAttachmentSyncJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10 seconds initial delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Queue attachment sync for an email
 */
export async function queueClientAttachmentSync(
  data: ClientAttachmentSyncJobData
): Promise<Job<ClientAttachmentSyncJobData>> {
  const job = await clientAttachmentSyncQueue.add(`sync-${data.emailId}`, data, {
    jobId: `client-attachment-sync-${data.emailId}`,
    delay: 2000, // Small delay to batch potential concurrent requests
  });

  logger.debug('[ClientAttachmentSyncWorker] Job queued', {
    jobId: job.id,
    emailId: data.emailId,
    clientId: data.clientId,
  });

  return job;
}

/**
 * Queue attachment sync for multiple emails (batch)
 */
export async function queueClientAttachmentSyncBatch(
  emails: Array<{ emailId: string; userId: string; clientId: string }>
): Promise<void> {
  if (emails.length === 0) return;

  const jobs = emails.map((data) => ({
    name: `sync-${data.emailId}`,
    data,
    opts: {
      jobId: `client-attachment-sync-${data.emailId}`,
      delay: 2000,
    },
  }));

  await clientAttachmentSyncQueue.addBulk(jobs);

  logger.info('[ClientAttachmentSyncWorker] Batch queued', {
    count: emails.length,
    clientId: emails[0]?.clientId,
  });
}

/**
 * Process client attachment sync jobs
 */
async function processClientAttachmentSync(
  job: Job<ClientAttachmentSyncJobData>
): Promise<{ success: boolean; attachmentsSynced: number; errors: string[] }> {
  const { emailId, clientId } = job.data;

  logger.info('[ClientAttachmentSyncWorker] Processing job', {
    jobId: job.id,
    emailId,
    clientId,
    attempt: job.attemptsMade + 1,
  });

  // Check if email still has attachments and belongs to client
  // Also get the email owner's Azure AD ID for Graph API access
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      hasAttachments: true,
      clientId: true,
      caseId: true,
      graphMessageId: true,
      userId: true,
      user: {
        select: { azureAdId: true },
      },
    },
  });

  if (!email) {
    logger.warn('[ClientAttachmentSyncWorker] Email not found', { emailId });
    return { success: true, attachmentsSynced: 0, errors: [] };
  }

  if (!email.hasAttachments) {
    logger.debug('[ClientAttachmentSyncWorker] Email has no attachments', { emailId });
    return { success: true, attachmentsSynced: 0, errors: [] };
  }

  // Email might have been assigned to a case since queuing - still sync
  // If email was unlinked (e.g., client deleted), skip gracefully without retry
  if (!email.clientId && !email.caseId) {
    logger.info('[ClientAttachmentSyncWorker] Email no longer classified, skipping', { emailId });
    return { success: true, attachmentsSynced: 0, errors: [] };
  }

  // Use the email owner's Azure AD ID for Graph API access
  // This ensures we can access the email in the correct mailbox
  const azureAdId = email.user?.azureAdId;
  if (!azureAdId) {
    throw new Error(`Email owner Azure AD ID not found for email: ${emailId}`);
  }

  // Get app-only Graph client
  const graphService = new GraphService();
  const appClient = await graphService.getAppClient();

  logger.info('[ClientAttachmentSyncWorker] Syncing attachments', {
    jobId: job.id,
    emailId,
    azureAdId,
  });

  try {
    const attachmentService = getEmailAttachmentService(prisma);
    const result = await attachmentService.syncAllAttachmentsWithClient(
      emailId,
      appClient,
      azureAdId
    );

    logger.info('[ClientAttachmentSyncWorker] Sync complete', {
      jobId: job.id,
      emailId,
      attachmentsSynced: result.attachmentsSynced,
      errors: result.errors.length,
    });

    return {
      success: result.success,
      attachmentsSynced: result.attachmentsSynced,
      errors: result.errors,
    };
  } catch (error: any) {
    logger.error('[ClientAttachmentSyncWorker] Sync failed', {
      jobId: job.id,
      emailId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create and start the worker
 */
export function createClientAttachmentSyncWorker(): Worker<ClientAttachmentSyncJobData> {
  const worker = new Worker<ClientAttachmentSyncJobData>(QUEUE_NAME, processClientAttachmentSync, {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 emails concurrently
    lockDuration: 180000, // 3 minutes per email (attachments can be large)
    stalledInterval: 30000,
    limiter: {
      max: 20, // Max 20 jobs per minute
      duration: 60000,
    },
  });

  worker.on('completed', (job, result) => {
    if (result.attachmentsSynced > 0) {
      logger.info('[ClientAttachmentSyncWorker] Job completed', {
        jobId: job.id,
        emailId: job.data.emailId,
        attachmentsSynced: result.attachmentsSynced,
      });
    }
  });

  worker.on('failed', (job, err) => {
    logger.error('[ClientAttachmentSyncWorker] Job failed', {
      jobId: job?.id,
      emailId: job?.data.emailId,
      error: err.message,
      attempt: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('[ClientAttachmentSyncWorker] Worker error', { error: err.message });
  });

  logger.info('[ClientAttachmentSyncWorker] Worker started', {
    concurrency: 3,
    queue: QUEUE_NAME,
  });

  return worker;
}

// ============================================================================
// Singleton worker management
// ============================================================================

let workerInstance: Worker<ClientAttachmentSyncJobData> | null = null;

/**
 * Start the client attachment sync worker (singleton)
 */
export function startClientAttachmentSyncWorker(): void {
  if (workerInstance) {
    logger.warn('[ClientAttachmentSyncWorker] Worker already running');
    return;
  }
  workerInstance = createClientAttachmentSyncWorker();
}

/**
 * Stop the client attachment sync worker
 */
export async function stopClientAttachmentSyncWorker(): Promise<void> {
  if (workerInstance) {
    logger.info('[ClientAttachmentSyncWorker] Shutting down...');
    await workerInstance.close();
    await clientAttachmentSyncQueue.close();
    workerInstance = null;
    logger.info('[ClientAttachmentSyncWorker] Shut down complete');
  }
}
