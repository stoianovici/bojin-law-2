#!/usr/bin/env npx ts-node
/**
 * Continue Pipeline - Clustering Stage
 *
 * Runs only stages 4-6 (dimension reduction, clustering, naming).
 * Use when embeddings are complete but clustering failed.
 *
 * Run with: node --stack-size=16384 $(which tsx) src/scripts/continue-pipeline-clustering.ts
 */

import { prisma } from '../lib/prisma';
import { DimensionReductionService } from '../services/dimension-reduction.service';
import { ClusteringService } from '../services/clustering.service';
import { ClusterNamingService } from '../services/cluster-naming.service';
import { CategorizationPipelineStatus } from '../generated/prisma';

const SESSION_ID = '8267942a-3721-4956-b866-3aad8e56a1bb';

async function updatePipelineStatus(
  sessionId: string,
  status: CategorizationPipelineStatus,
  error?: string
): Promise<void> {
  const data: Record<string, unknown> = {
    pipelineStatus: status,
    pipelineError: error || null,
  };

  if (status === 'Completed' || status === 'Failed') {
    data.pipelineCompletedAt = new Date();
  }

  await prisma.legacyImportSession.update({
    where: { id: sessionId },
    data,
  });
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Continue Pipeline - Clustering Stages               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nSession: ${SESSION_ID}`);
  console.log('');

  const startTime = Date.now();

  try {
    // Initialize services
    const reductionService = new DimensionReductionService();
    const clusteringService = new ClusteringService();
    const namingService = new ClusterNamingService();

    // ========================================================================
    // Stage 4: Dimension Reduction
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [4/6] Reducing dimensions (UMAP)...                        │');
    console.log('└────────────────────────────────────────────────────────────┘');

    await updatePipelineStatus(SESSION_ID, 'Clustering');
    const reduced = await reductionService.reduceEmbeddings(SESSION_ID);

    console.log(`  ✓ Vectors:      ${reduced.embeddings.size}`);
    console.log(`  ✓ Dimensions:   ${reduced.originalDimensions} → ${reduced.reducedDimensions}`);
    console.log('');

    // ========================================================================
    // Stage 5: Clustering
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [5/6] Clustering documents (OPTICS)...                     │');
    console.log('└────────────────────────────────────────────────────────────┘');

    const clusterStats = await clusteringService.clusterSession(SESSION_ID, reduced.embeddings);

    console.log(`  ✓ Clusters:     ${clusterStats.clusterCount}`);
    console.log(`  ✓ Noise:        ${clusterStats.noiseCount}`);
    console.log(`  ✓ Avg Size:     ${clusterStats.averageClusterSize}`);
    console.log(`  ✓ Largest:      ${clusterStats.largestCluster}`);
    console.log('');

    // ========================================================================
    // Stage 6: Naming
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [6/6] Naming clusters (Claude Haiku)...                    │');
    console.log('└────────────────────────────────────────────────────────────┘');

    await updatePipelineStatus(SESSION_ID, 'Naming');
    await namingService.nameClusters(SESSION_ID);

    console.log('  ✓ Clusters named');
    console.log('');

    // ========================================================================
    // Complete
    // ========================================================================
    await updatePipelineStatus(SESSION_ID, 'ReadyForValidation');

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ✓ Pipeline Complete                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n⏱  Duration: ${minutes}m ${seconds}s`);
    console.log(`📊 Ready for validation at: https://import.bojin-law.com/validate/${SESSION_ID}`);
    console.log('');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Pipeline failed: ${errorMessage}`);

    await updatePipelineStatus(SESSION_ID, 'Failed', errorMessage);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
