/**
 * Re-queue Documents for Extraction
 *
 * This script finds documents that need re-extraction and queues them:
 * - UNSUPPORTED images (now supported via OCR)
 * - COMPLETED with < 50 chars (garbage from scanned PDFs)
 * - NONE status (never processed)
 * - FAILED status (retry)
 *
 * Usage:
 *   pnpm --filter gateway exec npx ts-node src/scripts/requeue-extraction.ts
 *   pnpm --filter gateway exec npx ts-node src/scripts/requeue-extraction.ts --dry-run
 */

import { prisma, DocumentExtractionStatus } from '@legal-platform/database';
import { queueContentExtractionJob } from '../workers/content-extraction.worker';

// Minimum content length - same as content-extraction.service.ts
const MIN_CONTENT_LENGTH = 50;

// Image MIME types that now support OCR
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface DocumentToRequeue {
  id: string;
  fileName: string;
  fileType: string;
  extractionStatus: DocumentExtractionStatus;
  contentLength: number | null;
  reason: string;
}

async function findDocumentsToRequeue(): Promise<DocumentToRequeue[]> {
  const documents: DocumentToRequeue[] = [];

  // 1. Find UNSUPPORTED images (now supported via OCR)
  const unsupportedImages = await prisma.document.findMany({
    where: {
      extractionStatus: DocumentExtractionStatus.UNSUPPORTED,
      fileType: { in: IMAGE_MIME_TYPES },
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      extractionStatus: true,
    },
  });

  for (const doc of unsupportedImages) {
    documents.push({
      ...doc,
      contentLength: null,
      reason: 'UNSUPPORTED image - now supports OCR',
    });
  }

  // 2. Find COMPLETED with garbage content (< MIN_CONTENT_LENGTH)
  const garbageCompleted = await prisma.$queryRaw<
    Array<{
      id: string;
      file_name: string;
      file_type: string;
      extraction_status: string;
      content_length: number;
    }>
  >`
    SELECT id, file_name, file_type, extraction_status, LENGTH(extracted_content) as content_length
    FROM documents
    WHERE extraction_status = 'COMPLETED'
      AND LENGTH(extracted_content) < ${MIN_CONTENT_LENGTH}
  `;

  for (const doc of garbageCompleted) {
    documents.push({
      id: doc.id,
      fileName: doc.file_name,
      fileType: doc.file_type,
      extractionStatus: DocumentExtractionStatus.COMPLETED,
      contentLength: doc.content_length,
      reason: `COMPLETED with only ${doc.content_length} chars (garbage)`,
    });
  }

  // 3. Find NONE status (never processed)
  const neverProcessed = await prisma.document.findMany({
    where: {
      extractionStatus: DocumentExtractionStatus.NONE,
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      extractionStatus: true,
    },
  });

  for (const doc of neverProcessed) {
    documents.push({
      ...doc,
      contentLength: null,
      reason: 'NONE status - never processed',
    });
  }

  // 4. Find FAILED status (retry)
  const failed = await prisma.document.findMany({
    where: {
      extractionStatus: DocumentExtractionStatus.FAILED,
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      extractionStatus: true,
    },
  });

  for (const doc of failed) {
    documents.push({
      ...doc,
      contentLength: null,
      reason: 'FAILED - retry',
    });
  }

  return documents;
}

async function requeueDocuments(documents: DocumentToRequeue[], dryRun: boolean): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(
    dryRun ? '🔍 DRY RUN - No changes will be made' : '🚀 EXECUTING - Documents will be requeued'
  );
  console.log(`${'='.repeat(60)}\n`);

  // Group by reason for summary
  const byReason = documents.reduce(
    (acc, doc) => {
      const key = doc.reason.split(' - ')[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(doc);
      return acc;
    },
    {} as Record<string, DocumentToRequeue[]>
  );

  // Print summary
  console.log('📊 Summary:');
  for (const [reason, docs] of Object.entries(byReason)) {
    console.log(`   ${reason}: ${docs.length} documents`);
  }
  console.log(`   TOTAL: ${documents.length} documents\n`);

  if (documents.length === 0) {
    console.log('✅ No documents need re-extraction!');
    return;
  }

  // Print details
  console.log('📝 Documents to requeue:\n');
  for (const doc of documents) {
    console.log(`   [${doc.extractionStatus}] ${doc.fileName}`);
    console.log(`      Type: ${doc.fileType}`);
    console.log(`      Reason: ${doc.reason}`);
    console.log('');
  }

  if (dryRun) {
    console.log('🔍 Dry run complete. Run without --dry-run to execute.');
    return;
  }

  // Execute requeue
  console.log('\n⏳ Requeuing documents...\n');

  let success = 0;
  let errors = 0;

  for (const doc of documents) {
    try {
      // Reset extraction status to PENDING
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          extractionStatus: DocumentExtractionStatus.PENDING,
          extractedContent: null,
          extractionError: null,
        },
      });

      // Queue for extraction
      await queueContentExtractionJob({
        documentId: doc.id,
        triggeredBy: 'retry',
      });

      console.log(`   ✅ ${doc.fileName}`);
      success++;
    } catch (error) {
      console.log(
        `   ❌ ${doc.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      errors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Requeued: ${success} documents`);
  if (errors > 0) {
    console.log(`❌ Errors: ${errors} documents`);
  }
  console.log(`${'='.repeat(60)}\n`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n🔄 Document Re-extraction Script');
  console.log(`${'='.repeat(60)}\n`);

  try {
    console.log('🔍 Finding documents that need re-extraction...\n');
    const documents = await findDocumentsToRequeue();

    await requeueDocuments(documents, dryRun);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
