/**
 * Historical Email Sync Service
 *
 * Syncs historical emails for a contact when they're added to a case.
 * Fetches emails FROM and TO the contact within the last 2 years,
 * creates EmailCaseLink records, and syncs attachments to case docs.
 *
 * Uses app-only tokens (client credentials flow) for Graph API access,
 * allowing sync to work independently of user sessions.
 */

import { PrismaClient, CaseStatus, ClassificationMatchType } from '@prisma/client';
import { Client } from '@microsoft/microsoft-graph-client';
import type { Job } from 'bullmq';
import { prisma } from '@legal-platform/database';
import { GraphService } from './graph.service';
import { getEmailAttachmentService } from './email-attachment.service';
import {
  getAIEmailCaseRouterService,
  type CaseCandidate,
  type EmailRoutingInput,
  AIEmailCaseRouterService,
} from './ai-email-case-router.service';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import logger from '../utils/logger';
import type { HistoricalSyncJobData } from '../workers/historical-email-sync.worker';

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
const BATCH_SIZE = 200; // Emails per page
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
   * Update BullMQ job progress and extend lock to prevent stalling
   */
  private async updateJobProgress(
    bullmqJob: Job<HistoricalSyncJobData> | undefined,
    progress: { phase: string; current: number; total: number; detail?: string }
  ): Promise<void> {
    if (!bullmqJob) return;

    try {
      await bullmqJob.updateProgress(progress);
      // Extend lock by 5 minutes to match lockDuration
      if (bullmqJob.token) {
        await bullmqJob.extendLock(bullmqJob.token, 300000);
      }

      logger.debug('[HistoricalEmailSync] Progress updated', {
        jobId: bullmqJob.id,
        phase: progress.phase,
        progress: `${progress.current}/${progress.total}`,
      });
    } catch (err: any) {
      // Don't fail the job if progress update fails - just log warning
      logger.warn('[HistoricalEmailSync] Failed to update progress', {
        jobId: bullmqJob.id,
        error: err.message,
      });
    }
  }

  /**
   * Main sync method - called by the worker
   *
   * @param jobId - HistoricalEmailSyncJob.id to update progress
   * @param caseId - Case to link emails to
   * @param contactEmail - Email address of the contact
   * @param azureAdId - Azure AD user ID for Graph API calls (uses /users/{id}/messages)
   * @param userId - User triggering the sync (for EmailCaseLink.linkedBy)
   * @param graphClient - Pre-authenticated Graph client (app-only or delegated)
   * @param bullmqJob - BullMQ job for progress updates
   */
  async syncHistoricalEmails(
    jobId: string,
    caseId: string,
    contactEmail: string,
    azureAdId: string,
    userId: string,
    graphClient: Client,
    bullmqJob?: Job<HistoricalSyncJobData>
  ): Promise<HistoricalSyncResult> {
    logger.info('[HistoricalEmailSync] Starting sync', { jobId, caseId, contactEmail, azureAdId });

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
      const emails = await this.fetchEmailsByContact(
        graphClient,
        azureAdId,
        contactEmail,
        sinceDate,
        bullmqJob
      );

      logger.info('[HistoricalEmailSync] Fetched emails', {
        jobId,
        count: emails.length,
      });

      // Update BullMQ progress after fetching
      await this.updateJobProgress(bullmqJob, {
        phase: 'fetch',
        current: emails.length,
        total: emails.length,
        detail: `Fetched ${emails.length} emails for processing`,
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

      // 3. Check if contact exists on multiple cases (for AI routing)
      const triggeringCase = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!triggeringCase) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const firmId = triggeringCase.firmId;
      const contactCases = await this.getContactCases(contactEmail, firmId);
      const useAIRouting = contactCases.length > 1;

      logger.info('[HistoricalEmailSync] Contact case count', {
        jobId,
        contactEmail,
        caseCount: contactCases.length,
        useAIRouting,
        caseIds: contactCases.map((c) => c.id),
      });

      // 4. Link emails to case (skip if already linked)
      let emailsLinked = 0;
      let attachmentsSynced = 0;

      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);

        let result: { linked: number; attachments: number };

        if (useAIRouting) {
          // Multi-case contact: use AI routing to determine correct case(s)
          result = await this.processBatchWithAIRouting(
            batch,
            contactCases,
            caseId, // Triggering case as fallback
            firmId,
            userId,
            graphClient,
            azureAdId,
            bullmqJob
          );
        } else {
          // Single case: use existing direct linking
          result = await this.processBatch(
            batch,
            caseId,
            userId,
            graphClient,
            azureAdId,
            bullmqJob
          );
        }

        emailsLinked += result.linked;
        attachmentsSynced += result.attachments;

        // Update progress in database
        const processedCount = Math.min(i + BATCH_SIZE, emails.length);
        await prismaWithSync.historicalEmailSyncJob.update({
          where: { id: jobId },
          data: { syncedEmails: processedCount },
        });

        // Update BullMQ job progress to prevent stalling
        await this.updateJobProgress(bullmqJob, {
          phase: 'processing',
          current: processedCount,
          total: emails.length,
          detail: `Linked ${emailsLinked} emails, synced ${attachmentsSynced} attachments${useAIRouting ? ' (AI routing)' : ''}`,
        });
      }

      // 5. Mark job as completed
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
   *
   * Uses /users/{azureAdId}/messages endpoint for app-only access
   */
  private async fetchEmailsByContact(
    client: Client,
    azureAdId: string,
    contactEmail: string,
    sinceDate: Date,
    bullmqJob?: Job<HistoricalSyncJobData>
  ): Promise<Array<{ graphMessageId: string; hasAttachments: boolean }>> {
    const emails: Array<{ graphMessageId: string; hasAttachments: boolean }> = [];

    // Use $search to find emails involving this contact
    // Note: Graph API $search doesn't support $filter or $orderby, so we
    // fetch all pages and filter by date in memory
    const sinceDateMs = sinceDate.getTime();

    // Use /users/{azureAdId}/messages for app-only access (instead of /me/messages)
    const messagesEndpoint = `/users/${azureAdId}/messages`;

    try {
      // Extend lock before initial fetch (can take time with retries)
      if (bullmqJob?.token) {
        try {
          await bullmqJob.extendLock(bullmqJob.token, 300000);
        } catch {
          // Lock extension failed - continue anyway
        }
      }

      let response = await retryWithBackoff(
        async () => {
          return await client
            .api(messagesEndpoint)
            .search(`"${contactEmail}"`)
            .select('id,hasAttachments,receivedDateTime')
            .top(BATCH_SIZE)
            .get();
        },
        {},
        'historical-sync-fetch'
      );

      let pageCount = 0;

      // Collect all emails with pagination, filtering by date in memory
      while (response?.value) {
        pageCount++;

        for (const msg of response.value) {
          if (msg.id) {
            // Filter by date in memory since $filter can't be used with $search
            const receivedDate = msg.receivedDateTime
              ? new Date(msg.receivedDateTime).getTime()
              : 0;
            if (receivedDate >= sinceDateMs) {
              emails.push({
                graphMessageId: msg.id,
                hasAttachments: msg.hasAttachments || false,
              });
            }
          }
        }

        // Update progress after each page to prevent stalling
        await this.updateJobProgress(bullmqJob, {
          phase: 'fetch',
          current: pageCount,
          total: pageCount + (response['@odata.nextLink'] ? 1 : 0),
          detail: `Fetched ${emails.length} emails (page ${pageCount})`,
        });

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

      logger.debug('[HistoricalEmailSync] Fetch completed', {
        pageCount,
        emailsFound: emails.length,
        contactEmail,
      });
    } catch (error: any) {
      const parsedError = parseGraphError(error);
      logGraphError(parsedError);
      throw parsedError;
    }

    return emails;
  }

  /**
   * Process a batch of emails - link to case and sync attachments
   *
   * Uses app-only client for attachment fetching
   */
  private async processBatch(
    emails: Array<{ graphMessageId: string; hasAttachments: boolean }>,
    caseId: string,
    userId: string,
    graphClient: Client,
    azureAdId: string,
    bullmqJob?: Job<HistoricalSyncJobData>
  ): Promise<{ linked: number; attachments: number }> {
    let linked = 0;
    let attachments = 0;

    // Get existing email IDs from our database with owner info for privacy
    const graphIds = emails.map((e) => e.graphMessageId);
    const existingEmails = await prisma.email.findMany({
      where: { graphMessageId: { in: graphIds } },
      select: {
        id: true,
        graphMessageId: true,
        userId: true,
        user: { select: { role: true } },
      },
    });
    const emailMap = new Map(
      existingEmails.map((e) => [
        e.graphMessageId,
        {
          id: e.id,
          userId: e.userId,
          isPartnerOwner: e.user?.role === 'Partner' || e.user?.role === 'BusinessOwner',
        },
      ])
    );

    for (const email of emails) {
      // Extend lock at the start of each email to prevent stalling during long batches
      if (bullmqJob?.token) {
        try {
          await bullmqJob.extendLock(bullmqJob.token, 300000);
        } catch {
          // Lock extension failed - job may have been cancelled, but continue processing
        }
      }

      const emailInfo = emailMap.get(email.graphMessageId);
      if (!emailInfo) {
        // Email not in our DB - skip (it will be synced by regular sync)
        continue;
      }

      const { id: dbEmailId, userId: emailOwnerId, isPartnerOwner } = emailInfo;

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
        // Create link and update legacy caseId + classificationState for backwards compatibility
        // OPS-XXX: Partner's emails are private by default when linked to a case
        await Promise.all([
          // First, clear isPrimary on any existing links for this email
          prisma.emailCaseLink.updateMany({
            where: { emailId: dbEmailId, isPrimary: true },
            data: { isPrimary: false },
          }),
          prisma.emailCaseLink.create({
            data: {
              emailId: dbEmailId,
              caseId: caseId,
              confidence: 1.0,
              matchType: 'Manual', // Historical sync is a form of manual linking
              linkedBy: userId,
              isPrimary: true, // Mark as primary - user is explicitly importing to this case
            },
          }),
          // Also update legacy Email.caseId field and mark as classified so thread grouping works
          prisma.email.update({
            where: { id: dbEmailId },
            data: {
              caseId: caseId,
              classificationState: 'Classified', // Mark as classified so it appears in email section
              // Partner/BusinessOwner emails are private by default
              ...(isPartnerOwner && {
                isPrivate: true,
                markedPrivateBy: emailOwnerId,
              }),
            },
          }),
        ]);
        linked++;
      }

      // Sync attachments after email is linked to case
      // The attachment service requires email to have caseId or clientId set
      if (email.hasAttachments) {
        try {
          // Extend lock before potentially long attachment sync
          if (bullmqJob?.token) {
            await bullmqJob.extendLock(bullmqJob.token, 300000);
          }

          const attachmentService = getEmailAttachmentService(prisma);
          const syncResult = await attachmentService.syncAllAttachmentsWithClient(
            dbEmailId,
            graphClient,
            azureAdId
          );
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

  /**
   * Get all active cases where this contact appears as an actor or client contact.
   * Used to determine if AI routing is needed (contact on multiple cases).
   */
  async getContactCases(contactEmail: string, firmId: string): Promise<CaseCandidate[]> {
    const normalizedEmail = contactEmail.toLowerCase();

    // Find all active cases where this contact appears as:
    // 1. CaseActor.email exact match
    // 2. Client.contacts/administrators/contactInfo (via client)
    const cases = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
        OR: [
          // Direct actor email match
          {
            actors: {
              some: {
                email: { equals: normalizedEmail, mode: 'insensitive' },
              },
            },
          },
          // Client contact email match (contactInfo.email is a string field)
          {
            client: {
              contactInfo: {
                path: ['email'],
                string_contains: normalizedEmail,
              },
            },
          },
        ],
      },
      include: {
        actors: {
          select: {
            name: true,
            organization: true,
            email: true,
            role: true,
          },
        },
        client: {
          select: {
            name: true,
            contacts: true,
            administrators: true,
            contactInfo: true,
          },
        },
      },
    });

    // Also check client contacts/administrators JSON arrays
    // These need post-filter since Prisma can't query into JSON arrays easily
    const clientIdsWithContact = new Set<string>();

    const allClients = await prisma.client.findMany({
      where: { firmId },
      select: {
        id: true,
        contacts: true,
        administrators: true,
      },
    });

    for (const client of allClients) {
      // Check contacts array
      const contacts = (client.contacts as Array<{ email?: string }>) || [];
      for (const contact of contacts) {
        if (contact.email?.toLowerCase() === normalizedEmail) {
          clientIdsWithContact.add(client.id);
          break;
        }
      }

      // Check administrators array
      const admins = (client.administrators as Array<{ email?: string }>) || [];
      for (const admin of admins) {
        if (admin.email?.toLowerCase() === normalizedEmail) {
          clientIdsWithContact.add(client.id);
          break;
        }
      }
    }

    // If we found additional clients via JSON array matching, get their cases
    if (clientIdsWithContact.size > 0) {
      const additionalCases = await prisma.case.findMany({
        where: {
          firmId,
          status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
          clientId: { in: Array.from(clientIdsWithContact) },
          // Exclude cases we already found
          id: { notIn: cases.map((c) => c.id) },
        },
        include: {
          actors: {
            select: {
              name: true,
              organization: true,
              email: true,
              role: true,
            },
          },
          client: {
            select: {
              name: true,
              contacts: true,
              administrators: true,
              contactInfo: true,
            },
          },
        },
      });

      cases.push(...additionalCases);
    }

    return cases.map((c) => ({
      id: c.id,
      title: c.title,
      caseNumber: c.caseNumber,
      referenceNumbers: c.referenceNumbers,
      keywords: c.keywords,
      clientName: c.client.name,
      actors: c.actors,
    }));
  }

  /**
   * Fetch email content from our database for AI routing.
   */
  private async getEmailsForRouting(graphMessageIds: string[]): Promise<EmailRoutingInput[]> {
    const emails = await prisma.email.findMany({
      where: { graphMessageId: { in: graphMessageIds } },
      select: {
        id: true,
        graphMessageId: true,
        subject: true,
        bodyPreview: true,
        from: true,
        toRecipients: true,
        receivedDateTime: true,
      },
    });

    return emails.map((e) => ({
      id: e.id,
      graphMessageId: e.graphMessageId,
      subject: e.subject,
      bodyPreview: e.bodyPreview,
      from: e.from as { name?: string; address: string },
      toRecipients: e.toRecipients as Array<{ name?: string; address: string }>,
      receivedDateTime: e.receivedDateTime,
    }));
  }

  /**
   * Process a batch of emails with AI routing for multi-case contacts.
   * This variant uses AI to determine which case(s) each email belongs to.
   */
  private async processBatchWithAIRouting(
    emails: Array<{ graphMessageId: string; hasAttachments: boolean }>,
    candidateCases: CaseCandidate[],
    triggeringCaseId: string,
    firmId: string,
    userId: string,
    graphClient: Client,
    azureAdId: string,
    bullmqJob?: Job<HistoricalSyncJobData>
  ): Promise<{ linked: number; attachments: number }> {
    let linked = 0;
    let attachments = 0;

    // Get emails from our database with content for AI analysis
    const graphIds = emails.map((e) => e.graphMessageId);
    const emailsWithContent = await this.getEmailsForRouting(graphIds);

    if (emailsWithContent.length === 0) {
      logger.debug('[HistoricalEmailSync] No emails found in DB for AI routing');
      return { linked, attachments };
    }

    // Get email ownership info for privacy handling
    const existingEmails = await prisma.email.findMany({
      where: { graphMessageId: { in: graphIds } },
      select: {
        id: true,
        graphMessageId: true,
        userId: true,
        user: { select: { role: true } },
      },
    });
    const emailInfoMap = new Map(
      existingEmails.map((e) => [
        e.graphMessageId,
        {
          id: e.id,
          userId: e.userId,
          isPartnerOwner: e.user?.role === 'Partner' || e.user?.role === 'BusinessOwner',
        },
      ])
    );

    // Call AI router
    const router = getAIEmailCaseRouterService();
    const routingResults = await router.routeEmailsToCases(
      emailsWithContent,
      candidateCases,
      firmId,
      userId
    );

    logger.info('[HistoricalEmailSync] AI routing results', {
      emailCount: emailsWithContent.length,
      resultsCount: routingResults.length,
      matchedCount: routingResults.filter((r) => r.matches.length > 0).length,
    });

    // Process routing results
    for (const result of routingResults) {
      const emailInfo = emailInfoMap.get(
        emailsWithContent.find((e) => e.id === result.emailId)?.graphMessageId || ''
      );
      if (!emailInfo) continue;

      const { id: dbEmailId, userId: emailOwnerId, isPartnerOwner } = emailInfo;
      const originalEmail = emails.find(
        (e) =>
          e.graphMessageId ===
          emailsWithContent.find((ec) => ec.id === result.emailId)?.graphMessageId
      );

      // Extend lock before processing
      if (bullmqJob?.token) {
        try {
          await bullmqJob.extendLock(bullmqJob.token, 300000);
        } catch {
          // Lock extension failed - continue processing
        }
      }

      if (result.matches.length > 0) {
        // AI found matching case(s) - link to those
        for (let i = 0; i < result.matches.length; i++) {
          const match = result.matches[i];

          // Check if already linked
          const existingLink = await prisma.emailCaseLink.findUnique({
            where: {
              emailId_caseId: {
                emailId: dbEmailId,
                caseId: match.caseId,
              },
            },
          });

          if (!existingLink) {
            const isPrimary = i === 0 && AIEmailCaseRouterService.isPrimaryMatch(match.confidence);

            await Promise.all([
              // Clear existing isPrimary if this is primary
              isPrimary
                ? prisma.emailCaseLink.updateMany({
                    where: { emailId: dbEmailId, isPrimary: true },
                    data: { isPrimary: false },
                  })
                : Promise.resolve(),
              // Create the link with AI routing metadata
              prisma.emailCaseLink.create({
                data: {
                  emailId: dbEmailId,
                  caseId: match.caseId,
                  confidence: match.confidence,
                  matchType: ClassificationMatchType.Semantic,
                  linkedBy: userId,
                  isPrimary,
                },
              }),
              // Update legacy Email.caseId field for highest confidence match only
              i === 0
                ? prisma.email.update({
                    where: { id: dbEmailId },
                    data: {
                      caseId: match.caseId,
                      classificationState: 'Classified',
                      ...(isPartnerOwner && {
                        isPrivate: true,
                        markedPrivateBy: emailOwnerId,
                      }),
                    },
                  })
                : Promise.resolve(),
            ]);
            linked++;
          }
        }
      } else {
        // AI found no matches - link to triggering case with low confidence for manual review
        const existingLink = await prisma.emailCaseLink.findUnique({
          where: {
            emailId_caseId: {
              emailId: dbEmailId,
              caseId: triggeringCaseId,
            },
          },
        });

        if (!existingLink) {
          await Promise.all([
            prisma.emailCaseLink.updateMany({
              where: { emailId: dbEmailId, isPrimary: true },
              data: { isPrimary: false },
            }),
            prisma.emailCaseLink.create({
              data: {
                emailId: dbEmailId,
                caseId: triggeringCaseId,
                confidence: 0.5, // Low confidence for manual review
                matchType: ClassificationMatchType.Manual,
                linkedBy: userId,
                isPrimary: true,
              },
            }),
            prisma.email.update({
              where: { id: dbEmailId },
              data: {
                caseId: triggeringCaseId,
                classificationState: 'Classified',
                ...(isPartnerOwner && {
                  isPrivate: true,
                  markedPrivateBy: emailOwnerId,
                }),
              },
            }),
          ]);
          linked++;
        }
      }

      // Sync attachments
      if (originalEmail?.hasAttachments) {
        try {
          if (bullmqJob?.token) {
            await bullmqJob.extendLock(bullmqJob.token, 300000);
          }
          const attachmentService = getEmailAttachmentService(prisma);
          const syncResult = await attachmentService.syncAllAttachmentsWithClient(
            dbEmailId,
            graphClient,
            azureAdId
          );
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
