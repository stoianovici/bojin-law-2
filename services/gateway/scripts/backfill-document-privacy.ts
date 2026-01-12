/**
 * Script to backfill isPrivate on documents from email attachments
 *
 * Documents created from email attachments should inherit their privacy
 * from the parent email. This script finds documents where:
 * - sourceType is EMAIL_ATTACHMENT
 * - isPrivate is false (default)
 * - The parent email has isPrivate=true
 *
 * And updates them to isPrivate=true.
 *
 * Run with: pnpm --filter gateway exec tsx scripts/backfill-document-privacy.ts
 * Dry run:  pnpm --filter gateway exec tsx scripts/backfill-document-privacy.ts --dry-run
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

async function backfillDocumentPrivacy() {
  console.log('='.repeat(60));
  console.log('Backfill Document Privacy from Email Attachments');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  // Find documents that:
  // 1. Are email attachments (sourceType = EMAIL_ATTACHMENT)
  // 2. Have isPrivate = false
  // 3. Have a parent email that is private (isPrivate = true)
  const documentsToUpdate = await prisma.document.findMany({
    where: {
      sourceType: 'EMAIL_ATTACHMENT',
      isPrivate: false,
      emailAttachments: {
        some: {
          email: {
            isPrivate: true,
          },
        },
      },
    },
    select: {
      id: true,
      fileName: true,
      uploadedBy: true,
      emailAttachments: {
        select: {
          id: true,
          email: {
            select: {
              id: true,
              subject: true,
              isPrivate: true,
              userId: true,
            },
          },
        },
      },
    },
  });

  console.log(`Found ${documentsToUpdate.length} documents to update\n`);

  if (documentsToUpdate.length === 0) {
    console.log('No documents need updating.');
    return;
  }

  // Show preview
  console.log('Documents to update:');
  console.log('-'.repeat(60));
  for (const doc of documentsToUpdate.slice(0, 10)) {
    const email = doc.emailAttachments[0]?.email;
    console.log(`  ${doc.id.slice(0, 8)}... | ${doc.fileName.slice(0, 40)}`);
    if (email) {
      console.log(`    └─ From email: ${email.subject?.slice(0, 50) || '(no subject)'}`);
    }
  }
  if (documentsToUpdate.length > 10) {
    console.log(`  ... and ${documentsToUpdate.length - 10} more`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN - No changes made.');
    console.log('Run without --dry-run to apply changes.');
    return;
  }

  // Update in batches
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < documentsToUpdate.length; i += BATCH_SIZE) {
    const batch = documentsToUpdate.slice(i, i + BATCH_SIZE);
    const ids = batch.map((d) => d.id);

    try {
      const result = await prisma.document.updateMany({
        where: { id: { in: ids } },
        data: { isPrivate: true },
      });
      updated += result.count;
      console.log(`Updated batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count} documents`);
    } catch (error) {
      console.error(`Error updating batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      errors += batch.length;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Total found:  ${documentsToUpdate.length}`);
  console.log(`  Updated:      ${updated}`);
  console.log(`  Errors:       ${errors}`);
  console.log('='.repeat(60));
}

// Run the script
backfillDocumentPrivacy()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
