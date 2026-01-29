#!/usr/bin/env npx ts-node
/**
 * Migration script: Migrate existing context data to unified system
 *
 * This script:
 * 1. Creates placeholder ContextFile records for all clients and cases
 * 2. Preserves any existing user corrections from CaseBriefing
 * 3. Context files will be fully generated on first access (lazy generation)
 *
 * Run with: npx ts-node scripts/migrate-context-files.ts
 * Or with pnpm: pnpm --filter gateway exec ts-node ../../scripts/migrate-context-files.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('====================================================');
  console.log('Starting Unified Context Migration');
  console.log('====================================================\n');

  const startTime = Date.now();

  // 1. Get counts
  const clientCount = await prisma.client.count();
  const caseCount = await prisma.case.count();

  console.log(`Found ${clientCount} clients and ${caseCount} cases to migrate.\n`);

  // 2. Migrate user corrections from CaseBriefing if present
  console.log('Step 1: Checking for existing corrections in CaseBriefing...');

  const briefingsWithCorrections = await prisma.caseBriefing.findMany({
    where: {
      userCorrections: { not: null },
    },
    select: {
      caseId: true,
      userCorrections: true,
      lastCorrectedBy: true,
    },
  });

  console.log(`  Found ${briefingsWithCorrections.length} briefings with corrections.\n`);

  // 3. Create or update ContextFiles for these cases first (to preserve corrections)
  if (briefingsWithCorrections.length > 0) {
    console.log('Step 2: Preserving corrections in new ContextFile records...');

    let correctionsPreserved = 0;
    for (const briefing of briefingsWithCorrections) {
      const caseData = await prisma.case.findUnique({
        where: { id: briefing.caseId },
        select: { firmId: true },
      });

      if (caseData) {
        // Check if unified context file already exists
        const existingFile = await prisma.contextFile.findFirst({
          where: { caseId: briefing.caseId },
        });

        if (!existingFile) {
          // Create a placeholder with corrections preserved
          // The actual context will be generated when getCaseContext is called
          try {
            await prisma.contextFile.create({
              data: {
                firmId: caseData.firmId,
                entityType: 'CASE',
                caseId: briefing.caseId,
                identity: {},
                people: {},
                documents: { items: [], totalCount: 0, hasMore: false },
                communications: {
                  overview: '',
                  threads: [],
                  emails: [],
                  totalThreads: 0,
                  unreadCount: 0,
                  urgentCount: 0,
                  pendingActions: [],
                },
                userCorrections: briefing.userCorrections,
                lastCorrectedBy: briefing.lastCorrectedBy,
                contentCritical: '',
                contentStandard: '',
                contentFull: '',
                tokensCritical: 0,
                tokensStandard: 0,
                tokensFull: 0,
                version: 0, // Will be set to 1 on first actual generation
                generatedAt: new Date(),
                validUntil: new Date(0), // Epoch - forces regeneration on first access
              },
            });
            correctionsPreserved++;
            console.log(`  Created placeholder for case ${briefing.caseId} with corrections`);
          } catch (error: any) {
            console.error(
              `  Failed to create placeholder for case ${briefing.caseId}: ${error.message}`
            );
          }
        }
      }
    }
    console.log(`  Done preserving corrections. ${correctionsPreserved} placeholders created.\n`);
  }

  // 4. Regenerate all client contexts
  console.log('Step 3: Regenerating client contexts...');
  console.log('  (This may take a while for large datasets)\n');

  let clientsProcessed = 0;
  let clientsSuccessful = 0;
  let clientsFailed = 0;

  const clients = await prisma.client.findMany({
    select: { id: true, firmId: true, name: true },
  });

  for (const client of clients) {
    try {
      // Check if context file already exists
      const existingFile = await prisma.contextFile.findFirst({
        where: { clientId: client.id },
      });

      if (!existingFile) {
        // Create a minimal context file - the actual content will be generated on first access
        await prisma.contextFile.create({
          data: {
            firmId: client.firmId,
            entityType: 'CLIENT',
            clientId: client.id,
            identity: {},
            people: {},
            documents: { items: [], totalCount: 0, hasMore: false },
            communications: {
              overview: '',
              threads: [],
              emails: [],
              totalThreads: 0,
              unreadCount: 0,
              urgentCount: 0,
              pendingActions: [],
            },
            contentCritical: '',
            contentStandard: '',
            contentFull: '',
            tokensCritical: 0,
            tokensStandard: 0,
            tokensFull: 0,
            version: 0, // Will be set to 1 on first actual generation
            generatedAt: new Date(),
            validUntil: new Date(0), // Epoch - forces regeneration on first access
          },
        });
      }

      clientsSuccessful++;
    } catch (error: any) {
      console.error(`  Failed for client ${client.id} (${client.name}): ${error.message}`);
      clientsFailed++;
    }

    clientsProcessed++;
    if (clientsProcessed % 10 === 0) {
      console.log(`  Processed ${clientsProcessed}/${clients.length} clients...`);
    }
  }

  console.log(
    `\n  Clients: ${clientsSuccessful} successful, ${clientsFailed} failed out of ${clients.length}\n`
  );

  // 5. Regenerate all case contexts
  console.log('Step 4: Regenerating case contexts...');
  console.log('  (This may take a while for large datasets)\n');

  let casesProcessed = 0;
  let casesSuccessful = 0;
  let casesFailed = 0;

  const cases = await prisma.case.findMany({
    select: { id: true, firmId: true, caseNumber: true },
  });

  for (const caseData of cases) {
    try {
      // Check if context file already exists
      const existingFile = await prisma.contextFile.findFirst({
        where: { caseId: caseData.id },
      });

      if (!existingFile) {
        // Find any corrections from CaseBriefing
        const briefing = briefingsWithCorrections.find((b) => b.caseId === caseData.id);
        const corrections = briefing?.userCorrections ?? null;

        // Create a minimal context file - the actual content will be generated on first access
        await prisma.contextFile.create({
          data: {
            firmId: caseData.firmId,
            entityType: 'CASE',
            caseId: caseData.id,
            identity: {},
            people: {},
            documents: { items: [], totalCount: 0, hasMore: false },
            communications: {
              overview: '',
              threads: [],
              emails: [],
              totalThreads: 0,
              unreadCount: 0,
              urgentCount: 0,
              pendingActions: [],
            },
            userCorrections: corrections,
            contentCritical: '',
            contentStandard: '',
            contentFull: '',
            tokensCritical: 0,
            tokensStandard: 0,
            tokensFull: 0,
            version: 0, // Will be set to 1 on first actual generation
            generatedAt: new Date(),
            validUntil: new Date(0), // Epoch - forces regeneration on first access
          },
        });
      }

      casesSuccessful++;
    } catch (error: any) {
      console.error(`  Failed for case ${caseData.id} (${caseData.caseNumber}): ${error.message}`);
      casesFailed++;
    }

    casesProcessed++;
    if (casesProcessed % 10 === 0) {
      console.log(`  Processed ${casesProcessed}/${cases.length} cases...`);
    }
  }

  console.log(
    `\n  Cases: ${casesSuccessful} successful, ${casesFailed} failed out of ${cases.length}\n`
  );

  // Summary
  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log('====================================================');
  console.log('Migration Complete');
  console.log('====================================================');
  console.log(`Duration: ${duration} seconds`);
  console.log(`Clients: ${clientsSuccessful}/${clients.length} migrated`);
  console.log(`Cases: ${casesSuccessful}/${cases.length} migrated`);
  console.log(`Corrections preserved: ${briefingsWithCorrections.length}`);

  console.log('\nNext steps:');
  console.log('1. Context files will be fully generated on first access');
  console.log('2. Test the unified context queries:');
  console.log('   - unifiedCaseContext(caseId: "...", tier: "full")');
  console.log('   - unifiedClientContext(clientId: "...", tier: "full")');
  console.log('   - wordAddinContext(caseId: "...")');
  console.log('3. Monitor logs for any generation errors');

  // Exit with error if any migrations failed
  if (clientsFailed > 0 || casesFailed > 0) {
    console.log('\n⚠️  Some migrations failed. Check the logs above for details.');
    console.log(
      'Note: Failed records will be regenerated on first access, but review errors before proceeding.'
    );
    process.exit(1);
  }
}

migrate()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
