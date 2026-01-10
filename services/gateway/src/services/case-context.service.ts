/**
 * Case Context Service
 * Three-tier context system for AI operations
 *
 * Provides comprehensive "living case file" context with:
 * - Tier 1 (Core): All identity info (~800-1200 tokens) - always included
 * - Tier 2 (Extended): Task-specific operational context (~1500-3000 tokens)
 * - Tier 3 (Historical): Deep analysis context (~2000-5000 tokens) - on-demand
 */

import { prisma, redis } from '@legal-platform/database';
import type {
  CoreContext,
  ExtendedContext,
  HistoricalContext,
  AIOperation,
  AIOperationContext,
  ExtendedSection,
  ClientPersonEntry,
} from '@legal-platform/types';
import { subDays } from 'date-fns';
import logger from '../utils/logger';
import { contextProfiles } from './context-profiles';

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get full name from User model (firstName + lastName)
 */
function getUserFullName(user: { firstName: string; lastName: string } | null | undefined): string {
  if (!user) return 'Unknown';
  return `${user.firstName} ${user.lastName}`.trim() || 'Unknown';
}

// ============================================================================
// Service
// ============================================================================

export class CaseContextService {
  private readonly CORE_CACHE_TTL = 300; // 5 min
  private readonly EXTENDED_CACHE_TTL = 60; // 1 min
  private readonly HISTORICAL_CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_KEY_PREFIX = 'case-context:';

  // ==========================================================================
  // Main API
  // ==========================================================================

  /**
   * Get complete context for an AI operation
   * This is the main entry point for AI services
   */
  async getContextForOperation(
    caseId: string,
    operation: AIOperation,
    options?: { includeHistorical?: boolean }
  ): Promise<AIOperationContext> {
    const profile = contextProfiles[operation];
    if (!profile) {
      throw new Error(`Unknown AI operation: ${operation}`);
    }

    const startTime = Date.now();

    // Always get core context
    const core = await this.getCoreContext(caseId, profile.core);

    // Get extended context if sections are specified
    let extended: Partial<ExtendedContext> | undefined;
    if (profile.extended.length > 0) {
      extended = await this.getExtendedContext(caseId, profile.extended);
    }

    // Get historical if requested and profile allows
    let historical: HistoricalContext | undefined;
    const shouldIncludeHistorical =
      options?.includeHistorical &&
      (profile.historical === true || profile.historical === 'on-request');
    if (shouldIncludeHistorical) {
      historical = await this.getHistoricalContext(caseId);
    }

    // Estimate tokens
    const tokenEstimate = this.estimateTokens(core, extended, historical);

    logger.debug('Built AI operation context', {
      caseId,
      operation,
      tokenEstimate,
      durationMs: Date.now() - startTime,
    });

    return {
      operation,
      core,
      extended,
      historical,
      tokenEstimate,
    };
  }

  // ==========================================================================
  // Tier 1: Core Context
  // ==========================================================================

  /**
   * Get Core Context (Tier 1)
   * All identity information - always included in AI operations
   */
  async getCoreContext(
    caseId: string,
    selector?: {
      full?: boolean;
      clientOnly?: boolean;
      caseOnly?: boolean;
      actorsOnly?: boolean;
      minimal?: boolean;
    }
  ): Promise<CoreContext> {
    // Try cache first
    const cacheKey = `${this.CACHE_KEY_PREFIX}core:${caseId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: CacheEntry<CoreContext> = JSON.parse(cached);
        logger.debug('Core context cache hit', { caseId });
        return this.applySelector(entry.data, selector);
      }
    } catch {
      // Cache miss
    }

    // Generate fresh context
    logger.debug('Core context cache miss, generating', { caseId });
    const context = await this.generateCoreContext(caseId);

    // Cache it
    try {
      const entry: CacheEntry<CoreContext> = {
        data: context,
        cachedAt: new Date().toISOString(),
      };
      await redis.setex(cacheKey, this.CORE_CACHE_TTL, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Failed to cache core context', { caseId, error });
    }

    return this.applySelector(context, selector);
  }

  /**
   * Generate fresh Core Context from database
   */
  private async generateCoreContext(caseId: string): Promise<CoreContext> {
    // Fetch case with all relations
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        client: true,
        actors: true,
        teamMembers: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        chapters: {
          where: { isStale: false },
          orderBy: { sortOrder: 'desc' },
          take: 1,
        },
      },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const client = caseData.client;
    if (!client) {
      throw new Error(`Client not found for case: ${caseId}`);
    }

    // Parse client JSON fields
    const contactInfo = (client.contactInfo as Record<string, unknown>) || {};
    const administrators = (client.administrators as unknown as ClientPersonEntry[]) || [];
    const contacts = (client.contacts as unknown as ClientPersonEntry[]) || [];

    // Extract court from metadata
    const metadata = (caseData.metadata as Record<string, unknown>) || {};
    const court = (metadata.court as string) || undefined;

    // Get current phase from active chapter
    const currentPhase = caseData.chapters[0]?.title || undefined;

    return {
      client: {
        id: client.id,
        name: client.name,
        clientType: (client.clientType as 'individual' | 'company') || 'company',
        companyType: client.companyType || undefined,
        cui: client.cui || undefined,
        registrationNumber: client.registrationNumber || undefined,
        address: client.address || undefined,
        phone: (contactInfo.phone as string) || undefined,
        email: (contactInfo.email as string) || undefined,
        administrators,
        contacts,
      },
      case: {
        id: caseData.id,
        number: caseData.caseNumber,
        title: caseData.title,
        type: caseData.type,
        status: caseData.status,
        summary: caseData.description || '',
        keywords: caseData.keywords || [],
        referenceNumbers: caseData.referenceNumbers || [],
        classificationNotes: caseData.classificationNotes || undefined,
        currentPhase,
        court,
      },
      actors: caseData.actors.map((actor) => ({
        id: actor.id,
        name: actor.name,
        type: actor.role,
        role: this.translateRole(actor.role),
        organization: actor.organization || undefined,
        email: actor.email || undefined,
        emailDomains: actor.emailDomains || [],
        phone: actor.phone || undefined,
        address: actor.address || undefined,
        notes: actor.notes || undefined,
      })),
      team: caseData.teamMembers.map((member) => ({
        userId: member.userId,
        name: getUserFullName(member.user),
        role: member.role,
      })),
    };
  }

  /**
   * Apply selector to filter core context
   */
  private applySelector(
    context: CoreContext,
    selector?: {
      full?: boolean;
      clientOnly?: boolean;
      caseOnly?: boolean;
      actorsOnly?: boolean;
      minimal?: boolean;
    }
  ): CoreContext {
    if (!selector || selector.full) {
      return context;
    }

    if (selector.minimal) {
      return {
        ...context,
        client: {
          ...context.client,
          administrators: [],
          contacts: [],
        },
        actors: [],
        team: [],
      };
    }

    // For other selectors, return full context (can be refined later)
    return context;
  }

  // ==========================================================================
  // Tier 2: Extended Context
  // ==========================================================================

  /**
   * Get Extended Context (Tier 2)
   * Task-specific operational context
   */
  async getExtendedContext(
    caseId: string,
    sections: ExtendedSection[]
  ): Promise<Partial<ExtendedContext>> {
    const result: Partial<ExtendedContext> = {};

    // Group sections by category for efficient fetching
    const needsEmails = sections.some((s) => s.startsWith('emails.'));
    const needsDocs = sections.some((s) => s.startsWith('documents.'));
    const needsTimeline = sections.some((s) => s.startsWith('timeline.'));
    const needsAnalysis = sections.some((s) => s.startsWith('analysis.'));
    const needsPatterns = sections.some((s) => s.startsWith('patterns.'));

    // Fetch in parallel
    const promises: Promise<void>[] = [];

    if (needsEmails) {
      promises.push(this.fetchEmailContext(caseId, sections, result));
    }
    if (needsDocs) {
      promises.push(this.fetchDocumentContext(caseId, sections, result));
    }
    if (needsTimeline) {
      promises.push(this.fetchTimelineContext(caseId, sections, result));
    }
    if (needsAnalysis) {
      promises.push(this.fetchAnalysisContext(caseId, sections, result));
    }
    if (needsPatterns) {
      promises.push(this.fetchPatternsContext(caseId, sections, result));
    }

    await Promise.all(promises);

    return result;
  }

  private async fetchEmailContext(
    caseId: string,
    sections: ExtendedSection[],
    result: Partial<ExtendedContext>
  ): Promise<void> {
    result.emails = {};

    if (sections.includes('emails.recentThreads')) {
      const threads = await prisma.threadSummary.findMany({
        where: { caseId },
        orderBy: { lastAnalyzedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          conversationId: true,
          participants: true,
          overview: true,
          lastAnalyzedAt: true,
        },
      });

      result.emails.recentThreads = threads.map((t) => ({
        threadId: t.id,
        subject: t.conversationId, // Using conversationId as identifier
        participants: (t.participants as string[]) || [],
        lastMessage: t.overview || '',
        date: t.lastAnalyzedAt?.toISOString() || '',
      }));
    }

    if (sections.includes('emails.threadHistory')) {
      // This would be populated when a specific thread is being replied to
      // For now, leave empty - will be filled by email-specific operations
      result.emails.threadHistory = { fullThread: [] };
    }
  }

  private async fetchDocumentContext(
    caseId: string,
    sections: ExtendedSection[],
    result: Partial<ExtendedContext>
  ): Promise<void> {
    result.documents = {};

    if (sections.includes('documents.recentDocs')) {
      const docs = await prisma.caseDocument.findMany({
        where: { caseId },
        orderBy: { linkedAt: 'desc' },
        take: 15,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              createdAt: true,
            },
          },
        },
      });

      result.documents.recentDocs = docs.map((d) => ({
        id: d.document.id,
        name: d.document.fileName,
        type: d.document.fileType || 'document',
        date: d.document.createdAt.toISOString(),
      }));
    }

    if (sections.includes('documents.templateContext')) {
      // Template context is populated by document drafting operations
      result.documents.templateContext = {
        placeholders: [],
        previousValues: {},
      };
    }
  }

  private async fetchTimelineContext(
    caseId: string,
    sections: ExtendedSection[],
    result: Partial<ExtendedContext>
  ): Promise<void> {
    result.timeline = {};

    if (sections.includes('timeline.chapters')) {
      const chapters = await prisma.caseChapter.findMany({
        where: { caseId },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          phase: true,
          startDate: true,
          endDate: true,
          isStale: true,
        },
      });

      result.timeline.chapters = chapters.map((c) => ({
        id: c.id,
        name: c.title,
        status: c.isStale ? 'Stale' : 'Active',
        startDate: c.startDate?.toISOString() || '',
        endDate: c.endDate?.toISOString(),
      }));
    }

    if (sections.includes('timeline.recentActivity')) {
      const thirtyDaysAgo = subDays(new Date(), 30);
      const activity = await prisma.caseActivityEntry.findMany({
        where: {
          caseId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          activityType: true,
          title: true,
          createdAt: true,
        },
      });

      result.timeline.recentActivity = activity.map((a) => ({
        type: a.activityType,
        description: a.title,
        date: a.createdAt.toISOString(),
      }));
    }
  }

  private async fetchAnalysisContext(
    caseId: string,
    sections: ExtendedSection[],
    result: Partial<ExtendedContext>
  ): Promise<void> {
    result.analysis = {};

    if (sections.includes('analysis.openQuestions')) {
      const questions = await prisma.extractedQuestion.findMany({
        where: { caseId, status: 'Pending', isAnswered: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { questionText: true },
      });
      result.analysis.openQuestions = questions.map((q) => q.questionText);
    }

    if (sections.includes('analysis.recentNotes')) {
      const notes = await prisma.caseNote.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { content: true },
      });
      result.analysis.recentNotes = notes.map((n) => n.content);
    }

    if (sections.includes('analysis.riskIndicators')) {
      const risks = await prisma.riskIndicator.findMany({
        where: { caseId, isResolved: false },
        orderBy: { severity: 'desc' },
        take: 5,
        select: { description: true },
      });
      result.analysis.riskIndicators = risks.map((r) => r.description);
    }
  }

  private async fetchPatternsContext(
    caseId: string,
    sections: ExtendedSection[],
    result: Partial<ExtendedContext>
  ): Promise<void> {
    // Get firmId from case to find user patterns
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });

    if (!caseData) return;

    result.patterns = {
      commonPhrases: [],
    };

    // Patterns would come from UserLearningProfile - simplified for now
    // Full implementation would query user-specific patterns
    if (sections.includes('patterns.writingStyle')) {
      result.patterns.writingStyle = undefined; // Populated from user learning profile
    }

    if (sections.includes('patterns.commonPhrases')) {
      result.patterns.commonPhrases = [];
    }
  }

  // ==========================================================================
  // Tier 3: Historical Context
  // ==========================================================================

  /**
   * Get Historical Context (Tier 3)
   * Deep analysis context - expensive, use sparingly
   */
  async getHistoricalContext(caseId: string): Promise<HistoricalContext> {
    // Try cache first
    const cacheKey = `${this.CACHE_KEY_PREFIX}historical:${caseId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: CacheEntry<HistoricalContext> = JSON.parse(cached);
        logger.debug('Historical context cache hit', { caseId });
        return entry.data;
      }
    } catch {
      // Cache miss
    }

    logger.debug('Historical context cache miss, generating', { caseId });
    const context = await this.generateHistoricalContext(caseId);

    // Cache it
    try {
      const entry: CacheEntry<HistoricalContext> = {
        data: context,
        cachedAt: new Date().toISOString(),
      };
      await redis.setex(cacheKey, this.HISTORICAL_CACHE_TTL, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Failed to cache historical context', { caseId, error });
    }

    return context;
  }

  private async generateHistoricalContext(caseId: string): Promise<HistoricalContext> {
    // Fetch all data in parallel
    const [activity, notes, documents, emailCount] = await Promise.all([
      prisma.caseActivityEntry.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          activityType: true,
          title: true,
          createdAt: true,
          actor: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.caseNote.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
      prisma.caseDocument.findMany({
        where: { caseId },
        orderBy: { linkedAt: 'desc' },
        take: 50,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.email.count({
        where: { caseLinks: { some: { caseId } } },
      }),
    ]);

    return {
      fullTimeline: activity.map((a) => ({
        date: a.createdAt.toISOString(),
        type: a.activityType,
        description: a.title,
        actor: getUserFullName(a.actor),
      })),
      allNotes: notes.map((n) => ({
        id: n.id,
        content: n.content,
        author: getUserFullName(n.author),
        date: n.createdAt.toISOString(),
      })),
      documentHistory: documents.map((d) => ({
        id: d.document.id,
        name: d.document.fileName,
        type: d.document.fileType || 'document',
        date: d.document.createdAt.toISOString(),
      })),
      communicationHistory: {
        totalEmails: emailCount,
        keyExchanges: [], // Would need AI summarization to populate
      },
    };
  }

  // ==========================================================================
  // Cache Invalidation
  // ==========================================================================

  /**
   * Invalidate core context cache for a case
   */
  async invalidateCoreContext(caseId: string): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}core:${caseId}`;
    try {
      await redis.del(cacheKey);
      logger.debug('Core context cache invalidated', { caseId });
    } catch (error) {
      logger.warn('Failed to invalidate core context cache', { caseId, error });
    }
  }

  /**
   * Invalidate extended context cache for a case
   */
  async invalidateExtendedContext(caseId: string): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}extended:${caseId}`;
    try {
      await redis.del(cacheKey);
      logger.debug('Extended context cache invalidated', { caseId });
    } catch (error) {
      logger.warn('Failed to invalidate extended context cache', { caseId, error });
    }
  }

  /**
   * Invalidate historical context cache for a case
   */
  async invalidateHistoricalContext(caseId: string): Promise<void> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}historical:${caseId}`;
    try {
      await redis.del(cacheKey);
      logger.debug('Historical context cache invalidated', { caseId });
    } catch (error) {
      logger.warn('Failed to invalidate historical context cache', { caseId, error });
    }
  }

  /**
   * Invalidate all context caches for a case
   */
  async invalidateAllContext(caseId: string): Promise<void> {
    await Promise.all([
      this.invalidateCoreContext(caseId),
      this.invalidateExtendedContext(caseId),
      this.invalidateHistoricalContext(caseId),
    ]);
  }

  /**
   * Invalidate core context for all cases of a client
   * Called when client data changes
   */
  async invalidateClientContext(clientId: string): Promise<void> {
    const cases = await prisma.case.findMany({
      where: { clientId },
      select: { id: true },
    });

    await Promise.all(cases.map((c) => this.invalidateCoreContext(c.id)));
    logger.debug('Client context invalidated for all cases', { clientId, caseCount: cases.length });
  }

  // ==========================================================================
  // Formatting
  // ==========================================================================

  /**
   * Format context for AI prompt injection
   */
  formatForPrompt(context: AIOperationContext): string {
    const sections: string[] = [];

    // Core context
    sections.push(this.formatCoreContext(context.core));

    // Extended context
    if (context.extended) {
      const extendedText = this.formatExtendedContext(context.extended);
      if (extendedText) {
        sections.push(extendedText);
      }
    }

    // Historical context
    if (context.historical) {
      sections.push(this.formatHistoricalContext(context.historical));
    }

    return sections.join('\n\n');
  }

  private formatCoreContext(core: CoreContext): string {
    const lines: string[] = [];

    // Client section
    lines.push('## Client');
    lines.push(`**${core.client.name}**`);
    if (core.client.companyType) {
      lines.push(`Tip: ${core.client.companyType}`);
    }
    if (core.client.cui) {
      lines.push(`CUI: ${core.client.cui}`);
    }
    if (core.client.registrationNumber) {
      lines.push(`Nr. Reg. Com.: ${core.client.registrationNumber}`);
    }
    if (core.client.address) {
      lines.push(`Adresă: ${core.client.address}`);
    }
    if (core.client.email) {
      lines.push(`Email: ${core.client.email}`);
    }
    if (core.client.phone) {
      lines.push(`Tel: ${core.client.phone}`);
    }

    // Administrators
    if (core.client.administrators.length > 0) {
      lines.push('');
      lines.push('### Administratori');
      for (const admin of core.client.administrators) {
        const details = [admin.name];
        if (admin.role) details.push(`(${admin.role})`);
        if (admin.email) details.push(`- ${admin.email}`);
        lines.push(`- ${details.join(' ')}`);
      }
    }

    // Contacts
    if (core.client.contacts.length > 0) {
      lines.push('');
      lines.push('### Contacte');
      for (const contact of core.client.contacts) {
        const details = [contact.name];
        if (contact.role) details.push(`(${contact.role})`);
        if (contact.email) details.push(`- ${contact.email}`);
        lines.push(`- ${details.join(' ')}`);
      }
    }

    // Case section
    lines.push('');
    lines.push('## Dosar');
    lines.push(`**${core.case.title}**`);
    lines.push(`Nr: ${core.case.number} | Tip: ${core.case.type} | Status: ${core.case.status}`);
    if (core.case.court) {
      lines.push(`Instanță: ${core.case.court}`);
    }
    if (core.case.currentPhase) {
      lines.push(`Fază curentă: ${core.case.currentPhase}`);
    }
    if (core.case.keywords.length > 0) {
      lines.push(`Cuvinte cheie: ${core.case.keywords.join(', ')}`);
    }
    if (core.case.referenceNumbers.length > 0) {
      lines.push(`Nr. referință: ${core.case.referenceNumbers.join(', ')}`);
    }
    if (core.case.summary) {
      lines.push('');
      lines.push(core.case.summary);
    }

    // Actors section
    if (core.actors.length > 0) {
      lines.push('');
      lines.push('### Părți');
      for (const actor of core.actors) {
        const details = [`${actor.role}: ${actor.name}`];
        if (actor.organization) details.push(`(${actor.organization})`);
        if (actor.email) details.push(`- ${actor.email}`);
        lines.push(`- ${details.join(' ')}`);
      }
    }

    // Team section
    if (core.team.length > 0) {
      lines.push('');
      lines.push('### Echipă');
      for (const member of core.team) {
        lines.push(`- ${member.name} (${member.role})`);
      }
    }

    return lines.join('\n');
  }

  private formatExtendedContext(extended: Partial<ExtendedContext>): string {
    const sections: string[] = [];

    // Email threads
    if (extended.emails?.recentThreads && extended.emails.recentThreads.length > 0) {
      sections.push('### Comunicări recente');
      for (const thread of extended.emails.recentThreads.slice(0, 5)) {
        sections.push(`- **${thread.subject}**: ${thread.lastMessage.slice(0, 100)}...`);
      }
    }

    // Recent documents
    if (extended.documents?.recentDocs && extended.documents.recentDocs.length > 0) {
      sections.push('');
      sections.push('### Documente recente');
      for (const doc of extended.documents.recentDocs.slice(0, 10)) {
        sections.push(`- ${doc.name} (${doc.type})`);
      }
    }

    // Timeline
    if (extended.timeline?.chapters && extended.timeline.chapters.length > 0) {
      sections.push('');
      sections.push('### Faze dosar');
      for (const chapter of extended.timeline.chapters) {
        const status = chapter.status === 'Active' ? '🔵' : '✓';
        sections.push(`- ${status} ${chapter.name}`);
      }
    }

    // Recent activity
    if (extended.timeline?.recentActivity && extended.timeline.recentActivity.length > 0) {
      sections.push('');
      sections.push('### Activitate recentă');
      for (const activity of extended.timeline.recentActivity.slice(0, 5)) {
        sections.push(`- ${activity.description}`);
      }
    }

    // Analysis
    if (extended.analysis?.openQuestions && extended.analysis.openQuestions.length > 0) {
      sections.push('');
      sections.push('### Întrebări deschise');
      for (const q of extended.analysis.openQuestions) {
        sections.push(`- ${q}`);
      }
    }

    if (extended.analysis?.riskIndicators && extended.analysis.riskIndicators.length > 0) {
      sections.push('');
      sections.push('### Riscuri');
      for (const risk of extended.analysis.riskIndicators) {
        sections.push(`- ${risk}`);
      }
    }

    return sections.join('\n');
  }

  private formatHistoricalContext(historical: HistoricalContext): string {
    const sections: string[] = [];

    sections.push('## Istoric');

    // Timeline
    if (historical.fullTimeline.length > 0) {
      sections.push('### Cronologie');
      for (const event of historical.fullTimeline.slice(0, 20)) {
        const actor = event.actor ? ` (${event.actor})` : '';
        sections.push(`- ${event.date.slice(0, 10)}: ${event.description}${actor}`);
      }
    }

    // Notes
    if (historical.allNotes.length > 0) {
      sections.push('');
      sections.push('### Note');
      for (const note of historical.allNotes.slice(0, 5)) {
        sections.push(`- ${note.author}: ${note.content.slice(0, 200)}...`);
      }
    }

    // Stats
    sections.push('');
    sections.push('### Statistici');
    sections.push(`- Total emailuri: ${historical.communicationHistory.totalEmails}`);
    sections.push(`- Total documente: ${historical.documentHistory.length}`);

    return sections.join('\n');
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private translateRole(role: string): string {
    const translations: Record<string, string> = {
      Client: 'Client',
      OpposingParty: 'Parte adversă',
      OpposingCounsel: 'Avocat adversar',
      Witness: 'Martor',
      Expert: 'Expert',
      Authority: 'Autoritate',
      Other: 'Altul',
      LegalRepresentative: 'Reprezentant legal',
    };
    return translations[role] || role;
  }

  private estimateTokens(
    core: CoreContext,
    extended?: Partial<ExtendedContext>,
    historical?: HistoricalContext
  ): number {
    // Rough estimation: 4 characters per token
    let chars = JSON.stringify(core).length;
    if (extended) chars += JSON.stringify(extended).length;
    if (historical) chars += JSON.stringify(historical).length;
    return Math.ceil(chars / 4);
  }
}

// Export singleton instance
export const caseContextService = new CaseContextService();
