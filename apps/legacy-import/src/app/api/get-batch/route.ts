/**
 * Get Batch API Route
 * Allocates and returns batches for a user
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  allocateBatchesToUser,
  autoReassignBatches,
  getAllBatchesStatus,
} from '@/services/batch-allocation.service';
import { requireAuth, requirePartner, AuthError } from '@/lib/auth';

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

    // Get total document count for pagination info
    const batchIds = userBatchInfo.batches.map((b: { batchId: string }) => b.batchId);
    const totalDocumentsInBatches = await prisma.extractedDocument.count({
      where: {
        sessionId,
        batchId: { in: batchIds },
      },
    });

    // Get documents for user's batches with pagination
    const documents = await prisma.extractedDocument.findMany({
      where: {
        sessionId,
        batchId: { in: batchIds },
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

    return NextResponse.json({
      userId,
      sessionId,
      sessionStatus: session.status,
      batch: userBatchInfo.batches[0] || null, // First batch for backward compat
      batches: userBatchInfo.batches,
      documents,
      categories,
      sessionProgress: {
        totalDocuments: userBatchInfo.totalDocuments,
        categorizedCount: userBatchInfo.categorizedCount,
        skippedCount: userBatchInfo.skippedCount,
        remainingCount: userBatchInfo.remainingCount,
      },
      summary: {
        totalDocuments: userBatchInfo.totalDocuments,
        categorizedCount: userBatchInfo.categorizedCount,
        skippedCount: userBatchInfo.skippedCount,
        remainingCount: userBatchInfo.remainingCount,
      },
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
