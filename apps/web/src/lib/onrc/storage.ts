import type { ScrapedTemplate } from './scraper';
import type { MapaTemplate } from '@/types/mapa';

// ============================================================================
// Gateway URL Resolution
// ============================================================================

/**
 * Get the gateway base URL for server-side operations
 * Uses environment variables for reliable server-side behavior
 */
function getServerGatewayUrl(): string {
  // Use explicit API URL if set (should NOT include /graphql)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/graphql$/, '');
  }

  // In production (Vercel), use the production gateway
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return 'https://legal-platform-gateway.onrender.com';
  }

  // Default to local seed gateway for development
  return 'http://localhost:4000';
}

// ============================================================================
// GraphQL Operations
// ============================================================================

const SAVE_ONRC_TEMPLATES_MUTATION = `
  mutation SaveONRCTemplates($templates: [ONRCTemplateInput!]!) {
    saveONRCTemplates(templates: $templates) {
      success
      message
      syncedCount
      errorCount
      errors {
        procedureId
        error
      }
      syncedAt
    }
  }
`;

const GET_ONRC_TEMPLATES_QUERY = `
  query GetONRCTemplates {
    onrcTemplates {
      id
      name
      description
      procedureId
      sourceUrl
      lastSynced
      contentHash
      slotDefinitions {
        name
        description
        category
        required
        order
      }
      isONRC
      isLocked
      aiMetadata
    }
  }
`;

const GET_ONRC_SYNC_STATUS_QUERY = `
  query GetONRCSyncStatus {
    onrcSyncStatus {
      lastSyncAt
      templateCount
      aiEnhancedCount
      syncAvailable
    }
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

interface UserContext {
  userId: string;
  firmId: string;
  role: string;
  email: string;
}

/**
 * Make a GraphQL request to the gateway
 */
async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  userContext?: UserContext
): Promise<T> {
  const gatewayUrl = getServerGatewayUrl();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add user context if provided
  if (userContext) {
    headers['x-mock-user'] = JSON.stringify(userContext);
  }

  const response = await fetch(`${gatewayUrl}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors[0].message);
  }

  return result.data;
}

// ============================================================================
// Public API
// ============================================================================

const MOCK_ADMIN_USER: UserContext = {
  userId: 'system',
  firmId: 'system',
  role: 'Partner',
  email: 'system@onrc.ro',
};

/**
 * Save scraped templates to the database via GraphQL
 */
export async function saveTemplates(
  templates: ScrapedTemplate[],
  userContext?: UserContext
): Promise<{
  success: boolean;
  message: string;
  syncedCount: number;
  errorCount: number;
}> {
  // Convert ScrapedTemplate to ONRCTemplateInput format
  const input = templates.map((t) => ({
    procedureId: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    subcategory: t.subcategory,
    sourceUrl: t.sourceUrl,
    contentHash: t.contentHash,
    scrapedAt: t.scrapedAt,
    slotDefinitions: t.slotDefinitions,
    aiEnhanced: t.aiEnhanced,
    aiConfidence: t.aiConfidence,
    procedureSummary: t.procedureSummary,
    legalContext: t.legalContext,
    aiWarnings: t.aiWarnings,
  }));

  const result = await graphqlRequest<{
    saveONRCTemplates: {
      success: boolean;
      message: string;
      syncedCount: number;
      errorCount: number;
    };
  }>(SAVE_ONRC_TEMPLATES_MUTATION, { templates: input }, userContext || MOCK_ADMIN_USER);

  return result.saveONRCTemplates;
}

/**
 * Get last sync information from the database
 */
export async function getLastSyncInfo(userContext?: UserContext): Promise<{
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  templateCount: number;
  syncCount: number;
  aiEnhancedCount: number;
}> {
  try {
    const result = await graphqlRequest<{
      onrcSyncStatus: {
        lastSyncAt: string | null;
        templateCount: number;
        aiEnhancedCount: number;
        syncAvailable: boolean;
      };
    }>(GET_ONRC_SYNC_STATUS_QUERY, {}, userContext || MOCK_ADMIN_USER);

    return {
      lastSyncAt: result.onrcSyncStatus.lastSyncAt,
      lastSyncSuccess: true,
      templateCount: result.onrcSyncStatus.templateCount,
      syncCount: 0, // Not tracked in DB
      aiEnhancedCount: result.onrcSyncStatus.aiEnhancedCount,
    };
  } catch {
    return {
      lastSyncAt: null,
      lastSyncSuccess: false,
      templateCount: 0,
      syncCount: 0,
      aiEnhancedCount: 0,
    };
  }
}

/**
 * Get stored templates from the database
 */
export async function getStoredTemplates(userContext?: UserContext): Promise<ScrapedTemplate[]> {
  try {
    const result = await graphqlRequest<{
      onrcTemplates: Array<{
        id: string;
        name: string;
        description: string | null;
        procedureId: string | null;
        sourceUrl: string | null;
        lastSynced: string | null;
        contentHash: string | null;
        slotDefinitions: Array<{
          name: string;
          description?: string;
          category?: string;
          required: boolean;
          order: number;
        }>;
        aiMetadata: {
          enhanced?: boolean;
          confidence?: number;
          legalContext?: string;
          warnings?: string[];
          procedureSummary?: string;
        } | null;
      }>;
    }>(GET_ONRC_TEMPLATES_QUERY, {}, userContext || MOCK_ADMIN_USER);

    return result.onrcTemplates.map((t) => ({
      id: t.procedureId || t.id,
      name: t.name,
      description: t.description || '',
      sourceUrl: t.sourceUrl || '',
      category: '',
      subcategory: '',
      slotDefinitions: t.slotDefinitions,
      contentHash: t.contentHash || '',
      scrapedAt: t.lastSynced || new Date().toISOString(),
      aiEnhanced: t.aiMetadata?.enhanced,
      aiConfidence: t.aiMetadata?.confidence,
      procedureSummary: t.aiMetadata?.procedureSummary,
      legalContext: t.aiMetadata?.legalContext,
      aiWarnings: t.aiMetadata?.warnings,
    }));
  } catch {
    return [];
  }
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
      firmId: null,
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
      createdBy: null,
      slotDefinitions: template.slotDefinitions,
      usageCount: 0,
      // AI metadata
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
export async function getMapaTemplates(userContext?: UserContext): Promise<MapaTemplate[]> {
  const scraped = await getStoredTemplates(userContext);
  return convertToMapaTemplates(scraped);
}
