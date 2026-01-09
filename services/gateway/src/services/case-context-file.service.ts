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
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

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
    if (!richContext) {
      // Generate basic briefing if rich context not available
      const briefing = await caseBriefingService.getBriefing(caseId);
      const briefingText = await caseBriefingService.getBriefingText(caseId);
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
    }

    // Get corrections
    const corrections = await this.getCorrections(caseId);

    // Apply corrections to context
    const correctedContext = this.applyCorrections(richContext, corrections);

    // Build sections based on profile
    const sections = await this.buildSections(correctedContext, profile);

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

    logger.debug('Generated context file', {
      caseId,
      profileCode: profile.code,
      tokenCount,
      sections: sections.length,
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
}

export const caseContextFileService = new CaseContextFileService();
