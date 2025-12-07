/**
 * Script to recover the large PST import session
 * Run via: pnpm --filter @legal-platform/legacy-import tsx scripts/recover-session.ts
 *
 * This recreates the LegacyImportSession record for the 47GB PST file
 * that exists in R2 but was lost when the database was reset.
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const SESSION_ID = '95666859-4bd0-4fc6-b4fb-9428fc7442c1';
const PST_FILE_NAME = 'backup email valentin.pst';
const PST_FILE_SIZE = BigInt(Math.round(47.3 * 1024 * 1024 * 1024)); // 47.30 GB in bytes
const PST_STORAGE_PATH = `pst/${SESSION_ID}/${PST_FILE_NAME}`;

async function main() {
  console.log('Recovering PST import session...');

  // Get firm
  const firm = await prisma.firm.findFirst();
  if (!firm) {
    console.error('ERROR: No firm found in database. Please create a firm first.');
    process.exit(1);
  }
  console.log(`Found firm: ${firm.name} (${firm.id})`);

  // Get Partner user (for uploadedBy)
  const user = await prisma.user.findFirst({ where: { role: 'Partner' } });
  if (!user) {
    console.error('ERROR: No Partner user found. Please create a user first.');
    process.exit(1);
  }
  console.log(`Found Partner: ${user.email} (${user.id})`);

  // Check if session already exists
  const existingSession = await prisma.legacyImportSession.findUnique({
    where: { id: SESSION_ID },
  });

  if (existingSession) {
    console.log('Session already exists:');
    console.log(`  Status: ${existingSession.status}`);
    console.log(`  Total Documents: ${existingSession.totalDocuments}`);
    console.log(`  Categorized: ${existingSession.categorizedCount}`);
    process.exit(0);
  }

  // Create the session
  const session = await prisma.legacyImportSession.create({
    data: {
      id: SESSION_ID,
      firmId: firm.id,
      pstFileName: PST_FILE_NAME,
      pstFileSize: PST_FILE_SIZE,
      pstStoragePath: PST_STORAGE_PATH,
      uploadedBy: user.id,
      status: 'Uploading', // Will change to Extracting when extraction starts
      totalDocuments: 0,
      categorizedCount: 0,
      skippedCount: 0,
      analyzedCount: 0,
    },
  });

  console.log('\nSession created successfully!');
  console.log(`  ID: ${session.id}`);
  console.log(`  PST File: ${session.pstFileName}`);
  console.log(`  Size: ${Number(session.pstFileSize) / (1024 * 1024 * 1024)} GB`);
  console.log(`  Status: ${session.status}`);
  console.log(`  Storage Path: ${session.pstStoragePath}`);

  console.log('\nNext steps:');
  console.log('1. Go to the legacy import UI');
  console.log('2. The session should appear in the list');
  console.log('3. Start the extraction process');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
