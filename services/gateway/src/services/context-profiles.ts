/**
 * Context Profiles Registry
 * Maps each AI operation to its required context tiers and sections
 *
 * This registry defines:
 * - Which parts of Core context each operation needs
 * - Which Extended context sections to include
 * - Whether Historical context is available/required
 */

import type {
  AIOperation,
  OperationContextProfile,
  ExtendedSection,
  CoreContextSelector,
} from '@legal-platform/types';

// ============================================================================
// Profile Definitions
// ============================================================================

/**
 * Context profiles for all AI operations
 *
 * Core selector options:
 * - full: All client, case, actor, and team info
 * - clientOnly: Just client identity
 * - caseOnly: Just case identity
 * - actorsOnly: Just actors
 * - minimal: Just case number, title, status
 *
 * Historical options:
 * - true: Always include
 * - false: Never include
 * - 'on-request': Include if explicitly requested
 */
export const contextProfiles: Record<AIOperation, OperationContextProfile> = {
  // ==========================================================================
  // Email Operations
  // ==========================================================================

  'email.reply': {
    operation: 'email.reply',
    core: { full: true },
    extended: ['emails.threadHistory', 'patterns.writingStyle'],
    historical: false,
  },

  'email.categorize': {
    operation: 'email.categorize',
    core: { actorsOnly: true },
    extended: ['emails.recentThreads'],
    historical: false,
  },

  'email.threadSummary': {
    operation: 'email.threadSummary',
    core: { full: true },
    extended: ['emails.threadHistory'],
    historical: false,
  },

  'email.actionExtract': {
    operation: 'email.actionExtract',
    core: { full: true },
    extended: ['emails.threadHistory', 'timeline.chapters'],
    historical: false,
  },

  'email.attachmentSuggest': {
    operation: 'email.attachmentSuggest',
    core: { full: true },
    extended: ['documents.recentDocs'],
    historical: false,
  },

  // ==========================================================================
  // Document Operations
  // ==========================================================================

  'document.draft': {
    operation: 'document.draft',
    core: { full: true },
    extended: ['documents.templateContext', 'patterns.writingStyle', 'patterns.commonPhrases'],
    historical: 'on-request',
  },

  'document.summarize': {
    operation: 'document.summarize',
    core: { minimal: true },
    extended: [],
    historical: false,
  },

  'document.templateFill': {
    operation: 'document.templateFill',
    core: { full: true },
    extended: ['documents.templateContext'],
    historical: false,
  },

  'document.suggest': {
    operation: 'document.suggest',
    core: { full: true },
    extended: ['documents.recentDocs', 'timeline.chapters', 'timeline.recentActivity'],
    historical: false,
  },

  'document.explain': {
    operation: 'document.explain',
    core: { caseOnly: true },
    extended: [],
    historical: false,
  },

  // ==========================================================================
  // Case Analysis
  // ==========================================================================

  'case.summary': {
    operation: 'case.summary',
    core: { full: true },
    extended: ['timeline.chapters', 'analysis.openQuestions', 'analysis.recentNotes'],
    historical: 'on-request',
  },

  'case.health': {
    operation: 'case.health',
    core: { full: true },
    extended: [
      'timeline.chapters',
      'timeline.recentActivity',
      'analysis.openQuestions',
      'analysis.riskIndicators',
    ],
    historical: false,
  },

  'case.risk': {
    operation: 'case.risk',
    core: { full: true },
    extended: ['timeline.chapters', 'timeline.recentActivity', 'analysis.riskIndicators'],
    historical: true,
  },

  'case.morningBriefing': {
    operation: 'case.morningBriefing',
    core: { full: true },
    extended: ['timeline.recentActivity', 'emails.recentThreads', 'analysis.openQuestions'],
    historical: false,
  },

  'case.phaseDetect': {
    operation: 'case.phaseDetect',
    core: { full: true },
    extended: ['timeline.chapters', 'documents.recentDocs', 'timeline.recentActivity'],
    historical: false,
  },

  // ==========================================================================
  // AI Assistant
  // ==========================================================================

  'assistant.chat': {
    operation: 'assistant.chat',
    core: { full: true },
    extended: [], // Dynamically determined based on query
    historical: 'on-request',
  },

  'assistant.taskCreate': {
    operation: 'assistant.taskCreate',
    core: { full: true },
    extended: ['timeline.chapters'],
    historical: false,
  },

  'assistant.emailSend': {
    operation: 'assistant.emailSend',
    core: { full: true },
    extended: ['emails.recentThreads', 'patterns.writingStyle'],
    historical: false,
  },

  'assistant.nlCommand': {
    operation: 'assistant.nlCommand',
    core: { minimal: true },
    extended: [],
    historical: false,
  },

  // ==========================================================================
  // Learning Operations
  // ==========================================================================

  'learning.writingStyle': {
    operation: 'learning.writingStyle',
    core: { minimal: true },
    extended: ['patterns.writingStyle'],
    historical: true,
  },

  'learning.snippets': {
    operation: 'learning.snippets',
    core: { minimal: true },
    extended: ['patterns.commonPhrases'],
    historical: true,
  },

  'learning.taskPatterns': {
    operation: 'learning.taskPatterns',
    core: { caseOnly: true },
    extended: ['timeline.chapters'],
    historical: true,
  },

  'learning.responsePatterns': {
    operation: 'learning.responsePatterns',
    core: { minimal: true },
    extended: ['patterns.writingStyle'],
    historical: true,
  },

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  'search.fullText': {
    operation: 'search.fullText',
    core: { minimal: true },
    extended: [],
    historical: false,
  },

  'search.semantic': {
    operation: 'search.semantic',
    core: { full: true },
    extended: ['documents.recentDocs'],
    historical: false,
  },

  'search.documentRetrieval': {
    operation: 'search.documentRetrieval',
    core: { caseOnly: true },
    extended: ['documents.recentDocs'],
    historical: false,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all operations that require full core context
 */
export function getOperationsRequiringFullCore(): AIOperation[] {
  return Object.entries(contextProfiles)
    .filter(([_, profile]) => profile.core.full)
    .map(([op]) => op as AIOperation);
}

/**
 * Get all operations that can use historical context
 */
export function getOperationsWithHistorical(): AIOperation[] {
  return Object.entries(contextProfiles)
    .filter(([_, profile]) => profile.historical === true || profile.historical === 'on-request')
    .map(([op]) => op as AIOperation);
}

/**
 * Get extended sections required for an operation
 */
export function getExtendedSections(operation: AIOperation): ExtendedSection[] {
  return contextProfiles[operation]?.extended || [];
}

/**
 * Check if an operation needs a specific extended section
 */
export function needsSection(operation: AIOperation, section: ExtendedSection): boolean {
  return contextProfiles[operation]?.extended.includes(section) || false;
}

/**
 * Get the token budget estimate for an operation
 * Based on typical context sizes
 */
export function estimateTokenBudget(operation: AIOperation): { min: number; max: number } {
  const profile = contextProfiles[operation];
  if (!profile) return { min: 0, max: 0 };

  let min = 0;
  let max = 0;

  // Core context estimation
  if (profile.core.full) {
    min += 800;
    max += 1200;
  } else if (profile.core.minimal) {
    min += 100;
    max += 200;
  } else {
    min += 300;
    max += 500;
  }

  // Extended context estimation (per section)
  const sectionTokens = profile.extended.length * 300;
  min += sectionTokens * 0.5;
  max += sectionTokens;

  // Historical context
  if (profile.historical === true) {
    min += 2000;
    max += 5000;
  } else if (profile.historical === 'on-request') {
    // Only count max since it's optional
    max += 5000;
  }

  return { min: Math.round(min), max: Math.round(max) };
}
