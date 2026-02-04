/**
 * Firm Briefing Trigger Service
 *
 * Manages event-driven staleness updates for firm briefings.
 * When significant firm data changes, briefings are marked as stale
 * so partners know to regenerate for fresh insights.
 *
 * Events that trigger staleness:
 * - New case created
 * - Case status changed
 * - Task marked urgent or overdue
 * - Client issue flagged (attention required)
 * - Team member availability changed
 * - New email requiring response
 *
 * Unlike CaseComprehension, we don't auto-regenerate briefings.
 * Partners manually refresh when they want updated insights.
 */

import { prisma, redis } from '@legal-platform/database';
import { invalidateFirmContextCache } from './firm-operations-context.service';
import logger from '../utils/logger';

// ============================================================================
// Event Classification
// ============================================================================

/**
 * Events that mark briefings as stale.
 * These represent significant changes to firm operations data.
 */
const STALE_EVENTS = [
  'case_created',
  'case_status_changed',
  'case_closed',
  'task_created_urgent',
  'task_became_overdue',
  'client_attention_flagged',
  'team_member_unavailable',
  'email_pending_response',
  'deadline_approaching', // Within 48 hours
] as const;

type StaleEvent = (typeof STALE_EVENTS)[number];

// ============================================================================
// Debounce Configuration
// ============================================================================

// Redis key prefix for debounce state
const DEBOUNCE_KEY_PREFIX = 'firm-briefing:debounce:';

// Debounce window: 10 minutes (to coalesce multiple rapid changes)
const DEBOUNCE_SECONDS = 10 * 60;

// ============================================================================
// Trigger Service
// ============================================================================

class FirmBriefingTriggerService {
  /**
   * Handle an event that may affect firm briefings.
   *
   * @param firmId - The affected firm ID
   * @param event - The event type
   * @param metadata - Optional event metadata for logging
   */
  async handleEvent(
    firmId: string,
    event: StaleEvent,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    logger.debug('[FirmBriefingTrigger] Event received', { firmId, event, metadata });

    // Check if we should debounce this event
    const shouldProcess = await this.checkDebounce(firmId, event);
    if (!shouldProcess) {
      logger.debug('[FirmBriefingTrigger] Debounced, skipping', { firmId, event });
      return;
    }

    // Mark all today's briefings for this firm as stale
    await this.markFirmBriefingsStale(firmId, event);

    // Invalidate context cache so next generation uses fresh data
    await invalidateFirmContextCache(firmId);
  }

  /**
   * Check debounce - returns true if we should process this event.
   * Uses Redis to track last event time per firm+event type.
   */
  private async checkDebounce(firmId: string, event: string): Promise<boolean> {
    const key = `${DEBOUNCE_KEY_PREFIX}${firmId}:${event}`;

    try {
      // Try to set the key with NX (only if not exists)
      const result = await redis.set(key, Date.now().toString(), 'EX', DEBOUNCE_SECONDS, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.warn('[FirmBriefingTrigger] Debounce check failed, proceeding', { error });
      return true; // Fail-open
    }
  }

  /**
   * Mark all today's briefings for a firm as stale.
   */
  private async markFirmBriefingsStale(firmId: string, reason: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.firmBriefing.updateMany({
      where: {
        firmId,
        briefingDate: today,
        isStale: false,
      },
      data: {
        isStale: true,
      },
    });

    if (result.count > 0) {
      logger.info('[FirmBriefingTrigger] Marked briefings as stale', {
        firmId,
        reason,
        count: result.count,
      });
    }
  }

  // ============================================================================
  // Event Helpers (called from other services)
  // ============================================================================

  /**
   * Trigger when a new case is created.
   */
  async onCaseCreated(firmId: string, caseId: string): Promise<void> {
    await this.handleEvent(firmId, 'case_created', { caseId });
  }

  /**
   * Trigger when a case status changes.
   */
  async onCaseStatusChanged(
    firmId: string,
    caseId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    await this.handleEvent(firmId, 'case_status_changed', { caseId, oldStatus, newStatus });
  }

  /**
   * Trigger when a case is closed.
   */
  async onCaseClosed(firmId: string, caseId: string): Promise<void> {
    await this.handleEvent(firmId, 'case_closed', { caseId });
  }

  /**
   * Trigger when a task is created with urgent priority.
   */
  async onUrgentTaskCreated(firmId: string, taskId: string): Promise<void> {
    await this.handleEvent(firmId, 'task_created_urgent', { taskId });
  }

  /**
   * Trigger when a task becomes overdue.
   */
  async onTaskBecameOverdue(firmId: string, taskId: string): Promise<void> {
    await this.handleEvent(firmId, 'task_became_overdue', { taskId });
  }

  /**
   * Trigger when a client is flagged as needing attention.
   */
  async onClientAttentionFlagged(firmId: string, clientId: string): Promise<void> {
    await this.handleEvent(firmId, 'client_attention_flagged', { clientId });
  }

  /**
   * Trigger when a team member becomes unavailable.
   */
  async onTeamMemberUnavailable(firmId: string, userId: string): Promise<void> {
    await this.handleEvent(firmId, 'team_member_unavailable', { userId });
  }

  /**
   * Trigger when there's a new email pending response.
   */
  async onEmailPendingResponse(firmId: string, emailThreadId: string): Promise<void> {
    await this.handleEvent(firmId, 'email_pending_response', { emailThreadId });
  }

  /**
   * Trigger when a deadline is approaching (within 48 hours).
   */
  async onDeadlineApproaching(firmId: string, caseId: string, deadline: Date): Promise<void> {
    await this.handleEvent(firmId, 'deadline_approaching', {
      caseId,
      deadline: deadline.toISOString(),
    });
  }

  // ============================================================================
  // Batch Staleness Check (for scheduled jobs)
  // ============================================================================

  /**
   * Check and mark stale briefings for all firms.
   * Called by a scheduled job to catch cases where events weren't fired.
   */
  async checkAllFirmsForStaleness(): Promise<{
    firmsChecked: number;
    briefingsMarkedStale: number;
  }> {
    logger.info('[FirmBriefingTrigger] Running scheduled staleness check');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all firms with active briefings from today
    const briefings = await prisma.firmBriefing.findMany({
      where: {
        briefingDate: today,
        isStale: false,
      },
      select: {
        id: true,
        firmId: true,
        userId: true,
        generatedAt: true,
      },
    });

    let briefingsMarkedStale = 0;
    const firmIds = new Set(briefings.map((b) => b.firmId));

    for (const briefing of briefings) {
      // Check if there have been significant changes since generation
      const hasChanges = await this.hasRecentChanges(briefing.firmId, briefing.generatedAt);

      if (hasChanges) {
        await prisma.firmBriefing.update({
          where: { id: briefing.id },
          data: { isStale: true },
        });
        briefingsMarkedStale++;
      }
    }

    logger.info('[FirmBriefingTrigger] Staleness check complete', {
      firmsChecked: firmIds.size,
      briefingsMarkedStale,
    });

    return {
      firmsChecked: firmIds.size,
      briefingsMarkedStale,
    };
  }

  /**
   * Check if a firm has had significant changes since a given time.
   */
  private async hasRecentChanges(firmId: string, since: Date): Promise<boolean> {
    // Check for new cases
    const newCases = await prisma.case.count({
      where: {
        firmId,
        createdAt: { gt: since },
      },
    });
    if (newCases > 0) return true;

    // Check for case status changes
    const statusChanges = await prisma.case.count({
      where: {
        firmId,
        updatedAt: { gt: since },
      },
    });
    if (statusChanges > 0) return true;

    // Check for overdue tasks
    const overdueTasks = await prisma.task.count({
      where: {
        firmId,
        status: { in: ['Pending', 'InProgress'] },
        dueDate: { lt: new Date() },
        updatedAt: { gt: since },
      },
    });
    if (overdueTasks > 0) return true;

    return false;
  }
}

// Export singleton instance
export const firmBriefingTriggerService = new FirmBriefingTriggerService();
