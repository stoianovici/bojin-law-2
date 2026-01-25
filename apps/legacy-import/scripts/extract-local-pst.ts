#!/usr/bin/env npx ts-node
/**
 * Local PST Extraction Script
 * Extracts documents from a local PST file and imports them to the database
 *
 * Run from apps/legacy-import directory:
 *   npx ts-node scripts/extract-local-pst.ts "/path/to/file.pst" <sessionId>
 */

import * as pst from 'pst-extractor';
import { prisma } from '../src/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc'];

// Batch size for database inserts
const BATCH_SIZE = 100;

interface ExtractedDoc {
  id: string;
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  storagePath: string;
  folderPath: string;
  isSent: boolean;
  extractedText: string | null;
  emailSubject: string;
  emailSender: string;
  emailReceiver: string;
  emailDate: Date;
  monthYear: string;
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
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function formatMonthYear(date: Date | null): string {
  if (!date || isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 7);
  }
  return date.toISOString().slice(0, 7);
}

async function processFolder(
  folder: pst.PSTFolder,
  folderPath: string,
  sessionId: string,
  outputDir: string,
  stats: { processed: number; extracted: number; errors: number }
): Promise<ExtractedDoc[]> {
  const docs: ExtractedDoc[] = [];

  // Process emails in this folder
  if (folder.contentCount > 0) {
    let email = folder.getNextChild();

    while (email !== null) {
      stats.processed++;

      if (email instanceof pst.PSTMessage) {
        // Get attachments
        const numAttachments = email.numberOfAttachments;

        for (let i = 0; i < numAttachments; i++) {
          try {
            const attachment = email.getAttachment(i);
            if (!attachment || !attachment.filename) continue;

            const fileName = attachment.filename;
            const ext = getFileExtension(fileName);

            if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

            // Get attachment content
            const fileContent = attachment.fileInputStream;
            if (!fileContent) continue;

            // Read into buffer
            const chunks: Buffer[] = [];
            const readBuffer = Buffer.alloc(8192);

            let bytesRead: number;
            while ((bytesRead = fileContent.read(readBuffer)) > 0) {
              chunks.push(Buffer.from(readBuffer.slice(0, bytesRead)));
            }

            const contentBuffer = Buffer.concat(chunks);
            if (contentBuffer.length === 0) continue;

            // Generate unique ID and storage path
            const docId = uuidv4();
            const storagePath = path.join(outputDir, `${docId}.${ext}`);

            // Save file locally
            fs.writeFileSync(storagePath, contentBuffer);

            // Get email metadata
            const emailDate = email.clientSubmitTime || email.messageDeliveryTime || new Date();

            docs.push({
              id: docId,
              fileName,
              fileExtension: ext,
              fileSizeBytes: contentBuffer.length,
              storagePath,
              folderPath,
              isSent: isSentFolder(folderPath),
              extractedText: null, // Will extract text in a separate pass
              emailSubject: email.subject || '',
              emailSender: email.senderEmailAddress || email.senderName || '',
              emailReceiver: email.displayTo || '',
              emailDate,
              monthYear: formatMonthYear(emailDate),
            });

            stats.extracted++;

            if (stats.extracted % 100 === 0) {
              console.log(
                `  Extracted ${stats.extracted} documents (processed ${stats.processed} emails)...`
              );
            }
          } catch (err) {
            stats.errors++;
          }
        }
      }

      email = folder.getNextChild();
    }
  }

  // Recursively process subfolders
  if (folder.hasSubfolders) {
    const subfolders = folder.getSubFolders();
    for (const subfolder of subfolders) {
      const subfolderPath = folderPath
        ? `${folderPath}/${subfolder.displayName}`
        : subfolder.displayName;
      const subDocs = await processFolder(subfolder, subfolderPath, sessionId, outputDir, stats);
      docs.push(...subDocs);
    }
  }

  return docs;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/extract-local-pst.ts "/path/to/file.pst" <sessionId>');
    console.log('\nExample:');
    console.log(
      '  npx ts-node scripts/extract-local-pst.ts "/Users/mio/Desktop/Bojin PST/backup email valentin.pst" 8267942a-3721-4956-b866-3aad8e56a1bb'
    );
    process.exit(1);
  }

  const pstPath = args[0];
  const sessionId = args[1];

  // Verify PST file exists
  if (!fs.existsSync(pstPath)) {
    console.error(`PST file not found: ${pstPath}`);
    process.exit(1);
  }

  console.log(`\n=== Local PST Extraction ===`);
  console.log(`PST File: ${pstPath}`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`File size: ${(fs.statSync(pstPath).size / 1024 / 1024 / 1024).toFixed(2)} GB`);

  // Verify session exists
  const session = await prisma.legacyImportSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  console.log(`Session status: ${session.status}`);
  console.log(`\nStarting extraction...\n`);

  // Create output directory for extracted files
  const outputDir = path.join(process.cwd(), 'extracted-docs', sessionId);
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Output directory: ${outputDir}`);

  const stats = { processed: 0, extracted: 0, errors: 0 };
  const allDocs: ExtractedDoc[] = [];

  try {
    // Open PST file
    console.log(`Opening PST file...`);
    const pstFile = new pst.PSTFile(pstPath);
    const rootFolder = pstFile.getRootFolder();

    console.log(`Processing PST folders...`);

    // Process all folders
    const docs = await processFolder(rootFolder, '', sessionId, outputDir, stats);
    allDocs.push(...docs);

    console.log(`\n=== Extraction Complete ===`);
    console.log(`Emails processed: ${stats.processed}`);
    console.log(`Documents extracted: ${stats.extracted}`);
    console.log(`Errors: ${stats.errors}`);

    // Insert into database in batches
    console.log(`\nInserting ${allDocs.length} documents into database...`);

    // Group by month for batch creation
    const byMonth = new Map<string, ExtractedDoc[]>();
    for (const doc of allDocs) {
      const existing = byMonth.get(doc.monthYear) || [];
      existing.push(doc);
      byMonth.set(doc.monthYear, existing);
    }

    console.log(`Found ${byMonth.size} unique months`);

    let insertedCount = 0;

    for (const [monthYear, monthDocs] of byMonth) {
      // Create or get batch
      let batch = await prisma.documentBatch.findFirst({
        where: { sessionId, monthYear },
      });

      if (!batch) {
        batch = await prisma.documentBatch.create({
          data: {
            sessionId,
            monthYear,
            documentCount: 0,
          },
        });
      }

      // Insert documents in smaller batches
      for (let i = 0; i < monthDocs.length; i += BATCH_SIZE) {
        const batchDocs = monthDocs.slice(i, i + BATCH_SIZE);

        await prisma.extractedDocument.createMany({
          data: batchDocs.map((doc) => ({
            id: doc.id,
            sessionId,
            batchId: batch!.id,
            fileName: doc.fileName,
            fileExtension: doc.fileExtension,
            fileSizeBytes: doc.fileSizeBytes,
            storagePath: doc.storagePath,
            folderPath: doc.folderPath,
            isSent: doc.isSent,
            extractedText: doc.extractedText,
            emailSubject: doc.emailSubject,
            emailSender: doc.emailSender,
            emailReceiver: doc.emailReceiver,
            emailDate: doc.emailDate,
            status: 'Uncategorized',
          })),
          skipDuplicates: true,
        });

        insertedCount += batchDocs.length;
        if (insertedCount % 500 === 0 || insertedCount === allDocs.length) {
          console.log(`  Inserted ${insertedCount}/${allDocs.length} documents...`);
        }
      }

      // Update batch count
      await prisma.documentBatch.update({
        where: { id: batch.id },
        data: { documentCount: monthDocs.length },
      });
    }

    // Update session
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        status: 'InProgress',
        totalDocuments: allDocs.length,
      },
    });

    console.log(`\n=== Database Import Complete ===`);
    console.log(`Total documents: ${allDocs.length}`);
    console.log(`Session updated to 'InProgress'`);
    console.log(`\nExtracted files saved to: ${outputDir}`);
  } catch (error) {
    console.error('Extraction failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
