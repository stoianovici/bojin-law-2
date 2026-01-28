/**
 * Case Context File Service
 * Generates configurable, profile-based context files for cases
 */

import { prisma, redis } from '@legal-platform/database';
import type {
  ContextFile,
  ContextSection,
  ContextProfile,
  SectionConfig,
  UserCorrection,
  ContextVersion,
  RichCaseContext,
  CaseBriefingData,
} from '@legal-platform/types';
import { caseBriefingService } from './case-briefing.service';
import { contextProfileService } from './context-profile.service';
import { clientContextService } from './client-context.service';
import { aiClient, getModelForFeature } from './ai-client.service';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import { differenceInDays, addDays } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

type ContextTier = 'critical' | 'standard' | 'full';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract counterparty name from case title
 * Romanian legal case titles often follow patterns like:
 * - "Notificare reziliere si daune Civila Invest"
 * - "Cerere de chemare în judecată contra SC Example SRL"
 * - "Acțiune împotriva John Doe"
 */
function extractCounterpartyFromTitle(title: string): string | null {
  if (!title) return null;

  // Patterns that indicate the counterparty follows
  const separators = [' contra ', ' împotriva ', ' vs ', ' vs. ', ' versus ', ' c/ '];

  // Check for explicit separators first
  for (const sep of separators) {
    const idx = title.toLowerCase().indexOf(sep);
    if (idx !== -1) {
      const counterparty = title.substring(idx + sep.length).trim();
      if (counterparty.length > 2) {
        return counterparty;
      }
    }
  }

  // Common Romanian legal action prefixes to strip
  const actionPrefixes = [
    /^notificare\s+(de\s+)?(reziliere|somatie|punere\s+in\s+intarziere)(\s+si\s+\w+)*\s+/i,
    /^cerere\s+(de\s+)?(chemare\s+in\s+judecata|executare|ordonanta)\s+/i,
    /^actiune\s+(civila\s+)?(in\s+)?(pretentii|anulare|reziliere)\s+/i,
    /^plangere\s+(penala\s+)?(impotriva\s+)?/i,
    /^contestatie\s+(la\s+)?(executare\s+)?/i,
    /^dosar\s+(nr\.?\s*\d+\/\d+\s+)?/i,
  ];

  let remaining = title;
  for (const prefix of actionPrefixes) {
    remaining = remaining.replace(prefix, '');
  }

  // If we stripped something and have a clean name left, use it
  remaining = remaining.trim();
  if (remaining !== title && remaining.length > 2) {
    // Clean up common suffixes
    remaining = remaining.replace(/\s*-\s*$/, '').trim();
    // Check if it looks like a company or person name (has capital letters)
    if (/[A-Z]/.test(remaining)) {
      return remaining;
    }
  }

  return null;
}

// ============================================================================
// Service
// ============================================================================

export class CaseContextFileService {
  private readonly CACHE_TTL = 5 * 60; // 5 minutes
  private readonly CACHE_KEY_PREFIX = 'context-file:';

  /**
   * Get or generate context file for a case
   */
  async getContextFile(
    caseId: string,
    profileCode: string = 'word_addin'
  ): Promise<ContextFile | null> {
    // Get case to find firmId
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { firmId: true },
    });

    if (!caseRecord) {
      logger.warn('Case not found for context file', { caseId });
      return null;
    }

    // Get profile
    let profile = await contextProfileService.getProfileByCode(caseRecord.firmId, profileCode);
    if (!profile) {
      // Ensure defaults exist and try again
      await contextProfileService.ensureDefaultProfiles(caseRecord.firmId);
      profile = await contextProfileService.getProfileByCode(caseRecord.firmId, profileCode);
    }

    if (!profile) {
      logger.warn('Profile not found', { firmId: caseRecord.firmId, profileCode });
      return null;
    }

    // Try cache
    const cacheKey = `${this.CACHE_KEY_PREFIX}${caseId}:${profileCode}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss, continue
    }

    // Generate context file
    const contextFile = await this.generateContextFile(caseId, profile);

    // Cache it
    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(contextFile));
    } catch (error) {
      logger.warn('Failed to cache context file', { caseId, error });
    }

    return contextFile;
  }

  /**
   * Generate context file with profile configuration
   */
  private async generateContextFile(caseId: string, profile: ContextProfile): Promise<ContextFile> {
    const startTime = Date.now();

    // Get rich context from briefing service
    let richContext = await caseBriefingService.getRichContext(caseId);
    let usedFallback = false;
    if (!richContext) {
      usedFallback = true;
      // Generate basic briefing if rich context not available
      logger.warn('[Context] Rich context missing, using fallback', {
        caseId,
        profileCode: profile.code,
        hint: 'Batch processor may not have run for this case. Run case_context batch job.',
      });
      const briefing = await caseBriefingService.getBriefing(caseId);
      const briefingText = await caseBriefingService.getBriefingText(caseId);
      logger.info('[Context] Fallback briefing data', {
        caseId,
        caseTitle: briefing.title,
        caseNumber: briefing.caseNumber,
        partiesCount: briefing.parties.length,
        hasNextDeadline: !!briefing.nextDeadline,
        recentEventsCount: briefing.recentEvents.length,
        documentCount: briefing.documentCount,
        emailCount: briefing.emailCount,
        pendingTaskCount: briefing.pendingTaskCount,
        briefingTextLength: briefingText.length,
      });
      richContext = {
        briefingData: briefing,
        briefingText,
        documentSummaries: [],
        emailThreadSummaries: [],
        upcomingDeadlines: [],
        contactContext: { contacts: [] },
        clientContext: null,
        caseHealthIndicators: [],
        contextVersion: 1,
        lastComputedAt: new Date().toISOString(),
      };
    } else {
      // Log what rich context we have
      logger.info('[Context] Rich context loaded', {
        caseId,
        profileCode: profile.code,
        documentSummariesCount: richContext.documentSummaries?.length ?? 0,
        emailThreadsCount: richContext.emailThreadSummaries?.length ?? 0,
        deadlinesCount: richContext.upcomingDeadlines?.length ?? 0,
        hasClientContext: !!richContext.clientContext,
        healthIndicatorsCount: richContext.caseHealthIndicators?.length ?? 0,
        contextVersion: richContext.contextVersion,
        lastComputedAt: richContext.lastComputedAt,
      });
    }

    // Get corrections
    const corrections = await this.getCorrections(caseId);

    // Apply corrections to context
    const correctedContext = this.applyCorrections(richContext, corrections);

    // Build sections based on profile
    const enabledSectionIds = profile.sections.filter((s) => s.enabled).map((s) => s.sectionId);
    const sections = await this.buildSections(correctedContext, profile);
    const builtSectionIds = sections.map((s) => s.sectionId);
    const missingSections = enabledSectionIds.filter((id) => !builtSectionIds.includes(id));

    // Log section building results
    if (missingSections.length > 0) {
      logger.warn('[Context] Some enabled sections were empty', {
        caseId,
        profileCode: profile.code,
        enabledSections: enabledSectionIds,
        builtSections: builtSectionIds,
        missingSections,
        usedFallback,
      });
    }

    // Combine into content string
    const content = sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');

    // Estimate token count (rough: 4 chars per token)
    const tokenCount = Math.ceil(content.length / 4);

    const contextFile: ContextFile = {
      caseId,
      profileCode: profile.code,
      content,
      tokenCount,
      sections,
      corrections: corrections.filter((c) => c.isActive),
      version: richContext.contextVersion,
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + this.CACHE_TTL * 1000).toISOString(),
    };

    logger.info('[Context] Generated context file', {
      caseId,
      profileCode: profile.code,
      tokenCount,
      sectionsBuilt: sections.length,
      sectionIds: builtSectionIds,
      usedFallback,
      durationMs: Date.now() - startTime,
    });

    return contextFile;
  }

  /**
   * Build sections based on profile configuration
   */
  private async buildSections(
    context: RichCaseContext & { sectionCorrections?: Map<string, UserCorrection[]> },
    profile: ContextProfile
  ): Promise<ContextSection[]> {
    const sections: ContextSection[] = [];
    const enabledSections = profile.sections
      .filter((s) => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const sectionConfig of enabledSections) {
      const section = this.buildSection(context, sectionConfig);
      if (section && section.content.trim()) {
        // Apply corrections if any exist for this section
        const sectionCorrections = context.sectionCorrections?.get(section.sectionId) || [];
        if (sectionCorrections.length > 0) {
          section.content = this.applySectionCorrections(
            section.sectionId,
            section.content,
            sectionCorrections
          );
          section.tokenCount = Math.ceil(section.content.length / 4);
        }
        sections.push(section);
      }
    }

    return sections;
  }

  /**
   * Build a single section
   */
  private buildSection(context: RichCaseContext, config: SectionConfig): ContextSection | null {
    const { sectionId, maxItems } = config;

    switch (sectionId) {
      case 'parties': {
        // Start with existing parties
        const parties = [...context.briefingData.parties];

        // Try to extract counterparty from case title if not already present
        const counterpartyName = extractCounterpartyFromTitle(context.briefingData.title);
        if (counterpartyName) {
          // Check if counterparty is already in the list (case-insensitive)
          const alreadyExists = parties.some(
            (p) =>
              p.name.toLowerCase().includes(counterpartyName.toLowerCase()) ||
              counterpartyName.toLowerCase().includes(p.name.toLowerCase())
          );
          if (!alreadyExists) {
            parties.push({
              role: 'Parte adversă',
              name: counterpartyName,
              isClient: false,
            });
          }
        }

        const content = parties
          .slice(0, maxItems || 15)
          .map((p) => `- ${p.role}: ${p.name}${p.isClient ? ' (client)' : ''}`)
          .join('\n');
        return {
          sectionId,
          title: 'Părți',
          content,
          tokenCount: Math.ceil(content.length / 4),
        };
      }

      case 'deadlines': {
        const deadlines = context.upcomingDeadlines.slice(0, maxItems || 10);
        if (deadlines.length === 0) return null;
        const content = deadlines
          .map((d) => {
            const status = d.isOverdue ? 'DEPĂȘIT' : `în ${d.daysUntil} zile`;
            return `- ${d.title} (${status})`;
          })
          .join('\n');
        return {
          sectionId,
          title: 'Termene',
          content,
          tokenCount: Math.ceil(content.length / 4),
        };
      }

      case 'documents': {
        const docs = context.documentSummaries.slice(0, maxItems || 10);
        if (docs.length === 0) return null;
        const content = docs.map((d) => `- **${d.title}** (${d.type}): ${d.summary}`).join('\n');
        return {
          sectionId,
          title: 'Documente cheie',
          content,
          tokenCount: Math.ceil(content.length / 4),
        };
      }

      case 'emails': {
        // Handle both array format and object format {threads: [...]}
        let emailSummaries = context.emailThreadSummaries;
        if (emailSummaries && !Array.isArray(emailSummaries) && 'threads' in emailSummaries) {
          emailSummaries = (emailSummaries as { threads: typeof emailSummaries }).threads;
        }
        if (!Array.isArray(emailSummaries) || emailSummaries.length === 0) return null;
        const threads = emailSummaries.slice(0, maxItems || 5);
        const content = threads
          .map((t) => {
            const urgent = t.isUrgent ? ' !' : '';
            const actions =
              t.actionItems.length > 0 ? `\n  - Acțiuni: ${t.actionItems.join(', ')}` : '';
            return `- **${t.subject}**${urgent}: ${t.summary}${actions}`;
          })
          .join('\n');
        return {
          sectionId,
          title: 'Comunicări recente',
          content,
          tokenCount: Math.ceil(content.length / 4),
        };
      }

      case 'client': {
        const client = context.clientContext;
        if (!client) return null;
        const content = [
          `Nume: ${client.name}`,
          `Tip: ${client.type === 'company' ? 'Persoană juridică' : 'Persoană fizică'}`,
          client.relationshipStartDate && `Relație din: ${client.relationshipStartDate}`,
          `Portofoliu: ${client.activeCaseCount} dosare active, ${client.closedCaseCount} închise`,
        ]
          .filter(Boolean)
          .join('\n');
        return {
          sectionId,
          title: 'Context client',
          content,
          tokenCount: Math.ceil(content.length / 4),
        };
      }

      case 'health': {
        const warnings = context.caseHealthIndicators.filter((h) => h.severity !== 'low');
        if (warnings.length === 0) return null;
        const content = warnings.map((w) => `- ${w.message}`).join('\n');
        return {
          sectionId,
          title: 'Atenție',
          content,
          tokenCount: Math.ceil(content.length / 4),
        };
      }

      default:
        return null;
    }
  }

  /**
   * Apply user corrections to context
   * Corrections are stored and applied per-section during buildSections
   */
  private applyCorrections(
    context: RichCaseContext,
    corrections: UserCorrection[]
  ): RichCaseContext & {
    customNotes?: string[];
    sectionCorrections: Map<string, UserCorrection[]>;
  } {
    const result = JSON.parse(JSON.stringify(context)) as RichCaseContext & {
      customNotes?: string[];
      sectionCorrections: Map<string, UserCorrection[]>;
    };

    // Group corrections by section
    result.sectionCorrections = new Map();
    const activeCorrections = corrections.filter((c) => c.isActive);

    for (const correction of activeCorrections) {
      const existing = result.sectionCorrections.get(correction.sectionId) || [];
      existing.push(correction);
      result.sectionCorrections.set(correction.sectionId, existing);
    }

    // Also collect notes for a potential "notes" section
    for (const correction of activeCorrections) {
      if (correction.correctionType === 'note') {
        if (!result.customNotes) result.customNotes = [];
        result.customNotes.push(`[Notă] ${correction.correctedValue}`);
      }
    }

    return result;
  }

  /**
   * Apply corrections to section content
   */
  private applySectionCorrections(
    sectionId: string,
    content: string,
    corrections: UserCorrection[]
  ): string {
    let result = content;

    for (const correction of corrections) {
      switch (correction.correctionType) {
        case 'override':
          // Replace entire section content
          result = correction.correctedValue;
          break;

        case 'append':
          // Add content at the end
          result = `${result}\n${correction.correctedValue}`;
          break;

        case 'remove':
          // If removing specific text, remove it; otherwise mark section as hidden
          if (correction.originalValue) {
            result = result.replace(correction.originalValue, '');
          } else {
            result = `~~${result}~~\n[Eliminat: ${correction.reason || 'fără motiv'}]`;
          }
          break;

        case 'note':
          // Notes are collected separately, don't modify content
          break;
      }
    }

    return result.trim();
  }

  /**
   * Get corrections for a case
   */
  async getCorrections(caseId: string): Promise<UserCorrection[]> {
    const briefing = await prisma.caseBriefing.findUnique({
      where: { caseId },
      select: { userCorrections: true },
    });

    if (!briefing?.userCorrections) return [];

    return briefing.userCorrections as unknown as UserCorrection[];
  }

  /**
   * Add a correction
   */
  async addCorrection(
    caseId: string,
    userId: string,
    input: {
      sectionId: string;
      fieldPath?: string;
      correctionType: 'override' | 'append' | 'remove' | 'note';
      correctedValue: string;
      reason?: string;
    }
  ): Promise<UserCorrection> {
    const corrections = await this.getCorrections(caseId);

    const newCorrection: UserCorrection = {
      id: randomUUID(),
      sectionId: input.sectionId,
      fieldPath: input.fieldPath,
      correctionType: input.correctionType,
      correctedValue: input.correctedValue,
      reason: input.reason,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      isActive: true,
    };

    corrections.push(newCorrection);

    await prisma.caseBriefing.update({
      where: { caseId },
      data: {
        userCorrections: corrections as object,
        lastCorrectedBy: userId,
        correctionsAppliedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache(caseId);

    return newCorrection;
  }

  /**
   * Update an existing correction
   */
  async updateCorrection(
    caseId: string,
    correctionId: string,
    updates: {
      correctedValue?: string;
      reason?: string;
      isActive?: boolean;
    }
  ): Promise<UserCorrection> {
    const corrections = await this.getCorrections(caseId);

    const correctionIndex = corrections.findIndex((c) => c.id === correctionId);
    if (correctionIndex === -1) {
      throw new Error('Corecția nu a fost găsită.');
    }

    // Update the correction
    const updatedCorrection: UserCorrection = {
      ...corrections[correctionIndex],
      ...(updates.correctedValue !== undefined && { correctedValue: updates.correctedValue }),
      ...(updates.reason !== undefined && { reason: updates.reason }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    };

    corrections[correctionIndex] = updatedCorrection;

    await prisma.caseBriefing.update({
      where: { caseId },
      data: {
        userCorrections: corrections as object,
        correctionsAppliedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache(caseId);

    logger.info('[Context] Correction updated', {
      caseId,
      correctionId,
      isActive: updatedCorrection.isActive,
    });

    return updatedCorrection;
  }

  /**
   * Delete a correction (hard delete)
   */
  async deleteCorrection(caseId: string, correctionId: string): Promise<boolean> {
    const corrections = await this.getCorrections(caseId);

    const filteredCorrections = corrections.filter((c) => c.id !== correctionId);

    if (filteredCorrections.length === corrections.length) {
      throw new Error('Corecția nu a fost găsită.');
    }

    await prisma.caseBriefing.update({
      where: { caseId },
      data: {
        userCorrections: filteredCorrections as object,
        correctionsAppliedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.invalidateCache(caseId);

    logger.info('[Context] Correction deleted', {
      caseId,
      correctionId,
    });

    return true;
  }

  /**
   * Get context version for change detection
   */
  async getVersion(caseId: string): Promise<ContextVersion> {
    const briefing = await prisma.caseBriefing.findUnique({
      where: { caseId },
      select: {
        contextVersion: true,
        lastComputedAt: true,
        correctionsAppliedAt: true,
        userCorrections: true,
      },
    });

    const corrections = (briefing?.userCorrections as unknown as UserCorrection[]) || [];
    const activeCorrections = corrections.filter((c) => c.isActive);

    const lastModified = briefing
      ? new Date(
          Math.max(briefing.lastComputedAt.getTime(), briefing.correctionsAppliedAt?.getTime() || 0)
        )
      : new Date();

    return {
      caseId,
      version: briefing?.contextVersion || 0,
      lastModified: lastModified.toISOString(),
      hasCorrections: activeCorrections.length > 0,
      correctionCount: activeCorrections.length,
    };
  }

  /**
   * Invalidate cache for a case
   */
  async invalidateCache(caseId: string): Promise<void> {
    const pattern = `${this.CACHE_KEY_PREFIX}${caseId}:*`;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.warn('Failed to invalidate context file cache', { caseId, error });
    }
  }

  /**
   * Refresh client context in the CaseBriefing table
   * Called when regenerating context to ensure fresh client data
   */
  async refreshClientContext(caseId: string): Promise<void> {
    try {
      // Get case to find client and firm
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { clientId: true, firmId: true },
      });

      if (!caseData?.clientId) {
        logger.debug('[Context] No client linked to case', { caseId });
        return;
      }

      // Fetch fresh client context
      const freshClientContext = await clientContextService.getForClient(
        caseData.clientId,
        caseData.firmId
      );

      // Also invalidate client context cache
      await clientContextService.invalidate(caseData.clientId);

      // Update CaseBriefing with fresh client context
      await prisma.caseBriefing.updateMany({
        where: { caseId },
        data: {
          clientContext: JSON.parse(JSON.stringify(freshClientContext)),
        },
      });

      logger.info('[Context] Client context refreshed', {
        caseId,
        clientId: caseData.clientId,
        clientType: freshClientContext.type,
      });
    } catch (error) {
      logger.warn('[Context] Failed to refresh client context', { caseId, error });
    }
  }

  /**
   * Refresh health indicators for a case
   * Recalculates metrics and health indicators based on current data
   */
  async refreshHealthIndicators(caseId: string): Promise<void> {
    try {
      const now = new Date();

      // Get case creation date as fallback for activity calculation
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { createdAt: true, firmId: true },
      });

      if (!caseData) {
        logger.warn('[Context] Case not found for health indicators refresh', { caseId });
        return;
      }

      // Calculate metrics in parallel
      const [documentCount, emailStats, taskStats, lastActivity, upcomingDeadlines] =
        await Promise.all([
          prisma.caseDocument.count({ where: { caseId, firmId: caseData.firmId } }),
          prisma.email
            .aggregate({
              where: { caseLinks: { some: { caseId } } },
              _count: true,
            })
            .then(async (total) => {
              const unread = await prisma.email.count({
                where: { caseLinks: { some: { caseId } }, isRead: false },
              });
              return { total: total._count, unread };
            }),
          prisma.task
            .findMany({
              where: { caseId, status: { not: 'Completed' } },
              select: { dueDate: true },
            })
            .then((tasks) => {
              const pending = tasks.length;
              const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now).length;
              return { pending, overdue };
            }),
          prisma.caseActivityEntry.findFirst({
            where: { caseId },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
          prisma.task.findMany({
            where: {
              caseId,
              status: { not: 'Completed' },
              dueDate: { gte: now, lte: addDays(now, 30) },
            },
            select: { id: true, title: true, dueDate: true, priority: true },
            orderBy: { dueDate: 'asc' },
            take: 10,
          }),
        ]);

      // Use case creation date as fallback if no activity entries
      const daysWithoutActivity = lastActivity
        ? differenceInDays(now, lastActivity.createdAt)
        : differenceInDays(now, caseData.createdAt);

      // Format deadlines
      const deadlines = upcomingDeadlines
        .filter((t) => t.dueDate)
        .map((t) => ({
          taskId: t.id,
          title: t.title,
          dueAt: t.dueDate!.toISOString(),
          daysUntil: differenceInDays(t.dueDate!, now),
          priority: t.priority,
        }));

      // Calculate health indicators
      const healthIndicators: Array<{
        type: string;
        severity: 'high' | 'medium' | 'low';
        message: string;
      }> = [];

      // Staleness warning (no activity in 14+ days)
      if (daysWithoutActivity > 14) {
        healthIndicators.push({
          type: 'STALE',
          severity: daysWithoutActivity > 30 ? 'high' : 'medium',
          message: `Fără activitate de ${daysWithoutActivity} zile`,
        });
      }

      // Overdue tasks
      if (taskStats.overdue > 0) {
        healthIndicators.push({
          type: 'OVERDUE_TASKS',
          severity: 'high',
          message: `${taskStats.overdue} ${taskStats.overdue === 1 ? 'sarcină restantă' : 'sarcini restante'}`,
        });
      }

      // Approaching deadline (within 3 days)
      const urgentDeadlines = deadlines.filter((d) => d.daysUntil <= 3);
      if (urgentDeadlines.length > 0) {
        const nearest = urgentDeadlines[0];
        healthIndicators.push({
          type: 'APPROACHING_DEADLINE',
          severity: nearest.daysUntil <= 1 ? 'high' : 'medium',
          message:
            nearest.daysUntil === 0
              ? `Termen astăzi: ${nearest.title}`
              : nearest.daysUntil === 1
                ? `Termen mâine: ${nearest.title}`
                : `Termen în ${nearest.daysUntil} zile: ${nearest.title}`,
        });
      }

      // Unanswered emails (5+ unread)
      if (emailStats.unread >= 5) {
        healthIndicators.push({
          type: 'UNANSWERED_EMAILS',
          severity: emailStats.unread >= 10 ? 'high' : 'medium',
          message: `${emailStats.unread} emailuri necitite`,
        });
      }

      // Update CaseBriefing with fresh health indicators and deadlines
      await prisma.caseBriefing.updateMany({
        where: { caseId },
        data: {
          caseHealthIndicators: JSON.parse(JSON.stringify(healthIndicators)),
          upcomingDeadlines: JSON.parse(JSON.stringify(deadlines)),
        },
      });

      logger.info('[Context] Health indicators refreshed', {
        caseId,
        daysWithoutActivity,
        indicatorCount: healthIndicators.length,
      });
    } catch (error) {
      logger.warn('[Context] Failed to refresh health indicators', { caseId, error });
    }
  }

  /**
   * Refresh email thread summaries in the CaseBriefing table
   * Reads from ThreadSummary table and updates CaseBriefing.emailThreadSummaries
   */
  async refreshEmailThreadSummaries(caseId: string): Promise<void> {
    try {
      // Get case data for firmId
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseData) {
        logger.warn('[Context] Case not found for email refresh', { caseId });
        return;
      }

      // Get thread summaries for this case
      const threadSummaries = await prisma.threadSummary.findMany({
        where: {
          caseId,
          firmId: caseData.firmId,
          overview: { not: null },
        },
        orderBy: { lastAnalyzedAt: 'desc' },
        take: 8, // Limit for context size
        select: {
          conversationId: true,
          overview: true,
          keyPoints: true,
          actionItems: true,
          sentiment: true,
          participants: true,
          lastAnalyzedAt: true,
        },
      });

      // Get subjects and unread status from emails
      const conversationIds = threadSummaries.map((t) => t.conversationId);
      const latestEmails =
        conversationIds.length > 0
          ? await prisma.email.findMany({
              where: {
                conversationId: { in: conversationIds },
                firmId: caseData.firmId,
              },
              orderBy: { receivedDateTime: 'desc' },
              distinct: ['conversationId'],
              select: {
                conversationId: true,
                subject: true,
                isRead: true,
                receivedDateTime: true,
              },
            })
          : [];

      const emailMetaMap = new Map(latestEmails.map((e) => [e.conversationId, e]));

      // Format threads for storage
      const threads = threadSummaries.map((t) => {
        const emailMeta = emailMetaMap.get(t.conversationId);
        return {
          threadId: t.conversationId,
          subject: emailMeta?.subject || 'Fără subiect',
          participants: Array.isArray(t.participants) ? t.participants.slice(0, 3) : [],
          summary: t.overview || '',
          actionItems: Array.isArray(t.actionItems) ? t.actionItems : [],
          lastMessageAt:
            emailMeta?.receivedDateTime.toISOString() || t.lastAnalyzedAt.toISOString(),
          isUrgent: t.sentiment === 'urgent',
          isUnread: emailMeta ? !emailMeta.isRead : false,
        };
      });

      // Calculate counts
      const unreadCount = threads.filter((t) => t.isUnread).length;
      const urgentCount = threads.filter((t) => t.isUrgent).length;
      const pendingActionItems = threadSummaries
        .flatMap((t) => (Array.isArray(t.actionItems) ? t.actionItems : []))
        .slice(0, 5);

      // Update CaseBriefing with email thread summaries
      await prisma.caseBriefing.updateMany({
        where: { caseId },
        data: {
          emailThreadSummaries: {
            threads,
            pendingActionItems,
            unreadCount,
            urgentCount,
          },
        },
      });

      logger.info('[Context] Email thread summaries refreshed', {
        caseId,
        threadCount: threads.length,
        unreadCount,
        urgentCount,
      });
    } catch (error) {
      logger.warn('[Context] Failed to refresh email thread summaries', { caseId, error });
    }
  }

  // ============================================================================
  // Tiered Context Compression (Story 6.7)
  // ============================================================================

  /**
   * Generate compressed context tiers for a case.
   * Uses Haiku for cheap summarization.
   *
   * @param caseId - The case ID
   * @param fullContent - The full context content
   * @param firmId - The firm ID for usage tracking
   */
  async generateCompressedTiers(
    caseId: string,
    fullContent: string,
    firmId: string
  ): Promise<{ critical: string; standard: string }> {
    // Skip if content is already small
    const tokenEstimate = fullContent.length / 4;
    if (tokenEstimate < 300) {
      logger.debug('Content too small for compression, using full content', {
        caseId,
        tokenEstimate,
      });
      return { critical: fullContent, standard: fullContent };
    }

    // Generate critical tier (~100 tokens)
    const criticalPrompt = `Rezumă următorul context juridic în EXACT 100 de cuvinte sau mai puțin.
Include DOAR: părțile implicate, tipul cazului, și starea actuală.

Context:
${fullContent}

Rezumat (max 100 cuvinte):`;

    const criticalResponse = await aiClient.complete(
      criticalPrompt,
      {
        feature: 'case_context',
        firmId,
      },
      {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 200,
        temperature: 0.2,
      }
    );

    // Generate standard tier (~300 tokens)
    const standardPrompt = `Rezumă următorul context juridic în EXACT 300 de cuvinte sau mai puțin.
Include: părțile implicate, tipul cazului, starea actuală, și detaliile cheie relevante.

Context:
${fullContent}

Rezumat (max 300 cuvinte):`;

    const standardResponse = await aiClient.complete(
      standardPrompt,
      {
        feature: 'case_context',
        firmId,
      },
      {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 500,
        temperature: 0.2,
      }
    );

    logger.info('Generated compressed context tiers', {
      caseId,
      firmId,
      fullTokens: tokenEstimate,
      criticalLength: criticalResponse.content.length,
      standardLength: standardResponse.content.length,
    });

    return {
      critical: criticalResponse.content,
      standard: standardResponse.content,
    };
  }

  /**
   * Update a context file with compressed tiers.
   * Should be called after generating the full context.
   */
  async updateWithCompressedTiers(
    contextFileId: string,
    fullContent: string,
    firmId: string
  ): Promise<void> {
    const tiers = await this.generateCompressedTiers(
      contextFileId, // Using as caseId for simplicity
      fullContent,
      firmId
    );

    await prisma.caseContextFile.update({
      where: { id: contextFileId },
      data: {
        contextCritical: tiers.critical,
        contextStandard: tiers.standard,
        compressedAt: new Date(),
      },
    });

    logger.debug('Updated context file with compressed tiers', {
      contextFileId,
      firmId,
    });
  }

  /**
   * Generate thread summaries for emails linked to a specific case.
   * This is a targeted version of the nightly thread_summaries batch.
   * Called during context regeneration to ensure email summaries exist.
   */
  async generateCaseThreadSummaries(caseId: string): Promise<number> {
    try {
      // Get case data for firmId
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseData) {
        logger.warn('[Context] Case not found for thread summary generation', { caseId });
        return 0;
      }

      const firmId = caseData.firmId;

      // Find threads linked to this case that don't have summaries
      const threadsToProcess = await prisma.$queryRaw<{ conversationId: string }[]>`
        SELECT DISTINCT e.conversation_id as "conversationId"
        FROM emails e
        JOIN email_case_links ecl ON ecl.email_id = e.id
        LEFT JOIN thread_summaries ts ON ts.conversation_id = e.conversation_id AND ts.case_id = ${caseId}
        WHERE ecl.case_id = ${caseId}
          AND e.conversation_id IS NOT NULL
          AND ts.id IS NULL
        GROUP BY e.conversation_id
        HAVING COUNT(e.id) >= 2
        LIMIT 10
      `;

      if (threadsToProcess.length === 0) {
        logger.debug('[Context] No threads need summarization for case', { caseId });
        return 0;
      }

      logger.info('[Context] Generating thread summaries for case', {
        caseId,
        threadCount: threadsToProcess.length,
      });

      const model = await getModelForFeature(firmId, 'thread_summaries');
      let processed = 0;

      for (const { conversationId } of threadsToProcess) {
        try {
          await this.summarizeSingleThread(conversationId, caseId, firmId, model);
          processed++;
        } catch (error) {
          logger.warn('[Context] Failed to summarize thread', {
            caseId,
            conversationId,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      return processed;
    } catch (error) {
      logger.error('[Context] Failed to generate case thread summaries', { caseId, error });
      return 0;
    }
  }

  /**
   * Summarize a single email thread
   */
  private async summarizeSingleThread(
    conversationId: string,
    caseId: string,
    firmId: string,
    model: string
  ): Promise<void> {
    // Fetch emails in thread
    const emails = await prisma.email.findMany({
      where: { conversationId, firmId },
      orderBy: { receivedDateTime: 'asc' },
      select: {
        subject: true,
        bodyPreview: true,
        bodyContentClean: true,
        from: true,
        receivedDateTime: true,
      },
    });

    if (emails.length < 2) return;

    // Build thread content for AI
    const threadContent = emails
      .map((e) => {
        const from =
          (e.from as { emailAddress?: { name?: string } })?.emailAddress?.name || 'Unknown';
        const content = e.bodyContentClean || e.bodyPreview || '';
        return `De la: ${from}\nData: ${e.receivedDateTime.toISOString()}\n${content.slice(0, 500)}`;
      })
      .join('\n\n---\n\n');

    // Generate summary with AI
    const prompt = `Analizează acest fir de email juridic și oferă:
1. overview: Rezumat în 1-2 propoziții (în română)
2. keyPoints: Maximum 3 puncte cheie (listă)
3. actionItems: Acțiuni necesare identificate (listă, poate fi goală)
4. sentiment: Una din: positive, neutral, negative, urgent
5. participants: Lista de participanți (nume)

Fir de email:
${threadContent.slice(0, 3000)}

Răspunde DOAR cu JSON valid:
{"overview":"...","keyPoints":["..."],"actionItems":["..."],"sentiment":"neutral","participants":["..."]}`;

    const response = await aiClient.complete(
      prompt,
      { feature: 'thread_summaries', firmId },
      { model, maxTokens: 500, temperature: 0.3 }
    );

    // Parse response
    let parsed: {
      overview: string;
      keyPoints: string[];
      actionItems: string[];
      sentiment: string;
      participants: string[];
    };

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = {
          overview: response.content.slice(0, 200),
          keyPoints: [],
          actionItems: [],
          sentiment: 'neutral',
          participants: [],
        };
      }
    } catch {
      parsed = {
        overview: response.content.slice(0, 200),
        keyPoints: [],
        actionItems: [],
        sentiment: 'neutral',
        participants: [],
      };
    }

    // Upsert ThreadSummary (conversationId is unique)
    await prisma.threadSummary.upsert({
      where: { conversationId },
      create: {
        conversationId,
        caseId,
        firmId,
        overview: parsed.overview,
        keyPoints: parsed.keyPoints,
        actionItems: parsed.actionItems,
        sentiment: parsed.sentiment,
        participants: parsed.participants,
        messageCount: emails.length,
        lastAnalyzedAt: new Date(),
      },
      update: {
        caseId, // Update caseId if it was null before
        overview: parsed.overview,
        keyPoints: parsed.keyPoints,
        actionItems: parsed.actionItems,
        sentiment: parsed.sentiment,
        participants: parsed.participants,
        messageCount: emails.length,
        lastAnalyzedAt: new Date(),
      },
    });

    logger.debug('[Context] Thread summary generated', { conversationId, caseId });
  }

  /**
   * Get context for a case at a specific tier.
   * Falls back to higher tiers if lower tier not available.
   *
   * @param caseId - The case ID
   * @param source - The context source (e.g., 'word_addin')
   * @param tier - The context tier to retrieve
   */
  async getContextByTier(
    caseId: string,
    source: string,
    tier: ContextTier = 'full'
  ): Promise<string | null> {
    const contextFile = await prisma.caseContextFile.findFirst({
      where: {
        caseId,
        source,
      },
      select: {
        content: true,
        contextCritical: true,
        contextStandard: true,
      },
    });

    if (!contextFile) {
      logger.debug('No context file found for tier retrieval', {
        caseId,
        source,
        tier,
      });
      return null;
    }

    // Return requested tier or fall back to higher tiers
    switch (tier) {
      case 'critical':
        return contextFile.contextCritical || contextFile.contextStandard || contextFile.content;
      case 'standard':
        return contextFile.contextStandard || contextFile.content;
      case 'full':
      default:
        return contextFile.content;
    }
  }
}

export const caseContextFileService = new CaseContextFileService();
