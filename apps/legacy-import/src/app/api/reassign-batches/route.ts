import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autoReassignBatches } from '@/services/batch-allocation.service';
import { requirePartner, AuthError, authErrorResponse } from '@/lib/auth';

interface StalledBatchInfo {
  batchId: string;
  monthYear: string;
  assignedTo: string;
  documentCount: number;
  completedCount: number;
  lastActivity: string | null;
  stalledDays: number;
}

interface ReassignmentResult {
  reassignedCount: number;
  stalledBatches: StalledBatchInfo[];
  finishedUsers: string[];
  message: string;
}

// Default stalled threshold: 24 hours
const DEFAULT_STALLED_HOURS = 24;

// GET /api/reassign-batches - Get stalled batches and finished users info
export async function GET(request: NextRequest) {
  try {
    // Require Partner/BusinessOwner role
    await requirePartner(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    throw error;
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId');
  const stalledHours = parseInt(
    request.nextUrl.searchParams.get('stalledHours') || String(DEFAULT_STALLED_HOURS)
  );

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const stalledThreshold = new Date(Date.now() - stalledHours * 60 * 60 * 1000);

    // Get all batches for the session
    const batches = await prisma.documentBatch.findMany({
      where: { sessionId },
      orderBy: { monthYear: 'asc' },
    });

    // Find stalled batches (assigned but not completed, no activity for stalledHours)
    const stalledBatches: StalledBatchInfo[] = [];
    const userBatches = new Map<string, typeof batches>();
    const finishedUsers: string[] = [];

    for (const batch of batches) {
      if (batch.assignedTo) {
        const existing = userBatches.get(batch.assignedTo) || [];
        existing.push(batch);
        userBatches.set(batch.assignedTo, existing);
      }

      // Check if batch is stalled
      const isComplete = batch.categorizedCount + batch.skippedCount >= batch.documentCount;
      const isStalled = batch.assignedTo && !isComplete && batch.updatedAt < stalledThreshold;

      if (isStalled) {
        const stalledMs = Date.now() - batch.updatedAt.getTime();
        const stalledDays = Math.floor(stalledMs / (24 * 60 * 60 * 1000));

        stalledBatches.push({
          batchId: batch.id,
          monthYear: batch.monthYear,
          assignedTo: batch.assignedTo!,
          documentCount: batch.documentCount,
          completedCount: batch.categorizedCount + batch.skippedCount,
          lastActivity: batch.updatedAt.toISOString(),
          stalledDays,
        });
      }
    }

    // Find users who finished all their batches
    for (const [userId, userBatchList] of userBatches) {
      const allComplete = userBatchList.every(
        (b: { categorizedCount: number; skippedCount: number; documentCount: number }) =>
          b.categorizedCount + b.skippedCount >= b.documentCount
      );
      if (allComplete) {
        finishedUsers.push(userId);
      }
    }

    // Count unassigned batches
    const unassignedCount = batches.filter(
      (b: { assignedTo: string | null }) => !b.assignedTo
    ).length;

    return NextResponse.json({
      stalledBatches,
      finishedUsers,
      unassignedCount,
      totalBatches: batches.length,
    });
  } catch (error) {
    console.error('Error getting reassignment info:', error);
    return NextResponse.json({ error: 'Failed to get reassignment info' }, { status: 500 });
  }
}

// POST /api/reassign-batches - Trigger automatic batch reassignment
export async function POST(request: NextRequest) {
  try {
    // Require Partner/BusinessOwner role
    await requirePartner(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }
    throw error;
  }

  try {
    const body = await request.json();
    const { sessionId, targetUserId, stalledHours = DEFAULT_STALLED_HOURS } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Verify session exists
    const session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let reassignedCount = 0;
    const reassignedBatches: { batchId: string; from: string | null; to: string }[] = [];

    if (targetUserId) {
      // Specific reassignment: Give unassigned/stalled batches to target user
      const stalledThreshold = new Date(Date.now() - stalledHours * 60 * 60 * 1000);

      // First, find unassigned batches
      const unassignedBatches = await prisma.documentBatch.findMany({
        where: {
          sessionId,
          assignedTo: null,
        },
        orderBy: { monthYear: 'asc' },
        take: 3, // Assign up to 3 batches at a time
      });

      // Also find stalled batches if no unassigned ones
      let batchesToAssign = unassignedBatches;

      if (batchesToAssign.length === 0) {
        const stalledBatches = await prisma.documentBatch.findMany({
          where: {
            sessionId,
            assignedTo: { not: null },
            NOT: { assignedTo: targetUserId },
            completedAt: null,
            updatedAt: { lt: stalledThreshold },
          },
          orderBy: { monthYear: 'asc' },
          take: 3,
        });

        // Filter to only incomplete batches
        batchesToAssign = stalledBatches.filter(
          (b: { categorizedCount: number; skippedCount: number; documentCount: number }) =>
            b.categorizedCount + b.skippedCount < b.documentCount
        );
      }

      // Reassign batches
      for (const batch of batchesToAssign) {
        const previousAssignee = batch.assignedTo;

        await prisma.documentBatch.update({
          where: { id: batch.id },
          data: {
            assignedTo: targetUserId,
            assignedAt: new Date(),
          },
        });

        reassignedBatches.push({
          batchId: batch.id,
          from: previousAssignee,
          to: targetUserId,
        });
        reassignedCount++;
      }
    } else {
      // Auto reassignment using the service
      reassignedCount = await autoReassignBatches(sessionId);
    }

    // Get updated stats
    const updatedBatches = await prisma.documentBatch.findMany({
      where: { sessionId },
    });

    const unassignedCount = updatedBatches.filter(
      (b: { assignedTo: string | null }) => !b.assignedTo
    ).length;
    const completedCount = updatedBatches.filter(
      (b: { categorizedCount: number; skippedCount: number; documentCount: number }) =>
        b.categorizedCount + b.skippedCount >= b.documentCount
    ).length;

    const result: ReassignmentResult = {
      reassignedCount,
      stalledBatches: [],
      finishedUsers: [],
      message:
        reassignedCount > 0
          ? `Successfully reassigned ${reassignedCount} batch(es)`
          : 'No batches needed reassignment',
    };

    return NextResponse.json({
      ...result,
      reassignedBatches,
      stats: {
        totalBatches: updatedBatches.length,
        unassignedCount,
        completedCount,
      },
    });
  } catch (error) {
    console.error('Error reassigning batches:', error);
    return NextResponse.json({ error: 'Failed to reassign batches' }, { status: 500 });
  }
}
