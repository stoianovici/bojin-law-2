#!/usr/bin/env npx ts-node
/**
 * Template Extraction Script
 *
 * Extracts document templates from approved clusters.
 * Usage: npx ts-node src/scripts/extract-templates.ts --session=<sessionId>
 *
 * Prerequisites:
 * - Pipeline has been run (status = ReadyForValidation or Completed)
 * - Clusters have been validated (approved/rejected)
 */

import { prisma } from '../lib/prisma';
import { TemplateExtractionService } from '../services/template-extraction.service';

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
    console.error('Usage: npx ts-node src/scripts/extract-templates.ts --session=<sessionId>');
    process.exit(1);
  }

  return { sessionId };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { sessionId } = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Template Extraction from Approved Clusters       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nSession: ${sessionId}`);
  console.log('');

  // Verify session exists and is ready
  const session = await prisma.legacyImportSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      pstFileName: true,
      pipelineStatus: true,
    },
  });

  if (!session) {
    console.error(`❌ Session not found: ${sessionId}`);
    process.exit(1);
  }

  console.log(`📁 PST File: ${session.pstFileName}`);
  console.log(`📊 Pipeline Status: ${session.pipelineStatus || 'Not started'}`);
  console.log('');

  // Check pipeline status
  const validStatuses = ['ReadyForValidation', 'Completed', 'Extracting'];
  if (!session.pipelineStatus || !validStatuses.includes(session.pipelineStatus)) {
    console.error(
      `❌ Pipeline must be in ReadyForValidation or Completed status. Current: ${session.pipelineStatus}`
    );
    console.error('   Run the categorization pipeline first:');
    console.error(`   npx ts-node src/scripts/run-pipeline.ts --session=${sessionId}`);
    process.exit(1);
  }

  // Get cluster stats
  const clusterStats = await prisma.documentCluster.groupBy({
    by: ['status'],
    where: { sessionId },
    _count: true,
  });

  const approved = clusterStats.find((s) => s.status === 'Approved')?._count || 0;
  const pending = clusterStats.find((s) => s.status === 'Pending')?._count || 0;
  const rejected = clusterStats.find((s) => s.status === 'Rejected')?._count || 0;

  console.log('📋 Cluster Validation Status:');
  console.log(`   ✓ Approved: ${approved}`);
  console.log(`   ⏳ Pending:  ${pending}`);
  console.log(`   ✗ Rejected: ${rejected}`);
  console.log('');

  if (approved === 0) {
    console.error('❌ No approved clusters found. Please validate clusters first:');
    console.error(`   https://import.bojin-law.com/validate/${sessionId}`);
    process.exit(1);
  }

  if (pending > 0) {
    console.warn(`⚠️  Warning: ${pending} clusters still pending validation.`);
    console.warn('   Templates will only be extracted from approved clusters.');
    console.warn('');
  }

  const startTime = Date.now();

  try {
    // Update status
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: { pipelineStatus: 'Extracting' },
    });

    // Extract templates
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ Extracting templates (Claude Sonnet Batch API)...         │');
    console.log('└────────────────────────────────────────────────────────────┘');
    console.log('');

    const service = new TemplateExtractionService();
    const stats = await service.extractTemplates(sessionId);

    console.log('');
    console.log(`  ✓ Extracted: ${stats.extracted}`);
    console.log(`  ⏭ Skipped:   ${stats.skipped} (too few documents)`);
    console.log(`  ✗ Errors:    ${stats.errors}`);
    console.log('');

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✓ Template Extraction Complete                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n⏱  Duration: ${minutes}m ${seconds}s`);
    console.log(`📄 View templates at: https://import.bojin-law.com/templates/${sessionId}`);
    console.log('');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Extraction failed: ${errorMessage}`);

    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        pipelineStatus: 'Failed',
        pipelineError: `Template extraction: ${errorMessage}`,
      },
    });

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
