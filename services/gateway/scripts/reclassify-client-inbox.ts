/**
 * Script to re-classify emails using the scoring algorithm
 * Processes: Pending, ClientInbox, and Uncertain emails
 *
 * Run with: pnpm --filter gateway exec tsx scripts/reclassify-client-inbox.ts
 */

import 'dotenv/config';
import { prisma } from '@legal-platform/database';
import { EmailClassificationState } from '@prisma/client';
import {
  classificationScoringService,
  type EmailForClassification,
} from '../src/services/classification-scoring';

async function reclassifyEmails() {
  console.log('Starting email re-classification (Pending + ClientInbox + Uncertain)...\n');

  // Find all Pending, ClientInbox and Uncertain emails
  const emailsToProcess = await prisma.email.findMany({
    where: {
      classificationState: {
        in: [
          EmailClassificationState.Pending,
          EmailClassificationState.ClientInbox,
          EmailClassificationState.Uncertain,
        ],
      },
      caseId: null,
    },
    select: {
      id: true,
      conversationId: true,
      subject: true,
      bodyPreview: true,
      from: true,
      toRecipients: true,
      ccRecipients: true,
      receivedDateTime: true,
      firmId: true,
      clientId: true,
      userId: true,
    },
  });

  console.log(
    `Found ${emailsToProcess.length} emails to process (Pending + ClientInbox + Uncertain)\n`
  );

  if (emailsToProcess.length === 0) {
    console.log('No emails to process. Done!');
    return;
  }

  let classifiedCount = 0;
  let clientInboxCount = 0;
  let uncertainCount = 0;
  let errorCount = 0;

  for (const email of emailsToProcess) {
    try {
      // Build email object for classification
      const emailForClassify: EmailForClassification = {
        id: email.id,
        conversationId: email.conversationId,
        subject: email.subject || '',
        bodyPreview: email.bodyPreview || '',
        from: email.from as { name?: string; address: string },
        toRecipients: (email.toRecipients as Array<{ name?: string; address: string }>) || [],
        ccRecipients: (email.ccRecipients as Array<{ name?: string; address: string }>) || [],
        receivedDateTime: email.receivedDateTime,
      };

      // Run the scoring algorithm
      const result = await classificationScoringService.classifyEmail(
        emailForClassify,
        email.firmId,
        email.userId
      );

      if (result.state === EmailClassificationState.Classified && result.caseId) {
        // Confident assignment - assign to the recommended case
        await prisma.email.update({
          where: { id: email.id },
          data: {
            caseId: result.caseId,
            clientId: null, // Clear clientId since email is now assigned to case
            classificationState: EmailClassificationState.Classified,
            classificationConfidence: result.confidence,
            classifiedAt: new Date(),
            classifiedBy: 'auto_reclassification',
          },
        });
        classifiedCount++;
        console.log(
          `✓ Classified email ${email.id} → case ${result.caseId} (confidence: ${result.confidence.toFixed(2)})`
        );
      } else if (result.state === EmailClassificationState.ClientInbox && result.clientId) {
        // Multi-case client - route to ClientInbox
        await prisma.email.update({
          where: { id: email.id },
          data: {
            clientId: result.clientId,
            classificationState: EmailClassificationState.ClientInbox,
            classifiedAt: new Date(),
            classifiedBy: 'auto_reclassification',
          },
        });
        clientInboxCount++;
        if (clientInboxCount <= 20 || clientInboxCount % 100 === 0) {
          console.log(
            `◐ ClientInbox email ${email.id} → client ${result.clientId} (${result.reason})`
          );
        }
      } else {
        // Still uncertain - update state
        await prisma.email.update({
          where: { id: email.id },
          data: {
            classificationState: EmailClassificationState.Uncertain,
            classifiedAt: new Date(),
            classifiedBy: 'auto_reclassification',
          },
        });
        uncertainCount++;
        if (uncertainCount <= 20 || uncertainCount % 100 === 0) {
          console.log(`○ Uncertain email ${email.id} (${result.reason || 'no confident match'})`);
        }
      }
    } catch (err) {
      errorCount++;
      console.error(`✗ Error processing email ${email.id}:`, err);
    }

    // Progress indicator
    const processed = classifiedCount + clientInboxCount + uncertainCount + errorCount;
    if (processed % 100 === 0) {
      console.log(`... processed ${processed}/${emailsToProcess.length} emails`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total processed: ${emailsToProcess.length}`);
  console.log(`Auto-classified to cases: ${classifiedCount}`);
  console.log(`Routed to ClientInbox: ${clientInboxCount}`);
  console.log(`Remain uncertain: ${uncertainCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run the script
reclassifyEmails()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
