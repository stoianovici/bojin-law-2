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
  maxToolRounds: 20,
  /** Temperature for research-enabled generation (slightly higher for creativity in research) */
  temperature: 0.5,
  /** Max tokens for research documents - 16k allows ~12-20 page documents without truncation */
  maxTokens: 16000,
};
