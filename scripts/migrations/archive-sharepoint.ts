/**
 * OPS-199: Archive SharePoint Files Before Data Reset
 *
 * This script archives all case folders in SharePoint before the database wipe.
 * Files are moved (not deleted) to an _Archive_{date} folder for potential recovery.
 *
 * Usage:
 *   source .env.prod && npx tsx scripts/migrations/archive-sharepoint.ts
 *
 * Prerequisites:
 *   - MS_ACCESS_TOKEN environment variable (delegated token with Sites.ReadWrite.All)
 *   - SHAREPOINT_SITE_ID environment variable
 *   - SHAREPOINT_DRIVE_ID environment variable
 *
 * To get MS_ACCESS_TOKEN:
 *   1. Log into the app as a partner
 *   2. Open browser DevTools > Network > any GraphQL request > Headers
 *   3. Copy the x-ms-access-token header value
 *   4. export MS_ACCESS_TOKEN="<token>"
 */

import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  siteId: process.env.SHAREPOINT_SITE_ID,
  driveId: process.env.SHAREPOINT_DRIVE_ID,
  accessToken: process.env.MS_ACCESS_TOKEN,
  dryRun: process.argv.includes('--dry-run'),
};

// ============================================================================
// Types
// ============================================================================

interface DriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  webUrl?: string;
}

// ============================================================================
// Graph Client
// ============================================================================

function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// ============================================================================
// SharePoint Operations
// ============================================================================

async function listCaseFolders(client: Client): Promise<DriveItem[]> {
  const { siteId, driveId } = CONFIG;

  try {
    // First check if Cases folder exists
    const casesPath = `/sites/${siteId}/drives/${driveId}/root:/Cases`;
    const casesFolder = await client.api(casesPath).get();

    // List children of Cases folder
    const childrenPath = `/sites/${siteId}/drives/${driveId}/items/${casesFolder.id}/children`;
    const response = await client.api(childrenPath).get();

    // Filter to only folders
    return (response.value as DriveItem[]).filter((item) => item.folder);
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number };
    if (graphError.statusCode === 404) {
      console.log('No Cases folder found - nothing to archive');
      return [];
    }
    throw error;
  }
}

async function createArchiveFolder(client: Client): Promise<DriveItem> {
  const { siteId, driveId } = CONFIG;
  const archiveName = `_Archive_${new Date().toISOString().split('T')[0]}`;

  console.log(`\nCreating archive folder: ${archiveName}`);

  if (CONFIG.dryRun) {
    return { id: 'dry-run-id', name: archiveName };
  }

  try {
    const createPath = `/sites/${siteId}/drives/${driveId}/root/children`;
    const folder = await client.api(createPath).post({
      name: archiveName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    });
    return folder;
  } catch (error: unknown) {
    const graphError = error as { statusCode?: number; body?: { code?: string } };
    // If folder already exists, get it
    if (graphError.statusCode === 409 || graphError.body?.code === 'nameAlreadyExists') {
      const getPath = `/sites/${siteId}/drives/${driveId}/root:/${archiveName}`;
      return client.api(getPath).get();
    }
    throw error;
  }
}

async function moveFolder(
  client: Client,
  folderId: string,
  folderName: string,
  archiveFolderId: string
): Promise<void> {
  const { siteId, driveId } = CONFIG;

  console.log(`  Moving: ${folderName}...`);

  if (CONFIG.dryRun) {
    console.log(`    [DRY RUN] Would move ${folderName} to archive`);
    return;
  }

  try {
    const movePath = `/sites/${siteId}/drives/${driveId}/items/${folderId}`;
    await client.api(movePath).patch({
      parentReference: {
        driveId,
        id: archiveFolderId,
      },
    });
    console.log(`    Moved to archive`);
  } catch (error) {
    console.error(`    Failed to move ${folderName}:`, error);
    throw error;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('========================================');
  console.log('OPS-199: SharePoint Archive Script');
  console.log('========================================\n');

  // Validate configuration
  if (!CONFIG.siteId || !CONFIG.driveId) {
    console.error('Missing SHAREPOINT_SITE_ID or SHAREPOINT_DRIVE_ID');
    process.exit(1);
  }

  if (!CONFIG.accessToken) {
    console.error('Missing MS_ACCESS_TOKEN - see script header for instructions');
    process.exit(1);
  }

  if (CONFIG.dryRun) {
    console.log('*** DRY RUN MODE - No changes will be made ***\n');
  }

  const client = createGraphClient(CONFIG.accessToken);

  // 1. List case folders
  console.log('Scanning for case folders...');
  const caseFolders = await listCaseFolders(client);

  if (caseFolders.length === 0) {
    console.log('\nNo case folders to archive.');
    return;
  }

  console.log(`Found ${caseFolders.length} case folders:\n`);
  for (const folder of caseFolders) {
    const childCount = folder.folder?.childCount ?? 0;
    console.log(`  - ${folder.name} (${childCount} items)`);
  }

  // 2. Create archive folder
  const archiveFolder = await createArchiveFolder(client);
  console.log(`Archive folder ID: ${archiveFolder.id}\n`);

  // 3. Move each case folder to archive
  console.log('Moving case folders to archive...\n');
  let successCount = 0;
  let failCount = 0;

  for (const folder of caseFolders) {
    try {
      await moveFolder(client, folder.id, folder.name, archiveFolder.id);
      successCount++;
    } catch {
      failCount++;
    }
  }

  // 4. Summary
  console.log('\n========================================');
  console.log('Archive Complete');
  console.log('========================================');
  console.log(`  Archived: ${successCount} folders`);
  if (failCount > 0) {
    console.log(`  Failed:   ${failCount} folders`);
  }
  console.log(
    `  Location: ${archiveFolder.name || '_Archive_' + new Date().toISOString().split('T')[0]}`
  );

  if (CONFIG.dryRun) {
    console.log('\n*** This was a DRY RUN - run without --dry-run to execute ***');
  }
}

main().catch((error) => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
