import type { ScrapedTemplate } from './scraper';
import type { MapaTemplate } from '@/types/mapa';
import fs from 'fs/promises';
import path from 'path';

// Storage file path (in .next/cache for Vercel compatibility)
const STORAGE_DIR =
  process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), '.next', 'cache');
const STORAGE_FILE = 'onrc-templates.json';

interface StorageData {
  templates: ScrapedTemplate[];
  lastSyncAt: string;
  lastSyncSuccess: boolean;
  syncCount: number;
  aiEnhancedCount?: number;
}

const MOCK_ADMIN_USER = {
  id: 'system',
  firstName: 'ONRC',
  lastName: 'Sync',
  initials: 'OS',
};

/**
 * Get the storage file path, creating directory if needed
 */
async function getStoragePath(): Promise<string> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
  return path.join(STORAGE_DIR, STORAGE_FILE);
}

/**
 * Read stored templates
 */
async function readStorage(): Promise<StorageData | null> {
  try {
    const filePath = await getStoragePath();
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Write templates to storage
 */
async function writeStorage(data: StorageData): Promise<void> {
  const filePath = await getStoragePath();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Save scraped templates to storage
 */
export async function saveTemplates(templates: ScrapedTemplate[]): Promise<void> {
  const existing = await readStorage();
  const aiEnhancedCount = templates.filter((t) => t.aiEnhanced).length;

  const data: StorageData = {
    templates,
    lastSyncAt: new Date().toISOString(),
    lastSyncSuccess: templates.every((t) => !t.error),
    syncCount: (existing?.syncCount || 0) + 1,
    aiEnhancedCount,
  };

  await writeStorage(data);
}

/**
 * Get last sync information
 */
export async function getLastSyncInfo(): Promise<{
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  templateCount: number;
  syncCount: number;
  aiEnhancedCount: number;
}> {
  const data = await readStorage();

  return {
    lastSyncAt: data?.lastSyncAt || null,
    lastSyncSuccess: data?.lastSyncSuccess ?? false,
    templateCount: data?.templates?.length || 0,
    syncCount: data?.syncCount || 0,
    aiEnhancedCount: data?.aiEnhancedCount || 0,
  };
}

/**
 * Get stored templates
 */
export async function getStoredTemplates(): Promise<ScrapedTemplate[]> {
  const data = await readStorage();
  return data?.templates || [];
}

/**
 * Convert scraped templates to MapaTemplate format
 */
export function convertToMapaTemplates(scraped: ScrapedTemplate[]): MapaTemplate[] {
  return scraped.map((template) => {
    // Build description with AI summary if available
    let description = template.description;
    if (template.procedureSummary) {
      description = `${template.description}\n\n${template.procedureSummary}`;
    }

    return {
      id: template.id,
      firmId: 'system',
      name: template.name,
      description,
      isONRC: true,
      isActive: true,
      isLocked: true,
      sourceUrl: template.sourceUrl,
      lastSynced: template.scrapedAt,
      contentHash: template.contentHash,
      createdAt: template.scrapedAt,
      updatedAt: template.scrapedAt,
      createdBy: MOCK_ADMIN_USER,
      slotDefinitions: template.slotDefinitions,
      usageCount: 0,
      // AI metadata (can be extended in MapaTemplate type if needed)
      ...(template.aiEnhanced && {
        aiMetadata: {
          enhanced: template.aiEnhanced,
          confidence: template.aiConfidence,
          legalContext: template.legalContext,
          warnings: template.aiWarnings,
        },
      }),
    };
  });
}

/**
 * Get templates in MapaTemplate format (for hooks)
 */
export async function getMapaTemplates(): Promise<MapaTemplate[]> {
  const scraped = await getStoredTemplates();
  return convertToMapaTemplates(scraped);
}
