/**
 * Check for emails that are classified to the wrong case based on reference numbers
 *
 * Usage:
 *   pnpm --filter gateway exec tsx src/scripts/check-reference-mismatches.ts
 *   pnpm --filter gateway exec tsx src/scripts/check-reference-mismatches.ts --fix
 */

import { prisma } from '@legal-platform/database';
import { CaseStatus, EmailClassificationState, ClassificationMatchType } from '@prisma/client';

const REFERENCE_PATTERN = /\b(\d{1,6}\/\d{1,3}\/20\d{2})\b/g;

function extractRefs(text: string): string[] {
  const refs = new Set<string>();
  const matches = text.matchAll(REFERENCE_PATTERN);
  for (const match of matches) refs.add(match[1]);
  return Array.from(refs);
}

interface Mismatch {
  emailId: string;
  subject: string;
  reference: string;
  currentCaseId: string;
  currentCaseTitle: string;
  correctCaseId: string;
  correctCaseTitle: string;
}

async function main() {
  const shouldFix = process.argv.includes('--fix');

  console.log('='.repeat(60));
  console.log('Reference Number Mismatch Checker');
  console.log(shouldFix ? 'MODE: FIX' : 'MODE: CHECK ONLY');
  console.log('='.repeat(60));
  console.log();

  // Get all active cases with reference numbers
  const cases = await prisma.case.findMany({
    where: {
      status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
      referenceNumbers: { isEmpty: false },
    },
    select: { id: true, title: true, referenceNumbers: true },
  });

  const refToCase = new Map<string, { id: string; title: string }>();
  for (const c of cases) {
    for (const ref of c.referenceNumbers) {
      refToCase.set(ref.toLowerCase(), { id: c.id, title: c.title });
    }
  }

  console.log(`Reference numbers tracked: ${refToCase.size}`);

  // Find classified emails
  const emails = await prisma.email.findMany({
    where: {
      classificationState: EmailClassificationState.Classified,
      caseId: { not: null },
    },
    select: {
      id: true,
      subject: true,
      bodyPreview: true,
      caseId: true,
      case: { select: { id: true, title: true } },
    },
  });

  console.log(`Classified emails to check: ${emails.length}`);
  console.log();

  const mismatches: Mismatch[] = [];

  for (const email of emails) {
    const text = (email.subject + ' ' + email.bodyPreview).toLowerCase();
    const refs = extractRefs(text);

    for (const ref of refs) {
      const correctCase = refToCase.get(ref.toLowerCase());
      if (correctCase && correctCase.id !== email.caseId) {
        mismatches.push({
          emailId: email.id,
          subject: email.subject,
          reference: ref,
          currentCaseId: email.caseId!,
          currentCaseTitle: email.case?.title || 'Unknown',
          correctCaseId: correctCase.id,
          correctCaseTitle: correctCase.title,
        });
        break; // One mismatch per email is enough
      }
    }
  }

  console.log(`Mismatches found: ${mismatches.length}`);
  console.log();

  if (mismatches.length === 0) {
    console.log('✓ No mismatches found. All emails with references are correctly classified.');
    await prisma.$disconnect();
    return;
  }

  // Show first 10 mismatches
  console.log('Sample mismatches:');
  for (const m of mismatches.slice(0, 10)) {
    console.log(`  Email: ${m.subject.substring(0, 50)}`);
    console.log(`    Ref: ${m.reference}`);
    console.log(`    Current: ${m.currentCaseTitle.substring(0, 40)}`);
    console.log(`    Should be: ${m.correctCaseTitle.substring(0, 40)}`);
    console.log();
  }

  if (!shouldFix) {
    console.log('Run with --fix to correct these mismatches.');
    await prisma.$disconnect();
    return;
  }

  // Fix mismatches
  console.log('Fixing mismatches...');
  let fixed = 0;

  for (const m of mismatches) {
    try {
      // Get client ID from correct case
      const correctCase = await prisma.case.findUnique({
        where: { id: m.correctCaseId },
        select: { clientId: true },
      });

      // Update email
      await prisma.email.update({
        where: { id: m.emailId },
        data: {
          caseId: m.correctCaseId,
          clientId: correctCase?.clientId,
          classificationConfidence: 1.0,
          classifiedBy: 'system:reference-fix',
          classifiedAt: new Date(),
        },
      });

      // Update or create EmailCaseLink
      const existingLink = await prisma.emailCaseLink.findFirst({
        where: { emailId: m.emailId, isPrimary: true },
      });

      if (existingLink) {
        await prisma.emailCaseLink.update({
          where: { id: existingLink.id },
          data: {
            caseId: m.correctCaseId,
            confidence: 1.0,
            matchType: ClassificationMatchType.ReferenceNumber,
            linkedBy: 'system:reference-fix',
          },
        });
      } else {
        await prisma.emailCaseLink.create({
          data: {
            emailId: m.emailId,
            caseId: m.correctCaseId,
            confidence: 1.0,
            matchType: ClassificationMatchType.ReferenceNumber,
            isPrimary: true,
            linkedBy: 'system:reference-fix',
          },
        });
      }

      fixed++;
    } catch (error) {
      console.error(`Failed to fix email ${m.emailId}:`, error);
    }
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Fixed: ${fixed} / ${mismatches.length} emails`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
