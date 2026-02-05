#!/usr/bin/env npx tsx
/**
 * Robust Legacy Document Upload to R2
 *
 * Features:
 * - Resumable: Checks existing files in R2 before uploading
 * - Progress persistence: Saves state to disk
 * - Retry logic: Failed uploads are retried with exponential backoff
 * - Verification: Validates uploaded files match local files
 * - Configurable concurrency: Avoids overwhelming R2 API
 * - Detailed logging: Progress saved to log file
 *
 * Run with: npx tsx scripts/upload-legacy-docs-robust.ts
 *
 * Options:
 *   --verify-only    Only verify uploads, don't upload new files
 *   --concurrency=N  Set upload concurrency (default: 5)
 *   --dry-run        Show what would be uploaded without actually uploading
 */

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { readdir, readFile, stat, writeFile, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

// Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'legal-documents';

const SESSION_ID = '8267942a-3721-4956-b866-3aad8e56a1bb';
const LOCAL_DIR = `/Users/mio/Developer/bojin-law-2/apps/legacy-import/extracted-docs/${SESSION_ID}`;
const R2_PREFIX = `legacy-import/${SESSION_ID}`;

// State files
const STATE_FILE = `/Users/mio/Developer/bojin-law-2/scripts/.upload-state-${SESSION_ID}.json`;
const LOG_FILE = `/Users/mio/Developer/bojin-law-2/scripts/.upload-log-${SESSION_ID}.txt`;

// Content type mapping
const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  txt: 'text/plain',
  html: 'text/html',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

interface UploadState {
  sessionId: string;
  startedAt: string;
  lastUpdatedAt: string;
  totalFiles: number;
  uploadedFiles: string[];
  failedFiles: { filename: string; error: string; attempts: number }[];
  skippedFiles: string[];
}

interface UploadResult {
  filename: string;
  success: boolean;
  error?: string;
  size?: number;
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

async function log(message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(message);
  await appendFile(LOG_FILE, logLine).catch(() => {});
}

async function loadState(): Promise<UploadState | null> {
  try {
    if (existsSync(STATE_FILE)) {
      const content = await readFile(STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    await log(`Warning: Could not load state file: ${e}`);
  }
  return null;
}

async function saveState(state: UploadState): Promise<void> {
  state.lastUpdatedAt = new Date().toISOString();
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function getR2Files(): Promise<Map<string, number>> {
  const files = new Map<string, number>();
  let continuationToken: string | undefined;

  await log('Fetching existing files from R2...');

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: R2_PREFIX,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of response.Contents || []) {
      if (obj.Key) {
        const filename = obj.Key.split('/').pop();
        if (filename) files.set(filename, obj.Size || 0);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  await log(`Found ${files.size} existing files in R2`);
  return files;
}

async function verifyFile(filename: string, localSize: number): Promise<boolean> {
  const key = `${R2_PREFIX}/${filename}`;
  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    // Verify size matches
    return response.ContentLength === localSize;
  } catch {
    return false;
  }
}

async function uploadFileWithRetry(
  filename: string,
  maxRetries: number = 3
): Promise<UploadResult> {
  const filepath = join(LOCAL_DIR, filename);
  const key = `${R2_PREFIX}/${filename}`;
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileBuffer = await readFile(filepath);
      const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      return { filename, success: true, size: fileBuffer.length };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await log(`Retry ${attempt}/${maxRetries} for ${filename} after ${delay}ms: ${errorMsg}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        return { filename, success: false, error: errorMsg };
      }
    }
  }

  return { filename, success: false, error: 'Max retries exceeded' };
}

async function uploadBatch(
  files: string[],
  concurrency: number,
  state: UploadState,
  dryRun: boolean
): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);

    if (dryRun) {
      for (const file of batch) {
        await log(`[DRY RUN] Would upload: ${file}`);
      }
      uploaded += batch.length;
      continue;
    }

    const results = await Promise.all(batch.map((file) => uploadFileWithRetry(file)));

    for (const result of results) {
      if (result.success) {
        uploaded++;
        state.uploadedFiles.push(result.filename);

        // Remove from failed list if it was there
        state.failedFiles = state.failedFiles.filter((f) => f.filename !== result.filename);
      } else {
        failed++;
        const existingFailed = state.failedFiles.find((f) => f.filename === result.filename);
        if (existingFailed) {
          existingFailed.attempts++;
          existingFailed.error = result.error || 'Unknown error';
        } else {
          state.failedFiles.push({
            filename: result.filename,
            error: result.error || 'Unknown error',
            attempts: 1,
          });
        }
        await log(`Failed: ${result.filename} - ${result.error}`);
      }
    }

    // Save state periodically
    if ((i + concurrency) % 50 === 0 || i + concurrency >= files.length) {
      await saveState(state);
      const progress = (((i + concurrency) / files.length) * 100).toFixed(1);
      const totalProgress = (
        ((state.uploadedFiles.length + state.skippedFiles.length) / state.totalFiles) *
        100
      ).toFixed(1);
      await log(
        `Progress: ${progress}% of batch | ${totalProgress}% overall | Uploaded: ${uploaded}, Failed: ${failed}`
      );
    }
  }

  return { uploaded, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes('--verify-only');
  const dryRun = args.includes('--dry-run');
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 5;

  await log('='.repeat(60));
  await log('ROBUST LEGACY DOCUMENT UPLOAD');
  await log('='.repeat(60));
  await log(`Session: ${SESSION_ID}`);
  await log(`Bucket: ${R2_BUCKET_NAME}`);
  await log(`Local dir: ${LOCAL_DIR}`);
  await log(`R2 prefix: ${R2_PREFIX}`);
  await log(`Concurrency: ${concurrency}`);
  await log(`Mode: ${verifyOnly ? 'Verify Only' : dryRun ? 'Dry Run' : 'Upload'}`);
  await log('');

  // Load existing state or create new
  let state = await loadState();
  if (state) {
    await log(`Resuming from saved state (last updated: ${state.lastUpdatedAt})`);
  } else {
    state = {
      sessionId: SESSION_ID,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      totalFiles: 0,
      uploadedFiles: [],
      failedFiles: [],
      skippedFiles: [],
    };
  }

  // Get local files
  await log('Scanning local directory...');
  const localFiles = await readdir(LOCAL_DIR);
  state.totalFiles = localFiles.length;
  await log(`Local files: ${localFiles.length}`);

  // Get R2 files
  const r2Files = await getR2Files();

  // Determine what needs to be uploaded
  const toUpload: string[] = [];
  const alreadyUploaded: string[] = [];
  const sizeMismatch: string[] = [];

  for (const filename of localFiles) {
    const localStat = await stat(join(LOCAL_DIR, filename));

    if (r2Files.has(filename)) {
      const r2Size = r2Files.get(filename)!;
      if (r2Size === localStat.size) {
        alreadyUploaded.push(filename);
      } else {
        sizeMismatch.push(filename);
        toUpload.push(filename); // Re-upload if size mismatch
      }
    } else {
      toUpload.push(filename);
    }
  }

  // Update state with already uploaded files
  for (const file of alreadyUploaded) {
    if (!state.uploadedFiles.includes(file) && !state.skippedFiles.includes(file)) {
      state.skippedFiles.push(file);
    }
  }

  await log('');
  await log('=== ANALYSIS ===');
  await log(`Total local files: ${localFiles.length}`);
  await log(`Already in R2 (correct size): ${alreadyUploaded.length}`);
  await log(`Size mismatch (will re-upload): ${sizeMismatch.length}`);
  await log(`To upload: ${toUpload.length}`);
  await log(`Previously failed: ${state.failedFiles.length}`);

  if (sizeMismatch.length > 0) {
    await log('');
    await log('Size mismatches (first 10):');
    for (const file of sizeMismatch.slice(0, 10)) {
      const localStat = await stat(join(LOCAL_DIR, file));
      const r2Size = r2Files.get(file)!;
      await log(`  ${file}: local=${localStat.size}, r2=${r2Size}`);
    }
  }

  if (verifyOnly) {
    await log('');
    await log('Verify-only mode. No uploads performed.');
    await saveState(state);
    return;
  }

  if (toUpload.length === 0) {
    await log('');
    await log('All files already uploaded!');
    await saveState(state);
    return;
  }

  // Calculate estimated size
  let estimatedSize = 0;
  for (const file of toUpload.slice(0, 100)) {
    const s = await stat(join(LOCAL_DIR, file));
    estimatedSize += s.size;
  }
  const avgSize = estimatedSize / Math.min(100, toUpload.length);
  const totalEstimated = (avgSize * toUpload.length) / 1024 / 1024 / 1024;
  await log(`Estimated upload size: ${totalEstimated.toFixed(2)} GB`);

  await log('');
  await log('=== STARTING UPLOAD ===');
  await log(`Uploading ${toUpload.length} files with concurrency ${concurrency}...`);
  await log('');

  const startTime = Date.now();
  const { uploaded, failed } = await uploadBatch(toUpload, concurrency, state, dryRun);
  const duration = (Date.now() - startTime) / 1000;

  await log('');
  await log('=== UPLOAD COMPLETE ===');
  await log(`Duration: ${duration.toFixed(1)} seconds`);
  await log(`Uploaded: ${uploaded}`);
  await log(`Failed: ${failed}`);
  await log(`Total in R2 now: ${state.uploadedFiles.length + state.skippedFiles.length}`);

  if (state.failedFiles.length > 0) {
    await log('');
    await log('Failed files (will retry on next run):');
    for (const f of state.failedFiles.slice(0, 20)) {
      await log(`  ${f.filename}: ${f.error} (attempts: ${f.attempts})`);
    }
    if (state.failedFiles.length > 20) {
      await log(`  ... and ${state.failedFiles.length - 20} more`);
    }
  }

  await saveState(state);
  await log('');
  await log(`State saved to: ${STATE_FILE}`);
  await log(`Log saved to: ${LOG_FILE}`);
}

main().catch(async (e) => {
  await log(`FATAL ERROR: ${e}`);
  process.exit(1);
});
