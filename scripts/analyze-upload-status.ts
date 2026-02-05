/**
 * Analyze upload status between local files and R2
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { config } from 'dotenv';

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

async function getR2Files(): Promise<Set<string>> {
  const files = new Set<string>();
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
        if (filename) files.add(filename);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

async function main() {
  console.log('=== UPLOAD STATUS ANALYSIS ===\n');

  // Get local files
  const localFiles = await readdir(LOCAL_DIR);
  console.log(`Local files: ${localFiles.length}`);

  // Get R2 files
  console.log('Fetching R2 file list...');
  const r2Files = await getR2Files();
  console.log(`R2 files: ${r2Files.size}`);

  // Find missing files
  const missingFiles = localFiles.filter((f) => !r2Files.has(f));
  const extraR2Files = [...r2Files].filter((f) => !localFiles.includes(f));

  console.log(`\nMissing from R2: ${missingFiles.length}`);
  console.log(`Extra in R2 (not in local): ${extraR2Files.length}`);

  // Sample of missing files
  console.log('\n=== SAMPLE MISSING FILES (first 10) ===');
  for (const f of missingFiles.slice(0, 10)) {
    const localStat = await stat(join(LOCAL_DIR, f));
    console.log(`${f} - ${(localStat.size / 1024).toFixed(1)} KB`);
  }

  // Check upload pattern - are missing files sequential or random?
  console.log('\n=== UPLOAD PATTERN ANALYSIS ===');
  const sortedLocal = [...localFiles].sort();
  const uploadedIndices: number[] = [];
  const missingIndices: number[] = [];

  for (let i = 0; i < sortedLocal.length; i++) {
    if (r2Files.has(sortedLocal[i])) {
      uploadedIndices.push(i);
    } else {
      missingIndices.push(i);
    }
  }

  console.log(`First uploaded index: ${uploadedIndices[0]}`);
  console.log(`Last uploaded index: ${uploadedIndices[uploadedIndices.length - 1]}`);
  console.log(`First missing index: ${missingIndices[0]}`);
  console.log(`Last missing index: ${missingIndices[missingIndices.length - 1]}`);

  // Check if it's a contiguous range
  const uploadedMin = Math.min(...uploadedIndices);
  const uploadedMax = Math.max(...uploadedIndices);
  const expectedUploaded = uploadedMax - uploadedMin + 1;
  console.log(`\nExpected uploads in range: ${expectedUploaded}`);
  console.log(`Actual uploads: ${uploadedIndices.length}`);
  console.log(`Gaps in upload sequence: ${expectedUploaded - uploadedIndices.length}`);

  // Calculate estimated remaining upload size
  const sampleSize = Math.min(100, missingFiles.length);
  const sampleSizes = await Promise.all(
    missingFiles.slice(0, sampleSize).map(async (f) => {
      const s = await stat(join(LOCAL_DIR, f));
      return s.size;
    })
  );
  const avgFileSize = sampleSizes.reduce((a, b) => a + b, 0) / sampleSizes.length;
  const estimatedTotalMissing = avgFileSize * missingFiles.length;
  console.log(
    `\nEstimated missing data: ${(estimatedTotalMissing / 1024 / 1024 / 1024).toFixed(2)} GB`
  );
}

main().catch(console.error);
