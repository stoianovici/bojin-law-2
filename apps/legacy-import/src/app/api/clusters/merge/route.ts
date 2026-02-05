/**
 * Cluster Merge API Route
 * Merges multiple clusters into one.
 * Part of AI Categorization Pipeline - Phase 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ============================================================================
// POST - Merge clusters
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clusterIds, newName, newNameEn, description } = body;

    if (!clusterIds || !Array.isArray(clusterIds) || clusterIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 clusterIds required' }, { status: 400 });
    }

    if (!newName) {
      return NextResponse.json({ error: 'newName required for merged cluster' }, { status: 400 });
    }

    // Get all clusters to merge
    const clusters = await prisma.documentCluster.findMany({
      where: { id: { in: clusterIds } },
    });

    if (clusters.length !== clusterIds.length) {
      return NextResponse.json({ error: 'Some clusters not found' }, { status: 404 });
    }

    // Ensure all clusters are from the same session
    const sessionIds = new Set(clusters.map((c) => c.sessionId));
    if (sessionIds.size > 1) {
      return NextResponse.json(
        { error: 'All clusters must be from the same session' },
        { status: 400 }
      );
    }

    // All clusters must be from same session (already verified above)
    // Use the first cluster as the target
    const targetCluster = clusters[0];
    const sourceClusterIds = clusterIds.slice(1);

    // Collect all sample document IDs (up to 5 total)
    const allSampleIds = clusters.flatMap((c) => c.sampleDocumentIds);
    const mergedSampleIds = allSampleIds.slice(0, 5);

    // Calculate total document count
    const totalDocCount = clusters.reduce((sum, c) => sum + c.documentCount, 0);

    // Transaction to merge clusters
    await prisma.$transaction(async (tx) => {
      // Move all documents from source clusters to target cluster
      await tx.extractedDocument.updateMany({
        where: {
          clusterId: { in: sourceClusterIds },
        },
        data: {
          clusterId: targetCluster.id,
        },
      });

      // Update target cluster
      await tx.documentCluster.update({
        where: { id: targetCluster.id },
        data: {
          suggestedName: newName,
          suggestedNameEn: newNameEn || newName,
          description: description || `Merged from ${clusters.length} clusters`,
          documentCount: totalDocCount,
          sampleDocumentIds: mergedSampleIds,
          status: 'Pending', // Reset status for re-validation
        },
      });

      // Delete source clusters
      await tx.documentCluster.deleteMany({
        where: { id: { in: sourceClusterIds } },
      });
    });

    return NextResponse.json({
      success: true,
      mergedClusterId: targetCluster.id,
      documentCount: totalDocCount,
      mergedCount: clusters.length,
    });
  } catch (error) {
    console.error('Cluster merge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
