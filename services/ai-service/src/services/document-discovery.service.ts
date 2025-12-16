/**
 * Document Discovery Service
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Discovers new documents in OneDrive /AI-Training/ folders for processing
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { DriveItem } from '@microsoft/microsoft-graph-types';
import { prisma } from '@legal-platform/database';
import type {
  DiscoverDocumentsInput,
  DiscoverDocumentsOutput,
  TrainingDocumentMetadata,
} from '@legal-platform/types';
import logger from '../lib/logger';

interface DocumentDiscoveryItem {
  oneDriveFileId: string;
  fileName: string;
  category: string;
  folderPath: string;
  metadata?: TrainingDocumentMetadata;
}

/**
 * Document Discovery Service Class
 * Scans OneDrive /AI-Training/ folders for new documents
 */
export class DocumentDiscoveryService {
  /**
   * Create Graph API client from access token
   * @param accessToken - Microsoft Graph API access token
   */
  private createGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  /**
   * Discover new documents in OneDrive training folders
   * @param accessToken - Microsoft Graph API access token
   * @param input - Discovery input parameters
   * @returns List of newly discovered documents
   */
  async discoverDocuments(
    accessToken: string,
    input: DiscoverDocumentsInput
  ): Promise<DiscoverDocumentsOutput> {
    const startTime = Date.now();
    const newDocuments: DocumentDiscoveryItem[] = [];

    try {
      const client = this.createGraphClient(accessToken);

      // Get AI-Training root folder
      const trainingFolderId = await this.getOrCreateFolder(client, 'root', 'AI-Training');

      // Process each category folder
      for (const categoryName of input.categoryFolders) {
        try {
          const categoryFolderId = await this.getOrCreateFolder(
            client,
            trainingFolderId,
            categoryName
          );

          // Read category metadata if available
          const categoryMetadata = await this.readMetadataFile(client, categoryFolderId);

          // Get all files in category folder
          const files = await this.listFilesInFolder(client, categoryFolderId);

          // Filter out already processed documents
          const unprocessedFiles = await this.filterUnprocessedDocuments(
            files,
            categoryName,
            categoryMetadata
          );

          newDocuments.push(...unprocessedFiles);

          logger.info('Category folder scanned', {
            category: categoryName,
            totalFiles: files.length,
            newFiles: unprocessedFiles.length,
            hasMetadata: categoryMetadata !== null,
          });
        } catch (error) {
          logger.error('Error scanning category folder', {
            category: categoryName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Document discovery completed', {
        totalNewDocuments: newDocuments.length,
        categoriesScanned: input.categoryFolders.length,
        durationMs: duration,
      });

      return {
        newDocuments,
        totalFound: newDocuments.length,
      };
    } catch (error) {
      logger.error('Document discovery failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get or create folder in OneDrive
   * @param client - Graph API client
   * @param parentId - Parent folder ID or 'root'
   * @param folderName - Folder name to create or get
   * @returns Folder ID
   */
  private async getOrCreateFolder(
    client: Client,
    parentId: string,
    folderName: string
  ): Promise<string> {
    try {
      // Try to get existing folder
      const basePath =
        parentId === 'root' ? '/me/drive/root/children' : `/me/drive/items/${parentId}/children`;

      const response = await client
        .api(basePath)
        .filter(`name eq '${folderName}' and folder ne null`)
        .get();

      if (response.value && response.value.length > 0) {
        return response.value[0].id;
      }

      // Create folder if doesn't exist
      const newFolder = await client.api(basePath).post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      });

      return newFolder.id;
    } catch (error) {
      logger.error('Failed to get or create folder', {
        parentId,
        folderName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * List all files in a folder
   * @param client - Graph API client
   * @param folderId - Folder ID
   * @returns List of files
   */
  private async listFilesInFolder(client: Client, folderId: string): Promise<DriveItem[]> {
    try {
      const files: DriveItem[] = [];
      let nextLink: string | undefined;

      do {
        const response = nextLink
          ? await client.api(nextLink).get()
          : await client
              .api(`/me/drive/items/${folderId}/children`)
              .filter('file ne null')
              .select('id,name,size,file,parentReference,createdDateTime')
              .get();

        if (response.value) {
          files.push(...response.value);
        }

        nextLink = response['@odata.nextLink'];
      } while (nextLink);

      return files;
    } catch (error) {
      logger.error('Failed to list files in folder', {
        folderId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Filter out documents that have already been processed
   * @param files - List of OneDrive files
   * @param category - Document category
   * @param categoryMetadata - Optional metadata from _metadata.json
   * @returns List of unprocessed documents
   */
  private async filterUnprocessedDocuments(
    files: DriveItem[],
    category: string,
    categoryMetadata?: Record<string, any> | null
  ): Promise<DocumentDiscoveryItem[]> {
    const supportedExtensions = new Set(['.pdf', '.docx', '.doc']);
    const unprocessed: DocumentDiscoveryItem[] = [];

    for (const file of files) {
      if (!file.id || !file.name) continue;

      // Check if file extension is supported
      const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!supportedExtensions.has(extension)) continue;

      // Check if already processed
      const existing = await prisma.trainingDocument.findUnique({
        where: { oneDriveFileId: file.id },
        select: { id: true },
      });

      if (!existing) {
        // Merge file-specific metadata from _metadata.json if available
        const fileMetadata = categoryMetadata?.files?.[file.name];

        unprocessed.push({
          oneDriveFileId: file.id,
          fileName: file.name,
          category,
          folderPath: file.parentReference?.path || '',
          metadata: {
            fileSize: file.size,
            createdDateTime: file.createdDateTime,
            // Include category-level metadata
            categoryDescription: categoryMetadata?.description,
            categoryTags: categoryMetadata?.tags,
            // Include file-specific metadata from _metadata.json
            ...fileMetadata,
          },
        });
      }
    }

    return unprocessed;
  }

  /**
   * Read metadata JSON file from category folder
   * @param client - Graph API client
   * @param folderId - Folder ID
   * @returns Metadata object or null
   */
  private async readMetadataFile(
    client: Client,
    folderId: string
  ): Promise<Record<string, any> | null> {
    try {
      const response = await client
        .api(`/me/drive/items/${folderId}/children`)
        .filter(`name eq '_metadata.json'`)
        .get();

      if (response.value && response.value.length > 0) {
        const metadataFileId = response.value[0].id;
        const content = await client.api(`/me/drive/items/${metadataFileId}/content`).get();

        return JSON.parse(content);
      }

      return null;
    } catch (error) {
      logger.warn('Failed to read metadata file', {
        folderId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Download file content from OneDrive
   * @param accessToken - Microsoft Graph API access token
   * @param fileId - OneDrive file ID
   * @returns File content as Buffer
   */
  async downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
    try {
      const client = this.createGraphClient(accessToken);
      const content = await client.api(`/me/drive/items/${fileId}/content`).getStream();

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('Failed to download file', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const documentDiscoveryService = new DocumentDiscoveryService();
