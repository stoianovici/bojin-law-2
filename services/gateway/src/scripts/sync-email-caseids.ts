/**
 * Sync Email.caseId with Primary EmailCaseLink
 *
 * This script fixes any inconsistencies between the legacy Email.caseId field
 * and the EmailCaseLink isPrimary relationship.
 *
 * Run this AFTER applying the sync trigger migration to fix existing data.
 *
 * Usage:
 *   pnpm --filter gateway exec tsx src/scripts/sync-email-caseids.ts
 *   pnpm --filter gateway exec tsx src/scripts/sync-email-caseids.ts --dry-run
 */

import { prisma } from '@legal-platform/database';

// ============================================================================
// Types
// ============================================================================

interface InconsistentEmail {
  emailId: string;
  currentCaseId: string | null;
  primaryLinkCaseId: string | null;
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Email.caseId ↔ EmailCaseLink Sync Script');
  console.log(isDryRun ? 'MODE: DRY RUN (no changes will be made)' : 'MODE: LIVE');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Find emails with caseId but no primary EmailCaseLink
  console.log('1. Finding emails with caseId but no primary EmailCaseLink...');
  const emailsWithCaseIdNoPrimaryLink = await findEmailsWithCaseIdNoPrimaryLink();
  console.log(`   Found: ${emailsWithCaseIdNoPrimaryLink.length} emails`);

  // Step 2: Find emails with primary EmailCaseLink but wrong/missing caseId
  console.log('2. Finding emails with primary link but mismatched caseId...');
  const emailsWithMismatchedCaseId = await findEmailsWithMismatchedCaseId();
  console.log(`   Found: ${emailsWithMismatchedCaseId.length} emails`);

  // Step 3: Find emails with caseId that doesn't match any link
  console.log('3. Finding emails with orphaned caseId (no matching link)...');
  const emailsWithOrphanedCaseId = await findEmailsWithOrphanedCaseId();
  console.log(`   Found: ${emailsWithOrphanedCaseId.length} emails`);

  console.log();
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Emails with caseId but no primary link: ${emailsWithCaseIdNoPrimaryLink.length}`);
  console.log(`Emails with mismatched caseId: ${emailsWithMismatchedCaseId.length}`);
  console.log(`Emails with orphaned caseId: ${emailsWithOrphanedCaseId.length}`);
  console.log();

  if (isDryRun) {
    console.log('DRY RUN: No changes made. Run without --dry-run to apply fixes.');
    return;
  }

  const totalToFix =
    emailsWithCaseIdNoPrimaryLink.length +
    emailsWithMismatchedCaseId.length +
    emailsWithOrphanedCaseId.length;

  if (totalToFix === 0) {
    console.log('No inconsistencies found. Database is already in sync.');
    return;
  }

  console.log('Applying fixes...');
  console.log();

  // Fix 1: Create primary EmailCaseLinks for emails that have caseId but no primary link
  if (emailsWithCaseIdNoPrimaryLink.length > 0) {
    console.log('Fix 1: Creating primary links for emails with caseId but no link...');
    await createPrimaryLinksForOrphanedEmails(emailsWithCaseIdNoPrimaryLink);
    console.log('   Done.');
  }

  // Fix 2: Update Email.caseId to match primary EmailCaseLink
  if (emailsWithMismatchedCaseId.length > 0) {
    console.log('Fix 2: Updating caseId to match primary link...');
    await syncCaseIdFromPrimaryLinks(emailsWithMismatchedCaseId);
    console.log('   Done.');
  }

  // Fix 3: Clear orphaned caseId values (caseId set but no link exists)
  if (emailsWithOrphanedCaseId.length > 0) {
    console.log('Fix 3: Clearing orphaned caseId values...');
    await clearOrphanedCaseIds(emailsWithOrphanedCaseId);
    console.log('   Done.');
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Sync complete!');
  console.log('='.repeat(60));

  // Verify
  console.log();
  console.log('Verifying...');
  const remaining = await countInconsistencies();
  if (remaining === 0) {
    console.log('✓ All inconsistencies resolved.');
  } else {
    console.log(`⚠ ${remaining} inconsistencies remain. May require manual review.`);
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Find emails that have caseId set but no primary EmailCaseLink
 */
async function findEmailsWithCaseIdNoPrimaryLink(): Promise<{ emailId: string; caseId: string }[]> {
  const result = await prisma.$queryRaw<Array<{ email_id: string; case_id: string }>>`
    SELECT e.id AS email_id, e.case_id
    FROM emails e
    WHERE e.case_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM email_case_links ecl
        WHERE ecl.email_id = e.id AND ecl.is_primary = true
      )
  `;

  return result.map((r) => ({ emailId: r.email_id, caseId: r.case_id }));
}

/**
 * Find emails where primary EmailCaseLink.caseId doesn't match Email.caseId
 */
async function findEmailsWithMismatchedCaseId(): Promise<InconsistentEmail[]> {
  const result = await prisma.$queryRaw<
    Array<{ email_id: string; email_case_id: string | null; link_case_id: string }>
  >`
    SELECT e.id AS email_id, e.case_id AS email_case_id, ecl.case_id AS link_case_id
    FROM emails e
    JOIN email_case_links ecl ON ecl.email_id = e.id AND ecl.is_primary = true
    WHERE e.case_id IS DISTINCT FROM ecl.case_id
  `;

  return result.map((r) => ({
    emailId: r.email_id,
    currentCaseId: r.email_case_id,
    primaryLinkCaseId: r.link_case_id,
  }));
}

/**
 * Find emails that have caseId set but no EmailCaseLink exists for that case
 */
async function findEmailsWithOrphanedCaseId(): Promise<{ emailId: string; caseId: string }[]> {
  const result = await prisma.$queryRaw<Array<{ email_id: string; case_id: string }>>`
    SELECT e.id AS email_id, e.case_id
    FROM emails e
    WHERE e.case_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM email_case_links ecl
        WHERE ecl.email_id = e.id AND ecl.case_id = e.case_id
      )
  `;

  return result.map((r) => ({ emailId: r.email_id, caseId: r.case_id }));
}

/**
 * Count total remaining inconsistencies
 */
async function countInconsistencies(): Promise<number> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM emails e
    WHERE (
      -- Has caseId but no matching primary link
      (e.case_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM email_case_links ecl
        WHERE ecl.email_id = e.id AND ecl.is_primary = true AND ecl.case_id = e.case_id
      ))
      OR
      -- Has primary link but caseId doesn't match
      (EXISTS (
        SELECT 1 FROM email_case_links ecl
        WHERE ecl.email_id = e.id AND ecl.is_primary = true AND ecl.case_id != e.case_id
      ))
      OR
      -- Has no caseId but has primary link
      (e.case_id IS NULL AND EXISTS (
        SELECT 1 FROM email_case_links ecl
        WHERE ecl.email_id = e.id AND ecl.is_primary = true
      ))
    )
  `;

  return Number(result[0].count);
}

// ============================================================================
// Fix Functions
// ============================================================================

/**
 * Create primary EmailCaseLinks for emails that have caseId but no link
 */
async function createPrimaryLinksForOrphanedEmails(
  emails: Array<{ emailId: string; caseId: string }>
): Promise<void> {
  for (const { emailId, caseId } of emails) {
    // Check if a non-primary link already exists
    const existingLink = await prisma.emailCaseLink.findUnique({
      where: { emailId_caseId: { emailId, caseId } },
    });

    if (existingLink) {
      // Upgrade to primary
      await prisma.emailCaseLink.update({
        where: { id: existingLink.id },
        data: { isPrimary: true },
      });
    } else {
      // Create new primary link
      await prisma.emailCaseLink.create({
        data: {
          emailId,
          caseId,
          isPrimary: true,
          linkedBy: 'sync-script',
          confidence: 1.0,
        },
      });
    }
  }
}

/**
 * Update Email.caseId to match the primary EmailCaseLink
 */
async function syncCaseIdFromPrimaryLinks(emails: InconsistentEmail[]): Promise<void> {
  for (const { emailId, primaryLinkCaseId } of emails) {
    await prisma.email.update({
      where: { id: emailId },
      data: { caseId: primaryLinkCaseId },
    });
  }
}

/**
 * Clear orphaned caseId values (no matching link exists)
 */
async function clearOrphanedCaseIds(emails: Array<{ emailId: string }>): Promise<void> {
  for (const { emailId } of emails) {
    await prisma.email.update({
      where: { id: emailId },
      data: { caseId: null },
    });
  }
}

// ============================================================================
// Run
// ============================================================================

main()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
