#!/usr/bin/env node
/**
 * Sync missing files from local to R2
 * Compares local files with R2 and uploads any missing ones
 */

const {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const SESSION_ID = '8267942a-3721-4956-b866-3aad8e56a1bb';
const LOCAL_DIR = path.join(__dirname, '../extracted-docs', SESSION_ID);
const R2_PREFIX = `documents/${SESSION_ID}/`;

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

async function main() {
  console.log('Fetching R2 file list...');
  const r2Files = await getR2Files();
  console.log(`Found ${r2Files.size} files in R2`);

  console.log('Reading local directory...');
  const localFiles = fs.readdirSync(LOCAL_DIR);
  console.log(`Found ${localFiles.length} local files`);

  // Find missing files
  const missing = localFiles.filter((f) => !r2Files.has(f));
  console.log(`Missing from R2: ${missing.length} files`);

  if (missing.length === 0) {
    console.log('All files are in sync!');
    return;
  }

  // Upload missing files
  let uploaded = 0;
  let errors = 0;

  for (const filename of missing) {
    try {
      process.stdout.write(
        `\rUploading ${uploaded + 1}/${missing.length}: ${filename.substring(0, 40)}...`
      );
      await uploadFile(filename);
      uploaded++;
    } catch (err) {
      errors++;
      console.error(`\nError uploading ${filename}: ${err.message}`);
    }
  }

  console.log(`\n\nDone! Uploaded: ${uploaded}, Errors: ${errors}`);
}

main().catch(console.error);
