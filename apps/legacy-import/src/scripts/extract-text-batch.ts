#!/usr/bin/env tsx
/**
 * Batch Text Extraction Script
 * Extracts text from documents that don't have extractedText yet.
 * Required before running the AI categorization pipeline.
 *
 * Usage: npx tsx src/scripts/extract-text-batch.ts --session=<sessionId>
 */

import { prisma } from '@/lib/prisma';
import { downloadFromR2 } from '@/lib/r2-storage';
import { extractTextAndDetectLanguage } from '@/services/text-extraction.service';

// ============================================================================
// Configuration
// ============================================================================

const BATCH_SIZE = 50; // Process 50 documents at a time
const PROGRESS_INTERVAL = 100; // Log progress every 100 documents

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  const sessionArg = args.find((a) => a.startsWith('--session='));

  if (!sessionArg) {
    console.error('Usage: npx tsx src/scripts/extract-text-batch.ts --session=<sessionId>');
    process.exit(1);
  }

  const sessionId = sessionArg.split('=')[1];

  // Get session
  const session = await prisma.legacyImportSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Batch Text Extraction                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Session: ${sessionId}`);
  console.log(`📁 PST File: ${session.pstFileName}`);
  console.log();

  // Count documents without text
  const totalWithoutText = await prisma.extractedDocument.count({
    where: {
      sessionId,
      extractedText: null,
      fileExtension: { in: ['pdf', 'docx', 'doc'] },
    },
  });

  const totalWithText = await prisma.extractedDocument.count({
    where: {
      sessionId,
      extractedText: { not: '' },
    },
  });

  console.log(`📊 Documents without text: ${totalWithoutText}`);
  console.log(`📊 Documents with text: ${totalWithText}`);
  console.log();

  if (totalWithoutText === 0) {
    console.log('✓ All documents already have extracted text');
    process.exit(0);
  }

  const startTime = Date.now();
  let processed = 0;
  let success = 0;
  let failed = 0;

  // Process in batches
  while (processed < totalWithoutText) {
    // Get next batch of documents without text
    const documents = await prisma.extractedDocument.findMany({
      where: {
        sessionId,
        extractedText: null,
        fileExtension: { in: ['pdf', 'docx', 'doc'] },
      },
      select: {
        id: true,
        fileName: true,
        fileExtension: true,
        storagePath: true,
      },
      take: BATCH_SIZE,
    });

    if (documents.length === 0) break;

    // Process batch in parallel
    const results = await Promise.allSettled(
      documents.map(async (doc) => {
        try {
          // Download from R2
          const buffer = await downloadFromR2(doc.storagePath!);

          // Extract text
          const result = await extractTextAndDetectLanguage(buffer, doc.fileExtension);

          if (result.extractionSuccess && result.text) {
            // Update document
            await prisma.extractedDocument.update({
              where: { id: doc.id },
              data: {
                extractedText: result.text,
                primaryLanguage: result.primaryLanguage,
                languageConfidence: result.languageConfidence,
              },
            });
            return { success: true, id: doc.id };
          } else {
            // Mark as failed extraction (set empty string so we don't retry)
            await prisma.extractedDocument.update({
              where: { id: doc.id },
              data: {
                extractedText: '', // Empty string means extraction attempted but failed
              },
            });
            return { success: false, id: doc.id, error: result.extractionError };
          }
        } catch (error) {
          // Mark as failed
          await prisma.extractedDocument.update({
            where: { id: doc.id },
            data: {
              extractedText: '', // Empty string means extraction attempted but failed
            },
          });
          return {
            success: false,
            id: doc.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Count results
    for (const result of results) {
      processed++;
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
      } else {
        failed++;
      }
    }

    // Log progress
    if (processed % PROGRESS_INTERVAL === 0 || processed >= totalWithoutText) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (totalWithoutText - processed) / rate;
      console.log(
        `  Progress: ${processed}/${totalWithoutText} (${Math.round((processed / totalWithoutText) * 100)}%) - ` +
          `✓ ${success} ✗ ${failed} - ` +
          `${rate.toFixed(1)} docs/s - ETA: ${Math.round(remaining)}s`
      );
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               ✓ Text Extraction Complete                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  ✓ Success:     ${success}`);
  console.log(`  ✗ Failed:      ${failed}`);
  console.log(`  ⏱ Duration:    ${Math.round(totalTime)}s`);
  console.log();
  console.log('Now run the AI categorization pipeline:');
  console.log(`  npx tsx src/scripts/run-pipeline.ts --session=${sessionId}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
