/**
 * Case Briefing Service
 * OPS-118: Pre-computed case context for AI assistant
 *
 * Generates and caches per-case briefings - summaries of case state (parties, deadlines,
 * recent activity, document counts) for injection into AI system prompts when users
 * are working in case context.
 */

import { prisma, redis } from '@legal-platform/database';
import type {
  CaseBriefingData,
  CaseBriefingParty,
  CaseBriefingEvent,
  RichCaseContext,
  DocumentSummary,
  EmailThreadSummary,
  UpcomingDeadline,
  ContactContext,
  BriefingClientContext,
  HealthIndicator,
} from '@legal-platform/types';
import { format, subDays, addDays, addMinutes, differenceInHours } from 'date-fns';
import { ro } from 'date-fns/locale';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface BriefingCacheEntry {
  data: CaseBriefingData;
  briefingText: string;
  cachedAt: string;
}

// ============================================================================
// Service
// ============================================================================

export class CaseBriefingService {
  private readonly CACHE_TTL = 5 * 60; // 5 minutes in seconds
  private readonly CACHE_KEY_PREFIX = 'case-briefing:';

  /**
   * Get or generate case briefing
   */
  async getBriefing(caseId: string): Promise<CaseBriefingData> {
    // Try cache first
    const cached = await this.getFromCache(caseId);
    if (cached) {
      logger.debug('Case briefing cache hit', { caseId });
      return cached;
    }

    // Generate fresh briefing
    logger.debug('Case briefing cache miss, generating', { caseId });
    const briefing = await this.generateBriefing(caseId);

    // Cache it
    await this.saveToCache(caseId, briefing);
    await this.saveToDB(caseId, briefing);

    return briefing;
  }

  /**
   * Get briefing formatted for AI system prompt (~400-600 tokens)
   */
  async getBriefingText(caseId: string): Promise<string> {
    // Try cache first (text is stored alongside data)
    const cacheKey = `${this.CACHE_KEY_PREFIX}${caseId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: BriefingCacheEntry = JSON.parse(cached);
        return entry.briefingText;
      }
    } catch (error) {
      // Cache miss or error, continue to generate
    }

    // Generate and cache
    const briefing = await this.getBriefing(caseId);
    return this.formatForPrompt(briefing);
  }

  /**
   * Invalidate briefing cache (called when case data changes)
   */
  async invalidate(caseId: string): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${caseId}`;
    try {
      await redis.del(cacheKey);
      logger.debug('Case briefing cache invalidated', { caseId });
    } catch (error) {
      logger.warn('Failed to invalidate case briefing cache', { caseId, error });
    }
  }

  /**
   * Batch invalidate multiple cases (for bulk operations)
   */
  async invalidateMany(caseIds: string[]): Promise<void> {
    if (caseIds.length === 0) return;

    const keys = caseIds.map((id) => `${this.CACHE_KEY_PREFIX}${id}`);
    try {
      await redis.del(...keys);
      logger.debug('Case briefing cache batch invalidated', { count: caseIds.length });
    } catch (error) {
      logger.warn('Failed to batch invalidate case briefing cache', { error });
    }
  }

  /**
   * Generate fresh briefing from database
   */
  private async generateBriefing(caseId: string): Promise<CaseBriefingData> {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const thirtyDaysFromNow = addDays(now, 30);

    // Get case with relations
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        actors: true,
        tasks: {
          where: {
            status: { not: 'Completed' },
            dueDate: { lte: thirtyDaysFromNow },
          },
          orderBy: { dueDate: 'asc' },
          take: 5,
        },
        _count: {
          select: {
            documents: true,
            emailLinks: true,
            tasks: true,
          },
        },
      },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    // Get recent events from CaseActivityEntry
    const recentEvents = await prisma.caseActivityEntry.findMany({
      where: {
        caseId,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Count documents linked to this case
    const documentCount = await prisma.caseDocument.count({
      where: { caseId },
    });

    // Count unread emails linked to this case
    const unreadEmailCount = await prisma.email.count({
      where: {
        caseLinks: { some: { caseId } },
        isRead: false,
      },
    });

    // Build parties list
    const parties: CaseBriefingParty[] = [
      // Client first
      {
        role: 'Client',
        name: caseData.client?.name || 'Necunoscut',
        isClient: true,
      },
      // Other actors
      ...caseData.actors.map((actor) => ({
        role: this.translateRole(actor.role),
        name: actor.name || 'Necunoscut',
        isClient: false,
      })),
    ];

    // Find next deadline
    const nextDeadline =
      caseData.tasks.length > 0 && caseData.tasks[0].dueDate
        ? {
            date: caseData.tasks[0].dueDate.toISOString(),
            description: caseData.tasks[0].title,
          }
        : undefined;

    // Format recent events
    const formattedEvents: CaseBriefingEvent[] = recentEvents.map((e) => ({
      date: e.createdAt.toISOString(),
      type: e.activityType,
      description: e.title,
    }));

    // Extract court info from metadata if available
    const metadata = caseData.metadata as Record<string, unknown> | null;
    const court = (metadata?.court as string) || undefined;

    return {
      caseNumber: caseData.caseNumber || '',
      title: caseData.title,
      status: caseData.status,
      court,

      parties,

      nextDeadline,
      recentEvents: formattedEvents,

      documentCount,
      emailCount: caseData._count.emailLinks,
      unreadEmailCount,
      pendingTaskCount: caseData.tasks.length,
    };
  }

  /**
   * Format briefing for AI system prompt injection (~400-600 tokens)
   */
  private formatForPrompt(briefing: CaseBriefingData): string {
    const lines: string[] = [];

    // Header
    lines.push(`## Dosar: ${briefing.title}`);
    if (briefing.caseNumber) {
      lines.push(
        `Număr: ${briefing.caseNumber} | Status: ${this.translateStatus(briefing.status)}`
      );
    }
    if (briefing.court) {
      lines.push(`Instanță: ${briefing.court}`);
    }
    lines.push('');

    // Parties
    lines.push(`### Părți`);
    for (const party of briefing.parties) {
      const clientMark = party.isClient ? ' (client)' : '';
      lines.push(`- ${party.role}: ${party.name}${clientMark}`);
    }
    lines.push('');

    // Next deadline
    if (briefing.nextDeadline) {
      try {
        const date = format(new Date(briefing.nextDeadline.date), 'd MMMM yyyy', { locale: ro });
        lines.push(`### Următorul termen`);
        lines.push(`${date}: ${briefing.nextDeadline.description}`);
        lines.push('');
      } catch {
        // Skip if date parsing fails
      }
    }

    // Recent events (if any)
    if (briefing.recentEvents.length > 0) {
      lines.push(`### Activitate recentă`);
      for (const event of briefing.recentEvents.slice(0, 3)) {
        try {
          const date = format(new Date(event.date), 'd MMM', { locale: ro });
          lines.push(`- ${date}: ${event.description}`);
        } catch {
          lines.push(`- ${event.description}`);
        }
      }
      lines.push('');
    }

    // Counts
    lines.push(`### Conținut`);
    lines.push(`- Documente: ${briefing.documentCount}`);
    const unreadSuffix =
      briefing.unreadEmailCount > 0 ? ` (${briefing.unreadEmailCount} necitite)` : '';
    lines.push(`- Emailuri: ${briefing.emailCount}${unreadSuffix}`);
    lines.push(`- Sarcini active: ${briefing.pendingTaskCount}`);

    return lines.join('\n');
  }

  /**
   * Translate case status to Romanian
   */
  private translateStatus(status: string): string {
    const translations: Record<string, string> = {
      Active: 'Activ',
      Pending: 'În așteptare',
      Closed: 'Închis',
      OnHold: 'Suspendat',
      Suspended: 'Suspendat',
    };
    return translations[status] || status;
  }

  /**
   * Translate actor role to Romanian
   */
  private translateRole(role: string): string {
    const translations: Record<string, string> = {
      Client: 'Client',
      OpposingParty: 'Parte adversă',
      OpposingCounsel: 'Avocat adversar',
      Witness: 'Martor',
      Expert: 'Expert',
    };
    return translations[role] || role;
  }

  // ============================================================================
  // OPS-262: Rich Context Methods
  // ============================================================================

  /**
   * Get pre-compiled rich context from database
   * OPS-262: Used by AI assistant for comprehensive case understanding
   */
  async getRichContext(caseId: string): Promise<RichCaseContext | null> {
    try {
      const briefing = await prisma.caseBriefing.findUnique({
        where: { caseId },
      });

      if (!briefing) {
        logger.debug('No pre-compiled context found', { caseId });
        return null;
      }

      // Check if rich context fields are populated
      if (
        !briefing.documentSummaries &&
        !briefing.emailThreadSummaries &&
        !briefing.clientContext
      ) {
        logger.debug('Pre-compiled context exists but lacks rich fields', { caseId });
        return null;
      }

      return {
        briefingData: briefing.briefingData as unknown as CaseBriefingData,
        briefingText: briefing.briefingText,
        documentSummaries: (briefing.documentSummaries as unknown as DocumentSummary[]) || [],
        emailThreadSummaries:
          (briefing.emailThreadSummaries as unknown as EmailThreadSummary[]) || [],
        upcomingDeadlines: (briefing.upcomingDeadlines as unknown as UpcomingDeadline[]) || [],
        contactContext: (briefing.contactContext as unknown as ContactContext) || { contacts: [] },
        clientContext: (briefing.clientContext as unknown as BriefingClientContext) || null,
        caseHealthIndicators: (briefing.caseHealthIndicators as unknown as HealthIndicator[]) || [],
        contextVersion: briefing.contextVersion,
        lastComputedAt: briefing.lastComputedAt.toISOString(),
      };
    } catch (error) {
      logger.warn('Failed to get rich context', { caseId, error });
      return null;
    }
  }

  /**
   * Check if pre-compiled context is fresh enough to use
   * Context is fresh if computed within last 24 hours OR validUntil hasn't passed
   */
  isContextFresh(ctx: RichCaseContext): boolean {
    if (!ctx.lastComputedAt) return false;

    const computedAt = new Date(ctx.lastComputedAt);
    const ageHours = differenceInHours(new Date(), computedAt);

    // Context is fresh if computed within last 24 hours
    return ageHours < 24;
  }

  /**
   * Get human-readable age of context for logging
   */
  getContextAge(ctx: RichCaseContext): string {
    if (!ctx.lastComputedAt) return 'necunoscut';

    const computedAt = new Date(ctx.lastComputedAt);
    const hours = differenceInHours(new Date(), computedAt);

    if (hours < 1) return 'sub 1 oră';
    if (hours < 24) return `${Math.round(hours)} ore`;
    return `${Math.round(hours / 24)} zile`;
  }

  /**
   * Format rich context for AI prompt injection (~2000-4000 tokens)
   * OPS-262: Comprehensive context with documents, emails, client info
   */
  formatRichContext(ctx: RichCaseContext): string {
    const sections: string[] = [];

    // Start with the existing briefing text
    sections.push(ctx.briefingText);

    // Add client context if available
    if (ctx.clientContext) {
      sections.push('');
      sections.push('### Context client');
      sections.push(`Relație din: ${ctx.clientContext.relationshipStartDate || 'necunoscut'}`);
      sections.push(
        `Portofoliu: ${ctx.clientContext.activeCaseCount} dosare active, ${ctx.clientContext.closedCaseCount} închise`
      );
      if (ctx.clientContext.primaryContacts?.length > 0) {
        const contact = ctx.clientContext.primaryContacts[0];
        sections.push(`Contact principal: ${contact.name} (${contact.role})`);
      }
    }

    // Add document summaries (top 5)
    if (ctx.documentSummaries?.length > 0) {
      sections.push('');
      sections.push('### Documente cheie');
      for (const doc of ctx.documentSummaries.slice(0, 5)) {
        sections.push(`- **${doc.title}** (${doc.type}): ${doc.summary}`);
      }
    }

    // Add email thread summaries (top 3)
    if (ctx.emailThreadSummaries?.length > 0) {
      sections.push('');
      sections.push('### Comunicări recente');
      for (const thread of ctx.emailThreadSummaries.slice(0, 3)) {
        const urgentMark = thread.isUrgent ? ' ⚠️' : '';
        sections.push(`- **${thread.subject}**${urgentMark}: ${thread.summary}`);
        if (thread.actionItems?.length > 0) {
          for (const action of thread.actionItems.slice(0, 2)) {
            sections.push(`  - Acțiune: ${action}`);
          }
        }
      }
    }

    // Add upcoming deadlines (top 5)
    if (ctx.upcomingDeadlines?.length > 0) {
      sections.push('');
      sections.push('### Termene apropiate');
      for (const deadline of ctx.upcomingDeadlines.slice(0, 5)) {
        const overdueMark = deadline.isOverdue ? ' ⚠️ DEPĂȘIT' : '';
        const daysText =
          deadline.daysUntil === 0
            ? 'AZI'
            : deadline.daysUntil === 1
              ? 'mâine'
              : `în ${deadline.daysUntil} zile`;
        sections.push(`- ${deadline.title} (${daysText})${overdueMark}`);
      }
    }

    // Add health indicators (high severity only)
    const warnings = ctx.caseHealthIndicators?.filter((h) => h.severity === 'high') || [];
    if (warnings.length > 0) {
      sections.push('');
      sections.push('### ⚠️ Atenție');
      for (const warning of warnings) {
        sections.push(`- ${warning.message}`);
      }
    }

    return sections.join('\n');
  }

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  /**
   * Get cached briefing from Redis
   */
  private async getFromCache(caseId: string): Promise<CaseBriefingData | null> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${caseId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: BriefingCacheEntry = JSON.parse(cached);
        return entry.data;
      }
    } catch (error) {
      logger.warn('Failed to read case briefing from cache', { caseId, error });
    }
    return null;
  }

  /**
   * Save briefing to Redis cache
   */
  private async saveToCache(caseId: string, briefing: CaseBriefingData): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}${caseId}`;
    const entry: BriefingCacheEntry = {
      data: briefing,
      briefingText: this.formatForPrompt(briefing),
      cachedAt: new Date().toISOString(),
    };

    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Failed to cache case briefing', { caseId, error });
    }
  }

  /**
   * Save briefing to PostgreSQL for persistence
   */
  private async saveToDB(caseId: string, briefing: CaseBriefingData): Promise<void> {
    try {
      const briefingText = this.formatForPrompt(briefing);
      const now = new Date();

      // Get firmId from the case
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseRecord) {
        logger.warn('Case not found for briefing save', { caseId });
        return;
      }

      await prisma.caseBriefing.upsert({
        where: { caseId },
        create: {
          caseId,
          firmId: caseRecord.firmId,
          briefingText,
          briefingData: JSON.parse(JSON.stringify(briefing)),
          lastComputedAt: now,
          validUntil: addMinutes(now, 30),
        },
        update: {
          briefingText,
          briefingData: JSON.parse(JSON.stringify(briefing)),
          lastComputedAt: now,
          validUntil: addMinutes(now, 30),
        },
      });

      logger.debug('Case briefing saved to DB', { caseId });
    } catch (error) {
      logger.warn('Failed to save case briefing to DB', { caseId, error });
      // Non-critical - cache will still work
    }
  }
}

// Export singleton instance
export const caseBriefingService = new CaseBriefingService();
