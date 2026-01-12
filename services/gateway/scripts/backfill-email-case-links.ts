/**
 * Script to backfill EmailCaseLink records for emails with caseId but no link
 * Run with: pnpm --filter gateway exec tsx scripts/backfill-email-case-links.ts
 *
 * Background: The emailsByCase resolver uses the EmailCaseLink join table,
 * but existing classified emails only have the legacy Email.caseId column set.
 * This script creates the missing EmailCaseLink records.
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';

async function backfillEmailCaseLinks() {
  console.log('Starting EmailCaseLink backfill...\n');

  // Find all emails with caseId set but no corresponding EmailCaseLink record
  const emailsWithCaseIdButNoLink = await prisma.email.findMany({
    where: {
      caseId: { not: null },
      classificationState: EmailClassificationState.Classified,
      caseLinks: { none: {} },
    },
    select: {
      id: true,
      caseId: true,
      classificationConfidence: true,
      classifiedBy: true,
      subject: true,
    },
  });

  console.log(`Found ${emailsWithCaseIdButNoLink.length} emails needing backfill\n`);

  if (emailsWithCaseIdButNoLink.length === 0) {
    console.log('No emails to backfill!');
    return { created: 0, errors: 0 };
  }

  let created = 0;
  let errors = 0;

  for (const email of emailsWithCaseIdButNoLink) {
    try {
      await prisma.emailCaseLink.create({
        data: {
          emailId: email.id,
          caseId: email.caseId!,
          linkedBy: email.classifiedBy || 'migration',
          isPrimary: true,
          confidence: email.classificationConfidence || 1.0,
          matchType: 'Manual', // Treat as manual since we don't know original match type
        },
      });
      created++;
      console.log(`  [${created}] Created link: ${email.id} → ${email.caseId} (${email.subject?.substring(0, 40)}...)`);
    } catch (err) {
      errors++;
      console.error(`  [ERROR] Failed to create link for email ${email.id}:`, err);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);

  // Verify the fix
  console.log('\n--- Verification ---');
  const emailsWithCaseId = await prisma.email.count({
    where: { caseId: { not: null } },
  });
  const emailCaseLinks = await prisma.emailCaseLink.count();

  console.log(`Emails with case_id: ${emailsWithCaseId}`);
  console.log(`EmailCaseLink records: ${emailCaseLinks}`);

  if (emailsWithCaseId === emailCaseLinks) {
    console.log('✓ Counts match - backfill successful!');
  } else {
    console.log(`⚠ Counts don't match - ${emailsWithCaseId - emailCaseLinks} emails still missing links`);
  }

  return { created, errors };
}

backfillEmailCaseLinks()
  .then((result) => {
    console.log('\nDone!');
    process.exit(result.errors > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
