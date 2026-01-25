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
import { aiClient } from './ai-client.service';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

type ContextTier = 'critical' | 'standard' | 'full';

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
    context: RichCaseContext,
    profile: ContextProfile
  ): Promise<ContextSection[]> {
    const sections: ContextSection[] = [];
    const enabledSections = profile.sections
      .filter((s) => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const sectionConfig of enabledSections) {
      const section = this.buildSection(context, sectionConfig);
      if (section && section.content.trim()) {
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
        const parties = context.briefingData.parties.slice(0, maxItems || 15);
        const content = parties
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
        const threads = context.emailThreadSummaries.slice(0, maxItems || 5);
        if (threads.length === 0) return null;
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
   */
  private applyCorrections(
    context: RichCaseContext,
    corrections: UserCorrection[]
  ): RichCaseContext & { customNotes?: string[] } {
    const result = JSON.parse(JSON.stringify(context)) as RichCaseContext & {
      customNotes?: string[];
    };

    for (const correction of corrections.filter((c) => c.isActive)) {
      switch (correction.correctionType) {
        case 'override':
          // For now, just add as a note - full override logic can be added later
          if (!result.customNotes) result.customNotes = [];
          result.customNotes.push(`[Corecție] ${correction.correctedValue}`);
          break;

        case 'append':
          if (!result.customNotes) result.customNotes = [];
          result.customNotes.push(correction.correctedValue);
          break;

        case 'note':
          if (!result.customNotes) result.customNotes = [];
          result.customNotes.push(`[Notă] ${correction.correctedValue}`);
          break;
      }
    }

    return result;
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
