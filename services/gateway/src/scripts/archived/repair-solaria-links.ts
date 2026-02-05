/**
 * One-time repair script for Solaria email links
 *
 * Usage:
 *   pnpm --filter gateway exec npx ts-node src/scripts/repair-solaria-links.ts
 */

import { prisma } from '@legal-platform/database';
import { CaseStatus, ClassificationMatchType } from '@prisma/client';
import { getAIEmailCaseRouterService } from '../../services/ai-email-case-router.service';

async function main() {
  console.log('🔧 Repairing Solaria email links...\n');

  // Get all Solaria cases
  const cases = await prisma.case.findMany({
    where: {
      status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
      actors: {
        some: { email: { equals: 'solariagrup@gmail.com', mode: 'insensitive' } },
      },
    },
    include: {
      actors: { select: { name: true, organization: true, email: true, role: true } },
      client: { select: { name: true } },
    },
  });

  const caseIds = cases.map((c) => c.id);
  const candidateCases = cases.map((c) => ({
    id: c.id,
    title: c.title,
    caseNumber: c.caseNumber,
    referenceNumbers: c.referenceNumbers,
    keywords: c.keywords,
    clientName: c.client.name,
    actors: c.actors,
  }));

  console.log('Found', cases.length, 'Solaria cases');

  // Find emails with caseId to Solaria but missing links
  const brokenEmails = await prisma.email.findMany({
    where: {
      caseId: { in: caseIds },
      caseLinks: { none: {} },
    },
    select: {
      id: true,
      graphMessageId: true,
      subject: true,
      bodyPreview: true,
      from: true,
      toRecipients: true,
      receivedDateTime: true,
      caseId: true,
    },
  });

  console.log('Found', brokenEmails.length, 'emails with missing links');

  if (brokenEmails.length === 0) {
    console.log('Nothing to repair!');
    await prisma.$disconnect();
    return;
  }

  // Route emails
  const router = getAIEmailCaseRouterService();
  const routingInputs = brokenEmails.map((e) => ({
    id: e.id,
    graphMessageId: e.graphMessageId,
    subject: e.subject,
    bodyPreview: e.bodyPreview,
    from: e.from as { name?: string; address: string },
    toRecipients: e.toRecipients as Array<{ name?: string; address: string }>,
    receivedDateTime: e.receivedDateTime,
  }));

  const firmId = '51f2f797-3109-4b79-ac43-a57ecc07bb06';
  const routingResults = await router.routeEmailsToCases(routingInputs, candidateCases, firmId);

  // Create links
  let created = 0;
  let updated = 0;
  for (const result of routingResults) {
    const email = brokenEmails.find((e) => e.id === result.emailId);
    if (!email || !email.caseId) continue;

    if (result.matches.length > 0) {
      const match = result.matches[0]; // Primary match
      await prisma.emailCaseLink.create({
        data: {
          emailId: email.id,
          caseId: match.caseId,
          confidence: match.confidence,
          matchType: ClassificationMatchType.Semantic,
          isPrimary: true,
          linkedBy: 'system:repair-script',
        },
      });

      // Update Email.caseId if different
      if (email.caseId !== match.caseId) {
        await prisma.email.update({
          where: { id: email.id },
          data: { caseId: match.caseId },
        });
        updated++;
      }
      created++;
      console.log(
        `  ✅ ${email.subject.substring(0, 50)} -> ${candidateCases.find((c) => c.id === match.caseId)?.title.substring(0, 30)}`
      );
    } else {
      // No match - use original caseId
      await prisma.emailCaseLink.create({
        data: {
          emailId: email.id,
          caseId: email.caseId,
          confidence: 0.5,
          matchType: ClassificationMatchType.Manual,
          isPrimary: true,
          linkedBy: 'system:repair-script',
        },
      });
      created++;
      console.log(`  ⚠️  ${email.subject.substring(0, 50)} -> kept original (no match)`);
    }
  }

  console.log('\n✅ Created', created, 'links');
  console.log('📝 Updated caseId for', updated, 'emails');
  await prisma.$disconnect();
}

main().catch(console.error);
