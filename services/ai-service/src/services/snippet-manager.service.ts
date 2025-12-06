/**
 * Snippet Manager Service
 * Story 5.6: AI Learning and Personalization
 *
 * Manages personal snippets - frequently used phrases saved as shortcuts
 * Auto-detects repeated phrases and suggests them as snippets
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ClaudeModel, AIOperationType } from '@legal-platform/types';
import { createClaudeModel, AICallbackHandler } from '../lib/langchain/client';
import { tokenTracker } from './token-tracker.service';
import { cacheService } from './cache.service';
import logger from '../lib/logger';

// ============================================================================
// Types
// ============================================================================

export type SnippetCategory =
  | 'Greeting'
  | 'Closing'
  | 'LegalPhrase'
  | 'ClientResponse'
  | 'InternalNote'
  | 'Custom';

export interface SnippetSourceContext {
  documentType?: string;
  emailType?: string;
  caseType?: string;
  detectedAt: Date;
}

export interface PersonalSnippet {
  id: string;
  firmId: string;
  userId: string;
  shortcut: string;
  title: string;
  content: string;
  category: SnippetCategory;
  usageCount: number;
  lastUsedAt: Date | null;
  isAutoDetected: boolean;
  sourceContext: SnippetSourceContext | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SnippetSuggestion {
  content: string;
  suggestedTitle: string;
  suggestedShortcut: string;
  category: SnippetCategory;
  occurrenceCount: number;
  sourceContext: SnippetSourceContext;
  confidence: number;
}

export interface TextAnalysisInput {
  texts: string[];
  userId: string;
  firmId: string;
  contextType: 'email' | 'document' | 'note';
}

export interface SnippetMatchResult {
  snippet: PersonalSnippet;
  matchPosition: number;
  matchLength: number;
  confidence: number;
}

// ============================================================================
// Prompts
// ============================================================================

const SNIPPET_DETECTION_SYSTEM = `You are an expert at identifying reusable text patterns in legal documents and emails.
Analyze the provided texts to find:
1. Frequently repeated phrases (appears 2+ times)
2. Standard greetings and closings
3. Common legal phrases and clauses
4. Professional response templates

Return suggestions as a JSON array.`;

const SNIPPET_DETECTION_PROMPT = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(SNIPPET_DETECTION_SYSTEM),
  HumanMessagePromptTemplate.fromTemplate(`Analyze these {context_type} texts for reusable snippets:

{texts}

Find phrases that appear multiple times or are common professional patterns.
For each snippet, suggest:
- content: the exact phrase
- suggestedTitle: a descriptive title
- suggestedShortcut: a short command like /greeting or /close
- category: one of Greeting, Closing, LegalPhrase, ClientResponse, InternalNote, Custom
- occurrenceCount: how many times this pattern appeared
- confidence: 0.0-1.0 how confident this should be a snippet

Return as JSON array:`),
]);

const SHORTCUT_GENERATION_PROMPT = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(
    'Generate a concise, memorable shortcut command for a text snippet. Use lowercase, start with /, max 15 chars.'
  ),
  HumanMessagePromptTemplate.fromTemplate(`Content: "{content}"
Title: "{title}"
Category: {category}

Suggest shortcut:`),
]);

// ============================================================================
// Service Implementation
// ============================================================================

class SnippetManagerService {
  private autoDetectEnabled: boolean;
  private minReuseCount: number;
  private maxSnippetLength: number;

  constructor() {
    this.autoDetectEnabled =
      process.env.SNIPPET_AUTO_DETECT_ENABLED !== 'false';
    this.minReuseCount = parseInt(
      process.env.SNIPPET_MIN_REUSE_COUNT || '3',
      10
    );
    this.maxSnippetLength = parseInt(
      process.env.SNIPPET_MAX_LENGTH || '500',
      10
    );
  }

  /**
   * Detect potential snippets from a collection of texts
   */
  async detectSnippets(input: TextAnalysisInput): Promise<SnippetSuggestion[]> {
    const startTime = Date.now();
    const operationId = uuidv4();

    if (!this.autoDetectEnabled) {
      logger.debug('Snippet auto-detection is disabled');
      return [];
    }

    try {
      logger.debug('Detecting snippets from texts', {
        operationId,
        userId: input.userId,
        textCount: input.texts.length,
        contextType: input.contextType,
      });

      // Need at least 3 texts to detect patterns
      if (input.texts.length < 3) {
        return [];
      }

      // Combine texts for analysis
      const combinedTexts = input.texts
        .slice(0, 20) // Limit to 20 texts
        .map((t, i) => `--- Text ${i + 1} ---\n${t.substring(0, 1000)}`)
        .join('\n\n');

      const callbackHandler = new AICallbackHandler({
        userId: input.userId,
        firmId: input.firmId,
        operationType: AIOperationType.SNIPPET_DETECTION,
        operationId,
      });

      const model = createClaudeModel(ClaudeModel.HAIKU, {
        callbacks: [callbackHandler],
        maxTokens: 2048,
        temperature: 0.3,
      });

      const chain = SNIPPET_DETECTION_PROMPT.pipe(model).pipe(
        new StringOutputParser()
      );

      const response = await chain.invoke({
        context_type: input.contextType,
        texts: combinedTexts,
      });

      const suggestions = this.parseSnippetSuggestions(response, input);

      // Track token usage
      const tokenInfo = await callbackHandler.getTokenInfo();
      await tokenTracker.recordUsage({
        userId: input.userId,
        firmId: input.firmId,
        operationType: AIOperationType.SNIPPET_DETECTION,
        inputTokens: tokenInfo.inputTokens,
        outputTokens: tokenInfo.outputTokens,
        totalTokens: tokenInfo.totalTokens,
        model: ClaudeModel.HAIKU,
        cost: tokenInfo.cost,
        latencyMs: Date.now() - startTime,
        metadata: { operationId, suggestionsCount: suggestions.length },
      });

      logger.info('Snippet detection completed', {
        operationId,
        userId: input.userId,
        suggestionsCount: suggestions.length,
        durationMs: Date.now() - startTime,
      });

      return suggestions;
    } catch (error) {
      logger.error('Snippet detection failed', {
        operationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Generate a shortcut for a snippet
   */
  async generateShortcut(
    content: string,
    title: string,
    category: SnippetCategory,
    userId: string,
    firmId: string
  ): Promise<string> {
    try {
      const callbackHandler = new AICallbackHandler({
        userId,
        firmId,
        operationType: AIOperationType.SNIPPET_SHORTCUT,
        operationId: uuidv4(),
      });

      const model = createClaudeModel(ClaudeModel.HAIKU, {
        callbacks: [callbackHandler],
        maxTokens: 50,
        temperature: 0.5,
      });

      const chain = SHORTCUT_GENERATION_PROMPT.pipe(model).pipe(
        new StringOutputParser()
      );

      const response = await chain.invoke({
        content: content.substring(0, 200),
        title,
        category,
      });

      // Clean up shortcut
      let shortcut = response.trim().toLowerCase();
      if (!shortcut.startsWith('/')) {
        shortcut = '/' + shortcut;
      }
      shortcut = shortcut.replace(/[^a-z0-9/]/g, '').substring(0, 15);

      return shortcut || this.generateDefaultShortcut(category);
    } catch (error) {
      logger.warn('Failed to generate shortcut, using default', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.generateDefaultShortcut(category);
    }
  }

  /**
   * Find snippets that match text being typed
   */
  findMatchingSnippets(
    text: string,
    snippets: PersonalSnippet[]
  ): SnippetMatchResult[] {
    const results: SnippetMatchResult[] = [];
    const lowerText = text.toLowerCase();

    for (const snippet of snippets) {
      // Check if user is typing a shortcut
      if (
        snippet.shortcut &&
        lowerText.includes(snippet.shortcut.toLowerCase())
      ) {
        const position = lowerText.indexOf(snippet.shortcut.toLowerCase());
        results.push({
          snippet,
          matchPosition: position,
          matchLength: snippet.shortcut.length,
          confidence: 1.0,
        });
      }

      // Check for partial content match (fuzzy)
      const contentWords = snippet.content.toLowerCase().split(/\s+/);
      const textWords = lowerText.split(/\s+/);

      // If user is typing something similar to snippet start
      if (textWords.length >= 2) {
        const lastWords = textWords.slice(-3).join(' ');
        const snippetStart = contentWords.slice(0, 3).join(' ');

        if (this.fuzzyMatch(lastWords, snippetStart)) {
          results.push({
            snippet,
            matchPosition: text.length - lastWords.length,
            matchLength: lastWords.length,
            confidence: 0.7,
          });
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Expand a shortcut to its full content
   */
  expandShortcut(
    shortcut: string,
    snippets: PersonalSnippet[]
  ): PersonalSnippet | null {
    const normalizedShortcut = shortcut.toLowerCase().trim();

    return (
      snippets.find(
        (s) => s.shortcut.toLowerCase() === normalizedShortcut
      ) || null
    );
  }

  /**
   * Suggest category based on content
   */
  suggestCategory(content: string): SnippetCategory {
    const lowerContent = content.toLowerCase();

    // Check for greetings
    const greetingPatterns = [
      'dear',
      'hello',
      'hi',
      'stimate',
      'stimată',
      'bună',
      'salut',
    ];
    if (greetingPatterns.some((p) => lowerContent.startsWith(p))) {
      return 'Greeting';
    }

    // Check for closings
    const closingPatterns = [
      'sincerely',
      'regards',
      'best',
      'yours',
      'cu stimă',
      'cu respect',
      'mulțumesc',
    ];
    if (closingPatterns.some((p) => lowerContent.includes(p))) {
      return 'Closing';
    }

    // Check for legal phrases
    const legalPatterns = [
      'în conformitate',
      'potrivit',
      'articol',
      'alineat',
      'pursuant',
      'hereby',
      'whereas',
    ];
    if (legalPatterns.some((p) => lowerContent.includes(p))) {
      return 'LegalPhrase';
    }

    return 'Custom';
  }

  /**
   * Create a new snippet from suggestion
   */
  createSnippetFromSuggestion(
    suggestion: SnippetSuggestion,
    userId: string,
    firmId: string
  ): PersonalSnippet {
    return {
      id: uuidv4(),
      firmId,
      userId,
      shortcut: suggestion.suggestedShortcut,
      title: suggestion.suggestedTitle,
      content: suggestion.content,
      category: suggestion.category,
      usageCount: 0,
      lastUsedAt: null,
      isAutoDetected: true,
      sourceContext: suggestion.sourceContext,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private parseSnippetSuggestions(
    response: string,
    input: TextAnalysisInput
  ): SnippetSuggestion[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(
          (s) =>
            s.content &&
            s.content.length <= this.maxSnippetLength &&
            (s.occurrenceCount || 1) >= this.minReuseCount
        )
        .map((s) => ({
          content: s.content,
          suggestedTitle: s.suggestedTitle || 'Untitled Snippet',
          suggestedShortcut: s.suggestedShortcut || '/snippet',
          category: this.validateCategory(s.category),
          occurrenceCount: s.occurrenceCount || 1,
          sourceContext: {
            documentType: input.contextType === 'document' ? 'unknown' : undefined,
            emailType: input.contextType === 'email' ? 'unknown' : undefined,
            detectedAt: new Date(),
          },
          confidence: Math.min(1, Math.max(0, s.confidence || 0.5)),
        }));
    } catch (error) {
      logger.warn('Failed to parse snippet suggestions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private validateCategory(category: string): SnippetCategory {
    const validCategories: SnippetCategory[] = [
      'Greeting',
      'Closing',
      'LegalPhrase',
      'ClientResponse',
      'InternalNote',
      'Custom',
    ];
    return validCategories.includes(category as SnippetCategory)
      ? (category as SnippetCategory)
      : 'Custom';
  }

  private generateDefaultShortcut(category: SnippetCategory): string {
    const prefixes: Record<SnippetCategory, string> = {
      Greeting: '/greet',
      Closing: '/close',
      LegalPhrase: '/legal',
      ClientResponse: '/client',
      InternalNote: '/note',
      Custom: '/snip',
    };
    const suffix = Math.random().toString(36).substring(2, 4);
    return `${prefixes[category]}${suffix}`;
  }

  private fuzzyMatch(a: string, b: string): boolean {
    if (a.length === 0 || b.length === 0) return false;

    const minLength = Math.min(a.length, b.length);
    let matches = 0;

    for (let i = 0; i < minLength; i++) {
      if (a[i] === b[i]) matches++;
    }

    return matches / minLength > 0.6;
  }
}

export const snippetManagerService = new SnippetManagerService();
export default snippetManagerService;
