/**
 * Recover Batch Results Script
 *
 * Fetches results from completed Anthropic batches and writes them to the database.
 * Use when the pipeline was terminated before results could be saved.
 *
 * Usage: pnpm --filter legacy-import exec tsx src/scripts/recover-batch-results.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient, TriageStatus } from '../generated/prisma';

const prisma = new PrismaClient();
const anthropic = new Anthropic();

// Batch IDs from the terminated pipeline
const BATCH_IDS = [
  'msgbatch_014EmgEQibKKxFrGuoqs5JAv', // 10,000 succeeded
  'msgbatch_014wU7hJtsLsLVBNgxNzR8Q3', // 8,538 succeeded, 1,462 errored
  'msgbatch_012u6wXJ2uPLny8ySsAZu8H1', // 8,584 succeeded
];

const SESSION_ID = '8267942a-3721-4956-b866-3aad8e56a1bb';

interface TriageResult {
  documentId: string;
  status: TriageStatus;
  confidence: number;
  reason: string;
  suggestedDocType: string | null;
}

function parseStatus(status: string): TriageStatus {
  const statusMap: Record<string, TriageStatus> = {
    FirmDrafted: 'FirmDrafted',
    ThirdParty: 'ThirdParty',
    Irrelevant: 'Irrelevant',
    CourtDoc: 'CourtDoc',
    Uncertain: 'Uncertain',
  };
  return statusMap[status] || 'Uncertain';
}

async function recoverBatch(batchId: string): Promise<TriageResult[]> {
  console.log(`\n📦 Processing batch: ${batchId}`);

  // Check batch status
  const status = await anthropic.messages.batches.retrieve(batchId);
  console.log(`   Status: ${status.processing_status}`);
  console.log(
    `   Succeeded: ${status.request_counts.succeeded}, Errored: ${status.request_counts.errored}`
  );

  if (status.processing_status !== 'ended') {
    console.log(`   ⚠️  Batch not completed, skipping`);
    return [];
  }

  // Retrieve results
  const results: TriageResult[] = [];
  const resultsStream = await anthropic.messages.batches.results(batchId);

  let processed = 0;
  for await (const result of resultsStream) {
    processed++;
    if (processed % 1000 === 0) {
      console.log(`   Processing: ${processed} results...`);
    }

    const documentId = result.custom_id.replace('doc_', '');

    if (result.result.type === 'succeeded' && result.result.message) {
      const textContent = result.result.message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      try {
        // Extract JSON from response (may be wrapped in markdown code blocks)
        let jsonText = textContent;
        const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        } else {
          // Try to find raw JSON object
          const objectMatch = textContent.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            jsonText = objectMatch[0];
          }
        }

        const parsed = JSON.parse(jsonText);
        results.push({
          documentId,
          status: parseStatus(parsed.status),
          confidence: parsed.confidence || 0.5,
          reason: parsed.reason || '',
          suggestedDocType: parsed.documentType || null,
        });
      } catch {
        // Parsing error - mark as uncertain
        results.push({
          documentId,
          status: 'Uncertain',
          confidence: 0,
          reason: 'Failed to parse AI response',
          suggestedDocType: null,
        });
      }
    } else {
      // Error - mark as uncertain
      results.push({
        documentId,
        status: 'Uncertain',
        confidence: 0,
        reason: `Batch error: ${result.result.type}`,
        suggestedDocType: null,
      });
    }
  }

  console.log(`   ✅ Retrieved ${results.length} results`);
  return results;
}

async function updateDocuments(results: TriageResult[]): Promise<void> {
  console.log(`\n💾 Writing ${results.length} results to database...`);

  // Batch update in chunks of 100
  const chunkSize = 100;
  let updated = 0;

  for (let i = 0; i < results.length; i += chunkSize) {
    const chunk = results.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map((result) =>
        prisma.extractedDocument.update({
          where: { id: result.documentId },
          data: {
            triageStatus: result.status,
            triageConfidence: result.confidence,
            triageReason: result.reason,
            suggestedDocType: result.suggestedDocType,
          },
        })
      )
    );
    updated += chunk.length;
    if (updated % 1000 === 0) {
      console.log(`   Updated: ${updated}/${results.length}`);
    }
  }

  console.log(`   ✅ Updated ${updated} documents`);
}

async function calculateAndSaveStats(results: TriageResult[]): Promise<void> {
  const stats = {
    total: results.length,
    firmDrafted: 0,
    thirdParty: 0,
    irrelevant: 0,
    courtDoc: 0,
    uncertain: 0,
    errors: 0,
  };

  for (const result of results) {
    switch (result.status) {
      case 'FirmDrafted':
        stats.firmDrafted++;
        break;
      case 'ThirdParty':
        stats.thirdParty++;
        break;
      case 'Irrelevant':
        stats.irrelevant++;
        break;
      case 'CourtDoc':
        stats.courtDoc++;
        break;
      case 'Uncertain':
        stats.uncertain++;
        break;
    }
    if (result.confidence === 0) {
      stats.errors++;
    }
  }

  console.log(`\n📊 Triage Statistics:`);
  console.log(`   Total: ${stats.total}`);
  console.log(`   FirmDrafted: ${stats.firmDrafted}`);
  console.log(`   ThirdParty: ${stats.thirdParty}`);
  console.log(`   Irrelevant: ${stats.irrelevant}`);
  console.log(`   CourtDoc: ${stats.courtDoc}`);
  console.log(`   Uncertain: ${stats.uncertain}`);
  console.log(`   Errors: ${stats.errors}`);

  // Update session
  await prisma.legacyImportSession.update({
    where: { id: SESSION_ID },
    data: {
      triageStats: stats as any,
      pipelineStatus: 'ReadyForValidation',
      pipelineError: null,
    },
  });

  console.log(`   ✅ Session updated`);
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Recover Batch Triage Results                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nSession: ${SESSION_ID}`);

  // Check current status
  const session = await prisma.legacyImportSession.findUnique({
    where: { id: SESSION_ID },
  });

  if (!session) {
    console.error('❌ Session not found');
    process.exit(1);
  }

  console.log(`Current pipeline status: ${session.pipelineStatus}`);

  // Check how many are already triaged
  const alreadyTriaged = await prisma.extractedDocument.count({
    where: {
      sessionId: SESSION_ID,
      triageStatus: { not: null },
    },
  });
  console.log(`Already triaged: ${alreadyTriaged} documents`);

  // Recover all batches
  const allResults: TriageResult[] = [];

  for (const batchId of BATCH_IDS) {
    const results = await recoverBatch(batchId);
    allResults.push(...results);
  }

  console.log(`\n📊 Total results to recover: ${allResults.length}`);

  // Filter out documents that already have triage status
  const existingIds = new Set(
    (
      await prisma.extractedDocument.findMany({
        where: {
          sessionId: SESSION_ID,
          triageStatus: { not: null },
        },
        select: { id: true },
      })
    ).map((d) => d.id)
  );

  const newResults = allResults.filter((r) => !existingIds.has(r.documentId));
  console.log(`   New results (not already triaged): ${newResults.length}`);

  if (newResults.length === 0) {
    console.log('\n✅ No new results to update');
    return;
  }

  // Update documents
  await updateDocuments(newResults);

  // Calculate and save stats
  await calculateAndSaveStats(allResults);

  console.log('\n✅ Recovery complete!');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
