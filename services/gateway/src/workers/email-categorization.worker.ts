/**
 * Email Categorization Worker
 * Story 5.1: Email Integration and Synchronization
 * OPS-039: Enhanced Multi-Case Classification Algorithm
 *
 * Background worker that processes uncategorized emails using the
 * enhanced classification scoring algorithm with weighted signals.
 *
 * Configuration via environment variables:
 * - EMAIL_CATEGORIZATION_BATCH_SIZE: Emails per batch (default: 10)
 * - EMAIL_CATEGORIZATION_INTERVAL_MS: Worker interval (default: 300000 = 5 min)
 */

import { EmailClassificationState, UserRole } from '@prisma/client';
import { prisma, redis } from '@legal-platform/database';
import {
  emailClassifierService,
  type EmailForClassification,
  type ClassificationResult,
} from '../services/email-classifier';
import { emailCleanerService } from '../services/email-cleaner.service';
import { caseNotificationService } from '../services/case-notification.service';

// ============================================================================
// Types
// ============================================================================

interface WorkerConfig {
  batchSize: number;
  intervalMs: number;
  enabled: boolean;
  lowConfidenceThreshold: number;
}

interface WorkerStats {
  processed: number;
  assigned: number;
  flaggedForReview: number;
  errors: number;
  totalTokensUsed: number;
  avgConfidence: number;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: WorkerConfig = {
  batchSize: parseInt(process.env.EMAIL_CATEGORIZATION_BATCH_SIZE || '1000', 10), // Process up to 1000 emails per batch
  intervalMs: parseInt(process.env.EMAIL_CATEGORIZATION_INTERVAL_MS || '60000', 10), // 1 min
  enabled: process.env.EMAIL_AI_CATEGORIZATION_ENABLED !== 'false',
  lowConfidenceThreshold: 0.7,
};

const METRICS_KEY = 'email:categorization:metrics';
const LAST_RUN_KEY = 'email:categorization:lastRun';

// ============================================================================
// Worker State
// ============================================================================

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let config: WorkerConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the email categorization worker
 */
export function startEmailCategorizationWorker(customConfig: Partial<WorkerConfig> = {}): void {
  if (isRunning) {
    console.log('[Email Categorization Worker] Already running');
    return;
  }

  config = { ...DEFAULT_CONFIG, ...customConfig };

  if (!config.enabled) {
    console.log('[Email Categorization Worker] Disabled via configuration');
    return;
  }

  console.log('[Email Categorization Worker] Starting...');
  console.log(`  Batch size: ${config.batchSize}`);
  console.log(`  Interval: ${config.intervalMs / 1000}s`);

  isRunning = true;

  // Run immediately
  processCategorizationBatch().catch((error) => {
    console.error('[Email Categorization Worker] Initial run error:', error);
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    processCategorizationBatch().catch((error) => {
      console.error('[Email Categorization Worker] Processing error:', error);
    });
  }, config.intervalMs);

  console.log('[Email Categorization Worker] Started successfully');
}

/**
 * Stop the email categorization worker
 */
export function stopEmailCategorizationWorker(): void {
  if (!isRunning) {
    console.log('[Email Categorization Worker] Not running');
    return;
  }

  console.log('[Email Categorization Worker] Stopping...');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  isRunning = false;
  console.log('[Email Categorization Worker] Stopped');
}

/**
 * Check if worker is running
 */
export function isEmailCategorizationWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Get worker stats
 */
export async function getWorkerStats(): Promise<WorkerStats | null> {
  try {
    const data = await redis.get(METRICS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Batch Processing (AC: 2)
// ============================================================================

/**
 * Process a batch of uncategorized emails
 */
async function processCategorizationBatch(): Promise<void> {
  const startTime = Date.now();
  const stats: WorkerStats = {
    processed: 0,
    assigned: 0,
    flaggedForReview: 0,
    errors: 0,
    totalTokensUsed: 0,
    avgConfidence: 0,
    processingTimeMs: 0,
  };

  try {
    console.log('[Email Categorization Worker] Processing batch...');

    // Get uncategorized emails grouped by user
    const emailsByUser = await getUncategorizedEmailsByUser(config.batchSize);

    if (Object.keys(emailsByUser).length === 0) {
      console.log('[Email Categorization Worker] No uncategorized emails found');
      await updateLastRun();
      return;
    }

    // Process each user's emails
    for (const [userId, emails] of Object.entries(emailsByUser)) {
      try {
        const userStats = await processUserEmails(userId, emails);
        stats.processed += userStats.processed;
        stats.assigned += userStats.assigned;
        stats.flaggedForReview += userStats.flaggedForReview;
        stats.totalTokensUsed += userStats.totalTokensUsed;
      } catch (error) {
        console.error(`[Email Categorization Worker] Error processing user ${userId}:`, error);
        stats.errors++;
      }
    }

    // Calculate average confidence
    if (stats.processed > 0) {
      stats.avgConfidence = stats.assigned / stats.processed;
    }

    stats.processingTimeMs = Date.now() - startTime;

    // Save metrics
    await saveStats(stats);
    await updateLastRun();

    console.log(`[Email Categorization Worker] Batch complete:`, {
      processed: stats.processed,
      assigned: stats.assigned,
      flaggedForReview: stats.flaggedForReview,
      errors: stats.errors,
      timeMs: stats.processingTimeMs,
    });
  } catch (error) {
    console.error('[Email Categorization Worker] Batch processing failed:', error);
    stats.errors++;
    stats.processingTimeMs = Date.now() - startTime;
    await saveStats(stats);
  }
}

/**
 * Extended email type with firmId and bodyContentType for worker processing
 */
type EmailForClassificationWithFirm = EmailForClassification & {
  firmId: string;
  bodyContentType: string;
};

/**
 * Get uncategorized emails grouped by user
 * Now queries for emails with Pending classification state (OPS-039)
 */
async function getUncategorizedEmailsByUser(
  limit: number
): Promise<Record<string, EmailForClassificationWithFirm[]>> {
  // Debug: Log email state distribution
  const stateStats = await prisma.email.groupBy({
    by: ['classificationState'],
    _count: true,
  });
  console.log('[Email Categorization Worker] Email state distribution:', stateStats);

  const emails = await prisma.email.findMany({
    where: {
      classificationState: EmailClassificationState.Pending,
      isIgnored: false,
      // Process all folders except deleted items (Romanian: "Elemente şterse")
      // Use OR to also include NULL parentFolderName values
      OR: [
        { parentFolderName: { notIn: ['Deleted Items', 'Elemente şterse'] } },
        { parentFolderName: null },
      ],
    },
    select: {
      id: true,
      userId: true,
      firmId: true,
      conversationId: true,
      subject: true,
      bodyPreview: true,
      bodyContent: true,
      bodyContentType: true, // OPS-090: Needed for email cleaning
      from: true,
      toRecipients: true,
      ccRecipients: true,
      receivedDateTime: true,
      parentFolderName: true, // Needed to detect sent vs received emails
    },
    orderBy: {
      receivedDateTime: 'desc',
    },
    take: limit,
  });

  // Group by user
  const byUser: Record<string, EmailForClassificationWithFirm[]> = {};

  for (const email of emails) {
    if (!byUser[email.userId]) {
      byUser[email.userId] = [];
    }
    byUser[email.userId].push({
      id: email.id,
      firmId: email.firmId,
      conversationId: email.conversationId,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      bodyContent: email.bodyContent,
      bodyContentType: email.bodyContentType, // OPS-090
      from: email.from as { name?: string; address: string },
      toRecipients: (email.toRecipients as Array<{ name?: string; address: string }>) || [],
      ccRecipients: (email.ccRecipients as Array<{ name?: string; address: string }>) || [],
      receivedDateTime: email.receivedDateTime,
      parentFolderName: email.parentFolderName || undefined,
    });
  }

  return byUser;
}

// Concurrency limit for parallel processing
const PARALLEL_LIMIT = 50;

/**
 * Process emails for a single user using parallel classification
 * Optimized for high throughput with batched updates
 */
async function processUserEmails(
  userId: string,
  emails: EmailForClassificationWithFirm[]
): Promise<{
  processed: number;
  assigned: number;
  flaggedForReview: number;
  totalTokensUsed: number;
}> {
  const stats = {
    processed: 0,
    assigned: 0,
    flaggedForReview: 0,
    totalTokensUsed: 0,
  };

  if (emails.length === 0) {
    return stats;
  }

  const firmId = emails[0].firmId;

  // Check if email owner is a Partner for private-by-default
  const emailOwner = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const isPartnerOwner =
    emailOwner?.role === UserRole.Partner || emailOwner?.role === UserRole.BusinessOwner;

  // Process emails in parallel chunks
  for (let i = 0; i < emails.length; i += PARALLEL_LIMIT) {
    const chunk = emails.slice(i, i + PARALLEL_LIMIT);

    const results = await Promise.allSettled(
      chunk.map(async (email) => {
        const result = await emailClassifierService.classifyEmail(email, firmId, userId);
        return { email, result };
      })
    );

    // Process results and batch updates
    const now = new Date();

    for (const settled of results) {
      if (settled.status === 'rejected') {
        console.error('[Email Categorization Worker] Classification error:', settled.reason);
        continue;
      }

      const { email, result } = settled.value;
      stats.processed++;

      try {
        if (result.state === EmailClassificationState.Classified && result.caseId) {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              caseId: result.caseId,
              classificationState: EmailClassificationState.Classified,
              classificationConfidence: result.confidence,
              classifiedAt: now,
              classifiedBy: 'auto',
              ...(isPartnerOwner && { isPrivate: true }),
            },
          });

          // Create EmailCaseLink (fire and forget)
          prisma.emailCaseLink.upsert({
            where: { emailId_caseId: { emailId: email.id, caseId: result.caseId } },
            update: {
              confidence: result.confidence,
              matchType: result.matchType === 'THREAD' ? 'ThreadContinuity'
                       : result.matchType === 'REFERENCE' ? 'ReferenceNumber' : 'Actor',
              isPrimary: true,
              linkedAt: now,
              linkedBy: 'auto',
            },
            create: {
              emailId: email.id,
              caseId: result.caseId,
              confidence: result.confidence,
              matchType: result.matchType === 'THREAD' ? 'ThreadContinuity'
                       : result.matchType === 'REFERENCE' ? 'ReferenceNumber' : 'Actor',
              isPrimary: true,
              linkedBy: 'auto',
            },
          }).catch(() => {}); // Non-blocking

          stats.assigned++;
        } else if (result.state === EmailClassificationState.CourtUnassigned) {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              classificationState: EmailClassificationState.CourtUnassigned,
              classificationConfidence: result.confidence,
              classifiedAt: now,
              classifiedBy: 'auto',
            },
          });
          stats.flaggedForReview++;
        } else if (result.state === EmailClassificationState.ClientInbox) {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              classificationState: EmailClassificationState.ClientInbox,
              clientId: result.clientId || null,
              classificationConfidence: result.confidence,
              classifiedAt: now,
              classifiedBy: 'auto',
              ...(isPartnerOwner && { isPrivate: true }),
            },
          });
          stats.flaggedForReview++;
        } else {
          await prisma.email.update({
            where: { id: email.id },
            data: {
              classificationState: EmailClassificationState.Uncertain,
              classificationConfidence: result.confidence,
              classifiedAt: now,
              classifiedBy: 'auto',
            },
          });
          stats.flaggedForReview++;
        }
      } catch (error) {
        console.error(`[Email Categorization Worker] Update error for ${email.id}:`, error);
      }
    }

    // Log progress for large batches
    if (emails.length > PARALLEL_LIMIT) {
      console.log(`[Email Categorization Worker] Progress: ${Math.min(i + PARALLEL_LIMIT, emails.length)}/${emails.length} emails`);
    }
  }

  return stats;
}

/**
 * Clean email content using AI to extract only new message content.
 * OPS-090: Email Content Cleaning for Readability
 */
async function cleanEmailContent(email: EmailForClassificationWithFirm): Promise<void> {
  try {
    // Skip if email is too short or already has clean content
    if (!email.bodyContent || email.bodyContent.length < 100) {
      return;
    }

    const result = await emailCleanerService.extractCleanContent(
      email.bodyContent,
      email.bodyContentType,
      { firmId: email.firmId, emailId: email.id }
    );

    if (result.success && result.cleanContent) {
      await prisma.email.update({
        where: { id: email.id },
        data: { bodyContentClean: result.cleanContent },
      });

      console.log(
        `[Email Categorization Worker] Cleaned email ${email.id} content (${result.tokensUsed?.input || 0} in, ${result.tokensUsed?.output || 0} out tokens)`
      );
    }
  } catch (error) {
    // Non-blocking: log error but don't fail classification
    console.error(`[Email Categorization Worker] Failed to clean email ${email.id}:`, error);
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function saveStats(stats: WorkerStats): Promise<void> {
  try {
    await redis.set(METRICS_KEY, JSON.stringify(stats), 'EX', 3600); // 1 hour TTL
  } catch (error) {
    console.error('[Email Categorization Worker] Failed to save stats:', error);
  }
}

async function updateLastRun(): Promise<void> {
  try {
    await redis.set(LAST_RUN_KEY, new Date().toISOString());
  } catch (error) {
    console.error('[Email Categorization Worker] Failed to update last run:', error);
  }
}

/**
 * Get last run timestamp
 */
export async function getLastRun(): Promise<Date | null> {
  try {
    const data = await redis.get(LAST_RUN_KEY);
    return data ? new Date(data) : null;
  } catch {
    return null;
  }
}

/**
 * Trigger immediate processing (for manual runs)
 */
export async function triggerProcessing(): Promise<WorkerStats> {
  const startStats = await getWorkerStats();
  await processCategorizationBatch();
  const endStats = await getWorkerStats();
  return (
    endStats || {
      processed: 0,
      assigned: 0,
      flaggedForReview: 0,
      errors: 0,
      totalTokensUsed: 0,
      avgConfidence: 0,
      processingTimeMs: 0,
    }
  );
}
