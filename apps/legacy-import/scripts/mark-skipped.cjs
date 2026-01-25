#!/usr/bin/env node
/**
 * Mark scanned and duplicate documents as Skipped
 * Reads from detection results and updates database
 *
 * Usage (from apps/legacy-import directory):
 *   node scripts/mark-skipped.cjs <sessionId>
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'legal_platform',
  user: 'legal_platform',
  password: 'HTdJ9oAafB6uiecJlB3FImEop3hNG3LI',
});

const BATCH_SIZE = 100;

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node scripts/mark-skipped.cjs <sessionId>');
    process.exit(1);
  }

  const sessionId = args[0];
  const summaryFile = path.join(__dirname, '..', 'detection-results', `${sessionId}-summary.json`);

  if (!fs.existsSync(summaryFile)) {
    console.error(`Summary file not found: ${summaryFile}`);
    console.error('Run detect-duplicates.cjs first.');
    process.exit(1);
  }

  console.log(`\n=== Marking Documents as Skipped ===`);

  // Test database connection
  try {
    await pool.query('SELECT 1');
    console.log(`Database connection: OK`);
  } catch (err) {
    console.error(`Database connection failed.`);
    process.exit(1);
  }

  // Read summary file
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
  console.log(`\nStats from detection:`);
  console.log(`  Total documents: ${summary.stats.total}`);
  console.log(`  Scanned: ${summary.stats.scanned}`);
  console.log(`  Duplicates: ${summary.stats.duplicates}`);

  // Combine all IDs to skip
  const allSkipIds = [...new Set([...summary.scannedDocIds, ...summary.duplicateDocIds])];
  console.log(`\nTotal documents to mark as Skipped: ${allSkipIds.length}`);

  // Update in batches
  let updated = 0;
  for (let i = 0; i < allSkipIds.length; i += BATCH_SIZE) {
    const batch = allSkipIds.slice(i, i + BATCH_SIZE);
    await pool.query(
      `UPDATE extracted_documents SET status = 'Skipped' WHERE id = ANY($1)`,
      [batch]
    );
    updated += batch.length;
    if (updated % 1000 === 0 || updated === allSkipIds.length) {
      console.log(`  Updated ${updated}/${allSkipIds.length} documents...`);
    }
  }

  // Verify counts
  const statusCounts = await pool.query(
    `SELECT status, COUNT(*) as count FROM extracted_documents WHERE session_id = $1 GROUP BY status`,
    [sessionId]
  );

  console.log(`\n=== Final Status Counts ===`);
  for (const row of statusCounts.rows) {
    console.log(`  ${row.status}: ${row.count}`);
  }

  const uncategorized = statusCounts.rows.find(r => r.status === 'Uncategorized');
  if (uncategorized) {
    console.log(`\n=== Documents Available for Categorization: ${uncategorized.count} ===`);
  }

  await pool.end();
  console.log(`\nDone!`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
