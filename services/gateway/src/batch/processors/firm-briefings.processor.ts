/**
 * Firm Briefings Batch Processor
 * OPS-265: Pre-generate Partner Briefings at 8 AM
 *
 * Pre-generates firm briefings for all eligible partners at 8 AM daily.
 * Partners see a smart briefing with firm-wide insights when they log in - with no loading time.
 *
 * This differs from MorningBriefingsProcessor which generates personal briefings
 * for all users. FirmBriefingsProcessor generates partner-only firm-wide briefings.
 */

import { prisma } from '@legal-platform/database';
import pLimit from 'p-limit';
import { firmOperationsAgentService } from '../../services/firm-operations-agent.service';
import { isUserPartner } from '../../services/firm-operations-context.service';
import logger from '../../utils/logger';
import type {
  BatchProcessor,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';

// ============================================================================
// Configuration
// ============================================================================

// Concurrency limit for parallel briefing generation (default: 5)
const BATCH_CONCURRENCY = parseInt(process.env.FIRM_BRIEFING_BATCH_CONCURRENCY || '5', 10);

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

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
    logger.debug('[FirmBriefings] Discord webhook not configured, skipping notification');
    return;
  }

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: 'Firm Briefings Bot',
      }),
    });
  } catch (error) {
    logger.warn('[FirmBriefings] Failed to send Discord notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Processor
// ============================================================================

export class FirmBriefingsProcessor implements BatchProcessor {
  readonly name = 'Firm Partner Briefings Generator';
  readonly feature = 'firm_briefings';

  /**
   * Process firm briefings for all eligible partners in a firm.
   */
  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    const { firmId, batchJobId, onProgress } = ctx;

    logger.info(`[FirmBriefings] Starting briefing generation for firm ${firmId}`, {
      concurrency: BATCH_CONCURRENCY,
    });

    // Get users eligible for firm briefings (partners + hasOperationalOversight)
    // These users get the full firm-wide AI-powered briefing
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
        lastActive: { gte: sevenDaysAgo },
        OR: [{ role: 'Partner' }, { hasOperationalOversight: true }],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        hasOperationalOversight: true,
      },
    });

    logger.info(
      `[FirmBriefings] Found ${users.length} eligible users (partners + operational oversight)`
    );

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
        // Verify user is actually a partner (double-check)
        const isPartner = await isUserPartner(user.id, firmId);
        if (!isPartner) {
          logger.debug(`[FirmBriefings] Skipping ${user.email} - not a partner`);
          return { success: true }; // Skip is not a failure
        }

        // Generate briefing using the agent service
        const result = await firmOperationsAgentService.generate(user.id, firmId, {
          force: false, // Don't regenerate if already exists for today
          batchJobId,
        });

        totalTokens += result.totalTokens;
        totalCost += result.totalCostEur ?? 0;
        processed++;

        logger.info(
          `[FirmBriefings] Generated briefing for ${user.email} (${result.totalTokens} tokens, €${(result.totalCostEur ?? 0).toFixed(4)})`
        );
        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        // Check if we should retry
        if (attempt < MAX_RETRIES) {
          logger.warn(
            `[FirmBriefings] Attempt ${attempt}/${MAX_RETRIES} failed for ${user.email}, retrying...`,
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
        logger.error(`[FirmBriefings] Failed for ${user.email} after ${MAX_RETRIES} attempts:`, {
          error: errorMsg,
        });
      }

      onProgress?.(processed + failed, users.length);
    };

    // Run all users with concurrency limit
    await Promise.all(users.map((user) => limit(() => processUser(user))));

    logger.info(
      `[FirmBriefings] Completed: ${processed} generated, ${failed} failed, ${totalTokens} tokens, €${totalCost.toFixed(4)}`
    );

    // Send Discord notification on failures
    if (failed > 0) {
      const firstError = errors[0] || 'Unknown error';
      await sendDiscordNotification(
        `⚠️ Firm Briefings Batch: ${failed}/${users.length} failed for firm ${firmId}\n` +
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
export const firmBriefingsProcessor = new FirmBriefingsProcessor();
