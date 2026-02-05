import { PrismaClient } from '../apps/legacy-import/src/generated/prisma';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const prisma = new PrismaClient();
  const sessionId = '8267942a-3721-4956-b866-3aad8e56a1bb';

  // Get skip reason breakdown
  const skipReasons = await prisma.extractedDocument.groupBy({
    by: ['skipReason'],
    where: { sessionId },
    _count: true,
  });

  console.log('=== DOCUMENT CLASSIFICATION ===\n');
  console.log('By skipReason:');
  for (const r of skipReasons) {
    const label = r.skipReason || 'NULL (regular email docs)';
    console.log(`  ${label}: ${r._count}`);
  }

  // Get counts matching the UI filters
  const [regularCount, scannedCount] = await Promise.all([
    prisma.extractedDocument.count({
      where: {
        sessionId,
        OR: [{ skipReason: null }, { skipReason: 'Duplicate' }],
      },
    }),
    prisma.extractedDocument.count({
      where: {
        sessionId,
        skipReason: 'Scanned',
      },
    }),
  ]);

  console.log('\n=== UI TAB COUNTS ===');
  console.log(`"Email" tab (regular docs): ${regularCount}`);
  console.log(`"Scanned" tab: ${scannedCount}`);

  // Check file extensions breakdown
  const extensions = await prisma.extractedDocument.groupBy({
    by: ['fileExtension'],
    where: { sessionId },
    _count: true,
    orderBy: { _count: { fileExtension: 'desc' } },
  });

  console.log('\n=== FILE EXTENSIONS ===');
  for (const e of extensions) {
    console.log(`  .${e.fileExtension}: ${e._count}`);
  }

  // Check if scanned docs have skipReason set
  const scannedWithoutFlag = await prisma.extractedDocument.count({
    where: {
      sessionId,
      skipReason: null,
      // Typically scanned docs are detected by lack of extractedText or specific patterns
    },
  });

  console.log('\n=== POTENTIAL ISSUES ===');
  console.log(`Docs with NULL skipReason: ${scannedWithoutFlag}`);

  await prisma.$disconnect();
}

main().catch(console.error);
