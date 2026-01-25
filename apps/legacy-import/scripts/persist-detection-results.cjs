#!/usr/bin/env node
/**
 * Persist detection results:
 * 1. Update duplicate_of column in database
 * 2. Upload JSON files to R2
 *
 * Usage (from apps/legacy-import directory):
 *   node scripts/persist-detection-results.cjs <sessionId>
 *
 * Requires R2 credentials in environment or .env.local
 */

const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Load env from project root manually
const envPath = path.join(__dirname, '..', '..', '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'legal_platform',
  user: 'legal_platform',
  password: 'HTdJ9oAafB6uiecJlB3FImEop3hNG3LI',
});

// R2 client
const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'legal-documents';
const BATCH_SIZE = 100;

async function uploadToR2(key, content) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: content,
    ContentType: 'application/json',
  });
  await r2.send(command);
  return `r2://${R2_BUCKET}/${key}`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node scripts/persist-detection-results.cjs <sessionId>');
    process.exit(1);
  }

  const sessionId = args[0];
  const resultsDir = path.join(__dirname, '..', 'detection-results');

  const duplicatesFile = path.join(resultsDir, `${sessionId}-duplicates.json`);
  const scannedFile = path.join(resultsDir, `${sessionId}-scanned.json`);
  const summaryFile = path.join(resultsDir, `${sessionId}-summary.json`);

  if (!fs.existsSync(duplicatesFile)) {
    console.error(`Duplicates file not found: ${duplicatesFile}`);
    process.exit(1);
  }

  console.log(`\n=== Persisting Detection Results ===`);
  console.log(`Session ID: ${sessionId}`);

  // Test database connection
  try {
    await pool.query('SELECT 1');
    console.log(`Database connection: OK`);
  } catch (err) {
    console.error(`Database connection failed.`);
    process.exit(1);
  }

  // === Part 1: Update duplicate_of references ===
  console.log(`\n--- Updating duplicate_of references ---`);

  const duplicateGroups = JSON.parse(fs.readFileSync(duplicatesFile, 'utf-8'));
  console.log(`Found ${duplicateGroups.length} duplicate groups`);

  let updatedCount = 0;
  for (const group of duplicateGroups) {
    // First document in group is the "original", rest are duplicates
    const originalId = group.documents[0].id;
    const duplicateIds = group.documents.slice(1).map(d => d.id);

    if (duplicateIds.length > 0) {
      // Update all duplicates to point to original
      for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
        const batch = duplicateIds.slice(i, i + BATCH_SIZE);
        await pool.query(
          `UPDATE extracted_documents SET duplicate_of = $1 WHERE id = ANY($2)`,
          [originalId, batch]
        );
      }
      updatedCount += duplicateIds.length;
    }
  }
  console.log(`Updated ${updatedCount} documents with duplicate_of references`);

  // === Part 2: Upload to R2 ===
  console.log(`\n--- Uploading to R2 ---`);

  const r2BasePath = `legacy-import/${sessionId}/detection-results`;

  try {
    // Upload duplicates.json
    const duplicatesContent = fs.readFileSync(duplicatesFile);
    const duplicatesKey = `${r2BasePath}/duplicates.json`;
    await uploadToR2(duplicatesKey, duplicatesContent);
    console.log(`Uploaded: ${duplicatesKey}`);

    // Upload scanned.json
    const scannedContent = fs.readFileSync(scannedFile);
    const scannedKey = `${r2BasePath}/scanned.json`;
    await uploadToR2(scannedKey, scannedContent);
    console.log(`Uploaded: ${scannedKey}`);

    // Upload summary.json
    const summaryContent = fs.readFileSync(summaryFile);
    const summaryKey = `${r2BasePath}/summary.json`;
    await uploadToR2(summaryKey, summaryContent);
    console.log(`Uploaded: ${summaryKey}`);

    console.log(`\nAll files uploaded to R2 bucket: ${R2_BUCKET}`);
  } catch (err) {
    console.error(`R2 upload failed:`, err.message);
    console.log(`\nNote: Detection results are still saved locally and duplicate_of is updated in DB.`);
  }

  // === Verify ===
  console.log(`\n--- Verification ---`);

  const dupOfCount = await pool.query(
    `SELECT COUNT(*) as count FROM extracted_documents
     WHERE session_id = $1 AND duplicate_of IS NOT NULL`,
    [sessionId]
  );
  console.log(`Documents with duplicate_of set: ${dupOfCount.rows[0].count}`);

  // Show a sample duplicate group
  const sampleGroup = await pool.query(
    `SELECT d.id, d.file_name, d.duplicate_of, o.file_name as original_name
     FROM extracted_documents d
     LEFT JOIN extracted_documents o ON d.duplicate_of = o.id
     WHERE d.session_id = $1 AND d.duplicate_of IS NOT NULL
     LIMIT 3`,
    [sessionId]
  );

  if (sampleGroup.rows.length > 0) {
    console.log(`\nSample duplicate references:`);
    for (const row of sampleGroup.rows) {
      console.log(`  "${row.file_name}" -> duplicate of -> "${row.original_name}"`);
    }
  }

  await pool.end();
  console.log(`\n=== Done ===`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
