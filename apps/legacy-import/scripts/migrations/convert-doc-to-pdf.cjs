#!/usr/bin/env node
/**
 * Migration Script: Convert existing .doc files to PDF
 *
 * Uses macOS textutil + Chrome headless (stable, no LibreOffice)
 * Pipeline: .doc → HTML (textutil) → PDF (Chrome headless)
 *
 * Usage:
 *   node scripts/migrations/convert-doc-to-pdf.cjs [--dry-run] [--session=<sessionId>]
 *
 * Requires:
 *   - SSH tunnel to production DB: ssh -f -N -L 5433:10.0.1.7:5432 root@135.181.44.197
 *   - macOS with textutil (built-in)
 *   - Google Chrome installed
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const sessionArg = args.find(a => a.startsWith('--session='));
const SESSION_FILTER = sessionArg ? sessionArg.split('=')[1] : null;

// Database connection (via SSH tunnel)
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'legal_platform',
  user: 'legal_platform',
  password: 'HTdJ9oAafB6uiecJlB3FImEop3hNG3LI',
});

// Chrome path on macOS
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function convertDocToPdf(inputPath, outputPath) {
  const tempId = uuidv4();
  const tempHtml = path.join(os.tmpdir(), `doc-${tempId}.html`);

  try {
    // Step 1: Convert .doc to HTML using textutil
    execSync(`textutil -convert html -output "${tempHtml}" "${inputPath}"`, {
      timeout: 30000,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    if (!fs.existsSync(tempHtml)) {
      throw new Error('HTML conversion failed');
    }

    // Step 2: Convert HTML to PDF using Chrome headless
    execSync(`"${CHROME_PATH}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPath}" "file://${tempHtml}"`, {
      timeout: 30000,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF conversion failed');
    }

    return fs.statSync(outputPath).size;
  } finally {
    // Cleanup temp file
    try {
      if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
    } catch {}
  }
}

async function main() {
  console.log('\n=== DOC to PDF Migration (textutil + Chrome) ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  if (SESSION_FILTER) console.log(`Session filter: ${SESSION_FILTER}`);
  console.log('');

  // Verify Chrome exists
  if (!fs.existsSync(CHROME_PATH)) {
    console.error('Google Chrome not found at:', CHROME_PATH);
    process.exit(1);
  }
  console.log('Chrome: Found');

  // Verify database connection
  try {
    await pool.query('SELECT 1');
    console.log('Database: Connected');
  } catch (err) {
    console.error('Database connection failed. Make sure SSH tunnel is active:');
    console.error('  ssh -f -N -L 5433:10.0.1.7:5432 root@135.181.44.197');
    process.exit(1);
  }

  // Find all .doc files
  let query = `
    SELECT id, session_id, file_name, storage_path, file_size_bytes
    FROM extracted_documents
    WHERE file_extension = 'doc'
  `;
  const params = [];

  if (SESSION_FILTER) {
    query += ' AND session_id = $1';
    params.push(SESSION_FILTER);
  }

  query += ' ORDER BY session_id, file_name';

  const result = await pool.query(query, params);
  const docs = result.rows;

  console.log(`\nFound ${docs.length} .doc files to convert\n`);

  if (docs.length === 0) {
    console.log('Nothing to do!');
    await pool.end();
    return;
  }

  // Check how many files actually exist
  const existingDocs = docs.filter(d => fs.existsSync(d.storage_path));
  const missingDocs = docs.filter(d => !fs.existsSync(d.storage_path));

  console.log(`Files found on disk: ${existingDocs.length}`);
  console.log(`Files missing: ${missingDocs.length}`);

  if (DRY_RUN) {
    console.log('\nSample of documents that would be converted:');
    for (const doc of existingDocs.slice(0, 10)) {
      console.log(`  ✓ ${doc.file_name}`);
    }
    if (existingDocs.length > 10) {
      console.log(`  ... and ${existingDocs.length - 10} more`);
    }
    console.log('\nRun without --dry-run to perform the migration.');
    await pool.end();
    return;
  }

  // Convert each document
  let converted = 0;
  let failed = 0;
  const errors = [];
  const startTime = Date.now();

  console.log(`\nConverting ${existingDocs.length} files...\n`);

  for (let i = 0; i < existingDocs.length; i++) {
    const doc = existingDocs[i];
    const progress = `[${i + 1}/${existingDocs.length}]`;

    try {
      const newStoragePath = doc.storage_path.replace(/\.doc$/i, '.pdf');

      // Skip if PDF already exists
      if (fs.existsSync(newStoragePath)) {
        process.stdout.write(`${progress} ${doc.file_name} - already done, updating DB... `);

        const pdfSize = fs.statSync(newStoragePath).size;
        await pool.query(
          `UPDATE extracted_documents
           SET file_extension = 'pdf', storage_path = $1, file_size_bytes = $2, updated_at = NOW()
           WHERE id = $3`,
          [newStoragePath, pdfSize, doc.id]
        );

        if (fs.existsSync(doc.storage_path)) {
          fs.unlinkSync(doc.storage_path);
        }

        console.log('✓');
        converted++;
        continue;
      }

      process.stdout.write(`${progress} ${doc.file_name}... `);

      const pdfSize = convertDocToPdf(doc.storage_path, newStoragePath);

      await pool.query(
        `UPDATE extracted_documents
         SET file_extension = 'pdf', storage_path = $1, file_size_bytes = $2, updated_at = NOW()
         WHERE id = $3`,
        [newStoragePath, pdfSize, doc.id]
      );

      fs.unlinkSync(doc.storage_path);

      console.log('✓');
      converted++;

      // Progress every 100
      if (converted % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const rate = (converted / (Date.now() - startTime) * 1000 * 60).toFixed(0);
        console.log(`\n--- ${converted} done in ${elapsed}min (~${rate}/min) ---\n`);
      }
    } catch (err) {
      console.log(`✗ ${err.message}`);
      failed++;
      errors.push({ doc, error: err.message });
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n=== Migration Complete ===');
  console.log(`Converted: ${converted}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time: ${totalTime} minutes`);

  if (errors.length > 0) {
    console.log(`\nFailed (first 10 of ${errors.length}):`);
    for (const { doc, error } of errors.slice(0, 10)) {
      console.log(`  - ${doc.file_name}: ${error}`);
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
