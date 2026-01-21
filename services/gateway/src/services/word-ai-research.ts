/**
 * Word AI Research Module
 * Web search functionality for AI-powered document drafting
 *
 * Extracted from word-ai.service.ts for better maintainability.
 */

import { AIToolDefinition, ToolHandler } from './ai-client.service';
import { webSearchService } from './web-search.service';
import logger from '../utils/logger';

// ============================================================================
// Research Scope Calculation
// ============================================================================

/**
 * Source types available for research documents.
 */
export type SourceType = 'legislation' | 'jurisprudence' | 'doctrine' | 'comparative';

/**
 * Depth options for research documents.
 */
export type ResearchDepth = 'quick' | 'standard' | 'deep';

/**
 * Research scope derived from UI signals (source types × depth).
 * Maps to document size and complexity.
 */
export interface ResearchScope {
  /** Number of main sections in the document */
  sections: number;
  /** Target words per section */
  wordsPerSection: number;
  /** Total target word count */
  totalWords: number;
  /** Estimated page count (assuming ~500 words/page) */
  estimatedPages: number;
}

/**
 * Scope matrix defining document size based on source count and depth.
 *
 * Design rationale:
 * - Source count affects breadth (more sources = more sections for cross-analysis)
 * - Depth affects thoroughness (deep = more words per section)
 * - Each source type should generate substantial content when selected
 *
 * | Sources | Quick (superficial) | Deep (aprofundată)  |
 * |---------|---------------------|---------------------|---------------------|
 * | 1       | 2 sections, 400w    | 2 sections, 600w    | 3 sections, 800w    |
 * | 2       | 3 sections, 500w    | 4 sections, 750w    | 5 sections, 1000w   |
 * | 3       | 4 sections, 600w    | 5 sections, 850w    | 7 sections, 1100w   |
 * | 4       | 6 sections, 700w    | 8 sections, 950w    | 10 sections, 1200w  |
 */
export const SCOPE_MATRIX: Record<
  number,
  Record<ResearchDepth, { sections: number; wordsPerSection: number }>
> = {
  1: {
    quick: { sections: 2, wordsPerSection: 400 }, // ~2 pages
    standard: { sections: 2, wordsPerSection: 600 }, // ~3 pages
    deep: { sections: 3, wordsPerSection: 800 }, // ~5 pages
  },
  2: {
    quick: { sections: 3, wordsPerSection: 500 }, // ~3 pages
    standard: { sections: 4, wordsPerSection: 750 }, // ~6 pages
    deep: { sections: 5, wordsPerSection: 1000 }, // ~10 pages
  },
  3: {
    quick: { sections: 4, wordsPerSection: 600 }, // ~5 pages
    standard: { sections: 5, wordsPerSection: 850 }, // ~8 pages
    deep: { sections: 7, wordsPerSection: 1100 }, // ~15 pages
  },
  4: {
    quick: { sections: 6, wordsPerSection: 700 }, // ~8 pages
    standard: { sections: 8, wordsPerSection: 950 }, // ~15 pages
    deep: { sections: 10, wordsPerSection: 1200 }, // ~24 pages
  },
};

/**
 * Calculate research scope from UI signals.
 *
 * @param sourceCount - Number of source types selected (1-4)
 * @param depth - Research depth: 'quick', 'standard', or 'deep'
 * @returns ResearchScope with sections, words per section, and totals
 *
 * @example
 * // All 4 sources + deep depth = ~24 pages
 * calculateResearchScope(4, 'deep')
 * // => { sections: 10, wordsPerSection: 1200, totalWords: 12000, estimatedPages: 24 }
 */
export function calculateResearchScope(sourceCount: number, depth: ResearchDepth): ResearchScope {
  // Clamp source count to valid range (1-4)
  const clampedCount = Math.max(1, Math.min(4, sourceCount));

  const config = SCOPE_MATRIX[clampedCount][depth];
  const totalWords = config.sections * config.wordsPerSection;
  const estimatedPages = Math.round(totalWords / 500);

  logger.debug('Research scope calculated', {
    sourceCount: clampedCount,
    depth,
    sections: config.sections,
    wordsPerSection: config.wordsPerSection,
    totalWords,
    estimatedPages,
  });

  return {
    sections: config.sections,
    wordsPerSection: config.wordsPerSection,
    totalWords,
    estimatedPages,
  };
}

// ============================================================================
// Research Intent Detection
// ============================================================================

/**
 * Keywords that indicate the user wants to research/search for information.
 * Used for automatic detection when enableWebSearch is not explicitly set.
 */
const RESEARCH_KEYWORDS = [
  'caută',
  'cautare',
  'cercetează',
  'cerceteaza',
  'cercetare',
  'găsește',
  'gaseste',
  'informații despre',
  'informatii despre',
  'bune practici',
  'legislație',
  'legislatie',
  'jurisprudență',
  'jurisprudenta',
  'articol',
  'cod civil',
  'cod penal',
  'cod procedură',
  'cod procedura',
  'lege nr',
  'ordonanță',
  'ordonanta',
  'hotărâre',
  'hotarare',
  'decizie',
];

/**
 * Detect if the prompt indicates research intent based on keywords.
 * Used as fallback when enableWebSearch is not explicitly set.
 *
 * @param prompt - The user's prompt text
 * @returns true if research keywords are detected
 */
export function detectResearchIntent(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return RESEARCH_KEYWORDS.some((keyword) => lowerPrompt.includes(keyword));
}

// ============================================================================
// Web Search Tool Definition
// ============================================================================

/**
 * Tool definition for web search capability in AI document drafting.
 * Allows AI to search the internet for legal information, legislation,
 * jurisprudence, and best practices.
 */
export const WEB_SEARCH_TOOL: AIToolDefinition = {
  name: 'web_search',
  description:
    'Caută pe internet pentru informații actuale, legislație, jurisprudență, sau bune practici. Folosește când ai nevoie de informații actualizate sau surse externe pentru documentare.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Interogarea de căutare - fii specific și include termeni juridici relevanți.',
      },
      legal_only: {
        type: 'boolean',
        description:
          'Restricționează rezultatele la surse juridice autorizate (legislatie.just.ro, scj.ro, eur-lex.europa.eu, etc.). Default: true pentru documente juridice.',
      },
    },
    required: ['query'],
  },
};

// ============================================================================
// Web Search Handler Factory
// ============================================================================

/**
 * Creates a web search tool handler for use with AI chat tools.
 * The handler performs web searches and formats results for AI consumption.
 *
 * @returns ToolHandler function that can be used with aiClient.chatWithTools
 */
export function createWebSearchHandler(): ToolHandler {
  return async (input: Record<string, unknown>): Promise<string> => {
    const query = input.query as string;
    const legalOnly = (input.legal_only as boolean) ?? true; // Default to legal sources

    logger.debug('Web search tool called', { query, legalOnly });

    if (!webSearchService.isConfigured()) {
      return 'Căutarea web nu este configurată. Variabila BRAVE_SEARCH_API_KEY nu este setată.';
    }

    const results = await webSearchService.search(query, {
      legalOnly,
      maxResults: 10, // Get rich results per query
    });

    return webSearchService.formatResultsForAI(results);
  };
}

// ============================================================================
// Research Configuration
// ============================================================================

/**
 * Default configuration for research-enabled drafting
 */
export const RESEARCH_CONFIG = {
  /** Maximum number of tool rounds for research (allows extensive research for complex topics) */
  maxToolRounds: 25,
  /** Temperature for research-enabled generation (slightly higher for creativity in research) */
  temperature: 0.5,
  /** Max tokens for research documents - 24k allows ~24+ page documents without truncation */
  maxTokens: 24000,
};
