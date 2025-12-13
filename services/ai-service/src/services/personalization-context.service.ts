/**
 * Personalization Context Service
 * Story 5.6: AI Learning and Personalization
 *
 * Aggregates all user preferences and learned patterns into a unified context
 * that can be used to personalize AI-generated content
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../lib/logger';

// Simple in-memory cache for personalization contexts
const personalizationCache = new Map<
  string,
  { context: PersonalizationContext; expiresAt: Date }
>();

const simpleCacheService = {
  async get(key: string): Promise<PersonalizationContext | null> {
    const cached = personalizationCache.get(key);
    if (cached && cached.expiresAt > new Date()) {
      return cached.context;
    }
    return null;
  },
  async set(key: string, context: PersonalizationContext, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    personalizationCache.set(key, { context, expiresAt });
  },
  async delete(key: string): Promise<void> {
    personalizationCache.delete(key);
  },
};

// ============================================================================
// Types
// ============================================================================

export interface WritingStyleProfile {
  id: string;
  userId: string;
  formalityLevel: number;
  averageSentenceLength: number;
  vocabularyComplexity: number;
  preferredTone: string;
  commonPhrases: Array<{ phrase: string; frequency: number; context: string }>;
  punctuationStyle: Record<string, unknown>;
  languagePatterns: Record<string, unknown>;
  sampleCount: number;
}

export interface PersonalSnippet {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  usageCount: number;
}

export interface TaskCreationPattern {
  id: string;
  patternName: string;
  triggerType: string;
  triggerContext: Record<string, unknown>;
  taskTemplate: Record<string, unknown>;
  confidence: number;
}

export interface DocumentStructurePreference {
  id: string;
  documentType: string;
  preferredSections: Array<{ name: string; order: number; required: boolean }>;
  headerStyle: Record<string, unknown>;
  fontPreferences: Record<string, unknown> | null;
}

export interface ResponseTimePattern {
  taskType: string;
  caseType: string | null;
  averageResponseHours: number;
  medianResponseHours: number;
  sampleCount: number;
}

export interface CompletionTimePrediction {
  estimatedHours: number;
  confidenceLevel: number;
  basedOnSamples: number;
  adjustedForDayOfWeek: boolean;
  adjustedForTimeOfDay: boolean;
  factors: string[];
}

export interface PersonalizationContext {
  userId: string;
  firmId: string;
  writingStyle?: Partial<WritingStyleProfile>;
  recentSnippets?: PersonalSnippet[];
  documentPreferences?: DocumentStructurePreference;
  responseTimeEstimate?: CompletionTimePrediction;
  taskPatterns?: TaskCreationPattern[];
  loadedAt: Date;
  expiresAt: Date;
}

export interface PersonalizationSettings {
  userId: string;
  styleAdaptationEnabled: boolean;
  snippetSuggestionsEnabled: boolean;
  taskPatternSuggestionsEnabled: boolean;
  responseTimePredictionsEnabled: boolean;
  documentPreferencesEnabled: boolean;
  learningFromEditsEnabled: boolean;
  privacyLevel: 'full' | 'limited' | 'minimal';
}

export interface DataProviders {
  getWritingStyleProfile: (userId: string, firmId: string) => Promise<WritingStyleProfile | null>;
  getPersonalSnippets: (userId: string, firmId: string) => Promise<PersonalSnippet[]>;
  getTaskPatterns: (userId: string, firmId: string) => Promise<TaskCreationPattern[]>;
  getDocumentPreference: (
    userId: string,
    firmId: string,
    documentType: string
  ) => Promise<DocumentStructurePreference | null>;
  getResponseTimePatterns: (userId: string, firmId: string) => Promise<ResponseTimePattern[]>;
  getPersonalizationSettings: (userId: string) => Promise<PersonalizationSettings | null>;
}

// ============================================================================
// Service Implementation
// ============================================================================

class PersonalizationContextService {
  private cacheTtlSeconds: number;
  private preloadEnabled: boolean;
  private dataProviders: DataProviders | null = null;

  constructor() {
    this.cacheTtlSeconds = parseInt(process.env.PERSONALIZATION_CACHE_TTL_SECONDS || '3600', 10);
    this.preloadEnabled = process.env.PERSONALIZATION_PRELOAD_ENABLED !== 'false';
  }

  /**
   * Register data providers for loading personalization data
   */
  setDataProviders(providers: DataProviders): void {
    this.dataProviders = providers;
    logger.info('Personalization data providers registered');
  }

  /**
   * Build a complete personalization context for a user
   */
  async buildContext(
    userId: string,
    firmId: string,
    options?: {
      documentType?: string;
      taskType?: string;
      caseType?: string;
      forceRefresh?: boolean;
    }
  ): Promise<PersonalizationContext> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(userId, firmId, options);

    try {
      // Check cache first
      if (!options?.forceRefresh) {
        const cached = await simpleCacheService.get(cacheKey);
        if (cached) {
          logger.debug('Returning cached personalization context', { userId });
          return cached;
        }
      }

      if (!this.dataProviders) {
        logger.warn('Data providers not configured, returning empty context');
        return this.createEmptyContext(userId, firmId);
      }

      // Load settings first to check what's enabled
      const settings = await this.dataProviders.getPersonalizationSettings(userId);
      const context = await this.loadContext(userId, firmId, settings, options);

      // Cache the context
      await simpleCacheService.set(cacheKey, context, this.cacheTtlSeconds);

      logger.debug('Built personalization context', {
        userId,
        durationMs: Date.now() - startTime,
        hasWritingStyle: !!context.writingStyle,
        snippetCount: context.recentSnippets?.length || 0,
        patternCount: context.taskPatterns?.length || 0,
      });

      return context;
    } catch (error) {
      logger.error('Failed to build personalization context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyContext(userId, firmId);
    }
  }

  /**
   * Get writing style prompt additions for AI requests
   */
  getStylePromptAdditions(context: PersonalizationContext): string {
    if (!context.writingStyle || context.writingStyle.sampleCount === 0) {
      return '';
    }

    const style = context.writingStyle;
    const additions: string[] = [];

    if (style.formalityLevel !== undefined) {
      const formality =
        style.formalityLevel > 0.7
          ? 'formal and professional'
          : style.formalityLevel > 0.4
            ? 'balanced professional tone'
            : 'conversational and approachable';
      additions.push(`- Use a ${formality} writing style`);
    }

    if (style.averageSentenceLength) {
      additions.push(
        `- Target approximately ${Math.round(style.averageSentenceLength)} words per sentence`
      );
    }

    if (style.preferredTone) {
      additions.push(`- Match the user's ${style.preferredTone} tone`);
    }

    if (style.commonPhrases && style.commonPhrases.length > 0) {
      const phrases = style.commonPhrases
        .slice(0, 5)
        .map((p) => `"${p.phrase}"`)
        .join(', ');
      additions.push(`- Consider using familiar phrases: ${phrases}`);
    }

    return additions.length > 0 ? `\n\n**User Style Preferences:**\n${additions.join('\n')}` : '';
  }

  /**
   * Get document structure additions for AI requests
   */
  getDocumentStructureAdditions(context: PersonalizationContext): string {
    if (!context.documentPreferences) {
      return '';
    }

    const prefs = context.documentPreferences;
    const additions: string[] = [];

    if (prefs.preferredSections && prefs.preferredSections.length > 0) {
      const sections = prefs.preferredSections
        .sort((a, b) => a.order - b.order)
        .map((s) => s.name)
        .join(', ');
      additions.push(`- Include these sections in order: ${sections}`);
    }

    if (prefs.headerStyle) {
      const style = prefs.headerStyle as Record<string, string>;
      if (style.format) {
        additions.push(`- Use ${style.format} header numbering`);
      }
    }

    return additions.length > 0
      ? `\n\n**Document Structure Preferences:**\n${additions.join('\n')}`
      : '';
  }

  /**
   * Predict task completion time
   */
  async predictCompletionTime(
    userId: string,
    firmId: string,
    taskType: string,
    caseType?: string
  ): Promise<CompletionTimePrediction | null> {
    if (!this.dataProviders) {
      return null;
    }

    try {
      const patterns = await this.dataProviders.getResponseTimePatterns(userId, firmId);

      // Find matching pattern
      const exactMatch = patterns.find((p) => p.taskType === taskType && p.caseType === caseType);
      const typeMatch = patterns.find((p) => p.taskType === taskType && !p.caseType);
      const pattern = exactMatch || typeMatch;

      if (!pattern || pattern.sampleCount < 3) {
        return null;
      }

      // Calculate prediction
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hourOfDay = now.getHours();

      // Base estimate on median (more robust than average)
      let estimatedHours = pattern.medianResponseHours;
      const factors: string[] = [];

      // Adjust for time of day (slower in evenings/mornings)
      let adjustedForTimeOfDay = false;
      if (hourOfDay < 9 || hourOfDay > 18) {
        estimatedHours *= 1.2;
        adjustedForTimeOfDay = true;
        factors.push('Outside business hours');
      }

      // Adjust for day of week (slower on Fridays, faster early week)
      let adjustedForDayOfWeek = false;
      if (dayOfWeek === 5) {
        estimatedHours *= 1.15;
        adjustedForDayOfWeek = true;
        factors.push('Friday (typically slower)');
      } else if (dayOfWeek === 1) {
        estimatedHours *= 0.95;
        adjustedForDayOfWeek = true;
        factors.push('Monday (typically faster)');
      }

      // Confidence based on sample count
      const confidenceLevel = Math.min(0.9, 0.5 + pattern.sampleCount * 0.05);

      return {
        estimatedHours: Math.round(estimatedHours * 10) / 10,
        confidenceLevel,
        basedOnSamples: pattern.sampleCount,
        adjustedForDayOfWeek,
        adjustedForTimeOfDay,
        factors,
      };
    } catch (error) {
      logger.error('Failed to predict completion time', {
        userId,
        taskType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get suggested tasks based on patterns
   */
  getSuggestedTasks(
    context: PersonalizationContext,
    triggerContext: {
      caseType?: string;
      documentType?: string;
      emailKeywords?: string[];
    }
  ): Array<{ pattern: TaskCreationPattern; matchScore: number }> {
    if (!context.taskPatterns || context.taskPatterns.length === 0) {
      return [];
    }

    const suggestions: Array<{
      pattern: TaskCreationPattern;
      matchScore: number;
    }> = [];

    for (const pattern of context.taskPatterns) {
      let matchScore = 0;

      // Match by trigger type
      const trigger = pattern.triggerContext as Record<string, unknown>;

      if (pattern.triggerType === 'case_type' && triggerContext.caseType) {
        if (trigger.matchValue === triggerContext.caseType) {
          matchScore = pattern.confidence;
        }
      }

      if (pattern.triggerType === 'document_type' && triggerContext.documentType) {
        if (trigger.matchValue === triggerContext.documentType) {
          matchScore = pattern.confidence;
        }
      }

      if (pattern.triggerType === 'email_keyword' && triggerContext.emailKeywords) {
        const keywords = (trigger.keywords as string[]) || [];
        const matchingKeywords = keywords.filter((k) =>
          triggerContext.emailKeywords?.some((ek) => ek.toLowerCase().includes(k.toLowerCase()))
        );
        if (matchingKeywords.length > 0) {
          matchScore = pattern.confidence * (matchingKeywords.length / keywords.length);
        }
      }

      if (matchScore > 0.5) {
        suggestions.push({ pattern, matchScore });
      }
    }

    return suggestions.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Invalidate cached context
   */
  async invalidateContext(
    userId: string,
    firmId: string,
    options?: {
      documentType?: string;
      taskType?: string;
      caseType?: string;
    }
  ): Promise<void> {
    const cacheKey = this.getCacheKey(userId, firmId, options);
    await simpleCacheService.delete(cacheKey);

    // Also invalidate the generic cache
    if (options) {
      await simpleCacheService.delete(this.getCacheKey(userId, firmId));
    }

    logger.debug('Invalidated personalization context cache', {
      userId,
      cacheKey,
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadContext(
    userId: string,
    firmId: string,
    settings: PersonalizationSettings | null,
    options?: {
      documentType?: string;
      taskType?: string;
      caseType?: string;
    }
  ): Promise<PersonalizationContext> {
    const providers = this.dataProviders!;
    const effectiveSettings = settings || this.getDefaultSettings(userId);

    const [writingStyle, snippets, taskPatterns, documentPreference] = await Promise.all([
      effectiveSettings.styleAdaptationEnabled
        ? providers.getWritingStyleProfile(userId, firmId)
        : null,
      effectiveSettings.snippetSuggestionsEnabled
        ? providers.getPersonalSnippets(userId, firmId)
        : [],
      effectiveSettings.taskPatternSuggestionsEnabled
        ? providers.getTaskPatterns(userId, firmId)
        : [],
      effectiveSettings.documentPreferencesEnabled && options?.documentType
        ? providers.getDocumentPreference(userId, firmId, options.documentType)
        : null,
    ]);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.cacheTtlSeconds * 1000);

    return {
      userId,
      firmId,
      writingStyle: writingStyle || undefined,
      recentSnippets: snippets.slice(0, 20),
      documentPreferences: documentPreference || undefined,
      taskPatterns: taskPatterns.filter((p) => p.confidence >= 0.6),
      loadedAt: now,
      expiresAt,
    };
  }

  private createEmptyContext(userId: string, firmId: string): PersonalizationContext {
    const now = new Date();
    return {
      userId,
      firmId,
      loadedAt: now,
      expiresAt: new Date(now.getTime() + 60000), // 1 minute
    };
  }

  private getCacheKey(
    userId: string,
    firmId: string,
    options?: {
      documentType?: string;
      taskType?: string;
      caseType?: string;
    }
  ): string {
    let key = `personalization:${userId}:${firmId}`;
    if (options?.documentType) key += `:doc:${options.documentType}`;
    if (options?.taskType) key += `:task:${options.taskType}`;
    if (options?.caseType) key += `:case:${options.caseType}`;
    return key;
  }

  private getDefaultSettings(userId: string): PersonalizationSettings {
    return {
      userId,
      styleAdaptationEnabled: true,
      snippetSuggestionsEnabled: true,
      taskPatternSuggestionsEnabled: true,
      responseTimePredictionsEnabled: true,
      documentPreferencesEnabled: true,
      learningFromEditsEnabled: true,
      privacyLevel: 'full',
    };
  }
}

export const personalizationContextService = new PersonalizationContextService();
export default personalizationContextService;
