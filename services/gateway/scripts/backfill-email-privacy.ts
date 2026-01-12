/**
 * Script to backfill isPrivate on Partner/BusinessOwner emails
 *
 * Emails from Partners/BusinessOwners should be private by default when classified.
 * This script finds emails where:
 * - The owner is a Partner or BusinessOwner
 * - isPrivate is false (pre-feature default)
 * - The email is in Classified or ClientInbox state
 *
 * And updates them to isPrivate=true, along with their attachment documents.
 *
 * Run with: pnpm --filter gateway exec tsx scripts/backfill-email-privacy.ts
 * Dry run:  pnpm --filter gateway exec tsx scripts/backfill-email-privacy.ts --dry-run
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

async function backfillEmailPrivacy() {
  console.log('='.repeat(60));
  console.log('Backfill Email Privacy for Partner/BusinessOwner Emails');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  // Find ALL Partner/BusinessOwner emails that should be private but aren't
  // All Partner emails are private by default, regardless of classification state
  const emailsToUpdate = await prisma.email.findMany({
    where: {
      isPrivate: false,
      user: {
        role: {
          in: ['Partner', 'BusinessOwner'],
        },
      },
    },
    select: {
      id: true,
      subject: true,
      classificationState: true,
      classifiedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  console.log(`Found ${emailsToUpdate.length} emails to update\n`);

  if (emailsToUpdate.length === 0) {
    console.log('No emails need updating.');
    return;
  }

  // Group by user for reporting
  const byUser = emailsToUpdate.reduce(
    (acc, email) => {
      const userEmail = email.user.email;
      acc[userEmail] = (acc[userEmail] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('Emails to update by user:');
  console.log('-'.repeat(60));
  for (const [userEmail, count] of Object.entries(byUser)) {
    console.log(`  ${userEmail}: ${count} emails`);
  }
  console.log('');

  // Show preview
  console.log('Sample emails to update:');
  console.log('-'.repeat(60));
  for (const email of emailsToUpdate.slice(0, 5)) {
    console.log(`  ${email.id.slice(0, 8)}... | ${email.subject?.slice(0, 50) || '(no subject)'}`);
    console.log(`    └─ State: ${email.classificationState}, User: ${email.user.email}`);
  }
  if (emailsToUpdate.length > 5) {
    console.log(`  ... and ${emailsToUpdate.length - 5} more`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN - No changes made.');
    console.log('Run without --dry-run to apply changes.');
    return;
  }

  // Update emails in batches
  let emailsUpdated = 0;
  let emailErrors = 0;

  console.log('Updating emails...');
  for (let i = 0; i < emailsToUpdate.length; i += BATCH_SIZE) {
    const batch = emailsToUpdate.slice(i, i + BATCH_SIZE);
    const ids = batch.map((e) => e.id);

    try {
      const result = await prisma.email.updateMany({
        where: { id: { in: ids } },
        data: {
          isPrivate: true,
          markedPrivateBy: batch[0].user.id, // Use the email owner as the privacy marker
        },
      });
      emailsUpdated += result.count;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count} emails`);
    } catch (error) {
      console.error(`  Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      emailErrors += batch.length;
    }
  }

  // Now update documents that are attachments from these emails
  console.log('\nUpdating attachment documents...');

  const documentsToUpdate = await prisma.document.findMany({
    where: {
      sourceType: 'EMAIL_ATTACHMENT',
      isPrivate: false,
      emailAttachments: {
        some: {
          email: {
            id: { in: emailsToUpdate.map((e) => e.id) },
          },
        },
      },
    },
    select: {
      id: true,
      fileName: true,
    },
  });

  console.log(`Found ${documentsToUpdate.length} attachment documents to update`);

  let docsUpdated = 0;
  let docErrors = 0;

  for (let i = 0; i < documentsToUpdate.length; i += BATCH_SIZE) {
    const batch = documentsToUpdate.slice(i, i + BATCH_SIZE);
    const ids = batch.map((d) => d.id);

    try {
      const result = await prisma.document.updateMany({
        where: { id: { in: ids } },
        data: { isPrivate: true },
      });
      docsUpdated += result.count;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count} documents`);
    } catch (error) {
      console.error(`  Error in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      docErrors += batch.length;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Emails found:      ${emailsToUpdate.length}`);
  console.log(`  Emails updated:    ${emailsUpdated}`);
  console.log(`  Email errors:      ${emailErrors}`);
  console.log(`  Documents found:   ${documentsToUpdate.length}`);
  console.log(`  Documents updated: ${docsUpdated}`);
  console.log(`  Document errors:   ${docErrors}`);
  console.log('='.repeat(60));
}

// Run the script
backfillEmailPrivacy()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
