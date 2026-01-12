/**
 * Backfill Script: Create CaseDocument records for orphaned client-level documents
 *
 * This script finds Document records that:
 * - Have a clientId set
 * - Have sourceType = 'EMAIL_ATTACHMENT'
 * - Do NOT have any corresponding CaseDocument record
 *
 * And creates CaseDocument records with caseId=null to make them visible
 * in the client inbox section of the documents page.
 *
 * Usage:
 *   npx ts-node scripts/backfill-client-inbox-documents.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Backfill: Create CaseDocument records for orphaned client-level documents');
  console.log('Mode:', isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will create records)');
  console.log('='.repeat(60));

  // Find Document records that have clientId but no CaseDocument
  const orphanedDocuments = await prisma.document.findMany({
    where: {
      clientId: { not: undefined },
      sourceType: 'EMAIL_ATTACHMENT',
      caseLinks: {
        none: {},
      },
    },
    select: {
      id: true,
      clientId: true,
      firmId: true,
      uploadedBy: true,
      fileName: true,
      uploadedAt: true,
    },
  });

  console.log(`\nFound ${orphanedDocuments.length} orphaned documents without CaseDocument records\n`);

  if (orphanedDocuments.length === 0) {
    console.log('Nothing to backfill!');
    return;
  }

  // Group by client for summary
  const byClient = new Map<string, typeof orphanedDocuments>();
  for (const doc of orphanedDocuments) {
    const key = doc.clientId;
    if (!byClient.has(key)) {
      byClient.set(key, []);
    }
    byClient.get(key)!.push(doc);
  }

  console.log('Documents by client:');
  for (const [clientId, docs] of byClient) {
    console.log(`  - Client ${clientId}: ${docs.length} documents`);
  }
  console.log('');

  if (isDryRun) {
    console.log('DRY RUN: Would create the following CaseDocument records:');
    for (const doc of orphanedDocuments.slice(0, 10)) {
      console.log(`  - Document: ${doc.fileName} (${doc.id})`);
      console.log(`    clientId: ${doc.clientId}, firmId: ${doc.firmId}`);
    }
    if (orphanedDocuments.length > 10) {
      console.log(`  ... and ${orphanedDocuments.length - 10} more`);
    }
    console.log('\nRun without --dry-run to create these records.');
    return;
  }

  // Create CaseDocument records in batches
  const BATCH_SIZE = 100;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < orphanedDocuments.length; i += BATCH_SIZE) {
    const batch = orphanedDocuments.slice(i, i + BATCH_SIZE);

    try {
      await prisma.caseDocument.createMany({
        data: batch.map((doc) => ({
          caseId: null, // Client-level document (not assigned to a case)
          clientId: doc.clientId,
          documentId: doc.id,
          linkedBy: doc.uploadedBy,
          firmId: doc.firmId,
          isOriginal: true,
          promotedFromAttachment: false,
          linkedAt: doc.uploadedAt, // Use original upload date
        })),
        skipDuplicates: true,
      });

      created += batch.length;
      console.log(`Progress: ${created}/${orphanedDocuments.length} records created`);
    } catch (error) {
      console.error(`Error creating batch at index ${i}:`, error);
      errors += batch.length;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Backfill complete!');
  console.log(`  Created: ${created} CaseDocument records`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(60));
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
