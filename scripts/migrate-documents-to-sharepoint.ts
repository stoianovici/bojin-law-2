#!/usr/bin/env npx ts-node
/**
 * OPS-110: Document Migration to SharePoint
 *
 * Migrates existing documents from OneDrive to SharePoint.
 * This enables all firm members to access documents regardless of who uploaded them.
 *
 * Prerequisites:
 * - SHAREPOINT_SITE_ID and SHAREPOINT_DRIVE_ID must be configured
 * - User running this script must have:
 *   - Files.Read.All permission (to read from other users' OneDrives)
 *   - Sites.ReadWrite.All permission (to upload to SharePoint)
 *
 * Usage:
 *   # Dry run (no changes)
 *   npx ts-node scripts/migrate-documents-to-sharepoint.ts --dry-run
 *
 *   # Migrate with limit
 *   npx ts-node scripts/migrate-documents-to-sharepoint.ts --limit 10
 *
 *   # Full migration
 *   npx ts-node scripts/migrate-documents-to-sharepoint.ts
 *
 *   # With custom access token (from env or argument)
 *   ACCESS_TOKEN=xxx npx ts-node scripts/migrate-documents-to-sharepoint.ts
 */

import { PrismaClient } from '@prisma/client';
import { Client } from '@microsoft/microsoft-graph-client';

// ============================================================================
// Configuration
// ============================================================================

const prisma = new PrismaClient();

interface MigrationConfig {
  dryRun: boolean;
  limit: number;
  accessToken: string | undefined;
  verbose: boolean;
}

interface MigrationResult {
  documentId: string;
  fileName: string;
  status: 'success' | 'skipped' | 'error';
  error?: string;
  sharePointItemId?: string;
}

// ============================================================================
// Graph API Helpers
// ============================================================================

/**
 * Create a Graph client with the given access token
 */
function createGraphClient(accessToken: string): Client {
  return Client.init({
    defaultVersion: 'v1.0',
    debugLogging: false,
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Download file content from OneDrive
 *
 * Uses /users/{userId}/drive/items/{itemId}/content to access files
 * from any user's OneDrive (requires Files.Read.All permission)
 */
async function downloadFromOneDrive(
  client: Client,
  oneDriveId: string,
  oneDriveUserId: string
): Promise<Buffer> {
  const endpoint = `/users/${oneDriveUserId}/drive/items/${oneDriveId}/content`;

  // Get the download URL
  const response = await client.api(endpoint).getStream();

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

/**
 * Ensure SharePoint case folder exists
 */
async function ensureCaseFolder(
  client: Client,
  siteId: string,
  caseNumber: string
): Promise<string> {
  const sanitizedCaseNumber = caseNumber
    .replace(/[<>:"/\\|?*#%]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 255);

  // Try to create Cases folder (idempotent)
  try {
    await client.api(`/sites/${siteId}/drive/root/children`).post({
      name: 'Cases',
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
  } catch (error: any) {
    // Ignore if folder already exists
    if (error.statusCode !== 409 && error.code !== 'nameAlreadyExists') {
      throw error;
    }
  }

  // Get Cases folder ID
  const casesFolder = await client
    .api(`/sites/${siteId}/drive/root/children`)
    .filter(`name eq 'Cases'`)
    .get();

  const casesFolderId = casesFolder.value[0]?.id;
  if (!casesFolderId) {
    throw new Error('Failed to find/create Cases folder');
  }

  // Try to create case folder
  try {
    await client.api(`/sites/${siteId}/drive/items/${casesFolderId}/children`).post({
      name: sanitizedCaseNumber,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
  } catch (error: any) {
    if (error.statusCode !== 409 && error.code !== 'nameAlreadyExists') {
      throw error;
    }
  }

  // Get case folder ID
  const caseFolder = await client
    .api(`/sites/${siteId}/drive/items/${casesFolderId}/children`)
    .filter(`name eq '${sanitizedCaseNumber}'`)
    .get();

  const caseFolderId = caseFolder.value[0]?.id;
  if (!caseFolderId) {
    throw new Error(`Failed to find/create case folder: ${sanitizedCaseNumber}`);
  }

  // Try to create Documents folder
  try {
    await client.api(`/sites/${siteId}/drive/items/${caseFolderId}/children`).post({
      name: 'Documents',
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
  } catch (error: any) {
    if (error.statusCode !== 409 && error.code !== 'nameAlreadyExists') {
      throw error;
    }
  }

  // Get Documents folder ID
  const docsFolder = await client
    .api(`/sites/${siteId}/drive/items/${caseFolderId}/children`)
    .filter(`name eq 'Documents'`)
    .get();

  const docsFolderId = docsFolder.value[0]?.id;
  if (!docsFolderId) {
    throw new Error(`Failed to find/create Documents folder for case: ${sanitizedCaseNumber}`);
  }

  return docsFolderId;
}

/**
 * Upload file to SharePoint
 */
async function uploadToSharePoint(
  client: Client,
  siteId: string,
  folderId: string,
  fileName: string,
  content: Buffer,
  fileType: string
): Promise<{ id: string; webUrl: string }> {
  // Sanitize file name
  const sanitizedFileName = fileName
    .replace(/[<>:"/\\|?*#%]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 250);

  // Use simple upload for small files, resumable for larger ones
  const MAX_SIMPLE_SIZE = 4 * 1024 * 1024; // 4MB

  if (content.length <= MAX_SIMPLE_SIZE) {
    // Simple upload
    const response = await client
      .api(`/sites/${siteId}/drive/items/${folderId}:/${sanitizedFileName}:/content`)
      .header('Content-Type', fileType)
      .put(content);

    return {
      id: response.id,
      webUrl: response.webUrl,
    };
  } else {
    // Resumable upload for larger files
    const session = await client
      .api(`/sites/${siteId}/drive/items/${folderId}:/${sanitizedFileName}:/createUploadSession`)
      .post({
        item: {
          '@microsoft.graph.conflictBehavior': 'replace',
          name: sanitizedFileName,
        },
      });

    const uploadUrl = session.uploadUrl;
    const fileSize = content.length;
    const CHUNK_SIZE = 320 * 1024; // 320KB chunks
    let offset = 0;
    let response: any;

    while (offset < fileSize) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE, fileSize);
      const chunk = content.slice(offset, chunkEnd);
      const contentRange = `bytes ${offset}-${chunkEnd - 1}/${fileSize}`;

      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length.toString(),
          'Content-Range': contentRange,
        },
        body: chunk,
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`Upload chunk failed: ${response.status} ${response.statusText}`);
      }

      offset = chunkEnd;
    }

    const result = await response.json();
    return {
      id: result.id,
      webUrl: result.webUrl,
    };
  }
}

// ============================================================================
// Migration Logic
// ============================================================================

async function migrateDocument(
  client: Client,
  siteId: string,
  document: {
    id: string;
    fileName: string;
    fileType: string;
    oneDriveId: string;
    oneDriveUserId: string;
    caseNumber: string;
  },
  config: MigrationConfig
): Promise<MigrationResult> {
  const { id, fileName, fileType, oneDriveId, oneDriveUserId, caseNumber } = document;

  try {
    if (config.verbose) {
      console.log(`  Downloading from OneDrive (user: ${oneDriveUserId})...`);
    }

    // Download from OneDrive
    const content = await downloadFromOneDrive(client, oneDriveId, oneDriveUserId);

    if (config.verbose) {
      console.log(`  Downloaded ${content.length} bytes`);
    }

    if (config.dryRun) {
      console.log(
        `  [DRY RUN] Would upload to SharePoint: Cases/${caseNumber}/Documents/${fileName}`
      );
      return { documentId: id, fileName, status: 'success' };
    }

    // Ensure case folder exists
    if (config.verbose) {
      console.log(`  Ensuring case folder: Cases/${caseNumber}/Documents`);
    }
    const folderId = await ensureCaseFolder(client, siteId, caseNumber);

    // Upload to SharePoint
    if (config.verbose) {
      console.log(`  Uploading to SharePoint...`);
    }
    const spItem = await uploadToSharePoint(client, siteId, folderId, fileName, content, fileType);

    // Update database
    if (config.verbose) {
      console.log(`  Updating database with SharePoint ID: ${spItem.id}`);
    }
    await prisma.document.update({
      where: { id },
      data: {
        sharePointItemId: spItem.id,
        sharePointPath: spItem.webUrl,
      },
    });

    return {
      documentId: id,
      fileName,
      status: 'success',
      sharePointItemId: spItem.id,
    };
  } catch (error: any) {
    return {
      documentId: id,
      fileName,
      status: 'error',
      error: error.message || String(error),
    };
  }
}

async function runMigration(config: MigrationConfig): Promise<void> {
  console.log('\n========================================');
  console.log('OPS-110: Document Migration to SharePoint');
  console.log('========================================\n');

  // Validate configuration
  const siteId = process.env.SHAREPOINT_SITE_ID;
  if (!siteId) {
    throw new Error('SHAREPOINT_SITE_ID environment variable is required');
  }

  if (config.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Access token only required for actual migration
  if (!config.dryRun && !config.accessToken) {
    throw new Error(
      'Access token is required. Set ACCESS_TOKEN environment variable or provide via --token argument'
    );
  }

  // Create Graph client (may be undefined in dry-run mode)
  const client = config.accessToken ? createGraphClient(config.accessToken) : null;

  // Find documents to migrate
  // Documents with oneDriveId but no sharePointItemId (not yet migrated)
  // AND have oneDriveUserId (we know who owns them in OneDrive)
  const documents = await prisma.document.findMany({
    where: {
      oneDriveId: { not: null },
      oneDriveUserId: { not: null },
      sharePointItemId: null,
    },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      oneDriveId: true,
      oneDriveUserId: true,
      caseLinks: {
        select: {
          case: {
            select: {
              caseNumber: true,
            },
          },
        },
        take: 1, // Get primary case
      },
    },
    take: config.limit > 0 ? config.limit : undefined,
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${documents.length} documents to migrate\n`);

  if (documents.length === 0) {
    console.log('No documents need migration. All done! ✓');
    return;
  }

  // Process documents
  const results: MigrationResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const caseNumber = doc.caseLinks[0]?.case?.caseNumber;

    console.log(`[${i + 1}/${documents.length}] ${doc.fileName}`);

    if (!caseNumber) {
      console.log('  ⚠️  Skipped: No case link found');
      results.push({
        documentId: doc.id,
        fileName: doc.fileName,
        status: 'skipped',
        error: 'No case link found',
      });
      skippedCount++;
      continue;
    }

    if (!doc.oneDriveUserId) {
      console.log('  ⚠️  Skipped: No oneDriveUserId (cannot determine owner)');
      results.push({
        documentId: doc.id,
        fileName: doc.fileName,
        status: 'skipped',
        error: 'No oneDriveUserId',
      });
      skippedCount++;
      continue;
    }

    // In dry-run mode without token, just report what would be migrated
    if (config.dryRun && !client) {
      console.log(`  [DRY RUN] Would migrate: Cases/${caseNumber}/Documents/${doc.fileName}`);
      console.log(
        `            Size: ${(doc.fileSize / 1024).toFixed(1)} KB, Type: ${doc.fileType}`
      );
      results.push({ documentId: doc.id, fileName: doc.fileName, status: 'success' });
      successCount++;
      continue;
    }

    const result = await migrateDocument(
      client!,
      siteId,
      {
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        oneDriveId: doc.oneDriveId!,
        oneDriveUserId: doc.oneDriveUserId,
        caseNumber,
      },
      config
    );

    results.push(result);

    if (result.status === 'success') {
      console.log(`  ✓ Migrated successfully`);
      successCount++;
    } else if (result.status === 'error') {
      console.log(`  ✗ Error: ${result.error}`);
      errorCount++;
    }

    // Rate limit to avoid throttling
    if (!config.dryRun && i < documents.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('Migration Summary');
  console.log('========================================');
  console.log(`Total documents:  ${documents.length}`);
  console.log(`Successful:       ${successCount}`);
  console.log(`Skipped:          ${skippedCount}`);
  console.log(`Errors:           ${errorCount}`);

  if (errorCount > 0) {
    console.log('\nFailed documents:');
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => {
        console.log(`  - ${r.fileName}: ${r.error}`);
      });
  }

  if (config.dryRun) {
    console.log('\n📝 This was a dry run. Run without --dry-run to apply changes.');
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);

  const config: MigrationConfig = {
    dryRun: args.includes('--dry-run'),
    limit: 0,
    accessToken: process.env.ACCESS_TOKEN,
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  // Parse --limit
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    config.limit = parseInt(args[limitIndex + 1], 10);
  }

  // Parse --token
  const tokenIndex = args.indexOf('--token');
  if (tokenIndex !== -1 && args[tokenIndex + 1]) {
    config.accessToken = args[tokenIndex + 1];
  }

  return config;
}

async function main() {
  const config = parseArgs();

  try {
    await runMigration(config);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
OPS-110: Document Migration to SharePoint

Usage:
  npx ts-node scripts/migrate-documents-to-sharepoint.ts [options]

Options:
  --dry-run       Preview migration without making changes
  --limit N       Only migrate first N documents
  --token TOKEN   Provide access token (or set ACCESS_TOKEN env var)
  --verbose, -v   Show detailed progress
  --help, -h      Show this help message

Environment Variables:
  ACCESS_TOKEN         MS Graph access token with Files.Read.All and Sites.ReadWrite.All
  SHAREPOINT_SITE_ID   SharePoint site ID for document storage

Examples:
  # Dry run to see what would be migrated
  npx ts-node scripts/migrate-documents-to-sharepoint.ts --dry-run

  # Migrate first 10 documents
  npx ts-node scripts/migrate-documents-to-sharepoint.ts --limit 10 --verbose

  # Full migration with token from env
  ACCESS_TOKEN=xxx npx ts-node scripts/migrate-documents-to-sharepoint.ts
`);
  process.exit(0);
}

main().catch(console.error);
