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

    // Diagnostic counters
    let skippedNonFile = 0;
    let skippedAlreadyExist = 0;
    let dismissedByFilter = 0;
    const dismissedByRule: Record<string, number> = {};
    let dismissedAsDuplicate = 0;

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
      logger.info('syncAllAttachments: Email has no attachments', { emailId });
      return result;
    }

    // REQUIRE classification - email must have case or client
    if (!email.caseId && !email.clientId) {
      logger.info('syncAllAttachments: Email not classified, skipping attachment sync', {
        emailId,
        classificationState: email.classificationState,
      });
      return result;
    }

    logger.info('syncAllAttachments: Starting sync for classified email', {
      emailId,
      caseId: email.caseId,
      clientId: email.clientId,
      hasCase: !!email.case,
      hasClient: !!email.client,
    });

    // Get attachments list from Graph API
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

    logger.info('Attachments from Graph API', {
      emailId,
      attachmentCount: attachments.length,
    });

    // Sync each attachment
    for (const attachment of attachments) {
      try {
        // Skip non-file attachments (item attachments, reference attachments, etc.)
        if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') {
          logger.info('Skipping non-file attachment', {
            name: attachment.name,
            type: attachment['@odata.type'],
          });
          skippedNonFile++;
          continue;
        }

        // Evaluate against filter rules (junk detection)
        const fileAttachment = attachment as FileAttachment;
        const filterResult = documentFilterService.evaluate({
          name: attachment.name || 'unknown',
          contentType: attachment.contentType || 'application/octet-stream',
          size: attachment.size || 0,
          isInline: (fileAttachment as any).isInline,
        });

        if (filterResult.action === 'dismiss') {
          // Create minimal tracking record (no content download)
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

          logger.info('Attachment dismissed by filter', {
            emailId,
            attachmentName: attachment.name,
            ruleId: filterResult.matchedRule?.id,
          });

          dismissedByFilter++;
          const ruleId = filterResult.matchedRule?.id || 'unknown';
          dismissedByRule[ruleId] = (dismissedByRule[ruleId] || 0) + 1;
          continue;
        }

        // Check if already synced
        const existing = await this.prisma.emailAttachment.findFirst({
          where: {
            emailId,
            graphAttachmentId: attachment.id!,
          },
        });

        if (existing) {
          if (existing.filterStatus === 'dismissed') {
            dismissedByFilter++;
            if (existing.filterRuleId) {
              dismissedByRule[existing.filterRuleId] =
                (dismissedByRule[existing.filterRuleId] || 0) + 1;
            }
            continue;
          }

          logger.info('Attachment already synced', {
            emailId,
            attachmentId: existing.id,
            name: existing.name,
          });
          skippedAlreadyExist++;
          result.attachments.push({
            id: existing.id,
            emailId,
            graphAttachmentId: attachment.id!,
            name: existing.name,
            contentType: existing.contentType,
            size: existing.size,
            storageUrl: existing.storageUrl,
            documentId: existing.documentId || undefined,
          });
          continue;
        }

        // Check for same-case/client duplicates (same name + size)
        const duplicateQuery = email.caseId
          ? {
              name: attachment.name || 'unknown',
              size: attachment.size || 0,
              filterStatus: { not: 'dismissed' as FilterStatus },
              email: {
                caseId: email.caseId,
                id: { not: emailId },
              },
            }
          : {
              name: attachment.name || 'unknown',
              size: attachment.size || 0,
              filterStatus: { not: 'dismissed' as FilterStatus },
              email: {
                clientId: email.clientId,
                id: { not: emailId },
              },
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

          logger.info('Attachment dismissed as duplicate', {
            emailId,
            attachmentName: attachment.name,
            duplicateId: duplicateInCase.id,
          });

          dismissedAsDuplicate++;
          dismissedByFilter++;
          dismissedByRule['same-case-duplicate'] =
            (dismissedByRule['same-case-duplicate'] || 0) + 1;
          continue;
        }

        // Download attachment from Graph API
        const downloadedAttachment = await this.downloadAttachmentFromGraph(
          email.graphMessageId,
          attachment.id!,
          accessToken
        );

        // Store in OneDrive (case folder or client folder)
        let storageResult: { storageUrl: string; documentId?: string };

        if (email.caseId && email.case) {
          storageResult = await this.storeInOneDrive(
            downloadedAttachment,
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
            downloadedAttachment,
            email.clientId,
            email.client.name,
            email.firmId,
            email.userId,
            email.receivedDateTime,
            accessToken,
            email.isPrivate
          );
        } else {
          // This shouldn't happen due to earlier check, but TypeScript needs it
          throw new Error('Email has no case or client');
        }

        // Create EmailAttachment record
        const emailAttachment = await this.prisma.emailAttachment.create({
          data: {
            emailId,
            graphAttachmentId: attachment.id!,
            name: downloadedAttachment.name,
            contentType: downloadedAttachment.contentType,
            size: downloadedAttachment.size,
            storageUrl: storageResult.storageUrl,
            documentId: storageResult.documentId,
            filterStatus: 'imported' as FilterStatus,
            isPrivate: email.isPrivate,
          },
        });

        logger.info('Attachment synced', {
          emailId,
          attachmentId: emailAttachment.id,
          name: downloadedAttachment.name,
          documentId: storageResult.documentId,
        });

        result.attachments.push({
          id: emailAttachment.id,
          emailId,
          graphAttachmentId: attachment.id!,
          name: downloadedAttachment.name,
          contentType: downloadedAttachment.contentType,
          size: downloadedAttachment.size,
          storageUrl: storageResult.storageUrl,
          documentId: storageResult.documentId,
        });
        result.attachmentsSynced++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to sync attachment', {
          emailId,
          attachmentName: attachment.name,
          error: errorMessage,
        });
        result.errors.push(`Failed to sync ${attachment.name}: ${errorMessage}`);
        result.success = false;
      }
    }

    // Update diagnostics
    result._diagnostics!.skippedNonFile = skippedNonFile;
    result._diagnostics!.skippedAlreadyExist = skippedAlreadyExist;
    result._diagnostics!.dismissedByFilter = dismissedByFilter;
    result._diagnostics!.dismissedByRule = dismissedByRule;
    result._diagnostics!.dismissedAsDuplicate = dismissedAsDuplicate;

    logger.info('syncAllAttachments complete', {
      emailId,
      caseId: email.caseId,
      clientId: email.clientId,
      attachmentsSynced: result.attachmentsSynced,
      skippedNonFile,
      skippedAlreadyExist,
      dismissedByFilter,
      errorCount: result.errors.length,
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
        const children = await client
          .api(`/sites/${siteId}/drive/items/${parentId}/children`)
          .filter(`name eq '${folderName}'`)
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
