/**
 * Context Document Worker
 *
 * Background worker that processes context document invalidation events.
 * When entities change, this worker triggers regeneration of affected context documents.
 *
 * Uses BullMQ for job queue management.
 */

import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import type { InvalidationEvent, ContextInvalidationPayload } from '@legal-platform/types';
import { clientContextDocumentService } from '../services/client-context-document.service';
import { caseContextDocumentService } from '../services/case-context-document.service';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Queue Setup
// ============================================================================

// Redis connection for BullMQ
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue name
const QUEUE_NAME = 'context-document-invalidation';

// Job data interface
export interface ContextInvalidationJobData {
  event: InvalidationEvent;
  clientId?: string;
  caseId?: string;
  entityId?: string;
  entityType?: string;
  timestamp: string;
  firmId: string;
}

// Create queue
export const contextDocumentQueue = new Queue<ContextInvalidationJobData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 seconds initial delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 3 * 24 * 3600, // Keep failed jobs for 3 days
    },
  },
});

// ============================================================================
// Job Queueing Functions
// ============================================================================

/**
 * Queue a context invalidation job
 */
export async function queueContextInvalidation(
  data: ContextInvalidationJobData
): Promise<Job<ContextInvalidationJobData>> {
  const jobId = generateJobId(data);

  const job = await contextDocumentQueue.add(`invalidate-${data.event}`, data, {
    jobId,
    priority: getPriority(data.event),
    delay: getDelay(data.event),
  });

  logger.info('[ContextDocumentWorker] Job queued', {
    bullmqJobId: job.id,
    event: data.event,
    caseId: data.caseId,
    clientId: data.clientId,
  });

  return job;
}

/**
 * Queue invalidation when client is updated
 */
export async function invalidateClientContext(clientId: string, firmId: string): Promise<void> {
  await queueContextInvalidation({
    event: 'client_updated',
    clientId,
    firmId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Queue invalidation when case is updated
 */
export async function invalidateCaseContext(
  caseId: string,
  firmId: string,
  event: InvalidationEvent = 'case_updated'
): Promise<void> {
  await queueContextInvalidation({
    event,
    caseId,
    firmId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Queue invalidation when actor is added/updated
 */
export async function invalidateActorContext(
  caseId: string,
  actorId: string,
  firmId: string,
  event: 'actor_added' | 'actor_updated' | 'actor_removed'
): Promise<void> {
  await queueContextInvalidation({
    event,
    caseId,
    entityId: actorId,
    entityType: 'actor',
    firmId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Queue invalidation when document description is added
 */
export async function invalidateDocumentDescriptionContext(
  documentId: string,
  firmId: string
): Promise<void> {
  await queueContextInvalidation({
    event: 'document_description_added',
    entityId: documentId,
    entityType: 'document',
    firmId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Queue invalidation when email is classified to a case
 */
export async function invalidateEmailClassificationContext(
  caseId: string,
  emailId: string,
  firmId: string
): Promise<void> {
  await queueContextInvalidation({
    event: 'email_classified',
    caseId,
    entityId: emailId,
    entityType: 'email',
    firmId,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// Job Processing
// ============================================================================

/**
 * Process context invalidation jobs
 */
async function processContextInvalidationJob(
  job: Job<ContextInvalidationJobData>
): Promise<{ success: boolean; regenerated: string[] }> {
  const { event, clientId, caseId, entityId, entityType, firmId } = job.data;

  logger.info('[ContextDocumentWorker] Processing job', {
    bullmqJobId: job.id,
    event,
    clientId,
    caseId,
  });

  const regenerated: string[] = [];

  try {
    switch (event) {
      case 'client_updated':
        if (clientId) {
          // Regenerate client context
          await clientContextDocumentService.regenerate(clientId, firmId);
          regenerated.push(`client:${clientId}`);

          // Also invalidate all case contexts for this client
          await caseContextDocumentService.invalidateForClient(clientId);
          regenerated.push(`cases_for_client:${clientId}`);
        }
        break;

      case 'case_updated':
      case 'actor_added':
      case 'actor_updated':
      case 'actor_removed':
      case 'document_uploaded':
      case 'document_description_added':
      case 'document_removed':
      case 'email_classified':
      case 'task_created':
      case 'task_completed':
      case 'deadline_added':
      case 'team_member_added':
      case 'team_member_removed':
      case 'case_status_changed':
        if (caseId) {
          // Regenerate case context
          const caseData = await prisma.case.findUnique({
            where: { id: caseId },
            select: { firmId: true },
          });

          if (caseData) {
            await caseContextDocumentService.regenerate(caseId, caseData.firmId);
            regenerated.push(`case:${caseId}`);
          }
        }
        break;

      case 'manual_refresh':
        // Regenerate everything specified
        if (clientId) {
          await clientContextDocumentService.regenerate(clientId, firmId);
          regenerated.push(`client:${clientId}`);
        }
        if (caseId) {
          await caseContextDocumentService.regenerate(caseId, firmId);
          regenerated.push(`case:${caseId}`);
        }
        break;

      default:
        logger.warn('[ContextDocumentWorker] Unknown event type', { event });
    }

    logger.info('[ContextDocumentWorker] Job completed', {
      bullmqJobId: job.id,
      regenerated,
    });

    return { success: true, regenerated };
  } catch (error: any) {
    logger.error('[ContextDocumentWorker] Job failed', {
      bullmqJobId: job.id,
      event,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique job ID to prevent duplicates
 */
function generateJobId(data: ContextInvalidationJobData): string {
  const parts = ['ctx', data.event];
  if (data.clientId) parts.push(`c${data.clientId}`);
  if (data.caseId) parts.push(`d${data.caseId}`);
  if (data.entityId) parts.push(`e${data.entityId}`);
  // Add timestamp to last minute to allow deduplication within a minute
  const minute = Math.floor(Date.now() / 60000);
  parts.push(String(minute));
  return parts.join('-');
}

/**
 * Get priority based on event type
 * Lower number = higher priority
 */
function getPriority(event: InvalidationEvent): number {
  switch (event) {
    case 'manual_refresh':
      return 1; // Highest priority for manual refresh
    case 'actor_updated':
    case 'document_description_added':
      return 2; // High priority for communication-affecting changes
    case 'email_classified':
    case 'task_created':
    case 'deadline_added':
      return 3; // Medium priority
    default:
      return 5; // Normal priority
  }
}

/**
 * Get delay based on event type (to batch rapid changes)
 * Returns delay in milliseconds
 */
function getDelay(event: InvalidationEvent): number {
  switch (event) {
    case 'manual_refresh':
      return 0; // No delay for manual refresh
    case 'email_classified':
      return 5000; // 5 second delay to batch multiple email classifications
    default:
      return 2000; // 2 second delay for most events
  }
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Create and start the worker
 */
export function createContextDocumentWorker(): Worker<ContextInvalidationJobData> {
  const worker = new Worker<ContextInvalidationJobData>(QUEUE_NAME, processContextInvalidationJob, {
    connection: redisConnection,
    concurrency: 3, // Process up to 3 jobs concurrently
  });

  // Event handlers
  worker.on('completed', (job, result) => {
    logger.info('[ContextDocumentWorker] Job completed', {
      bullmqJobId: job.id,
      regenerated: result.regenerated.length,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('[ContextDocumentWorker] Job failed', {
      bullmqJobId: job?.id,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('[ContextDocumentWorker] Worker error', { error: err.message });
  });

  logger.info('[ContextDocumentWorker] Worker started', {
    concurrency: 3,
    queue: QUEUE_NAME,
  });

  return worker;
}

// Graceful shutdown
export async function shutdownContextDocumentWorker(worker: Worker): Promise<void> {
  logger.info('[ContextDocumentWorker] Shutting down...');
  await worker.close();
  await contextDocumentQueue.close();
  await redisConnection.quit();
  logger.info('[ContextDocumentWorker] Shut down complete');
}

// ============================================================================
// Singleton worker management
// ============================================================================

let workerInstance: Worker<ContextInvalidationJobData> | null = null;

/**
 * Start the context document worker (singleton)
 */
export function startContextDocumentWorker(): void {
  if (workerInstance) {
    logger.warn('[ContextDocumentWorker] Worker already running');
    return;
  }
  workerInstance = createContextDocumentWorker();
}

/**
 * Stop the context document worker
 */
export async function stopContextDocumentWorker(): Promise<void> {
  if (workerInstance) {
    await shutdownContextDocumentWorker(workerInstance);
    workerInstance = null;
  }
}
