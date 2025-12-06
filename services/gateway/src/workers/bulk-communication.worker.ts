/**
 * Bulk Communication Worker
 * Story 5.5: Multi-Channel Communication Hub (AC: 3)
 *
 * Processes bulk communications with batching, rate limiting, and retry logic
 */

import { prisma } from '@legal-platform/database';
import {
  BulkCommunicationStatus,
  CommunicationChannel,
  NotificationType,
} from '@prisma/client';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

// ============================================================================
// Configuration
// ============================================================================

interface BulkWorkerConfig {
  batchSize: number; // Recipients per batch
  rateLimit: number; // Max emails per minute per firm
  maxRetries: number; // Max retries per email
  retryDelayMs: number; // Base delay between retries
  scheduledCheckIntervalMs: number; // How often to check for scheduled sends
}

const DEFAULT_CONFIG: BulkWorkerConfig = {
  batchSize: 50,
  rateLimit: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  scheduledCheckIntervalMs: 60 * 1000, // 1 minute
};

// Rate limiting state per firm
const firmRateLimits = new Map<string, { count: number; resetAt: number }>();

let scheduledCheckHandle: NodeJS.Timeout | null = null;
let isRunning = false;

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the bulk communication worker
 * This handles scheduled communications via cron-like interval
 */
export function startBulkCommunicationWorker(
  config: Partial<BulkWorkerConfig> = {}
): void {
  if (isRunning) {
    console.log('[Bulk Communication Worker] Already running');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[Bulk Communication Worker] Starting...');
  console.log(`  Batch size: ${finalConfig.batchSize}`);
  console.log(`  Rate limit: ${finalConfig.rateLimit}/min/firm`);
  console.log(`  Max retries: ${finalConfig.maxRetries}`);

  isRunning = true;

  // Run immediately
  processScheduledCommunications(finalConfig).catch((error) => {
    console.error('[Bulk Communication Worker] Error in initial check:', error);
  });

  // Then run on interval to check for scheduled communications
  scheduledCheckHandle = setInterval(() => {
    processScheduledCommunications(finalConfig).catch((error) => {
      console.error('[Bulk Communication Worker] Error in scheduled check:', error);
    });
  }, finalConfig.scheduledCheckIntervalMs);

  console.log('[Bulk Communication Worker] Started successfully');
}

/**
 * Stop the bulk communication worker
 */
export function stopBulkCommunicationWorker(): void {
  if (!isRunning) {
    console.log('[Bulk Communication Worker] Not running');
    return;
  }

  console.log('[Bulk Communication Worker] Stopping...');

  if (scheduledCheckHandle) {
    clearInterval(scheduledCheckHandle);
    scheduledCheckHandle = null;
  }

  isRunning = false;
  firmRateLimits.clear();

  console.log('[Bulk Communication Worker] Stopped');
}

/**
 * Check if worker is running
 */
export function isBulkCommunicationWorkerRunning(): boolean {
  return isRunning;
}

// ============================================================================
// Scheduled Communication Processing
// ============================================================================

/**
 * Check for and process scheduled communications that are due
 */
async function processScheduledCommunications(config: BulkWorkerConfig): Promise<void> {
  const now = new Date();

  // Find scheduled communications that are due
  const scheduledComms = await prisma.bulkCommunication.findMany({
    where: {
      status: BulkCommunicationStatus.Scheduled,
      scheduledFor: {
        lte: now,
      },
    },
  });

  if (scheduledComms.length === 0) {
    return;
  }

  console.log(`[Bulk Communication Worker] Found ${scheduledComms.length} scheduled communications due`);

  for (const comm of scheduledComms) {
    // Start processing each scheduled communication
    await prisma.bulkCommunication.update({
      where: { id: comm.id },
      data: {
        status: BulkCommunicationStatus.InProgress,
        startedAt: new Date(),
      },
    });

    // Process in background
    processBulkCommunication(comm.id, comm.firmId, config).catch((error) => {
      console.error(`[Bulk Communication Worker] Error processing ${comm.id}:`, error);
    });
  }
}

// ============================================================================
// Bulk Communication Processing
// ============================================================================

/**
 * Process a single bulk communication with batching and rate limiting
 * This is the main entry point for processing a bulk communication
 */
export async function processBulkCommunication(
  bulkCommId: string,
  firmId: string,
  config: BulkWorkerConfig = DEFAULT_CONFIG
): Promise<void> {
  console.log(`[Bulk Communication Worker] Processing ${bulkCommId}`);

  try {
    // Get the bulk communication
    const bulkComm = await prisma.bulkCommunication.findUnique({
      where: { id: bulkCommId },
    });

    if (!bulkComm) {
      console.error(`[Bulk Communication Worker] Bulk communication ${bulkCommId} not found`);
      return;
    }

    // Check if cancelled
    if (bulkComm.status === BulkCommunicationStatus.Cancelled) {
      console.log(`[Bulk Communication Worker] ${bulkCommId} was cancelled, skipping`);
      return;
    }

    // Get pending logs
    const pendingLogs = await prisma.bulkCommunicationLog.findMany({
      where: {
        bulkCommunicationId: bulkCommId,
        status: 'pending',
      },
    });

    if (pendingLogs.length === 0) {
      console.log(`[Bulk Communication Worker] No pending recipients for ${bulkCommId}`);
      await finalizeBulkCommunication(bulkCommId);
      return;
    }

    console.log(`[Bulk Communication Worker] Processing ${pendingLogs.length} pending recipients`);

    // Process in batches
    let sentCount = bulkComm.sentCount;
    let failedCount = bulkComm.failedCount;

    for (let i = 0; i < pendingLogs.length; i += config.batchSize) {
      // Check if cancelled during processing
      const currentStatus = await prisma.bulkCommunication.findUnique({
        where: { id: bulkCommId },
        select: { status: true },
      });

      if (currentStatus?.status === BulkCommunicationStatus.Cancelled) {
        console.log(`[Bulk Communication Worker] ${bulkCommId} cancelled during processing`);
        return;
      }

      const batch = pendingLogs.slice(i, i + config.batchSize);
      console.log(`[Bulk Communication Worker] Processing batch ${Math.floor(i / config.batchSize) + 1}`);

      // Process batch with rate limiting
      const results = await processBatch(batch, bulkComm, firmId, config);

      sentCount += results.sent;
      failedCount += results.failed;

      // Update counts after each batch
      await prisma.bulkCommunication.update({
        where: { id: bulkCommId },
        data: { sentCount, failedCount },
      });

      // Small delay between batches to prevent overwhelming the system
      if (i + config.batchSize < pendingLogs.length) {
        await delay(500);
      }
    }

    // Finalize the bulk communication
    await finalizeBulkCommunication(bulkCommId);
  } catch (error) {
    console.error(`[Bulk Communication Worker] Fatal error processing ${bulkCommId}:`, error);

    // Mark as partially failed if we had a fatal error
    await prisma.bulkCommunication.update({
      where: { id: bulkCommId },
      data: {
        status: BulkCommunicationStatus.PartiallyFailed,
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Process a batch of recipients with rate limiting
 */
async function processBatch(
  batch: { id: string; recipientEmail: string; recipientName: string }[],
  bulkComm: {
    id: string;
    subject: string;
    body: string;
    htmlBody: string | null;
    channelType: CommunicationChannel;
  },
  firmId: string,
  config: BulkWorkerConfig
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const log of batch) {
    // Check rate limit
    await waitForRateLimit(firmId, config.rateLimit);

    // Try to send with retries
    const success = await sendWithRetry(
      log,
      bulkComm,
      config.maxRetries,
      config.retryDelayMs
    );

    if (success) {
      sent++;
      await prisma.bulkCommunicationLog.update({
        where: { id: log.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    } else {
      failed++;
    }

    // Increment rate limit counter
    incrementRateLimit(firmId);
  }

  return { sent, failed };
}

/**
 * Send a single email with retry logic
 */
async function sendWithRetry(
  log: { id: string; recipientEmail: string; recipientName: string },
  bulkComm: {
    subject: string;
    body: string;
    htmlBody: string | null;
    channelType: CommunicationChannel;
  },
  maxRetries: number,
  retryDelayMs: number
): Promise<boolean> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEmail({
        to: log.recipientEmail,
        toName: log.recipientName,
        subject: bulkComm.subject,
        body: bulkComm.body,
        htmlBody: bulkComm.htmlBody || undefined,
      });

      return true;
    } catch (error) {
      lastError = error as Error;
      console.error(
        `[Bulk Communication Worker] Send attempt ${attempt}/${maxRetries} failed for ${log.recipientEmail}:`,
        error
      );

      // Exponential backoff
      if (attempt < maxRetries) {
        await delay(retryDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  // All retries failed
  await prisma.bulkCommunicationLog.update({
    where: { id: log.id },
    data: {
      status: 'failed',
      errorMessage: lastError?.message || 'Unknown error after max retries',
    },
  });

  return false;
}

/**
 * Finalize a bulk communication after all processing
 */
async function finalizeBulkCommunication(bulkCommId: string): Promise<void> {
  const bulkComm = await prisma.bulkCommunication.findUnique({
    where: { id: bulkCommId },
    include: {
      creator: true,
    },
  });

  if (!bulkComm) {
    return;
  }

  // Determine final status
  let finalStatus: BulkCommunicationStatus;
  if (bulkComm.failedCount === 0) {
    finalStatus = BulkCommunicationStatus.Completed;
  } else if (bulkComm.sentCount === 0) {
    finalStatus = BulkCommunicationStatus.PartiallyFailed;
  } else {
    finalStatus = BulkCommunicationStatus.PartiallyFailed;
  }

  // Update status
  await prisma.bulkCommunication.update({
    where: { id: bulkCommId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
    },
  });

  // Send notification to creator
  await sendCompletionNotification(bulkComm, finalStatus);

  console.log(
    `[Bulk Communication Worker] Completed ${bulkCommId}: ${bulkComm.sentCount} sent, ${bulkComm.failedCount} failed`
  );
}

/**
 * Send notification to the creator when bulk communication completes
 */
async function sendCompletionNotification(
  bulkComm: {
    id: string;
    subject: string;
    createdBy: string;
    sentCount: number;
    failedCount: number;
    totalRecipients: number;
  },
  status: BulkCommunicationStatus
): Promise<void> {
  const isSuccess = status === BulkCommunicationStatus.Completed;

  await prisma.notification.create({
    data: {
      userId: bulkComm.createdBy,
      type: NotificationType.BulkCommunicationCompleted,
      title: isSuccess ? 'Bulk Communication Completed' : 'Bulk Communication Completed with Errors',
      message: isSuccess
        ? `Your bulk communication "${bulkComm.subject}" was sent successfully to ${bulkComm.sentCount} recipients.`
        : `Your bulk communication "${bulkComm.subject}" completed: ${bulkComm.sentCount} sent, ${bulkComm.failedCount} failed.`,
      link: `/communications/bulk/${bulkComm.id}`,
    },
  });
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Wait if rate limit is exceeded for a firm
 */
async function waitForRateLimit(firmId: string, rateLimit: number): Promise<void> {
  const now = Date.now();
  const state = firmRateLimits.get(firmId);

  if (!state) {
    // Initialize rate limit state
    firmRateLimits.set(firmId, { count: 0, resetAt: now + 60000 });
    return;
  }

  // Reset if minute has passed
  if (now >= state.resetAt) {
    firmRateLimits.set(firmId, { count: 0, resetAt: now + 60000 });
    return;
  }

  // Wait if rate limit exceeded
  if (state.count >= rateLimit) {
    const waitTime = state.resetAt - now;
    console.log(`[Bulk Communication Worker] Rate limit reached for firm ${firmId}, waiting ${waitTime}ms`);
    await delay(waitTime);

    // Reset after waiting
    firmRateLimits.set(firmId, { count: 0, resetAt: Date.now() + 60000 });
  }
}

/**
 * Increment rate limit counter for a firm
 */
function incrementRateLimit(firmId: string): void {
  const state = firmRateLimits.get(firmId);
  if (state) {
    state.count++;
  }
}

// ============================================================================
// Email Sending
// ============================================================================

interface EmailPayload {
  to: string;
  toName: string;
  subject: string;
  body: string;
  htmlBody?: string;
}

/**
 * Send an email via Microsoft Graph API
 */
async function sendEmail(payload: EmailPayload): Promise<void> {
  const accessToken = process.env.GRAPH_SERVICE_TOKEN;

  if (!accessToken) {
    // In development/testing, just log and simulate success
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Bulk Communication Worker] [DEV] Would send email to ${payload.to}: ${payload.subject}`);
      await delay(50); // Simulate network delay
      return;
    }
    throw new Error('GRAPH_SERVICE_TOKEN not configured');
  }

  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  const message = {
    message: {
      subject: payload.subject,
      body: {
        contentType: payload.htmlBody ? 'HTML' : 'Text',
        content: payload.htmlBody || payload.body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: payload.to,
            name: payload.toName,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  await client.api('/me/sendMail').post(message);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get progress for a bulk communication
 */
export async function getBulkCommunicationProgress(bulkCommId: string): Promise<{
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  percentComplete: number;
  estimatedTimeRemaining: number | null;
}> {
  const bulkComm = await prisma.bulkCommunication.findUnique({
    where: { id: bulkCommId },
  });

  if (!bulkComm) {
    throw new Error('Bulk communication not found');
  }

  const pendingCount = bulkComm.totalRecipients - bulkComm.sentCount - bulkComm.failedCount;
  const percentComplete =
    bulkComm.totalRecipients > 0
      ? ((bulkComm.sentCount + bulkComm.failedCount) / bulkComm.totalRecipients) * 100
      : 0;

  // Estimate time remaining based on current rate
  let estimatedTimeRemaining: number | null = null;
  if (bulkComm.startedAt && pendingCount > 0) {
    const elapsed = Date.now() - bulkComm.startedAt.getTime();
    const processed = bulkComm.sentCount + bulkComm.failedCount;
    if (processed > 0) {
      const ratePerMs = processed / elapsed;
      estimatedTimeRemaining = Math.ceil(pendingCount / ratePerMs / 1000); // in seconds
    }
  }

  return {
    totalRecipients: bulkComm.totalRecipients,
    sentCount: bulkComm.sentCount,
    failedCount: bulkComm.failedCount,
    pendingCount,
    percentComplete,
    estimatedTimeRemaining,
  };
}

// ============================================================================
// Cleanup
// ============================================================================

// Clean up rate limit state periodically
setInterval(() => {
  const now = Date.now();
  for (const [firmId, state] of firmRateLimits.entries()) {
    if (now >= state.resetAt + 60000) {
      firmRateLimits.delete(firmId);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
