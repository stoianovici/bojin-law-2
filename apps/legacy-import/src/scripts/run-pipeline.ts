#!/usr/bin/env npx ts-node
/**
 * AI Categorization Pipeline Runner
 *
 * Runs the full AI categorization pipeline for a legacy import session.
 * Usage: npx ts-node src/scripts/run-pipeline.ts --session=<sessionId>
 *
 * Pipeline stages:
 * 1. Triage - Classify documents as FirmDrafted/ThirdParty/Irrelevant/CourtDoc/Uncertain
 * 2. Deduplication - Group duplicates by content hash, select canonical versions
 * 3. Embedding - Generate Voyage AI embeddings for FirmDrafted canonicals
 * 4. Dimension Reduction - UMAP 1536→50 dimensions for efficient clustering
 * 5. Clustering - OPTICS clustering on reduced embeddings
 * 6. Naming - AI-suggested names for clusters
 */

import { prisma } from '../lib/prisma';
import { AITriageService } from '../services/ai-triage.service';
import { DeduplicationService } from '../services/deduplication.service';
import { EmbeddingBatchService } from '../services/embedding-batch.service';
import { DimensionReductionService } from '../services/dimension-reduction.service';
import { ClusteringService } from '../services/clustering.service';
import { ClusterNamingService } from '../services/cluster-naming.service';
import { CategorizationPipelineStatus } from '../generated/prisma';

// ============================================================================
// Parse Arguments
// ============================================================================

function parseArgs(): { sessionId: string } {
  const args = process.argv.slice(2);
  let sessionId: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--session=')) {
      sessionId = arg.replace('--session=', '');
    }
  }

  if (!sessionId) {
    console.error('Usage: npx ts-node src/scripts/run-pipeline.ts --session=<sessionId>');
    process.exit(1);
  }

  return { sessionId };
}

// ============================================================================
// Pipeline Runner
// ============================================================================

async function updatePipelineStatus(
  sessionId: string,
  status: CategorizationPipelineStatus,
  error?: string
): Promise<void> {
  const data: any = {
    pipelineStatus: status,
  };

  if (status === 'NotStarted') {
    data.pipelineStartedAt = new Date();
  }

  if (status === 'Completed' || status === 'Failed') {
    data.pipelineCompletedAt = new Date();
  }

  if (error) {
    data.pipelineError = error;
  }

  await prisma.legacyImportSession.update({
    where: { id: sessionId },
    data,
  });
}

async function main(): Promise<void> {
  const { sessionId } = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        AI Document Categorization Pipeline                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nSession: ${sessionId}`);
  console.log('');

  // Verify session exists
  const session = await prisma.legacyImportSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      pstFileName: true,
      totalDocuments: true,
      pipelineStatus: true,
    },
  });

  if (!session) {
    console.error(`❌ Session not found: ${sessionId}`);
    process.exit(1);
  }

  console.log(`📁 PST File: ${session.pstFileName}`);
  console.log(`📄 Total Documents: ${session.totalDocuments}`);
  console.log('');

  // Check if already running
  if (session.pipelineStatus && !['NotStarted', 'Failed'].includes(session.pipelineStatus)) {
    console.error(`❌ Pipeline already in progress: ${session.pipelineStatus}`);
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    // Initialize services
    const triageService = new AITriageService();
    const dedupService = new DeduplicationService();
    const embeddingService = new EmbeddingBatchService();
    const reductionService = new DimensionReductionService();
    const clusteringService = new ClusteringService();
    const namingService = new ClusterNamingService();

    // ========================================================================
    // Stage 1: Triage
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [1/6] Triaging documents...                                │');
    console.log('└────────────────────────────────────────────────────────────┘');

    await updatePipelineStatus(sessionId, 'Triaging');
    const triageStats = await triageService.triageSession(sessionId);

    console.log(`  ✓ FirmDrafted:  ${triageStats.firmDrafted}`);
    console.log(`  ✓ ThirdParty:   ${triageStats.thirdParty}`);
    console.log(`  ✓ Irrelevant:   ${triageStats.irrelevant}`);
    console.log(`  ✓ CourtDoc:     ${triageStats.courtDoc}`);
    console.log(`  ✓ Uncertain:    ${triageStats.uncertain}`);
    console.log('');

    // ========================================================================
    // Stage 2: Deduplication
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [2/6] Deduplicating FirmDrafted documents...               │');
    console.log('└────────────────────────────────────────────────────────────┘');

    await updatePipelineStatus(sessionId, 'Deduplicating');
    const dedupStats = await dedupService.deduplicateSession(sessionId);

    console.log(`  ✓ Unique:       ${dedupStats.unique}`);
    console.log(`  ✓ Duplicates:   ${dedupStats.duplicates}`);
    console.log(`  ✓ Groups:       ${dedupStats.groups}`);
    console.log('');

    // ========================================================================
    // Stage 3: Embeddings
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [3/6] Generating embeddings (Voyage AI)...                 │');
    console.log('└────────────────────────────────────────────────────────────┘');

    await updatePipelineStatus(sessionId, 'Embedding');
    const embedStats = await embeddingService.embedSession(sessionId);

    console.log(`  ✓ Embedded:     ${embedStats.embedded}`);
    console.log(`  ✓ Errors:       ${embedStats.errors}`);
    console.log('');

    // ========================================================================
    // Stage 4: Dimension Reduction
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [4/6] Reducing dimensions (UMAP)...                        │');
    console.log('└────────────────────────────────────────────────────────────┘');

    await updatePipelineStatus(sessionId, 'Clustering');
    const reduced = await reductionService.reduceEmbeddings(sessionId);

    console.log(`  ✓ Vectors:      ${reduced.embeddings.size}`);
    console.log(`  ✓ Dimensions:   ${reduced.originalDimensions} → ${reduced.reducedDimensions}`);
    console.log('');

    // ========================================================================
    // Stage 5: Clustering
    // ========================================================================
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ [5/6] Clustering documents (OPTICS)...                     │');
    console.log('└────────────────────────────────────────────────────────────┘');

    const clusterStats = await clusteringService.clusterSession(sessionId, reduced.embeddings);

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

    await updatePipelineStatus(sessionId, 'Naming');
    await namingService.nameClusters(sessionId);

    console.log('  ✓ Clusters named');
    console.log('');

    // ========================================================================
    // Complete
    // ========================================================================
    await updatePipelineStatus(sessionId, 'ReadyForValidation');

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ✓ Pipeline Complete                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n⏱  Duration: ${minutes}m ${seconds}s`);
    console.log(`📊 Ready for validation at: https://import.bojin-law.com/validate/${sessionId}`);
    console.log('');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Pipeline failed: ${errorMessage}`);

    await updatePipelineStatus(sessionId, 'Failed', errorMessage);
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
