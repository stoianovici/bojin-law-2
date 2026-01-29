/**
 * Script to re-sync attachments for ClientInbox emails
 * This will store attachments in the client's OneDrive folder structure
 *
 * Run with: pnpm --filter gateway exec tsx scripts/resync-client-inbox-attachments.ts
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import { emailAttachmentService } from '../src/services/email-attachment.service';
import { getGraphToken } from '../src/utils/token-helpers';

async function resyncClientInboxAttachments() {
  console.log('Starting ClientInbox attachment re-sync...\n');

  // Find all ClientInbox emails that have attachments
  const emailsWithAttachments = await prisma.email.findMany({
    where: {
      classificationState: EmailClassificationState.ClientInbox,
      hasAttachments: true,
      clientId: { not: null },
    },
    select: {
      id: true,
      subject: true,
      userId: true,
      clientId: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          attachments: true,
        },
      },
    },
  });

  console.log(`Found ${emailsWithAttachments.length} ClientInbox emails with attachments\n`);

  if (emailsWithAttachments.length === 0) {
    console.log('No emails to process. Done!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const email of emailsWithAttachments) {
    try {
      // Get access token for the user
      let accessToken: string;
      try {
        accessToken = await getGraphToken(email.userId);
      } catch (tokenErr) {
        console.log(`○ Skipping email ${email.id} - no valid access token for user`);
        skippedCount++;
        continue;
      }

      console.log(`Processing: "${email.subject}" (${email._count.attachments} attachments)`);
      console.log(`  Client: ${email.client?.name || 'Unknown'}`);

      // Re-sync attachments - this will now use the client folder logic
      const result = await emailAttachmentService.syncAllAttachments(email.id, accessToken);

      if (result.success) {
        console.log(`  ✓ Synced ${result.attachmentsSynced} attachments`);
        successCount++;
      } else {
        console.log(`  ✗ Errors: ${result.errors.join(', ')}`);
        errorCount++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Error: ${errorMsg}`);
      errorCount++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total emails processed: ${emailsWithAttachments.length}`);
  console.log(`Successfully synced: ${successCount}`);
  console.log(`Skipped (no token): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the script
resyncClientInboxAttachments()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
