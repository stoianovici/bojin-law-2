/**
 * Extract Documents API Route
 * Processes uploaded PST file and extracts documents
 * Supports RESUMABLE extraction for large PST files
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';
import { streamFromR2ToFile, uploadExtractedDocument } from '@/lib/r2-storage';
import {
  extractFromPSTFile,
  countDocumentsInPST,
  groupByMonth,
  getExtractionSummary,
} from '@/services/pst-parser.service';
import { extractTextAndDetectLanguage } from '@/services/text-extraction.service';
import type { SupportedLanguage } from '@/services/text-extraction.service';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { randomUUID } from 'crypto';

// Batch size for resumable extraction - balance between progress and timeout risk
const EXTRACTION_BATCH_SIZE = 500;

interface ExtractionProgress {
  totalInPst: number;
  extractedCount: number;
  isComplete: boolean;
  lastBatchAt?: string;
}

/**
 * POST - Start or continue PST extraction for a session
 * Supports resumable extraction for large PST files
 */
export async function POST(request: NextRequest) {
  let tempPstPath: string | null = null;

  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get session
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.pstStoragePath) {
      return NextResponse.json({ error: 'PST file not uploaded yet' }, { status: 400 });
    }

    // Allow both 'Extracting' (first time) and 'InProgress' (resuming) statuses
    if (session.status !== 'Extracting' && session.status !== 'InProgress') {
      return NextResponse.json(
        { error: `Invalid session status: ${session.status}. Expected: Extracting or InProgress` },
        { status: 400 }
      );
    }

    // Get or initialize extraction progress
    // For existing sessions without extractionProgress, count existing documents
    let progress: ExtractionProgress;
    if (session.extractionProgress) {
      progress = session.extractionProgress as ExtractionProgress;
    } else {
      // Count existing documents for this session (for backward compatibility)
      const existingDocCount = await prisma.extractedDocument.count({
        where: { sessionId },
      });
      progress = {
        totalInPst: 0, // Will be counted on first extraction call
        extractedCount: existingDocCount,
        isComplete: false,
      };
    }

    // Stream PST from R2 to temp file (memory-efficient for large files)
    tempPstPath = join(tmpdir(), `pst-${randomUUID()}.pst`);

    console.log(`Streaming PST to temp file: ${tempPstPath}`);
    await streamFromR2ToFile(session.pstStoragePath, tempPstPath);
    console.log('PST download complete');

    // First time: count total documents in PST
    if (progress.totalInPst === 0) {
      console.log('First extraction call - counting total documents in PST...');
      const totalCount = await countDocumentsInPST(tempPstPath);
      progress.totalInPst = totalCount;
      console.log(`Total documents in PST: ${totalCount}`);

      // Save initial count
      await prisma.legacyImportSession.update({
        where: { id: sessionId },
        data: {
          extractionProgress: progress as unknown as Prisma.JsonObject,
        },
      });
    }

    // Check if already complete
    if (progress.isComplete) {
      return NextResponse.json({
        success: true,
        sessionId,
        message: 'Extraction already complete',
        progress: {
          totalInPst: progress.totalInPst,
          extractedCount: progress.extractedCount,
          isComplete: true,
          remainingCount: 0,
        },
        status: session.status,
      });
    }

    const skipCount = progress.extractedCount;
    console.log(
      `Resuming extraction from document ${skipCount}, batch size ${EXTRACTION_BATCH_SIZE}`
    );

    // Extract next batch of attachments
    const extractionResult = await extractFromPSTFile(tempPstPath, {
      skip: skipCount,
      take: EXTRACTION_BATCH_SIZE,
    });

    const batchAttachments = extractionResult.attachments;
    console.log(`Extracted ${batchAttachments.length} documents in this batch`);

    if (batchAttachments.length === 0) {
      // No more documents to extract
      progress.isComplete = true;
      progress.lastBatchAt = new Date().toISOString();

      await prisma.legacyImportSession.update({
        where: { id: sessionId },
        data: {
          status: 'InProgress',
          extractionProgress: progress as unknown as Prisma.JsonObject,
        },
      });

      return NextResponse.json({
        success: true,
        sessionId,
        message: 'Extraction complete - no more documents',
        progress: {
          totalInPst: progress.totalInPst,
          extractedCount: progress.extractedCount,
          isComplete: true,
          remainingCount: 0,
        },
        status: 'InProgress',
      });
    }

    // Upload documents to R2 and extract text
    const uploadedDocs: Array<{
      attachment: (typeof batchAttachments)[0];
      storagePath: string;
      extractedText: string;
      primaryLanguage: SupportedLanguage;
      languageConfidence: number;
    }> = [];

    for (const attachment of batchAttachments) {
      const uploadResult = await uploadExtractedDocument(
        sessionId,
        attachment.id,
        attachment.content,
        attachment.fileExtension,
        {
          originalFileName: attachment.fileName,
          folderPath: attachment.folderPath,
          emailSubject: attachment.emailMetadata.subject,
        }
      );

      // Extract text and detect language for supported file types
      let extractedText = '';
      let primaryLanguage: SupportedLanguage = 'Mixed';
      let languageConfidence = 0;

      const supportedExtensions = ['pdf', 'docx', 'doc'];
      if (supportedExtensions.includes(attachment.fileExtension.toLowerCase())) {
        try {
          const textResult = await extractTextAndDetectLanguage(
            attachment.content,
            attachment.fileExtension
          );
          extractedText = textResult.text;
          primaryLanguage = textResult.primaryLanguage;
          languageConfidence = textResult.languageConfidence;
        } catch (err) {
          console.warn(
            `Text extraction failed for ${attachment.fileName}:`,
            err instanceof Error ? err.message : 'Unknown error'
          );
        }
      }

      uploadedDocs.push({
        attachment,
        storagePath: uploadResult.key,
        extractedText,
        primaryLanguage,
        languageConfidence,
      });
    }

    // Group by month for batch creation/updating
    const byMonth = groupByMonth(batchAttachments);

    // Create database records in a transaction
    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Get or create batches for each month
        for (const [monthYear, attachments] of byMonth) {
          // Try to find existing batch
          let batch = await tx.documentBatch.findUnique({
            where: {
              sessionId_monthYear: {
                sessionId,
                monthYear,
              },
            },
          });

          if (!batch) {
            // Create new batch
            batch = await tx.documentBatch.create({
              data: {
                sessionId,
                monthYear,
                documentCount: attachments.length,
              },
            });
          } else {
            // Update existing batch document count
            await tx.documentBatch.update({
              where: { id: batch.id },
              data: {
                documentCount: batch.documentCount + attachments.length,
              },
            });
          }

          // Create document records for this batch
          for (const attachment of attachments) {
            const uploadedDoc = uploadedDocs.find((u) => u.attachment.id === attachment.id);
            if (!uploadedDoc) continue;

            await tx.extractedDocument.create({
              data: {
                id: attachment.id,
                sessionId,
                batchId: batch.id,
                fileName: attachment.fileName,
                fileExtension: attachment.fileExtension,
                fileSizeBytes: attachment.fileSizeBytes,
                storagePath: uploadedDoc.storagePath,
                folderPath: attachment.folderPath,
                isSent: attachment.isSent,
                emailSubject: attachment.emailMetadata.subject,
                emailSender:
                  attachment.emailMetadata.senderEmail || attachment.emailMetadata.senderName,
                emailReceiver:
                  attachment.emailMetadata.receiverEmail || attachment.emailMetadata.receiverName,
                emailDate: attachment.emailMetadata.receivedDate,
                status: 'Uncategorized',
                extractedText: uploadedDoc.extractedText || null,
                primaryLanguage: uploadedDoc.primaryLanguage,
                languageConfidence: uploadedDoc.languageConfidence,
              },
            });
          }
        }

        // Update extraction progress
        const newExtractedCount = progress.extractedCount + batchAttachments.length;
        const isComplete = newExtractedCount >= progress.totalInPst;

        progress.extractedCount = newExtractedCount;
        progress.isComplete = isComplete;
        progress.lastBatchAt = new Date().toISOString();

        // Update session
        await tx.legacyImportSession.update({
          where: { id: sessionId },
          data: {
            status: 'InProgress',
            totalDocuments: newExtractedCount,
            extractionProgress: progress as unknown as Prisma.JsonObject,
            extractionErrors:
              extractionResult.progress.errors.length > 0
                ? JSON.parse(JSON.stringify(extractionResult.progress.errors))
                : undefined,
          },
        });

        // Create audit log
        await tx.legacyImportAuditLog.create({
          data: {
            sessionId,
            userId: session.uploadedBy,
            action: isComplete ? 'EXTRACTION_COMPLETED' : 'EXTRACTION_BATCH_COMPLETED',
            details: {
              batchSize: batchAttachments.length,
              totalExtracted: newExtractedCount,
              totalInPst: progress.totalInPst,
              isComplete,
              byMonth: Object.fromEntries(byMonth.entries()),
            },
          },
        });
      },
      {
        maxWait: 60000,
        timeout: 120000,
      }
    );

    const summary = getExtractionSummary(extractionResult);
    const remainingCount = progress.totalInPst - progress.extractedCount;

    return NextResponse.json({
      success: true,
      sessionId,
      message: progress.isComplete
        ? 'Extraction complete!'
        : `Extracted ${batchAttachments.length} documents. ${remainingCount} remaining.`,
      extraction: {
        batchDocuments: summary.totalDocuments,
        byExtension: summary.byExtension,
        byMonth: summary.byMonth,
        sentCount: summary.sentCount,
        receivedCount: summary.receivedCount,
        errorCount: summary.errorCount,
      },
      progress: {
        totalInPst: progress.totalInPst,
        extractedCount: progress.extractedCount,
        isComplete: progress.isComplete,
        remainingCount,
      },
      folderStructure: extractionResult.folderStructure,
      status: 'InProgress',
    });
  } catch (error) {
    console.error('Extract documents error:', error);

    // Try to update session with error
    try {
      const body = await request.clone().json();
      if (body.sessionId) {
        await prisma.legacyImportSession.update({
          where: { id: body.sessionId },
          data: {
            extractionErrors: {
              fatal: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    } catch {
      // Ignore secondary errors
    }

    return NextResponse.json(
      {
        error: 'Failed to extract documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    // Always clean up temp file
    if (tempPstPath) {
      try {
        await unlink(tempPstPath);
        console.log(`Cleaned up temp file: ${tempPstPath}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * GET - Get extraction status for a session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      include: {
        batches: {
          select: {
            id: true,
            monthYear: true,
            assignedTo: true,
            documentCount: true,
            categorizedCount: true,
            skippedCount: true,
          },
          orderBy: { monthYear: 'asc' },
        },
        _count: {
          select: {
            documents: true,
            categories: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get document statistics
    const documentStats = await prisma.extractedDocument.groupBy({
      by: ['status'],
      where: { sessionId },
      _count: true,
    });

    const stats = {
      uncategorized: 0,
      categorized: 0,
      skipped: 0,
    };

    for (const stat of documentStats) {
      if (stat.status === 'Uncategorized') stats.uncategorized = stat._count;
      if (stat.status === 'Categorized') stats.categorized = stat._count;
      if (stat.status === 'Skipped') stats.skipped = stat._count;
    }

    // Get extraction progress
    // For sessions without extractionProgress, we don't know if extraction is complete
    // So we assume it's NOT complete and allow continuation
    let extractionProgress: ExtractionProgress;
    let canContinue = false;

    if (session.extractionProgress) {
      extractionProgress = session.extractionProgress as ExtractionProgress;
      canContinue =
        !extractionProgress.isComplete &&
        session.status !== 'Completed' &&
        session.status !== 'Exported';
    } else {
      // No extraction progress saved - this is a legacy session
      // Assume extraction may be incomplete and allow continuation
      extractionProgress = {
        totalInPst: 0, // Unknown - will be counted when extraction is triggered
        extractedCount: session.totalDocuments,
        isComplete: false, // Assume NOT complete for legacy sessions
      };
      // Allow continuation for InProgress or Extracting sessions without progress data
      canContinue =
        (session.status === 'InProgress' || session.status === 'Extracting') &&
        session.status !== 'Completed' &&
        session.status !== 'Exported';
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      totalDocuments: session.totalDocuments,
      categorizedCount: session.categorizedCount,
      skippedCount: session.skippedCount,
      documentStats: stats,
      batches: session.batches,
      categoryCount: session._count.categories,
      extractionErrors: session.extractionErrors,
      // Extraction progress for resumable extraction
      extractionProgress: {
        totalInPst: extractionProgress.totalInPst,
        extractedCount: extractionProgress.extractedCount,
        isComplete: extractionProgress.isComplete,
        remainingCount:
          extractionProgress.totalInPst > 0
            ? Math.max(0, extractionProgress.totalInPst - extractionProgress.extractedCount)
            : -1, // -1 indicates unknown (needs to count PST)
        canContinue,
      },
    });
  } catch (error) {
    console.error('Get extraction status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
