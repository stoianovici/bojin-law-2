/**
 * Cleanup Junk Documents Script
 *
 * Retroactively removes PNG files and duplicates from case documents.
 * Run with: npx tsx scripts/cleanup-junk-documents.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupStats {
  pngDocuments: number;
  pngCaseLinksRemoved: number;
  duplicateGroups: number;
  duplicateCaseLinksRemoved: number;
}

async function analyzeAndCleanup(dryRun: boolean): Promise<CleanupStats> {
  const stats: CleanupStats = {
    pngDocuments: 0,
    pngCaseLinksRemoved: 0,
    duplicateGroups: 0,
    duplicateCaseLinksRemoved: 0,
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Document Cleanup ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`${'='.repeat(60)}\n`);

  // ============================================================================
  // Step 1: Find and remove PNG documents from cases
  // ============================================================================

  console.log('📸 Analyzing PNG documents...');

  const pngCaseDocuments = await prisma.caseDocument.findMany({
    where: {
      document: {
        fileName: { endsWith: '.png', mode: 'insensitive' },
      },
    },
    include: {
      document: {
        select: { id: true, fileName: true, fileSize: true },
      },
      case: {
        select: { caseNumber: true },
      },
    },
  });

  stats.pngDocuments = new Set(pngCaseDocuments.map((cd) => cd.documentId)).size;
  stats.pngCaseLinksRemoved = pngCaseDocuments.length;

  console.log(`   Found ${stats.pngDocuments} unique PNG documents`);
  console.log(`   Found ${stats.pngCaseLinksRemoved} case links to remove`);

  if (pngCaseDocuments.length > 0) {
    console.log('   Sample files:');
    pngCaseDocuments.slice(0, 5).forEach((cd) => {
      const sizeKB = Math.round((cd.document.fileSize || 0) / 1024);
      console.log(`     - ${cd.document.fileName} (${sizeKB}KB) in case ${cd.case.caseNumber}`);
    });
  }

  if (!dryRun && pngCaseDocuments.length > 0) {
    const pngIds = pngCaseDocuments.map((cd) => cd.id);
    await prisma.caseDocument.deleteMany({
      where: { id: { in: pngIds } },
    });
    console.log(`   ✅ Removed ${pngIds.length} PNG case links`);
  }

  // ============================================================================
  // Step 2: Find and remove duplicate documents (same name + size in same case)
  // ============================================================================

  console.log('\n📋 Analyzing duplicate documents...');

  // Find all case documents grouped by case + filename + size
  const allCaseDocuments = await prisma.caseDocument.findMany({
    include: {
      document: {
        select: { id: true, fileName: true, fileSize: true },
      },
      case: {
        select: { caseNumber: true },
      },
    },
    orderBy: { linkedAt: 'asc' }, // Keep oldest, remove newer duplicates
  });

  // Group by case + filename + size
  const groups = new Map<string, typeof allCaseDocuments>();

  for (const cd of allCaseDocuments) {
    if (!cd.document.fileName) continue;
    const key = `${cd.caseId}|${cd.document.fileName}|${cd.document.fileSize}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(cd);
  }

  // Find groups with duplicates (more than 1 entry)
  const duplicateGroups = Array.from(groups.entries()).filter(([_, items]) => items.length > 1);

  stats.duplicateGroups = duplicateGroups.length;

  // Collect IDs to remove (keep first/oldest, remove rest)
  const duplicateIdsToRemove: string[] = [];

  for (const [_, items] of duplicateGroups) {
    // Keep first (oldest by linkedAt), mark rest for removal
    const toRemove = items.slice(1);
    duplicateIdsToRemove.push(...toRemove.map((cd) => cd.id));
  }

  stats.duplicateCaseLinksRemoved = duplicateIdsToRemove.length;

  console.log(`   Found ${stats.duplicateGroups} duplicate groups`);
  console.log(`   Found ${stats.duplicateCaseLinksRemoved} duplicate links to remove`);

  if (duplicateGroups.length > 0) {
    console.log('   Sample duplicate groups:');
    duplicateGroups.slice(0, 5).forEach(([key, items]) => {
      const first = items[0];
      console.log(
        `     - "${first.document.fileName}" has ${items.length} copies in case ${first.case.caseNumber}`
      );
    });
  }

  if (!dryRun && duplicateIdsToRemove.length > 0) {
    await prisma.caseDocument.deleteMany({
      where: { id: { in: duplicateIdsToRemove } },
    });
    console.log(`   ✅ Removed ${duplicateIdsToRemove.length} duplicate case links`);
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`PNG documents found:           ${stats.pngDocuments}`);
  console.log(`PNG case links removed:        ${stats.pngCaseLinksRemoved}`);
  console.log(`Duplicate groups found:        ${stats.duplicateGroups}`);
  console.log(`Duplicate case links removed:  ${stats.duplicateCaseLinksRemoved}`);
  console.log(`${'='.repeat(60)}`);
  console.log(
    `Total case links removed:      ${stats.pngCaseLinksRemoved + stats.duplicateCaseLinksRemoved}`
  );

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes made. Run without --dry-run to apply.\n');
  } else {
    console.log('\n✅ Cleanup complete!\n');
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    await analyzeAndCleanup(dryRun);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
