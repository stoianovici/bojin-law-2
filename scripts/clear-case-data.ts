/**
 * Script to clear all emails and documents for a case
 * Usage: source .env.prod && npx tsx scripts/clear-case-data.ts <caseId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearCaseData(caseId: string) {
  console.log(`\n🗑️  Clearing data for case: ${caseId}\n`);

  // First, show what will be deleted
  const emails = await prisma.email.findMany({
    where: { caseId },
    select: { id: true, subject: true },
  });

  const caseDocuments = await prisma.caseDocument.findMany({
    where: { caseId },
    select: { id: true, documentId: true },
  });

  console.log(`📧 Emails to delete: ${emails.length}`);
  console.log(`📄 CaseDocument links to delete: ${caseDocuments.length}`);

  if (emails.length === 0 && caseDocuments.length === 0) {
    console.log('\n✅ Nothing to delete - case is already clean.');
    return;
  }

  // Confirm before proceeding
  console.log('\n⚠️  This will PERMANENTLY DELETE:');
  console.log(`   - ${emails.length} emails and their attachments`);
  console.log(`   - ${caseDocuments.length} document links`);
  console.log('\nProceeding in 3 seconds... (Ctrl+C to cancel)');

  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Perform deletion in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Get email IDs
    const emailIds = emails.map((e) => e.id);

    // 2. Delete EmailAttachments for these emails
    const attachmentsResult = await tx.emailAttachment.deleteMany({
      where: { emailId: { in: emailIds } },
    });
    console.log(`   ✓ Deleted ${attachmentsResult.count} email attachments`);

    // 3. Delete Emails
    const emailsResult = await tx.email.deleteMany({
      where: { caseId },
    });
    console.log(`   ✓ Deleted ${emailsResult.count} emails`);

    // 4. Get document IDs from CaseDocuments
    const documentIds = caseDocuments.map((cd) => cd.documentId);

    // 5. Delete CaseDocuments
    const caseDocsResult = await tx.caseDocument.deleteMany({
      where: { caseId },
    });
    console.log(`   ✓ Deleted ${caseDocsResult.count} case-document links`);

    // 6. Delete Documents that were linked (only those not linked to other cases)
    let documentsDeleted = 0;
    for (const docId of documentIds) {
      // Check if document is linked to any other case
      const otherLinks = await tx.caseDocument.count({
        where: { documentId: docId },
      });

      if (otherLinks === 0) {
        await tx.document.delete({
          where: { id: docId },
        });
        documentsDeleted++;
      }
    }
    console.log(`   ✓ Deleted ${documentsDeleted} orphaned documents`);

    return {
      emailsDeleted: emailsResult.count,
      attachmentsDeleted: attachmentsResult.count,
      caseDocumentsDeleted: caseDocsResult.count,
      documentsDeleted,
    };
  });

  console.log('\n✅ Cleanup complete!');
  console.log(JSON.stringify(result, null, 2));
}

// Main
const caseId = process.argv[2];

if (!caseId) {
  console.error('Usage: npx tsx scripts/clear-case-data.ts <caseId>');
  process.exit(1);
}

clearCaseData(caseId)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
