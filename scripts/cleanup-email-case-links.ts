/**
 * Cleanup Script: Remove incorrect EmailCaseLink records
 *
 * Problem: The email classification algorithm was linking emails to ALL cases
 * where the sender appears (matchType='Actor'), causing unrelated emails to
 * show up in case Communications tabs.
 *
 * Solution: This script identifies and removes EmailCaseLink records where
 * the email subject clearly references a DIFFERENT case.
 *
 * Usage:
 *   pnpm exec tsx scripts/cleanup-email-case-links.ts              # Dry run (preview)
 *   pnpm exec tsx scripts/cleanup-email-case-links.ts --execute    # Actually delete
 *   pnpm exec tsx scripts/cleanup-email-case-links.ts --case-id=XXX  # Target specific case
 *
 * OPS-186: Email-Case Link Data Cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Configuration
// ============================================================================

interface CleanupConfig {
  dryRun: boolean;
  targetCaseId?: string;
  verbose: boolean;
}

// Keywords that strongly indicate an email belongs to a specific case
// These are extracted from case titles
function extractCaseKeywords(caseTitle: string): string[] {
  // Split by common separators and filter short words
  const words = caseTitle
    .toLowerCase()
    .split(/[\s\-\.\/\\c]+/) // Split on spaces, hyphens, dots, slashes, and 'c' (vs)
    .filter((w) => w.length > 3) // Skip short words like "c", "vs", "SRL"
    .filter((w) => !['s.r.l', 'srl', 's.a.', 'romania', 'grup', 'group'].includes(w));

  return words;
}

// Check if a subject contains keywords from a case
function subjectMatchesCase(subject: string, keywords: string[]): boolean {
  const subjectLower = subject.toLowerCase();
  return keywords.some((keyword) => subjectLower.includes(keyword));
}

// ============================================================================
// Main Cleanup Logic
// ============================================================================

async function analyzeAndCleanup(config: CleanupConfig) {
  console.log('='.repeat(70));
  console.log('EmailCaseLink Cleanup Script');
  console.log('='.repeat(70));
  console.log(`Mode: ${config.dryRun ? 'DRY RUN (no changes)' : 'EXECUTE (will delete)'}`);
  console.log('');

  // Step 1: Get all cases with their keywords
  const allCases = await prisma.case.findMany({
    select: { id: true, title: true, caseNumber: true },
  });

  const caseKeywordsMap = new Map<string, { title: string; keywords: string[] }>();
  for (const c of allCases) {
    caseKeywordsMap.set(c.id, {
      title: c.title,
      keywords: extractCaseKeywords(c.title),
    });
  }

  console.log(`Found ${allCases.length} cases to check against\n`);

  // Step 2: Determine which cases to clean up
  const casesToClean = config.targetCaseId
    ? allCases.filter((c) => c.id === config.targetCaseId)
    : allCases;

  if (casesToClean.length === 0) {
    console.log('No cases found to clean up');
    return;
  }

  let totalLinksChecked = 0;
  let totalLinksToRemove = 0;
  const linksToRemove: {
    id: string;
    emailSubject: string;
    wrongCase: string;
    rightCase: string;
  }[] = [];

  // Step 3: For each case, find incorrectly linked emails
  for (const targetCase of casesToClean) {
    const targetKeywords = caseKeywordsMap.get(targetCase.id)!.keywords;

    // Get all EmailCaseLink records for this case
    const links = await prisma.emailCaseLink.findMany({
      where: { caseId: targetCase.id },
      include: {
        email: {
          select: { id: true, subject: true, conversationId: true },
        },
      },
    });

    if (links.length === 0) continue;

    console.log(`\nAnalyzing: ${targetCase.title}`);
    console.log(`  Total links: ${links.length}`);
    console.log(`  Keywords: ${targetKeywords.join(', ')}`);

    let caseLinksToRemove = 0;

    for (const link of links) {
      totalLinksChecked++;
      const subject = link.email.subject;

      // Check if subject matches the target case
      const matchesTarget = subjectMatchesCase(subject, targetKeywords);

      // Check if subject matches ANY OTHER case more strongly
      let bestOtherMatch: { caseId: string; title: string } | null = null;

      for (const [otherCaseId, otherCaseInfo] of caseKeywordsMap) {
        if (otherCaseId === targetCase.id) continue; // Skip self

        if (subjectMatchesCase(subject, otherCaseInfo.keywords)) {
          // This email's subject matches a different case
          bestOtherMatch = { caseId: otherCaseId, title: otherCaseInfo.title };
          break; // Found a match, stop looking
        }
      }

      // Decision: Remove if it matches ANOTHER case but NOT this case
      if (bestOtherMatch && !matchesTarget) {
        caseLinksToRemove++;
        linksToRemove.push({
          id: link.id,
          emailSubject: subject.slice(0, 60) + (subject.length > 60 ? '...' : ''),
          wrongCase: targetCase.title,
          rightCase: bestOtherMatch.title,
        });

        if (config.verbose) {
          console.log(`  ❌ "${subject.slice(0, 50)}..."`);
          console.log(`     Belongs to: ${bestOtherMatch.title}`);
        }
      }
    }

    if (caseLinksToRemove > 0) {
      console.log(`  → Found ${caseLinksToRemove} links to remove`);
      totalLinksToRemove += caseLinksToRemove;
    } else {
      console.log(`  ✓ All links look correct`);
    }
  }

  // Step 4: Summary and execution
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total links checked: ${totalLinksChecked}`);
  console.log(`Links to remove: ${totalLinksToRemove}`);

  if (totalLinksToRemove === 0) {
    console.log('\nNo incorrect links found. Nothing to do.');
    return;
  }

  // Show sample of what will be removed
  console.log('\nSample of links to remove:');
  for (const link of linksToRemove.slice(0, 10)) {
    console.log(`  "${link.emailSubject}"`);
    console.log(`    Wrong case: ${link.wrongCase}`);
    console.log(`    Right case: ${link.rightCase}`);
    console.log('');
  }

  if (linksToRemove.length > 10) {
    console.log(`  ... and ${linksToRemove.length - 10} more`);
  }

  // Step 5: Execute deletion if not dry run
  if (!config.dryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('EXECUTING DELETION...');
    console.log('='.repeat(70));

    const linkIds = linksToRemove.map((l) => l.id);

    const result = await prisma.emailCaseLink.deleteMany({
      where: { id: { in: linkIds } },
    });

    console.log(`\n✅ Deleted ${result.count} EmailCaseLink records`);
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN COMPLETE');
    console.log('='.repeat(70));
    console.log('To execute the deletion, run with --execute flag:');
    console.log('  pnpm exec tsx scripts/cleanup-email-case-links.ts --execute');
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const config: CleanupConfig = {
    dryRun: !args.includes('--execute'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    targetCaseId: args.find((a) => a.startsWith('--case-id='))?.split('=')[1],
  };

  try {
    await analyzeAndCleanup(config);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
