/**
 * PST Parser Service
 * Extracts emails and attachments from Outlook PST files
 * Part of Story 3.2.5 - Legacy Document Import
 */

import * as pst from 'pst-extractor';
import { v4 as uuidv4 } from 'uuid';

// Supported file extensions for extraction
const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc'] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export interface EmailMetadata {
  subject: string;
  senderName: string;
  senderEmail: string;
  receiverName: string;
  receiverEmail: string;
  receivedDate: Date;
  sentDate: Date | null;
}

export interface ExtractedAttachment {
  id: string;
  fileName: string;
  fileExtension: SupportedExtension;
  fileSizeBytes: number;
  content: Buffer;
  folderPath: string;
  isSent: boolean;
  emailMetadata: EmailMetadata;
  monthYear: string; // YYYY-MM format for batch allocation
}

export interface ExtractionProgress {
  totalEmails: number;
  processedEmails: number;
  totalAttachments: number;
  extractedAttachments: number;
  currentFolder: string;
  errors: ExtractionError[];
}

export interface ExtractionError {
  folderPath: string;
  emailSubject?: string;
  attachmentName?: string;
  error: string;
}

export interface ExtractionResult {
  attachments: ExtractedAttachment[];
  progress: ExtractionProgress;
  folderStructure: FolderInfo[];
}

export interface FolderInfo {
  path: string;
  name: string;
  documentCount: number;
  isSentFolder: boolean;
}

/**
 * Determines if a folder is a "Sent" folder based on common naming patterns
 */
function isSentFolder(folderPath: string): boolean {
  const lowerPath = folderPath.toLowerCase();
  return (
    lowerPath.includes('sent items') ||
    lowerPath.includes('sent mail') ||
    lowerPath.includes('sent') ||
    lowerPath.includes('trimise') || // Romanian
    lowerPath.includes('elemente trimise')
  );
}

/**
 * Extracts the file extension from a filename
 */
function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Checks if a file extension is supported
 */
function isSupportedExtension(extension: string): extension is SupportedExtension {
  return SUPPORTED_EXTENSIONS.includes(extension as SupportedExtension);
}

/**
 * Formats a date to YYYY-MM for batch allocation
 */
function formatMonthYear(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    // Default to current month if date is invalid
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Recursively extracts folder information from PST
 */
function extractFolderInfo(folder: pst.PSTFolder, parentPath: string = ''): FolderInfo[] {
  const folders: FolderInfo[] = [];
  const currentPath = parentPath ? `${parentPath}/${folder.displayName}` : folder.displayName;

  // Count documents in this folder
  let documentCount = 0;
  if (folder.contentCount > 0) {
    // This is a rough estimate - actual count comes from processing
    documentCount = folder.contentCount;
  }

  folders.push({
    path: currentPath,
    name: folder.displayName,
    documentCount,
    isSentFolder: isSentFolder(currentPath),
  });

  // Process subfolders
  if (folder.hasSubfolders) {
    const subfolders = folder.getSubFolders();
    for (const subfolder of subfolders) {
      folders.push(...extractFolderInfo(subfolder, currentPath));
    }
  }

  return folders;
}

/**
 * Options for batched extraction
 */
export interface BatchExtractionOptions {
  skip?: number; // Number of documents to skip (for resuming)
  take?: number; // Maximum documents to extract (for batching)
  onProgress?: (progress: ExtractionProgress) => void;
}

/**
 * Internal state for tracking position during batched extraction
 */
interface ExtractionState {
  currentIndex: number; // Global document index across all folders
  extracted: ExtractedAttachment[];
  shouldStop: boolean;
}

/**
 * Processes emails in a folder and extracts attachments
 * Supports skip/take for resumable batch extraction
 */
function processFolder(
  folder: pst.PSTFolder,
  folderPath: string,
  progress: ExtractionProgress,
  state: ExtractionState,
  options: BatchExtractionOptions = {}
): void {
  const { skip = 0, take = Infinity } = options;
  const isSent = isSentFolder(folderPath);

  progress.currentFolder = folderPath;

  // Check if we should stop
  if (state.shouldStop) return;

  // Iterate through emails
  if (folder.contentCount > 0) {
    let email = folder.getNextChild();

    while (email !== null && !state.shouldStop) {
      progress.processedEmails++;

      if (email instanceof pst.PSTMessage) {
        const message = email as pst.PSTMessage;

        try {
          // Check for attachments
          const attachmentCount = message.numberOfAttachments;
          progress.totalAttachments += attachmentCount;

          if (attachmentCount > 0) {
            for (let i = 0; i < attachmentCount && !state.shouldStop; i++) {
              try {
                const attachment = message.getAttachment(i);
                if (attachment) {
                  const fileName = attachment.longFilename || attachment.filename || 'unnamed';
                  const extension = getFileExtension(fileName);

                  if (isSupportedExtension(extension)) {
                    // Check if we should skip this document
                    if (state.currentIndex < skip) {
                      state.currentIndex++;
                      continue;
                    }

                    // Check if we've reached our batch limit
                    if (state.extracted.length >= take) {
                      state.shouldStop = true;
                      break;
                    }

                    // Get attachment content
                    const content = attachment.fileInputStream;

                    if (content) {
                      // Read stream to buffer
                      const chunks: Buffer[] = [];
                      const bufferSize = attachment.filesize || 8192;
                      const buffer = Buffer.alloc(bufferSize);

                      let bytesRead: number;
                      while ((bytesRead = content.read(buffer)) > 0) {
                        chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
                      }

                      const fileContent = Buffer.concat(chunks);

                      // Get email metadata
                      const receivedDate =
                        message.messageDeliveryTime || message.clientSubmitTime || new Date();

                      const emailMetadata: EmailMetadata = {
                        subject: message.subject || 'No Subject',
                        senderName: message.senderName || 'Unknown',
                        senderEmail: message.senderEmailAddress || '',
                        receiverName: message.displayTo || 'Unknown',
                        receiverEmail: message.receivedByAddress || '',
                        receivedDate: receivedDate instanceof Date ? receivedDate : new Date(),
                        sentDate:
                          message.clientSubmitTime instanceof Date
                            ? message.clientSubmitTime
                            : null,
                      };

                      const extractedAttachment: ExtractedAttachment = {
                        id: uuidv4(),
                        fileName: fileName,
                        fileExtension: extension,
                        fileSizeBytes: fileContent.length,
                        content: fileContent,
                        folderPath: folderPath,
                        isSent: isSent,
                        emailMetadata: emailMetadata,
                        monthYear: formatMonthYear(emailMetadata.receivedDate),
                      };

                      state.extracted.push(extractedAttachment);
                      state.currentIndex++;
                      progress.extractedAttachments++;
                    }
                  }
                }
              } catch (attachError) {
                // Still increment index for skipped errors
                state.currentIndex++;
                progress.errors.push({
                  folderPath,
                  emailSubject: message.subject || 'Unknown',
                  attachmentName: `Attachment ${i}`,
                  error:
                    attachError instanceof Error
                      ? attachError.message
                      : 'Unknown error extracting attachment',
                });
              }
            }
          }
        } catch (emailError) {
          progress.errors.push({
            folderPath,
            error:
              emailError instanceof Error ? emailError.message : 'Unknown error processing email',
          });
        }
      }

      // Report progress periodically
      if (options.onProgress && progress.processedEmails % 100 === 0) {
        options.onProgress({ ...progress });
      }

      email = folder.getNextChild();
    }
  }

  // Process subfolders (unless we've hit our limit)
  if (folder.hasSubfolders && !state.shouldStop) {
    const subfolders = folder.getSubFolders();
    for (const subfolder of subfolders) {
      if (state.shouldStop) break;
      const subfolderPath = `${folderPath}/${subfolder.displayName}`;
      progress.totalEmails += subfolder.contentCount || 0;

      processFolder(subfolder, subfolderPath, progress, state, options);
    }
  }
}

/**
 * Counts total supported documents in a PST using FAST estimation
 * Does NOT call getAttachment() which is very slow for large PST files
 * Instead, counts messages with attachments and estimates based on average
 */
function countDocumentsInFolderFast(folder: pst.PSTFolder): number {
  let count = 0;

  // Count in current folder - FAST: just count numberOfAttachments without loading them
  if (folder.contentCount > 0) {
    let email = folder.getNextChild();

    while (email !== null) {
      if (email instanceof pst.PSTMessage) {
        const message = email as pst.PSTMessage;
        // Just use numberOfAttachments as estimate - much faster than loading each attachment
        // This slightly overestimates since not all attachments are PDF/DOCX/DOC
        // But it's fast and good enough for progress tracking
        count += message.numberOfAttachments;
      }
      email = folder.getNextChild();
    }
  }

  // Count in subfolders
  if (folder.hasSubfolders) {
    const subfolders = folder.getSubFolders();
    for (const subfolder of subfolders) {
      count += countDocumentsInFolderFast(subfolder);
    }
  }

  return count;
}

/**
 * Counts total supported documents in a PST file (fast estimation)
 * Uses fast counting that doesn't load attachment content
 */
export async function countDocumentsInPST(pstFilePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const pstFile = new pst.PSTFile(pstFilePath);
      const rootFolder = pstFile.getRootFolder();
      const count = countDocumentsInFolderFast(rootFolder);
      resolve(count);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Extracts attachments from a PST file path
 * Uses file path directly for memory efficiency with large PST files
 * Supports skip/take for resumable batch extraction
 */
export async function extractFromPSTFile(
  pstFilePath: string,
  options: BatchExtractionOptions = {}
): Promise<ExtractionResult> {
  return new Promise((resolve, reject) => {
    try {
      // pst-extractor works with file paths directly - memory efficient
      const pstFile = new pst.PSTFile(pstFilePath);

      const progress: ExtractionProgress = {
        totalEmails: 0,
        processedEmails: 0,
        totalAttachments: 0,
        extractedAttachments: 0,
        currentFolder: '',
        errors: [],
      };

      // Initialize extraction state
      const state: ExtractionState = {
        currentIndex: 0,
        extracted: [],
        shouldStop: false,
      };

      // Get folder structure first
      const rootFolder = pstFile.getRootFolder();
      const folderStructure = extractFolderInfo(rootFolder);

      // Calculate total emails
      progress.totalEmails = folderStructure.reduce((sum, f) => sum + f.documentCount, 0);

      // Extract attachments with skip/take support
      processFolder(rootFolder, rootFolder.displayName || 'Root', progress, state, options);

      // Update folder structure with actual document counts
      const folderCounts = new Map<string, number>();
      for (const attachment of state.extracted) {
        const count = folderCounts.get(attachment.folderPath) || 0;
        folderCounts.set(attachment.folderPath, count + 1);
      }

      const updatedFolderStructure = folderStructure.map((folder) => ({
        ...folder,
        documentCount: folderCounts.get(folder.path) || 0,
      }));

      resolve({
        attachments: state.extracted,
        progress,
        folderStructure: updatedFolderStructure,
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Groups extracted attachments by month for batch allocation
 */
export function groupByMonth(
  attachments: ExtractedAttachment[]
): Map<string, ExtractedAttachment[]> {
  const groups = new Map<string, ExtractedAttachment[]>();

  for (const attachment of attachments) {
    const monthYear = attachment.monthYear;
    const existing = groups.get(monthYear) || [];
    existing.push(attachment);
    groups.set(monthYear, existing);
  }

  // Sort by month (oldest first)
  const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  return new Map(sortedEntries);
}

/**
 * Generates extraction summary statistics
 */
export function getExtractionSummary(result: ExtractionResult): {
  totalDocuments: number;
  byExtension: Record<string, number>;
  byMonth: Record<string, number>;
  sentCount: number;
  receivedCount: number;
  errorCount: number;
  uniqueFolders: number;
} {
  const byExtension: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  let sentCount = 0;
  let receivedCount = 0;

  for (const attachment of result.attachments) {
    // Count by extension
    byExtension[attachment.fileExtension] = (byExtension[attachment.fileExtension] || 0) + 1;

    // Count by month
    byMonth[attachment.monthYear] = (byMonth[attachment.monthYear] || 0) + 1;

    // Count sent/received
    if (attachment.isSent) {
      sentCount++;
    } else {
      receivedCount++;
    }
  }

  return {
    totalDocuments: result.attachments.length,
    byExtension,
    byMonth,
    sentCount,
    receivedCount,
    errorCount: result.progress.errors.length,
    uniqueFolders: result.folderStructure.filter((f) => f.documentCount > 0).length,
  };
}
