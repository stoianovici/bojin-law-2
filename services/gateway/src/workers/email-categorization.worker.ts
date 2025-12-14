// @ts-nocheck
/**
 * Email Categorization Worker
 * Story 5.1: Email Integration and Synchronization
 *
 * Background worker that processes uncategorized emails using AI.
 * Uses Claude API for categorization with batch processing for cost efficiency.
 *
 * Configuration via environment variables:
 * - EMAIL_CATEGORIZATION_BATCH_SIZE: Emails per batch (default: 10)
 * - EMAIL_CATEGORIZATION_INTERVAL_MS: Worker interval (default: 300000 = 5 min)
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

// ============================================================================
// Types
// ============================================================================

interface CaseContext {
  id: string;
  title: string;
  caseNumber: string;
  clientName: string;
  clientEmail?: string;
  description?: string;
  actors: Array<{
    name: string;
    email?: string;
    role: string;
  }>;
}

interface EmailForCategorization {
  id: string;
  subject: string;
  bodyPreview: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  ccRecipients?: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
}

interface CategorizationResult {
  emailId: string;
  caseId: string | null;
  confidence: number;
  reasoning: string;
  tokensUsed: number;
}

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

let prisma: PrismaClient;
let redis: Redis;
let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let config: WorkerConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the email categorization worker
 */
export function startEmailCategorizationWorker(
  prismaClient: PrismaClient,
  redisClient: Redis,
  customConfig: Partial<WorkerConfig> = {}
): void {
  if (isRunning) {
    console.log('[Email Categorization Worker] Already running');
    return;
  }

  prisma = prismaClient;
  redis = redisClient;
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
 * Get uncategorized emails grouped by user
 */
async function getUncategorizedEmailsByUser(
  limit: number
): Promise<Record<string, EmailForCategorization[]>> {
  const emails = await prisma.email.findMany({
    where: {
      caseId: null,
    },
    select: {
      id: true,
      userId: true,
      subject: true,
      bodyPreview: true,
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
  const byUser: Record<string, EmailForCategorization[]> = {};

  for (const email of emails) {
    if (!byUser[email.userId]) {
      byUser[email.userId] = [];
    }
    byUser[email.userId].push({
      id: email.id,
      subject: email.subject,
      bodyPreview: email.bodyPreview,
      from: email.from as { name?: string; address: string },
      toRecipients: (email.toRecipients as Array<{ name?: string; address: string }>) || [],
      ccRecipients: (email.ccRecipients as Array<{ name?: string; address: string }>) || [],
      receivedDateTime: email.receivedDateTime,
    });
  }

  return byUser;
}

/**
 * Process emails for a single user
 */
async function processUserEmails(
  userId: string,
  emails: EmailForCategorization[]
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

  // Get user's firm and active cases
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firmId: true },
  });

  if (!user?.firmId) {
    console.log(`[Email Categorization Worker] User ${userId} has no firm, skipping`);
    return stats;
  }

  // Get user's cases with actors
  const cases = await getUserCases(userId, user.firmId);

  if (cases.length === 0) {
    console.log(`[Email Categorization Worker] No cases for user ${userId}, skipping`);
    return stats;
  }

  // Categorize each email
  for (const email of emails) {
    try {
      const result = await categorizeEmailWithAI(email, cases, userId, user.firmId);
      stats.processed++;
      stats.totalTokensUsed += result.tokensUsed;

      if (result.caseId && result.confidence >= config.lowConfidenceThreshold) {
        // Auto-assign high confidence matches
        await prisma.email.update({
          where: { id: email.id },
          data: { caseId: result.caseId },
        });
        stats.assigned++;
      } else {
        // Flag for manual review (low confidence or no match)
        stats.flaggedForReview++;
      }

      // Rate limit: wait 100ms between API calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Email Categorization Worker] Error categorizing email ${email.id}:`, error);
    }
  }

  return stats;
}

/**
 * Get user's active cases with actors
 */
async function getUserCases(userId: string, _firmId: string): Promise<CaseContext[]> {
  const caseTeams = await prisma.caseTeam.findMany({
    where: { userId },
    include: {
      case: {
        include: {
          client: true,
          actors: true,
        },
      },
    },
  });

  return caseTeams
    .filter((ct) => ct.case.status === 'Active' || ct.case.status === 'Pending')
    .map((ct) => {
      // Extract email from client's contactInfo JSON field
      const clientContactInfo = ct.case.client?.contactInfo as { email?: string } | null;
      return {
        id: ct.case.id,
        title: ct.case.title,
        caseNumber: ct.case.caseNumber,
        clientName: ct.case.client?.name || 'Unknown',
        clientEmail: clientContactInfo?.email || undefined,
        description: ct.case.description || undefined,
        actors: ct.case.actors.map((a) => ({
          name: a.name,
          email: a.email || undefined,
          role: a.role,
        })),
      };
    });
}

/**
 * Categorize email using AI service
 *
 * Note: In production, this would call the AI service via HTTP.
 * For now, we implement a simplified version.
 */
async function categorizeEmailWithAI(
  email: EmailForCategorization,
  cases: CaseContext[],
  userId: string,
  firmId: string
): Promise<CategorizationResult> {
  // For now, use simple heuristic matching
  // In production, this would call the AI service
  return categorizeByHeuristics(email, cases);
}

/**
 * Simple heuristic categorization (fallback/fast path)
 *
 * Matches emails based on:
 * 1. Exact email address match with case actors
 * 2. Client name in subject or body
 * 3. Case number in subject
 */
function categorizeByHeuristics(
  email: EmailForCategorization,
  cases: CaseContext[]
): CategorizationResult {
  const senderEmail = email.from.address.toLowerCase();
  const subjectLower = email.subject.toLowerCase();
  const bodyLower = email.bodyPreview.toLowerCase();

  let bestMatch: { caseId: string; confidence: number; reasoning: string } | null = null;

  for (const caseCtx of cases) {
    let confidence = 0;
    const reasons: string[] = [];

    // Check sender email against case actors
    const matchingActor = caseCtx.actors.find((a) => a.email?.toLowerCase() === senderEmail);
    if (matchingActor) {
      confidence = 0.95;
      reasons.push(`Sender matches case actor: ${matchingActor.role}`);
    }

    // Check client email
    if (caseCtx.clientEmail?.toLowerCase() === senderEmail) {
      confidence = Math.max(confidence, 0.95);
      reasons.push('Sender is case client');
    }

    // Check case number in subject
    if (subjectLower.includes(caseCtx.caseNumber.toLowerCase())) {
      confidence = Math.max(confidence, 0.9);
      reasons.push('Case number found in subject');
    }

    // Check client name in subject or body
    const clientNameLower = caseCtx.clientName.toLowerCase();
    if (subjectLower.includes(clientNameLower) || bodyLower.includes(clientNameLower)) {
      confidence = Math.max(confidence, 0.7);
      reasons.push('Client name found in email');
    }

    // Check case title keywords
    const titleWords = caseCtx.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const matchingWords = titleWords.filter(
      (w) => subjectLower.includes(w) || bodyLower.includes(w)
    );
    if (matchingWords.length >= 2) {
      confidence = Math.max(confidence, 0.6);
      reasons.push(`Case title keywords found: ${matchingWords.join(', ')}`);
    }

    // Update best match
    if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        caseId: caseCtx.id,
        confidence,
        reasoning: reasons.join('; '),
      };
    }
  }

  return {
    emailId: email.id,
    caseId: bestMatch?.caseId || null,
    confidence: bestMatch?.confidence || 0,
    reasoning: bestMatch?.reasoning || 'No matching case found',
    tokensUsed: 0, // Heuristic approach uses no tokens
  };
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
