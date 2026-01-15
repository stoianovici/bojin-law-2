/**
 * Script to reset email sync state for testing
 * This will:
 * 1. Delete EmailCaseLink records (many-to-many case links)
 * 2. Delete EmailClassificationLog records (classification history)
 * 3. Delete PendingClassification records (pending review queue)
 * 4. Delete ThreadSummary records (AI-generated summaries)
 * 5. Delete EmailAttachment records
 * 6. Delete orphaned Document records (from email attachments)
 * 7. Reset all email classification states to Pending
 *
 * Run with: pnpm --filter gateway exec tsx scripts/reset-email-sync.ts
 *
 * After running this, trigger email categorization from the UI or API.
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { EmailClassificationState, DocumentSourceType } from '@prisma/client';

async function resetEmailSync() {
  console.log('⚠️  WARNING: This will reset ALL email classification data!\n');
  console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 1: Get counts before reset
  const emailCount = await prisma.email.count();
  const attachmentCount = await prisma.emailAttachment.count();
  const caseLinkCount = await prisma.emailCaseLink.count();
  const classificationLogCount = await prisma.emailClassificationLog.count();
  const pendingClassificationCount = await prisma.pendingClassification.count();
  const threadSummaryCount = await prisma.threadSummary.count();

  console.log(`Found:`);
  console.log(`  ${emailCount} emails`);
  console.log(`  ${attachmentCount} attachments`);
  console.log(`  ${caseLinkCount} case links`);
  console.log(`  ${classificationLogCount} classification logs`);
  console.log(`  ${pendingClassificationCount} pending classifications`);
  console.log(`  ${threadSummaryCount} thread summaries\n`);

  // Step 2: Delete EmailCaseLink records
  console.log('Deleting EmailCaseLink records...');
  const deletedCaseLinks = await prisma.emailCaseLink.deleteMany({});
  console.log(`  Deleted ${deletedCaseLinks.count} case link records\n`);

  // Step 3: Delete EmailClassificationLog records
  console.log('Deleting EmailClassificationLog records...');
  const deletedLogs = await prisma.emailClassificationLog.deleteMany({});
  console.log(`  Deleted ${deletedLogs.count} classification log records\n`);

  // Step 4: Delete PendingClassification records
  console.log('Deleting PendingClassification records...');
  const deletedPending = await prisma.pendingClassification.deleteMany({});
  console.log(`  Deleted ${deletedPending.count} pending classification records\n`);

  // Step 5: Delete ThreadSummary records
  console.log('Deleting ThreadSummary records...');
  const deletedSummaries = await prisma.threadSummary.deleteMany({});
  console.log(`  Deleted ${deletedSummaries.count} thread summary records\n`);

  // Step 6: Delete all EmailAttachment records
  console.log('Deleting EmailAttachment records...');
  const deletedAttachments = await prisma.emailAttachment.deleteMany({});
  console.log(`  Deleted ${deletedAttachments.count} attachment records\n`);

  // Step 7: Delete Document records that came from email attachments
  console.log('Deleting email-sourced Document records...');
  const deletedDocs = await prisma.document.deleteMany({
    where: {
      sourceType: DocumentSourceType.EMAIL_ATTACHMENT,
    },
  });
  console.log(`  Deleted ${deletedDocs.count} document records\n`);

  // Step 8: Reset all emails to Pending state
  console.log('Resetting email classification states...');
  const resetEmails = await prisma.email.updateMany({
    data: {
      classificationState: EmailClassificationState.Pending,
      caseId: null,
      clientId: null,
      classificationConfidence: null,
      classifiedAt: null,
      classifiedBy: null,
      isSuggestedAssignment: false,
    },
  });
  console.log(`  Reset ${resetEmails.count} emails to Pending state\n`);

  console.log('--- Summary ---');
  console.log(`Emails reset to Pending: ${resetEmails.count}`);
  console.log(`Case links deleted: ${deletedCaseLinks.count}`);
  console.log(`Classification logs deleted: ${deletedLogs.count}`);
  console.log(`Pending classifications deleted: ${deletedPending.count}`);
  console.log(`Thread summaries deleted: ${deletedSummaries.count}`);
  console.log(`Attachments deleted: ${deletedAttachments.count}`);
  console.log(`Documents deleted: ${deletedDocs.count}`);
  console.log('\nNow trigger email categorization from the UI or API.');
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
