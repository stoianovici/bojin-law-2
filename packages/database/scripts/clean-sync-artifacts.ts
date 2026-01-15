/**
 * Clean Sync Artifacts Script
 *
 * Cleans up environment-specific sync state after importing production data.
 * This prevents confusion from stale delta tokens, webhook subscriptions, etc.
 *
 * Run automatically by: pnpm mirror:prod
 * Run manually with: pnpm --filter database exec tsx scripts/clean-sync-artifacts.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning sync artifacts for local development...\n');

  // Safety check: Don't run against production
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('render.com') || dbUrl.includes('production')) {
    console.error('ERROR: Cannot run against production database!');
    console.error('This script is only for local development.');
    process.exit(1);
  }

  // ==========================================================================
  // 1. Reset EmailSyncState
  // ==========================================================================
  console.log('1. Resetting EmailSyncState...');

  const emailSyncResult = await prisma.emailSyncState.updateMany({
    data: {
      deltaToken: null,
      subscriptionId: null,
      subscriptionExpiry: null,
      syncStatus: 'idle',
      errorMessage: null,
    },
  });
  console.log(`   Reset ${emailSyncResult.count} email sync states`);

  // ==========================================================================
  // 2. Delete GraphSubscription records
  // ==========================================================================
  console.log('2. Deleting GraphSubscription records...');

  const graphSubResult = await prisma.graphSubscription.deleteMany({});
  console.log(`   Deleted ${graphSubResult.count} graph subscriptions`);

  // ==========================================================================
  // 3. Clear HistoricalEmailSyncJob in-progress states
  // ==========================================================================
  console.log('3. Resetting HistoricalEmailSyncJob states...');

  const historicalJobResult = await prisma.historicalEmailSyncJob.updateMany({
    where: {
      status: {
        in: ['InProgress', 'Pending'],
      },
    },
    data: {
      status: 'Failed',
      errorMessage: 'Reset during mirror import',
    },
  });
  console.log(`   Reset ${historicalJobResult.count} historical sync jobs`);

  // ==========================================================================
  // 4. Clear any pending AI batch jobs
  // ==========================================================================
  console.log('4. Resetting AI batch job states...');

  try {
    const aiBatchResult = await prisma.aIBatchJobRun.updateMany({
      where: {
        status: {
          in: ['Running', 'Pending'],
        },
      },
      data: {
        status: 'Failed',
        errorMessage: 'Reset during mirror import',
      },
    });
    console.log(`   Reset ${aiBatchResult.count} AI batch jobs`);
  } catch {
    console.log('   No AI batch jobs table or already clean');
  }

  // ==========================================================================
  // 5. Clear InAppNotification (these are session-specific)
  // ==========================================================================
  console.log('5. Clearing in-app notifications...');

  const notificationResult = await prisma.inAppNotification.deleteMany({});
  console.log(`   Deleted ${notificationResult.count} in-app notifications`);

  // ==========================================================================
  // 6. Clear PushSubscription (browser-specific)
  // ==========================================================================
  console.log('6. Clearing push subscriptions...');

  const pushResult = await prisma.pushSubscription.deleteMany({});
  console.log(`   Deleted ${pushResult.count} push subscriptions`);

  // ==========================================================================
  // 7. Clear DigestQueue (scheduled for prod environment)
  // ==========================================================================
  console.log('7. Clearing digest queue...');

  const digestResult = await prisma.digestQueue.deleteMany({});
  console.log(`   Deleted ${digestResult.count} digest queue entries`);

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n✓ Sync artifacts cleaned successfully');
  console.log('\nWhat was cleaned:');
  console.log('  - EmailSyncState: delta tokens, subscription IDs');
  console.log('  - GraphSubscription: webhook registrations');
  console.log('  - HistoricalEmailSyncJob: in-progress jobs');
  console.log('  - AI batch jobs: pending/running jobs');
  console.log('  - InAppNotification: session-specific alerts');
  console.log('  - PushSubscription: browser push registrations');
  console.log('  - DigestQueue: scheduled email digests');
}

main()
  .catch((error) => {
    console.error('Error cleaning sync artifacts:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
