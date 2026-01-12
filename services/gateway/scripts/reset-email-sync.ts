/**
 * Script to reset email sync state for testing
 * This will:
 * 1. Reset all email classification states to Pending
 * 2. Clear caseId and clientId assignments
 * 3. Delete EmailAttachment records
 * 4. Delete orphaned Document records (from email attachments)
 *
 * Run with: pnpm --filter gateway exec tsx scripts/reset-email-sync.ts
 *
 * After running this, trigger email sync from the UI or run:
 *   pnpm --filter gateway exec tsx scripts/trigger-email-sync.ts
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { EmailClassificationState, DocumentSourceType } from '@prisma/client';

async function resetEmailSync() {
  console.log('⚠️  WARNING: This will reset ALL email classification and attachments!\n');
  console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 1: Get counts before reset
  const emailCount = await prisma.email.count();
  const attachmentCount = await prisma.emailAttachment.count();

  console.log(`Found ${emailCount} emails and ${attachmentCount} attachments\n`);

  // Step 2: Delete all EmailAttachment records
  console.log('Deleting EmailAttachment records...');
  const deletedAttachments = await prisma.emailAttachment.deleteMany({});
  console.log(`  Deleted ${deletedAttachments.count} attachment records\n`);

  // Step 3: Delete Document records that came from email attachments
  // These are documents with sourceType = EMAIL_ATTACHMENT
  console.log('Deleting email-sourced Document records...');
  const deletedDocs = await prisma.document.deleteMany({
    where: {
      sourceType: DocumentSourceType.EMAIL_ATTACHMENT,
    },
  });
  console.log(`  Deleted ${deletedDocs.count} document records\n`);

  // Step 4: Reset all emails to Pending state
  console.log('Resetting email classification states...');
  const resetEmails = await prisma.email.updateMany({
    where: {
      classificationState: {
        not: EmailClassificationState.Pending,
      },
    },
    data: {
      classificationState: EmailClassificationState.Pending,
      caseId: null,
      clientId: null,
      classificationConfidence: null,
      classifiedAt: null,
      classifiedBy: null,
    },
  });
  console.log(`  Reset ${resetEmails.count} emails to Pending state\n`);

  // NOTE: We intentionally do NOT reset hasAttachments flag here.
  // The email sync skips existing emails, so the flag would never be restored.
  // If you need to re-check attachments, run: backfill-email-attachments.ts

  console.log('--- Summary ---');
  console.log(`Emails reset to Pending: ${resetEmails.count}`);
  console.log(`Attachments deleted: ${deletedAttachments.count}`);
  console.log(`Documents deleted: ${deletedDocs.count}`);
  console.log('\nNow trigger email sync from the UI or API to re-process all emails.');
}

// Run the script
resetEmailSync()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
