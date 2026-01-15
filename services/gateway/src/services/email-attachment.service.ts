/**
 * Email Attachment Service
 * Story 5.1: Email Integration and Synchronization
 *
 * Handles syncing and storing email attachments from Microsoft Graph API.
 * Attachments are only synced AFTER email is classified (assigned to case or client).
 * All attachments are stored in OneDrive/SharePoint - no temporary R2 storage.
 *
 * [Source: docs/architecture/external-apis.md#document-storage-architecture]
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { Attachment, FileAttachment } from '@microsoft/microsoft-graph-types';
import { PrismaClient, DocumentStatus } from '@prisma/client';
import pLimit from 'p-limit';
import { createGraphClient } from '../config/graph.config';
import { documentFilterService, type FilterStatus } from '../config/document-filter.config';
import { OneDriveService, oneDriveService } from './onedrive.service';
import { caseBriefingService } from './case-briefing.service';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface SyncedAttachment {
  id: string;
  emailId: string;
  graphAttachmentId: string;
  name: string;
  contentType: string;
  size: number;
  storageUrl: string | null;
  documentId?: string;
}

export interface AttachmentSyncResult {
  success: boolean;
  attachmentsSynced: number;
  attachments: SyncedAttachment[];
  errors: string[];
  /** Diagnostic info */
  _diagnostics?: {
    graphMessageId: string;
    attachmentsFromGraph: number;
    skippedNonFile: number;
    skippedAlreadyExist: number;
    emailCaseId: string | null;
    emailClientId: string | null;
    dismissedByFilter: number;
    dismissedByRule: Record<string, number>;
    dismissedAsDuplicate: number;
  };
}

export interface AttachmentDownloadResult {
  content: Buffer;
  name: string;
  contentType: string;
  size: number;
}

// ============================================================================
// Constants
// ============================================================================

const ONEDRIVE_EMAIL_FOLDER = 'Emails';

// Concurrency limits for parallel operations
const DOWNLOAD_CONCURRENCY = 3; // Max parallel downloads from Graph API
const UPLOAD_CONCURRENCY = 2; // Max parallel uploads to SharePoint (lower to avoid throttling)

// ============================================================================
// Email Attachment Service
// ============================================================================

export class EmailAttachmentService {
  private prisma: PrismaClient;
  private oneDrive: OneDriveService;

  constructor(prisma: PrismaClient, oneDrive?: OneDriveService) {
    this.prisma = prisma;
    this.oneDrive = oneDrive || oneDriveService;
  }

  /**
   * Sync all attachments for a classified email.
   * Email MUST have caseId or clientId - attachments are not synced for unclassified emails.
   *
   * @param emailId - Database email ID
   * @param accessToken - User's OAuth access token
   * @returns Sync result with all attachments
   */
  async syncAllAttachments(emailId: string, accessToken: string): Promise<AttachmentSyncResult> {
    const result: AttachmentSyncResult = {
      success: true,
      attachmentsSynced: 0,
      attachments: [],
      errors: [],
    };

    // Get email with case and client info
    const email = await this.prisma.email.findUnique({
      where: { id: emailId },
      include: {
        case: {
          select: { id: true, caseNumber: true, clientId: true, firmId: true },
        },
        client: {
          select: { id: true, name: true },
        },
      },
    });

    if (!email) {
      logger.warn('syncAllAttachments: Email not found', { emailId });
      return result;
    }

    if (!email.hasAttachments) {
      return result;
    }

    if (!email.caseId && !email.clientId) {
      logger.info('syncAllAttachments: Email not classified, skipping', { emailId });
      return result;
    }

    logger.info('syncAllAttachments: Starting parallel sync', {
      emailId,
      caseId: email.caseId,
      clientId: email.clientId,
    });

    // Get attachments from Graph API
    const attachments = await this.listAttachmentsFromGraph(email.graphMessageId, accessToken);

    // Initialize diagnostics
    result._diagnostics = {
      graphMessageId: email.graphMessageId,
      attachmentsFromGraph: attachments.length,
      skippedNonFile: 0,
      skippedAlreadyExist: 0,
      emailCaseId: email.caseId,
      emailClientId: email.clientId,
      dismissedByFilter: 0,
      dismissedByRule: {},
      dismissedAsDuplicate: 0,
    };

    // Phase 1: Pre-filter attachments (check rules, duplicates, existing)
    const { toProcess, diagnostics } = await this.preFilterAttachments(
      emailId,
      email,
      attachments,
      result
    );

    result._diagnostics.skippedNonFile = diagnostics.skippedNonFile;
    result._diagnostics.dismissedByFilter = diagnostics.dismissedByFilter;
    result._diagnostics.skippedAlreadyExist = diagnostics.skippedAlreadyExist;
    result._diagnostics.dismissedAsDuplicate = diagnostics.dismissedAsDuplicate;

    if (toProcess.length === 0) {
      logger.info('syncAllAttachments: No attachments to process', { emailId });
      return result;
    }

    logger.info('syncAllAttachments: Processing attachments in parallel', {
      emailId,
      toProcess: toProcess.length,
      downloadConcurrency: DOWNLOAD_CONCURRENCY,
      uploadConcurrency: UPLOAD_CONCURRENCY,
    });

    // Phase 2: Parallel download with concurrency limit
    const downloadLimit = pLimit(DOWNLOAD_CONCURRENCY);
    const downloadResults = await Promise.allSettled(
      toProcess.map((item) =>
        downloadLimit(async () => {
          const content = await this.downloadAttachmentFromGraph(
            email.graphMessageId,
            item.attachment.id!,
            accessToken
          );
          return { attachment: item.attachment, existingRecord: item.existingRecord, content };
        })
      )
    );

    // Separate successful downloads from failures
    const successfulDownloads: Array<{
      attachment: Attachment;
      existingRecord: any | null;
      content: AttachmentDownloadResult;
    }> = [];

    for (let i = 0; i < downloadResults.length; i++) {
      const downloadResult = downloadResults[i];
      if (downloadResult.status === 'fulfilled') {
        successfulDownloads.push(downloadResult.value);
      } else {
        const attachment = toProcess[i].attachment;
        const errorMessage = downloadResult.reason?.message || 'Download failed';
        logger.error('Failed to download attachment', {
          emailId,
          attachmentName: attachment.name,
          error: errorMessage,
        });
        result.errors.push(`Failed to download ${attachment.name}: ${errorMessage}`);
      }
    }

    // Phase 3: Parallel upload with concurrency limit
    const uploadLimit = pLimit(UPLOAD_CONCURRENCY);
    const uploadResults = await Promise.allSettled(
      successfulDownloads.map((item) =>
        uploadLimit(async () =>
          this.uploadAndRecordAttachment(
            email,
            item.attachment,
            item.content,
            item.existingRecord,
            accessToken
          )
        )
      )
    );

    // Process upload results
    for (let i = 0; i < uploadResults.length; i++) {
      const uploadResult = uploadResults[i];
      if (uploadResult.status === 'fulfilled') {
        result.attachments.push(uploadResult.value);
        result.attachmentsSynced++;
      } else {
        const item = successfulDownloads[i];
        const errorMessage = uploadResult.reason?.message || 'Upload failed';
        logger.error('Failed to upload attachment', {
          emailId,
          attachmentName: item.attachment.name,
          error: errorMessage,
        });
        result.errors.push(`Failed to upload ${item.attachment.name}: ${errorMessage}`);
      }
    }

    result.success = result.errors.length === 0;

    logger.info('syncAllAttachments: Parallel sync complete', {
      emailId,
      attachmentsSynced: result.attachmentsSynced,
      errors: result.errors.length,
      downloadSuccesses: successfulDownloads.length,
      downloadFailures: toProcess.length - successfulDownloads.length,
    });

    // Invalidate case briefing cache when documents are linked
    if (email.caseId && result.attachmentsSynced > 0) {
      caseBriefingService.invalidate(email.caseId).catch(() => {});
    }

    return result;
  }

  /**
   * Sync all attachments for a classified email using app-only client.
   * This variant is for background workers that use client credentials flow.
   *
   * Uses /users/{azureAdId}/messages/... endpoints instead of /me/messages/...
   *
   * @param emailId - Database email ID
   * @param graphClient - Pre-authenticated Graph client (app-only)
   * @param azureAdId - Azure AD user ID for the mailbox owner
   * @returns Sync result with all attachments
   */
  async syncAllAttachmentsWithClient(
    emailId: string,
    graphClient: Client,
    azureAdId: string
  ): Promise<AttachmentSyncResult> {
    const result: AttachmentSyncResult = {
      success: true,
      attachmentsSynced: 0,
      attachments: [],
      errors: [],
    };

    // Get email with case and client info
    const email = await this.prisma.email.findUnique({
      where: { id: emailId },
      include: {
        case: {
          select: { id: true, caseNumber: true, clientId: true, firmId: true },
        },
        client: {
          select: { id: true, name: true },
        },
      },
    });

    if (!email) {
      logger.warn('syncAllAttachmentsWithClient: Email not found', { emailId });
      return result;
    }

    if (!email.hasAttachments) {
      return result;
    }

    if (!email.caseId && !email.clientId) {
      logger.info('syncAllAttachmentsWithClient: Email not classified, skipping', { emailId });
      return result;
    }

    logger.info('syncAllAttachmentsWithClient: Starting parallel sync with app client', {
      emailId,
      caseId: email.caseId,
      clientId: email.clientId,
      azureAdId,
    });

    // Get attachments from Graph API using /users/{azureAdId}/messages/...
    const attachments = await this.listAttachmentsFromGraphWithClient(
      graphClient,
      azureAdId,
      email.graphMessageId
    );

    // Initialize diagnostics
    result._diagnostics = {
      graphMessageId: email.graphMessageId,
      attachmentsFromGraph: attachments.length,
      skippedNonFile: 0,
      skippedAlreadyExist: 0,
      emailCaseId: email.caseId,
      emailClientId: email.clientId,
      dismissedByFilter: 0,
      dismissedByRule: {},
      dismissedAsDuplicate: 0,
    };

    // Phase 1: Pre-filter attachments (check rules, duplicates, existing)
    const { toProcess, diagnostics } = await this.preFilterAttachments(
      emailId,
      email,
      attachments,
      result
    );

    result._diagnostics.skippedNonFile = diagnostics.skippedNonFile;
    result._diagnostics.dismissedByFilter = diagnostics.dismissedByFilter;
    result._diagnostics.skippedAlreadyExist = diagnostics.skippedAlreadyExist;
    result._diagnostics.dismissedAsDuplicate = diagnostics.dismissedAsDuplicate;

    if (toProcess.length === 0) {
      logger.info('syncAllAttachmentsWithClient: No attachments to process', { emailId });
      return result;
    }

    logger.info('syncAllAttachmentsWithClient: Processing attachments in parallel', {
      emailId,
      toProcess: toProcess.length,
    });

    // Phase 2: Parallel download with concurrency limit
    const downloadLimit = pLimit(DOWNLOAD_CONCURRENCY);
    const downloadResults = await Promise.allSettled(
      toProcess.map((item) =>
        downloadLimit(async () => {
          const content = await this.downloadAttachmentFromGraphWithClient(
            graphClient,
            azureAdId,
            email.graphMessageId,
            item.attachment.id!
          );
          return { attachment: item.attachment, existingRecord: item.existingRecord, content };
        })
      )
    );

    // Separate successful downloads from failures
    const successfulDownloads: Array<{
      attachment: Attachment;
      existingRecord: any | null;
      content: AttachmentDownloadResult;
    }> = [];

    for (let i = 0; i < downloadResults.length; i++) {
      const downloadResult = downloadResults[i];
      if (downloadResult.status === 'fulfilled') {
        successfulDownloads.push(downloadResult.value);
      } else {
        const attachment = toProcess[i].attachment;
        const errorMessage = downloadResult.reason?.message || 'Download failed';
        logger.error('Failed to download attachment (app client)', {
          emailId,
          attachmentName: attachment.name,
          error: errorMessage,
        });
        result.errors.push(`Failed to download ${attachment.name}: ${errorMessage}`);
      }
    }

    // Phase 3: Parallel upload with concurrency limit
    // Note: uploadAndRecordAttachment uses SharePoint service which has its own auth
    const uploadLimit = pLimit(UPLOAD_CONCURRENCY);
    const uploadResults = await Promise.allSettled(
      successfulDownloads.map((item) =>
        uploadLimit(async () =>
          this.uploadAndRecordAttachmentWithClient(
            email,
            item.attachment,
            item.content,
            item.existingRecord,
            graphClient,
            azureAdId
          )
        )
      )
    );

    // Process upload results
    for (let i = 0; i < uploadResults.length; i++) {
      const uploadResult = uploadResults[i];
      if (uploadResult.status === 'fulfilled') {
        result.attachments.push(uploadResult.value);
        result.attachmentsSynced++;
      } else {
        const item = successfulDownloads[i];
        const errorMessage = uploadResult.reason?.message || 'Upload failed';
        logger.error('Failed to upload attachment (app client)', {
          emailId,
          attachmentName: item.attachment.name,
          error: errorMessage,
        });
        result.errors.push(`Failed to upload ${item.attachment.name}: ${errorMessage}`);
      }
    }

    result.success = result.errors.length === 0;

    logger.info('syncAllAttachmentsWithClient: Parallel sync complete', {
      emailId,
      attachmentsSynced: result.attachmentsSynced,
      errors: result.errors.length,
    });

    // Invalidate case briefing cache when documents are linked
    if (email.caseId && result.attachmentsSynced > 0) {
      caseBriefingService.invalidate(email.caseId).catch(() => {});
    }

    return result;
  }

  /**
   * Sync attachment metadata only (no content download or OneDrive upload).
   * Used for unclassified emails to show attachment buttons in UI.
   * Content is fetched on-demand from Graph API when user clicks attachment.
   *
   * @param emailId - Database email ID
   * @param accessToken - User's OAuth access token
   * @returns Number of attachments synced
   */
  async syncAttachmentMetadataOnly(
    emailId: string,
    accessToken: string
  ): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const result = { synced: 0, skipped: 0, errors: [] as string[] };

    // Get email
    const email = await this.prisma.email.findUnique({
      where: { id: emailId },
    });

    if (!email) {
      logger.warn('syncAttachmentMetadataOnly: Email not found', { emailId });
      return result;
    }

    if (!email.hasAttachments) {
      return result;
    }

    logger.info('syncAttachmentMetadataOnly: Starting metadata sync', {
      emailId,
      graphMessageId: email.graphMessageId,
    });

    try {
      // Get attachments list from Graph API
      const attachments = await this.listAttachmentsFromGraph(email.graphMessageId, accessToken);

      for (const attachment of attachments) {
        try {
          // Skip non-file attachments
          if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') {
            result.skipped++;
            continue;
          }

          // Check if already exists
          const existing = await this.prisma.emailAttachment.findFirst({
            where: {
              emailId,
              graphAttachmentId: attachment.id!,
            },
          });

          if (existing) {
            result.skipped++;
            continue;
          }

          // Evaluate filter rules
          const fileAttachment = attachment as FileAttachment;
          const filterResult = documentFilterService.evaluate({
            name: attachment.name || 'unknown',
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || 0,
            isInline: (fileAttachment as any).isInline,
          });

          // Create metadata-only record (no content or OneDrive upload)
          await this.prisma.emailAttachment.create({
            data: {
              emailId,
              graphAttachmentId: attachment.id!,
              name: attachment.name || 'unknown',
              contentType: attachment.contentType || 'application/octet-stream',
              size: attachment.size || 0,
              storageUrl: null, // No storage - content fetched on-demand from Graph
              documentId: null,
              filterStatus:
                filterResult.action === 'dismiss' ? ('dismissed' as FilterStatus) : null,
              filterRuleId: filterResult.matchedRule?.id || null,
              filterReason: filterResult.reason || null,
              dismissedAt: filterResult.action === 'dismiss' ? new Date() : null,
              isPrivate: email.isPrivate,
            },
          });

          result.synced++;
        } catch (attachmentError) {
          const errMsg =
            attachmentError instanceof Error ? attachmentError.message : String(attachmentError);
          result.errors.push(`${attachment.name}: ${errMsg}`);
          logger.error('syncAttachmentMetadataOnly: Failed to sync attachment', {
            emailId,
            attachmentName: attachment.name,
            error: errMsg,
          });
        }
      }

      logger.info('syncAttachmentMetadataOnly: Complete', {
        emailId,
        synced: result.synced,
        skipped: result.skipped,
        errors: result.errors.length,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(errMsg);
      logger.error('syncAttachmentMetadataOnly: Failed to list attachments', {
        emailId,
        error: errMsg,
      });
    }

    return result;
  }

  /**
   * Get download URL for an attachment (SharePoint only)
   */
  async getAttachmentDownloadUrl(
    attachmentId: string,
    accessToken: string
  ): Promise<{ url: string; expiresAt: Date }> {
    const attachment = await this.prisma.emailAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new Error(`Attachment not found: ${attachmentId}`);
    }

    if (!attachment.storageUrl) {
      throw new Error(`Attachment has no storage URL: ${attachmentId}`);
    }

    // Handle SharePoint URLs
    if (attachment.storageUrl.startsWith('sharepoint://')) {
      const sharePointId = attachment.storageUrl.replace('sharepoint://', '');
      const link = await this.oneDrive.getDocumentDownloadLink(accessToken, sharePointId);
      return {
        url: link.url,
        expiresAt: new Date(link.expirationDateTime),
      };
    }

    // Handle legacy OneDrive URLs
    if (attachment.storageUrl.startsWith('onedrive://')) {
      const oneDriveId = attachment.storageUrl.replace('onedrive://', '');
      const link = await this.oneDrive.getDocumentDownloadLink(accessToken, oneDriveId);
      return {
        url: link.url,
        expiresAt: new Date(link.expirationDateTime),
      };
    }

    throw new Error(`Unknown storage URL format: ${attachment.storageUrl}`);
  }

  /**
   * Get attachment content directly from MS Graph (for download without storage)
   */
  async getAttachmentContentFromGraph(
    graphMessageId: string,
    graphAttachmentId: string,
    accessToken: string
  ): Promise<Buffer> {
    const result = await this.downloadAttachmentFromGraph(
      graphMessageId,
      graphAttachmentId,
      accessToken
    );
    return result.content;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Pre-filter attachments: check filter rules, duplicates, existing records
   * Returns list of attachments that need full processing (download + upload)
   */
  private async preFilterAttachments(
    emailId: string,
    email: {
      id: string;
      graphMessageId: string;
      caseId: string | null;
      clientId: string | null;
      isPrivate: boolean;
    },
    attachments: Attachment[],
    result: AttachmentSyncResult
  ): Promise<{
    toProcess: Array<{ attachment: Attachment; existingRecord: any | null }>;
    diagnostics: {
      skippedNonFile: number;
      dismissedByFilter: number;
      skippedAlreadyExist: number;
      dismissedAsDuplicate: number;
    };
  }> {
    const toProcess: Array<{ attachment: Attachment; existingRecord: any | null }> = [];
    let skippedNonFile = 0;
    let dismissedByFilter = 0;
    let skippedAlreadyExist = 0;
    let dismissedAsDuplicate = 0;

    for (const attachment of attachments) {
      // Skip non-file attachments (item attachments, reference attachments)
      if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') {
        skippedNonFile++;
        continue;
      }

      // Evaluate against filter rules
      const fileAttachment = attachment as FileAttachment;
      const filterResult = documentFilterService.evaluate({
        name: attachment.name || 'unknown',
        contentType: attachment.contentType || 'application/octet-stream',
        size: attachment.size || 0,
        isInline: (fileAttachment as any).isInline,
      });

      if (filterResult.action === 'dismiss') {
        await this.prisma.emailAttachment.create({
          data: {
            emailId,
            graphAttachmentId: attachment.id!,
            name: attachment.name || 'unknown',
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || 0,
            storageUrl: null,
            documentId: null,
            filterStatus: 'dismissed' as FilterStatus,
            filterRuleId: filterResult.matchedRule?.id || null,
            filterReason: filterResult.reason,
            dismissedAt: new Date(),
            isPrivate: email.isPrivate,
          },
        });
        dismissedByFilter++;
        continue;
      }

      // Check if already synced
      const existing = await this.prisma.emailAttachment.findFirst({
        where: { emailId, graphAttachmentId: attachment.id! },
      });

      if (existing) {
        if (existing.filterStatus === 'dismissed') {
          dismissedByFilter++;
          continue;
        }

        // Check if fully synced (has storageUrl and documentId)
        if (existing.storageUrl && existing.documentId) {
          skippedAlreadyExist++;
          result.attachments.push({
            id: existing.id,
            emailId,
            graphAttachmentId: attachment.id!,
            name: existing.name,
            contentType: existing.contentType,
            size: existing.size,
            storageUrl: existing.storageUrl,
            documentId: existing.documentId,
          });
          continue;
        }
      }

      // Check for same-case/client duplicates
      const duplicateQuery = email.caseId
        ? {
            name: attachment.name || 'unknown',
            size: attachment.size || 0,
            filterStatus: { not: 'dismissed' as FilterStatus },
            email: { caseId: email.caseId, id: { not: emailId } },
          }
        : {
            name: attachment.name || 'unknown',
            size: attachment.size || 0,
            filterStatus: { not: 'dismissed' as FilterStatus },
            email: { clientId: email.clientId, id: { not: emailId } },
          };

      const duplicateInCase = await this.prisma.emailAttachment.findFirst({
        where: duplicateQuery,
        select: { id: true },
      });

      if (duplicateInCase) {
        await this.prisma.emailAttachment.create({
          data: {
            emailId,
            graphAttachmentId: attachment.id!,
            name: attachment.name || 'unknown',
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || 0,
            storageUrl: null,
            documentId: null,
            filterStatus: 'dismissed' as FilterStatus,
            filterRuleId: 'same-case-duplicate',
            filterReason: `Duplicate: same name and size exists (attachment ${duplicateInCase.id})`,
            dismissedAt: new Date(),
            isPrivate: email.isPrivate,
          },
        });
        dismissedAsDuplicate++;
        dismissedByFilter++;
        continue;
      }

      // Needs processing
      toProcess.push({ attachment, existingRecord: existing });
    }

    return {
      toProcess,
      diagnostics: {
        skippedNonFile,
        dismissedByFilter,
        skippedAlreadyExist,
        dismissedAsDuplicate,
      },
    };
  }

  /**
   * Upload attachment content and create/update database record
   */
  private async uploadAndRecordAttachment(
    email: {
      id: string;
      userId: string;
      receivedDateTime: Date;
      isPrivate: boolean;
      caseId: string | null;
      clientId: string | null;
      case: { id: string; caseNumber: string; clientId: string; firmId: string } | null;
      client: { id: string; name: string } | null;
      firmId: string;
    },
    attachment: Attachment,
    content: AttachmentDownloadResult,
    existingRecord: any | null,
    accessToken: string
  ): Promise<SyncedAttachment> {
    // Store in OneDrive/SharePoint
    let storageResult: { storageUrl: string; documentId?: string };

    if (email.caseId && email.case) {
      storageResult = await this.storeInOneDrive(
        content,
        email.case.id,
        email.case.caseNumber,
        email.case.clientId,
        email.case.firmId,
        email.userId,
        email.receivedDateTime,
        accessToken,
        email.isPrivate
      );
    } else if (email.clientId && email.client) {
      storageResult = await this.storeInClientOneDrive(
        content,
        email.clientId,
        email.client.name,
        email.firmId,
        email.userId,
        email.receivedDateTime,
        accessToken,
        email.isPrivate
      );
    } else {
      throw new Error('Email has no case or client for storage');
    }

    // Create or update EmailAttachment record
    let emailAttachment;
    if (existingRecord) {
      emailAttachment = await this.prisma.emailAttachment.update({
        where: { id: existingRecord.id },
        data: {
          storageUrl: storageResult.storageUrl,
          documentId: storageResult.documentId,
          filterStatus: 'imported' as FilterStatus,
        },
      });
    } else {
      emailAttachment = await this.prisma.emailAttachment.create({
        data: {
          emailId: email.id,
          graphAttachmentId: attachment.id!,
          name: content.name,
          contentType: content.contentType,
          size: content.size,
          storageUrl: storageResult.storageUrl,
          documentId: storageResult.documentId,
          filterStatus: 'imported' as FilterStatus,
          isPrivate: email.isPrivate,
        },
      });
    }

    logger.info('Attachment synced', {
      emailId: email.id,
      attachmentId: emailAttachment.id,
      name: content.name,
      documentId: storageResult.documentId,
    });

    return {
      id: emailAttachment.id,
      emailId: email.id,
      graphAttachmentId: attachment.id!,
      name: content.name,
      contentType: content.contentType,
      size: content.size,
      storageUrl: storageResult.storageUrl,
      documentId: storageResult.documentId,
    };
  }

  /**
   * Download attachment content from Graph API
   */
  private async downloadAttachmentFromGraph(
    graphMessageId: string,
    graphAttachmentId: string,
    accessToken: string
  ): Promise<AttachmentDownloadResult> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          const attachment = (await client
            .api(`/me/messages/${graphMessageId}/attachments/${graphAttachmentId}`)
            .get()) as FileAttachment;

          if (!attachment.contentBytes) {
            throw new Error('Attachment has no content');
          }

          const content = Buffer.from(attachment.contentBytes, 'base64');

          return {
            content,
            name: attachment.name || 'attachment',
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || content.length,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'email-attachment-download'
    );
  }

  /**
   * List attachments for an email from Graph API
   */
  private async listAttachmentsFromGraph(
    graphMessageId: string,
    accessToken: string
  ): Promise<Attachment[]> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          const response = await client
            .api(`/me/messages/${graphMessageId}/attachments`)
            .select('id,name,contentType,size,isInline')
            .get();

          return response.value || [];
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'email-attachment-list'
    );
  }

  /**
   * List attachments using app-only client (for background workers)
   * Uses /users/{azureAdId}/messages/... instead of /me/messages/...
   */
  private async listAttachmentsFromGraphWithClient(
    client: Client,
    azureAdId: string,
    graphMessageId: string
  ): Promise<Attachment[]> {
    return retryWithBackoff(
      async () => {
        try {
          const response = await client
            .api(`/users/${azureAdId}/messages/${graphMessageId}/attachments`)
            .select('id,name,contentType,size,isInline')
            .get();

          return response.value || [];
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'email-attachment-list-app'
    );
  }

  /**
   * Download attachment using app-only client (for background workers)
   * Uses /users/{azureAdId}/messages/... instead of /me/messages/...
   */
  private async downloadAttachmentFromGraphWithClient(
    client: Client,
    azureAdId: string,
    graphMessageId: string,
    graphAttachmentId: string
  ): Promise<AttachmentDownloadResult> {
    return retryWithBackoff(
      async () => {
        try {
          const attachment = (await client
            .api(`/users/${azureAdId}/messages/${graphMessageId}/attachments/${graphAttachmentId}`)
            .get()) as FileAttachment;

          if (!attachment.contentBytes) {
            throw new Error('Attachment has no content');
          }

          const content = Buffer.from(attachment.contentBytes, 'base64');

          return {
            content,
            name: attachment.name || 'attachment',
            contentType: attachment.contentType || 'application/octet-stream',
            size: attachment.size || content.length,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'email-attachment-download-app'
    );
  }

  /**
   * Upload and record attachment using app-only client
   *
   * Performs full upload to SharePoint using app-only tokens (client credentials flow).
   * This allows background workers to upload attachments without requiring user sessions.
   */
  private async uploadAndRecordAttachmentWithClient(
    email: any,
    attachment: Attachment,
    content: AttachmentDownloadResult,
    existingRecord: any | null,
    graphClient: Client,
    _azureAdId: string
  ): Promise<SyncedAttachment> {
    // If we already have a record with storage, return it
    if (existingRecord?.storageUrl) {
      return {
        id: existingRecord.id,
        emailId: email.id,
        graphAttachmentId: attachment.id!,
        name: content.name,
        contentType: content.contentType,
        size: content.size,
        storageUrl: existingRecord.storageUrl,
        documentId: existingRecord.documentId,
      };
    }

    // Upload to SharePoint using app-only client
    let storageResult: { storageUrl: string; documentId?: string };

    if (email.caseId && email.case) {
      storageResult = await this.storeInOneDriveWithClient(
        graphClient,
        content,
        email.case.id,
        email.case.caseNumber,
        email.case.clientId,
        email.case.firmId,
        email.userId,
        email.receivedDateTime,
        email.isPrivate
      );
    } else if (email.clientId && email.client) {
      storageResult = await this.storeInClientOneDriveWithClient(
        graphClient,
        content,
        email.clientId,
        email.client.name,
        email.firmId,
        email.userId,
        email.receivedDateTime,
        email.isPrivate
      );
    } else {
      throw new Error('Email has no case or client for storage');
    }

    // Create or update EmailAttachment record with full storage info
    let emailAttachment;
    if (existingRecord) {
      emailAttachment = await this.prisma.emailAttachment.update({
        where: { id: existingRecord.id },
        data: {
          storageUrl: storageResult.storageUrl,
          documentId: storageResult.documentId,
          filterStatus: 'imported' as FilterStatus,
        },
      });
    } else {
      emailAttachment = await this.prisma.emailAttachment.create({
        data: {
          emailId: email.id,
          graphAttachmentId: attachment.id!,
          name: content.name,
          contentType: content.contentType,
          size: content.size,
          storageUrl: storageResult.storageUrl,
          documentId: storageResult.documentId,
          filterStatus: 'imported' as FilterStatus,
          isPrivate: email.isPrivate,
        },
      });
    }

    logger.info('Attachment uploaded and recorded (app client)', {
      emailId: email.id,
      attachmentId: emailAttachment.id,
      name: content.name,
      documentId: storageResult.documentId,
    });

    return {
      id: emailAttachment.id,
      emailId: email.id,
      graphAttachmentId: attachment.id!,
      name: content.name,
      contentType: content.contentType,
      size: content.size,
      storageUrl: storageResult.storageUrl,
      documentId: storageResult.documentId,
    };
  }

  /**
   * Store attachment in OneDrive case folder
   */
  private async storeInOneDrive(
    attachment: AttachmentDownloadResult,
    caseId: string,
    caseNumber: string,
    clientId: string,
    firmId: string,
    userId: string,
    emailDate: Date,
    accessToken: string,
    isPrivate: boolean
  ): Promise<{ storageUrl: string; documentId?: string }> {
    // Check for existing document with same name + size (prevents duplicates)
    const existingDoc = await this.prisma.document.findFirst({
      where: {
        fileName: attachment.name,
        fileSize: attachment.size,
        caseLinks: {
          some: { caseId },
        },
      },
      select: { id: true, sharePointItemId: true },
    });

    if (existingDoc) {
      logger.info('Skipping duplicate document - same name+size already exists in case', {
        caseId,
        fileName: attachment.name,
        existingDocumentId: existingDoc.id,
      });
      return {
        storageUrl: existingDoc.sharePointItemId
          ? `sharepoint://${existingDoc.sharePointItemId}`
          : '',
        documentId: existingDoc.id,
      };
    }

    // Create folder structure: /Cases/{CaseNumber}/Emails/{Year-Month}/
    const yearMonth = `${emailDate.getFullYear()}-${String(emailDate.getMonth() + 1).padStart(2, '0')}`;

    const caseFolders = await this.oneDrive.createCaseFolderStructure(
      accessToken,
      caseId,
      caseNumber
    );

    const client = createGraphClient(accessToken);
    const emailsFolder = await this.createOrGetFolder(
      client,
      caseFolders.caseFolder.id,
      ONEDRIVE_EMAIL_FOLDER
    );
    await this.createOrGetFolder(client, emailsFolder.id!, yearMonth);

    // Upload file
    const uploadResult = await this.oneDrive.uploadDocumentToOneDrive(
      accessToken,
      attachment.content,
      {
        caseId,
        caseNumber,
        fileName: attachment.name,
        fileType: attachment.contentType,
        fileSize: attachment.size,
        description: 'Email attachment',
      }
    );

    // Create Document record
    const document = await this.prisma.document.create({
      data: {
        clientId,
        firmId,
        fileName: attachment.name,
        fileType: attachment.contentType,
        fileSize: attachment.size,
        storagePath: uploadResult.parentPath + '/' + attachment.name,
        uploadedBy: userId,
        uploadedAt: emailDate,
        sharePointItemId: uploadResult.id,
        sharePointPath: uploadResult.webUrl,
        oneDriveId: null,
        oneDrivePath: null,
        status: DocumentStatus.DRAFT,
        sourceType: 'EMAIL_ATTACHMENT',
        isPrivate,
        metadata: {
          source: 'email_attachment',
          category: 'Email Attachment',
        },
      },
    });

    // Link document to case
    await this.prisma.caseDocument.create({
      data: {
        caseId,
        documentId: document.id,
        linkedBy: userId,
        firmId,
        isOriginal: true,
      },
    });

    logger.info('Document created from email attachment', {
      documentId: document.id,
      caseId,
      fileName: attachment.name,
    });

    return {
      storageUrl: `sharepoint://${uploadResult.id}`,
      documentId: document.id,
    };
  }

  /**
   * Store attachment in OneDrive client folder (for ClientInbox emails)
   */
  private async storeInClientOneDrive(
    attachment: AttachmentDownloadResult,
    clientId: string,
    clientName: string,
    firmId: string,
    userId: string,
    emailDate: Date,
    accessToken: string,
    isPrivate: boolean
  ): Promise<{ storageUrl: string; documentId?: string }> {
    // Check for existing document with same name + size
    const existingDoc = await this.prisma.document.findFirst({
      where: {
        clientId,
        fileName: attachment.name,
        fileSize: attachment.size,
      },
      select: { id: true, sharePointItemId: true },
    });

    if (existingDoc) {
      logger.info('Skipping duplicate document - same name+size already exists for client', {
        clientId,
        fileName: attachment.name,
        existingDocumentId: existingDoc.id,
      });
      return {
        storageUrl: existingDoc.sharePointItemId
          ? `sharepoint://${existingDoc.sharePointItemId}`
          : '',
        documentId: existingDoc.id,
      };
    }

    // Create folder structure: /Clients/{ClientName}/Emails/{Year-Month}/
    const yearMonth = `${emailDate.getFullYear()}-${String(emailDate.getMonth() + 1).padStart(2, '0')}`;

    const clientFolders = await this.oneDrive.createClientFolderStructure(
      accessToken,
      clientId,
      clientName
    );

    const client = createGraphClient(accessToken);
    const monthFolder = await this.createOrGetFolder(
      client,
      clientFolders.emailsFolder.id,
      yearMonth
    );

    // Upload file
    const siteId = process.env.SHAREPOINT_SITE_ID;
    if (!siteId) {
      throw new Error('SHAREPOINT_SITE_ID not configured');
    }

    const sanitizedFileName = attachment.name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255);

    const uploadEndpoint = `/sites/${siteId}/drive/items/${monthFolder.id}:/${sanitizedFileName}:/content`;

    const uploadResult = await client
      .api(uploadEndpoint)
      .header('Content-Type', attachment.contentType)
      .put(attachment.content);

    // Create Document record
    const document = await this.prisma.document.create({
      data: {
        clientId,
        firmId,
        fileName: attachment.name,
        fileType: attachment.contentType,
        fileSize: attachment.size,
        storagePath: `${clientFolders.emailsFolder.path}/${yearMonth}/${sanitizedFileName}`,
        uploadedBy: userId,
        uploadedAt: emailDate,
        sharePointItemId: uploadResult.id,
        sharePointPath: uploadResult.webUrl,
        oneDriveId: null,
        oneDrivePath: null,
        status: DocumentStatus.DRAFT,
        sourceType: 'EMAIL_ATTACHMENT',
        isPrivate,
        metadata: {
          source: 'email_attachment',
          category: 'Email Attachment',
          fromClientInbox: true,
        },
      },
    });

    // Create CaseDocument junction (client-level, no case)
    await this.prisma.caseDocument.create({
      data: {
        caseId: null,
        clientId,
        documentId: document.id,
        linkedBy: userId,
        firmId,
        isOriginal: true,
        promotedFromAttachment: false,
      },
    });

    logger.info('Document created from ClientInbox email attachment', {
      documentId: document.id,
      clientId,
      fileName: attachment.name,
    });

    return {
      storageUrl: `sharepoint://${uploadResult.id}`,
      documentId: document.id,
    };
  }

  // ============================================================================
  // App-Only Client Storage Methods (for background workers)
  // ============================================================================

  /**
   * Store attachment in OneDrive case folder using app-only client
   * For use with app-only tokens in background workers
   */
  private async storeInOneDriveWithClient(
    graphClient: Client,
    attachment: AttachmentDownloadResult,
    caseId: string,
    caseNumber: string,
    clientId: string,
    firmId: string,
    userId: string,
    emailDate: Date,
    isPrivate: boolean
  ): Promise<{ storageUrl: string; documentId?: string }> {
    // Check for existing document with same name + size (prevents duplicates)
    const existingDoc = await this.prisma.document.findFirst({
      where: {
        fileName: attachment.name,
        fileSize: attachment.size,
        caseLinks: {
          some: { caseId },
        },
      },
      select: { id: true, sharePointItemId: true },
    });

    if (existingDoc) {
      logger.info(
        'Skipping duplicate document - same name+size already exists in case (app client)',
        {
          caseId,
          fileName: attachment.name,
          existingDocumentId: existingDoc.id,
        }
      );
      return {
        storageUrl: existingDoc.sharePointItemId
          ? `sharepoint://${existingDoc.sharePointItemId}`
          : '',
        documentId: existingDoc.id,
      };
    }

    // Create folder structure: /Cases/{CaseNumber}/Emails/{Year-Month}/
    const yearMonth = `${emailDate.getFullYear()}-${String(emailDate.getMonth() + 1).padStart(2, '0')}`;

    const caseFolders = await this.oneDrive.createCaseFolderStructureWithClient(
      graphClient,
      caseId,
      caseNumber
    );

    const emailsFolder = await this.createOrGetFolder(
      graphClient,
      caseFolders.caseFolder.id,
      ONEDRIVE_EMAIL_FOLDER
    );
    await this.createOrGetFolder(graphClient, emailsFolder.id!, yearMonth);

    // Upload file using app-only client
    const uploadResult = await this.oneDrive.uploadDocumentToOneDriveWithClient(
      graphClient,
      attachment.content,
      {
        caseId,
        caseNumber,
        fileName: attachment.name,
        fileType: attachment.contentType,
        fileSize: attachment.size,
        description: 'Email attachment',
      }
    );

    // Create Document record
    const document = await this.prisma.document.create({
      data: {
        clientId,
        firmId,
        fileName: attachment.name,
        fileType: attachment.contentType,
        fileSize: attachment.size,
        storagePath: uploadResult.parentPath + '/' + attachment.name,
        uploadedBy: userId,
        uploadedAt: emailDate,
        sharePointItemId: uploadResult.id,
        sharePointPath: uploadResult.webUrl,
        oneDriveId: null,
        oneDrivePath: null,
        status: DocumentStatus.DRAFT,
        sourceType: 'EMAIL_ATTACHMENT',
        isPrivate,
        metadata: {
          source: 'email_attachment',
          category: 'Email Attachment',
        },
      },
    });

    // Link document to case
    await this.prisma.caseDocument.create({
      data: {
        caseId,
        documentId: document.id,
        linkedBy: userId,
        firmId,
        isOriginal: true,
      },
    });

    logger.info('Document created from email attachment (app client)', {
      documentId: document.id,
      caseId,
      fileName: attachment.name,
    });

    return {
      storageUrl: `sharepoint://${uploadResult.id}`,
      documentId: document.id,
    };
  }

  /**
   * Store attachment in OneDrive client folder using app-only client
   * For use with app-only tokens in background workers (ClientInbox emails)
   */
  private async storeInClientOneDriveWithClient(
    graphClient: Client,
    attachment: AttachmentDownloadResult,
    clientId: string,
    clientName: string,
    firmId: string,
    userId: string,
    emailDate: Date,
    isPrivate: boolean
  ): Promise<{ storageUrl: string; documentId?: string }> {
    // Check for existing document with same name + size
    const existingDoc = await this.prisma.document.findFirst({
      where: {
        clientId,
        fileName: attachment.name,
        fileSize: attachment.size,
      },
      select: { id: true, sharePointItemId: true },
    });

    if (existingDoc) {
      logger.info(
        'Skipping duplicate document - same name+size already exists for client (app client)',
        {
          clientId,
          fileName: attachment.name,
          existingDocumentId: existingDoc.id,
        }
      );
      return {
        storageUrl: existingDoc.sharePointItemId
          ? `sharepoint://${existingDoc.sharePointItemId}`
          : '',
        documentId: existingDoc.id,
      };
    }

    // Create folder structure: /Clients/{ClientName}/Emails/{Year-Month}/
    const yearMonth = `${emailDate.getFullYear()}-${String(emailDate.getMonth() + 1).padStart(2, '0')}`;

    const clientFolders = await this.oneDrive.createClientFolderStructureWithClient(
      graphClient,
      clientId,
      clientName
    );

    const monthFolder = await this.createOrGetFolder(
      graphClient,
      clientFolders.emailsFolder.id,
      yearMonth
    );

    // Upload file
    const siteId = process.env.SHAREPOINT_SITE_ID;
    if (!siteId) {
      throw new Error('SHAREPOINT_SITE_ID not configured');
    }

    const sanitizedFileName = attachment.name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 255);

    const uploadEndpoint = `/sites/${siteId}/drive/items/${monthFolder.id}:/${sanitizedFileName}:/content`;

    const uploadResult = await graphClient
      .api(uploadEndpoint)
      .header('Content-Type', attachment.contentType)
      .put(attachment.content);

    // Create Document record
    const document = await this.prisma.document.create({
      data: {
        clientId,
        firmId,
        fileName: attachment.name,
        fileType: attachment.contentType,
        fileSize: attachment.size,
        storagePath: `${clientFolders.emailsFolder.path}/${yearMonth}/${sanitizedFileName}`,
        uploadedBy: userId,
        uploadedAt: emailDate,
        sharePointItemId: uploadResult.id,
        sharePointPath: uploadResult.webUrl,
        oneDriveId: null,
        oneDrivePath: null,
        status: DocumentStatus.DRAFT,
        sourceType: 'EMAIL_ATTACHMENT',
        isPrivate,
        metadata: {
          source: 'email_attachment',
          category: 'Email Attachment',
          fromClientInbox: true,
        },
      },
    });

    // Create CaseDocument junction (client-level, no case)
    await this.prisma.caseDocument.create({
      data: {
        caseId: null,
        clientId,
        documentId: document.id,
        linkedBy: userId,
        firmId,
        isOriginal: true,
        promotedFromAttachment: false,
      },
    });

    logger.info('Document created from ClientInbox email attachment (app client)', {
      documentId: document.id,
      clientId,
      fileName: attachment.name,
    });

    return {
      storageUrl: `sharepoint://${uploadResult.id}`,
      documentId: document.id,
    };
  }

  /**
   * Create or get existing folder in SharePoint site drive
   */
  private async createOrGetFolder(
    client: Client,
    parentId: string,
    folderName: string
  ): Promise<{ id: string }> {
    const siteId = process.env.SHAREPOINT_SITE_ID;
    if (!siteId) {
      throw new Error('SHAREPOINT_SITE_ID not configured');
    }

    try {
      const folder = await client.api(`/sites/${siteId}/drive/items/${parentId}/children`).post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });

      return { id: folder.id };
    } catch (error: any) {
      if (error.statusCode === 409 || error.code === 'nameAlreadyExists') {
        // Escape single quotes for OData filter (e.g., "O'Brien" → "O''Brien")
        const escapedFolderName = folderName.replace(/'/g, "''");
        const children = await client
          .api(`/sites/${siteId}/drive/items/${parentId}/children`)
          .filter(`name eq '${escapedFolderName}'`)
          .get();

        if (children.value && children.value.length > 0) {
          return { id: children.value[0].id };
        }
      }

      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailAttachmentServiceInstance: EmailAttachmentService | null = null;

export function getEmailAttachmentService(prisma: PrismaClient): EmailAttachmentService {
  if (!emailAttachmentServiceInstance) {
    emailAttachmentServiceInstance = new EmailAttachmentService(prisma);
  }
  return emailAttachmentServiceInstance;
}
