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

// Chunk upload resilience settings
const CHUNK_UPLOAD_TIMEOUT_MS = 60000; // 60 seconds timeout per chunk
const CHUNK_MAX_RETRIES = 3; // Max retries per chunk

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
  /** Direct file URL for ms-word: protocol (bypasses WOPI) */
  directUrl?: string;
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
 * Client folder structure in SharePoint (for client inbox documents)
 */
export interface ClientFolderStructure {
  clientFolder: {
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

/**
 * Result of checking if a SharePoint document has changed
 */
export interface ChangeDetectionResult {
  /** Whether the document has been modified since the known timestamp */
  changed: boolean;
  /** Current metadata (null if document was deleted) */
  currentMetadata: SharePointItem | null;
  /** Current eTag for future comparisons */
  currentETag?: string;
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
   * Create client folder structure in SharePoint
   * Creates: /Clients/{ClientName}/Documents/
   *
   * This operation is idempotent - if folders already exist, returns existing structure
   *
   * @param accessToken - User's access token with Sites.ReadWrite.All
   * @param clientName - Client name for folder naming
   * @returns Client folder structure with IDs and paths
   */
  async ensureClientFolder(
    accessToken: string,
    clientName: string
  ): Promise<ClientFolderStructure> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const sanitizedClientName = this.sanitizeFolderName(clientName);

          // Create or get Clients root folder
          const clientsFolder = await this.createOrGetFolder(client, 'root', 'Clients');

          // Create or get client-specific folder
          const clientFolder = await this.createOrGetFolder(
            client,
            clientsFolder.id!,
            sanitizedClientName
          );

          // Create or get Documents subfolder
          const documentsFolder = await this.createOrGetFolder(
            client,
            clientFolder.id!,
            'Documents'
          );

          logger.info('SharePoint client folder structure created/verified', {
            clientName: sanitizedClientName,
            clientFolderId: clientFolder.id,
            documentsFolderId: documentsFolder.id,
          });

          return {
            clientFolder: {
              id: clientFolder.id!,
              webUrl: clientFolder.webUrl!,
              path: `/Clients/${sanitizedClientName}`,
            },
            documentsFolder: {
              id: documentsFolder.id!,
              webUrl: documentsFolder.webUrl!,
              path: `/Clients/${sanitizedClientName}/Documents`,
            },
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-ensure-client-folder'
    );
  }

  /**
   * Upload document to client folder in SharePoint
   * Creates: /Clients/{ClientName}/Documents/{FileName}
   *
   * Uses simple upload for files <4MB, resumable upload for larger files
   *
   * @param accessToken - User's access token
   * @param clientName - Client name for folder path
   * @param fileName - Name of the file
   * @param content - File content as Buffer
   * @param fileType - MIME type of the file
   * @returns SharePoint item metadata
   */
  async uploadDocumentToClientFolder(
    accessToken: string,
    clientName: string,
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

          // Ensure client folder structure exists
          const folderStructure = await this.ensureClientFolder(accessToken, clientName);

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

          logger.info('Document uploaded to SharePoint client folder', {
            clientName,
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
      'sharepoint-upload-client-document'
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
              // OPS-125: Request 150% zoom for Office files (zoom: 1.5 = 150%)
              // Note: zoom param works for Office files but is ignored for PDFs (MS limitation)
              const previewResponse = await client.api(previewEndpoint).post({ zoom: 1.5 });

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
              // OPS-125: Attempt to set 100% zoom - these params are not officially documented
              // but some may work empirically
              const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(downloadUrl)}&wdStartOn=1&wdZoom=100`;

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

  // ============================================================================
  // App-Only Client Methods (for background workers)
  // ============================================================================

  /**
   * Get download URL using app-only client
   * For use with app-only tokens in background workers
   *
   * @param graphClient - Pre-authenticated Graph client (app-only)
   * @param itemId - SharePoint item ID
   * @returns Download URL
   */
  async getDownloadUrlWithClient(graphClient: Client, itemId: string): Promise<string> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);

          const item = await graphClient.api(itemEndpoint).get();

          // Direct download URL is available in item metadata
          const downloadUrl = item['@microsoft.graph.downloadUrl'];
          if (downloadUrl) {
            return downloadUrl;
          }

          // Fallback: create a sharing link
          const linkResponse = await graphClient.api(`${itemEndpoint}/createLink`).post({
            type: 'view',
            scope: 'organization',
          });

          logger.info('Created download link for SharePoint document (app client)', {
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
      'sharepoint-get-download-url-app'
    );
  }

  /**
   * Get thumbnails using app-only client
   * For use with app-only tokens in background workers
   *
   * @param graphClient - Pre-authenticated Graph client (app-only)
   * @param itemId - SharePoint item ID
   * @returns Thumbnail set with URLs for different sizes
   */
  async getThumbnailsWithClient(graphClient: Client, itemId: string): Promise<ThumbnailSet> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const thumbnailEndpoint = graphEndpoints.sharepoint.driveItemThumbnails(itemId);

          const thumbnails = await graphClient.api(thumbnailEndpoint).get();

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
      'sharepoint-get-thumbnails-app'
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
   * Copy a file within SharePoint to a new location
   * OPS-175: Used for promoting email attachments to working documents
   *
   * @param accessToken - User's access token
   * @param sourceItemId - SharePoint item ID of the source file
   * @param destinationPath - Destination folder path (e.g., "Cases/ABC-001/Documents/Working")
   * @param newFileName - Optional new file name (uses source name if not provided)
   * @returns SharePoint item metadata for the copied file
   */
  async copyFile(
    accessToken: string,
    sourceItemId: string,
    destinationPath: string,
    newFileName?: string
  ): Promise<SharePointItem> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const siteId = process.env.SHAREPOINT_SITE_ID;

          // Get source file metadata to preserve file name if not specified
          const sourceItem = await this.getFileMetadata(accessToken, sourceItemId);
          const targetFileName = newFileName || sourceItem.name;

          // Ensure destination folder exists (create if necessary)
          // Parse the path to create folders recursively
          const pathParts = destinationPath.split('/').filter(Boolean);
          let currentParentId = 'root';

          for (const folderName of pathParts) {
            const folder = await this.createOrGetFolder(client, currentParentId, folderName);
            currentParentId = folder.id!;
          }

          // Copy the file to the destination folder
          const sourceEndpoint = `/sites/${siteId}/drive/items/${sourceItemId}`;
          const copyResponse = await client.api(`${sourceEndpoint}/copy`).post({
            parentReference: {
              driveId: process.env.SHAREPOINT_DRIVE_ID,
              id: currentParentId,
            },
            name: targetFileName,
          });

          // The copy operation is asynchronous in SharePoint
          // For small files, it's usually instant, but we may get a 202 with a Location header
          // For now, we'll wait a moment and fetch the new item
          // The copyResponse contains a Location header with the monitor URL

          // Wait for copy to complete (poll if needed)
          let copiedItem: DriveItem | null = null;
          const maxAttempts = 10;
          const pollInterval = 500; // ms

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              // Try to find the copied file in the destination folder
              const children = await client
                .api(`/sites/${siteId}/drive/items/${currentParentId}/children`)
                .filter(`name eq '${this.escapeODataString(targetFileName)}'`)
                .get();

              if (children.value && children.value.length > 0) {
                copiedItem = children.value[0];
                break;
              }
            } catch {
              // File not found yet, continue polling
            }

            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }

          if (!copiedItem) {
            throw new Error('Copy operation did not complete in time');
          }

          logger.info('File copied in SharePoint', {
            sourceItemId,
            destinationPath,
            newItemId: copiedItem.id,
            fileName: targetFileName,
          });

          return {
            id: copiedItem.id!,
            name: copiedItem.name!,
            size: copiedItem.size!,
            mimeType: copiedItem.file?.mimeType || sourceItem.mimeType,
            webUrl: copiedItem.webUrl!,
            downloadUrl: (copiedItem as any)['@microsoft.graph.downloadUrl'],
            parentPath: destinationPath,
            createdDateTime: copiedItem.createdDateTime!,
            lastModifiedDateTime: copiedItem.lastModifiedDateTime!,
          };
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-copy-file'
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

          // Construct edit URL for ms-word: protocol
          // The webUrl from Graph API is a WOPI URL that may open in read-only mode
          // We modify the URL to force edit mode by changing/adding action=edit
          let directUrl: string | undefined;
          const parentPath = item.parentReference?.path || '';
          if (item.webUrl) {
            // Check if it's a WOPI URL (contains _layouts/15/Doc.aspx)
            if (item.webUrl.includes('_layouts/15/Doc.aspx')) {
              // Modify the WOPI URL to force edit mode
              const url = new URL(item.webUrl);
              url.searchParams.set('action', 'edit');
              url.searchParams.delete('mobileredirect'); // Remove mobile redirect
              directUrl = url.toString();
            } else {
              // Already a direct URL, use as-is
              directUrl = item.webUrl;
            }
          }

          return {
            id: item.id,
            name: item.name,
            size: item.size,
            mimeType: item.file?.mimeType || '',
            webUrl: item.webUrl,
            directUrl,
            downloadUrl: item['@microsoft.graph.downloadUrl'],
            parentPath,
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

  /**
   * Get an editable share link for a document
   * Uses Microsoft Graph createLink API with type='edit' to generate
   * a URL with embedded edit permissions that works with ms-word: protocol
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @returns URL with edit permissions
   */
  async getEditableShareLink(accessToken: string, itemId: string): Promise<string> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);

          // Create an edit link using Graph API
          // This generates a URL with embedded edit permissions
          const linkResponse = await client.api(`${itemEndpoint}/createLink`).post({
            type: 'edit',
            scope: 'organization',
          });

          logger.info('Created editable share link for SharePoint document', {
            itemId,
            linkType: linkResponse.link?.type,
          });

          return linkResponse.link.webUrl;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-get-editable-share-link'
    );
  }

  /**
   * Check if a SharePoint document has been modified since a known timestamp
   * OPS-179: SharePoint Change Detection Methods
   *
   * Used for lazy version detection when users return from editing in Word.
   * Compares the current lastModifiedDateTime against the known baseline.
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @param knownLastModified - ISO timestamp of last known modification
   * @returns Whether document changed and current metadata
   */
  async checkForChanges(
    accessToken: string,
    itemId: string,
    knownLastModified: string
  ): Promise<ChangeDetectionResult> {
    this.ensureConfigured();

    try {
      const metadata = await this.getFileMetadata(accessToken, itemId);

      // Compare timestamps - document is changed if lastModifiedDateTime differs
      const knownDate = new Date(knownLastModified).getTime();
      const currentDate = new Date(metadata.lastModifiedDateTime).getTime();
      const changed = currentDate !== knownDate;

      if (changed) {
        logger.info('SharePoint document change detected', {
          itemId,
          knownLastModified,
          currentLastModified: metadata.lastModifiedDateTime,
        });
      }

      return {
        changed,
        currentMetadata: metadata,
      };
    } catch (error: any) {
      // Handle 404 - document was deleted
      if (error.statusCode === 404 || error.code === 'itemNotFound') {
        logger.warn('SharePoint document deleted during change detection', { itemId });
        return {
          changed: true,
          currentMetadata: null,
        };
      }
      throw error;
    }
  }

  /**
   * Check if a SharePoint document has changed using eTag (faster)
   * OPS-179: SharePoint Change Detection Methods
   *
   * Uses the MS Graph API to check eTag without fetching full metadata.
   * ETags change on any modification, making this a reliable change detector.
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @param knownETag - Known eTag to compare against
   * @returns Whether document changed and current eTag
   */
  async checkForChangesByETag(
    accessToken: string,
    itemId: string,
    knownETag: string
  ): Promise<{ changed: boolean; currentETag: string | null }> {
    this.ensureConfigured();

    try {
      const client = createGraphClient(accessToken);
      const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);

      // Request only eTag field for efficiency
      const item = await client.api(itemEndpoint).select('id,eTag').get();

      const currentETag = item.eTag;
      const changed = currentETag !== knownETag;

      if (changed) {
        logger.info('SharePoint document eTag change detected', {
          itemId,
          knownETag,
          currentETag,
        });
      }

      return {
        changed,
        currentETag,
      };
    } catch (error: any) {
      // Handle 404 - document was deleted
      if (error.statusCode === 404 || error.code === 'itemNotFound') {
        logger.warn('SharePoint document deleted during eTag check', { itemId });
        return {
          changed: true,
          currentETag: null,
        };
      }

      const parsedError = parseGraphError(error);
      logGraphError(parsedError);
      throw parsedError;
    }
  }

  /**
   * Download document content from SharePoint
   * OPS-180: Downloads file content as Buffer for R2 backup sync and version creation
   *
   * @param accessToken - User's access token
   * @param itemId - SharePoint item ID
   * @returns Buffer containing file content
   */
  async downloadDocument(accessToken: string, itemId: string): Promise<Buffer> {
    this.ensureConfigured();

    return retryWithBackoff(
      async () => {
        try {
          const client = createGraphClient(accessToken);
          const itemEndpoint = graphEndpoints.sharepoint.driveItem(itemId);

          // Get the item metadata which includes the download URL
          const item = await client.api(itemEndpoint).get();
          const downloadUrl = item['@microsoft.graph.downloadUrl'];

          if (!downloadUrl) {
            throw new Error('No download URL available for document');
          }

          // Fetch the content using the pre-authenticated download URL
          const response = await fetch(downloadUrl);

          if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          logger.info('Document downloaded from SharePoint', {
            itemId,
            fileName: item.name,
            size: buffer.length,
          });

          return buffer;
        } catch (error: any) {
          const parsedError = parseGraphError(error);
          logGraphError(parsedError);
          throw parsedError;
        }
      },
      {},
      'sharepoint-download-document'
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
          .filter(`name eq '${this.escapeODataString(folderName)}'`)
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
   * Upload a single chunk with timeout and retry logic
   */
  private async uploadChunkWithRetry(
    uploadUrl: string,
    chunk: Buffer,
    contentRange: string,
    fileName: string,
    attempt: number = 1
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHUNK_UPLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length.toString(),
          'Content-Range': contentRange,
        },
        body: new Uint8Array(chunk),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 202 Accepted means chunk uploaded, continue with next chunk
      // 200/201 means upload complete
      if (!response.ok && response.status !== 202) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Chunk upload failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      const isTimeout = error.name === 'AbortError';
      const isNetworkError =
        error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';
      const isRetryable = isTimeout || isNetworkError;

      if (isRetryable && attempt < CHUNK_MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        logger.warn('[SharePoint] Chunk upload failed, retrying', {
          fileName,
          contentRange,
          attempt,
          maxAttempts: CHUNK_MAX_RETRIES,
          delay,
          error: error.message,
          isTimeout,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.uploadChunkWithRetry(uploadUrl, chunk, contentRange, fileName, attempt + 1);
      }

      logger.error('[SharePoint] Chunk upload failed after retries', {
        fileName,
        contentRange,
        attempts: attempt,
        error: error.message,
      });
      throw error;
    }
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

      try {
        response = await this.uploadChunkWithRetry(uploadUrl, chunk, contentRange, fileName);
      } catch (error: any) {
        logger.error('[SharePoint] Resumable upload failed', {
          fileName,
          fileSize,
          failedAtOffset: offset,
          totalChunks: Math.ceil(fileSize / SHAREPOINT_CONFIG.CHUNK_SIZE),
          completedChunks: Math.floor(offset / SHAREPOINT_CONFIG.CHUNK_SIZE),
          error: error.message,
        });
        throw new Error(`Upload failed at offset ${offset}/${fileSize}: ${error.message}`);
      }

      offset = chunkEnd;

      // Log progress for large files
      if (fileSize > 10 * 1024 * 1024) {
        // >10MB
        logger.debug('[SharePoint] Upload progress', {
          fileName,
          progress: `${Math.round((offset / fileSize) * 100)}%`,
        });
      }
    }

    return await response.json();
  }

  /**
   * Escape a string value for use in OData filter queries.
   * Single quotes must be doubled (e.g., "O'Brien" → "O''Brien").
   */
  private escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Sanitize folder name for SharePoint
   * Public method to allow external callers to build proper folder paths
   *
   * Handles:
   * - SharePoint/Windows invalid chars: " * : < > ? / \ |
   * - URL-breaking chars: # %
   * - OData filter-breaking chars: ' & ~
   * - Control characters (0x00-0x1F)
   * - Leading/trailing periods and spaces
   * - Empty results (returns 'unnamed')
   */
  sanitizeFolderName(name: string): string {
    const sanitized = name
      .replace(/[\x00-\x1F]/g, '') // Remove control characters
      .replace(/[<>:"/\\|?*#%'&~]/g, '_') // Replace invalid/problematic characters
      .replace(/\s+/g, '_') // Replace whitespace with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^[_.\s]+|[_.\s]+$/g, '') // Remove leading/trailing underscores, periods, spaces
      .substring(0, 255);

    // Ensure we don't return empty string
    return sanitized || 'unnamed';
  }

  /**
   * Sanitize file name for SharePoint
   *
   * Handles same edge cases as sanitizeFolderName but preserves file extension
   */
  private sanitizeFileName(name: string): string {
    const lastDot = name.lastIndexOf('.');
    const baseName = lastDot > 0 ? name.substring(0, lastDot) : name;
    const extension = lastDot > 0 ? name.substring(lastDot) : '';

    const sanitizedBase = baseName
      .replace(/[\x00-\x1F]/g, '') // Remove control characters
      .replace(/[<>:"/\\|?*#%'&~]/g, '_') // Replace invalid/problematic characters
      .replace(/\s+/g, '_') // Replace whitespace with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^[_.\s]+|[_.\s]+$/g, '') // Remove leading/trailing underscores, periods, spaces
      .substring(0, 250 - extension.length);

    // Ensure we don't return empty string
    return (sanitizedBase || 'unnamed') + extension;
  }
}

// Export singleton instance
export const sharePointService = new SharePointService();
