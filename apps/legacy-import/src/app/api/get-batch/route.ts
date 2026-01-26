/**
 * Get Batch API Route
 * Allocates and returns batches for a user
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SkipReason } from '@/generated/prisma';
import {
  allocateBatchesToUser,
  autoReassignBatches,
  getAllBatchesStatus,
} from '@/services/batch-allocation.service';
import { requireAuth, requirePartner, AuthError } from '@/lib/auth';

// Document type filter: 'email' for regular email documents, 'scanned' for scanned documents
type DocumentType = 'email' | 'scanned';

/**
 * GET - Get assigned batches for current user, allocating if needed
 */
// Default page size - reasonable for UI performance
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export async function GET(request: NextRequest) {
  try {
    // Require authenticated user
    const user = await requireAuth(request);
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10))
    );
    // Document type filter: 'email' (default) or 'scanned'
    const documentType = (searchParams.get('documentType') || 'email') as DocumentType;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Verify session exists and is in correct status
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'InProgress' && session.status !== 'Completed') {
      return NextResponse.json(
        { error: `Session not ready for categorization. Status: ${session.status}` },
        { status: 400 }
      );
    }

    // Try auto-reassign first (for finished users)
    await autoReassignBatches(sessionId);

    // Allocate batches to user
    const userBatchInfo = await allocateBatchesToUser(sessionId, userId);

    // Build document type filter
    // Email documents: skipReason is NULL or 'Duplicate' (regular email-extracted docs)
    // Scanned documents: skipReason = 'Scanned'
    const documentTypeFilter =
      documentType === 'scanned'
        ? { skipReason: SkipReason.Scanned }
        : { OR: [{ skipReason: null }, { skipReason: SkipReason.Duplicate }] };

    // Get total document count for pagination info (filtered by document type)
    const batchIds = userBatchInfo.batches.map((b: { batchId: string }) => b.batchId);
    const totalDocumentsInBatches = await prisma.extractedDocument.count({
      where: {
        sessionId,
        batchId: { in: batchIds },
        ...documentTypeFilter,
      },
    });

    // Get documents for user's batches with pagination (filtered by document type)
    const documents = await prisma.extractedDocument.findMany({
      where: {
        sessionId,
        batchId: { in: batchIds },
        ...documentTypeFilter,
      },
      select: {
        id: true,
        fileName: true,
        fileExtension: true,
        folderPath: true,
        isSent: true,
        emailSubject: true,
        emailSender: true,
        emailReceiver: true,
        emailDate: true,
        status: true,
        categoryId: true,
        storagePath: true,
        skipReason: true,
        // AI analysis fields (extractedText loaded lazily via document-url endpoint)
        primaryLanguage: true,
        secondaryLanguage: true,
        languageConfidence: true,
        documentType: true,
        documentTypeConfidence: true,
        templatePotential: true,
      },
      orderBy: [{ emailDate: 'asc' }, { fileName: 'asc' }],
      skip: page * pageSize,
      take: pageSize,
    });

    // Get progress counts for both email and scanned documents
    const [emailCounts, scannedCounts] = await Promise.all([
      // Email documents progress
      prisma.extractedDocument.groupBy({
        by: ['status'],
        where: {
          sessionId,
          OR: [{ skipReason: null }, { skipReason: SkipReason.Duplicate }],
        },
        _count: true,
      }),
      // Scanned documents progress
      prisma.extractedDocument.groupBy({
        by: ['status'],
        where: {
          sessionId,
          skipReason: SkipReason.Scanned,
        },
        _count: true,
      }),
    ]);

    // Calculate email progress
    const emailTotal = emailCounts.reduce((sum, c) => sum + c._count, 0);
    const emailCategorized = emailCounts.find((c) => c.status === 'Categorized')?._count || 0;
    const emailSkipped = emailCounts.find((c) => c.status === 'Skipped')?._count || 0;

    // Calculate scanned progress
    const scannedTotal = scannedCounts.reduce((sum, c) => sum + c._count, 0);
    const scannedCategorized = scannedCounts.find((c) => c.status === 'Categorized')?._count || 0;
    const scannedSkipped = scannedCounts.find((c) => c.status === 'Skipped')?._count || 0;

    // Get categories for this session
    const categories = await prisma.importCategory.findMany({
      where: { sessionId },
      select: {
        id: true,
        name: true,
        documentCount: true,
      },
      orderBy: { name: 'asc' },
    });

    const totalPages = Math.ceil(totalDocumentsInBatches / pageSize);

    // Build progress for active document type
    const activeProgress =
      documentType === 'scanned'
        ? {
            totalDocuments: scannedTotal,
            categorizedCount: scannedCategorized,
            skippedCount: scannedSkipped,
            remainingCount: scannedTotal - scannedCategorized - scannedSkipped,
          }
        : {
            totalDocuments: emailTotal,
            categorizedCount: emailCategorized,
            skippedCount: emailSkipped,
            remainingCount: emailTotal - emailCategorized - emailSkipped,
          };

    return NextResponse.json({
      userId,
      sessionId,
      sessionStatus: session.status,
      documentType,
      batch: userBatchInfo.batches[0] || null, // First batch for backward compat
      batches: userBatchInfo.batches,
      documents,
      categories,
      // Progress for the active document type
      sessionProgress: activeProgress,
      // Separate progress tracking for email and scanned documents
      emailProgress: {
        total: emailTotal,
        categorized: emailCategorized,
        skipped: emailSkipped,
        remaining: emailTotal - emailCategorized - emailSkipped,
      },
      scannedProgress: {
        total: scannedTotal,
        categorized: scannedCategorized,
        skipped: scannedSkipped,
        remaining: scannedTotal - scannedCategorized - scannedSkipped,
      },
      // Legacy summary field (for backward compat)
      summary: activeProgress,
      batchRange:
        userBatchInfo.batches.length > 0
          ? `${userBatchInfo.batches[0].monthYear} - ${userBatchInfo.batches[userBatchInfo.batches.length - 1].monthYear}`
          : null,
      // Pagination info
      pagination: {
        page,
        pageSize,
        totalDocumentsInBatches,
        totalPages,
        hasNextPage: page < totalPages - 1,
        hasPreviousPage: page > 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Get batch error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Admin endpoint to get all batches status (Partner only)
 */
export async function POST(request: NextRequest) {
  try {
    // Require Partner role
    await requirePartner(request);

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const status = await getAllBatchesStatus(sessionId);

    return NextResponse.json({
      sessionId,
      ...status,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Get all batches status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
