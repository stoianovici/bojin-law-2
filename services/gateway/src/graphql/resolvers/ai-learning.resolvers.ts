/**
 * AI Learning Resolvers
 * Story 5.6: AI Learning and Personalization
 *
 * GraphQL resolvers for writing style learning, personal snippets,
 * task patterns, document preferences, and response time patterns.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { Prisma, type SnippetCategory } from '@prisma/client';
import { personalSnippetsService } from '../../services/personal-snippets.service';
import { draftEditTrackerService } from '../../services/draft-edit-tracker.service';
import { documentStructurePreferenceService } from '../../services/document-structure-preference.service';
import { responseTimePatternService } from '../../services/response-time-pattern.service';
import { personalizationDashboardService } from '../../services/personalization-dashboard.service';
import type {
  HeaderStylePreference,
  MarginPreferences,
  FontPreferences,
  SectionPreference,
} from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
  };
}

// ============================================================================
// Resolvers
// ============================================================================

export const aiLearningResolvers = {
  Query: {
    /**
     * Get the user's writing style profile
     */
    myWritingStyleProfile: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const profile = await prisma.writingStyleProfile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return null;
      }

      return {
        ...profile,
        commonPhrases: profile.commonPhrases || [],
        punctuationStyle: profile.punctuationStyle || {
          useOxfordComma: false,
          preferSemicolons: false,
          useDashes: 'em-dash',
          colonBeforeLists: true,
        },
        languagePatterns: profile.languagePatterns || {
          primaryLanguage: 'romanian',
          formalityByLanguage: {},
          preferredGreetingsByLanguage: {},
          legalTermsPreference: 'mixed',
        },
      };
    },

    /**
     * Get all personal snippets for the current user
     */
    mySnippets: async (
      _: unknown,
      args: { category?: SnippetCategory },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.getUserSnippets(user.id, args.category);
    },

    /**
     * Get a specific snippet by ID
     */
    snippet: async (_: unknown, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.getSnippetById(args.id, user.id);
    },

    /**
     * Search snippets by shortcut or content
     */
    searchSnippets: async (
      _: unknown,
      args: { query: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.searchSnippets(user.id, { query: args.query });
    },

    /**
     * Get learned task creation patterns
     */
    myTaskPatterns: async (
      _: unknown,
      args: { isActive?: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const where: Record<string, unknown> = { userId: user.id };
      if (args.isActive !== undefined) {
        where.isActive = args.isActive;
      }

      return prisma.taskCreationPattern.findMany({
        where,
        orderBy: [{ confidence: 'desc' }, { occurrenceCount: 'desc' }],
      });
    },

    /**
     * Get document structure preferences
     */
    myDocumentPreferences: async (
      _: unknown,
      args: { documentType?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (args.documentType) {
        const preference = await documentStructurePreferenceService.getPreferenceByType(
          args.documentType,
          user.id
        );
        return preference ? [preference] : [];
      }

      return documentStructurePreferenceService.getUserPreferences(user.id);
    },

    /**
     * Get response time patterns
     */
    myResponseTimePatterns: async (
      _: unknown,
      args: { taskType?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return responseTimePatternService.getUserPatterns(user.id, {
        taskType: args.taskType,
      });
    },

    /**
     * Predict completion time for a task
     */
    predictCompletionTime: async (
      _: unknown,
      args: { taskType: string; caseType?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return responseTimePatternService.predictCompletionTime(
        args.taskType,
        user.id,
        args.caseType || undefined
      );
    },

    /**
     * Get suggested tasks based on current context
     */
    suggestedTasks: async (
      _: unknown,
      args: { caseType?: string; documentType?: string; emailKeywords?: string[] },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Find matching patterns based on context
      const patterns = await prisma.taskCreationPattern.findMany({
        where: {
          userId: user.id,
          isActive: true,
          confidence: { gte: 0.5 },
        },
        orderBy: { confidence: 'desc' },
        take: 5,
      });

      // Filter patterns that match the provided context
      return patterns
        .filter((pattern) => {
          const triggerContext = pattern.triggerContext as Record<string, unknown>;
          if (args.caseType && triggerContext.caseType === args.caseType) return true;
          if (args.documentType && triggerContext.documentType === args.documentType) return true;
          if (args.emailKeywords && triggerContext.keywords) {
            const patternKeywords = triggerContext.keywords as string[];
            return args.emailKeywords.some((k) =>
              patternKeywords.some((pk) => pk.toLowerCase().includes(k.toLowerCase()))
            );
          }
          return false;
        })
        .map((pattern) => ({
          patternId: pattern.id,
          patternName: pattern.patternName,
          taskTemplate: pattern.taskTemplate,
          triggerContext: pattern.triggerContext,
          confidence: pattern.confidence,
          occurrenceCount: pattern.occurrenceCount,
        }));
    },

    /**
     * Get AI-suggested snippets to save
     */
    snippetSuggestions: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalizationDashboardService.getSnippetSuggestions(user.id);
    },

    /**
     * Get overall learning status
     */
    learningStatus: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalizationDashboardService.getLearningStatus(user.id);
    },

    /**
     * Get personalization settings
     */
    personalizationSettings: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalizationDashboardService.getPersonalizationSettings(user.id);
    },
  },

  Mutation: {
    /**
     * Create a new personal snippet
     */
    createSnippet: async (
      _: unknown,
      args: {
        input: {
          shortcut: string;
          title: string;
          content: string;
          category: SnippetCategory;
        };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.createSnippet(args.input, user.id, user.firmId);
    },

    /**
     * Update a personal snippet
     */
    updateSnippet: async (
      _: unknown,
      args: {
        id: string;
        input: {
          shortcut?: string;
          title?: string;
          content?: string;
          category?: SnippetCategory;
        };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.updateSnippet(args.id, args.input, user.id);
    },

    /**
     * Delete a personal snippet
     */
    deleteSnippet: async (_: unknown, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.deleteSnippet(args.id, user.id);
    },

    /**
     * Record snippet usage (updates usage count)
     */
    recordSnippetUsage: async (_: unknown, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.recordUsage(args.id, user.id);
    },

    /**
     * Accept a snippet suggestion
     */
    acceptSnippetSuggestion: async (
      _: unknown,
      args: {
        content: string;
        shortcut: string;
        title: string;
        category: SnippetCategory;
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalSnippetsService.acceptSuggestion(
        {
          content: args.content,
          suggestedShortcut: args.shortcut,
          suggestedTitle: args.title,
          category: args.category,
          occurrenceCount: 1,
          confidence: 0.8,
          sourceContext: { detectedAt: new Date() },
        },
        user.id,
        user.firmId
      );
    },

    /**
     * Dismiss a snippet suggestion
     */
    dismissSnippetSuggestion: async (
      _: unknown,
      args: { content: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Store dismissal in user preferences to avoid suggesting again
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true },
      });

      const prefs = (userRecord?.preferences || {}) as Record<string, unknown>;
      const dismissedSnippets = (prefs.dismissedSnippetSuggestions || []) as string[];
      dismissedSnippets.push(args.content.toLowerCase().trim());

      await prisma.user.update({
        where: { id: user.id },
        data: {
          preferences: {
            ...prefs,
            dismissedSnippetSuggestions: dismissedSnippets.slice(-100), // Keep last 100
          },
        },
      });

      return true;
    },

    /**
     * Create a task creation pattern
     */
    createTaskPattern: async (
      _: unknown,
      args: {
        input: {
          patternName: string;
          triggerType: string;
          triggerContext: Record<string, unknown>;
          taskTemplate: Record<string, unknown>;
        };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return prisma.taskCreationPattern.create({
        data: {
          firmId: user.firmId,
          userId: user.id,
          patternName: args.input.patternName,
          triggerType: args.input.triggerType,
          triggerContext: args.input.triggerContext as Prisma.InputJsonValue,
          taskTemplate: args.input.taskTemplate as Prisma.InputJsonValue,
          occurrenceCount: 1,
          confidence: 0.5,
          isActive: true,
        },
      });
    },

    /**
     * Toggle task pattern active status
     */
    toggleTaskPattern: async (
      _: unknown,
      args: { id: string; isActive: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const pattern = await prisma.taskCreationPattern.findFirst({
        where: { id: args.id, userId: user.id },
      });

      if (!pattern) {
        throw new GraphQLError('Pattern not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return prisma.taskCreationPattern.update({
        where: { id: args.id },
        data: { isActive: args.isActive },
      });
    },

    /**
     * Delete a task pattern
     */
    deleteTaskPattern: async (_: unknown, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const pattern = await prisma.taskCreationPattern.findFirst({
        where: { id: args.id, userId: user.id },
      });

      if (!pattern) {
        throw new GraphQLError('Pattern not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      await prisma.taskCreationPattern.delete({ where: { id: args.id } });
      return true;
    },

    /**
     * Update document structure preferences
     */
    updateDocumentPreference: async (
      _: unknown,
      args: {
        input: {
          documentType: string;
          preferredSections: SectionPreference[];
          headerStyle: HeaderStylePreference;
          footerContent?: string;
          marginPreferences?: MarginPreferences;
          fontPreferences?: FontPreferences;
        };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if preference exists
      const existing = await documentStructurePreferenceService.getPreferenceByType(
        args.input.documentType,
        user.id
      );

      if (existing) {
        return documentStructurePreferenceService.updatePreference(
          existing.id,
          {
            preferredSections: args.input.preferredSections,
            headerStyle: args.input.headerStyle,
            footerContent: args.input.footerContent,
            marginPreferences: args.input.marginPreferences || null,
            fontPreferences: args.input.fontPreferences || null,
          },
          user.id
        );
      }

      return documentStructurePreferenceService.createPreference(
        {
          documentType: args.input.documentType,
          preferredSections: args.input.preferredSections,
          headerStyle: args.input.headerStyle,
          footerContent: args.input.footerContent,
          marginPreferences: args.input.marginPreferences,
          fontPreferences: args.input.fontPreferences,
        },
        user.id,
        user.firmId
      );
    },

    /**
     * Record an edit to learn from
     */
    recordDraftEdit: async (
      _: unknown,
      args: {
        input: {
          draftId: string;
          originalText: string;
          editedText: string;
          editLocation: string;
        };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await draftEditTrackerService.trackDraftEdit(
        {
          draftId: args.input.draftId,
          originalText: args.input.originalText,
          editedText: args.input.editedText,
          editLocation: args.input.editLocation,
        },
        user.id,
        user.firmId
      );

      return true;
    },

    /**
     * Trigger style analysis from recent edits
     */
    analyzeWritingStyle: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get unanalyzed edits
      const edits = await draftEditTrackerService.getUnanalyzedEdits(user.id, 50);

      if (edits.length < 5) {
        // Not enough data to analyze
        return null;
      }

      // Mark edits as analyzed
      await draftEditTrackerService.markAsAnalyzed(edits.map((e) => e.id));

      // Get or create writing style profile
      let profile = await prisma.writingStyleProfile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        profile = await prisma.writingStyleProfile.create({
          data: {
            firmId: user.firmId,
            userId: user.id,
            formalityLevel: 0.5,
            averageSentenceLength: 15,
            vocabularyComplexity: 0.5,
            preferredTone: 'Professional',
            commonPhrases: [],
            punctuationStyle: {
              useOxfordComma: false,
              preferSemicolons: false,
              useDashes: 'em-dash',
              colonBeforeLists: true,
            },
            languagePatterns: {
              primaryLanguage: 'romanian',
              formalityByLanguage: {},
              preferredGreetingsByLanguage: {},
              legalTermsPreference: 'mixed',
            },
            sampleCount: edits.length,
            lastAnalyzedAt: new Date(),
          },
        });
      } else {
        profile = await prisma.writingStyleProfile.update({
          where: { userId: user.id },
          data: {
            sampleCount: profile.sampleCount + edits.length,
            lastAnalyzedAt: new Date(),
          },
        });
      }

      return {
        ...profile,
        commonPhrases: profile.commonPhrases || [],
        punctuationStyle: profile.punctuationStyle || {},
        languagePatterns: profile.languagePatterns || {},
      };
    },

    /**
     * Reset writing style profile
     */
    resetWritingStyleProfile: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalizationDashboardService.resetWritingStyleProfile(user.id);
    },

    /**
     * Update personalization settings
     */
    updatePersonalizationSettings: async (
      _: unknown,
      args: {
        input: {
          styleAdaptationEnabled?: boolean;
          snippetSuggestionsEnabled?: boolean;
          taskPatternSuggestionsEnabled?: boolean;
          responseTimePredictionsEnabled?: boolean;
          documentPreferencesEnabled?: boolean;
          learningFromEditsEnabled?: boolean;
          privacyLevel?: 'standard' | 'minimal' | 'full';
        };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalizationDashboardService.updatePersonalizationSettings(
        user.id,
        args.input
      );
    },

    /**
     * Clear all learning data
     */
    clearAllLearningData: async (_: unknown, __: unknown, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return personalizationDashboardService.clearAllLearningData(user.id);
    },
  },

  // Enum resolvers
  SnippetCategory: {
    Greeting: 'Greeting',
    Closing: 'Closing',
    LegalPhrase: 'LegalPhrase',
    ClientResponse: 'ClientResponse',
    InternalNote: 'InternalNote',
    Custom: 'Custom',
  },
};
