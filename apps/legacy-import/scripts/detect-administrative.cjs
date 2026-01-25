#!/usr/bin/env node
/**
 * Administrative Document Detection Script
 * Analyzes document text content to identify invoices, bills, and other administrative docs
 *
 * Usage (from apps/legacy-import directory):
 *   node scripts/detect-administrative.cjs <sessionId>
 *
 * Requires SSH tunnel to production DB:
 *   ssh -f -N -L 5433:10.0.1.7:5432 root@135.181.44.197
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

const BATCH_SIZE = 100;

// Administrative document patterns (Romanian + English)
const ADMIN_PATTERNS = {
  // Invoice patterns
  invoiceHeaders: [
    /factur[aă]\s*(fiscala|proforma|nr|numar|serie)?/i,
    /invoice\s*(no|number|#)?/i,
    /bon\s*(fiscal|de\s*casa)/i,
    /chitan[tț][aă]/i,
    /receipt/i,
    /aviz\s*de\s*(expeditie|insotire)/i,
  ],

  // Tax/fiscal identifiers
  taxIdentifiers: [
    /c\.?u\.?i\.?\s*:?\s*ro?\s*\d+/i,
    /cod\s*(fiscal|unic)/i,
    /reg\.?\s*com\.?\s*:?\s*j\d+/i,
    /vat\s*(id|number|no)/i,
    /tax\s*(id|number)/i,
  ],

  // Payment/billing terms
  paymentTerms: [
    /total\s*(de\s*)?(plat[aă]|facturat)/i,
    /subtotal/i,
    /t\.?v\.?a\.?\s*:?\s*\d+/i,
    /valoare\s*(fara|cu)\s*tva/i,
    /termen\s*(de\s*)?(plat[aă]|scaden[tț])/i,
    /scaden[tț][aă]/i,
    /due\s*date/i,
    /payment\s*(terms|due)/i,
    /amount\s*(due|payable)/i,
  ],

  // Utility/service providers
  utilityProviders: [
    /e-?on\s*(energie|gaz)/i,
    /enel\s*(energie|muntenia)/i,
    /electrica/i,
    /engie/i,
    /digi\s*(romania|mobil|tv)/i,
    /rcs\s*(&|and)?\s*rds/i,
    /vodafone/i,
    /orange\s*(romania)?/i,
    /telekom/i,
    /apa\s*(nova|canal)/i,
    /distrigaz/i,
    /romtelecom/i,
  ],

  // Administrative keywords
  adminKeywords: [
    /extras\s*de\s*cont/i,
    /bank\s*statement/i,
    /confirmare\s*(plat[aă]|transfer)/i,
    /payment\s*confirmation/i,
    /ordin\s*de\s*plat[aă]/i,
    /wire\s*transfer/i,
    /debit\s*(direct|note)/i,
    /credit\s*note/i,
    /storno/i,
  ],
};

// Legal document patterns (should NOT be marked as administrative)
const LEGAL_PATTERNS = [
  /dosar\s*(nr|numar)?\.?\s*\d+/i,      // Case file numbers
  /sentin[tț][aă]/i,                     // Court sentence
  /hot[aă]r[aâ]re/i,                     // Court decision
  /contract\s*(de\s*)?(v[aâ]nzare|prestari|inchiriere|cesiune)/i, // Contracts
  /procur[aă]/i,                         // Power of attorney
  /cerere\s*de\s*(chemare|apel|recurs)/i, // Legal motions
  /contestati[ei]/i,                     // Legal contest
  /peti[tț]i[ei]/i,                      // Petition
  /notificare\s*(de\s*)?(reziliere|punere)/i, // Legal notice
  /somati[ei]/i,                         // Legal summons
  /arbitraj/i,                           // Arbitration
  /litigiu/i,                            // Litigation
  /instan[tț][aă]/i,                     // Court instance
  /tribunal/i,                           // Tribunal
  /judec[aă]torie/i,                     // Court
  /curte\s*(de\s*apel)?/i,               // Court of appeal
];

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

function countPatternMatches(text, patterns) {
  let count = 0;
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) count++;
  }
  return count;
}

function isLikelyAdministrative(text, fileName, emailSubject) {
  // Combine all text for analysis
  const fullText = `${text} ${fileName} ${emailSubject}`.toLowerCase();

  // First, check if it looks like a legal document (should NOT be administrative)
  const legalScore = countPatternMatches(fullText, LEGAL_PATTERNS);
  if (legalScore >= 2) {
    return { isAdmin: false, reason: 'Legal document patterns detected', score: 0 };
  }

  // Count administrative patterns
  let adminScore = 0;
  const reasons = [];

  const invoiceMatches = countPatternMatches(fullText, ADMIN_PATTERNS.invoiceHeaders);
  if (invoiceMatches > 0) {
    adminScore += invoiceMatches * 3;
    reasons.push(`Invoice headers (${invoiceMatches})`);
  }

  const taxMatches = countPatternMatches(fullText, ADMIN_PATTERNS.taxIdentifiers);
  if (taxMatches > 0) {
    adminScore += taxMatches * 2;
    reasons.push(`Tax identifiers (${taxMatches})`);
  }

  const paymentMatches = countPatternMatches(fullText, ADMIN_PATTERNS.paymentTerms);
  if (paymentMatches > 0) {
    adminScore += paymentMatches * 2;
    reasons.push(`Payment terms (${paymentMatches})`);
  }

  const utilityMatches = countPatternMatches(fullText, ADMIN_PATTERNS.utilityProviders);
  if (utilityMatches > 0) {
    adminScore += utilityMatches * 4;
    reasons.push(`Utility provider (${utilityMatches})`);
  }

  const adminMatches = countPatternMatches(fullText, ADMIN_PATTERNS.adminKeywords);
  if (adminMatches > 0) {
    adminScore += adminMatches * 2;
    reasons.push(`Admin keywords (${adminMatches})`);
  }

  // Threshold: score >= 5 is likely administrative
  const isAdmin = adminScore >= 5;

  return {
    isAdmin,
    reason: reasons.join(', ') || 'No administrative patterns',
    score: adminScore,
    legalScore,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node scripts/detect-administrative.cjs <sessionId>');
    process.exit(1);
  }

  const sessionId = args[0];
  const dryRun = args.includes('--dry-run');
  const docsDir = path.join(__dirname, '..', 'extracted-docs', sessionId);

  console.log(`\n=== Administrative Document Detection ===`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no database updates)' : 'LIVE'}`);

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

  // Get email documents (not scanned, not already administrative)
  console.log(`\nFetching email documents from database...`);
  const docsResult = await pool.query(
    `SELECT id, file_name, file_extension, storage_path, email_subject
     FROM extracted_documents
     WHERE session_id = $1
       AND (skip_reason IS NULL OR skip_reason = 'Duplicate')
     ORDER BY file_name`,
    [sessionId]
  );

  const docs = docsResult.rows;
  console.log(`Found ${docs.length} documents to analyze`);

  const stats = {
    total: docs.length,
    analyzed: 0,
    administrative: 0,
    legal: 0,
    errors: 0,
  };

  const adminDocs = [];

  console.log(`\nAnalyzing documents for administrative patterns...`);

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

      // Analyze for administrative patterns
      const result = isLikelyAdministrative(text, doc.file_name, doc.email_subject || '');

      if (result.isAdmin) {
        adminDocs.push({
          id: doc.id,
          fileName: doc.file_name,
          emailSubject: doc.email_subject,
          score: result.score,
          reason: result.reason,
        });
        stats.administrative++;
      } else if (result.legalScore >= 2) {
        stats.legal++;
      }

      stats.analyzed++;

      if (stats.analyzed % 100 === 0) {
        console.log(`  Analyzed ${stats.analyzed}/${docs.length} (${stats.administrative} admin, ${stats.legal} legal, ${stats.errors} errors)...`);
      }
    } catch (err) {
      stats.errors++;
    }
  }

  console.log(`\n=== Analysis Complete ===`);
  console.log(`Total documents: ${stats.total}`);
  console.log(`Analyzed: ${stats.analyzed}`);
  console.log(`Administrative: ${stats.administrative}`);
  console.log(`Legal (protected): ${stats.legal}`);
  console.log(`Errors: ${stats.errors}`);

  // Save results to JSON
  const resultsDir = path.join(__dirname, '..', 'detection-results');
  fs.mkdirSync(resultsDir, { recursive: true });

  const adminFile = path.join(resultsDir, `${sessionId}-administrative.json`);
  fs.writeFileSync(adminFile, JSON.stringify(adminDocs, null, 2));
  console.log(`\nAdministrative documents saved to: ${adminFile}`);

  // Show sample of detected documents
  if (adminDocs.length > 0) {
    console.log(`\nSample administrative documents:`);
    const sample = adminDocs.slice(0, 10);
    for (const doc of sample) {
      console.log(`  - ${doc.fileName} (score: ${doc.score})`);
      console.log(`    Subject: ${doc.emailSubject || '(none)'}`);
      console.log(`    Reason: ${doc.reason}`);
    }
    if (adminDocs.length > 10) {
      console.log(`  ... and ${adminDocs.length - 10} more`);
    }
  }

  if (dryRun) {
    console.log(`\n=== DRY RUN - No database changes made ===`);
    console.log(`Run without --dry-run to update database`);
  } else {
    // Update database
    console.log(`\nUpdating database with skip_reason = 'Administrative'...`);

    if (adminDocs.length > 0) {
      const adminIds = adminDocs.map(d => d.id);
      for (let i = 0; i < adminIds.length; i += BATCH_SIZE) {
        const batch = adminIds.slice(i, i + BATCH_SIZE);
        await pool.query(
          `UPDATE extracted_documents SET skip_reason = 'Administrative' WHERE id = ANY($1)`,
          [batch]
        );
      }
      console.log(`  Marked ${adminDocs.length} documents as 'Administrative'`);
    }

    console.log(`\n=== Done ===`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Detection failed:', err);
  process.exit(1);
});
