/**
 * Backfill attachment privacy from parent emails
 *
 * Updates all attachments to inherit the isPrivate status from their parent email.
 * This ensures attachments of private emails are also marked as private.
 *
 * Run with: pnpm --filter gateway exec tsx scripts/backfill-attachment-privacy.ts
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';

async function backfillAttachmentPrivacy() {
  console.log('Backfilling attachment privacy from parent emails...\n');

  // Find all private emails
  const privateEmails = await prisma.email.findMany({
    where: { isPrivate: true },
    select: {
      id: true,
      subject: true,
      _count: { select: { attachments: true } },
    },
  });

  console.log(`Found ${privateEmails.length} private emails`);

  if (privateEmails.length === 0) {
    console.log('No private emails found. Done!');
    return;
  }

  // Show what will be updated
  for (const email of privateEmails) {
    console.log(`  - ${email.subject} (${email._count.attachments} attachments)`);
  }

  // Update all attachments of private emails to be private
  const result = await prisma.emailAttachment.updateMany({
    where: {
      emailId: { in: privateEmails.map((e) => e.id) },
      isPrivate: false,
    },
    data: {
      isPrivate: true,
    },
  });

  console.log(`\nUpdated ${result.count} attachments to private`);
  console.log('Done!');
}

// Run the script
backfillAttachmentPrivacy()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
