/**
 * Script to backfill hasAttachments field from Graph API
 * This fixes emails that had hasAttachments incorrectly set to false
 *
 * Uses app-only authentication (client credentials flow) so it doesn't
 * require an active user session.
 *
 * Run with: pnpm --filter gateway exec tsx scripts/backfill-email-attachments.ts
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { GraphService } from '../src/services/graph.service';

// Process emails in batches to avoid memory issues
const BATCH_SIZE = 50;
// Concurrent Graph API requests (avoid rate limiting)
const CONCURRENCY = 5;

interface GraphMessage {
  id: string;
  hasAttachments: boolean;
}

async function backfillEmailAttachments() {
  console.log('Starting email hasAttachments backfill...\n');

  // Get user
  const user = await prisma.user.findFirst({
    where: { email: 'lucian.bojin@bojin-law.com' },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  if (!user.azureAdId) {
    console.log('User does not have Azure AD ID');
    return;
  }

  console.log(`User: ${user.email} (${user.id})`);
  console.log(`Azure AD ID: ${user.azureAdId}\n`);

  // Get app-only Graph client
  const graphService = new GraphService();
  let client;
  try {
    client = await graphService.getAppClient();
    console.log('App-only access token acquired\n');
  } catch (err) {
    console.log('Failed to get app-only access token');
    console.log('Error:', err instanceof Error ? err.message : err);
    console.log(
      '\nMake sure Azure AD app has Mail.Read application permission with admin consent.'
    );
    return;
  }

  // Get total email count
  const totalEmails = await prisma.email.count({
    where: { userId: user.id },
  });

  console.log(`Total emails to process: ${totalEmails}\n`);

  let processed = 0;
  let updated = 0;
  let errors = 0;
  let notFound = 0;

  // Process in batches
  let skip = 0;

  while (skip < totalEmails) {
    const emails = await prisma.email.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        graphMessageId: true,
        hasAttachments: true,
        subject: true,
      },
      skip,
      take: BATCH_SIZE,
      orderBy: { receivedDateTime: 'desc' },
    });

    if (emails.length === 0) break;

    // Process emails with controlled concurrency
    const chunks = chunkArray(emails, CONCURRENCY);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (email) => {
          try {
            // Use /users/{azureAdId}/messages/{id} for app-only access
            const message: GraphMessage = await client
              .api(`/users/${user.azureAdId}/messages/${email.graphMessageId}`)
              .select('id,hasAttachments')
              .get();

            // Only update if the value is different
            if (message.hasAttachments !== email.hasAttachments) {
              await prisma.email.update({
                where: { id: email.id },
                data: { hasAttachments: message.hasAttachments },
              });
              return { updated: true, hasAttachments: message.hasAttachments };
            }

            return { updated: false };
          } catch (err: any) {
            // Handle deleted messages (404)
            if (err.statusCode === 404) {
              return { notFound: true };
            }
            throw err;
          }
        })
      );

      // Count results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        processed++;

        if (result.status === 'fulfilled') {
          if (result.value.updated) {
            updated++;
            const email = chunk[i];
            console.log(
              `✓ Updated: "${email.subject?.substring(0, 50)}..." -> hasAttachments: ${result.value.hasAttachments}`
            );
          }
          if (result.value.notFound) {
            notFound++;
          }
        } else {
          errors++;
          console.error(`✗ Error: ${result.reason?.message || result.reason}`);
        }
      }
    }

    skip += BATCH_SIZE;
    console.log(
      `Progress: ${processed}/${totalEmails} (${Math.round((processed / totalEmails) * 100)}%)`
    );
  }

  console.log('\n--- Summary ---');
  console.log(`Total processed: ${processed}`);
  console.log(`Updated (had attachments): ${updated}`);
  console.log(`Not found (deleted from Outlook): ${notFound}`);
  console.log(`Errors: ${errors}`);

  // Final verification
  const withAttachments = await prisma.email.count({
    where: { userId: user.id, hasAttachments: true },
  });
  const withoutAttachments = await prisma.email.count({
    where: { userId: user.id, hasAttachments: false },
  });

  console.log('\n--- Verification ---');
  console.log(`Emails with attachments: ${withAttachments}`);
  console.log(`Emails without attachments: ${withoutAttachments}`);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Run the script
backfillEmailAttachments()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
