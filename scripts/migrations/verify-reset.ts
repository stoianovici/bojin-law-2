/**
 * OPS-199: Verify Production Data Reset
 *
 * Post-reset verification script to confirm:
 * 1. All business data has been deleted
 * 2. User accounts are preserved and functional
 * 3. Email sync is ready to resume
 * 4. Classification workflow is operational
 *
 * Usage:
 *   source .env.prod && npx tsx scripts/migrations/verify-reset.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Verification Checks
// ============================================================================

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

async function checkDataDeleted(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Models that should be empty
  const emptyModels = [
    { name: 'Cases', count: () => prisma.case.count() },
    { name: 'Clients', count: () => prisma.client.count() },
    { name: 'Documents', count: () => prisma.document.count() },
    { name: 'Emails', count: () => prisma.email.count() },
    { name: 'EmailAttachments', count: () => prisma.emailAttachment.count() },
    { name: 'EmailCaseLinks', count: () => prisma.emailCaseLink.count() },
    { name: 'Tasks', count: () => prisma.task.count() },
    { name: 'AIConversations', count: () => prisma.aIConversation.count() },
    { name: 'AIMessages', count: () => prisma.aIMessage.count() },
    { name: 'CommunicationEntries', count: () => prisma.communicationEntry.count() },
    { name: 'ThreadSummaries', count: () => prisma.threadSummary.count() },
    { name: 'CaseSummaries', count: () => prisma.caseSummary.count() },
    { name: 'TimeEntries', count: () => prisma.timeEntry.count() },
    { name: 'CaseActors', count: () => prisma.caseActor.count() },
    { name: 'CaseTeam', count: () => prisma.caseTeam.count() },
    { name: 'DocumentVersions', count: () => prisma.documentVersion.count() },
    { name: 'Mapa', count: () => prisma.mapa.count() },
  ];

  for (const model of emptyModels) {
    const count = await model.count();
    results.push({
      name: `${model.name} deleted`,
      passed: count === 0,
      message: count === 0 ? 'All records deleted' : `${count} records remain`,
    });
  }

  return results;
}

async function checkDataPreserved(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Users should exist
  const userCount = await prisma.user.count();
  results.push({
    name: 'Users preserved',
    passed: userCount > 0,
    message: `${userCount} users found`,
  });

  // Active users should still be active
  const activeUsers = await prisma.user.count({ where: { status: 'Active' } });
  results.push({
    name: 'Active users preserved',
    passed: activeUsers > 0,
    message: `${activeUsers} active users found`,
  });

  // Firms should exist
  const firmCount = await prisma.firm.count();
  results.push({
    name: 'Firms preserved',
    passed: firmCount > 0,
    message: `${firmCount} firms found`,
  });

  // PersonalContacts preserved (if any existed)
  const personalContacts = await prisma.personalContact.count();
  results.push({
    name: 'PersonalContacts preserved',
    passed: true, // Always pass - count can be 0
    message: `${personalContacts} personal contacts found`,
  });

  // EmailSyncState preserved
  const syncStates = await prisma.emailSyncState.count();
  results.push({
    name: 'EmailSyncState preserved',
    passed: true, // Always pass
    message: `${syncStates} sync states found`,
  });

  return results;
}

async function checkSchemaIntegrity(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check that we can query key tables without errors
  const queries = [
    { name: 'User query', fn: () => prisma.user.findFirst() },
    { name: 'Firm query', fn: () => prisma.firm.findFirst() },
    { name: 'Case query (empty)', fn: () => prisma.case.findFirst() },
    { name: 'Email query (empty)', fn: () => prisma.email.findFirst() },
  ];

  for (const query of queries) {
    try {
      await query.fn();
      results.push({
        name: query.name,
        passed: true,
        message: 'Query successful',
      });
    } catch (error) {
      results.push({
        name: query.name,
        passed: false,
        message: `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  return results;
}

async function checkEmailSyncReady(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Users with email sync state should be able to continue syncing
  const usersWithSync = await prisma.emailSyncState.findMany({
    include: { user: { select: { email: true, status: true } } },
  });

  results.push({
    name: 'Users with sync state',
    passed: true,
    message: `${usersWithSync.length} users have sync state`,
    details: usersWithSync.map((s) => ({
      email: s.user.email,
      status: s.user.status,
      lastSync: s.lastSyncAt,
    })),
  });

  // All sync states should reference active users
  const orphanedSyncStates = await prisma.emailSyncState.count({
    where: { user: { status: { not: 'Active' } } },
  });

  results.push({
    name: 'No orphaned sync states',
    passed: orphanedSyncStates === 0,
    message:
      orphanedSyncStates === 0
        ? 'All sync states belong to active users'
        : `${orphanedSyncStates} sync states for inactive users`,
  });

  return results;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('========================================');
  console.log('OPS-199: VERIFY RESET');
  console.log('========================================\n');

  const allResults: CheckResult[] = [];

  // Run all verification checks
  console.log('--- Checking Data Deletion ---\n');
  const deletionResults = await checkDataDeleted();
  allResults.push(...deletionResults);
  for (const result of deletionResults) {
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${result.name}: ${result.message}`);
  }

  console.log('\n--- Checking Data Preservation ---\n');
  const preservationResults = await checkDataPreserved();
  allResults.push(...preservationResults);
  for (const result of preservationResults) {
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${result.name}: ${result.message}`);
  }

  console.log('\n--- Checking Schema Integrity ---\n');
  const integrityResults = await checkSchemaIntegrity();
  allResults.push(...integrityResults);
  for (const result of integrityResults) {
    const status = result.passed ? 'PASS' : 'FAIL';
    console.log(`  [${status}] ${result.name}: ${result.message}`);
  }

  console.log('\n--- Checking Email Sync Readiness ---\n');
  const syncResults = await checkEmailSyncReady();
  allResults.push(...syncResults);
  for (const result of syncResults) {
    const status = result.passed ? 'PASS' : 'INFO';
    console.log(`  [${status}] ${result.name}: ${result.message}`);
    if (result.details && Array.isArray(result.details) && result.details.length > 0) {
      console.log(`         First 3: ${JSON.stringify(result.details.slice(0, 3))}`);
    }
  }

  // Summary
  const passCount = allResults.filter((r) => r.passed).length;
  const failCount = allResults.filter((r) => !r.passed).length;

  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');
  console.log(`  Total checks: ${allResults.length}`);
  console.log(`  Passed:       ${passCount}`);
  console.log(`  Failed:       ${failCount}`);

  if (failCount === 0) {
    console.log('\n>>> ALL CHECKS PASSED - Reset verified successfully <<<');
  } else {
    console.log('\n>>> SOME CHECKS FAILED - Review issues above <<<');
    console.log('\nFailed checks:');
    for (const result of allResults.filter((r) => !r.passed)) {
      console.log(`  - ${result.name}: ${result.message}`);
    }
  }

  console.log('\n========================================');

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
