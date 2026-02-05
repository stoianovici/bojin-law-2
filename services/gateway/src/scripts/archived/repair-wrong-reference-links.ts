/**
 * Repair script for emails linked to wrong cases based on reference numbers
 *
 * This script finds emails where:
 * 1. Email contains a court reference number (e.g., 5296/30/2025)
 * 2. The reference number matches a known case
 * 3. But the email is linked to a DIFFERENT case
 *
 * Usage:
 *   pnpm --filter gateway exec npx ts-node src/scripts/repair-wrong-reference-links.ts
 *   pnpm --filter gateway exec npx ts-node src/scripts/repair-wrong-reference-links.ts --dry-run
 */

import { prisma } from '@legal-platform/database';
import { CaseStatus, ClassificationMatchType } from '@prisma/client';

// Reference number pattern
const REFERENCE_PATTERN = /\b(\d{1,6}\/\d{1,3}\/20\d{2})\b/g;

function extractReferenceNumbers(text: string): string[] {
  const refs = new Set<string>();
  const matches = text.matchAll(REFERENCE_PATTERN);
  for (const match of matches) {
    refs.add(match[1]);
  }
  return Array.from(refs);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`🔧 Repairing emails with wrong reference links${dryRun ? ' (DRY RUN)' : ''}...\n`);

  // Get all Solaria cases with their reference numbers
  const cases = await prisma.case.findMany({
    where: {
      status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
      actors: {
        some: { email: { equals: 'solariagrup@gmail.com', mode: 'insensitive' } },
      },
    },
    select: {
      id: true,
      title: true,
      referenceNumbers: true,
    },
  });

  console.log('Found', cases.length, 'Solaria cases');

  // Build reference -> case lookup
  const refToCaseMap = new Map<string, { id: string; title: string }>();
  for (const c of cases) {
    for (const ref of c.referenceNumbers) {
      refToCaseMap.set(ref.toLowerCase(), { id: c.id, title: c.title });
    }
  }

  console.log('Built reference map with', refToCaseMap.size, 'entries');
  console.log('Reference numbers tracked:', Array.from(refToCaseMap.keys()).join(', '));

  // Get all emails linked to Solaria cases
  const caseIds = cases.map((c) => c.id);
  const emails = await prisma.email.findMany({
    where: {
      caseLinks: {
        some: {
          caseId: { in: caseIds },
        },
      },
    },
    select: {
      id: true,
      subject: true,
      bodyPreview: true,
      caseLinks: {
        select: {
          id: true,
          caseId: true,
          confidence: true,
          case: {
            select: { title: true, referenceNumbers: true },
          },
        },
      },
    },
  });

  console.log('Found', emails.length, 'emails linked to Solaria cases\n');

  // Find mismatches
  let fixed = 0;
  let skipped = 0;

  for (const email of emails) {
    const textToSearch = `${email.subject} ${email.bodyPreview}`.toLowerCase();
    const extractedRefs = extractReferenceNumbers(textToSearch);

    if (extractedRefs.length === 0) {
      continue; // No reference numbers in email
    }

    // Check each extracted reference
    for (const ref of extractedRefs) {
      const correctCase = refToCaseMap.get(ref.toLowerCase());
      if (!correctCase) {
        continue; // Reference doesn't match any known case
      }

      // Check if email is already linked to the correct case
      const hasCorrectLink = email.caseLinks.some((link) => link.caseId === correctCase.id);

      if (hasCorrectLink) {
        continue; // Already correctly linked
      }

      // Found a mismatch - email has reference but linked to wrong case(s)
      const currentLinks = email.caseLinks
        .map((l) => `${l.case.title.substring(0, 30)} (${l.confidence})`)
        .join(', ');

      console.log(`❌ Mismatch found:`);
      console.log(`   Email: ${email.subject.substring(0, 60)}`);
      console.log(`   Reference: ${ref}`);
      console.log(`   Should be: ${correctCase.title.substring(0, 40)}`);
      console.log(`   Currently linked to: ${currentLinks}`);

      if (!dryRun) {
        // Delete existing wrong links
        await prisma.emailCaseLink.deleteMany({
          where: {
            emailId: email.id,
            caseId: { in: caseIds }, // Only delete Solaria case links
          },
        });

        // Create correct link
        await prisma.emailCaseLink.create({
          data: {
            emailId: email.id,
            caseId: correctCase.id,
            confidence: 0.95,
            matchType: ClassificationMatchType.Semantic,
            isPrimary: true,
            linkedBy: 'system:reference-repair',
          },
        });

        // Update Email.caseId
        await prisma.email.update({
          where: { id: email.id },
          data: { caseId: correctCase.id },
        });

        console.log(`   ✅ Fixed!`);
      } else {
        console.log(`   (would fix in non-dry-run mode)`);
      }

      console.log('');
      fixed++;
      break; // One fix per email
    }
  }

  console.log('\n========================================');
  console.log(`Fixed: ${fixed} emails`);
  if (dryRun) {
    console.log('(DRY RUN - no changes made)');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
