/**
 * OneDrive Export Service for Legacy Document Import
 * Story 3.2.5 - Exports categorized documents to OneDrive for AI training
 *
 * Folder structure: /AI-Training/{CategoryName}/
 * Each category folder contains:
 *   - Categorized document files
 *   - _metadata.json with document details
 */

import { Client } from '@microsoft/microsoft-graph-client';
import type { DriveItem } from '@microsoft/microsoft-graph-types';
import { downloadFromR2 } from '@/lib/r2-storage';

// Configuration
const CHUNK_SIZE = 320 * 1024; // 320KB chunks for resumable upload
const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024; // 4MB max for simple upload
const MAX_CONCURRENT_UPLOADS = 5;

export interface DocumentToExport {
  id: string;
  fileName: string;
  fileExtension: string;
  storagePath: string;
  categoryName: string;
  originalFileName: string;
  folderPath: string;
  isSent: boolean;
  emailSubject: string | null;
  emailSender: string | null;
  emailDate: string | null;
  primaryLanguage: string | null;
  documentType: string | null;
  templatePotential: string | null;
}

export interface CategoryMetadata {
  category: string;
  documentCount: number;
  exportedAt: string;
  documents: {
    fileName: string;
    originalFileName: string;
    originalFolderPath: string;
    emailSubject: string | null;
    emailSender: string | null;
    emailDate: string | null;
    isSent: boolean;
    primaryLanguage: string | null;
    documentType: string | null;
    templatePotential: string | null;
    fileSize: number;
  }[];
}

export interface ExportProgress {
  totalDocuments: number;
  uploadedDocuments: number;
  currentCategory: string;
  status: 'preparing' | 'uploading' | 'finalizing' | 'complete' | 'error';
  error?: string;
}

export interface ExportResult {
  success: boolean;
  categoriesExported: number;
  documentsExported: number;
  oneDrivePath: string;
  errors: string[];
}

/**
 * Create a Microsoft Graph client from an access token
 */
function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * OneDrive Export Service Class
 */
export class OneDriveExportService {
  private client: Client;
  private progressCallback?: (progress: ExportProgress) => void;

  constructor(accessToken: string) {
    this.client = createGraphClient(accessToken);
  }

  /**
   * Set progress callback for real-time updates
   */
  onProgress(callback: (progress: ExportProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Export all categorized documents to OneDrive
   */
  async exportToOneDrive(
    documents: DocumentToExport[],
    sessionId: string
  ): Promise<ExportResult> {
    const errors: string[] = [];
    let uploadedCount = 0;

    // Group documents by category
    const categoryMap = new Map<string, DocumentToExport[]>();
    for (const doc of documents) {
      const existing = categoryMap.get(doc.categoryName) || [];
      existing.push(doc);
      categoryMap.set(doc.categoryName, existing);
    }

    this.updateProgress({
      totalDocuments: documents.length,
      uploadedDocuments: 0,
      currentCategory: '',
      status: 'preparing',
    });

    try {
      // Create AI-Training root folder
      const aiTrainingFolder = await this.createOrGetFolder('root', 'AI-Training');

      // Process each category
      for (const [categoryName, categoryDocs] of categoryMap.entries()) {
        this.updateProgress({
          totalDocuments: documents.length,
          uploadedDocuments: uploadedCount,
          currentCategory: categoryName,
          status: 'uploading',
        });

        try {
          // Create category folder
          const sanitizedCategoryName = this.sanitizeFolderName(categoryName);
          const categoryFolder = await this.createOrGetFolder(
            aiTrainingFolder.id!,
            sanitizedCategoryName
          );

          // Upload documents in batches
          const uploadResults = await this.uploadDocumentBatch(
            categoryFolder.id!,
            categoryDocs,
            (uploaded) => {
              uploadedCount += uploaded;
              this.updateProgress({
                totalDocuments: documents.length,
                uploadedDocuments: uploadedCount,
                currentCategory: categoryName,
                status: 'uploading',
              });
            }
          );

          // Track any errors
          errors.push(...uploadResults.errors);

          // Generate and upload metadata JSON
          const metadata = await this.generateCategoryMetadata(
            categoryName,
            categoryDocs,
            uploadResults.uploadedDocs
          );

          await this.uploadMetadataJson(categoryFolder.id!, metadata);
        } catch (err) {
          const errorMessage = `Failed to export category ${categoryName}: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`;
          errors.push(errorMessage);
        }
      }

      // Generate and upload session summary
      this.updateProgress({
        totalDocuments: documents.length,
        uploadedDocuments: uploadedCount,
        currentCategory: 'Finalizing...',
        status: 'finalizing',
      });

      await this.uploadSessionSummary(
        aiTrainingFolder.id!,
        sessionId,
        categoryMap,
        documents.length,
        uploadedCount
      );

      this.updateProgress({
        totalDocuments: documents.length,
        uploadedDocuments: uploadedCount,
        currentCategory: '',
        status: 'complete',
      });

      return {
        success: errors.length === 0,
        categoriesExported: categoryMap.size,
        documentsExported: uploadedCount,
        oneDrivePath: '/AI-Training',
        errors,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      this.updateProgress({
        totalDocuments: documents.length,
        uploadedDocuments: uploadedCount,
        currentCategory: '',
        status: 'error',
        error: errorMessage,
      });

      return {
        success: false,
        categoriesExported: 0,
        documentsExported: uploadedCount,
        oneDrivePath: '/AI-Training',
        errors: [errorMessage, ...errors],
      };
    }
  }

  /**
   * Upload a batch of documents with concurrency control
   */
  private async uploadDocumentBatch(
    folderId: string,
    docs: DocumentToExport[],
    onProgress: (uploaded: number) => void
  ): Promise<{ uploadedDocs: Map<string, number>; errors: string[] }> {
    const uploadedDocs = new Map<string, number>(); // docId -> fileSize
    const errors: string[] = [];

    // Process in batches of MAX_CONCURRENT_UPLOADS
    for (let i = 0; i < docs.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = docs.slice(i, i + MAX_CONCURRENT_UPLOADS);

      const results = await Promise.allSettled(
        batch.map(async (doc) => {
          try {
            // Download from R2
            const fileBuffer = await downloadFromR2(doc.storagePath);

            // Generate unique filename (include doc ID to avoid collisions)
            const fileName = this.generateFileName(doc);

            // Upload to OneDrive
            await this.uploadFile(folderId, fileName, fileBuffer, doc.fileExtension);

            uploadedDocs.set(doc.id, fileBuffer.length);
            return { success: true, docId: doc.id };
          } catch (err) {
            return {
              success: false,
              docId: doc.id,
              error: err instanceof Error ? err.message : 'Upload failed',
            };
          }
        })
      );

      // Count successful uploads for progress
      let batchUploaded = 0;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          batchUploaded++;
        } else if (result.status === 'fulfilled' && !result.value.success) {
          errors.push(`Document ${result.value.docId}: ${result.value.error}`);
        } else if (result.status === 'rejected') {
          errors.push(`Upload failed: ${result.reason}`);
        }
      }

      onProgress(batchUploaded);
    }

    return { uploadedDocs, errors };
  }

  /**
   * Generate a safe file name for OneDrive
   */
  private generateFileName(doc: DocumentToExport): string {
    const baseName = doc.originalFileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[<>:"/\\|?*]/g, '_') // Remove invalid chars
      .substring(0, 100); // Limit length

    const shortId = doc.id.substring(0, 8);
    return `${baseName}-${shortId}.${doc.fileExtension}`;
  }

  /**
   * Upload a file to OneDrive
   */
  private async uploadFile(
    folderId: string,
    fileName: string,
    content: Buffer,
    extension: string
  ): Promise<DriveItem> {
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
    };
    const contentType = contentTypeMap[extension] || 'application/octet-stream';

    if (content.length <= SIMPLE_UPLOAD_MAX) {
      // Simple upload for small files
      return this.client
        .api(`/me/drive/items/${folderId}:/${fileName}:/content`)
        .header('Content-Type', contentType)
        .put(content);
    } else {
      // Resumable upload for large files
      return this.resumableUpload(folderId, fileName, content, contentType);
    }
  }

  /**
   * Resumable upload for large files
   */
  private async resumableUpload(
    folderId: string,
    fileName: string,
    content: Buffer,
    _contentType: string
  ): Promise<DriveItem> {
    // Create upload session
    const session = await this.client
      .api(`/me/drive/items/${folderId}:/${fileName}:/createUploadSession`)
      .post({
        item: {
          '@microsoft.graph.conflictBehavior': 'replace',
          name: fileName,
        },
      });

    const uploadUrl = session.uploadUrl;
    const fileSize = content.length;
    let offset = 0;
    let response: Response;

    // Upload in chunks
    while (offset < fileSize) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE, fileSize);
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
        throw new Error(`Upload chunk failed: ${response.status}`);
      }

      offset = chunkEnd;
    }

    return response!.json();
  }

  /**
   * Generate category metadata JSON
   */
  private async generateCategoryMetadata(
    categoryName: string,
    docs: DocumentToExport[],
    uploadedDocs: Map<string, number>
  ): Promise<CategoryMetadata> {
    return {
      category: categoryName,
      documentCount: uploadedDocs.size,
      exportedAt: new Date().toISOString(),
      documents: docs
        .filter((doc) => uploadedDocs.has(doc.id))
        .map((doc) => ({
          fileName: this.generateFileName(doc),
          originalFileName: doc.originalFileName,
          originalFolderPath: doc.folderPath,
          emailSubject: doc.emailSubject,
          emailSender: doc.emailSender,
          emailDate: doc.emailDate,
          isSent: doc.isSent,
          primaryLanguage: doc.primaryLanguage,
          documentType: doc.documentType,
          templatePotential: doc.templatePotential,
          fileSize: uploadedDocs.get(doc.id) || 0,
        })),
    };
  }

  /**
   * Upload metadata JSON to category folder
   */
  private async uploadMetadataJson(
    folderId: string,
    metadata: CategoryMetadata
  ): Promise<void> {
    const content = Buffer.from(JSON.stringify(metadata, null, 2));

    await this.client
      .api(`/me/drive/items/${folderId}:/_metadata.json:/content`)
      .header('Content-Type', 'application/json')
      .put(content);
  }

  /**
   * Upload session summary JSON
   */
  private async uploadSessionSummary(
    aiTrainingFolderId: string,
    sessionId: string,
    categoryMap: Map<string, DocumentToExport[]>,
    totalDocs: number,
    uploadedDocs: number
  ): Promise<void> {
    const summary = {
      sessionId,
      exportedAt: new Date().toISOString(),
      totalDocuments: totalDocs,
      documentsExported: uploadedDocs,
      categories: Array.from(categoryMap.entries()).map(([name, docs]) => ({
        name,
        documentCount: docs.length,
        folderPath: `/AI-Training/${this.sanitizeFolderName(name)}`,
      })),
    };

    const content = Buffer.from(JSON.stringify(summary, null, 2));

    await this.client
      .api(`/me/drive/items/${aiTrainingFolderId}:/_session_summary.json:/content`)
      .header('Content-Type', 'application/json')
      .put(content);
  }

  /**
   * Create or get existing folder
   */
  private async createOrGetFolder(
    parentId: string,
    folderName: string
  ): Promise<DriveItem> {
    const parentPath =
      parentId === 'root' ? '/me/drive/root' : `/me/drive/items/${parentId}`;

    try {
      // Try to create folder
      return await this.client.api(`${parentPath}/children`).post({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });
    } catch (error: any) {
      // If folder already exists, get it
      if (error.statusCode === 409 || error.code === 'nameAlreadyExists') {
        const children = await this.client
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
   * Sanitize folder name for OneDrive
   */
  private sanitizeFolderName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 255);
  }

  /**
   * Update progress callback
   */
  private updateProgress(progress: ExportProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}
