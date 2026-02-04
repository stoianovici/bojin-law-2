/**
 * Upload legacy import documents to R2
 * Run with: npx tsx scripts/upload-legacy-docs-to-r2.ts
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';

// Load env
config({ path: '.env.local' });

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'legal-documents';

const SESSION_ID = '8267942a-3721-4956-b866-3aad8e56a1bb';
const LOCAL_DIR = `/Users/mio/Developer/bojin-law-2/apps/legacy-import/extracted-docs/${SESSION_ID}`;
const R2_PREFIX = `legacy-import/${SESSION_ID}`;

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

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

async function getExistingFiles(): Promise<Set<string>> {
  const existing = new Set<string>();
  let continuationToken: string | undefined;

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
        if (filename) existing.add(filename);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return existing;
}

async function uploadFile(filename: string, index: number, total: number): Promise<boolean> {
  const filepath = join(LOCAL_DIR, filename);
  const key = `${R2_PREFIX}/${filename}`;
  const ext = filename.split('.').pop()?.toLowerCase() || '';

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

    if (index % 100 === 0 || index === total - 1) {
      const pct = (((index + 1) / total) * 100).toFixed(1);
      console.log(`[${pct}%] ${index + 1}/${total} - ${filename}`);
    }

    return true;
  } catch (error) {
    console.error(`Failed: ${filename}`, error);
    return false;
  }
}

async function main() {
  console.log('Starting upload to R2...');
  console.log(`Source: ${LOCAL_DIR}`);
  console.log(`Destination: s3://${R2_BUCKET_NAME}/${R2_PREFIX}/`);

  // Get list of local files
  const files = await readdir(LOCAL_DIR);
  console.log(`Found ${files.length} local files`);

  // Get already uploaded files
  console.log('Checking existing files in R2...');
  const existing = await getExistingFiles();
  console.log(`Already uploaded: ${existing.size} files`);

  // Filter to only upload new files
  const toUpload = files.filter((f) => !existing.has(f));
  console.log(`Files to upload: ${toUpload.length}`);

  if (toUpload.length === 0) {
    console.log('All files already uploaded!');
    return;
  }

  // Upload with concurrency
  const CONCURRENCY = 10;
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < toUpload.length; i += CONCURRENCY) {
    const batch = toUpload.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((file, j) => uploadFile(file, i + j, toUpload.length))
    );
    uploaded += results.filter((r) => r).length;
    failed += results.filter((r) => !r).length;
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Failed: ${failed}`);
}

main().catch(console.error);
