/**
 * Re-clustering Trigger API Route
 * Checks conditions and triggers re-clustering of reclassified documents.
 * Part of AI Categorization Pipeline - Phase 3
 *
 * Conditions for re-clustering:
 * 1. All clusters reviewed (no docs with validationStatus IS NULL in non-deleted clusters)
 * 2. All uncertain docs processed (no docs with triageStatus = 'Uncertain' AND validationStatus IS NULL)
 * 3. Reclassified pool > 0 (count of docs with validationStatus = 'Reclassified')
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CategorizationPipelineStatus } from '@/generated/prisma';
import { reclusterService } from '@/services/recluster.service';

// Time window to consider a recent re-clustering as 'completed' (5 minutes)
const RECENT_COMPLETION_WINDOW_MS = 5 * 60 * 1000;

// ============================================================================
// GET - Return re-clustering status and conditions
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get session
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        pipelineStatus: true,
        pipelineProgress: true,
        pipelineCompletedAt: true,
        updatedAt: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Condition 1: All clusters reviewed
    // Count documents in non-deleted clusters that have not been validated yet
    const unreviewedInClusters = await prisma.extractedDocument.count({
      where: {
        sessionId,
        clusterId: { not: null },
        validationStatus: null,
        cluster: {
          isDeleted: false,
        },
      },
    });
    const allClustersReviewed = unreviewedInClusters === 0;

    // Condition 2: All uncertain docs processed
    // Count documents with triageStatus = 'Uncertain' AND validationStatus IS NULL
    const unprocessedUncertain = await prisma.extractedDocument.count({
      where: {
        sessionId,
        triageStatus: 'Uncertain',
        validationStatus: null,
      },
    });
    const allUncertainProcessed = unprocessedUncertain === 0;

    // Condition 3: Count reclassified documents
    const reclassifiedCount = await prisma.extractedDocument.count({
      where: {
        sessionId,
        validationStatus: 'Reclassified',
      },
    });

    // Determine canTrigger
    const canTrigger = allClustersReviewed && allUncertainProcessed && reclassifiedCount > 0;

    // Determine status
    let status: 'idle' | 'processing' | 'completed' = 'idle';

    if (session.pipelineStatus === 'ReClustering') {
      status = 'processing';
    } else {
      // Check if there was a recent re-clustering completion
      // We check if pipelineStatus just changed from ReClustering within the last 5 minutes
      // by looking at updatedAt (approximation since we don't track status change history)
      const now = Date.now();
      const updatedAtMs = session.updatedAt?.getTime() || 0;
      const isRecent = now - updatedAtMs < RECENT_COMPLETION_WINDOW_MS;

      // If the session was recently updated and is in a post-ReClustering status, consider it completed
      const postReclusteringStatuses: CategorizationPipelineStatus[] = [
        'ReadyForValidation',
        'Naming',
        'Completed',
      ];
      if (
        isRecent &&
        session.pipelineStatus &&
        postReclusteringStatuses.includes(session.pipelineStatus)
      ) {
        status = 'completed';
      }
    }

    // Get progress if processing
    let progress: { current: number; total: number; message?: string } | undefined;
    if (status === 'processing' && session.pipelineProgress) {
      const progressData = session.pipelineProgress as {
        current?: number;
        total?: number;
        message?: string;
      };
      progress = {
        current: progressData.current ?? 0,
        total: progressData.total ?? reclassifiedCount,
        message: progressData.message,
      };
    } else if (status === 'processing') {
      // Fallback if no progress data yet
      progress = {
        current: 0,
        total: reclassifiedCount,
        message: 'Starting re-clustering...',
      };
    }

    return NextResponse.json({
      canTrigger,
      conditions: {
        allClustersReviewed,
        allUncertainProcessed,
        reclassifiedCount,
      },
      status,
      ...(progress && { progress }),
    });
  } catch (error) {
    console.error('Re-cluster status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Trigger re-clustering
// ============================================================================

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
      select: {
        id: true,
        pipelineStatus: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if already processing
    if (session.pipelineStatus === 'ReClustering') {
      return NextResponse.json({ error: 'Re-clustering is already in progress' }, { status: 400 });
    }

    // Validate all conditions are met
    // Condition 1: All clusters reviewed
    const unreviewedInClusters = await prisma.extractedDocument.count({
      where: {
        sessionId,
        clusterId: { not: null },
        validationStatus: null,
        cluster: {
          isDeleted: false,
        },
      },
    });

    if (unreviewedInClusters > 0) {
      return NextResponse.json(
        {
          error: 'Not all clusters have been reviewed',
          unreviewedCount: unreviewedInClusters,
        },
        { status: 400 }
      );
    }

    // Condition 2: All uncertain docs processed
    const unprocessedUncertain = await prisma.extractedDocument.count({
      where: {
        sessionId,
        triageStatus: 'Uncertain',
        validationStatus: null,
      },
    });

    if (unprocessedUncertain > 0) {
      return NextResponse.json(
        {
          error: 'Not all uncertain documents have been processed',
          unprocessedCount: unprocessedUncertain,
        },
        { status: 400 }
      );
    }

    // Condition 3: Must have reclassified documents
    const reclassifiedCount = await prisma.extractedDocument.count({
      where: {
        sessionId,
        validationStatus: 'Reclassified',
      },
    });

    if (reclassifiedCount === 0) {
      return NextResponse.json({ error: 'No reclassified documents to process' }, { status: 400 });
    }

    // All conditions met - update pipeline status to ReClustering
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        pipelineStatus: 'ReClustering',
        pipelineProgress: {
          stage: 'ReClustering',
          current: 0,
          total: reclassifiedCount,
        },
      },
    });

    console.log(
      `[ReClustering] Triggered for session ${sessionId} with ${reclassifiedCount} reclassified documents`
    );

    // Run re-clustering asynchronously (fire-and-forget)
    // The service will update the pipeline status when complete
    reclusterService.recluster(sessionId).catch((error) => {
      console.error(`[ReClustering] Error processing session ${sessionId}:`, error);
    });

    return NextResponse.json({
      triggered: true,
      sessionId,
      reclassifiedCount,
      message: 'Re-clustering has been triggered. The system will process reclassified documents.',
    });
  } catch (error) {
    console.error('Re-cluster trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
