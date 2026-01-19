/**
 * Script to fix orphaned emails after case deletion
 *
 * This script handles two types of issues:
 * 1. Emails with classificationState='Classified' but caseId=null and clientId=null
 *    → Tries to match sender to client, routes to ClientInbox or resets to Pending
 * 2. Emails with caseId set but clientId missing
 *    → Backfills clientId from the case record
 *
 * Run with: pnpm --filter gateway exec tsx scripts/fix-orphaned-emails.ts
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import { contactMatcherService } from '../src/services/contact-matcher';

interface Stats {
  orphanedTotal: number;
  matchedToClient: number;
  resetToPending: number;
  clientIdBackfilled: number;
  errors: number;
}

async function fixOrphanedEmails(): Promise<void> {
  console.log('Starting orphaned email fix script...\n');

  const stats: Stats = {
    orphanedTotal: 0,
    matchedToClient: 0,
    resetToPending: 0,
    clientIdBackfilled: 0,
    errors: 0,
  };

  // ============================================================================
  // Part 1: Fix truly orphaned emails (Classified but no case or client)
  // ============================================================================
  console.log('=== Part 1: Fixing orphaned emails (Classified, no case, no client) ===\n');

  const orphanedEmails = await prisma.email.findMany({
    where: {
      classificationState: EmailClassificationState.Classified,
      caseId: null,
      clientId: null,
    },
    select: {
      id: true,
      from: true,
      firmId: true,
      subject: true,
    },
  });

  stats.orphanedTotal = orphanedEmails.length;
  console.log(`Found ${orphanedEmails.length} orphaned emails\n`);

  for (const email of orphanedEmails) {
    try {
      const fromAddress = (email.from as { address?: string })?.address;

      if (!fromAddress) {
        // No sender address, reset to Pending
        await prisma.email.update({
          where: { id: email.id },
          data: {
            classificationState: EmailClassificationState.Pending,
            classifiedAt: new Date(),
            classifiedBy: 'orphan-fix-script',
          },
        });
        stats.resetToPending++;
        continue;
      }

      // Try to match sender to a client
      const match = await contactMatcherService.findContactMatch(fromAddress, email.firmId);

      if (match.certainty !== 'NONE' && match.clientId) {
        // Found a client match - route to ClientInbox
        await prisma.email.update({
          where: { id: email.id },
          data: {
            clientId: match.clientId,
            classificationState: EmailClassificationState.ClientInbox,
            classifiedAt: new Date(),
            classifiedBy: 'orphan-fix-script',
          },
        });
        stats.matchedToClient++;

        if (stats.matchedToClient <= 20 || stats.matchedToClient % 100 === 0) {
          console.log(
            `✓ Matched email ${email.id} to client ${match.clientId} (${match.clientName})`
          );
        }
      } else {
        // No client match - reset to Pending for reclassification
        await prisma.email.update({
          where: { id: email.id },
          data: {
            classificationState: EmailClassificationState.Pending,
            classifiedAt: new Date(),
            classifiedBy: 'orphan-fix-script',
          },
        });
        stats.resetToPending++;

        if (stats.resetToPending <= 20 || stats.resetToPending % 100 === 0) {
          console.log(`○ Reset email ${email.id} to Pending (no client match for ${fromAddress})`);
        }
      }
    } catch (err) {
      stats.errors++;
      console.error(`✗ Error processing orphaned email ${email.id}:`, err);
    }

    // Progress indicator
    const processed = stats.matchedToClient + stats.resetToPending + stats.errors;
    if (processed % 100 === 0 && processed > 0) {
      console.log(`... processed ${processed}/${orphanedEmails.length} orphaned emails`);
    }
  }

  // ============================================================================
  // Part 2: Backfill clientId on emails that have caseId but missing clientId
  // ============================================================================
  console.log('\n=== Part 2: Backfilling clientId on case-assigned emails ===\n');

  const emailsNeedingClientId = await prisma.email.findMany({
    where: {
      classificationState: EmailClassificationState.Classified,
      caseId: { not: null },
      clientId: null,
    },
    select: {
      id: true,
      caseId: true,
    },
  });

  console.log(`Found ${emailsNeedingClientId.length} emails needing clientId backfill\n`);

  // Batch fetch all unique case IDs
  const uniqueCaseIds = [...new Set(emailsNeedingClientId.map((e) => e.caseId!))];
  const cases = await prisma.case.findMany({
    where: { id: { in: uniqueCaseIds } },
    select: { id: true, clientId: true },
  });

  const caseClientMap = new Map<string, string>();
  for (const c of cases) {
    caseClientMap.set(c.id, c.clientId);
  }

  // Update emails in batches
  for (const email of emailsNeedingClientId) {
    const clientId = caseClientMap.get(email.caseId!);

    if (clientId) {
      try {
        await prisma.email.update({
          where: { id: email.id },
          data: { clientId },
        });
        stats.clientIdBackfilled++;

        if (stats.clientIdBackfilled <= 20 || stats.clientIdBackfilled % 100 === 0) {
          console.log(`✓ Backfilled clientId for email ${email.id} → client ${clientId}`);
        }
      } catch (err) {
        stats.errors++;
        console.error(`✗ Error backfilling clientId for email ${email.id}:`, err);
      }
    }

    // Progress indicator
    if (stats.clientIdBackfilled % 100 === 0 && stats.clientIdBackfilled > 0) {
      console.log(
        `... backfilled ${stats.clientIdBackfilled}/${emailsNeedingClientId.length} emails`
      );
    }
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log('\n--- Summary ---');
  console.log(`Orphaned emails found: ${stats.orphanedTotal}`);
  console.log(`  - Matched to client (→ ClientInbox): ${stats.matchedToClient}`);
  console.log(`  - Reset to Pending: ${stats.resetToPending}`);
  console.log(`Emails with clientId backfilled: ${stats.clientIdBackfilled}`);
  console.log(`Errors: ${stats.errors}`);
}

// Run the script
fixOrphanedEmails()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
