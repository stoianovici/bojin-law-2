/**
 * Script to backfill email folder info
 * Run with: pnpm --filter gateway exec tsx scripts/backfill-folders.ts
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { emailSyncService } from '../src/services/email-sync.service';
import { getValidAccessToken } from '../src/services/ms-graph-token.service';

async function backfillFolders() {
  console.log('Starting email folder backfill...\n');

  // Get user
  const user = await prisma.user.findFirst({
    where: { email: 'lucian.bojin@bojin-law.com' },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`User: ${user.email} (${user.id})`);

  // Get access token
  const accessToken = await getValidAccessToken(user.id);

  if (!accessToken) {
    console.log('No valid access token');
    return;
  }

  console.log('Access token acquired, starting backfill...\n');

  const result = await emailSyncService.backfillFolderInfo(user.id, accessToken);

  console.log('\n--- Result ---');
  console.log(`Success: ${result.success}`);
  console.log(`Updated: ${result.updated}`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
}

backfillFolders()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
