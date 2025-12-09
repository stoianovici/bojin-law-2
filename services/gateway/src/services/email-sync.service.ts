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
      let nextLink: string | undefined;
      let deltaLink: string | undefined;

      // Start with delta query to get delta token on first sync
      console.log('[EmailSyncService.syncUserEmails] Fetching first page from Graph API...');
      let response = await this.fetchEmailsPage(client, pageSize, true);
      console.log(
        '[EmailSyncService.syncUserEmails] First page response - messages:',
        response?.value?.length,
        'hasNextLink:',
        !!response?.['@odata.nextLink']
      );

      do {
        const messages = response.value as Message[];

        if (messages.length > 0) {
          const syncedEmails = this.transformMessages(messages);
          await this.storeEmails(syncedEmails, userId, user.firmId);
          emailsSynced += messages.length;
        }

        // Check for next page or delta link
        nextLink = response['@odata.nextLink'];
        deltaLink = response['@odata.deltaLink'];

        if (nextLink && emailsSynced < maxEmails) {
          response = await this.fetchNextPage(client, nextLink);
        }
      } while (nextLink && emailsSynced < maxEmails);

      // Extract delta token from delta link
      const deltaToken = deltaLink ? this.extractDeltaToken(deltaLink) : undefined;

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
    try {
      // Get current sync state
      const syncState = await this.prisma.emailSyncState.findUnique({
        where: { userId },
      });

      if (!syncState?.deltaToken) {
        // No delta token, perform full sync
        return this.syncUserEmails(userId, accessToken);
      }

      // Get user's firm ID
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firmId: true },
      });

      if (!user?.firmId) {
        return { success: false, emailsSynced: 0, error: 'User not found or has no firm' };
      }

      // Update sync state to 'syncing'
      await this.updateSyncState(userId, { syncStatus: 'syncing' });

      const client = this.graphService.getAuthenticatedClient(accessToken);
      let emailsSynced = 0;
      let nextLink: string | undefined;
      let deltaLink: string | undefined;

      // Start with delta query using stored token
      let response = await this.fetchDeltaPage(client, syncState.deltaToken);

      do {
        const messages = response.value as Message[];

        if (messages.length > 0) {
          const syncedEmails = this.transformMessages(messages);
          await this.upsertEmails(syncedEmails, userId, user.firmId);
          emailsSynced += messages.length;
        }

        // Handle deleted messages
        const deletedMessages = response.value?.filter((m: any) => m['@removed']) as Message[];
        if (deletedMessages?.length > 0) {
          await this.handleDeletedEmails(
            deletedMessages.map((m) => m.id!),
            userId
          );
        }

        // Check for next page or delta link
        nextLink = response['@odata.nextLink'];
        deltaLink = response['@odata.deltaLink'];

        if (nextLink) {
          response = await this.fetchNextPage(client, nextLink);
        }
      } while (nextLink);

      // Extract new delta token
      const newDeltaToken = deltaLink ? this.extractDeltaToken(deltaLink) : syncState.deltaToken;

      // Update sync state
      await this.updateSyncState(userId, {
        syncStatus: 'synced',
        deltaToken: newDeltaToken,
        lastSyncAt: new Date(),
        errorMessage: null,
      });

      return {
        success: true,
        emailsSynced,
        deltaToken: newDeltaToken,
      };
    } catch (error: any) {
      const parsedError = parseGraphError(error);
      logGraphError(parsedError);

      // Check if delta token is expired (requires full resync)
      if (parsedError.errorCode === 'resyncRequired' || parsedError.statusCode === 410) {
        // Clear delta token and perform full sync
        await this.updateSyncState(userId, { deltaToken: null });
        return this.syncUserEmails(userId, accessToken);
      }

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
   * Fetch initial page of emails using delta query
   */
  private async fetchEmailsPage(
    client: Client,
    pageSize: number,
    useDelta: boolean = false
  ): Promise<any> {
    return retryWithBackoff(
      async () => {
        try {
          const endpoint = useDelta ? '/me/messages/delta' : graphEndpoints.messages;

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
      'email-sync-fetch-page'
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
          // nextLink is a full URL, need to extract path
          const url = new URL(nextLink);
          const path = url.pathname + url.search;
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
   */
  private transformMessages(messages: Message[]): SyncedEmail[] {
    return messages
      .filter((m) => m.id && !('removed' in m))
      .map((message) => ({
        graphMessageId: message.id!,
        conversationId: message.conversationId || '',
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
      }));
  }

  /**
   * Store emails in database (for initial sync)
   */
  private async storeEmails(emails: SyncedEmail[], userId: string, firmId: string): Promise<void> {
    // Use createMany for efficiency, skip duplicates
    await this.prisma.email.createMany({
      data: emails.map((email) => ({
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
        userId,
        firmId,
      })),
      skipDuplicates: true,
    });
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
            userId,
            firmId,
          },
          update: {
            subject: email.subject,
            bodyPreview: email.bodyPreview,
            bodyContent: email.bodyContent,
            isRead: email.isRead,
            importance: email.importance,
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
