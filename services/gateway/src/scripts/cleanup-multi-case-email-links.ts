/**
 * Cleanup Multi-Case Email Links
 *
 * This script fixes emails that were incorrectly linked to ALL cases when a
 * contact exists on multiple cases (e.g., TT Solaria on 5 cases).
 *
 * It uses AI routing to determine which case each email actually belongs to,
 * then removes incorrect links and updates the correct ones.
 *
 * Usage:
 *   # Dry run (preview only, no changes)
 *   pnpm --filter gateway exec npx ts-node src/scripts/cleanup-multi-case-email-links.ts --dry-run
 *
 *   # Execute for all firms
 *   pnpm --filter gateway exec npx ts-node src/scripts/cleanup-multi-case-email-links.ts
 *
 *   # Execute for specific firm
 *   pnpm --filter gateway exec npx ts-node src/scripts/cleanup-multi-case-email-links.ts --firm-id <uuid>
 *
 *   # Execute for specific contact email
 *   pnpm --filter gateway exec npx ts-node src/scripts/cleanup-multi-case-email-links.ts --contact <email>
 *
 *   # Combine options
 *   pnpm --filter gateway exec npx ts-node src/scripts/cleanup-multi-case-email-links.ts --firm-id <uuid> --contact <email> --dry-run
 */

import { prisma } from '@legal-platform/database';
import { CaseStatus, ClassificationMatchType } from '@prisma/client';
import {
  getAIEmailCaseRouterService,
  AIEmailCaseRouterService,
  type CaseCandidate,
  type EmailRoutingInput,
} from '../services/ai-email-case-router.service';

// ============================================================================
// Types
// ============================================================================

interface EmailWithMultipleLinks {
  emailId: string;
  graphMessageId: string;
  subject: string;
  bodyPreview: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
  linkedCaseIds: string[];
  linkedCaseTitles: string[];
}

interface CleanupResult {
  emailId: string;
  subject: string;
  originalCaseCount: number;
  keptCases: Array<{ caseId: string; title: string; confidence: number; isPrimary: boolean }>;
  removedCases: Array<{ caseId: string; title: string }>;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(): { dryRun: boolean; firmId?: string; contactEmail?: string } {
  const args = process.argv.slice(2);
  const result: { dryRun: boolean; firmId?: string; contactEmail?: string } = {
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      result.dryRun = true;
    } else if (args[i] === '--firm-id' && args[i + 1]) {
      result.firmId = args[++i];
    } else if (args[i] === '--contact' && args[i + 1]) {
      result.contactEmail = args[++i].toLowerCase();
    }
  }

  return result;
}

// ============================================================================
// Find Emails with Multiple Case Links
// ============================================================================

/**
 * Find contacts that exist on multiple active cases.
 */
async function findMultiCaseContacts(
  firmId?: string
): Promise<Array<{ email: string; firmId: string; caseCount: number }>> {
  // Find actors with same email on multiple cases
  // Use separate queries based on whether firmId is provided
  let actorContacts: Array<{ email: string; firm_id: string; case_count: bigint }>;

  if (firmId) {
    actorContacts = await prisma.$queryRaw`
      SELECT
        LOWER(ca.email) as email,
        c.firm_id,
        COUNT(DISTINCT c.id) as case_count
      FROM case_actors ca
      JOIN cases c ON ca.case_id = c.id
      WHERE ca.email IS NOT NULL
        AND c.status IN ('Active', 'OnHold')
        AND c.firm_id = ${firmId}
      GROUP BY LOWER(ca.email), c.firm_id
      HAVING COUNT(DISTINCT c.id) > 1
      ORDER BY case_count DESC
    `;
  } else {
    actorContacts = await prisma.$queryRaw`
      SELECT
        LOWER(ca.email) as email,
        c.firm_id,
        COUNT(DISTINCT c.id) as case_count
      FROM case_actors ca
      JOIN cases c ON ca.case_id = c.id
      WHERE ca.email IS NOT NULL
        AND c.status IN ('Active', 'OnHold')
      GROUP BY LOWER(ca.email), c.firm_id
      HAVING COUNT(DISTINCT c.id) > 1
      ORDER BY case_count DESC
    `;
  }

  return actorContacts.map((c) => ({
    email: c.email,
    firmId: c.firm_id,
    caseCount: Number(c.case_count),
  }));
}

/**
 * Get all active cases where this contact appears.
 */
async function getContactCases(contactEmail: string, firmId: string): Promise<CaseCandidate[]> {
  const normalizedEmail = contactEmail.toLowerCase();

  const cases = await prisma.case.findMany({
    where: {
      firmId,
      status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
      actors: {
        some: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
        },
      },
    },
    include: {
      actors: {
        select: {
          name: true,
          organization: true,
          email: true,
          role: true,
        },
      },
      client: {
        select: {
          name: true,
        },
      },
    },
  });

  return cases.map((c) => ({
    id: c.id,
    title: c.title,
    caseNumber: c.caseNumber,
    referenceNumbers: c.referenceNumbers,
    keywords: c.keywords,
    clientName: c.client.name,
    actors: c.actors,
  }));
}

/**
 * Find emails that are linked to multiple cases for a given contact.
 */
async function findEmailsWithMultipleLinks(
  contactEmail: string,
  contactCases: CaseCandidate[]
): Promise<EmailWithMultipleLinks[]> {
  const caseIds = contactCases.map((c) => c.id);
  const caseTitleMap = new Map(contactCases.map((c) => [c.id, c.title]));

  // Find emails linked to multiple of these cases
  const emailsWithLinks = await prisma.email.findMany({
    where: {
      caseLinks: {
        some: {
          caseId: { in: caseIds },
        },
      },
    },
    include: {
      caseLinks: {
        where: {
          caseId: { in: caseIds },
        },
        select: {
          caseId: true,
        },
      },
    },
  });

  // Filter to only emails linked to 2+ of these cases
  const multiLinkedEmails = emailsWithLinks.filter((e) => e.caseLinks.length > 1);

  return multiLinkedEmails.map((e) => ({
    emailId: e.id,
    graphMessageId: e.graphMessageId,
    subject: e.subject,
    bodyPreview: e.bodyPreview,
    from: e.from as { name?: string; address: string },
    toRecipients: e.toRecipients as Array<{ name?: string; address: string }>,
    receivedDateTime: e.receivedDateTime,
    linkedCaseIds: e.caseLinks.map((l) => l.caseId),
    linkedCaseTitles: e.caseLinks.map((l) => caseTitleMap.get(l.caseId) || 'Unknown'),
  }));
}

// ============================================================================
// AI Routing and Cleanup
// ============================================================================

/**
 * Process emails through AI routing and determine which links to keep/remove.
 */
async function routeAndCleanup(
  emails: EmailWithMultipleLinks[],
  contactCases: CaseCandidate[],
  firmId: string,
  dryRun: boolean
): Promise<CleanupResult[]> {
  if (emails.length === 0) return [];

  const caseTitleMap = new Map(contactCases.map((c) => [c.id, c.title]));
  const results: CleanupResult[] = [];

  // Convert to routing input format
  const routingInputs: EmailRoutingInput[] = emails.map((e) => ({
    id: e.emailId,
    graphMessageId: e.graphMessageId,
    subject: e.subject,
    bodyPreview: e.bodyPreview,
    from: e.from,
    toRecipients: e.toRecipients,
    receivedDateTime: e.receivedDateTime,
  }));

  // Call AI router
  const router = getAIEmailCaseRouterService();
  const routingResults = await router.routeEmailsToCases(routingInputs, contactCases, firmId);

  // Process each result
  for (const routingResult of routingResults) {
    const originalEmail = emails.find((e) => e.emailId === routingResult.emailId);
    if (!originalEmail) continue;

    const keptCases: CleanupResult['keptCases'] = [];
    const removedCases: CleanupResult['removedCases'] = [];
    const newCases: CleanupResult['keptCases'] = []; // Cases to CREATE (not originally linked)

    // Set of originally linked case IDs
    const originalLinkedCaseIds = new Set(originalEmail.linkedCaseIds);

    // First, process the routing matches - these are the cases we WANT to keep/create
    for (let i = 0; i < routingResult.matches.length; i++) {
      const match = routingResult.matches[i];
      if (!AIEmailCaseRouterService.meetsLinkThreshold(match.confidence)) continue;

      const isPrimary = i === 0 && AIEmailCaseRouterService.isPrimaryMatch(match.confidence);

      if (originalLinkedCaseIds.has(match.caseId)) {
        // Already linked - will update
        keptCases.push({
          caseId: match.caseId,
          title: caseTitleMap.get(match.caseId) || 'Unknown',
          confidence: match.confidence,
          isPrimary,
        });
      } else {
        // Not originally linked - will create new link
        newCases.push({
          caseId: match.caseId,
          title: caseTitleMap.get(match.caseId) || 'Unknown',
          confidence: match.confidence,
          isPrimary,
        });
      }
    }

    // Determine which original links to remove (not in routing matches)
    const matchedCaseIds = new Set(routingResult.matches.map((m) => m.caseId));
    for (const linkedCaseId of originalEmail.linkedCaseIds) {
      if (!matchedCaseIds.has(linkedCaseId)) {
        removedCases.push({
          caseId: linkedCaseId,
          title: caseTitleMap.get(linkedCaseId) || 'Unknown',
        });
      }
    }

    // If no matches at all, keep the first original link as fallback
    if (keptCases.length === 0 && newCases.length === 0 && originalEmail.linkedCaseIds.length > 0) {
      const fallbackCaseId = originalEmail.linkedCaseIds[0];
      keptCases.push({
        caseId: fallbackCaseId,
        title: caseTitleMap.get(fallbackCaseId) || 'Unknown',
        confidence: 0.5,
        isPrimary: true,
      });
      // Remove the fallback from removedCases
      const idx = removedCases.findIndex((r) => r.caseId === fallbackCaseId);
      if (idx >= 0) removedCases.splice(idx, 1);
    }

    // Combine kept and new cases for reporting
    const allKeptCases = [...keptCases, ...newCases];

    results.push({
      emailId: originalEmail.emailId,
      subject: originalEmail.subject,
      originalCaseCount: originalEmail.linkedCaseIds.length,
      keptCases: allKeptCases,
      removedCases,
    });

    // Execute cleanup if not dry run
    if (!dryRun && (removedCases.length > 0 || newCases.length > 0)) {
      // Remove incorrect links
      if (removedCases.length > 0) {
        await prisma.emailCaseLink.deleteMany({
          where: {
            emailId: originalEmail.emailId,
            caseId: { in: removedCases.map((r) => r.caseId) },
          },
        });
      }

      // Update existing kept links with new confidence and isPrimary
      for (const kept of keptCases) {
        await prisma.emailCaseLink.update({
          where: {
            emailId_caseId: {
              emailId: originalEmail.emailId,
              caseId: kept.caseId,
            },
          },
          data: {
            confidence: kept.confidence,
            matchType: ClassificationMatchType.Semantic,
            isPrimary: kept.isPrimary,
          },
        });
      }

      // Create NEW links for cases that weren't originally linked
      for (const newCase of newCases) {
        await prisma.emailCaseLink.create({
          data: {
            emailId: originalEmail.emailId,
            caseId: newCase.caseId,
            confidence: newCase.confidence,
            matchType: ClassificationMatchType.Semantic,
            isPrimary: newCase.isPrimary,
            linkedBy: 'system:cleanup-script',
          },
        });
      }

      // Update Email.caseId to primary case
      const primaryCase = allKeptCases.find((k) => k.isPrimary);
      if (primaryCase) {
        await prisma.email.update({
          where: { id: originalEmail.emailId },
          data: { caseId: primaryCase.caseId },
        });
      }
    }
  }

  return results;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const { dryRun, firmId, contactEmail } = parseArgs();

  console.log('\n🔄 Multi-Case Email Link Cleanup Script');
  console.log('='.repeat(60));
  console.log(
    dryRun ? '🔍 DRY RUN - No changes will be made\n' : '🚀 EXECUTING - Links will be modified\n'
  );

  if (firmId) console.log(`   Firm ID: ${firmId}`);
  if (contactEmail) console.log(`   Contact: ${contactEmail}`);
  console.log('');

  try {
    // Step 1: Find multi-case contacts
    console.log('🔍 Finding contacts on multiple cases...\n');

    let contacts: Array<{ email: string; firmId: string; caseCount: number }>;

    if (contactEmail && firmId) {
      // Specific contact and firm
      const cases = await getContactCases(contactEmail, firmId);
      if (cases.length > 1) {
        contacts = [{ email: contactEmail, firmId, caseCount: cases.length }];
      } else {
        contacts = [];
      }
    } else if (contactEmail) {
      // Specific contact, all firms
      const allContacts = await findMultiCaseContacts();
      contacts = allContacts.filter((c) => c.email === contactEmail);
    } else {
      // All contacts
      contacts = await findMultiCaseContacts(firmId);
    }

    if (contacts.length === 0) {
      console.log('✅ No contacts found on multiple cases. Nothing to clean up!\n');
      return;
    }

    console.log(`📊 Found ${contacts.length} contacts on multiple cases:\n`);
    for (const contact of contacts.slice(0, 10)) {
      console.log(`   ${contact.email} - ${contact.caseCount} cases`);
    }
    if (contacts.length > 10) {
      console.log(`   ... and ${contacts.length - 10} more`);
    }
    console.log('');

    // Step 2: Process each contact
    let totalEmails = 0;
    let totalRemoved = 0;
    let totalKept = 0;

    for (const contact of contacts) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📧 Processing: ${contact.email}`);
      console.log(`   Firm: ${contact.firmId}`);
      console.log(`   Cases: ${contact.caseCount}`);

      // Get cases for this contact
      const contactCases = await getContactCases(contact.email, contact.firmId);
      console.log(`   Case titles: ${contactCases.map((c) => c.title).join(', ')}`);

      // Find emails with multiple links
      const multiLinkedEmails = await findEmailsWithMultipleLinks(contact.email, contactCases);

      if (multiLinkedEmails.length === 0) {
        console.log('   ✅ No emails linked to multiple cases');
        continue;
      }

      console.log(`   Found ${multiLinkedEmails.length} emails linked to multiple cases\n`);

      // Route and cleanup
      const results = await routeAndCleanup(
        multiLinkedEmails,
        contactCases,
        contact.firmId,
        dryRun
      );

      // Print results
      for (const result of results) {
        totalEmails++;
        totalRemoved += result.removedCases.length;
        totalKept += result.keptCases.length;

        console.log(
          `   📩 "${result.subject.substring(0, 50)}${result.subject.length > 50 ? '...' : ''}"`
        );
        console.log(`      Original: ${result.originalCaseCount} cases`);

        if (result.keptCases.length > 0) {
          console.log(`      ✅ Keep:`);
          for (const kept of result.keptCases) {
            console.log(
              `         - ${kept.title} (conf: ${kept.confidence.toFixed(2)}${kept.isPrimary ? ', PRIMARY' : ''})`
            );
          }
        }

        if (result.removedCases.length > 0) {
          console.log(`      ❌ Remove:`);
          for (const removed of result.removedCases) {
            console.log(`         - ${removed.title}`);
          }
        }
        console.log('');
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Contacts processed: ${contacts.length}`);
    console.log(`   Emails processed: ${totalEmails}`);
    console.log(`   Links kept: ${totalKept}`);
    console.log(`   Links removed: ${totalRemoved}`);
    console.log('');

    if (dryRun) {
      console.log('🔍 This was a DRY RUN. Run without --dry-run to execute changes.\n');
    } else {
      console.log('✅ Cleanup complete!\n');
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
