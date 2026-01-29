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
import type {
  InvalidationEvent,
  ContextInvalidationPayload,
  ContextSectionId,
} from '@legal-platform/types';
import { clientContextDocumentService } from '../services/client-context-document.service';
import { caseContextDocumentService } from '../services/case-context-document.service';
import { unifiedContextService } from '../services/unified-context.service';
import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

// ============================================================================
// Event-to-Section Mapping
// ============================================================================

/**
 * Maps invalidation events to affected context sections.
 * Only these sections will be rebuilt when the event occurs.
 *
 * Data dependencies:
 * - identity: Client/Case main record (name, type, status, metadata)
 * - people: Actors, CaseTeam, Client.administrators/contacts
 * - documents: Document + CaseDocument tables
 * - communications: ThreadSummary + Email + Task (pendingActions)
 */
const EVENT_SECTION_MAP: Record<InvalidationEvent, ContextSectionId[]> = {
  // Client changes - affects identity and people (admins/contacts are in people)
  client_updated: ['identity', 'people'],

  // Case identity changes
  case_updated: ['identity'],
  case_status_changed: ['identity'],

  // People changes (actors, team)
  actor_added: ['people'],
  actor_updated: ['people'],
  actor_removed: ['people'],
  team_member_added: ['people'],
  team_member_removed: ['people'],

  // Document changes
  document_uploaded: ['documents'],
  document_description_added: ['documents'],
  document_removed: ['documents'],

  // Communication changes (threads, emails, pending tasks)
  email_classified: ['communications'],
  task_created: ['communications'],
  task_completed: ['communications'],
  deadline_added: ['communications'],

  // Full rebuild - escape hatch
  manual_refresh: ['identity', 'people', 'documents', 'communications'],
};

/**
 * Get affected sections for an event
 */
export function getAffectedSections(event: InvalidationEvent): ContextSectionId[] {
  return EVENT_SECTION_MAP[event] || ['identity', 'people', 'documents', 'communications'];
}

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
 * Uses incremental section-based regeneration for better performance.
 */
async function processContextInvalidationJob(
  job: Job<ContextInvalidationJobData>
): Promise<{ success: boolean; regenerated: string[] }> {
  const { event, clientId, caseId, entityId, entityType, firmId } = job.data;
  const sections = getAffectedSections(event);

  logger.info('[ContextDocumentWorker] Processing job', {
    bullmqJobId: job.id,
    event,
    sections,
    clientId,
    caseId,
  });

  const regenerated: string[] = [];

  try {
    // Handle client_updated - regenerates client and invalidates all its cases
    if (event === 'client_updated' && clientId) {
      // Regenerate client context (both legacy and unified) in parallel
      // Legacy uses full regenerate, unified uses incremental sections
      const clientResults = await Promise.allSettled([
        clientContextDocumentService.regenerate(clientId, firmId),
        unifiedContextService.regenerateSections('CLIENT', clientId, sections),
      ]);

      const legacyOk = clientResults[0].status === 'fulfilled';
      const unifiedOk = clientResults[1].status === 'fulfilled';

      if (legacyOk || unifiedOk) {
        regenerated.push(`client:${clientId}`);
      }

      // Log individual failures
      if (!legacyOk) {
        logger.warn('[ContextDocumentWorker] Legacy client regeneration failed', {
          clientId,
          error: (clientResults[0] as PromiseRejectedResult).reason?.message,
        });
      }
      if (!unifiedOk) {
        logger.warn('[ContextDocumentWorker] Unified client regeneration failed', {
          clientId,
          error: (clientResults[1] as PromiseRejectedResult).reason?.message,
        });
      }

      // Also invalidate all case contexts for this client (legacy)
      await caseContextDocumentService.invalidateForClient(clientId);

      // Invalidate unified case contexts for this client
      const clientCases = await prisma.case.findMany({
        where: { clientId },
        select: { id: true },
      });

      for (const c of clientCases) {
        await unifiedContextService.invalidate('CASE', c.id);
      }

      if (!legacyOk && !unifiedOk) {
        throw new Error('Both legacy and unified client regeneration failed');
      }
    }
    // Handle case-related events with incremental regeneration
    else if (caseId && event !== 'manual_refresh') {
      // Fetch case to get firmId if not provided
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseRecord) {
        logger.warn('[ContextDocumentWorker] Case not found', { caseId });
        return { success: true, regenerated };
      }

      const caseFirmId = firmId || caseRecord.firmId;

      // Regenerate case context (both legacy and unified) in parallel
      // Legacy uses full regenerate, unified uses incremental sections
      const caseResults = await Promise.allSettled([
        caseContextDocumentService.regenerate(caseId, caseFirmId),
        unifiedContextService.regenerateSections('CASE', caseId, sections),
      ]);

      const legacyOk = caseResults[0].status === 'fulfilled';
      const unifiedOk = caseResults[1].status === 'fulfilled';

      if (legacyOk || unifiedOk) {
        regenerated.push(`case:${caseId}`);
      }

      // Log individual failures
      if (!legacyOk) {
        logger.warn('[ContextDocumentWorker] Legacy case regeneration failed', {
          caseId,
          event,
          sections,
          error: (caseResults[0] as PromiseRejectedResult).reason?.message,
        });
      }
      if (!unifiedOk) {
        logger.warn('[ContextDocumentWorker] Unified case regeneration failed', {
          caseId,
          event,
          sections,
          error: (caseResults[1] as PromiseRejectedResult).reason?.message,
        });
      }

      if (!legacyOk && !unifiedOk) {
        throw new Error(`Both legacy and unified case regeneration failed for event ${event}`);
      }
    }
    // Handle manual_refresh with full rebuild (no incremental)
    else if (event === 'manual_refresh') {
      const failures: string[] = [];

      if (clientId) {
        const results = await Promise.allSettled([
          clientContextDocumentService.regenerate(clientId, firmId),
          unifiedContextService.regenerate('CLIENT', clientId), // Full rebuild for manual
        ]);

        if (results[0].status === 'fulfilled' || results[1].status === 'fulfilled') {
          regenerated.push(`client:${clientId}`);
        } else {
          failures.push(`client:${clientId}`);
        }
      }

      if (caseId) {
        const caseRecord = await prisma.case.findUnique({
          where: { id: caseId },
          select: { firmId: true },
        });

        if (caseRecord) {
          const caseFirmId = firmId || caseRecord.firmId;
          const results = await Promise.allSettled([
            caseContextDocumentService.regenerate(caseId, caseFirmId),
            unifiedContextService.regenerate('CASE', caseId), // Full rebuild for manual
          ]);

          if (results[0].status === 'fulfilled' || results[1].status === 'fulfilled') {
            regenerated.push(`case:${caseId}`);
          } else {
            failures.push(`case:${caseId}`);
          }
        }
      }

      if (failures.length > 0 && regenerated.length === 0) {
        throw new Error(`Manual refresh failed for: ${failures.join(', ')}`);
      }
    } else {
      logger.warn('[ContextDocumentWorker] Unknown event type or missing entity', {
        event,
        clientId,
        caseId,
      });
    }

    logger.info('[ContextDocumentWorker] Job completed', {
      bullmqJobId: job.id,
      event,
      sections,
      regenerated,
    });

    return { success: true, regenerated };
  } catch (error) {
    logger.error('[ContextDocumentWorker] Job failed', {
      bullmqJobId: job.id,
      event,
      sections,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique job ID to prevent duplicates within a short window.
 * Uses 10-second windows for deduplication while preventing collision
 * when events fire multiple times within the same minute.
 */
function generateJobId(data: ContextInvalidationJobData): string {
  const parts = ['ctx', data.event];
  if (data.clientId) parts.push(`c${data.clientId}`);
  if (data.caseId) parts.push(`d${data.caseId}`);
  if (data.entityId) parts.push(`e${data.entityId}`);
  // Use 10-second windows for deduplication (more granular than minutes)
  // This prevents collision when multiple events fire rapidly while still
  // providing reasonable deduplication for burst events
  const window = Math.floor(Date.now() / 10000);
  parts.push(String(window));
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
