/**
 * OneDrive Sync Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Service layer for synchronizing documents between the platform and OneDrive.
 * Handles:
 * - Uploading documents to OneDrive for Word editing
 * - Downloading changes from OneDrive after Word editing
 * - Creating new document versions on sync
 */

import { prisma } from '@legal-platform/database';
import { createGraphClient, graphEndpoints } from '../config/graph.config';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import { OneDriveService, oneDriveService } from './onedrive.service';
import { R2StorageService, r2StorageService } from './r2-storage.service';
import { DocumentSyncResult } from '@legal-platform/types';
import logger from '../utils/logger';
import { createHash } from 'crypto';

/**
 * OneDrive Sync Service Class
 * Handles document synchronization between platform storage (R2) and OneDrive
 */
export class OneDriveSyncService {
  private oneDriveService: OneDriveService;
  private r2Storage: R2StorageService;

  constructor(oneDriveSvc?: OneDriveService, r2Svc?: R2StorageService) {
    this.oneDriveService = oneDriveSvc || oneDriveService;
    this.r2Storage = r2Svc || r2StorageService;
  }

  /**
   * Upload a document to OneDrive
   *
   * Flow:
   * 1. Get document from database
   * 2. Download content from R2 storage
   * 3. Upload to OneDrive in case folder structure
   * 4. Update document record with OneDrive ID
   *
   * @param documentId - Document UUID
   * @param accessToken - Microsoft Graph API access token
   * @returns OneDrive item ID
   */
  async uploadToOneDrive(documentId: string, accessToken: string): Promise<string> {
    logger.info('Uploading document to OneDrive', { documentId });

    // Get document with case info
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        caseLinks: {
          include: {
            case: {
              select: { id: true, caseNumber: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!document.caseLinks.length) {
      throw new Error('Document must be linked to a case to upload to OneDrive');
    }

    const caseInfo = document.caseLinks[0].case;

    // For now, we'll simulate getting content from R2
    // In production, this would fetch from Cloudflare R2
    const fileContent = await this.getDocumentContent(document.storagePath);

    // Upload to OneDrive
    const result = await this.oneDriveService.uploadDocumentToOneDrive(
      accessToken,
      fileContent,
      {
        caseId: caseInfo.id,
        caseNumber: caseInfo.caseNumber,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
      }
    );

    // Update document with OneDrive ID
    await prisma.document.update({
      where: { id: documentId },
      data: {
        oneDriveId: result.id,
        oneDrivePath: result.parentPath + '/' + result.name,
      },
    });

    logger.info('Document uploaded to OneDrive', {
      documentId,
      oneDriveId: result.id,
    });

    return result.id;
  }

  /**
   * Download document changes from OneDrive
   *
   * Flow:
   * 1. Get current OneDrive file metadata
   * 2. Compare with last known version
   * 3. If changed, download content
   * 4. Create new DocumentVersion
   * 5. Update R2 storage
   *
   * @param documentId - Document UUID
   * @param accessToken - Microsoft Graph API access token
   * @returns Sync result with version info
   */
  async downloadFromOneDrive(
    documentId: string,
    accessToken: string
  ): Promise<DocumentSyncResult> {
    logger.info('Downloading document from OneDrive', { documentId });

    // Get document with latest version
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!document.oneDriveId) {
      throw new Error('Document is not in OneDrive');
    }

    // Get OneDrive file metadata
    const oneDriveMetadata = await this.oneDriveService.getFileMetadata(
      accessToken,
      document.oneDriveId
    );

    // Compare last modified time
    const oneDriveModified = new Date(oneDriveMetadata.lastModifiedDateTime);
    const localModified = document.updatedAt;

    if (oneDriveModified <= localModified) {
      logger.debug('Document already in sync', { documentId });
      return { updated: false };
    }

    // Download content from OneDrive
    const content = await this.downloadOneDriveContent(
      accessToken,
      document.oneDriveId
    );

    // Calculate content hash for comparison
    const contentHash = createHash('sha256').update(content).digest('hex');

    // Create new version
    const latestVersion = document.versions[0];
    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await prisma.$transaction(async (tx) => {
      // Create version record
      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: newVersionNumber,
          oneDriveVersionId: oneDriveMetadata.id,
          changesSummary: `Synced from OneDrive at ${oneDriveModified.toISOString()}`,
          // Note: createdBy should be the user who made changes in Word
          // For now, we use a system user or the document uploader
          createdBy: document.uploadedBy,
        },
      });

      // Update document metadata
      await tx.document.update({
        where: { id: document.id },
        data: {
          fileSize: content.length,
          updatedAt: oneDriveModified,
        },
      });
    });

    // Update R2 storage (placeholder - would upload to Cloudflare R2)
    await this.updateDocumentContent(document.storagePath, content);

    logger.info('Document synced from OneDrive', {
      documentId,
      newVersionNumber,
      oneDriveModified: oneDriveModified.toISOString(),
    });

    return {
      updated: true,
      newVersionNumber,
    };
  }

  /**
   * Sync document changes (bi-directional)
   *
   * Determines if local or remote version is newer and syncs accordingly.
   *
   * @param documentId - Document UUID
   * @param accessToken - Microsoft Graph API access token
   * @returns Sync result
   */
  async syncDocumentChanges(
    documentId: string,
    accessToken: string
  ): Promise<DocumentSyncResult> {
    logger.info('Syncing document changes', { documentId });

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!document.oneDriveId) {
      // Document not in OneDrive - nothing to sync
      return { updated: false };
    }

    // Get OneDrive metadata
    const oneDriveMetadata = await this.oneDriveService.getFileMetadata(
      accessToken,
      document.oneDriveId
    );

    const oneDriveModified = new Date(oneDriveMetadata.lastModifiedDateTime);
    const localModified = document.updatedAt;

    if (oneDriveModified > localModified) {
      // OneDrive is newer - download changes
      return this.downloadFromOneDrive(documentId, accessToken);
    }

    // Local is newer or same - no sync needed
    return { updated: false };
  }

  /**
   * Get OneDrive file versions
   *
   * @param accessToken - Microsoft Graph API access token
   * @param oneDriveId - OneDrive item ID
   * @returns Array of version metadata
   */
  async getOneDriveVersions(
    accessToken: string,
    oneDriveId: string
  ): Promise<
    Array<{
      id: string;
      lastModifiedDateTime: string;
      size: number;
    }>
  > {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          const response = await client
            .api(graphEndpoints.driveItemVersions(oneDriveId))
            .get();

          return response.value.map((v: any) => ({
            id: v.id,
            lastModifiedDateTime: v.lastModifiedDateTime,
            size: v.size,
          }));
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-get-versions'
    );
  }

  /**
   * Download specific version from OneDrive
   *
   * @param accessToken - Microsoft Graph API access token
   * @param oneDriveId - OneDrive item ID
   * @param versionId - Version ID
   * @returns File content as Buffer
   */
  async downloadOneDriveVersion(
    accessToken: string,
    oneDriveId: string,
    versionId: string
  ): Promise<Buffer> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Get version download URL
          const version = await client
            .api(`/me/drive/items/${oneDriveId}/versions/${versionId}`)
            .get();

          const downloadUrl = version['@microsoft.graph.downloadUrl'];

          if (!downloadUrl) {
            throw new Error('No download URL available for version');
          }

          // Download content
          const response = await fetch(downloadUrl);

          if (!response.ok) {
            throw new Error(`Failed to download version: ${response.status}`);
          }

          return Buffer.from(await response.arrayBuffer());
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-download-version'
    );
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Download OneDrive file content
   */
  private async downloadOneDriveContent(
    accessToken: string,
    oneDriveId: string
  ): Promise<Buffer> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Get download URL
          const item = await client
            .api(graphEndpoints.driveItem(oneDriveId))
            .get();

          const downloadUrl = item['@microsoft.graph.downloadUrl'];

          if (!downloadUrl) {
            throw new Error('No download URL available');
          }

          // Download content
          const response = await fetch(downloadUrl);

          if (!response.ok) {
            throw new Error(`Failed to download: ${response.status}`);
          }

          return Buffer.from(await response.arrayBuffer());
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-download-content'
    );
  }

  /**
   * Get document content from R2 storage
   *
   * @param storagePath - The storage path/key of the document in R2
   * @returns Buffer containing the document content
   * @throws Error if R2 is not configured or document not found
   */
  private async getDocumentContent(storagePath: string): Promise<Buffer> {
    logger.debug('Getting document content from R2', { storagePath });

    if (!this.r2Storage.isConfigured()) {
      throw new Error(
        'R2 storage is not configured. Required environment variables: ' +
          'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID or R2_ENDPOINT'
      );
    }

    try {
      const content = await this.r2Storage.downloadDocument(storagePath);
      logger.info('Document content retrieved from R2', {
        storagePath,
        size: content.length,
      });
      return content;
    } catch (error) {
      logger.error('Failed to retrieve document from R2', { storagePath, error });
      throw new Error(`Failed to retrieve document from R2 storage: ${storagePath}`);
    }
  }

  /**
   * Update document content in R2 storage
   *
   * @param storagePath - The storage path/key of the document in R2
   * @param content - The new document content
   * @throws Error if R2 is not configured or upload fails
   */
  private async updateDocumentContent(
    storagePath: string,
    content: Buffer
  ): Promise<void> {
    logger.debug('Updating document content in R2', {
      storagePath,
      contentSize: content.length,
    });

    if (!this.r2Storage.isConfigured()) {
      throw new Error(
        'R2 storage is not configured. Required environment variables: ' +
          'R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID or R2_ENDPOINT'
      );
    }

    // Determine content type from file extension
    const extension = storagePath.split('.').pop() || '';
    const contentType = this.r2Storage.getContentTypeForExtension(extension);

    try {
      await this.r2Storage.uploadDocument(storagePath, content, contentType);
      logger.info('Document content updated in R2', {
        storagePath,
        size: content.length,
        contentType,
      });
    } catch (error) {
      logger.error('Failed to update document in R2', { storagePath, error });
      throw new Error(`Failed to update document in R2 storage: ${storagePath}`);
    }
  }
}

// Export singleton instance
export const oneDriveSyncService = new OneDriveSyncService();
