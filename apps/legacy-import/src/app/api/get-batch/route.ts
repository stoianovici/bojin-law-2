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

/**
 * GET - Get assigned batches for current user, allocating if needed
 */
// Default page size - reasonable for UI performance
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId'); // TODO: Get from auth context
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10))
    );

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
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
    console.error('Get batch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Admin endpoint to get all batches status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, isPartner } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // TODO: Verify user is a Partner
    if (!isPartner) {
      return NextResponse.json({ error: 'Partner access required' }, { status: 403 });
    }

    const status = await getAllBatchesStatus(sessionId);

    return NextResponse.json({
      sessionId,
      ...status,
    });
  } catch (error) {
    console.error('Get all batches status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
