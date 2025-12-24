#!/usr/bin/env npx ts-node
/**
 * OPS-171: Backfill script for document source types
 *
 * This script updates existing documents to have the correct sourceType:
 * - Documents linked from EmailAttachment get sourceType = EMAIL_ATTACHMENT
 * - Documents created by AI drafting get sourceType = AI_GENERATED
 * - Other documents remain as UPLOAD (the default)
 *
 * Run with: npx ts-node scripts/backfill-document-source-types.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillDocumentSourceTypes() {
  console.log('Starting document source type backfill...\n');

  // 1. Find documents that have EmailAttachment links pointing to them
  console.log('Step 1: Finding documents created from email attachments...');

  const emailAttachmentDocIds = await prisma.emailAttachment.findMany({
    where: {
      documentId: { not: null },
    },
    select: {
      documentId: true,
    },
  });

  const documentIdsFromAttachments = emailAttachmentDocIds
    .map((a) => a.documentId)
    .filter((id): id is string => id !== null);

  console.log(`  Found ${documentIdsFromAttachments.length} documents from email attachments`);

  if (documentIdsFromAttachments.length > 0) {
    const updateResult = await prisma.document.updateMany({
      where: {
        id: { in: documentIdsFromAttachments },
        sourceType: 'UPLOAD', // Only update if still set to default
      },
      data: {
        sourceType: 'EMAIL_ATTACHMENT',
      },
    });

    console.log(`  Updated ${updateResult.count} documents to sourceType=EMAIL_ATTACHMENT\n`);
  }

  // 2. Find documents created by AI (based on metadata or fileName patterns)
  console.log('Step 2: Finding AI-generated documents...');

  // Look for documents with AI-related metadata or naming patterns
  const aiGeneratedDocs = await prisma.document.findMany({
    where: {
      OR: [
        // Documents with AI generation metadata
        { metadata: { path: ['generatedBy'], equals: 'AI' } },
        { metadata: { path: ['aiGenerated'], equals: true } },
        // Documents with common AI-generated file name patterns
        { fileName: { startsWith: 'draft_' } },
        { fileName: { contains: '_ai_' } },
      ],
      sourceType: 'UPLOAD', // Only update if still set to default
    },
    select: { id: true },
  });

  console.log(`  Found ${aiGeneratedDocs.length} potentially AI-generated documents`);

  if (aiGeneratedDocs.length > 0) {
    const aiDocIds = aiGeneratedDocs.map((d) => d.id);

    const aiUpdateResult = await prisma.document.updateMany({
      where: {
        id: { in: aiDocIds },
      },
      data: {
        sourceType: 'AI_GENERATED',
      },
    });

    console.log(`  Updated ${aiUpdateResult.count} documents to sourceType=AI_GENERATED\n`);
  }

  // 3. Summary
  console.log('Step 3: Generating summary...');

  const sourceCounts = await prisma.document.groupBy({
    by: ['sourceType'],
    _count: true,
  });

  console.log('\nDocument source type distribution:');
  for (const row of sourceCounts) {
    console.log(`  ${row.sourceType}: ${row._count}`);
  }

  console.log('\nBackfill complete!');
}

async function main() {
  try {
    await backfillDocumentSourceTypes();
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
