#!/usr/bin/env npx ts-node
/**
 * R2 Cleanup Script
 * Lists and optionally deletes all objects in the R2 bucket
 *
 * Usage:
 *   npx ts-node scripts/cleanup-r2.ts --list       # List objects and size
 *   npx ts-node scripts/cleanup-r2.ts --delete     # Delete all objects
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '7309c55b8f6a44b8d9ddafc5c3eeb545';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '8c7ce7ef12e18978c15088d04a258a2a';
const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY ||
  '0792cebe9d6b64927844b9ad1c2f31d60523eec61c2a3d210e9f6fa8c54d1e92';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'legacy-import';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function listObjects(
  client: S3Client
): Promise<{
  count: number;
  totalSize: number;
  prefixes: Map<string, { count: number; size: number }>;
}> {
  let continuationToken: string | undefined;
  let totalCount = 0;
  let totalSize = 0;
  const prefixes = new Map<string, { count: number; size: number }>();

  console.log('Scanning R2 bucket...\n');

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        totalCount++;
        totalSize += obj.Size || 0;

        // Group by first path segment (e.g., "documents", "pst")
        const prefix = obj.Key?.split('/')[0] || 'root';
        const current = prefixes.get(prefix) || { count: 0, size: 0 };
        current.count++;
        current.size += obj.Size || 0;
        prefixes.set(prefix, current);
      }
    }

    continuationToken = response.NextContinuationToken;

    if (totalCount % 5000 === 0) {
      console.log(`  Scanned ${totalCount} objects...`);
    }
  } while (continuationToken);

  return { count: totalCount, totalSize, prefixes };
}

async function deleteAllObjects(client: S3Client): Promise<number> {
  let continuationToken: string | undefined;
  let deletedCount = 0;

  console.log('Deleting all objects from R2 bucket...\n');

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    });

    const response = await client.send(listCommand);

    if (response.Contents && response.Contents.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: response.Contents.map((obj) => ({ Key: obj.Key! })),
          Quiet: true,
        },
      });

      await client.send(deleteCommand);
      deletedCount += response.Contents.length;
      console.log(`  Deleted ${deletedCount} objects...`);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return deletedCount;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldDelete = args.includes('--delete');
  const shouldList = args.includes('--list') || !shouldDelete;

  console.log('=== R2 Bucket Cleanup ===');
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Endpoint: ${R2_ENDPOINT}\n`);

  const client = getR2Client();

  if (shouldList) {
    const { count, totalSize, prefixes } = await listObjects(client);

    console.log('\n=== Summary ===');
    console.log(`Total objects: ${count.toLocaleString()}`);
    console.log(`Total size: ${formatBytes(totalSize)}`);
    console.log('\nBy prefix:');

    for (const [prefix, stats] of prefixes) {
      console.log(
        `  ${prefix}/: ${stats.count.toLocaleString()} objects, ${formatBytes(stats.size)}`
      );
    }

    if (!shouldDelete && count > 0) {
      console.log('\nTo delete all objects, run:');
      console.log('  npx ts-node scripts/cleanup-r2.ts --delete');
    }
  }

  if (shouldDelete) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('\n⚠️  Are you sure you want to delete ALL objects? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() === 'yes') {
      const deleted = await deleteAllObjects(client);
      console.log(`\n✅ Deleted ${deleted.toLocaleString()} objects`);
    } else {
      console.log('\n❌ Aborted');
    }
  }
}

main().catch(console.error);
