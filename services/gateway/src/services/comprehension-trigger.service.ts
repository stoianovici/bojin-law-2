/**
 * Comprehension Trigger Service
 *
 * Manages event-driven and scheduled updates to case comprehension.
 * - Marks comprehension as stale on data changes
 * - Triggers immediate regeneration for high-impact events
 * - Provides debounced queue to prevent regeneration storms
 *
 * @see plan-case-comprehension.md Phase 6
 */

import { prisma, redis } from '@legal-platform/database';
import { comprehensionAgentService } from './comprehension-agent.service';
import logger from '../utils/logger';

// ============================================================================
// Event Classification
// ============================================================================

/**
 * Events that mark comprehension as stale (yellow banner in UI).
 * User can continue using old comprehension but sees it may be outdated.
 */
const STALE_EVENTS = [
  'document_uploaded',
  'document_removed',
  'email_classified',
  'actor_added',
  'actor_updated',
  'actor_removed',
  'task_created',
  'task_completed',
  'case_updated',
] as const;

/**
 * High-impact events that trigger immediate regeneration.
 * These are important enough to regenerate right away.
 */
const IMMEDIATE_EVENTS = ['case_status_changed', 'deadline_added', 'correction_added'] as const;

type StaleEvent = (typeof STALE_EVENTS)[number];
type ImmediateEvent = (typeof IMMEDIATE_EVENTS)[number];
type ComprehensionEvent = StaleEvent | ImmediateEvent;

// ============================================================================
// Debounce Configuration
// ============================================================================

// Redis key prefix for debounce state
const DEBOUNCE_KEY_PREFIX = 'comprehension:debounce:';

// Debounce window: 5 minutes
const DEBOUNCE_MS = 5 * 60 * 1000;
const DEBOUNCE_SECONDS = Math.floor(DEBOUNCE_MS / 1000);

// Delay between batch regenerations (configurable via env to avoid overloading)
const BATCH_DELAY_MS = parseInt(process.env.COMPREHENSION_BATCH_DELAY_MS || '1000', 10);

// In-memory fallback for local timers (used to trigger after debounce period)
// Note: The debounce STATE is stored in Redis for multi-instance support,
// but the timer callbacks must be local. If server restarts, scheduled
// regenerations will be lost, but the stale state remains in the DB.
const localTimers = new Map<string, NodeJS.Timeout>();

// ============================================================================
// Trigger Service
// ============================================================================

class ComprehensionTriggerService {
  /**
   * Handle an event that may affect case comprehension.
   *
   * @param caseId - The affected case ID
   * @param event - The event type
   * @param firmId - The firm ID (for regeneration)
   * @param options - Additional options
   * @param options.correctionIds - IDs of corrections that triggered this regeneration
   *                                (skip anchor matching for these as they came from old content)
   */
  async handleEvent(
    caseId: string,
    event: ComprehensionEvent,
    firmId: string,
    options: { userId?: string; skipDebounce?: boolean; correctionIds?: string[] } = {}
  ): Promise<void> {
    logger.debug('[ComprehensionTrigger] Event received', { caseId, event });

    // Check if this case has comprehension
    const hasComprehension = await this.hasComprehension(caseId);
    if (!hasComprehension) {
      logger.debug('[ComprehensionTrigger] No comprehension exists, skipping', { caseId });
      return;
    }

    // Immediate events: regenerate right away (with debounce to coalesce)
    if (this.isImmediateEvent(event)) {
      if (options.skipDebounce) {
        await this.regenerate(caseId, firmId, event, options.userId, options.correctionIds);
      } else {
        await this.scheduleRegeneration(
          caseId,
          firmId,
          event,
          options.userId,
          options.correctionIds
        );
      }
      return;
    }

    // Stale events: just mark as stale
    if (this.isStaleEvent(event)) {
      await this.markStale(caseId, event);
      return;
    }

    logger.warn('[ComprehensionTrigger] Unknown event type', { caseId, event });
  }

  /**
   * Mark comprehension as stale without regenerating.
   * Sets staleSince timestamp for priority ordering in batch regeneration.
   */
  async markStale(caseId: string, reason?: string): Promise<void> {
    await prisma.caseComprehension.updateMany({
      where: { caseId, isStale: false },
      data: {
        isStale: true,
        staleSince: new Date(),
      },
    });

    logger.info('[ComprehensionTrigger] Marked as stale', { caseId, reason });
  }

  /**
   * Schedule regeneration with debouncing.
   * If multiple events occur within DEBOUNCE_MS, only one regeneration runs.
   * Uses Redis for debounce state tracking (survives restarts, works across instances).
   */
  async scheduleRegeneration(
    caseId: string,
    firmId: string,
    event: string,
    userId?: string,
    correctionIds?: string[]
  ): Promise<void> {
    const redisKey = `${DEBOUNCE_KEY_PREFIX}${caseId}`;

    try {
      // Check if already scheduled in Redis (prevents multiple instances from scheduling)
      const existing = await redis.get(redisKey);
      if (existing) {
        logger.debug('[ComprehensionTrigger] Regeneration already scheduled (Redis)', { caseId });
        return;
      }

      // Set debounce key in Redis with TTL
      await redis.setex(
        redisKey,
        DEBOUNCE_SECONDS,
        JSON.stringify({ firmId, event, userId, correctionIds, scheduledAt: Date.now() })
      );

      // Cancel any existing local timer
      const existingTimer = localTimers.get(caseId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule local timer to trigger regeneration after debounce period
      const timeout = setTimeout(async () => {
        localTimers.delete(caseId);
        try {
          // Delete Redis key before regenerating
          await redis.del(redisKey);
          await this.regenerate(caseId, firmId, event, userId, correctionIds);
        } catch (error) {
          logger.error('[ComprehensionTrigger] Scheduled regeneration failed', {
            caseId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }, DEBOUNCE_MS);

      localTimers.set(caseId, timeout);
      logger.debug('[ComprehensionTrigger] Scheduled regeneration (Redis + local timer)', {
        caseId,
        debounceMs: DEBOUNCE_MS,
      });
    } catch (error) {
      // Redis error - fall back to immediate regeneration
      logger.warn('[ComprehensionTrigger] Redis error, regenerating immediately', {
        caseId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.regenerate(caseId, firmId, event, userId);
    }
  }

  /**
   * Regenerate comprehension immediately.
   * @param correctionIds - IDs of corrections that triggered this regeneration
   *                        (they'll be marked as applied without anchor matching)
   */
  async regenerate(
    caseId: string,
    firmId: string,
    triggeredBy: string,
    userId?: string,
    correctionIds?: string[]
  ): Promise<void> {
    logger.info('[ComprehensionTrigger] Starting regeneration', {
      caseId,
      triggeredBy,
      correctionIds: correctionIds?.length ?? 0,
    });

    try {
      await comprehensionAgentService.generate(caseId, firmId, userId, {
        mode: 'update',
        triggeredBy,
        triggeredCorrectionIds: correctionIds,
      });
    } catch (error) {
      logger.error('[ComprehensionTrigger] Regeneration failed', {
        caseId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Mark as stale so user knows something went wrong
      await this.markStale(caseId, 'regeneration_failed');
    }
  }

  /**
   * Regenerate all stale comprehensions.
   * Called by scheduled job (e.g., nightly at 3 AM).
   */
  async regenerateStale(options: { limit?: number } = {}): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const limit = options.limit || 50;

    const staleComprehensions = await prisma.caseComprehension.findMany({
      where: { isStale: true },
      take: limit,
      orderBy: { staleSince: 'asc' }, // Oldest stale first (priority ordering)
      select: {
        caseId: true,
        firmId: true,
      },
    });

    if (staleComprehensions.length === 0) {
      logger.info('[ComprehensionTrigger] No stale comprehensions to regenerate');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    logger.info('[ComprehensionTrigger] Starting batch regeneration', {
      count: staleComprehensions.length,
    });

    let succeeded = 0;
    let failed = 0;

    for (const comp of staleComprehensions) {
      try {
        await this.regenerate(comp.caseId, comp.firmId, 'scheduled');
        succeeded++;
      } catch (error) {
        failed++;
        logger.error('[ComprehensionTrigger] Batch regeneration item failed', {
          caseId: comp.caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Configurable delay between regenerations to avoid overloading
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }

    logger.info('[ComprehensionTrigger] Batch regeneration complete', {
      processed: staleComprehensions.length,
      succeeded,
      failed,
    });

    return {
      processed: staleComprehensions.length,
      succeeded,
      failed,
    };
  }

  /**
   * Regenerate expired comprehensions (past validUntil).
   */
  async regenerateExpired(options: { limit?: number } = {}): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const limit = options.limit || 50;

    const expiredComprehensions = await prisma.caseComprehension.findMany({
      where: {
        validUntil: { lt: new Date() },
        isStale: false, // Not already marked stale
      },
      take: limit,
      orderBy: { validUntil: 'asc' }, // Most expired first
      select: {
        caseId: true,
        firmId: true,
      },
    });

    if (expiredComprehensions.length === 0) {
      logger.info('[ComprehensionTrigger] No expired comprehensions to regenerate');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // First mark them all as stale
    const caseIds = expiredComprehensions.map((c) => c.caseId);
    await prisma.caseComprehension.updateMany({
      where: { caseId: { in: caseIds } },
      data: { isStale: true },
    });

    logger.info('[ComprehensionTrigger] Starting expired regeneration', {
      count: expiredComprehensions.length,
    });

    let succeeded = 0;
    let failed = 0;

    for (const comp of expiredComprehensions) {
      try {
        await this.regenerate(comp.caseId, comp.firmId, 'expired');
        succeeded++;
      } catch (error) {
        failed++;
        logger.error('[ComprehensionTrigger] Expired regeneration item failed', {
          caseId: comp.caseId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Configurable delay between regenerations
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }

    return {
      processed: expiredComprehensions.length,
      succeeded,
      failed,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async hasComprehension(caseId: string): Promise<boolean> {
    const count = await prisma.caseComprehension.count({
      where: { caseId },
    });
    return count > 0;
  }

  private isStaleEvent(event: string): event is StaleEvent {
    return STALE_EVENTS.includes(event as StaleEvent);
  }

  private isImmediateEvent(event: string): event is ImmediateEvent {
    return IMMEDIATE_EVENTS.includes(event as ImmediateEvent);
  }

  /**
   * Clear all pending timers on service shutdown.
   * Should be called during graceful shutdown to prevent memory leaks.
   */
  shutdown(): void {
    logger.info('[ComprehensionTrigger] Shutting down, clearing timers', {
      pendingTimers: localTimers.size,
    });

    for (const timeout of localTimers.values()) {
      clearTimeout(timeout);
    }
    localTimers.clear();
  }
}

// Export singleton
export const comprehensionTriggerService = new ComprehensionTriggerService();

/**
 * Stop comprehension trigger service - call during graceful shutdown.
 * Clears all pending debounced regeneration timers.
 */
export function stopComprehensionTriggerService(): void {
  comprehensionTriggerService.shutdown();
}

// Export event lists for consumers
export { STALE_EVENTS, IMMEDIATE_EVENTS };
export type { ComprehensionEvent };
