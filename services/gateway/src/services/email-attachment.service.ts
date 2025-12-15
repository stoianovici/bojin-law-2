// @ts-nocheck
/**
 * Email Attachment Service
 * Story 5.1: Email Integration and Synchronization
 *
 * Handles syncing and storing email attachments from Microsoft Graph API.
 * Stores attachments to OneDrive for case-assigned emails, R2 for others.
 *
 * [Source: docs/architecture/external-apis.md#document-storage-architecture]
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { Attachment, FileAttachment } from '@microsoft/microsoft-graph-types';
import { PrismaClient, DocumentStatus } from '@prisma/client';
import { createGraphClient, graphEndpoints } from '../config/graph.config';
import { OneDriveService, oneDriveService } from './onedrive.service';
import { R2StorageService, r2StorageService } from './r2-storage.service';
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
  storageUrl: string | null; // null when storage (R2/OneDrive) is not configured
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

// Large attachment threshold (100MB) - store in R2 instead of OneDrive
const LARGE_ATTACHMENT_THRESHOLD = 100 * 1024 * 1024;

// Storage path patterns
const R2_EMAIL_ATTACHMENTS_PATH = 'email-attachments';
const ONEDRIVE_EMAIL_FOLDER = 'Emails';

// ============================================================================
// Email Attachment Service
// ============================================================================

export class EmailAttachmentService {
  private prisma: PrismaClient;
  private oneDrive: OneDriveService;
  private r2Storage: R2StorageService;

  constructor(
    prisma: PrismaClient,
    oneDrive?: OneDriveService,
    r2Storage?: R2StorageService
  ) {
    this.prisma = prisma;
    this.oneDrive = oneDrive || oneDriveService;
    this.r2Storage = r2Storage || r2StorageService;
  }

  /**
   * Sync attachment from Graph API to storage (AC: 4)
   *
   * Downloads attachment content from Graph API and stores it based on:
   * - Case-assigned email: OneDrive case folder
   * - Uncategorized email: R2 temporary storage
   * - Large files (>100MB): Always R2
   *
   * @param emailId - Database email ID
   * @param graphAttachmentId - Graph API attachment ID
   * @param accessToken - User's OAuth access token
   * @returns Synced attachment info
   */
  async syncAttachment(
    emailId: string,
    graphAttachmentId: string,
    accessToken: string
  ): Promise<SyncedAttachment> {
    // Get email with case info (including clientId for Document creation)
    const email = await this.prisma.email.findUnique({
      where: { id: emailId },
      include: {
        case: {
          select: { id: true, caseNumber: true, clientId: true, firmId: true },
        },
      },
    });

    if (!email) {
      throw new Error(`Email not found: ${emailId}`);
    }

    // Download attachment from Graph API
    const attachment = await this.downloadAttachmentFromGraph(
      email.graphMessageId,
      graphAttachmentId,
      accessToken
    );

    // Determine storage location and store
    let storageUrl: string | null = null;
    let documentId: string | undefined;

    const shouldUseR2 =
      !email.caseId ||
      attachment.size > LARGE_ATTACHMENT_THRESHOLD ||
      !this.oneDrive;

    if (shouldUseR2) {
      // Store in R2 (uncategorized, large files, or OneDrive unavailable)
      // Check if R2 is configured first
      if (this.r2Storage.isConfigured()) {
        storageUrl = await this.storeInR2(
          attachment,
          email.id,
          email.userId
        );
      } else {
        // R2 not configured - save metadata only (for local dev)
        logger.warn('R2 not configured - saving attachment metadata only', {
          emailId,
          attachmentName: attachment.name,
        });
        storageUrl = null;
      }
    } else {
      // Store in OneDrive case folder
      const result = await this.storeInOneDrive(
        attachment,
        email.case!.id,
        email.case!.caseNumber,
        email.case!.clientId,
        email.case!.firmId,
        email.userId,
        email.receivedDateTime,
        accessToken
      );
      storageUrl = result.storageUrl;
      documentId = result.documentId;
    }

    // Create EmailAttachment record
    const emailAttachment = await this.prisma.emailAttachment.create({
      data: {
        emailId,
        graphAttachmentId,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        storageUrl,
        documentId,
      },
    });

    logger.info('Attachment synced', {
      emailId,
      attachmentId: emailAttachment.id,
      name: attachment.name,
      size: attachment.size,
      storage: shouldUseR2 ? 'R2' : 'OneDrive',
    });

    return {
      id: emailAttachment.id,
      emailId,
      graphAttachmentId,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      storageUrl,
      documentId,
    };
  }

  /**
   * Sync all attachments for an email
   *
   * @param emailId - Database email ID
   * @param accessToken - User's OAuth access token
   * @returns Sync result with all attachments
   */
  async syncAllAttachments(
    emailId: string,
    accessToken: string
  ): Promise<AttachmentSyncResult> {
    const result: AttachmentSyncResult = {
      success: true,
      attachmentsSynced: 0,
      attachments: [],
      errors: [],
    };

    // Diagnostic counters
    let skippedNonFile = 0;
    let skippedAlreadyExist = 0;
    let upgradedWithDocument = 0;

    // Get email
    const email = await this.prisma.email.findUnique({
      where: { id: emailId },
    });

    if (!email || !email.hasAttachments) {
      logger.info('syncAllAttachments: No email or no attachments flag', {
        emailId,
        emailFound: !!email,
        hasAttachments: email?.hasAttachments,
      });
      return result;
    }

    // Get attachments list from Graph API
    const attachments = await this.listAttachmentsFromGraph(
      email.graphMessageId,
      accessToken
    );

    // Add diagnostics to result
    result._diagnostics = {
      graphMessageId: email.graphMessageId,
      attachmentsFromGraph: attachments.length,
      skippedNonFile: 0,
      skippedAlreadyExist: 0,
    };

    logger.info('Attachments from Graph API', {
      emailId,
      graphMessageId: email.graphMessageId,
      attachmentCount: attachments.length,
      attachments: attachments.map(a => ({
        id: a.id,
        name: a.name,
        type: a['@odata.type'],
        isInline: (a as any).isInline,
        contentType: a.contentType,
      })),
    });

    // Sync each attachment
    for (const attachment of attachments) {
      try {
        // Skip non-file attachments (e.g., item attachments, reference attachments)
        // Note: inline images are fileAttachments with isInline=true, we include them
        if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') {
          logger.info('Skipping non-file attachment', {
            name: attachment.name,
            type: attachment['@odata.type'],
          });
          skippedNonFile++;
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
          // Check if attachment exists but needs Document/CaseDocument records created
          // This happens when attachments were synced before email was linked to case
          if (!existing.documentId && email.caseId) {
            logger.info('Existing attachment missing Document record, creating now', {
              emailId,
              attachmentId: existing.id,
              name: existing.name,
              caseId: email.caseId,
            });

            try {
              // Re-download and store in OneDrive with Document creation
              const synced = await this.syncAttachment(emailId, attachment.id!, accessToken);

              // Delete the old EmailAttachment record (syncAttachment created a new one)
              await this.prisma.emailAttachment.delete({
                where: { id: existing.id },
              });

              result.attachments.push(synced);
              result.attachmentsSynced++;

              upgradedWithDocument++;
              logger.info('Successfully created Document for existing attachment', {
                emailId,
                oldAttachmentId: existing.id,
                newAttachmentId: synced.id,
                documentId: synced.documentId,
              });
              continue;
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              logger.error('Failed to create Document for existing attachment', {
                emailId,
                attachmentId: existing.id,
                error: errorMsg,
              });
              result.errors.push(`Failed to create Document for ${existing.name}: ${errorMsg}`);
              // Fall through to add the existing attachment without document
            }
          }

          logger.info('Attachment already synced', {
            emailId,
            attachmentId: existing.id,
            name: existing.name,
            hasDocument: !!existing.documentId,
          });
          skippedAlreadyExist++;
          result.attachments.push({
            id: existing.id,
            emailId,
            graphAttachmentId: attachment.id!,
            name: existing.name,
            contentType: existing.contentType,
            size: existing.size,
            storageUrl: existing.storageUrl, // can be null if storage not configured
            documentId: existing.documentId || undefined,
          });
          continue;
        }

        // Sync new attachment
        logger.info('Syncing new attachment', {
          emailId,
          graphAttachmentId: attachment.id,
          name: attachment.name,
        });
        const synced = await this.syncAttachment(emailId, attachment.id!, accessToken);
        result.attachments.push(synced);
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

    // Update final diagnostic counts
    result._diagnostics.skippedNonFile = skippedNonFile;
    result._diagnostics.skippedAlreadyExist = skippedAlreadyExist;

    logger.info('syncAllAttachments complete', {
      emailId,
      attachmentsSynced: result.attachmentsSynced,
      upgradedWithDocument,
      skippedNonFile,
      skippedAlreadyExist,
      errorCount: result.errors.length,
    });

    return result;
  }

  /**
   * Get download URL for an attachment
   *
   * @param attachmentId - Database attachment ID
   * @param accessToken - User's OAuth access token (for OneDrive)
   * @returns Download URL with expiration
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

    // If stored in OneDrive, get fresh download link
    if (attachment.storageUrl.startsWith('onedrive://')) {
      const oneDriveId = attachment.storageUrl.replace('onedrive://', '');
      const link = await this.oneDrive.getDocumentDownloadLink(accessToken, oneDriveId);
      return {
        url: link.url,
        expiresAt: new Date(link.expirationDateTime),
      };
    }

    // R2 URLs are pre-signed or direct
    // In production, you'd generate a pre-signed URL here
    return {
      url: attachment.storageUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    };
  }

  /**
   * Move attachment to case folder after email categorization
   *
   * @param attachmentId - Database attachment ID
   * @param caseId - Target case ID
   * @param accessToken - User's OAuth access token
   */
  async moveAttachmentToCase(
    attachmentId: string,
    caseId: string,
    accessToken: string
  ): Promise<void> {
    const attachment = await this.prisma.emailAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        email: true,
      },
    });

    if (!attachment) {
      throw new Error(`Attachment not found: ${attachmentId}`);
    }

    // Only move if currently in R2 (uncategorized)
    if (!attachment.storageUrl?.startsWith('r2://')) {
      return; // Already in OneDrive
    }

    const caseInfo = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: { caseNumber: true, clientId: true, firmId: true },
    });

    if (!caseInfo) {
      throw new Error(`Case not found: ${caseId}`);
    }

    // Download from R2
    const r2Path = attachment.storageUrl.replace('r2://', '');
    const content = await this.r2Storage.downloadDocument(r2Path);

    // Upload to OneDrive
    const result = await this.storeInOneDrive(
      {
        content,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
      },
      caseId,
      caseInfo.caseNumber,
      caseInfo.clientId,
      caseInfo.firmId,
      attachment.email.userId,
      attachment.email.receivedDateTime,
      accessToken
    );

    // Update attachment record
    await this.prisma.emailAttachment.update({
      where: { id: attachmentId },
      data: {
        storageUrl: result.storageUrl,
        documentId: result.documentId,
      },
    });

    logger.info('Attachment moved to case folder', {
      attachmentId,
      caseId,
      newStorageUrl: result.storageUrl,
    });
  }

  /**
   * Get attachment content directly from MS Graph (for download without storage)
   *
   * @param graphMessageId - MS Graph message ID
   * @param graphAttachmentId - MS Graph attachment ID
   * @param accessToken - User's OAuth access token
   * @returns Buffer containing attachment content
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

          // Get attachment with content
          const attachment = await client
            .api(`/me/messages/${graphMessageId}/attachments/${graphAttachmentId}`)
            .get() as FileAttachment;

          if (!attachment.contentBytes) {
            throw new Error('Attachment has no content');
          }

          // Decode base64 content
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

          // Note: @odata.type is automatically included, don't request it in $select
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
   * Store attachment in OneDrive case folder (AC: 4)
   */
  private async storeInOneDrive(
    attachment: AttachmentDownloadResult,
    caseId: string,
    caseNumber: string,
    clientId: string,
    firmId: string,
    userId: string,
    emailDate: Date,
    accessToken: string
  ): Promise<{ storageUrl: string; documentId?: string }> {
    // Create email folder structure: /Cases/{CaseNumber}/Emails/{Year-Month}/
    const yearMonth = `${emailDate.getFullYear()}-${String(emailDate.getMonth() + 1).padStart(2, '0')}`;

    // First ensure the case folder structure exists
    const caseFolders = await this.oneDrive.createCaseFolderStructure(
      accessToken,
      caseId,
      caseNumber
    );

    // Create Emails subfolder
    const client = createGraphClient(accessToken);
    const emailsFolder = await this.createOrGetFolder(
      client,
      caseFolders.caseFolder.id,
      ONEDRIVE_EMAIL_FOLDER
    );

    // Create year-month subfolder
    const monthFolder = await this.createOrGetFolder(
      client,
      emailsFolder.id!,
      yearMonth
    );

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

    // Create Document record with required relations
    const document = await this.prisma.document.create({
      data: {
        clientId,
        firmId,
        fileName: attachment.name,
        fileType: attachment.contentType,
        fileSize: attachment.size,
        storagePath: uploadResult.parentPath + '/' + attachment.name,
        uploadedBy: userId,
        oneDriveId: uploadResult.id,
        oneDrivePath: uploadResult.parentPath + '/' + attachment.name,
        status: DocumentStatus.FINAL,
        metadata: {
          source: 'email_attachment',
          category: 'Email Attachment',
        },
      },
    });

    // Link document to case via CaseDocument junction table
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
      storageUrl: `onedrive://${uploadResult.id}`,
      documentId: document.id,
    };
  }

  /**
   * Store attachment in R2 storage (for uncategorized or large files)
   */
  private async storeInR2(
    attachment: AttachmentDownloadResult,
    emailId: string,
    userId: string
  ): Promise<string> {
    // Generate storage path: email-attachments/{userId}/{emailId}/{filename}
    const storagePath = `${R2_EMAIL_ATTACHMENTS_PATH}/${userId}/${emailId}/${attachment.name}`;

    await this.r2Storage.uploadDocument(
      storagePath,
      attachment.content,
      attachment.contentType
    );

    return `r2://${storagePath}`;
  }

  /**
   * Create or get existing folder in OneDrive
   */
  private async createOrGetFolder(
    client: Client,
    parentId: string,
    folderName: string
  ): Promise<{ id: string }> {
    try {
      const folder = await client
        .api(`/me/drive/items/${parentId}/children`)
        .post({
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        });

      return { id: folder.id };
    } catch (error: any) {
      // If folder already exists, get it
      if (error.statusCode === 409 || error.code === 'nameAlreadyExists') {
        const children = await client
          .api(`/me/drive/items/${parentId}/children`)
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

export function getEmailAttachmentService(
  prisma: PrismaClient
): EmailAttachmentService {
  if (!emailAttachmentServiceInstance) {
    emailAttachmentServiceInstance = new EmailAttachmentService(prisma);
  }
  return emailAttachmentServiceInstance;
}
