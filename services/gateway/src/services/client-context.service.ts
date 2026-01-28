/**
 * Client Context Aggregation Service
 * OPS-260: Aggregates comprehensive client information for AI assistant context injection.
 *
 * Provides rich context about clients including their case portfolio, communication patterns,
 * contact information, and relationship history. Target: ~350-400 tokens per client.
 */

import { prisma, redis } from '@legal-platform/database';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ClientContext {
  // Basic info
  id: string;
  name: string;
  type: 'individual' | 'company';
  address?: string;
  contactInfo: ClientContactInfo;

  // Relationship timeline
  relationshipStartDate: string;
  totalCaseCount: number;
  activeCaseCount: number;
  closedCaseCount: number;

  // Case portfolio summary
  casesByType: { type: string; count: number }[];
  recentCases: { id: string; title: string; status: string; type: string }[];

  // Contacts from case actors
  primaryContacts: ContactInfo[];

  // Communication stats
  lastCommunicationDate?: string;
  totalEmailCount: number;
}

export interface ClientContactInfo {
  email?: string;
  phone?: string;
  cui?: string; // Company registration number (Romania)
}

export interface ContactInfo {
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

interface ClientContextCacheEntry {
  data: ClientContext;
  contextText: string;
  cachedAt: string;
}

// ============================================================================
// Service
// ============================================================================

export class ClientContextService {
  private readonly CACHE_TTL = 60 * 60; // 1 hour in seconds
  private readonly CACHE_KEY_PREFIX = 'client-context:';

  /**
   * Get aggregated client context
   * Target: ~350-400 tokens
   */
  async getForClient(clientId: string, firmId: string): Promise<ClientContext> {
    // Try cache first
    const cached = await this.getFromCache(clientId);
    if (cached) {
      logger.debug('Client context cache hit', { clientId });
      return cached;
    }

    // Generate fresh context
    logger.debug('Client context cache miss, generating', { clientId });
    const context = await this.generateContext(clientId, firmId);

    // Cache it
    await this.saveToCache(clientId, context);

    return context;
  }

  /**
   * Get client context formatted for AI system prompt
   */
  async getContextText(clientId: string, firmId: string): Promise<string> {
    // Try cache first (text is stored alongside data)
    const cacheKey = `${this.CACHE_KEY_PREFIX}${clientId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: ClientContextCacheEntry = JSON.parse(cached);
        return entry.contextText;
      }
    } catch {
      // Cache miss or error, continue to generate
    }

    // Generate and return
    const context = await this.getForClient(clientId, firmId);
    return this.formatForPrompt(context);
  }

  /**
   * Invalidate client context cache
   */
  async invalidate(clientId: string): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${clientId}`;
    try {
      await redis.del(cacheKey);
      logger.debug('Client context cache invalidated', { clientId });
    } catch (error) {
      logger.warn('Failed to invalidate client context cache', { clientId, error });
    }
  }

  /**
   * Generate fresh client context from database
   */
  private async generateContext(clientId: string, firmId: string): Promise<ClientContext> {
    // Parallel data gathering
    const [client, cases, actors, lastEmail] = await Promise.all([
      // Client with basic info
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          clientType: true,
          address: true,
          contactInfo: true,
          createdAt: true,
        },
      }),

      // All cases for this client in this firm
      prisma.case.findMany({
        where: { clientId, firmId },
        select: {
          id: true,
          title: true,
          status: true,
          type: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Contacts from case actors (client representatives)
      // Note: CaseActorRole enum only has Client, Other, etc. - not CLIENT_REPRESENTATIVE
      prisma.caseActor.findMany({
        where: {
          case: { clientId, firmId },
          role: { in: ['Client', 'Other'] },
        },
        select: {
          name: true,
          email: true,
          phone: true,
          role: true,
        },
        distinct: ['email'],
        take: 10, // Get more to dedupe later
      }),

      // Last communication date
      prisma.email.findFirst({
        where: {
          caseLinks: {
            some: {
              case: { clientId, firmId },
            },
          },
        },
        orderBy: { receivedDateTime: 'desc' },
        select: { receivedDateTime: true },
      }),
    ]);

    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Count emails linked to client's cases
    const emailCount = await prisma.email.count({
      where: {
        caseLinks: {
          some: {
            case: { clientId, firmId },
          },
        },
      },
    });

    // Parse contact info from JSON
    const contactInfoRaw = client.contactInfo as Record<string, unknown> | null;
    const contactInfo: ClientContactInfo = {
      email: (contactInfoRaw?.email as string) || undefined,
      phone: (contactInfoRaw?.phone as string) || undefined,
      cui: (contactInfoRaw?.cui as string) || undefined,
    };

    // Aggregate case statistics
    const activeCases = cases.filter((c) => c.status !== 'Closed' && c.status !== 'Archived');
    const closedCases = cases.filter((c) => c.status === 'Closed' || c.status === 'Archived');

    // Group cases by type
    const caseTypeMap = new Map<string, number>();
    for (const c of cases) {
      const currentCount = caseTypeMap.get(c.type) || 0;
      caseTypeMap.set(c.type, currentCount + 1);
    }
    const casesByType = Array.from(caseTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Get 5 most recent cases
    const recentCases = cases.slice(0, 5).map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      type: c.type,
    }));

    // Deduplicate and rank contacts by email
    const primaryContacts = this.dedupeContacts(actors).slice(0, 3);

    return {
      id: client.id,
      name: client.name,
      type: (client.clientType as 'individual' | 'company') || 'company',
      address: client.address || undefined,
      contactInfo,
      relationshipStartDate: client.createdAt.toISOString(),
      totalCaseCount: cases.length,
      activeCaseCount: activeCases.length,
      closedCaseCount: closedCases.length,
      casesByType,
      recentCases,
      primaryContacts,
      lastCommunicationDate: lastEmail?.receivedDateTime?.toISOString(),
      totalEmailCount: emailCount,
    };
  }

  /**
   * Deduplicate contacts by email, keeping the first occurrence
   */
  private dedupeContacts(
    actors: { name: string; email?: string | null; phone?: string | null; role: string }[]
  ): ContactInfo[] {
    const seen = new Set<string>();
    const result: ContactInfo[] = [];

    for (const actor of actors) {
      const key = actor.email?.toLowerCase() || actor.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      result.push({
        name: actor.name,
        email: actor.email || undefined,
        phone: actor.phone || undefined,
        role: this.translateRole(actor.role),
      });
    }

    return result;
  }

  /**
   * Translate actor role to Romanian
   */
  private translateRole(role: string): string {
    const translations: Record<string, string> = {
      Client: 'Client',
      Other: 'Contact',
      OpposingParty: 'Parte adversă',
      OpposingCounsel: 'Avocat adversar',
      Witness: 'Martor',
      Expert: 'Expert',
      LegalRepresentative: 'Reprezentant legal',
    };
    return translations[role] || role;
  }

  /**
   * Format context for AI prompt injection (~350-400 tokens)
   */
  formatForPrompt(ctx: ClientContext): string {
    const lines: string[] = [];

    // Header with client name
    lines.push(`## Client: ${ctx.name}`);

    // Contact info
    const contactParts: string[] = [];
    if (ctx.contactInfo.cui) contactParts.push(`CUI: ${ctx.contactInfo.cui}`);
    if (ctx.contactInfo.email) contactParts.push(`Email: ${ctx.contactInfo.email}`);
    if (ctx.contactInfo.phone) contactParts.push(`Tel: ${ctx.contactInfo.phone}`);
    if (contactParts.length > 0) {
      lines.push(contactParts.join(' | '));
    }

    // Relationship summary
    try {
      const startDate = format(new Date(ctx.relationshipStartDate), 'd MMMM yyyy', { locale: ro });
      lines.push(`Relație din: ${startDate}`);
    } catch {
      // Skip if date parsing fails
    }

    lines.push(`Dosare: ${ctx.activeCaseCount} active, ${ctx.closedCaseCount} închise`);
    lines.push('');

    // Case portfolio by type
    if (ctx.casesByType.length > 0) {
      lines.push('### Portofoliu dosare');
      for (const { type, count } of ctx.casesByType.slice(0, 5)) {
        lines.push(`- ${type}: ${count}`);
      }
      lines.push('');
    }

    // Recent cases
    if (ctx.recentCases.length > 0) {
      lines.push('### Dosare recente');
      for (const c of ctx.recentCases) {
        lines.push(`- ${c.title} (${this.translateStatus(c.status)})`);
      }
      lines.push('');
    }

    // Primary contacts
    if (ctx.primaryContacts.length > 0) {
      lines.push('### Contacte principale');
      for (const contact of ctx.primaryContacts) {
        const parts = [contact.name];
        if (contact.role) parts.push(`(${contact.role})`);
        if (contact.email) parts.push(`: ${contact.email}`);
        lines.push(`- ${parts.join('')}`);
      }
      lines.push('');
    }

    // Communication summary
    if (ctx.totalEmailCount > 0) {
      lines.push('### Comunicare');
      lines.push(`- Total emailuri: ${ctx.totalEmailCount}`);
      if (ctx.lastCommunicationDate) {
        try {
          const lastComm = format(new Date(ctx.lastCommunicationDate), 'd MMMM yyyy', {
            locale: ro,
          });
          lines.push(`- Ultima comunicare: ${lastComm}`);
        } catch {
          // Skip if date parsing fails
        }
      }
    }

    return lines.filter(Boolean).join('\n');
  }

  /**
   * Translate case status to Romanian
   */
  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      Active: 'Activ',
      PendingApproval: 'În aprobare',
      OnHold: 'Suspendat',
      Closed: 'Închis',
      Archived: 'Arhivat',
    };
    return translations[status] || status;
  }

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  /**
   * Get cached context from Redis
   */
  private async getFromCache(clientId: string): Promise<ClientContext | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${clientId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: ClientContextCacheEntry = JSON.parse(cached);
        return entry.data;
      }
    } catch (error) {
      logger.warn('Failed to read client context from cache', { clientId, error });
    }
    return null;
  }

  /**
   * Save context to Redis cache
   */
  private async saveToCache(clientId: string, context: ClientContext): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${clientId}`;
    const entry: ClientContextCacheEntry = {
      data: context,
      contextText: this.formatForPrompt(context),
      cachedAt: new Date().toISOString(),
    };

    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Failed to cache client context', { clientId, error });
    }
  }
}

// Export singleton instance
export const clientContextService = new ClientContextService();
