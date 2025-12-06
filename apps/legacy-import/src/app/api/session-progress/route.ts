/**
 * Session Progress API Route
 * Returns overall session progress and statistics
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET - Get session progress statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Get session with related data
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
            completedAt: true,
          },
          orderBy: { monthYear: 'asc' },
        },
        categories: {
          select: {
            id: true,
            name: true,
            documentCount: true,
          },
          orderBy: { documentCount: 'desc' },
        },
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get document statistics by status
    const documentStats = await prisma.extractedDocument.groupBy({
      by: ['status'],
      where: { sessionId },
      _count: true,
    });

    const statusCounts = {
      uncategorized: 0,
      categorized: 0,
      skipped: 0,
    };

    for (const stat of documentStats) {
      if (stat.status === 'Uncategorized') statusCounts.uncategorized = stat._count;
      if (stat.status === 'Categorized') statusCounts.categorized = stat._count;
      if (stat.status === 'Skipped') statusCounts.skipped = stat._count;
    }

    // Get document statistics by file extension
    const extensionStats = await prisma.extractedDocument.groupBy({
      by: ['fileExtension'],
      where: { sessionId },
      _count: true,
    });

    const byExtension: Record<string, number> = {};
    for (const stat of extensionStats) {
      byExtension[stat.fileExtension] = stat._count;
    }

    // Get sent/received counts
    const sentReceivedStats = await prisma.extractedDocument.groupBy({
      by: ['isSent'],
      where: { sessionId },
      _count: true,
    });

    let sentCount = 0;
    let receivedCount = 0;
    for (const stat of sentReceivedStats) {
      if (stat.isSent) sentCount = stat._count;
      else receivedCount = stat._count;
    }

    // Calculate batch progress
    const completedBatches = session.batches.filter((b: { completedAt: Date | null }) => b.completedAt !== null).length;
    const assignedBatches = session.batches.filter((b: { assignedTo: string | null }) => b.assignedTo !== null).length;

    // Get unique users working on session
    const activeUsers = new Set(session.batches.filter((b: { assignedTo: string | null }) => b.assignedTo).map((b: { assignedTo: string | null }) => b.assignedTo));

    // Calculate overall progress percentage
    const totalDocs = session.totalDocuments;
    const processedDocs = statusCounts.categorized + statusCounts.skipped;
    const progressPercent = totalDocs > 0 ? Math.round((processedDocs / totalDocs) * 100) : 0;

    return NextResponse.json({
      sessionId,
      status: session.status,
      pstFileName: session.pstFileName,

      // Overall progress
      progress: {
        totalDocuments: totalDocs,
        categorized: statusCounts.categorized,
        skipped: statusCounts.skipped,
        remaining: statusCounts.uncategorized,
        percentage: progressPercent,
      },

      // Document breakdown
      documents: {
        byStatus: statusCounts,
        byExtension,
        sentCount,
        receivedCount,
      },

      // Batch info
      batches: {
        total: session.batches.length,
        assigned: assignedBatches,
        completed: completedBatches,
        items: session.batches.map((b: typeof session.batches[number]) => ({
          id: b.id,
          monthYear: b.monthYear,
          assignedTo: b.assignedTo,
          documentCount: b.documentCount,
          progress: b.documentCount > 0
            ? Math.round(((b.categorizedCount + b.skippedCount) / b.documentCount) * 100)
            : 100,
          isComplete: b.completedAt !== null,
        })),
      },

      // Category breakdown
      categories: session.categories.map((c: typeof session.categories[number]) => ({
        id: c.id,
        name: c.name,
        documentCount: c.documentCount,
      })),

      // Users
      activeUserCount: activeUsers.size,

      // Timestamps
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      exportedAt: session.exportedAt,
    });
  } catch (error) {
    console.error('Session progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
