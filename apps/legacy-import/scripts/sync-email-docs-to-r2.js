#!/usr/bin/env node
/**
 * Sync email documents from local to R2
 * Only uploads files listed in /tmp/email-doc-ids.txt
 */

const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const SESSION_ID = '8267942a-3721-4956-b866-3aad8e56a1bb';
const LOCAL_DIR = path.join(__dirname, '../extracted-docs', SESSION_ID);
const R2_PREFIX = `documents/${SESSION_ID}/`;
const CONCURRENCY = 20;

const client = new S3Client({
  region: 'auto',
  endpoint: 'https://7309c55b8f6a44b8d9ddafc5c3eeb545.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: 'bc2226d3e4c9dd923fabf50bb52e8e86',
    secretAccessKey: '272b852ddbc4afafea142201891aff887f954aa034968528115add507d586ca8',
  },
});

const BUCKET = 'legacy-import';

const contentTypeMap = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
};

async function getR2Files() {
  const r2Files = new Set();
  let token;

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: R2_PREFIX,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );

    if (resp.Contents) {
      resp.Contents.forEach((obj) => {
        const filename = obj.Key.replace(R2_PREFIX, '');
        r2Files.add(filename);
      });
    }
    token = resp.NextContinuationToken;
  } while (token);

  return r2Files;
}

async function uploadFile(filename) {
  const localPath = path.join(LOCAL_DIR, filename);
  const r2Key = R2_PREFIX + filename;
  const ext = path.extname(filename).toLowerCase();

  if (!fs.existsSync(localPath)) {
    throw new Error(`File not found: ${localPath}`);
  }

  const fileBuffer = fs.readFileSync(localPath);

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: contentTypeMap[ext] || 'application/octet-stream',
    })
  );
}

async function uploadBatch(files, startIndex, total) {
  const results = await Promise.allSettled(
    files.map(async (filename, i) => {
      await uploadFile(filename);
      return { filename, index: startIndex + i };
    })
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected');

  if (failed.length > 0) {
    failed.forEach((f) => {
      console.error(`  Error: ${f.reason?.message || f.reason}`);
    });
  }

  return { succeeded, failed: failed.length };
}

async function main() {
  // Read email document IDs from file
  const emailDocIds = fs
    .readFileSync('/tmp/email-doc-ids.txt', 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  console.log(`Email documents to sync: ${emailDocIds.length}`);

  console.log('Fetching R2 file list...');
  const r2Files = await getR2Files();
  console.log(`Found ${r2Files.size} files in R2`);

  // Find missing email files
  const missing = emailDocIds.filter((f) => !r2Files.has(f));
  console.log(`Missing email docs from R2: ${missing.length} files`);

  if (missing.length === 0) {
    console.log('All email documents are in sync!');
    return;
  }

  // Upload in parallel batches
  let uploaded = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    const result = await uploadBatch(batch, i, missing.length);
    uploaded += result.succeeded;
    errors += result.failed;

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = uploaded / elapsed;
    const remaining = (missing.length - uploaded - errors) / rate;

    process.stdout.write(
      `\rUploaded: ${uploaded}/${missing.length} (${((uploaded / missing.length) * 100).toFixed(1)}%) | Errors: ${errors} | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.ceil(remaining / 60)}min    `
    );
  }

  console.log(`\n\nDone! Uploaded: ${uploaded}, Errors: ${errors}`);
  console.log(`Total time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);
}

main().catch(console.error);
