/**
 * OPS-199: Production Data Reset - Full Wipe & Fresh Start
 *
 * DESTRUCTIVE OPERATION - This script permanently deletes all business data.
 *
 * What gets DELETED:
 *   - Cases and all related data (team, actors, audit logs, summaries, etc.)
 *   - Clients
 *   - Documents (DB records only - SharePoint files should be archived first)
 *   - Emails and attachments
 *   - Tasks and related data
 *   - AI Conversations and messages
 *   - All extracted items (deadlines, action items, etc.)
 *   - Communication entries
 *   - Thread summaries
 *   - Mapa and related data
 *
 * What gets PRESERVED:
 *   - Users
 *   - Firms
 *   - PersonalContacts (user blocklist preferences)
 *   - EmailSyncState (sync can continue from where it left off)
 *   - UserAuditLog, UserWorkloadSettings, UserSkill, etc.
 *
 * Usage:
 *   source .env.prod && npx tsx scripts/migrations/full-data-reset.ts
 *   source .env.prod && npx tsx scripts/migrations/full-data-reset.ts --dry-run
 *
 * Prerequisites:
 *   1. Take a database backup first!
 *   2. Archive SharePoint files (run archive-sharepoint.ts)
 *   3. Notify team of maintenance window
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================================
// Helpers
// ============================================================================

async function countBefore() {
  const counts = {
    cases: await prisma.case.count(),
    clients: await prisma.client.count(),
    documents: await prisma.document.count(),
    emails: await prisma.email.count(),
    emailAttachments: await prisma.emailAttachment.count(),
    emailCaseLinks: await prisma.emailCaseLink.count(),
    tasks: await prisma.task.count(),
    aiConversations: await prisma.aIConversation.count(),
    aiMessages: await prisma.aIMessage.count(),
    communicationEntries: await prisma.communicationEntry.count(),
    threadSummaries: await prisma.threadSummary.count(),
    caseSummaries: await prisma.caseSummary.count(),
    mape: await prisma.mapa.count(),
    // Preserved
    users: await prisma.user.count(),
    firms: await prisma.firm.count(),
    personalContacts: await prisma.personalContact.count(),
  };
  return counts;
}

async function deleteInOrder() {
  console.log('\n--- Deleting data in dependency order ---\n');

  // Layer 1: Deepest dependencies (no FK constraints pointing to them)
  console.log('Layer 1: AI & Analysis data...');
  await prisma.aIMessage.deleteMany({});
  await prisma.aIConversation.deleteMany({});
  await prisma.threadSummary.deleteMany({});
  await prisma.caseSummary.deleteMany({});
  await prisma.caseBriefing.deleteMany({});
  await prisma.userDailyContext.deleteMany({});
  await prisma.userActivityEvent.deleteMany({});

  // Layer 2: Mapa data
  console.log('Layer 2: Mapa data...');
  await prisma.mapaSlot.deleteMany({});
  await prisma.mapa.deleteMany({});
  await prisma.mapaTemplate.deleteMany({});

  // Layer 3: Communication entries
  console.log('Layer 3: Communication entries...');
  await prisma.communicationAttachment.deleteMany({});
  await prisma.communicationEntry.deleteMany({});
  await prisma.communicationExport.deleteMany({});
  await prisma.bulkCommunicationLog.deleteMany({});
  await prisma.bulkCommunication.deleteMany({});
  await prisma.communicationTemplate.deleteMany({});

  // Layer 4: Email-related extracted items
  console.log('Layer 4: Email extracted items...');
  await prisma.extractedDeadline.deleteMany({});
  await prisma.extractedCommitment.deleteMany({});
  await prisma.extractedActionItem.deleteMany({});
  await prisma.extractedQuestion.deleteMany({});
  await prisma.riskIndicator.deleteMany({});

  // Layer 5: Email drafts and suggestions
  console.log('Layer 5: Email drafts and suggestions...');
  await prisma.attachmentSuggestion.deleteMany({});
  await prisma.emailDraft.deleteMany({});
  await prisma.suggestionFeedback.deleteMany({});
  await prisma.aISuggestion.deleteMany({});
  await prisma.morningBriefing.deleteMany({});
  await prisma.documentCompletenessCheck.deleteMany({});

  // Layer 6: Email case links and attachments
  console.log('Layer 6: Email links and attachments...');
  await prisma.emailCaseLink.deleteMany({});
  await prisma.emailAttachment.deleteMany({});
  await prisma.emailClassificationLog.deleteMany({});
  await prisma.pendingClassification.deleteMany({});

  // Layer 7: Emails
  console.log('Layer 7: Emails...');
  await prisma.email.deleteMany({});

  // Layer 8: Task-related data
  console.log('Layer 8: Task data...');
  await prisma.taskAttachment.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.taskHistory.deleteMany({});
  await prisma.taskAttendee.deleteMany({});
  await prisma.taskDocumentLink.deleteMany({});
  await prisma.taskDelegation.deleteMany({});
  await prisma.taskDependency.deleteMany({});
  await prisma.taskTemplateUsage.deleteMany({});
  await prisma.delegationHandoff.deleteMany({});
  await prisma.delegationAnalytics.deleteMany({});
  await prisma.taskAnalyticsSnapshot.deleteMany({});
  await prisma.taskPatternAnalysis.deleteMany({});
  await prisma.automationROIMetrics.deleteMany({});

  // Layer 9: Tasks
  console.log('Layer 9: Tasks...');
  await prisma.task.deleteMany({});

  // Layer 10: Time entries (depends on cases and tasks)
  console.log('Layer 10: Time entries...');
  await prisma.timeEntry.deleteMany({});

  // Layer 11: Document-related data
  console.log('Layer 11: Document data...');
  await prisma.documentEditSession.deleteMany({});
  await prisma.reviewCommentReply.deleteMany({});
  await prisma.reviewComment.deleteMany({});
  await prisma.aIReviewConcern.deleteMany({});
  await prisma.reviewHistory.deleteMany({});
  await prisma.documentReview.deleteMany({});
  await prisma.batchReview.deleteMany({});
  await prisma.semanticChange.deleteMany({});
  await prisma.versionComparisonCache.deleteMany({});
  await prisma.documentVersion.deleteMany({});
  await prisma.documentAuditLog.deleteMany({});
  await prisma.caseDocument.deleteMany({});
  await prisma.documentFolder.deleteMany({});

  // Layer 12: Documents
  console.log('Layer 12: Documents...');
  await prisma.document.deleteMany({});

  // Layer 13: Case-related data
  console.log('Layer 13: Case data...');
  await prisma.caseActivityEntry.deleteMany({});
  await prisma.caseSubscription.deleteMany({});
  await prisma.caseApproval.deleteMany({});
  await prisma.caseRateHistory.deleteMany({});
  await prisma.caseAuditLog.deleteMany({});
  await prisma.caseActor.deleteMany({});
  await prisma.caseTeam.deleteMany({});
  await prisma.retainerPeriodUsage.deleteMany({});

  // Layer 14: Cases
  console.log('Layer 14: Cases...');
  await prisma.case.deleteMany({});

  // Layer 15: Clients
  console.log('Layer 15: Clients...');
  await prisma.client.deleteMany({});

  // Layer 16: Notifications (case-related)
  console.log('Layer 16: Notifications...');
  await prisma.notification.deleteMany({});
  await prisma.inAppNotification.deleteMany({});
  await prisma.digestQueue.deleteMany({});

  // Layer 17: Global email sources
  console.log('Layer 17: Global email sources...');
  await prisma.globalEmailSource.deleteMany({});

  console.log('\nDeletion complete.');
}

async function countAfter() {
  const counts = {
    cases: await prisma.case.count(),
    clients: await prisma.client.count(),
    documents: await prisma.document.count(),
    emails: await prisma.email.count(),
    tasks: await prisma.task.count(),
    aiConversations: await prisma.aIConversation.count(),
    // Preserved
    users: await prisma.user.count(),
    firms: await prisma.firm.count(),
    personalContacts: await prisma.personalContact.count(),
  };
  return counts;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('========================================');
  console.log('OPS-199: PRODUCTION DATA RESET');
  console.log('========================================\n');

  if (DRY_RUN) {
    console.log('*** DRY RUN MODE - No changes will be made ***\n');
  } else {
    console.log('*** LIVE MODE - DATA WILL BE PERMANENTLY DELETED ***\n');
  }

  // 1. Count before
  console.log('--- Current Data Counts ---\n');
  const before = await countBefore();

  console.log('To be DELETED:');
  console.log(`  Cases:             ${before.cases}`);
  console.log(`  Clients:           ${before.clients}`);
  console.log(`  Documents:         ${before.documents}`);
  console.log(`  Emails:            ${before.emails}`);
  console.log(`  EmailAttachments:  ${before.emailAttachments}`);
  console.log(`  EmailCaseLinks:    ${before.emailCaseLinks}`);
  console.log(`  Tasks:             ${before.tasks}`);
  console.log(`  AI Conversations:  ${before.aiConversations}`);
  console.log(`  AI Messages:       ${before.aiMessages}`);
  console.log(`  Comm Entries:      ${before.communicationEntries}`);
  console.log(`  Thread Summaries:  ${before.threadSummaries}`);
  console.log(`  Case Summaries:    ${before.caseSummaries}`);
  console.log(`  Mape:              ${before.mape}`);

  console.log('\nTo be PRESERVED:');
  console.log(`  Users:             ${before.users}`);
  console.log(`  Firms:             ${before.firms}`);
  console.log(`  PersonalContacts:  ${before.personalContacts}`);

  if (DRY_RUN) {
    console.log('\n*** DRY RUN - Skipping deletion ***');
    console.log('Run without --dry-run to execute.');
    return;
  }

  // Safety: Wait 5 seconds before proceeding
  console.log('\n>>> PROCEEDING IN 5 SECONDS - Ctrl+C to cancel <<<\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 2. Delete in order
  await deleteInOrder();

  // 3. Verify
  console.log('\n--- Verification ---\n');
  const after = await countAfter();

  console.log('After reset:');
  console.log(`  Cases:             ${after.cases} (should be 0)`);
  console.log(`  Clients:           ${after.clients} (should be 0)`);
  console.log(`  Documents:         ${after.documents} (should be 0)`);
  console.log(`  Emails:            ${after.emails} (should be 0)`);
  console.log(`  Tasks:             ${after.tasks} (should be 0)`);
  console.log(`  AI Conversations:  ${after.aiConversations} (should be 0)`);

  console.log('\nPreserved:');
  console.log(`  Users:             ${after.users}`);
  console.log(`  Firms:             ${after.firms}`);
  console.log(`  PersonalContacts:  ${after.personalContacts}`);

  // Validation
  const success =
    after.cases === 0 &&
    after.clients === 0 &&
    after.documents === 0 &&
    after.emails === 0 &&
    after.tasks === 0 &&
    after.aiConversations === 0 &&
    after.users > 0 &&
    after.firms > 0;

  console.log('\n========================================');
  if (success) {
    console.log('RESET COMPLETE - SUCCESS');
  } else {
    console.log('RESET COMPLETE - VERIFICATION FAILED');
    console.log('Some data may not have been deleted.');
  }
  console.log('========================================');

  console.log('\nNext steps:');
  console.log('1. Users can now sync emails from Outlook');
  console.log('2. Emails will arrive with classificationState: Pending');
  console.log('3. New classification UX will handle sorting');
}

main()
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
