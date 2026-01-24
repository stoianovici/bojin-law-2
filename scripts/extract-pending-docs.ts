/**
 * Script to process pending document extractions for a specific case
 * Runs locally but connects to production database
 *
 * Usage: npx ts-node scripts/extract-pending-docs.ts <caseId>
 */

import 'dotenv/config';
import { prisma, DocumentExtractionStatus } from '@legal-platform/database';

const CASE_ID = process.argv[2] || '3b3a3ffd-bdda-4eab-964a-1b331242c318';

async function main() {
  console.log('Connecting to database...');
  console.log('Case ID:', CASE_ID);

  // Get all pending documents for the case
  const pendingDocs = await prisma.document.findMany({
    where: {
      caseDocuments: {
        some: {
          caseId: CASE_ID
        }
      },
      extractionStatus: DocumentExtractionStatus.PENDING
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      sharePointItemId: true,
      oneDriveId: true
    }
  });

  console.log(`Found ${pendingDocs.length} pending documents`);

  if (pendingDocs.length === 0) {
    console.log('No pending documents to process');
    return;
  }

  // List document IDs for triggering via API
  console.log('\nDocument IDs (for manual queue trigger):');
  pendingDocs.forEach(doc => {
    console.log(`- ${doc.id}: ${doc.fileName} (${doc.fileType})`);
  });

  // Check current status summary
  const stats = await prisma.document.groupBy({
    by: ['extractionStatus'],
    where: {
      caseDocuments: {
        some: {
          caseId: CASE_ID
        }
      }
    },
    _count: true
  });

  console.log('\nCurrent extraction status:');
  stats.forEach(s => {
    console.log(`- ${s.extractionStatus}: ${s._count}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
