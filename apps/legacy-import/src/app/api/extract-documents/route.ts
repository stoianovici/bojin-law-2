/**
 * Extract Documents API Route
 * Processes uploaded PST file and extracts documents
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadFromR2, uploadExtractedDocument } from '@/lib/r2-storage';
import { extractFromPST, groupByMonth, getExtractionSummary } from '@/services/pst-parser.service';

/**
 * POST - Start PST extraction for a session
 */
export async function POST(request: NextRequest) {
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

    if (session.status !== 'Extracting') {
      return NextResponse.json(
        { error: `Invalid session status: ${session.status}. Expected: Extracting` },
        { status: 400 }
      );
    }

    // Download PST from R2
    const pstBuffer = await downloadFromR2(session.pstStoragePath);

    // Extract attachments
    const extractionResult = await extractFromPST(pstBuffer);

    // Get summary
    const summary = getExtractionSummary(extractionResult);

    // Group by month for batch creation
    const byMonth = groupByMonth(extractionResult.attachments);

    // Step 1: Upload all documents to R2 first (outside transaction)
    // This is the slow part that was causing transaction timeouts
    const uploadedDocs: Array<{
      attachment: (typeof extractionResult.attachments)[0];
      storagePath: string;
    }> = [];

    for (const attachment of extractionResult.attachments) {
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
      uploadedDocs.push({ attachment, storagePath: uploadResult.key });
    }

    // Step 2: Create database records in a transaction (with extended timeout)
    const result = await prisma.$transaction(
      async (tx) => {
        const batchIds = new Map<string, string>();

        // Create batches for each month
        for (const [monthYear, attachments] of byMonth) {
          const batch = await tx.documentBatch.create({
            data: {
              sessionId,
              monthYear,
              documentCount: attachments.length,
            },
          });
          batchIds.set(monthYear, batch.id);
        }

        // Create document records (R2 uploads already done)
        const documentRecords = [];
        for (const { attachment, storagePath } of uploadedDocs) {
          const batchId = batchIds.get(attachment.monthYear);
          const doc = await tx.extractedDocument.create({
            data: {
              id: attachment.id,
              sessionId,
              batchId,
              fileName: attachment.fileName,
              fileExtension: attachment.fileExtension,
              fileSizeBytes: attachment.fileSizeBytes,
              storagePath,
              folderPath: attachment.folderPath,
              isSent: attachment.isSent,
              emailSubject: attachment.emailMetadata.subject,
              emailSender:
                attachment.emailMetadata.senderEmail || attachment.emailMetadata.senderName,
              emailReceiver:
                attachment.emailMetadata.receiverEmail || attachment.emailMetadata.receiverName,
              emailDate: attachment.emailMetadata.receivedDate,
              status: 'Uncategorized',
            },
          });
          documentRecords.push(doc);
        }

        // Update session status
        await tx.legacyImportSession.update({
          where: { id: sessionId },
          data: {
            status: 'InProgress',
            totalDocuments: extractionResult.attachments.length,
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
            action: 'EXTRACTION_COMPLETED',
            details: {
              totalDocuments: summary.totalDocuments,
              byExtension: summary.byExtension,
              byMonth: summary.byMonth,
              sentCount: summary.sentCount,
              receivedCount: summary.receivedCount,
              errorCount: summary.errorCount,
              batchCount: byMonth.size,
            },
          },
        });

        return {
          documents: documentRecords,
          batchCount: byMonth.size,
        };
      },
      {
        maxWait: 60000, // 60 seconds max wait to acquire transaction
        timeout: 120000, // 2 minutes timeout for transaction execution
      }
    );

    return NextResponse.json({
      success: true,
      sessionId,
      extraction: {
        totalDocuments: summary.totalDocuments,
        byExtension: summary.byExtension,
        byMonth: summary.byMonth,
        sentCount: summary.sentCount,
        receivedCount: summary.receivedCount,
        uniqueFolders: summary.uniqueFolders,
        batchCount: result.batchCount,
        errorCount: summary.errorCount,
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
    });
  } catch (error) {
    console.error('Get extraction status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
