/**
 * Batch Allocation Service
 * Manages fair distribution of document batches to assistants
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { prisma } from '@/lib/prisma';

export interface BatchAllocation {
  batchId: string;
  monthYear: string;
  documentCount: number;
  categorizedCount: number;
  skippedCount: number;
  assignedTo: string | null;
  assignedAt: Date | null;
}

export interface UserBatchInfo {
  userId: string;
  batches: BatchAllocation[];
  totalDocuments: number;
  categorizedCount: number;
  skippedCount: number;
  remainingCount: number;
}

export interface SessionProgress {
  sessionId: string;
  totalDocuments: number;
  categorizedCount: number;
  skippedCount: number;
  remainingCount: number;
  progress: number; // 0-100 percentage
  batchCount: number;
  assignedBatchCount: number;
  completedBatchCount: number;
}

/**
 * Allocates batches to a user based on fair distribution
 * Strategy: Assign oldest unassigned months first, distribute evenly
 */
export async function allocateBatchesToUser(
  sessionId: string,
  userId: string
): Promise<UserBatchInfo> {
  // Get current user's assigned batches
  const existingBatches = await prisma.documentBatch.findMany({
    where: {
      sessionId,
      assignedTo: userId,
    },
    orderBy: { monthYear: 'asc' },
  });

  // If user already has batches, return them
  if (existingBatches.length > 0) {
    const totalDocs = existingBatches.reduce((sum, b) => sum + b.documentCount, 0);
    const categorized = existingBatches.reduce((sum, b) => sum + b.categorizedCount, 0);
    const skipped = existingBatches.reduce((sum, b) => sum + b.skippedCount, 0);

    return {
      userId,
      batches: existingBatches.map(b => ({
        batchId: b.id,
        monthYear: b.monthYear,
        documentCount: b.documentCount,
        categorizedCount: b.categorizedCount,
        skippedCount: b.skippedCount,
        assignedTo: b.assignedTo,
        assignedAt: b.assignedAt,
      })),
      totalDocuments: totalDocs,
      categorizedCount: categorized,
      skippedCount: skipped,
      remainingCount: totalDocs - categorized - skipped,
    };
  }

  // Get all batches for the session
  const allBatches = await prisma.documentBatch.findMany({
    where: { sessionId },
    orderBy: { monthYear: 'asc' },
  });

  // Get unique assigned users
  const assignedUsers = new Set(
    allBatches.filter(b => b.assignedTo).map(b => b.assignedTo)
  );
  const totalUsers = assignedUsers.size + 1; // +1 for new user

  // Calculate fair share (batches per user)
  const batchesPerUser = Math.ceil(allBatches.length / totalUsers);

  // Get unassigned batches
  const unassignedBatches = allBatches.filter(b => !b.assignedTo);

  // Assign batches to this user (oldest first)
  const batchesToAssign = unassignedBatches.slice(0, batchesPerUser);

  if (batchesToAssign.length === 0) {
    // All batches assigned, check if any can be reassigned
    const reassignableBatches = await findReassignableBatches(sessionId);
    if (reassignableBatches.length > 0) {
      batchesToAssign.push(...reassignableBatches.slice(0, Math.max(1, batchesPerUser)));
    }
  }

  // Update batches with assignment
  const assignedBatchIds = batchesToAssign.map(b => b.id);
  await prisma.documentBatch.updateMany({
    where: {
      id: { in: assignedBatchIds },
    },
    data: {
      assignedTo: userId,
      assignedAt: new Date(),
    },
  });

  // Get updated batches
  const assignedBatches = await prisma.documentBatch.findMany({
    where: {
      sessionId,
      assignedTo: userId,
    },
    orderBy: { monthYear: 'asc' },
  });

  const totalDocs = assignedBatches.reduce((sum, b) => sum + b.documentCount, 0);
  const categorized = assignedBatches.reduce((sum, b) => sum + b.categorizedCount, 0);
  const skipped = assignedBatches.reduce((sum, b) => sum + b.skippedCount, 0);

  return {
    userId,
    batches: assignedBatches.map(b => ({
      batchId: b.id,
      monthYear: b.monthYear,
      documentCount: b.documentCount,
      categorizedCount: b.categorizedCount,
      skippedCount: b.skippedCount,
      assignedTo: b.assignedTo,
      assignedAt: b.assignedAt,
    })),
    totalDocuments: totalDocs,
    categorizedCount: categorized,
    skippedCount: skipped,
    remainingCount: totalDocs - categorized - skipped,
  };
}

/**
 * Finds batches that can be reassigned (stalled or from finished users)
 */
async function findReassignableBatches(sessionId: string): Promise<{ id: string }[]> {
  // Find batches from users who have completed their allocation
  // but have other incomplete batches (stalled)
  const stalledThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

  // Get batches with no progress in last 24 hours that aren't complete
  // First get all batches and filter in memory
  const stalledBatches = await prisma.documentBatch.findMany({
    where: {
      sessionId,
      assignedTo: { not: null },
      completedAt: null,
      updatedAt: { lt: stalledThreshold },
    },
    select: { id: true, categorizedCount: true, skippedCount: true, documentCount: true },
    orderBy: { monthYear: 'asc' },
  });

  // Filter to only incomplete batches
  return stalledBatches
    .filter((b) => b.categorizedCount + b.skippedCount < b.documentCount)
    .map((b) => ({ id: b.id }));
}

/**
 * Auto-reassigns batches from completed users to those still working
 */
export async function autoReassignBatches(sessionId: string): Promise<number> {
  // Find users who have completed all their batches
  const batches = await prisma.documentBatch.findMany({
    where: { sessionId },
  });

  const userBatches = new Map<string, typeof batches>();
  for (const batch of batches) {
    if (batch.assignedTo) {
      const existing = userBatches.get(batch.assignedTo) || [];
      existing.push(batch);
      userBatches.set(batch.assignedTo, existing);
    }
  }

  // Find users who finished all their work
  const finishedUsers: string[] = [];
  const activeUsers: string[] = [];

  for (const [userId, userBatchList] of userBatches) {
    const allComplete = userBatchList.every(
      b => b.categorizedCount + b.skippedCount >= b.documentCount
    );
    if (allComplete) {
      finishedUsers.push(userId);
    } else {
      activeUsers.push(userId);
    }
  }

  // If no active users or no unassigned batches, nothing to do
  const unassignedBatches = batches.filter(b => !b.assignedTo);
  if (finishedUsers.length === 0 || unassignedBatches.length === 0) {
    return 0;
  }

  // Assign remaining batches to finished users
  let reassignedCount = 0;
  for (const finishedUser of finishedUsers) {
    const batchToAssign = unassignedBatches.shift();
    if (!batchToAssign) break;

    await prisma.documentBatch.update({
      where: { id: batchToAssign.id },
      data: {
        assignedTo: finishedUser,
        assignedAt: new Date(),
      },
    });

    reassignedCount++;
  }

  return reassignedCount;
}

/**
 * Gets session-wide progress statistics
 */
export async function getSessionProgress(sessionId: string): Promise<SessionProgress> {
  const session = await prisma.legacyImportSession.findUnique({
    where: { id: sessionId },
    include: {
      batches: true,
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const totalDocuments = session.totalDocuments;
  const categorizedCount = session.categorizedCount;
  const skippedCount = session.skippedCount;
  const remainingCount = totalDocuments - categorizedCount - skippedCount;

  const assignedBatchCount = session.batches.filter(b => b.assignedTo).length;
  const completedBatchCount = session.batches.filter(
    b => b.categorizedCount + b.skippedCount >= b.documentCount
  ).length;

  return {
    sessionId,
    totalDocuments,
    categorizedCount,
    skippedCount,
    remainingCount,
    progress: totalDocuments > 0 ? Math.round(((categorizedCount + skippedCount) / totalDocuments) * 100) : 0,
    batchCount: session.batches.length,
    assignedBatchCount,
    completedBatchCount,
  };
}

/**
 * Gets detailed batch status for admin/partner view
 */
export async function getAllBatchesStatus(sessionId: string): Promise<{
  batches: (BatchAllocation & { userName?: string })[];
  userSummary: { userId: string; totalDocs: number; completed: number }[];
}> {
  const batches = await prisma.documentBatch.findMany({
    where: { sessionId },
    orderBy: { monthYear: 'asc' },
  });

  // Group by user for summary
  const userMap = new Map<string, { totalDocs: number; completed: number }>();

  for (const batch of batches) {
    if (batch.assignedTo) {
      const existing = userMap.get(batch.assignedTo) || { totalDocs: 0, completed: 0 };
      existing.totalDocs += batch.documentCount;
      existing.completed += batch.categorizedCount + batch.skippedCount;
      userMap.set(batch.assignedTo, existing);
    }
  }

  return {
    batches: batches.map(b => ({
      batchId: b.id,
      monthYear: b.monthYear,
      documentCount: b.documentCount,
      categorizedCount: b.categorizedCount,
      skippedCount: b.skippedCount,
      assignedTo: b.assignedTo,
      assignedAt: b.assignedAt,
    })),
    userSummary: Array.from(userMap.entries()).map(([userId, stats]) => ({
      userId,
      ...stats,
    })),
  };
}

/**
 * Marks a batch as completed when all documents are categorized/skipped
 */
export async function checkAndMarkBatchComplete(batchId: string): Promise<boolean> {
  const batch = await prisma.documentBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) return false;

  const isComplete = batch.categorizedCount + batch.skippedCount >= batch.documentCount;

  if (isComplete && !batch.completedAt) {
    await prisma.documentBatch.update({
      where: { id: batchId },
      data: { completedAt: new Date() },
    });
    return true;
  }

  return isComplete;
}

/**
 * Updates batch statistics after a document is categorized
 */
export async function updateBatchStats(batchId: string): Promise<void> {
  const stats = await prisma.extractedDocument.groupBy({
    by: ['status'],
    where: { batchId },
    _count: true,
  });

  let categorizedCount = 0;
  let skippedCount = 0;

  for (const stat of stats) {
    if (stat.status === 'Categorized') categorizedCount = stat._count;
    if (stat.status === 'Skipped') skippedCount = stat._count;
  }

  await prisma.documentBatch.update({
    where: { id: batchId },
    data: {
      categorizedCount,
      skippedCount,
    },
  });

  // Check if batch is complete
  await checkAndMarkBatchComplete(batchId);
}

/**
 * Updates session-level statistics
 */
export async function updateSessionStats(sessionId: string): Promise<void> {
  const stats = await prisma.extractedDocument.groupBy({
    by: ['status'],
    where: { sessionId },
    _count: true,
  });

  let categorizedCount = 0;
  let skippedCount = 0;

  for (const stat of stats) {
    if (stat.status === 'Categorized') categorizedCount = stat._count;
    if (stat.status === 'Skipped') skippedCount = stat._count;
  }

  await prisma.legacyImportSession.update({
    where: { id: sessionId },
    data: {
      categorizedCount,
      skippedCount,
    },
  });
}
