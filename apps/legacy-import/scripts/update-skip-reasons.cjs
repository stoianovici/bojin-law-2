#!/usr/bin/env node
/**
 * Update skip_reason for already-skipped documents
 * Reads from detection results and sets the reason
 *
 * Usage (from apps/legacy-import directory):
 *   node scripts/update-skip-reasons.cjs <sessionId>
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
    console.log('Usage: node scripts/update-skip-reasons.cjs <sessionId>');
    process.exit(1);
  }

  const sessionId = args[0];
  const summaryFile = path.join(__dirname, '..', 'detection-results', `${sessionId}-summary.json`);

  if (!fs.existsSync(summaryFile)) {
    console.error(`Summary file not found: ${summaryFile}`);
    process.exit(1);
  }

  console.log(`\n=== Updating Skip Reasons ===`);

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
  console.log(`\nFrom detection results:`);
  console.log(`  Scanned: ${summary.scannedDocIds.length}`);
  console.log(`  Duplicates: ${summary.duplicateDocIds.length}`);

  // Update scanned documents
  console.log(`\nUpdating scanned documents...`);
  let updated = 0;
  for (let i = 0; i < summary.scannedDocIds.length; i += BATCH_SIZE) {
    const batch = summary.scannedDocIds.slice(i, i + BATCH_SIZE);
    await pool.query(
      `UPDATE extracted_documents SET skip_reason = 'Scanned' WHERE id = ANY($1)`,
      [batch]
    );
    updated += batch.length;
    if (updated % 5000 === 0 || updated === summary.scannedDocIds.length) {
      console.log(`  Updated ${updated}/${summary.scannedDocIds.length} scanned...`);
    }
  }

  // Update duplicate documents
  console.log(`\nUpdating duplicate documents...`);
  updated = 0;
  for (let i = 0; i < summary.duplicateDocIds.length; i += BATCH_SIZE) {
    const batch = summary.duplicateDocIds.slice(i, i + BATCH_SIZE);
    await pool.query(
      `UPDATE extracted_documents SET skip_reason = 'Duplicate' WHERE id = ANY($1)`,
      [batch]
    );
    updated += batch.length;
    if (updated % 1000 === 0 || updated === summary.duplicateDocIds.length) {
      console.log(`  Updated ${updated}/${summary.duplicateDocIds.length} duplicates...`);
    }
  }

  // Verify counts
  const reasonCounts = await pool.query(
    `SELECT skip_reason, COUNT(*) as count
     FROM extracted_documents
     WHERE session_id = $1 AND status = 'Skipped'
     GROUP BY skip_reason`,
    [sessionId]
  );

  console.log(`\n=== Skip Reason Counts ===`);
  for (const row of reasonCounts.rows) {
    console.log(`  ${row.skip_reason || 'NULL'}: ${row.count}`);
  }

  await pool.end();
  console.log(`\nDone!`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
