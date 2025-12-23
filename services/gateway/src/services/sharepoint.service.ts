/**
 * SharePoint Service for Document Storage
 * OPS-106: SharePoint Service Layer
 *
 * Service layer for SharePoint document operations including:
 * - Folder structure creation (Cases/{CaseNumber}/Documents)
 * - Document upload (simple and resumable)
 * - Document preview URL generation
 * - Document download link generation
 * - Thumbnail retrieval
 *
 * Uses Microsoft Graph API to access firm's SharePoint site.
 * All firm members have access to documents (unlike OneDrive personal storage).
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { DriveItem } from '@microsoft/microsoft-graph-types';
import { graphEndpoints, createGraphClient } from '../config/graph.config';
import { retryWithBackoff } from '../utils/retry.util';
import { parseGraphError, logGraphError } from '../utils/graph-error-handler';
import logger from '../utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const SHAREPOINT_CONFIG = {
  // File size threshold for resumable upload (4MB)
  SIMPLE_UPLOAD_MAX_SIZE: 4 * 1024 * 1024,
  // Chunk size for resumable upload (320KB as recommended by Microsoft)
  CHUNK_SIZE: 320 * 1024,
  // Maximum file size for upload (100MB)
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  // Preview URL expiration (1 hour)
  PREVIEW_URL_TTL: 60 * 60 * 1000,
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

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata for SharePoint upload operations
 */
export interface SharePointUploadMetadata {
  caseId: string;
  caseNumber: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
}

/**
 * SharePoint item metadata returned after operations
 */
export interface SharePointItem {
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
 * Case folder structure in SharePoint
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
 * Preview URL information
 */
export interface PreviewInfo {
  url: string;
  source: 'pdf' | 'office365' | 'image' | 'text';
  expiresAt: string;
}

/**
 * Thumbnail set with different sizes
 */
export interface ThumbnailSet {
  small?: string;
  medium?: string;
  large?: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * SharePoint Service Class
 * Handles all SharePoint-related operations for document storage
 */
export class SharePointService {
  /**
   * Ensure SharePoint is configured
   */
  private ensureConfigured(): void {
    const siteId = process.env.SHAREPOINT_SITE_ID;
    const driveId = process.env.SHAREPOINT_DRIVE_ID;

    if (!siteId || !driveId) {
      throw new Error(
        'SharePoint not configured. Set SHAREPOINT_SITE_ID and SHAREPOINT_DRIVE_ID environment variables.'
      );
    }
  }

  /**
   * Create case folder structure in SharePoint
   * Creates: /Cases/{CaseNumber}/Documents/
   *
   * This operation is idempotent - if folders already exist, returns existing structure
   *
   * @param accessToken - User's access token with Sites.ReadWrite.All
   * @param caseNumber - Case number for folder naming
   * @returns Case folder structure with IDs and paths
   */
  async ensureCaseFolder(accessToken: string, caseNumber: string): Promise<CaseFolderStructure> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
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

          logger.info('SharePoint folder structure created/verified', {
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
      'sharepoint-ensure-case-folder'
    );
  }

  /**
   * Upload document to SharePoint
   * Uses simple upload for files <4MB, resumable upload for larger files
   *
   * @param accessToken - User's access token
   * @param caseNumber - Case number for folder path
   * @param fileName - Name of the file
   * @param content - File content as Buffer
   * @param fileType - MIME type of the file
   * @returns SharePoint item metadata
   */
  async uploadDocument(
    accessToken: string,
    caseNumber: string,
    fileName: string,
    content: Buffer,
    fileType: string
  ): Promise<SharePointItem> {
    this.ensureConfigured();

    // Validate file size
    if (content.length > SHAREPOINT_CONFIG.MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${SHAREPOINT_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.has(fileType)) {
      throw new Error(`File type ${fileType} is not allowed`);
    }

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Ensure case folder structure exists
          const folderStructure = await this.ensureCaseFolder(accessToken, caseNumber);

          // Sanitize file name
          const sanitizedFileName = this.sanitizeFileName(fileName);

          let driveItem: DriveItem;

          if (content.length <= SHAREPOINT_CONFIG.SIMPLE_UPLOAD_MAX_SIZE) {
            // Simple upload for small files (<4MB)
            driveItem = await this.simpleUpload(
              client,
              folderStructure.documentsFolder.id,
              sanitizedFileName,
              content,
              fileType
            );
          } else {
            // Resumable upload for large files (>4MB)
            driveItem = await this.resumableUpload(
              client,
              folderStructure.documentsFolder.id,
              sanitizedFileName,
              content,
              fileType
            );
          }

          logger.info('Document uploaded to SharePoint', {
            caseNumber,
            fileName: sanitizedFileName,
            fileSize: content.length,
            sharePointId: driveItem.id,
          });

          return {
            id: driveItem.id!,
            name: driveItem.name!,
            size: driveItem.size!,
            mimeType: driveItem.file?.mimeType || fileType,
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
      'sharepoint-upload-document'
    );
  }

  /**
   * Get preview URL for a document
   * Returns embeddable URL for iframes:
   * - PDFs: MS Graph preview API
   * - Office docs: Office Online embed URL
   * - Images: Direct download URL
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @param mimeType - File MIME type
   * @returns Preview info or null if not supported
   */
  async getPreviewUrl(
    accessToken: string,
    itemId: string,
    mimeType: string
  ): Promise<PreviewInfo | null> {
    this.ensureConfigured();

    const officeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
    ];

    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const textTypes = [
      'text/plain',
      'text/csv',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
    ];
    const isPdf = mimeType === 'application/pdf';
    const isOffice = officeTypes.includes(mimeType);
    const isImage = imageTypes.includes(mimeType);
    const isText = textTypes.includes(mimeType);

    if (!isPdf && !isOffice && !isImage && !isText) {
      logger.debug('Preview not supported for file type', { mimeType, itemId });
      return null;
    }

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const previewEndpoint = graphEndpoints.sharepoint.driveItemPreview(itemId);

          if (isPdf || isOffice) {
            try {
              const previewResponse = await client.api(previewEndpoint).post({});

              if (previewResponse.getUrl) {
                logger.info('Generated SharePoint preview URL', {
                  itemId,
                  mimeType,
                  source: isPdf ? 'pdf' : 'office365',
                });

                return {
                  url: previewResponse.getUrl,
                  source: isPdf ? 'pdf' : 'office365',
                  expiresAt: new Date(Date.now() + SHAREPOINT_CONFIG.PREVIEW_URL_TTL).toISOString(),
                };
              }
            } catch (previewError: any) {
              logger.warn('SharePoint preview API failed, trying fallback', {
                itemId,
                error: previewError.message,
              });
            }

            // Fallback for Office docs: use Office Online viewer
            if (isOffice) {
              const downloadUrl = await this.getDownloadUrl(accessToken, itemId);
              const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(downloadUrl)}`;

              return {
                url: embedUrl,
                source: 'office365',
                expiresAt: new Date(Date.now() + SHAREPOINT_CONFIG.PREVIEW_URL_TTL).toISOString(),
              };
            }

            return null;
          }

          if (isImage) {
            const downloadUrl = await this.getDownloadUrl(accessToken, itemId);
            return {
              url: downloadUrl,
              source: 'image',
              expiresAt: new Date(Date.now() + SHAREPOINT_CONFIG.PREVIEW_URL_TTL).toISOString(),
            };
          }

          // Text files can be displayed directly in browser
          if (isText) {
            const downloadUrl = await this.getDownloadUrl(accessToken, itemId);
            return {
              url: downloadUrl,
              source: 'text',
              expiresAt: new Date(Date.now() + SHAREPOINT_CONFIG.PREVIEW_URL_TTL).toISOString(),
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
      'sharepoint-get-preview-url'
    );
  }

  /**
   * Get download URL for a document
   * Returns direct download URL (expires in ~1 hour)
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @returns Download URL
   */
  async getDownloadUrl(accessToken: string, itemId: string): Promise<string> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);

          const item = await client.api(itemEndpoint).get();

          // Direct download URL is available in item metadata
          const downloadUrl = item['@microsoft.graph.downloadUrl'];
          if (downloadUrl) {
            return downloadUrl;
          }

          // Fallback: create a sharing link
          const linkResponse = await client.api(`${itemEndpoint}/createLink`).post({
            type: 'view',
            scope: 'organization',
          });

          logger.info('Created download link for SharePoint document', {
            itemId,
            expiresAt: linkResponse.expirationDateTime,
          });

          return linkResponse.link.webUrl;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-get-download-url'
    );
  }

  /**
   * Get thumbnails for a document
   * SharePoint auto-generates thumbnails for PDFs, Office docs, and images
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @returns Thumbnail set with URLs for different sizes
   */
  async getThumbnails(accessToken: string, itemId: string): Promise<ThumbnailSet> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const thumbnailEndpoint = graphEndpoints.sharepoint.driveItemThumbnails(itemId);

          const thumbnails = await client.api(thumbnailEndpoint).get();

          if (thumbnails.value && thumbnails.value.length > 0) {
            const thumbnail = thumbnails.value[0];
            return {
              small: thumbnail.small?.url,
              medium: thumbnail.medium?.url,
              large: thumbnail.large?.url,
            };
          }

          return {};
        } catch (error: any) {
          // Thumbnails not available for all file types
          if (error.statusCode === 404) {
            return {};
          }

          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-get-thumbnails'
    );
  }

  /**
   * List documents in a case folder
   *
   * @param accessToken - User's access token
   * @param caseNumber - Case number
   * @returns Array of SharePoint items
   */
  async listCaseDocuments(accessToken: string, caseNumber: string): Promise<SharePointItem[]> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const sanitizedCaseNumber = this.sanitizeFolderName(caseNumber);
          const folderPath = `Cases/${sanitizedCaseNumber}/Documents`;

          // Get folder by path
          const folderEndpoint = graphEndpoints.sharepoint.driveItemByPath(folderPath);

          let folderId: string;
          try {
            const folder = await client.api(folderEndpoint).get();
            folderId = folder.id;
          } catch (error: any) {
            // Folder doesn't exist yet
            if (error.statusCode === 404) {
              return [];
            }
            throw error;
          }

          // List children
          const childrenEndpoint = graphEndpoints.sharepoint.driveItemChildren(folderId);
          const children = await client.api(childrenEndpoint).get();

          return children.value
            .filter((item: DriveItem) => item.file) // Only files, not folders
            .map((item: DriveItem) => ({
              id: item.id!,
              name: item.name!,
              size: item.size!,
              mimeType: item.file?.mimeType || '',
              webUrl: item.webUrl!,
              downloadUrl: (item as any)['@microsoft.graph.downloadUrl'],
              parentPath: `/Cases/${sanitizedCaseNumber}/Documents`,
              createdDateTime: item.createdDateTime!,
              lastModifiedDateTime: item.lastModifiedDateTime!,
            }));
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-list-case-documents'
    );
  }

  /**
   * Delete a document from SharePoint
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   */
  async deleteDocument(accessToken: string, itemId: string): Promise<void> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);

          await client.api(itemEndpoint).delete();

          logger.info('Document deleted from SharePoint', { itemId });
        } catch (error: any) {
          // Ignore 404 - item already deleted
          if (error.statusCode === 404) {
            logger.warn('SharePoint item not found, may already be deleted', { itemId });
            return;
          }

          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-delete-document'
    );
  }

  /**
   * Move a document to a different folder
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @param destinationPath - New folder path (e.g., "Cases/NEW-001/Documents")
   * @returns Updated SharePoint item
   */
  async moveDocument(
    accessToken: string,
    itemId: string,
    destinationPath: string
  ): Promise<SharePointItem> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);

          // Get destination folder ID
          const destFolderEndpoint = graphEndpoints.sharepoint.driveItemByPath(destinationPath);
          const destFolder = await client.api(destFolderEndpoint).get();

          // Move the item
          const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);
          const movedItem = await client.api(itemEndpoint).patch({
            parentReference: {
              id: destFolder.id,
            },
          });

          logger.info('Document moved in SharePoint', {
            itemId,
            destinationPath,
            newParentId: destFolder.id,
          });

          return {
            id: movedItem.id!,
            name: movedItem.name!,
            size: movedItem.size!,
            mimeType: movedItem.file?.mimeType || '',
            webUrl: movedItem.webUrl!,
            downloadUrl: (movedItem as any)['@microsoft.graph.downloadUrl'],
            parentPath: destinationPath,
            createdDateTime: movedItem.createdDateTime!,
            lastModifiedDateTime: movedItem.lastModifiedDateTime!,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-move-document'
    );
  }

  /**
   * Get file metadata from SharePoint
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @returns SharePoint item metadata
   */
  async getFileMetadata(accessToken: string, itemId: string): Promise<SharePointItem> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);

          const item = await client.api(itemEndpoint).get();

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
      'sharepoint-get-file-metadata'
    );
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create or get existing folder in SharePoint
   */
  private async createOrGetFolder(
    client: Client,
    parentId: string,
    folderName: string
  ): Promise<DriveItem> {
    const siteId = process.env.SHAREPOINT_SITE_ID;

    try {
      // Try to create folder
      const parentPath =
        parentId === 'root'
          ? `/sites/${siteId}/drive/root`
          : `/sites/${siteId}/drive/items/${parentId}`;

      const folder = await client.api(`${parentPath}/children`).post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });

      return folder;
    } catch (error: any) {
      // If folder already exists, get it
      if (error.statusCode === 409 || error.code === 'nameAlreadyExists') {
        const parentPath =
          parentId === 'root'
            ? `/sites/${siteId}/drive/root`
            : `/sites/${siteId}/drive/items/${parentId}`;

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
    const siteId = process.env.SHAREPOINT_SITE_ID;

    const response = await client
      .api(`/sites/${siteId}/drive/items/${parentFolderId}:/${fileName}:/content`)
      .header('Content-Type', contentType)
      .put(content);

    return response;
  }

  /**
   * Resumable upload for large files (>4MB)
   */
  private async resumableUpload(
    client: Client,
    parentFolderId: string,
    fileName: string,
    content: Buffer,
    _contentType: string
  ): Promise<DriveItem> {
    const siteId = process.env.SHAREPOINT_SITE_ID;

    // Create upload session
    const session = await client
      .api(`/sites/${siteId}/drive/items/${parentFolderId}:/${fileName}:/createUploadSession`)
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
      const chunkEnd = Math.min(offset + SHAREPOINT_CONFIG.CHUNK_SIZE, fileSize);
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

      logger.debug('SharePoint upload progress', {
        fileName,
        progress: `${Math.round((offset / fileSize) * 100)}%`,
      });
    }

    return await response.json();
  }

  /**
   * Sanitize folder name for SharePoint
   */
  private sanitizeFolderName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*#%]/g, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace whitespace with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 255);
  }

  /**
   * Sanitize file name for SharePoint
   */
  private sanitizeFileName(name: string): string {
    const lastDot = name.lastIndexOf('.');
    const baseName = lastDot > 0 ? name.substring(0, lastDot) : name;
    const extension = lastDot > 0 ? name.substring(lastDot) : '';

    const sanitizedBase = baseName
      .replace(/[<>:"/\\|?*#%]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 250 - extension.length);

    return sanitizedBase + extension;
  }
}

// Export singleton instance
export const sharePointService = new SharePointService();
