/**
 * Cleanup script for OPS-024
 * Deletes all documents linked to a specific case (test data cleanup)
 *
 * Usage: DATABASE_URL=... npx ts-node scripts/cleanup-case-documents.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CASE_ID = '47504bff-e466-4166-b6a6-16db23ebdb2d';

async function main() {
  console.log(`\n🧹 Cleaning up documents for case: ${CASE_ID}\n`);

  // Step 1: Find all CaseDocuments for this case
  const caseDocuments = await prisma.caseDocument.findMany({
    where: { caseId: CASE_ID },
    include: { document: true },
  });

  console.log(`Found ${caseDocuments.length} CaseDocument links`);

  if (caseDocuments.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  const documentIds = caseDocuments.map((cd) => cd.documentId);
  console.log(`Document IDs to delete: ${documentIds.length}`);

  // Step 2: Clear EmailAttachment.documentId references
  const attachmentsCleared = await prisma.emailAttachment.updateMany({
    where: { documentId: { in: documentIds } },
    data: { documentId: null },
  });
  console.log(`Cleared ${attachmentsCleared.count} EmailAttachment.documentId references`);

  // Step 3: Delete CaseDocuments (this happens automatically via cascade, but let's be explicit)
  const deletedCaseDocuments = await prisma.caseDocument.deleteMany({
    where: { caseId: CASE_ID },
  });
  console.log(`Deleted ${deletedCaseDocuments.count} CaseDocument records`);

  // Step 4: Delete Documents
  // Note: This will cascade delete related records (versions, audit logs, etc.)
  const deletedDocuments = await prisma.document.deleteMany({
    where: { id: { in: documentIds } },
  });
  console.log(`Deleted ${deletedDocuments.count} Document records`);

  console.log('\n✅ Cleanup complete!\n');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
