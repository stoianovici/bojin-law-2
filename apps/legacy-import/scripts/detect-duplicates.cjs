#!/usr/bin/env node
/**
 * Duplicate & Scanned Document Detection Script
 * Analyzes extracted documents to find duplicates and scanned/image-only PDFs
 *
 * Usage (from apps/legacy-import directory):
 *   node scripts/detect-duplicates.cjs <sessionId>
 *
 * Requires SSH tunnel to production DB:
 *   ssh -f -N -L 5433:10.0.1.7:5432 root@135.181.44.197
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lazy-load document parsing libraries
let pdfParse, mammoth, WordExtractor;

// Database connection (via SSH tunnel)
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'legal_platform',
  user: 'legal_platform',
  password: 'HTdJ9oAafB6uiecJlB3FImEop3hNG3LI',
});

// Thresholds
const MIN_TEXT_LENGTH = 50; // Minimum characters to not be considered scanned
const MIN_WORD_COUNT = 10; // Minimum words to not be considered scanned
const BATCH_SIZE = 100;

async function loadLibraries() {
  console.log('Loading document parsing libraries...');
  pdfParse = require('pdf-parse');
  mammoth = require('mammoth');
  WordExtractor = require('word-extractor');
}

async function extractTextFromPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    return '';
  }
}

async function extractTextFromDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch (err) {
    return '';
  }
}

async function extractTextFromDOC(filePath) {
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(filePath);
    return doc.getBody() || '';
  } catch (err) {
    return '';
  }
}

async function extractText(filePath, extension) {
  switch (extension.toLowerCase()) {
    case 'pdf':
      return extractTextFromPDF(filePath);
    case 'docx':
      return extractTextFromDOCX(filePath);
    case 'doc':
      return extractTextFromDOC(filePath);
    default:
      return '';
  }
}

function normalizeText(text) {
  // Remove extra whitespace and normalize
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function computeContentHash(text) {
  const normalized = normalizeText(text);
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function countWords(text) {
  const words = text.trim().split(/\s+/);
  return words.filter(w => w.length > 0).length;
}

function isLikelyScanned(text, extension) {
  if (extension.toLowerCase() !== 'pdf') {
    // DOC/DOCX files are text-based
    return false;
  }

  const textLength = text.trim().length;
  const wordCount = countWords(text);

  return textLength < MIN_TEXT_LENGTH || wordCount < MIN_WORD_COUNT;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node scripts/detect-duplicates.cjs <sessionId>');
    process.exit(1);
  }

  const sessionId = args[0];
  const docsDir = path.join(__dirname, '..', 'extracted-docs', sessionId);

  console.log(`\n=== Duplicate & Scanned Document Detection ===`);
  console.log(`Session ID: ${sessionId}`);

  // Verify directory exists
  if (!fs.existsSync(docsDir)) {
    console.error(`Documents directory not found: ${docsDir}`);
    process.exit(1);
  }

  // Load libraries
  await loadLibraries();

  // Test database connection
  try {
    await pool.query('SELECT 1');
    console.log(`Database connection: OK`);
  } catch (err) {
    console.error(`Database connection failed. Make sure SSH tunnel is active.`);
    process.exit(1);
  }

  // Get all documents for this session
  console.log(`\nFetching documents from database...`);
  const docsResult = await pool.query(
    `SELECT id, file_name, file_extension, storage_path, file_size_bytes
     FROM extracted_documents
     WHERE session_id = $1
     ORDER BY file_name`,
    [sessionId]
  );

  const docs = docsResult.rows;
  console.log(`Found ${docs.length} documents to analyze`);

  const stats = {
    total: docs.length,
    analyzed: 0,
    scanned: 0,
    duplicates: 0,
    errors: 0,
  };

  // Track content hashes for duplicate detection
  const contentHashes = new Map(); // hash -> [docIds]
  const scannedDocs = [];
  const duplicateGroups = [];

  console.log(`\nAnalyzing documents...`);

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    try {
      // Check if file exists
      if (!fs.existsSync(doc.storage_path)) {
        stats.errors++;
        continue;
      }

      // Extract text
      const text = await extractText(doc.storage_path, doc.file_extension);

      // Check if scanned
      if (isLikelyScanned(text, doc.file_extension)) {
        scannedDocs.push({
          id: doc.id,
          fileName: doc.file_name,
          textLength: text.trim().length,
          wordCount: countWords(text),
        });
        stats.scanned++;
      } else {
        // Compute hash for duplicate detection
        const hash = computeContentHash(text);

        if (!contentHashes.has(hash)) {
          contentHashes.set(hash, []);
        }
        contentHashes.get(hash).push({
          id: doc.id,
          fileName: doc.file_name,
          fileSize: doc.file_size_bytes,
        });
      }

      stats.analyzed++;

      if (stats.analyzed % 100 === 0) {
        console.log(`  Analyzed ${stats.analyzed}/${docs.length} documents (${stats.scanned} scanned, ${stats.errors} errors)...`);
      }
    } catch (err) {
      stats.errors++;
    }
  }

  // Find duplicate groups
  for (const [hash, docList] of contentHashes.entries()) {
    if (docList.length > 1) {
      duplicateGroups.push({
        hash,
        count: docList.length,
        documents: docList,
      });
      stats.duplicates += docList.length - 1; // All but one are duplicates
    }
  }

  console.log(`\n=== Analysis Complete ===`);
  console.log(`Total documents: ${stats.total}`);
  console.log(`Analyzed: ${stats.analyzed}`);
  console.log(`Scanned/Image-only: ${stats.scanned}`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);
  console.log(`Total duplicates: ${stats.duplicates}`);
  console.log(`Errors: ${stats.errors}`);

  // Save results to JSON files
  const resultsDir = path.join(__dirname, '..', 'detection-results');
  fs.mkdirSync(resultsDir, { recursive: true });

  const scannedFile = path.join(resultsDir, `${sessionId}-scanned.json`);
  fs.writeFileSync(scannedFile, JSON.stringify(scannedDocs, null, 2));
  console.log(`\nScanned documents saved to: ${scannedFile}`);

  const duplicatesFile = path.join(resultsDir, `${sessionId}-duplicates.json`);
  fs.writeFileSync(duplicatesFile, JSON.stringify(duplicateGroups, null, 2));
  console.log(`Duplicate groups saved to: ${duplicatesFile}`);

  // Summary
  const summaryFile = path.join(resultsDir, `${sessionId}-summary.json`);
  fs.writeFileSync(summaryFile, JSON.stringify({
    sessionId,
    analyzedAt: new Date().toISOString(),
    stats,
    scannedDocIds: scannedDocs.map(d => d.id),
    duplicateDocIds: duplicateGroups.flatMap(g => g.documents.slice(1).map(d => d.id)), // Keep first, mark rest as dupes
  }, null, 2));
  console.log(`Summary saved to: ${summaryFile}`);

  // Update database with skip_reason (keeps status as 'Uncategorized' for categorization)
  console.log(`\nUpdating document skip_reason in database...`);

  // Mark scanned documents (skip_reason = 'Scanned')
  if (scannedDocs.length > 0) {
    const scannedIds = scannedDocs.map(d => d.id);
    for (let i = 0; i < scannedIds.length; i += BATCH_SIZE) {
      const batch = scannedIds.slice(i, i + BATCH_SIZE);
      await pool.query(
        `UPDATE extracted_documents SET skip_reason = 'Scanned' WHERE id = ANY($1)`,
        [batch]
      );
    }
    console.log(`  Marked ${scannedDocs.length} documents with skip_reason = 'Scanned'`);
  }

  // Mark duplicate documents (keep first in each group, mark rest with skip_reason = 'Duplicate')
  const duplicateIds = duplicateGroups.flatMap(g => g.documents.slice(1).map(d => d.id));
  const duplicateOriginals = new Map(); // Map duplicate ID to original ID
  for (const group of duplicateGroups) {
    const originalId = group.documents[0].id;
    for (const doc of group.documents.slice(1)) {
      duplicateOriginals.set(doc.id, originalId);
    }
  }

  if (duplicateIds.length > 0) {
    for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
      const batch = duplicateIds.slice(i, i + BATCH_SIZE);
      // Set skip_reason and duplicate_of for each document
      for (const docId of batch) {
        await pool.query(
          `UPDATE extracted_documents SET skip_reason = 'Duplicate', duplicate_of = $1 WHERE id = $2`,
          [duplicateOriginals.get(docId), docId]
        );
      }
    }
    console.log(`  Marked ${duplicateIds.length} documents with skip_reason = 'Duplicate'`);
  }

  console.log(`\n=== Done ===`);
  console.log(`Documents available for categorization: ${stats.total - stats.scanned - stats.duplicates}`);

  await pool.end();
}

main().catch(err => {
  console.error('Detection failed:', err);
  process.exit(1);
});
