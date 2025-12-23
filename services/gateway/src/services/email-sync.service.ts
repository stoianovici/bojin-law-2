/**
 * Email Sync Service
 * Story 5.1: Email Integration and Synchronization
 *
 * Synchronizes user emails from Microsoft Graph API to local database.
 * Supports both initial full sync and incremental delta sync.
 *
 * Rate Limit: 10,000 requests per 10 minutes (Graph API)
 * [Source: docs/architecture/external-apis.md#microsoft-graph-api]
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { Message } from '@microsoft/microsoft-graph-types';
import { PrismaClient } from '@prisma/client';
import { graphEndpoints } from '../config/graph.config';
import { GraphService } from './graph.service';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import { activityEventService } from './activity-event.service';

// ============================================================================
// Types
// ============================================================================

export interface EmailSyncResult {
  success: boolean;
  emailsSynced: number;
  deltaToken?: string;
  error?: string;
}

export interface SyncedEmail {
  graphMessageId: string;
  conversationId: string;
  internetMessageId?: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  bodyContentType: string;
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  bccRecipients: EmailAddress[];
  receivedDateTime: Date;
  sentDateTime: Date;
  hasAttachments: boolean;
  importance: string;
  isRead: boolean;
  folderType: 'inbox' | 'sent'; // OPS-091: Track email source folder
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailSyncOptions {
  pageSize?: number;
  maxEmails?: number;
  includeBody?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = parseInt(process.env.EMAIL_SYNC_PAGE_SIZE || '50', 10);
const MAX_EMAILS_PER_SYNC = 10000; // Safety limit

// Fields to select for efficiency (AC: 1)
const EMAIL_SELECT_FIELDS = [
  'id',
  'conversationId',
  'internetMessageId',
  'subject',
  'bodyPreview',
  'body',
  'from',
  'toRecipients',
  'ccRecipients',
  'bccRecipients',
  'receivedDateTime',
  'sentDateTime',
  'hasAttachments',
  'importance',
  'isRead',
  'internetMessageHeaders',
].join(',');

// Fields for delta query (lighter payload)
const DELTA_SELECT_FIELDS = [
  'id',
  'conversationId',
  'internetMessageId',
  'subject',
  'bodyPreview',
  'from',
  'toRecipients',
  'receivedDateTime',
  'hasAttachments',
  'isRead',
].join(',');

// ============================================================================
// Email Sync Service
// ============================================================================

export class EmailSyncService {
  private prisma: PrismaClient;
  private graphService: GraphService;

  constructor(prisma: PrismaClient, graphService?: GraphService) {
    this.prisma = prisma;
    this.graphService = graphService || new GraphService();
  }

  /**
   * Perform initial full sync of user emails (AC: 1)
   *
   * Fetches all emails from user's inbox and stores them in the database.
   * Returns a delta token for subsequent incremental syncs.
   *
   * @param userId - Internal user ID
   * @param accessToken - User's OAuth access token
   * @param options - Sync options
   * @returns Sync result with count and delta token
   */
  async syncUserEmails(
    userId: string,
    accessToken: string,
    options: EmailSyncOptions = {}
  ): Promise<EmailSyncResult> {
    const { pageSize = DEFAULT_PAGE_SIZE, maxEmails = MAX_EMAILS_PER_SYNC } = options;

    console.log(
      '[EmailSyncService.syncUserEmails] Starting sync for user:',
      userId,
      'pageSize:',
      pageSize
    );

    try {
      // Get user's firm ID for storage
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firmId: true },
      });

      console.log('[EmailSyncService.syncUserEmails] User lookup result:', user);

      if (!user?.firmId) {
        console.error('[EmailSyncService.syncUserEmails] User not found or has no firm');
        return { success: false, emailsSynced: 0, error: 'User not found or has no firm' };
      }

      // Update sync state to 'syncing'
      await this.updateSyncState(userId, { syncStatus: 'syncing' });
      console.log('[EmailSyncService.syncUserEmails] Updated sync state to syncing');

      const client = this.graphService.getAuthenticatedClient(accessToken);
      let emailsSynced = 0;

      // OPS-091: Sync both inbox and sent folders
      const foldersToSync: Array<'inbox' | 'sent'> = ['inbox', 'sent'];

      for (const folderType of foldersToSync) {
        let nextLink: string | undefined;

        console.log(`[EmailSyncService.syncUserEmails] Fetching ${folderType} emails...`);
        let response = await this.fetchEmailsPage(client, pageSize, folderType, false);
        console.log(
          `[EmailSyncService.syncUserEmails] ${folderType} first page - messages:`,
          response?.value?.length,
          'hasNextLink:',
          !!response?.['@odata.nextLink']
        );

        do {
          const messages = response.value as Message[];

          if (messages.length > 0) {
            const syncedEmails = this.transformMessages(messages, folderType);
            await this.storeEmails(syncedEmails, userId, user.firmId);
            emailsSynced += messages.length;
          }

          // Check for next page
          nextLink = response['@odata.nextLink'];

          if (nextLink && emailsSynced < maxEmails) {
            response = await this.fetchNextPage(client, nextLink);
          }
        } while (nextLink && emailsSynced < maxEmails);

        console.log(
          `[EmailSyncService.syncUserEmails] ${folderType} sync complete:`,
          emailsSynced,
          'total emails'
        );
      }

      // Note: Delta token not supported for multi-folder sync, will rely on full sync
      const deltaToken = undefined;

      // Update sync state with delta token
      await this.updateSyncState(userId, {
        syncStatus: 'synced',
        deltaToken,
        lastSyncAt: new Date(),
        errorMessage: null,
      });

      return {
        success: true,
        emailsSynced,
        deltaToken,
      };
    } catch (error: any) {
      const parsedError = parseGraphError(error);
      logGraphError(parsedError);

      // Update sync state with error
      await this.updateSyncState(userId, {
        syncStatus: 'error',
        errorMessage: parsedError.message,
      });

      return {
        success: false,
        emailsSynced: 0,
        error: parsedError.message,
      };
    }
  }

  /**
   * Perform incremental sync using delta token (AC: 1)
   *
   * Fetches only emails that have changed since the last sync.
   * More efficient than full sync for ongoing updates.
   *
   * @param userId - Internal user ID
   * @param accessToken - User's OAuth access token
   * @returns Sync result with count and new delta token
   */
  async syncIncrementalEmails(userId: string, accessToken: string): Promise<EmailSyncResult> {
    // OPS-091: With multi-folder sync (inbox + sent), delta sync is complex
    // For simplicity, always do a full sync which will skip duplicates
    // This is still efficient due to skipDuplicates in createMany
    console.log(
      '[EmailSyncService.syncIncrementalEmails] Performing full sync (multi-folder mode)'
    );
    return this.syncUserEmails(userId, accessToken);
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(userId: string): Promise<{
    status: string;
    lastSyncAt: Date | null;
    emailCount: number;
    pendingCategorization: number;
  }> {
    const [syncState, emailCount, pendingCount] = await Promise.all([
      this.prisma.emailSyncState.findUnique({ where: { userId } }),
      this.prisma.email.count({ where: { userId } }),
      this.prisma.email.count({ where: { userId, caseId: null } }),
    ]);

    return {
      status: syncState?.syncStatus || 'pending',
      lastSyncAt: syncState?.lastSyncAt || null,
      emailCount,
      pendingCategorization: pendingCount,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fetch initial page of emails from a specific folder
   * @param client - Graph API client
   * @param pageSize - Number of emails per page
   * @param folderType - Which folder to fetch from ('inbox' or 'sent') - OPS-091
   * @param useDelta - Whether to use delta sync
   */
  private async fetchEmailsPage(
    client: Client,
    pageSize: number,
    folderType: 'inbox' | 'sent' = 'inbox',
    useDelta: boolean = false
  ): Promise<any> {
    return retryWithBackoff(
      async () => {
        try {
          // OPS-091: Support both inbox and sent folders
          const folderEndpoint =
            folderType === 'sent' ? graphEndpoints.sentMessages : graphEndpoints.inboxMessages;

          const endpoint = useDelta
            ? `/me/mailFolders/${folderType === 'sent' ? 'SentItems' : 'Inbox'}/messages/delta`
            : folderEndpoint;

          const request = client
            .api(endpoint)
            .select(useDelta ? DELTA_SELECT_FIELDS : EMAIL_SELECT_FIELDS)
            .top(pageSize)
            .orderby('receivedDateTime DESC');

          return await request.get();
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      `email-sync-fetch-page-${folderType}`
    );
  }

  /**
   * Fetch delta page with existing token
   */
  private async fetchDeltaPage(client: Client, deltaToken: string): Promise<any> {
    return retryWithBackoff(
      async () => {
        try {
          const deltaUrl = `/me/messages/delta?$deltatoken=${encodeURIComponent(deltaToken)}`;
          return await client.api(deltaUrl).get();
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'email-sync-fetch-delta'
    );
  }

  /**
   * Fetch next page using pagination link
   */
  private async fetchNextPage(client: Client, nextLink: string): Promise<any> {
    return retryWithBackoff(
      async () => {
        try {
          // nextLink is a full URL like https://graph.microsoft.com/v1.0/me/messages?$skip=50
          // We need to extract just the path after /v1.0 since client already has defaultVersion
          const url = new URL(nextLink);
          let path = url.pathname + url.search;
          // Remove /v1.0 or /beta prefix since client.api() adds it based on defaultVersion
          path = path.replace(/^\/(v1\.0|beta)/, '');
          return await client.api(path).get();
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'email-sync-fetch-next-page'
    );
  }

  /**
   * Transform Graph API messages to our format
   * @param messages - Messages from Graph API
   * @param folderType - Source folder type ('inbox' or 'sent') - OPS-091
   */
  private transformMessages(
    messages: Message[],
    folderType: 'inbox' | 'sent' = 'inbox'
  ): SyncedEmail[] {
    return messages
      .filter((m) => m.id && !('removed' in m))
      .map((message) => ({
        graphMessageId: message.id!,
        // Use conversationId from Graph API, or fallback to message ID for threading
        conversationId: message.conversationId || message.id || '',
        internetMessageId: message.internetMessageId || undefined,
        subject: message.subject || '(No Subject)',
        bodyPreview: message.bodyPreview || '',
        bodyContent: message.body?.content || '',
        bodyContentType: message.body?.contentType || 'text',
        from: {
          name: message.from?.emailAddress?.name ?? undefined,
          address: message.from?.emailAddress?.address || '',
        },
        toRecipients: (message.toRecipients || []).map((r) => ({
          name: r.emailAddress?.name ?? undefined,
          address: r.emailAddress?.address || '',
        })),
        ccRecipients: (message.ccRecipients || []).map((r) => ({
          name: r.emailAddress?.name ?? undefined,
          address: r.emailAddress?.address || '',
        })),
        bccRecipients: (message.bccRecipients || []).map((r) => ({
          name: r.emailAddress?.name ?? undefined,
          address: r.emailAddress?.address || '',
        })),
        receivedDateTime: new Date(message.receivedDateTime || Date.now()),
        sentDateTime: new Date(message.sentDateTime || Date.now()),
        hasAttachments: message.hasAttachments || false,
        importance: message.importance || 'normal',
        isRead: message.isRead || false,
        folderType, // OPS-091: Track source folder
      }));
  }

  /**
   * Store emails in database (for initial sync)
   * OPS-116: Emits activity events for new emails
   */
  private async storeEmails(emails: SyncedEmail[], userId: string, firmId: string): Promise<void> {
    if (emails.length === 0) return;

    // Check which emails already exist (for event emission)
    const graphMessageIds = emails.map((e) => e.graphMessageId);
    const existingEmails = await this.prisma.email.findMany({
      where: { graphMessageId: { in: graphMessageIds } },
      select: { graphMessageId: true },
    });
    const existingIds = new Set(existingEmails.map((e) => e.graphMessageId));

    // Filter to only new emails
    const newEmails = emails.filter((e) => !existingIds.has(e.graphMessageId));

    if (newEmails.length === 0) return;

    // Use createMany for efficiency
    await this.prisma.email.createMany({
      data: newEmails.map((email) => ({
        graphMessageId: email.graphMessageId,
        conversationId: email.conversationId,
        internetMessageId: email.internetMessageId,
        subject: email.subject,
        bodyPreview: email.bodyPreview,
        bodyContent: email.bodyContent,
        bodyContentType: email.bodyContentType,
        from: email.from as any,
        toRecipients: email.toRecipients as any,
        ccRecipients: email.ccRecipients as any,
        bccRecipients: email.bccRecipients as any,
        receivedDateTime: email.receivedDateTime,
        sentDateTime: email.sentDateTime,
        hasAttachments: email.hasAttachments,
        importance: email.importance,
        isRead: email.isRead,
        folderType: email.folderType, // OPS-091
        userId,
        firmId,
      })),
    });

    // OPS-116: Emit activity events for new emails (only inbox emails, not sent)
    const inboxEmails = newEmails.filter((e) => e.folderType === 'inbox');
    if (inboxEmails.length > 0) {
      // Get the created email IDs for event metadata
      const createdEmails = await this.prisma.email.findMany({
        where: { graphMessageId: { in: inboxEmails.map((e) => e.graphMessageId) } },
        select: { id: true, graphMessageId: true, subject: true, from: true },
      });

      const emailMap = new Map(createdEmails.map((e) => [e.graphMessageId, e]));

      const events = inboxEmails
        .map((email) => {
          const dbEmail = emailMap.get(email.graphMessageId);
          if (!dbEmail) return null;

          const fromAddress = email.from?.address || '';
          const isCourtEmail = activityEventService.isCourtEmail(fromAddress);

          return {
            userId,
            firmId,
            eventType: isCourtEmail ? ('EMAIL_FROM_COURT' as const) : ('EMAIL_RECEIVED' as const),
            entityType: 'EMAIL' as const,
            entityId: dbEmail.id,
            entityTitle: email.subject,
            metadata: {
              from: email.from,
              hasAttachments: email.hasAttachments,
            },
            occurredAt: email.receivedDateTime,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      if (events.length > 0) {
        await activityEventService.emitBatch(events);
      }
    }
  }

  /**
   * Upsert emails in database (for incremental sync)
   */
  private async upsertEmails(emails: SyncedEmail[], userId: string, firmId: string): Promise<void> {
    // Use transaction for atomicity
    await this.prisma.$transaction(
      emails.map((email) =>
        this.prisma.email.upsert({
          where: { graphMessageId: email.graphMessageId },
          create: {
            graphMessageId: email.graphMessageId,
            conversationId: email.conversationId,
            internetMessageId: email.internetMessageId,
            subject: email.subject,
            bodyPreview: email.bodyPreview,
            bodyContent: email.bodyContent,
            bodyContentType: email.bodyContentType,
            from: email.from as any,
            toRecipients: email.toRecipients as any,
            ccRecipients: email.ccRecipients as any,
            bccRecipients: email.bccRecipients as any,
            receivedDateTime: email.receivedDateTime,
            sentDateTime: email.sentDateTime,
            hasAttachments: email.hasAttachments,
            importance: email.importance,
            isRead: email.isRead,
            folderType: email.folderType, // OPS-091
            userId,
            firmId,
          },
          update: {
            subject: email.subject,
            bodyPreview: email.bodyPreview,
            bodyContent: email.bodyContent,
            isRead: email.isRead,
            importance: email.importance,
            folderType: email.folderType, // OPS-126: Update folderType for existing emails
          },
        })
      )
    );
  }

  /**
   * Handle deleted emails from delta sync
   */
  private async handleDeletedEmails(graphMessageIds: string[], userId: string): Promise<void> {
    await this.prisma.email.deleteMany({
      where: {
        graphMessageId: { in: graphMessageIds },
        userId,
      },
    });
  }

  /**
   * Update sync state in database
   */
  private async updateSyncState(
    userId: string,
    data: {
      syncStatus?: string;
      deltaToken?: string | null;
      lastSyncAt?: Date;
      errorMessage?: string | null;
    }
  ): Promise<void> {
    await this.prisma.emailSyncState.upsert({
      where: { userId },
      create: {
        userId,
        syncStatus: data.syncStatus || 'pending',
        deltaToken: data.deltaToken,
        lastSyncAt: data.lastSyncAt,
        errorMessage: data.errorMessage,
      },
      update: data,
    });
  }

  /**
   * Extract delta token from delta link URL
   */
  private extractDeltaToken(deltaLink: string): string {
    try {
      const url = new URL(deltaLink);
      return url.searchParams.get('$deltatoken') || '';
    } catch {
      // If not a valid URL, try to extract token directly
      const match = deltaLink.match(/\$deltatoken=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailSyncServiceInstance: EmailSyncService | null = null;

export function getEmailSyncService(prisma: PrismaClient): EmailSyncService {
  if (!emailSyncServiceInstance) {
    emailSyncServiceInstance = new EmailSyncService(prisma);
  }
  return emailSyncServiceInstance;
}
