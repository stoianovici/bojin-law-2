/**
 * Case Sync Service
 * Orchestrates full sync pipeline for new cases:
 * Email sync → attachment extraction → document triage → timeline building
 */

import { prisma } from '@legal-platform/database';
import logger from '../utils/logger';

export class CaseSyncService {
  /**
   * Start the sync process for a case
   * Called automatically when a case is created
   *
   * Note: No longer requires accessToken - historical sync uses app-only tokens
   */
  async startCaseSync(
    caseId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update case to Syncing status
      await prisma.case.update({
        where: { id: caseId },
        data: {
          syncStatus: 'Syncing',
          syncError: null,
        },
      });

      logger.info('[CaseSyncService] Starting sync', { caseId });

      // Get case with client info
      const caseWithClient = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          client: {
            select: { contactInfo: true },
          },
        },
      });

      // Get case actors to sync emails for
      const caseActors = await prisma.caseActor.findMany({
        where: { caseId },
        select: { email: true },
      });

      // Collect emails from case actors
      const actorEmails = caseActors
        .map((actor) => actor.email)
        .filter((email): email is string => !!email);

      // Extract client email from contactInfo JSON
      const clientContactInfo = caseWithClient?.client?.contactInfo as Record<string, any> | null;
      const clientEmail = clientContactInfo?.email as string | undefined;

      // Combine all emails (client email first, then actors), deduplicated
      const allEmails = new Set<string>();
      if (clientEmail) {
        allEmails.add(clientEmail.toLowerCase());
      }
      actorEmails.forEach((email) => allEmails.add(email.toLowerCase()));

      const contactEmails = Array.from(allEmails);

      if (contactEmails.length === 0) {
        // No contacts to sync - mark as completed
        await prisma.case.update({
          where: { id: caseId },
          data: { syncStatus: 'Completed' },
        });

        logger.info('[CaseSyncService] No contacts to sync, marking complete', { caseId });
        return { success: true };
      }

      // Import historical sync queue
      const { queueHistoricalSyncJob } = await import('../workers/historical-email-sync.worker');

      // Queue historical sync jobs for each contact
      // Note: accessToken no longer needed - historical sync uses app-only tokens
      for (const contactEmail of contactEmails) {
        await queueHistoricalSyncJob({
          caseId,
          contactEmail,
          userId,
        });
      }

      logger.info('[CaseSyncService] Sync jobs queued', {
        caseId,
        contactCount: contactEmails.length,
      });

      // Note: The sync status will be updated to Completed/Failed by the worker
      // For now, we leave it as Syncing
      return { success: true };
    } catch (error: any) {
      logger.error('[CaseSyncService] Failed to start sync', {
        caseId,
        error: error.message,
      });

      // Update case to Failed status
      await prisma.case.update({
        where: { id: caseId },
        data: {
          syncStatus: 'Failed',
          syncError: error.message,
        },
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Retry a failed sync
   *
   * Note: No longer requires accessToken - historical sync uses app-only tokens
   */
  async retryCaseSync(
    caseId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Check if case exists
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { syncStatus: true },
    });

    if (!caseData) {
      return { success: false, error: 'Case not found' };
    }

    // If status is Syncing/Pending, check if jobs are actually running
    if (caseData.syncStatus === 'Syncing' || caseData.syncStatus === 'Pending') {
      // Check for orphaned syncs - jobs stuck in Pending/InProgress without active queue jobs
      const stuckJobs = await prisma.historicalEmailSyncJob.findMany({
        where: {
          caseId,
          status: { in: ['Pending', 'InProgress'] },
        },
        select: { id: true, updatedAt: true },
      });

      if (stuckJobs.length > 0) {
        // Check if any jobs haven't been updated in 5+ minutes (likely orphaned)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const hasOrphanedJobs = stuckJobs.some((job) => job.updatedAt < fiveMinutesAgo);

        if (hasOrphanedJobs) {
          logger.info('[CaseSyncService] Detected orphaned sync jobs, allowing retry', {
            caseId,
            stuckJobCount: stuckJobs.length,
          });

          // Reset orphaned jobs to Failed so they can be retried
          await prisma.historicalEmailSyncJob.updateMany({
            where: {
              caseId,
              status: { in: ['Pending', 'InProgress'] },
              updatedAt: { lt: fiveMinutesAgo },
            },
            data: {
              status: 'Failed',
              errorMessage: 'Job was orphaned - auto-reset for retry',
            },
          });
        } else {
          // Jobs are recent, sync is actually in progress
          return { success: false, error: 'Sync already in progress' };
        }
      }
    }

    // Reset to Pending and start sync
    await prisma.case.update({
      where: { id: caseId },
      data: {
        syncStatus: 'Pending',
        syncError: null,
      },
    });

    return this.startCaseSync(caseId, userId);
  }

  /**
   * Mark sync as completed and trigger AI generation
   * Called by workers when all sync jobs finish successfully
   */
  async markSyncCompleted(caseId: string): Promise<void> {
    // Get firmId for AI services
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });

    await prisma.case.update({
      where: { id: caseId },
      data: { syncStatus: 'Completed' },
    });

    logger.info('[CaseSyncService] Sync completed', { caseId });

    // Trigger AI processes asynchronously (don't block sync completion)
    if (caseData?.firmId) {
      this.triggerAIGeneration(caseId, caseData.firmId).catch((err) => {
        logger.error('[CaseSyncService] AI generation failed', {
          caseId,
          error: err.message,
        });
      });
    }
  }

  /**
   * Trigger AI summary, chapters generation, and email cleaning
   * Runs asynchronously after sync completes
   */
  private async triggerAIGeneration(caseId: string, firmId: string): Promise<void> {
    logger.info('[CaseSyncService] Triggering AI generation and email cleaning', { caseId });

    // Import services lazily to avoid circular dependencies
    const { caseSummaryService } = await import('./case-summary.service');
    const { caseChaptersService } = await import('./case-chapters.service');
    const { cleanCaseEmails } = await import('./email-cleaner.service');

    // Run summary, chapters generation, and email cleaning in parallel
    const results = await Promise.allSettled([
      caseSummaryService.generateSummary(caseId, firmId),
      caseChaptersService.generateChapters(caseId, firmId),
      cleanCaseEmails(caseId),
    ]);

    // Log results
    const types = ['summary', 'chapters', 'email cleaning'];
    results.forEach((result, index) => {
      const type = types[index];
      if (result.status === 'fulfilled') {
        if (index === 2 && typeof result.value === 'number') {
          logger.info(`[CaseSyncService] ${type} completed`, {
            caseId,
            emailsCleaned: result.value,
          });
        } else {
          logger.info(`[CaseSyncService] ${type} completed`, { caseId });
        }
      } else {
        logger.error(`[CaseSyncService] ${type} failed`, {
          caseId,
          error: result.reason?.message || 'Unknown error',
        });
      }
    });
  }

  /**
   * Mark sync as failed
   * Called by workers when sync jobs fail
   */
  async markSyncFailed(caseId: string, error: string): Promise<void> {
    await prisma.case.update({
      where: { id: caseId },
      data: {
        syncStatus: 'Failed',
        syncError: error,
      },
    });

    logger.error('[CaseSyncService] Sync failed', { caseId, error });
  }
}

// Export singleton instance
export const caseSyncService = new CaseSyncService();

// Export getter for lazy initialization
export function getCaseSyncService(): CaseSyncService {
  return caseSyncService;
}
