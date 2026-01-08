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

import { EmailClassificationState } from '@prisma/client';
import { prisma, redis } from '@legal-platform/database';
import {
  classificationScoringService,
  type EmailForClassification,
  type ClassificationResult,
} from '../services/classification-scoring';
import { emailCleanerService } from '../services/email-cleaner.service';

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
  batchSize: parseInt(process.env.EMAIL_CATEGORIZATION_BATCH_SIZE || '10', 10),
  intervalMs: parseInt(process.env.EMAIL_CATEGORIZATION_INTERVAL_MS || '300000', 10), // 5 min
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
  const emails = await prisma.email.findMany({
    where: {
      classificationState: EmailClassificationState.Pending,
      isIgnored: false,
      parentFolderName: 'Inbox', // Only process inbox emails - sent emails don't need categorization
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
    });
  }

  return byUser;
}

/**
 * Process emails for a single user using the enhanced classification scoring algorithm
 * OPS-039: Uses weighted signals for multi-case classification
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
    totalTokensUsed: 0, // No longer using AI tokens for basic classification
  };

  if (emails.length === 0) {
    return stats;
  }

  // Get firmId from first email (all emails for a user should have same firmId)
  const firmId = emails[0].firmId;

  // Classify each email using the enhanced scoring service
  for (const email of emails) {
    try {
      const result: ClassificationResult = await classificationScoringService.classifyEmail(
        email,
        firmId,
        userId
      );
      stats.processed++;

      // Update email based on classification result
      if (
        result.state === EmailClassificationState.Classified &&
        result.caseAssignments.length > 0
      ) {
        // OPS-059: Create EmailCaseLink records for all case assignments
        const primaryAssignment =
          result.caseAssignments.find((a) => a.isPrimary) || result.caseAssignments[0];

        // Update email with primary case for backward compatibility
        await prisma.email.update({
          where: { id: email.id },
          data: {
            caseId: primaryAssignment.caseId,
            classificationState: EmailClassificationState.Classified,
            classificationConfidence: primaryAssignment.confidence,
            classifiedAt: new Date(),
            classifiedBy: 'auto',
          },
        });

        // Create EmailCaseLink records for ALL assignments
        for (const assignment of result.caseAssignments) {
          try {
            await prisma.emailCaseLink.upsert({
              where: {
                emailId_caseId: {
                  emailId: email.id,
                  caseId: assignment.caseId,
                },
              },
              update: {
                confidence: assignment.confidence,
                matchType: assignment.matchType,
                isPrimary: assignment.isPrimary,
                linkedAt: new Date(),
                linkedBy: 'auto',
              },
              create: {
                emailId: email.id,
                caseId: assignment.caseId,
                confidence: assignment.confidence,
                matchType: assignment.matchType,
                isPrimary: assignment.isPrimary,
                linkedBy: 'auto',
              },
            });
          } catch (linkError) {
            console.error(
              `[Email Categorization Worker] Failed to create EmailCaseLink for email ${email.id} → case ${assignment.caseId}:`,
              linkError
            );
          }
        }

        stats.assigned++;
        console.log(
          `[Email Categorization Worker] Classified email ${email.id} to ${result.caseAssignments.length} case(s): ${result.caseAssignments.map((a) => a.caseId).join(', ')} (primary: ${primaryAssignment.caseId})`
        );
      } else if (result.state === EmailClassificationState.CourtUnassigned) {
        // OPS-040: Court email without matching case - goes to INSTANȚE folder
        await prisma.email.update({
          where: { id: email.id },
          data: {
            classificationState: EmailClassificationState.CourtUnassigned,
            classificationConfidence: result.confidence,
            classifiedAt: new Date(),
            classifiedBy: 'auto',
          },
        });
        stats.flaggedForReview++;
        console.log(
          `[Email Categorization Worker] Court email ${email.id} → INSTANȚE folder (reason: ${result.reason || result.matchType}, refs: ${result.extractedReferences?.join(', ') || 'none'})`
        );
      } else {
        // Mark as uncertain for manual review (NECLAR queue)
        await prisma.email.update({
          where: { id: email.id },
          data: {
            classificationState: EmailClassificationState.Uncertain,
            classificationConfidence: result.confidence,
            classifiedAt: new Date(),
            classifiedBy: 'auto',
          },
        });
        stats.flaggedForReview++;
        console.log(
          `[Email Categorization Worker] Flagged email ${email.id} as uncertain (reason: ${result.reason || result.matchType})`
        );
      }

      // OPS-090: Clean email content (extract new content only, remove signatures/quotes)
      await cleanEmailContent(email);

      // Small delay between classifications to avoid overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`[Email Categorization Worker] Error categorizing email ${email.id}:`, error);
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
      email.bodyContentType
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
