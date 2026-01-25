#!/usr/bin/env node
/**
 * Local PST Extraction Script
 * Extracts documents from a local PST file and imports them to the production database
 *
 * Usage:
 *   node scripts/extract-pst.mjs "/path/to/file.pst" <sessionId>
 *
 * Requires SSH tunnel to production DB:
 *   ssh -f -N -L 5433:10.0.1.7:5432 root@135.181.44.197
 */

import pst from 'pst-extractor';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database connection (via SSH tunnel)
const pool = new pg.Pool({
  host: 'localhost',
  port: 5433,
  database: 'legal_platform',
  user: 'legal_platform',
  password: 'HTdJ9oAafB6uiecJlB3FImEop3hNG3LI',
});

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc'];

// Batch size for database inserts
const BATCH_SIZE = 100;

function isSentFolder(folderPath) {
  const lowerPath = folderPath.toLowerCase();
  return (
    lowerPath.includes('sent items') ||
    lowerPath.includes('sent mail') ||
    lowerPath.includes('sent') ||
    lowerPath.includes('trimise') ||
    lowerPath.includes('elemente trimise')
  );
}

function getFileExtension(fileName) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function formatMonthYear(date) {
  if (!date || isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 7);
  }
  return date.toISOString().slice(0, 7);
}

async function processFolder(folder, folderPath, sessionId, outputDir, stats, allDocs) {
  // Process emails in this folder
  if (folder.contentCount > 0) {
    let email = folder.getNextChild();

    while (email !== null) {
      stats.processed++;

      if (email.messageClass === 'IPM.Note' || email.messageClass?.startsWith('IPM.Note')) {
        const numAttachments = email.numberOfAttachments;

        for (let i = 0; i < numAttachments; i++) {
          try {
            const attachment = email.getAttachment(i);
            if (!attachment || !attachment.filename) continue;

            const fileName = attachment.filename;
            const ext = getFileExtension(fileName);

            if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

            const fileContent = attachment.fileInputStream;
            if (!fileContent) continue;

            // Read into buffer
            const chunks = [];
            const readBuffer = Buffer.alloc(8192);

            let bytesRead;
            while ((bytesRead = fileContent.read(readBuffer)) > 0) {
              chunks.push(Buffer.from(readBuffer.slice(0, bytesRead)));
            }

            const contentBuffer = Buffer.concat(chunks);
            if (contentBuffer.length === 0) continue;

            // Generate unique ID and storage path
            const docId = uuidv4();
            const storagePath = path.join(outputDir, `${docId}.${ext}`);

            // Save file locally
            fs.writeFileSync(storagePath, contentBuffer);

            // Get email metadata
            const emailDate = email.clientSubmitTime || email.messageDeliveryTime || new Date();

            allDocs.push({
              id: docId,
              fileName,
              fileExtension: ext,
              fileSizeBytes: contentBuffer.length,
              storagePath,
              folderPath,
              isSent: isSentFolder(folderPath),
              emailSubject: (email.subject || '').substring(0, 1000),
              emailSender: (email.senderEmailAddress || email.senderName || '').substring(0, 500),
              emailReceiver: (email.displayTo || '').substring(0, 500),
              emailDate,
              monthYear: formatMonthYear(emailDate),
            });

            stats.extracted++;

            if (stats.extracted % 100 === 0) {
              console.log(`  Extracted ${stats.extracted} documents (processed ${stats.processed} emails)...`);
            }
          } catch (err) {
            stats.errors++;
          }
        }
      }

      email = folder.getNextChild();
    }
  }

  // Recursively process subfolders
  if (folder.hasSubfolders) {
    const subfolders = folder.getSubFolders();
    for (const subfolder of subfolders) {
      const subfolderPath = folderPath ? `${folderPath}/${subfolder.displayName}` : subfolder.displayName;
      await processFolder(subfolder, subfolderPath, sessionId, outputDir, stats, allDocs);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node scripts/extract-pst.mjs "/path/to/file.pst" <sessionId>');
    console.log('\nExample:');
    console.log('  node scripts/extract-pst.mjs "/Users/mio/Desktop/Bojin PST/backup email valentin.pst" 8267942a-3721-4956-b866-3aad8e56a1bb');
    process.exit(1);
  }

  const pstPath = args[0];
  const sessionId = args[1];

  // Verify PST file exists
  if (!fs.existsSync(pstPath)) {
    console.error(`PST file not found: ${pstPath}`);
    process.exit(1);
  }

  console.log(`\n=== Local PST Extraction ===`);
  console.log(`PST File: ${pstPath}`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`File size: ${(fs.statSync(pstPath).size / 1024 / 1024 / 1024).toFixed(2)} GB`);

  // Test database connection
  try {
    const result = await pool.query('SELECT 1');
    console.log(`Database connection: OK`);
  } catch (err) {
    console.error(`Database connection failed. Make sure SSH tunnel is active:`);
    console.error(`  ssh -f -N -L 5433:10.0.1.7:5432 root@135.181.44.197`);
    process.exit(1);
  }

  // Verify session exists
  const sessionResult = await pool.query(
    'SELECT id, status, total_documents FROM legacy_import_sessions WHERE id = $1',
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const session = sessionResult.rows[0];
  console.log(`Session status: ${session.status}`);
  console.log(`\nStarting extraction...\n`);

  // Create output directory for extracted files
  const outputDir = path.join(__dirname, '..', 'extracted-docs', sessionId);
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Output directory: ${outputDir}`);

  const stats = { processed: 0, extracted: 0, errors: 0 };
  const allDocs = [];

  try {
    // Open PST file
    console.log(`Opening PST file...`);
    const pstFile = new pst.PSTFile(pstPath);
    const rootFolder = pstFile.getRootFolder();

    console.log(`Processing PST folders...`);

    // Process all folders
    await processFolder(rootFolder, '', sessionId, outputDir, stats, allDocs);

    console.log(`\n=== Extraction Complete ===`);
    console.log(`Emails processed: ${stats.processed}`);
    console.log(`Documents extracted: ${stats.extracted}`);
    console.log(`Errors: ${stats.errors}`);

    if (allDocs.length === 0) {
      console.log('No documents found!');
      process.exit(0);
    }

    // Insert into database in batches
    console.log(`\nInserting ${allDocs.length} documents into database...`);

    // Group by month for batch creation
    const byMonth = new Map();
    for (const doc of allDocs) {
      const existing = byMonth.get(doc.monthYear) || [];
      existing.push(doc);
      byMonth.set(doc.monthYear, existing);
    }

    console.log(`Found ${byMonth.size} unique months`);

    let insertedCount = 0;
    const batchCache = new Map();

    for (const [monthYear, monthDocs] of byMonth) {
      // Create or get batch
      let batchId = batchCache.get(monthYear);

      if (!batchId) {
        const existingBatch = await pool.query(
          'SELECT id FROM document_batches WHERE session_id = $1 AND month_year = $2',
          [sessionId, monthYear]
        );

        if (existingBatch.rows.length > 0) {
          batchId = existingBatch.rows[0].id;
        } else {
          const newBatch = await pool.query(
            `INSERT INTO document_batches (id, session_id, month_year, document_count, created_at, updated_at)
             VALUES ($1, $2, $3, 0, NOW(), NOW()) RETURNING id`,
            [uuidv4(), sessionId, monthYear]
          );
          batchId = newBatch.rows[0].id;
        }
        batchCache.set(monthYear, batchId);
      }

      // Insert documents in smaller batches
      for (let i = 0; i < monthDocs.length; i += BATCH_SIZE) {
        const batchDocs = monthDocs.slice(i, i + BATCH_SIZE);

        const values = [];
        const placeholders = [];

        batchDocs.forEach((doc, idx) => {
          const offset = idx * 14;
          placeholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`
          );
          values.push(
            doc.id,
            sessionId,
            batchId,
            doc.fileName,
            doc.fileExtension,
            doc.fileSizeBytes,
            doc.storagePath,
            doc.folderPath,
            doc.isSent,
            doc.emailSubject,
            doc.emailSender,
            doc.emailReceiver,
            doc.emailDate,
            'Uncategorized'
          );
        });

        await pool.query(
          `INSERT INTO extracted_documents
           (id, session_id, batch_id, file_name, file_extension, file_size_bytes, storage_path, folder_path, is_sent, email_subject, email_sender, email_receiver, email_date, status)
           VALUES ${placeholders.join(', ')}
           ON CONFLICT (id) DO NOTHING`,
          values
        );

        insertedCount += batchDocs.length;
        if (insertedCount % 500 === 0 || insertedCount === allDocs.length) {
          console.log(`  Inserted ${insertedCount}/${allDocs.length} documents...`);
        }
      }

      // Update batch count
      await pool.query(
        'UPDATE document_batches SET document_count = $1, updated_at = NOW() WHERE id = $2',
        [monthDocs.length, batchId]
      );
    }

    // Update session
    await pool.query(
      `UPDATE legacy_import_sessions SET status = 'InProgress', total_documents = $1, updated_at = NOW() WHERE id = $2`,
      [allDocs.length, sessionId]
    );

    console.log(`\n=== Database Import Complete ===`);
    console.log(`Total documents: ${allDocs.length}`);
    console.log(`Session updated to 'InProgress'`);
    console.log(`\nExtracted files saved to: ${outputDir}`);

  } catch (error) {
    console.error('Extraction failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
