/**
 * Pipeline API Route
 * Get pipeline status and trigger pipeline runs.
 * Part of AI Categorization Pipeline - Phase 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CategorizationPipelineStatus } from '@/generated/prisma';

// ============================================================================
// GET - Get pipeline status for a session
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get session with pipeline info
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        pstFileName: true,
        totalDocuments: true,
        pipelineStatus: true,
        pipelineStartedAt: true,
        pipelineCompletedAt: true,
        pipelineError: true,
        pipelineProgress: true,
        triageStats: true,
        deduplicationStats: true,
        clusteringStats: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get triage counts directly from documents
    const triageCounts = await prisma.extractedDocument.groupBy({
      by: ['triageStatus'],
      where: { sessionId },
      _count: true,
    });

    const triageByStatus: Record<string, number> = {};
    for (const item of triageCounts) {
      if (item.triageStatus) {
        triageByStatus[item.triageStatus] = item._count;
      }
    }

    // Get cluster counts
    const clusterCounts = await prisma.documentCluster.groupBy({
      by: ['status'],
      where: { sessionId },
      _count: true,
    });

    const clustersByStatus: Record<string, number> = {};
    for (const item of clusterCounts) {
      clustersByStatus[item.status] = item._count;
    }

    // Calculate progress percentage based on status
    const statusProgress: Record<CategorizationPipelineStatus, number> = {
      NotStarted: 0,
      Triaging: 15,
      Deduplicating: 30,
      Embedding: 50,
      Clustering: 70,
      Naming: 85,
      ReadyForValidation: 90,
      ReClustering: 92,
      Extracting: 95,
      Completed: 100,
      Failed: 0,
    };

    const progress = session.pipelineStatus ? statusProgress[session.pipelineStatus] || 0 : 0;

    return NextResponse.json({
      sessionId,
      pstFileName: session.pstFileName,
      totalDocuments: session.totalDocuments,
      pipeline: {
        status: session.pipelineStatus || 'NotStarted',
        progress,
        startedAt: session.pipelineStartedAt,
        completedAt: session.pipelineCompletedAt,
        error: session.pipelineError,
      },
      triage: {
        stats: session.triageStats,
        byStatus: triageByStatus,
      },
      deduplication: {
        stats: session.deduplicationStats,
      },
      clustering: {
        stats: session.clusteringStats,
        byStatus: clustersByStatus,
      },
    });
  } catch (error) {
    console.error('Pipeline status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Reset pipeline (for re-running after fixes)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action } = body;

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'sessionId and action required' }, { status: 400 });
    }

    if (action !== 'reset') {
      return NextResponse.json({ error: 'Only "reset" action supported' }, { status: 400 });
    }

    // Get session
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      select: { id: true, pipelineStatus: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Only allow reset if failed or completed
    const resettableStatuses: CategorizationPipelineStatus[] = [
      'Failed',
      'Completed',
      'ReadyForValidation',
    ];
    if (session.pipelineStatus && !resettableStatuses.includes(session.pipelineStatus)) {
      return NextResponse.json(
        { error: `Cannot reset pipeline in ${session.pipelineStatus} status` },
        { status: 400 }
      );
    }

    // Reset pipeline status
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        pipelineStatus: 'NotStarted',
        pipelineStartedAt: null,
        pipelineCompletedAt: null,
        pipelineError: null,
        pipelineProgress: undefined,
      },
    });

    // Optionally reset triage/clustering data
    // (This is left to the pipeline runner to handle idempotently)

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Pipeline reset. Run the pipeline script to start again.',
    });
  } catch (error) {
    console.error('Pipeline reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
