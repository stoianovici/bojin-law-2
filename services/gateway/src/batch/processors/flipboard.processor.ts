/**
 * Flipboard Batch Processor
 * Pre-generate Flipboard items for all users at 6 AM
 *
 * Pre-generates AI-powered actionable items for all active users.
 * Users see their personalized Flipboard immediately on login - no loading time.
 *
 * This processor runs for ALL users (unlike FirmBriefingsProcessor which is partner-only).
 */

import { prisma } from '@legal-platform/database';
import pLimit from 'p-limit';
import { flipboardAgentService } from '../../services/flipboard-agent.service';
import logger from '../../utils/logger';
import type {
  BatchProcessor,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';

// ============================================================================
// Configuration
// ============================================================================

// Concurrency limit for parallel flipboard generation (default: 10)
// Higher than firm briefings since Haiku is faster and cheaper
const BATCH_CONCURRENCY = parseInt(process.env.FLIPBOARD_BATCH_CONCURRENCY || '10', 10);

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000; // 3 seconds between retries

// Discord webhook for failure notifications
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// ============================================================================
// Types
// ============================================================================

interface FailedUser {
  userId: string;
  email: string;
  attempts: number;
  lastError: string;
}

// ============================================================================
// Discord Notification
// ============================================================================

async function sendDiscordNotification(message: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    logger.debug('[Flipboard] Discord webhook not configured, skipping notification');
    return;
  }

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'Flipboard Bot',
      }),
    });
  } catch (error) {
    logger.warn('[Flipboard] Failed to send Discord notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Processor
// ============================================================================

export class FlipboardProcessor implements BatchProcessor {
  readonly name = 'User Flipboard Generator';
  readonly feature = 'user_flipboard';

  /**
   * Process flipboard generation for all active users in a firm.
   */
  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    const { firmId, batchJobId, onProgress } = ctx;

    logger.info(`[Flipboard] Starting batch generation for firm ${firmId}`, {
      concurrency: BATCH_CONCURRENCY,
    });

    // Get all active users who logged in within last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
        lastActive: { gte: sevenDaysAgo },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    logger.info(`[Flipboard] Found ${users.length} eligible users`);

    let processed = 0;
    let failed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];
    const failedUsers: FailedUser[] = [];

    // Create concurrency limiter
    const limit = pLimit(BATCH_CONCURRENCY);

    /**
     * Helper to delay between retries.
     */
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Process a single user with retry logic.
     */
    const processUserWithRetry = async (
      user: (typeof users)[0],
      attempt: number = 1
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Generate flipboard using the agent service
        const result = await flipboardAgentService.generate(user.id, firmId, {
          triggerType: 'scheduled',
        });

        totalTokens += result.totalTokens;
        totalCost += result.totalCostEur ?? 0;
        processed++;

        logger.info(
          `[Flipboard] Generated for ${user.email} (${result.totalTokens} tokens, €${(result.totalCostEur ?? 0).toFixed(4)}, ${result.items.length} items)`
        );
        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        // Check if we should retry
        if (attempt < MAX_RETRIES) {
          logger.warn(
            `[Flipboard] Attempt ${attempt}/${MAX_RETRIES} failed for ${user.email}, retrying...`,
            { error: errorMsg }
          );
          await delay(RETRY_DELAY_MS * attempt); // Exponential-ish backoff
          return processUserWithRetry(user, attempt + 1);
        }

        // Final failure after all retries
        return { success: false, error: errorMsg };
      }
    };

    // Process users with controlled concurrency
    const processUser = async (user: (typeof users)[0]) => {
      const result = await processUserWithRetry(user);

      if (!result.success) {
        failed++;
        const errorMsg = result.error || 'Unknown error';
        errors.push(`User ${user.id} (${user.email}): ${errorMsg}`);
        failedUsers.push({
          userId: user.id,
          email: user.email,
          attempts: MAX_RETRIES,
          lastError: errorMsg,
        });
        logger.error(`[Flipboard] Failed for ${user.email} after ${MAX_RETRIES} attempts:`, {
          error: errorMsg,
        });
      }

      onProgress?.(processed + failed, users.length);
    };

    // Run all users with concurrency limit
    await Promise.all(users.map((user) => limit(() => processUser(user))));

    logger.info(
      `[Flipboard] Completed: ${processed} generated, ${failed} failed, ${totalTokens} tokens, €${totalCost.toFixed(4)}`
    );

    // Send Discord notification on failures
    if (failed > 0) {
      const firstError = errors[0] || 'Unknown error';
      await sendDiscordNotification(
        `⚠️ Flipboard Batch: ${failed}/${users.length} failed for firm ${firmId}\n` +
          `First error: ${firstError.substring(0, 200)}`
      );
    }

    return {
      itemsProcessed: processed,
      itemsFailed: failed,
      totalTokens,
      totalCost,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// Export singleton instance
export const flipboardProcessor = new FlipboardProcessor();
