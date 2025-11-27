/**
 * OneDrive client for downloading categorized documents from /AI-Training/
 */

import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

interface OneDriveDocument {
  id: string;
  name: string;
  category: string;
  downloadUrl: string;
  size: number;
  mimeType: string;
}

interface CategoryFolder {
  name: string;
  documents: OneDriveDocument[];
  metadataJson?: Record<string, unknown>;
}

/**
 * Create Microsoft Graph client with access token
 */
export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Discover all category folders under /AI-Training/
 */
export async function discoverCategories(client: Client): Promise<string[]> {
  const response = await client
    .api('/me/drive/root:/AI-Training:/children')
    .filter('folder ne null')
    .select('name')
    .get();

  return response.value.map((folder: { name: string }) => folder.name);
}

/**
 * Get all documents in a category folder
 */
export async function getCategoryDocuments(
  client: Client,
  category: string
): Promise<CategoryFolder> {
  const folderPath = `/me/drive/root:/AI-Training/${category}:/children`;

  const response = await client
    .api(folderPath)
    .select('id,name,size,file,@microsoft.graph.downloadUrl')
    .get();

  const documents: OneDriveDocument[] = [];
  let metadataJson: Record<string, unknown> | undefined;

  for (const item of response.value) {
    if (item.name === '_metadata.json') {
      // Download and parse metadata
      const metadataResponse = await fetch(item['@microsoft.graph.downloadUrl']);
      metadataJson = await metadataResponse.json();
      continue;
    }

    // Only include PDF and DOCX files
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext || '')) {
      continue;
    }

    documents.push({
      id: item.id,
      name: item.name,
      category,
      downloadUrl: item['@microsoft.graph.downloadUrl'],
      size: item.size,
      mimeType: item.file?.mimeType || 'application/octet-stream',
    });
  }

  return {
    name: category,
    documents,
    metadataJson,
  };
}

/**
 * Download document content as Buffer
 */
export async function downloadDocument(doc: OneDriveDocument): Promise<Buffer> {
  const response = await fetch(doc.downloadUrl);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Find all unprocessed documents across all categories
 */
export async function discoverAllDocuments(
  client: Client,
  processedIds: Set<string>
): Promise<{ categories: CategoryFolder[]; newCount: number; skippedCount: number }> {
  const categoryNames = await discoverCategories(client);
  const categories: CategoryFolder[] = [];
  let newCount = 0;
  let skippedCount = 0;

  for (const categoryName of categoryNames) {
    const category = await getCategoryDocuments(client, categoryName);

    // Filter out already processed documents
    const newDocuments = category.documents.filter((doc) => {
      if (processedIds.has(doc.id)) {
        skippedCount++;
        return false;
      }
      newCount++;
      return true;
    });

    if (newDocuments.length > 0) {
      categories.push({
        ...category,
        documents: newDocuments,
      });
    }
  }

  return { categories, newCount, skippedCount };
}

export type { OneDriveDocument, CategoryFolder };
