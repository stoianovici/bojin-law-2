/**
 * OneDrive Service for Document Storage
 * Story 2.9: Document Storage with OneDrive Integration
 *
 * Service layer for OneDrive file operations including:
 * - Folder structure creation
 * - Document upload (simple and resumable)
 * - Document download link generation
 * - Change detection and synchronization
 *
 * Uses Microsoft Graph API via the existing GraphService from Story 2.5
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { DriveItem } from '@microsoft/microsoft-graph-types';
import { prisma } from '@legal-platform/database';
import { graphEndpoints, createGraphClient } from '../config/graph.config';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import logger from '../utils/logger';

// OneDrive configuration
const ONEDRIVE_CONFIG = {
  // File size threshold for resumable upload (4MB)
  SIMPLE_UPLOAD_MAX_SIZE: 4 * 1024 * 1024,
  // Chunk size for resumable upload (320KB as recommended by Microsoft)
  CHUNK_SIZE: 320 * 1024,
  // Download URL cache TTL in seconds (55 minutes - 5 minute buffer before 1 hour expiration)
  DOWNLOAD_URL_CACHE_TTL: 55 * 60,
  // Maximum file size for upload (100MB)
  MAX_FILE_SIZE: 100 * 1024 * 1024,
};

// Allowed file types for upload
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]);

/**
 * Upload metadata for OneDrive upload operations
 */
export interface UploadMetadata {
  caseId: string;
  caseNumber: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
}

/**
 * OneDrive file metadata returned after upload
 */
export interface OneDriveFileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  webUrl: string;
  downloadUrl?: string;
  parentPath: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

/**
 * Case folder structure in OneDrive
 */
export interface CaseFolderStructure {
  caseFolder: {
    id: string;
    webUrl: string;
    path: string;
  };
  documentsFolder: {
    id: string;
    webUrl: string;
    path: string;
  };
}

/**
 * Temporary download link information
 */
export interface DownloadLinkInfo {
  url: string;
  expirationDateTime: string;
}

/**
 * Organization sharing link information
 * OPS-104: Used to share documents with all organization members
 */
export interface OrganizationSharingLink {
  id: string;
  webUrl: string;
}

/**
 * Preview URL information for document preview
 */
export interface PreviewUrlInfo {
  url: string;
  source: 'pdf' | 'office365' | 'image';
  expiresAt: string;
}

/**
 * OneDrive Service Class
 * Handles all OneDrive-related operations for document storage
 */
export class OneDriveService {
  /**
   * Create case folder structure in OneDrive
   * Creates: /Cases/{CaseNumber}/Documents/
   *
   * This operation is idempotent - if folders already exist, returns existing structure
   *
   * @param accessToken - User's access token
   * @param caseId - Case UUID
   * @param caseNumber - Case number for folder naming
   * @returns Case folder structure with IDs and paths
   */
  async createCaseFolderStructure(
    accessToken: string,
    caseId: string,
    caseNumber: string
  ): Promise<CaseFolderStructure> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Sanitize case number for folder name (remove invalid characters)
          const sanitizedCaseNumber = this.sanitizeFolderName(caseNumber);

          // Create or get Cases root folder
          const casesFolder = await this.createOrGetFolder(client, 'root', 'Cases');

          // Create or get case-specific folder
          const caseFolder = await this.createOrGetFolder(
            client,
            casesFolder.id!,
            sanitizedCaseNumber
          );

          // Create or get Documents subfolder
          const documentsFolder = await this.createOrGetFolder(client, caseFolder.id!, 'Documents');

          logger.info('OneDrive folder structure created/verified', {
            caseId,
            caseNumber: sanitizedCaseNumber,
            caseFolderId: caseFolder.id,
            documentsFolderId: documentsFolder.id,
          });

          return {
            caseFolder: {
              id: caseFolder.id!,
              webUrl: caseFolder.webUrl!,
              path: `/Cases/${sanitizedCaseNumber}`,
            },
            documentsFolder: {
              id: documentsFolder.id!,
              webUrl: documentsFolder.webUrl!,
              path: `/Cases/${sanitizedCaseNumber}/Documents`,
            },
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-create-folder-structure'
    );
  }

  /**
   * Upload document to OneDrive
   * Uses simple upload for files <4MB, resumable upload for larger files
   *
   * @param accessToken - User's access token
   * @param file - File buffer
   * @param metadata - Upload metadata including case info
   * @returns OneDrive file metadata
   */
  async uploadDocumentToOneDrive(
    accessToken: string,
    file: Buffer,
    metadata: UploadMetadata
  ): Promise<OneDriveFileMetadata> {
    // Validate file size
    if (file.length > ONEDRIVE_CONFIG.MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${ONEDRIVE_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.has(metadata.fileType)) {
      throw new Error(`File type ${metadata.fileType} is not allowed`);
    }

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Ensure case folder structure exists
          const folderStructure = await this.createCaseFolderStructure(
            accessToken,
            metadata.caseId,
            metadata.caseNumber
          );

          // Sanitize file name
          const sanitizedFileName = this.sanitizeFileName(metadata.fileName);

          let driveItem: DriveItem;

          if (file.length <= ONEDRIVE_CONFIG.SIMPLE_UPLOAD_MAX_SIZE) {
            // Simple upload for small files (<4MB)
            driveItem = await this.simpleUpload(
              client,
              folderStructure.documentsFolder.id,
              sanitizedFileName,
              file,
              metadata.fileType
            );
          } else {
            // Resumable upload for large files (>4MB)
            driveItem = await this.resumableUpload(
              client,
              folderStructure.documentsFolder.id,
              sanitizedFileName,
              file,
              metadata.fileType
            );
          }

          logger.info('Document uploaded to OneDrive', {
            caseId: metadata.caseId,
            fileName: sanitizedFileName,
            fileSize: file.length,
            oneDriveId: driveItem.id,
          });

          return {
            id: driveItem.id!,
            name: driveItem.name!,
            size: driveItem.size!,
            mimeType: driveItem.file?.mimeType || metadata.fileType,
            webUrl: driveItem.webUrl!,
            downloadUrl: (driveItem as any)['@microsoft.graph.downloadUrl'],
            parentPath: folderStructure.documentsFolder.path,
            createdDateTime: driveItem.createdDateTime!,
            lastModifiedDateTime: driveItem.lastModifiedDateTime!,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-upload-document'
    );
  }

  /**
   * Get temporary download link for a document
   * Creates a sharing link that expires in 1 hour
   *
   * OPS-104: Now supports cross-user access via oneDriveUserId parameter.
   * When oneDriveUserId is provided, uses /users/{userId}/drive/... endpoint
   * to access another user's OneDrive (requires Files.Read.All permission).
   *
   * @param accessToken - User's access token
   * @param oneDriveId - OneDrive item ID
   * @param oneDriveUserId - Optional: MS Graph user ID of the OneDrive owner (for cross-user access)
   * @returns Download link info with URL and expiration
   */
  async getDocumentDownloadLink(
    accessToken: string,
    oneDriveId: string,
    oneDriveUserId?: string
  ): Promise<DownloadLinkInfo> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // OPS-104: Use owner-aware endpoint if oneDriveUserId is provided
          const itemEndpoint = oneDriveUserId
            ? graphEndpoints.driveItemByOwner(oneDriveUserId, oneDriveId)
            : graphEndpoints.driveItem(oneDriveId);

          // First, try to get direct download URL from item metadata
          const item = await client.api(itemEndpoint).get();

          // Check if direct download URL is available (expires in ~1 hour)
          const directUrl = item['@microsoft.graph.downloadUrl'];
          if (directUrl) {
            return {
              url: directUrl,
              expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            };
          }

          // If no direct URL, create a sharing link
          const createLinkEndpoint = oneDriveUserId
            ? `/users/${oneDriveUserId}/drive/items/${oneDriveId}/createLink`
            : `/me/drive/items/${oneDriveId}/createLink`;

          const link = await client.api(createLinkEndpoint).post({
            type: 'view',
            scope: 'anonymous',
            expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          });

          logger.info('Download link created for document', {
            oneDriveId,
            oneDriveUserId,
            expirationDateTime: link.expirationDateTime,
          });

          return {
            url: link.link.webUrl,
            expirationDateTime: link.expirationDateTime,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-get-download-link'
    );
  }

  /**
   * Sync document metadata from OneDrive
   * Checks if the OneDrive file has been modified and creates a new version if needed
   *
   * @param accessToken - User's access token
   * @param oneDriveId - OneDrive item ID
   * @param documentId - Database document ID
   * @param userId - User performing the sync (for version tracking)
   * @returns True if document was updated, false if already in sync
   */
  async syncDocumentFromOneDrive(
    accessToken: string,
    oneDriveId: string,
    documentId: string,
    userId: string
  ): Promise<{ updated: boolean; newVersionNumber?: number }> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Get latest file metadata from OneDrive
          const oneDriveItem = await client.api(graphEndpoints.driveItem(oneDriveId)).get();

          // Get local document record
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

          // Compare timestamps
          const oneDriveModified = new Date(oneDriveItem.lastModifiedDateTime);
          const localModified = document.updatedAt;

          if (oneDriveModified <= localModified) {
            // No changes, already in sync
            logger.debug('Document already in sync', {
              documentId,
              oneDriveId,
            });
            return { updated: false };
          }

          // OneDrive file is newer, create new version
          const latestVersion = document.versions[0];
          const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

          await prisma.$transaction(async (tx) => {
            // Create new version
            await tx.documentVersion.create({
              data: {
                documentId: document.id,
                versionNumber: newVersionNumber,
                oneDriveVersionId: oneDriveItem.id,
                changesSummary: `Synced from OneDrive at ${oneDriveModified.toISOString()}`,
                createdBy: userId,
              },
            });

            // Update document metadata
            await tx.document.update({
              where: { id: document.id },
              data: {
                fileSize: oneDriveItem.size,
                updatedAt: oneDriveModified,
              },
            });
          });

          logger.info('Document synced from OneDrive', {
            documentId,
            oneDriveId,
            newVersionNumber,
            oneDriveModified: oneDriveModified.toISOString(),
          });

          return { updated: true, newVersionNumber };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-sync-document'
    );
  }

  /**
   * Get file metadata from OneDrive
   *
   * @param accessToken - User's access token
   * @param oneDriveId - OneDrive item ID
   * @returns OneDrive file metadata
   */
  async getFileMetadata(accessToken: string, oneDriveId: string): Promise<OneDriveFileMetadata> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          const item = await client.api(graphEndpoints.driveItem(oneDriveId)).get();

          return {
            id: item.id,
            name: item.name,
            size: item.size,
            mimeType: item.file?.mimeType || '',
            webUrl: item.webUrl,
            downloadUrl: item['@microsoft.graph.downloadUrl'],
            parentPath: item.parentReference?.path || '',
            createdDateTime: item.createdDateTime,
            lastModifiedDateTime: item.lastModifiedDateTime,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-get-file-metadata'
    );
  }

  /**
   * Delete file from OneDrive
   *
   * @param accessToken - User's access token
   * @param oneDriveId - OneDrive item ID
   */
  async deleteFile(accessToken: string, oneDriveId: string): Promise<void> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          await client.api(graphEndpoints.driveItem(oneDriveId)).delete();

          logger.info('File deleted from OneDrive', { oneDriveId });
        } catch (error: any) {
          // Ignore 404 errors - file already deleted
          if (error.statusCode === 404) {
            logger.warn('File not found in OneDrive, may already be deleted', {
              oneDriveId,
            });
            return;
          }

          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-delete-file'
    );
  }

  /**
   * Get preview URL for a document
   * Returns a URL suitable for embedding in an iframe:
   * - PDFs: Direct download URL (browser renders natively)
   * - Office docs: Office Online embed URL
   * - Images: Direct download URL
   *
   * OPS-104: Now supports cross-user access via oneDriveUserId parameter.
   * When oneDriveUserId is provided, uses /users/{userId}/drive/... endpoint
   * to access another user's OneDrive (requires Files.Read.All permission).
   *
   * @param accessToken - User's access token
   * @param oneDriveId - OneDrive item ID
   * @param mimeType - File MIME type for determining preview strategy
   * @param oneDriveUserId - Optional: MS Graph user ID of the OneDrive owner (for cross-user access)
   * @returns Preview URL info or null if preview not supported
   */
  async getPreviewUrl(
    accessToken: string,
    oneDriveId: string,
    mimeType: string,
    oneDriveUserId?: string
  ): Promise<PreviewUrlInfo | null> {
    // Office document types that can be previewed via Office Online
    const officeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
    ];

    // Image types that can be previewed directly
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // PDF preview
    const isPdf = mimeType === 'application/pdf';

    // Check if file type is previewable
    const isOffice = officeTypes.includes(mimeType);
    const isImage = imageTypes.includes(mimeType);

    if (!isPdf && !isOffice && !isImage) {
      logger.debug('Preview not supported for file type', { mimeType, oneDriveId });
      return null;
    }

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // OPS-104: Use owner-aware endpoint if oneDriveUserId is provided
          const previewEndpoint = oneDriveUserId
            ? `/users/${oneDriveUserId}/drive/items/${oneDriveId}/preview`
            : `/me/drive/items/${oneDriveId}/preview`;

          if (isPdf || isOffice) {
            // Use MS Graph preview API for PDFs and Office docs
            // This returns an embeddable URL that works in iframes
            try {
              const previewResponse = await client.api(previewEndpoint).post({});

              if (previewResponse.getUrl) {
                logger.info('Generated MS Graph preview URL', {
                  oneDriveId,
                  oneDriveUserId,
                  mimeType,
                  source: isPdf ? 'pdf' : 'office365',
                });

                return {
                  url: previewResponse.getUrl,
                  source: isPdf ? 'pdf' : 'office365',
                  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                };
              }
            } catch (previewError: any) {
              // If preview API fails, fall through to download link for Office docs
              logger.warn('MS Graph preview API failed, falling back', {
                oneDriveId,
                oneDriveUserId,
                error: previewError.message,
              });
            }

            // Fallback for Office docs: use Office Online viewer
            if (isOffice) {
              // OPS-104: Pass oneDriveUserId to download link method
              const downloadLink = await this.getDocumentDownloadLink(
                accessToken,
                oneDriveId,
                oneDriveUserId
              );
              const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(downloadLink.url)}`;

              logger.info('Generated Office Online preview URL (fallback)', {
                oneDriveId,
                oneDriveUserId,
                mimeType,
              });

              return {
                url: embedUrl,
                source: 'office365',
                expiresAt: downloadLink.expirationDateTime,
              };
            }

            // PDF preview API failed, no fallback
            return null;
          }

          if (isImage) {
            // Images can use download link directly
            // OPS-104: Pass oneDriveUserId to download link method
            const downloadLink = await this.getDocumentDownloadLink(
              accessToken,
              oneDriveId,
              oneDriveUserId
            );
            return {
              url: downloadLink.url,
              source: 'image',
              expiresAt: downloadLink.expirationDateTime,
            };
          }

          return null;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-get-preview-url'
    );
  }

  /**
   * Get thumbnails for a file from OneDrive
   * OneDrive auto-generates thumbnails for PDFs, Office docs, and images
   *
   * OPS-104: Now supports cross-user access via oneDriveUserId parameter.
   *
   * @param accessToken - User's access token
   * @param oneDriveId - OneDrive item ID
   * @param size - Thumbnail size ('small', 'medium', 'large')
   * @param oneDriveUserId - Optional: MS Graph user ID of the OneDrive owner (for cross-user access)
   * @returns Thumbnail URL or null if not available
   */
  async getFileThumbnail(
    accessToken: string,
    oneDriveId: string,
    size: 'small' | 'medium' | 'large' = 'medium',
    oneDriveUserId?: string
  ): Promise<string | null> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // OPS-104: Use owner-aware endpoint if oneDriveUserId is provided
          const thumbnailEndpoint = oneDriveUserId
            ? `/users/${oneDriveUserId}/drive/items/${oneDriveId}/thumbnails`
            : `/me/drive/items/${oneDriveId}/thumbnails`;

          const thumbnails = await client.api(thumbnailEndpoint).get();

          if (thumbnails.value && thumbnails.value.length > 0) {
            const thumbnail = thumbnails.value[0];
            return thumbnail[size]?.url || null;
          }

          return null;
        } catch (error: any) {
          // Thumbnails not available for all file types
          if (error.statusCode === 404) {
            return null;
          }

          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'onedrive-get-thumbnail'
    );
  }

  /**
   * Share a file with the organization
   * OPS-104: Creates an organization-scoped sharing link so all firm members can access the file
   * This is required because files in personal OneDrives are not accessible to other users
   * even with Files.Read.All delegated permission.
   *
   * @param accessToken - User's access token
   * @param oneDriveId - OneDrive item ID
   * @returns Organization sharing link info
   */
  async shareWithOrganization(
    accessToken: string,
    oneDriveId: string
  ): Promise<OrganizationSharingLink | null> {
    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Create an organization-wide sharing link
          // type: 'view' - read-only access
          // scope: 'organization' - anyone in the organization can access
          const shareResponse = await client.api(`/me/drive/items/${oneDriveId}/createLink`).post({
            type: 'view',
            scope: 'organization',
          });

          logger.info('Created organization sharing link for document', {
            oneDriveId,
            linkId: shareResponse.id,
          });

          return {
            id: shareResponse.id,
            webUrl: shareResponse.link?.webUrl || shareResponse.webUrl,
          };
        } catch (error: any) {
          // If sharing fails (e.g., already shared or sharing disabled), log and return null
          // This should not block the upload process
          logger.warn('Failed to create organization sharing link', {
            oneDriveId,
            error: error.message,
          });
          return null;
        }
      },
      { maxAttempts: 2 }, // Only retry once for sharing
      'onedrive-share-organization'
    );
  }

  // Private helper methods

  /**
   * Create or get existing folder
   */
  private async createOrGetFolder(
    client: Client,
    parentId: string,
    folderName: string
  ): Promise<DriveItem> {
    try {
      // Try to create folder - will return existing if already exists
      const parentPath = parentId === 'root' ? '/me/drive/root' : `/me/drive/items/${parentId}`;

      const folder = await client.api(`${parentPath}/children`).post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });

      return folder;
    } catch (error: any) {
      // If folder already exists, get it
      if (error.statusCode === 409 || error.code === 'nameAlreadyExists') {
        const parentPath = parentId === 'root' ? '/me/drive/root' : `/me/drive/items/${parentId}`;

        const children = await client
          .api(`${parentPath}/children`)
          .filter(`name eq '${folderName}'`)
          .get();

        if (children.value && children.value.length > 0) {
          return children.value[0];
        }
      }

      throw error;
    }
  }

  /**
   * Simple upload for small files (<4MB)
   */
  private async simpleUpload(
    client: Client,
    parentFolderId: string,
    fileName: string,
    content: Buffer,
    contentType: string
  ): Promise<DriveItem> {
    const response = await client
      .api(`/me/drive/items/${parentFolderId}:/${fileName}:/content`)
      .header('Content-Type', contentType)
      .put(content);

    return response;
  }

  /**
   * Resumable upload for large files (>4MB)
   * Uses upload session for chunked upload
   */
  private async resumableUpload(
    client: Client,
    parentFolderId: string,
    fileName: string,
    content: Buffer,
    contentType: string
  ): Promise<DriveItem> {
    // Create upload session
    const session = await client
      .api(`/me/drive/items/${parentFolderId}:/${fileName}:/createUploadSession`)
      .post({
        item: {
          '@microsoft.graph.conflictBehavior': 'replace',
          name: fileName,
        },
      });

    const uploadUrl = session.uploadUrl;
    const fileSize = content.length;
    let offset = 0;
    let response: any;

    // Upload file in chunks
    while (offset < fileSize) {
      const chunkEnd = Math.min(offset + ONEDRIVE_CONFIG.CHUNK_SIZE, fileSize);
      const chunk = content.slice(offset, chunkEnd);

      const contentRange = `bytes ${offset}-${chunkEnd - 1}/${fileSize}`;

      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length.toString(),
          'Content-Range': contentRange,
        },
        body: chunk,
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`Upload chunk failed: ${response.status} ${response.statusText}`);
      }

      offset = chunkEnd;

      logger.debug('Upload progress', {
        fileName,
        progress: `${Math.round((offset / fileSize) * 100)}%`,
      });
    }

    // Get final response with file metadata
    const result = await response.json();
    return result;
  }

  /**
   * Sanitize folder name for OneDrive
   * Removes invalid characters
   */
  private sanitizeFolderName(name: string): string {
    // OneDrive folder name restrictions
    return name
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace whitespace with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 255); // Max length
  }

  /**
   * Sanitize file name for OneDrive
   * Removes invalid characters while preserving extension
   */
  private sanitizeFileName(name: string): string {
    const lastDot = name.lastIndexOf('.');
    const baseName = lastDot > 0 ? name.substring(0, lastDot) : name;
    const extension = lastDot > 0 ? name.substring(lastDot) : '';

    const sanitizedBase = baseName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 250 - extension.length);

    return sanitizedBase + extension;
  }
}

// Export singleton instance
export const oneDriveService = new OneDriveService();
