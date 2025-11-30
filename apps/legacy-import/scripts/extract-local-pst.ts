#!/usr/bin/env npx ts-node
/**
 * Local PST Extraction Script
 *
 * For large PST files (>1GB), run extraction locally instead of on Render.
 * This script:
 * 1. Reads PST file from local disk
 * 2. Extracts documents one-by-one (memory efficient)
 * 3. Uploads each document directly to R2
 * 4. Creates database records via API
 *
 * Usage:
 *   cd apps/legacy-import
 *   npx ts-node scripts/extract-local-pst.ts /path/to/file.pst <sessionId>
 *
 * Environment variables required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   API_BASE_URL (e.g., https://legacy-import.onrender.com)
 */

import * as pst from 'pst-extractor';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'legacy-import';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

const R2_ENDPOINT = R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined;

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc'];

interface ExtractedDoc {
  id: string;
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  storagePath: string;
  folderPath: string;
  isSent: boolean;
  emailSubject: string;
  emailSender: string;
  emailReceiver: string;
  emailDate: Date;
  monthYear: string;
}

interface ExtractionStats {
  totalEmails: number;
  processedEmails: number;
  totalAttachments: number;
  extractedDocuments: number;
  uploadedDocuments: number;
  errors: string[];
}

function getR2Client(): S3Client {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
    throw new Error(
      'R2 configuration missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY'
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function isSentFolder(folderPath: string): boolean {
  const lowerPath = folderPath.toLowerCase();
  return (
    lowerPath.includes('sent items') ||
    lowerPath.includes('sent mail') ||
    lowerPath.includes('sent') ||
    lowerPath.includes('trimise') ||
    lowerPath.includes('elemente trimise')
  );
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

function formatMonthYear(date: Date | null | undefined): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function uploadToR2(
  client: S3Client,
  sessionId: string,
  documentId: string,
  content: Buffer,
  extension: string
): Promise<string> {
  const key = `documents/${sessionId}/${documentId}.${extension}`;

  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
  };

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: content,
    ContentType: contentTypeMap[extension] || 'application/octet-stream',
  });

  await client.send(command);
  return key;
}

async function* extractDocumentsFromPST(
  pstFilePath: string,
  sessionId: string,
  stats: ExtractionStats
): AsyncGenerator<{ doc: ExtractedDoc; content: Buffer }> {
  const pstFile = new pst.PSTFile(pstFilePath);
  const rootFolder = pstFile.getRootFolder();

  async function* processFolder(
    folder: pst.PSTFolder,
    folderPath: string
  ): AsyncGenerator<{ doc: ExtractedDoc; content: Buffer }> {
    const isSent = isSentFolder(folderPath);

    // Process emails in this folder
    if (folder.contentCount > 0) {
      let email = folder.getNextChild();

      while (email !== null) {
        stats.processedEmails++;

        if (email instanceof pst.PSTMessage) {
          const message = email as pst.PSTMessage;

          try {
            const attachmentCount = message.numberOfAttachments;
            stats.totalAttachments += attachmentCount;

            for (let i = 0; i < attachmentCount; i++) {
              try {
                const attachment = message.getAttachment(i);
                if (!attachment) continue;

                const fileName = attachment.longFilename || attachment.filename || 'unnamed';
                const extension = getFileExtension(fileName);

                if (!SUPPORTED_EXTENSIONS.includes(extension)) continue;

                const fileInputStream = attachment.fileInputStream;
                if (!fileInputStream) continue;

                // Read attachment content
                const chunks: Buffer[] = [];
                const bufferSize = (attachment as any).attachSize || 8192;
                const buffer = Buffer.alloc(bufferSize);

                let bytesRead: number;
                while ((bytesRead = fileInputStream.read(buffer)) > 0) {
                  chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
                }

                const content = Buffer.concat(chunks);
                const receivedDate =
                  message.messageDeliveryTime || message.clientSubmitTime || new Date();

                const doc: ExtractedDoc = {
                  id: uuidv4(),
                  fileName,
                  fileExtension: extension,
                  fileSizeBytes: content.length,
                  storagePath: '', // Will be set after upload
                  folderPath,
                  isSent,
                  emailSubject: message.subject || 'No Subject',
                  emailSender: message.senderEmailAddress || message.senderName || 'Unknown',
                  emailReceiver: message.receivedByAddress || message.displayTo || 'Unknown',
                  emailDate: receivedDate instanceof Date ? receivedDate : new Date(),
                  monthYear: formatMonthYear(receivedDate instanceof Date ? receivedDate : null),
                };

                stats.extractedDocuments++;
                yield { doc, content };
              } catch (attachError) {
                stats.errors.push(`Attachment error in "${message.subject}": ${attachError}`);
              }
            }
          } catch (emailError) {
            stats.errors.push(`Email error in ${folderPath}: ${emailError}`);
          }
        }

        // Progress update every 100 emails
        if (stats.processedEmails % 100 === 0) {
          console.log(
            `Progress: ${stats.processedEmails} emails processed, ${stats.extractedDocuments} documents found, ${stats.uploadedDocuments} uploaded`
          );
        }

        email = folder.getNextChild();
      }
    }

    // Process subfolders
    if (folder.hasSubfolders) {
      const subfolders = folder.getSubFolders();
      for (const subfolder of subfolders) {
        const subfolderPath = `${folderPath}/${subfolder.displayName}`;
        stats.totalEmails += subfolder.contentCount || 0;
        yield* processFolder(subfolder, subfolderPath);
      }
    }
  }

  // Start processing from root
  stats.totalEmails = rootFolder.contentCount || 0;
  yield* processFolder(rootFolder, rootFolder.displayName || 'Root');
}

async function createDatabaseRecords(sessionId: string, documents: ExtractedDoc[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/bulk-import-documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, documents }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create database records: ${error}`);
  }
}

async function createSession(fileName: string, fileSize: number): Promise<string> {
  console.log('Creating session via API...');
  const response = await fetch(`${API_BASE_URL}/api/create-local-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileSize }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create session: ${error}`);
  }

  const data = await response.json();
  console.log(`Session created: ${data.sessionId}`);
  return data.sessionId;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: npx ts-node scripts/extract-local-pst.ts <pst-file-path> [session-id]');
    console.error('');
    console.error('If session-id is not provided, a new session will be created automatically.');
    console.error('');
    console.error('Environment variables required:');
    console.error('  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
    console.error('  API_BASE_URL (default: http://localhost:3001)');
    process.exit(1);
  }

  const pstFilePath = args[0];
  let sessionId = args[1];

  if (!fs.existsSync(pstFilePath)) {
    console.error(`PST file not found: ${pstFilePath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(pstFilePath);
  const fileSizeBytes = fileStats.size;
  const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);
  const fileName = path.basename(pstFilePath);

  // Auto-create session if not provided
  if (!sessionId) {
    sessionId = await createSession(fileName, fileSizeBytes);
  }
  console.log(`\n=== Local PST Extraction ===`);
  console.log(`PST File: ${pstFilePath}`);
  console.log(`File Size: ${fileSizeGB.toFixed(2)} GB`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`R2 Bucket: ${R2_BUCKET_NAME}`);
  console.log(`\nStarting extraction...\n`);

  const r2Client = getR2Client();
  const stats: ExtractionStats = {
    totalEmails: 0,
    processedEmails: 0,
    totalAttachments: 0,
    extractedDocuments: 0,
    uploadedDocuments: 0,
    errors: [],
  };

  const documents: ExtractedDoc[] = [];
  const BATCH_SIZE = 100; // Upload to DB in batches

  const startTime = Date.now();

  try {
    for await (const { doc, content } of extractDocumentsFromPST(pstFilePath, sessionId, stats)) {
      try {
        // Upload to R2 immediately
        const storagePath = await uploadToR2(
          r2Client,
          sessionId,
          doc.id,
          content,
          doc.fileExtension
        );
        doc.storagePath = storagePath;
        documents.push(doc);
        stats.uploadedDocuments++;

        // Batch insert to database
        if (documents.length >= BATCH_SIZE) {
          console.log(`Saving batch of ${documents.length} documents to database...`);
          await createDatabaseRecords(sessionId, documents);
          documents.length = 0; // Clear array
        }
      } catch (uploadError) {
        stats.errors.push(`Upload error for ${doc.fileName}: ${uploadError}`);
      }
    }

    // Final batch
    if (documents.length > 0) {
      console.log(`Saving final batch of ${documents.length} documents to database...`);
      await createDatabaseRecords(sessionId, documents);
    }

    const elapsed = (Date.now() - startTime) / 1000 / 60;

    console.log(`\n=== Extraction Complete ===`);
    console.log(`Time: ${elapsed.toFixed(1)} minutes`);
    console.log(`Emails processed: ${stats.processedEmails}`);
    console.log(`Documents extracted: ${stats.extractedDocuments}`);
    console.log(`Documents uploaded: ${stats.uploadedDocuments}`);
    console.log(`Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log(`\nFirst 10 errors:`);
      stats.errors.slice(0, 10).forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }
  } catch (error) {
    console.error(`\nFatal error: ${error}`);
    process.exit(1);
  }
}

main();
