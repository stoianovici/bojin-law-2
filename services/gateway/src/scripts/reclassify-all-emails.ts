/**
 * Reclassify All Emails
 *
 * Resets classification state for all assigned emails and re-runs them through
 * the classification pipeline to test the new classification flow.
 *
 * Usage:
 *   # Dry run - show what would be reclassified
 *   pnpm --filter gateway exec tsx src/scripts/reclassify-all-emails.ts --dry-run
 *
 *   # Reclassify all emails for a specific firm
 *   pnpm --filter gateway exec tsx src/scripts/reclassify-all-emails.ts --firm-id <uuid>
 *
 *   # Reclassify with batch size limit
 *   pnpm --filter gateway exec tsx src/scripts/reclassify-all-emails.ts --firm-id <uuid> --batch-size 100
 *
 *   # Skip reset (just run classification on pending emails)
 *   pnpm --filter gateway exec tsx src/scripts/reclassify-all-emails.ts --firm-id <uuid> --skip-reset
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import { getEmailClassifierService, EmailForClassification } from '../services/email-classifier';

// ============================================================================
// Types
// ============================================================================

interface ReclassifyOptions {
  dryRun: boolean;
  firmId?: string;
  batchSize: number;
  skipReset: boolean;
}

interface ReclassifyStats {
  totalEmails: number;
  reset: number;
  classified: number;
  clientInbox: number;
  uncertain: number;
  courtUnassigned: number;
  ignored: number;
  failed: number;
  byMatchType: Record<string, number>;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(): ReclassifyOptions {
  const args = process.argv.slice(2);
  const options: ReclassifyOptions = {
    dryRun: false,
    batchSize: 50,
    skipReset: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--firm-id' && args[i + 1]) {
      options.firmId = args[++i];
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[++i], 10);
    } else if (args[i] === '--skip-reset') {
      options.skipReset = true;
    }
  }

  return options;
}

// ============================================================================
// Reset Classification
// ============================================================================

async function resetEmailClassification(
  firmId: string | undefined,
  dryRun: boolean
): Promise<number> {
  // Find all classified emails
  const whereClause: Parameters<typeof prisma.email.findMany>[0]['where'] = {
    classificationState: {
      in: [
        EmailClassificationState.Classified,
        EmailClassificationState.ClientInbox,
        EmailClassificationState.Uncertain,
        EmailClassificationState.CourtUnassigned,
      ],
    },
  };

  if (firmId) {
    whereClause.firmId = firmId;
  }

  const emails = await prisma.email.findMany({
    where: whereClause,
    select: { id: true, subject: true, caseId: true },
  });

  console.log(`\n📧 Found ${emails.length} emails to reset\n`);

  if (dryRun) {
    console.log('   [DRY RUN] Would reset:');
    for (const email of emails.slice(0, 10)) {
      console.log(`   - ${email.subject.substring(0, 60)}`);
    }
    if (emails.length > 10) {
      console.log(`   ... and ${emails.length - 10} more`);
    }
    return emails.length;
  }

  // Reset in batches
  const emailIds = emails.map((e) => e.id);
  const batchSize = 100;

  for (let i = 0; i < emailIds.length; i += batchSize) {
    const batch = emailIds.slice(i, i + batchSize);

    // Delete all EmailCaseLinks for these emails
    await prisma.emailCaseLink.deleteMany({
      where: { emailId: { in: batch } },
    });

    // Reset email classification state
    await prisma.email.updateMany({
      where: { id: { in: batch } },
      data: {
        classificationState: EmailClassificationState.Pending,
        caseId: null,
        clientId: null,
        classificationConfidence: null,
        classifiedBy: null,
        classifiedAt: null,
      },
    });

    console.log(`   Reset ${Math.min(i + batchSize, emailIds.length)} / ${emailIds.length} emails`);
  }

  return emails.length;
}

// ============================================================================
// Run Classification
// ============================================================================

async function classifyEmails(
  firmId: string | undefined,
  batchSize: number,
  dryRun: boolean
): Promise<ReclassifyStats> {
  const stats: ReclassifyStats = {
    totalEmails: 0,
    reset: 0,
    classified: 0,
    clientInbox: 0,
    uncertain: 0,
    courtUnassigned: 0,
    ignored: 0,
    failed: 0,
    byMatchType: {},
  };

  // Find pending emails
  const whereClause: Parameters<typeof prisma.email.findMany>[0]['where'] = {
    classificationState: EmailClassificationState.Pending,
  };

  if (firmId) {
    whereClause.firmId = firmId;
  }

  const pendingEmails = await prisma.email.findMany({
    where: whereClause,
    select: {
      id: true,
      subject: true,
      bodyPreview: true,
      bodyContent: true,
      from: true,
      toRecipients: true,
      ccRecipients: true,
      receivedDateTime: true,
      conversationId: true,
      parentFolderName: true,
      firmId: true,
      userId: true,
    },
    orderBy: { receivedDateTime: 'desc' },
  });

  stats.totalEmails = pendingEmails.length;
  console.log(`\n📬 Found ${pendingEmails.length} pending emails to classify\n`);

  if (dryRun) {
    console.log('   [DRY RUN] Would classify:');
    for (const email of pendingEmails.slice(0, 10)) {
      console.log(`   - ${email.subject.substring(0, 60)}`);
    }
    if (pendingEmails.length > 10) {
      console.log(`   ... and ${pendingEmails.length - 10} more`);
    }
    return stats;
  }

  // Group emails by firm for classification
  const emailsByFirm = new Map<string, typeof pendingEmails>();
  for (const email of pendingEmails) {
    const fId = email.firmId;
    if (!emailsByFirm.has(fId)) {
      emailsByFirm.set(fId, []);
    }
    emailsByFirm.get(fId)!.push(email);
  }

  // Process each firm
  for (const [fId, firmEmails] of emailsByFirm) {
    console.log(`\n🏢 Processing firm ${fId} (${firmEmails.length} emails)`);

    const classifier = getEmailClassifierService();

    // Process in batches
    for (let i = 0; i < firmEmails.length; i += batchSize) {
      const batch = firmEmails.slice(i, i + batchSize);

      for (const email of batch) {
        try {
          const emailInput: EmailForClassification = {
            id: email.id,
            subject: email.subject,
            bodyPreview: email.bodyPreview,
            bodyContent: email.bodyContent,
            from: email.from as { name?: string; address: string },
            toRecipients: email.toRecipients as Array<{ name?: string; address: string }>,
            ccRecipients: email.ccRecipients as Array<{ name?: string; address: string }>,
            receivedDateTime: email.receivedDateTime,
            conversationId: email.conversationId,
            parentFolderName: email.parentFolderName || undefined,
          };

          const result = await classifier.classifyEmail(emailInput, fId, email.userId);

          // Track stats
          switch (result.state) {
            case EmailClassificationState.Classified:
              stats.classified++;
              break;
            case EmailClassificationState.ClientInbox:
              stats.clientInbox++;
              break;
            case EmailClassificationState.Uncertain:
              stats.uncertain++;
              break;
            case EmailClassificationState.CourtUnassigned:
              stats.courtUnassigned++;
              break;
            case EmailClassificationState.Ignored:
              stats.ignored++;
              break;
          }

          if (result.matchType) {
            stats.byMatchType[result.matchType] = (stats.byMatchType[result.matchType] || 0) + 1;
          }

          // Log progress
          const stateEmoji =
            result.state === EmailClassificationState.Classified
              ? '✅'
              : result.state === EmailClassificationState.ClientInbox
                ? '📥'
                : result.state === EmailClassificationState.CourtUnassigned
                  ? '⚖️'
                  : result.state === EmailClassificationState.Ignored
                    ? '🚫'
                    : '⚠️';
          console.log(
            `   ${stateEmoji} ${email.subject.substring(0, 50)} → ${result.state} (${result.matchType || 'unknown'})`
          );
        } catch (error) {
          stats.failed++;
          console.error(`   ❌ Failed: ${email.subject.substring(0, 50)} - ${error}`);
        }
      }

      console.log(
        `   Progress: ${Math.min(i + batchSize, firmEmails.length)} / ${firmEmails.length}`
      );
    }
  }

  return stats;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('\n🔄 Email Reclassification Script');
  console.log('='.repeat(60));
  console.log(options.dryRun ? '🔍 DRY RUN MODE' : '🚀 EXECUTION MODE');
  if (options.firmId) console.log(`   Firm ID: ${options.firmId}`);
  console.log(`   Batch size: ${options.batchSize}`);
  console.log(`   Skip reset: ${options.skipReset}`);
  console.log('='.repeat(60));

  if (!options.firmId) {
    console.log('\n⚠️  WARNING: No --firm-id specified. This will affect ALL firms!');
    console.log('   Press Ctrl+C within 5 seconds to abort...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  try {
    let resetCount = 0;

    // Step 1: Reset classification (unless skipped)
    if (!options.skipReset) {
      console.log('\n📋 STEP 1: Resetting email classification...');
      resetCount = await resetEmailClassification(options.firmId, options.dryRun);
    } else {
      console.log('\n📋 STEP 1: Skipping reset (--skip-reset flag)');
    }

    // Step 2: Run classification
    console.log('\n📋 STEP 2: Running classification...');
    const stats = await classifyEmails(options.firmId, options.batchSize, options.dryRun);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Emails reset: ${resetCount}`);
    console.log(`   Emails processed: ${stats.totalEmails}`);
    console.log(`   → Classified: ${stats.classified}`);
    console.log(`   → Client Inbox: ${stats.clientInbox}`);
    console.log(`   → Uncertain: ${stats.uncertain}`);
    console.log(`   → Court Unassigned: ${stats.courtUnassigned}`);
    console.log(`   → Ignored: ${stats.ignored}`);
    console.log(`   → Failed: ${stats.failed}`);

    if (Object.keys(stats.byMatchType).length > 0) {
      console.log('\n   By match type:');
      for (const [matchType, count] of Object.entries(stats.byMatchType).sort(
        (a, b) => b[1] - a[1]
      )) {
        console.log(`     ${matchType}: ${count}`);
      }
    }

    console.log('');
    if (options.dryRun) {
      console.log('🔍 This was a DRY RUN. Run without --dry-run to execute.\n');
    } else {
      console.log('✅ Reclassification complete!\n');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
