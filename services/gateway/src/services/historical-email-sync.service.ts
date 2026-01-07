/**
 * Historical Email Sync Service
 *
 * Syncs historical emails for a contact when they're added to a case.
 * Fetches emails FROM and TO the contact within the last 2 years,
 * creates EmailCaseLink records, and syncs attachments to case docs.
 *
 * Note: This service depends on the HistoricalEmailSyncJob model which is
 * being added in a separate task (Task 1.1). TypeScript compilation will
 * succeed once that model is added to the Prisma schema.
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '@legal-platform/database';
import { GraphService } from './graph.service';
import { getEmailAttachmentService } from './email-attachment.service';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import logger from '../utils/logger';

// Type assertion to allow access to the historicalEmailSyncJob model
// This model is being added in Task 1.1 - remove this once the model exists
type PrismaWithHistoricalSync = PrismaClient & {
  historicalEmailSyncJob: {
    update: (args: {
      where: { id: string };
      data: {
        status?: string;
        startedAt?: Date;
        completedAt?: Date;
        totalEmails?: number;
        syncedEmails?: number;
        errorMessage?: string;
      };
    }) => Promise<any>;
  };
};

const prismaWithSync = prisma as unknown as PrismaWithHistoricalSync;

// Constants
const BATCH_SIZE = 50; // Emails per page
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export interface HistoricalSyncResult {
  success: boolean;
  emailsLinked: number;
  attachmentsSynced: number;
  error?: string;
}

export class HistoricalEmailSyncService {
  private graphService: GraphService;

  constructor() {
    this.graphService = new GraphService();
  }

  /**
   * Main sync method - called by the worker
   *
   * @param jobId - HistoricalEmailSyncJob.id to update progress
   * @param caseId - Case to link emails to
   * @param contactEmail - Email address of the contact
   * @param accessToken - MS Graph access token
   * @param userId - User triggering the sync (for EmailCaseLink.linkedBy)
   */
  async syncHistoricalEmails(
    jobId: string,
    caseId: string,
    contactEmail: string,
    accessToken: string,
    userId: string
  ): Promise<HistoricalSyncResult> {
    logger.info('[HistoricalEmailSync] Starting sync', { jobId, caseId, contactEmail });

    try {
      // 1. Mark job as in progress
      await prismaWithSync.historicalEmailSyncJob.update({
        where: { id: jobId },
        data: {
          status: 'InProgress',
          startedAt: new Date(),
        },
      });

      // 2. Fetch emails from/to the contact in last 2 years
      const sinceDate = new Date(Date.now() - TWO_YEARS_MS);
      const emails = await this.fetchEmailsByContact(accessToken, contactEmail, sinceDate);

      logger.info('[HistoricalEmailSync] Fetched emails', {
        jobId,
        count: emails.length,
      });

      // Update total count
      await prismaWithSync.historicalEmailSyncJob.update({
        where: { id: jobId },
        data: { totalEmails: emails.length },
      });

      if (emails.length === 0) {
        await prismaWithSync.historicalEmailSyncJob.update({
          where: { id: jobId },
          data: {
            status: 'Completed',
            completedAt: new Date(),
          },
        });
        return { success: true, emailsLinked: 0, attachmentsSynced: 0 };
      }

      // 3. Link emails to case (skip if already linked)
      let emailsLinked = 0;
      let attachmentsSynced = 0;

      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);
        const result = await this.processBatch(batch, caseId, userId, accessToken);
        emailsLinked += result.linked;
        attachmentsSynced += result.attachments;

        // Update progress
        await prismaWithSync.historicalEmailSyncJob.update({
          where: { id: jobId },
          data: { syncedEmails: Math.min(i + BATCH_SIZE, emails.length) },
        });
      }

      // 4. Mark job as completed
      await prismaWithSync.historicalEmailSyncJob.update({
        where: { id: jobId },
        data: {
          status: 'Completed',
          completedAt: new Date(),
          syncedEmails: emails.length,
        },
      });

      logger.info('[HistoricalEmailSync] Sync completed', {
        jobId,
        emailsLinked,
        attachmentsSynced,
      });

      return { success: true, emailsLinked, attachmentsSynced };
    } catch (error: any) {
      logger.error('[HistoricalEmailSync] Sync failed', {
        jobId,
        error: error.message,
        stack: error.stack,
      });

      await prismaWithSync.historicalEmailSyncJob.update({
        where: { id: jobId },
        data: {
          status: 'Failed',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      return { success: false, emailsLinked: 0, attachmentsSynced: 0, error: error.message };
    }
  }

  /**
   * Fetch all emails FROM or TO the contact within the given time range
   */
  private async fetchEmailsByContact(
    accessToken: string,
    contactEmail: string,
    sinceDate: Date
  ): Promise<Array<{ graphMessageId: string; hasAttachments: boolean }>> {
    const client = this.graphService.getAuthenticatedClient(accessToken);
    const emails: Array<{ graphMessageId: string; hasAttachments: boolean }> = [];

    // Use $search to find emails involving this contact
    // Note: Graph API $search doesn't support $filter or $orderby, so we
    // fetch all pages and filter by date in memory
    const sinceDateMs = sinceDate.getTime();

    try {
      let response = await retryWithBackoff(
        async () => {
          return await client
            .api('/me/messages')
            .search(`"${contactEmail}"`)
            .select('id,hasAttachments,receivedDateTime')
            .top(BATCH_SIZE)
            .get();
        },
        {},
        'historical-sync-fetch'
      );

      // Collect all emails with pagination, filtering by date in memory
      while (response?.value) {
        for (const msg of response.value) {
          if (msg.id) {
            // Filter by date in memory since $filter can't be used with $search
            const receivedDate = msg.receivedDateTime ? new Date(msg.receivedDateTime).getTime() : 0;
            if (receivedDate >= sinceDateMs) {
              emails.push({
                graphMessageId: msg.id,
                hasAttachments: msg.hasAttachments || false,
              });
            }
          }
        }

        // Check for next page
        if (response['@odata.nextLink']) {
          const nextLink = response['@odata.nextLink'];
          const url = new URL(nextLink);
          let path = url.pathname + url.search;
          path = path.replace(/^\/(v1\.0|beta)/, '');

          response = await retryWithBackoff(
            async () => client.api(path).get(),
            {},
            'historical-sync-fetch-next'
          );
        } else {
          break;
        }
      }
    } catch (error: any) {
      const parsedError = parseGraphError(error);
      logGraphError(parsedError);
      throw parsedError;
    }

    return emails;
  }

  /**
   * Process a batch of emails - link to case and sync attachments
   */
  private async processBatch(
    emails: Array<{ graphMessageId: string; hasAttachments: boolean }>,
    caseId: string,
    userId: string,
    accessToken: string
  ): Promise<{ linked: number; attachments: number }> {
    let linked = 0;
    let attachments = 0;

    // Get existing email IDs from our database
    const graphIds = emails.map((e) => e.graphMessageId);
    const existingEmails = await prisma.email.findMany({
      where: { graphMessageId: { in: graphIds } },
      select: { id: true, graphMessageId: true },
    });
    const emailMap = new Map(existingEmails.map((e) => [e.graphMessageId, e.id]));

    for (const email of emails) {
      const dbEmailId = emailMap.get(email.graphMessageId);
      if (!dbEmailId) {
        // Email not in our DB - skip (it will be synced by regular sync)
        continue;
      }

      // Check if already linked to this case
      const existingLink = await prisma.emailCaseLink.findUnique({
        where: {
          emailId_caseId: {
            emailId: dbEmailId,
            caseId: caseId,
          },
        },
      });

      if (!existingLink) {
        // Create link and update legacy caseId for backwards compatibility
        await Promise.all([
          prisma.emailCaseLink.create({
            data: {
              emailId: dbEmailId,
              caseId: caseId,
              confidence: 1.0,
              matchType: 'Manual', // Historical sync is a form of manual linking
              linkedBy: userId,
              isPrimary: false, // Not primary since case already has primary emails
            },
          }),
          // Also update legacy Email.caseId field so thread grouping works
          prisma.email.update({
            where: { id: dbEmailId },
            data: { caseId: caseId },
          }),
        ]);
        linked++;
      }

      // Always sync attachments - handles both new attachments and upgrading existing ones
      // The attachment service has idempotent logic to skip already-processed attachments
      // and upgrade logic to create Documents for attachments now linked to a case
      if (email.hasAttachments) {
        try {
          const attachmentService = getEmailAttachmentService(prisma);
          const syncResult = await attachmentService.syncAllAttachments(dbEmailId, accessToken, caseId);
          attachments += syncResult.attachmentsSynced;
        } catch (err: any) {
          logger.warn('[HistoricalEmailSync] Attachment sync failed', {
            emailId: dbEmailId,
            error: err.message,
          });
        }
      }
    }

    return { linked, attachments };
  }
}

// Singleton instance
let instance: HistoricalEmailSyncService | null = null;

export function getHistoricalEmailSyncService(): HistoricalEmailSyncService {
  if (!instance) {
    instance = new HistoricalEmailSyncService();
  }
  return instance;
}
