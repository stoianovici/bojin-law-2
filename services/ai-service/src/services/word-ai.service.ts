/**
 * Word AI Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Service layer for AI-powered assistance in Word add-in.
 * Provides completions, explanations, and improvements for legal text.
 */

import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import {
  WordAISuggestion,
  WordSuggestionRequest,
  WordSuggestionResponse,
  WordExplainRequest,
  WordExplainResponse,
  WordImproveRequest,
  WordImproveResponse,
  SuggestionType,
  ImprovementType,
} from '@legal-platform/types';
import { providerManager } from './provider-manager.service';
import { contextAggregatorService } from './context-aggregator.service';
import { semanticSearchService } from './semantic-search.service';
import logger from '../lib/logger';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

// Cache TTL for suggestions (2 minutes)
const SUGGESTION_CACHE_TTL = 120;

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

/**
 * Prompts for different suggestion types
 */
const SUGGESTION_PROMPTS = {
  completion: `You are a legal document assistant. Based on the context and cursor position, suggest 2-3 completions for the text the user is writing.

Context about the case:
{caseContext}

Document context:
{documentContext}

Current text being edited:
{selectedText}

Surrounding context (before cursor):
{cursorContext}

Provide completions that:
1. Continue the legal argument or clause naturally
2. Match Romanian legal writing style and conventions
3. Are relevant to the case type and context

Return suggestions as JSON array:
[
  {"content": "completion text", "confidence": 0.9, "reasoning": "brief explanation"}
]`,

  alternative: `You are a legal document assistant. Suggest 2-3 alternative ways to phrase the selected text while maintaining the same legal meaning.

Context about the case:
{caseContext}

Selected text:
{selectedText}

Provide alternatives that:
1. Maintain legal precision and meaning
2. May improve clarity, formality, or conciseness
3. Follow Romanian legal writing conventions

Return suggestions as JSON array:
[
  {"content": "alternative text", "confidence": 0.8, "reasoning": "why this alternative is better"}
]`,

  precedent: `You are a legal document assistant. Based on the selected text and case context, find relevant precedent language from similar documents.

Context about the case:
{caseContext}

Selected text (current clause/section):
{selectedText}

{precedentContext}

Suggest precedent-based improvements or additions that:
1. Have been used successfully in similar cases/documents
2. Add relevant legal language or citations
3. Strengthen the legal argument

Return suggestions as JSON array:
[
  {"content": "precedent-based text", "confidence": 0.85, "source": "document/template reference", "reasoning": "why this precedent applies"}
]`,
};

const EXPLANATION_PROMPT = `You are a legal assistant explaining legal text in clear, accessible language.

Selected text to explain:
{selectedText}

Provide:
1. A clear explanation of what this text means in plain language
2. The legal basis or reasoning behind it (if applicable)
3. Any relevant Romanian legal code references

Format your response as JSON:
{
  "explanation": "plain language explanation",
  "legalBasis": "relevant legal principles or code references",
  "sourceReferences": ["Art. X Cod Civil", "etc"]
}`;

const IMPROVEMENT_PROMPTS: Record<ImprovementType, string> = {
  clarity: `Rewrite the following legal text to improve clarity while maintaining legal precision.

Original text:
{selectedText}

Provide a clearer version that:
1. Uses simpler sentence structure where possible
2. Removes unnecessary complexity
3. Maintains all legal meaning and precision

Return as JSON:
{
  "improved": "improved text",
  "explanation": "what was changed and why"
}`,

  formality: `Rewrite the following text to improve its formality for professional legal documents.

Original text:
{selectedText}

Provide a more formal version that:
1. Uses proper legal terminology
2. Follows Romanian legal document conventions
3. Maintains professional tone throughout

Return as JSON:
{
  "improved": "improved text",
  "explanation": "what was changed and why"
}`,

  brevity: `Rewrite the following legal text to be more concise while maintaining legal precision.

Original text:
{selectedText}

Provide a shorter version that:
1. Removes redundant words and phrases
2. Combines sentences where appropriate
3. Maintains all essential legal content

Return as JSON:
{
  "improved": "improved text",
  "explanation": "what was removed/changed"
}`,

  legal_precision: `Improve the legal precision of the following text.

Original text:
{selectedText}

Provide a more legally precise version that:
1. Uses correct legal terminology
2. Removes ambiguous language
3. Adds necessary qualifications or definitions

Return as JSON:
{
  "improved": "improved text",
  "explanation": "what was improved for legal precision"
}`,
};

export class WordAIService {
  /**
   * Get AI suggestions for Word add-in
   */
  async getSuggestions(request: WordSuggestionRequest): Promise<WordSuggestionResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.info('Word AI suggestion request', {
      requestId,
      documentId: request.documentId,
      suggestionType: request.suggestionType,
      textLength: request.selectedText.length,
    });

    try {
      // Try cache first for completion requests
      if (request.suggestionType === 'completion') {
        const cached = await this.getCachedSuggestions(request);
        if (cached) {
          logger.debug('Returning cached suggestions', { requestId });
          return cached;
        }
      }

      // Get document and case context
      const document = await prisma.document.findUnique({
        where: { id: request.documentId },
        include: {
          caseLinks: {
            include: { case: true },
            take: 1,
          },
        },
      });

      if (!document) {
        throw new Error(`Document not found: ${request.documentId}`);
      }

      const caseInfo = document.caseLinks[0]?.case;
      let caseContext = 'No case context available';

      if (caseInfo) {
        caseContext = await contextAggregatorService.getContextSummary(
          caseInfo.id,
          document.firmId
        );
      }

      // Get precedent context for precedent-type suggestions
      let precedentContext = '';
      if (request.suggestionType === 'precedent' && caseInfo) {
        precedentContext = await this.getPrecedentContext(
          request.selectedText,
          document.firmId
        );
      }

      // Build prompt
      const prompt = this.buildSuggestionPrompt(
        request.suggestionType,
        caseContext,
        request.selectedText,
        request.cursorContext,
        precedentContext
      );

      // Get AI completion
      const aiResponse = await providerManager.execute({
        prompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      // Parse response
      const suggestions = this.parseSuggestionResponse(
        aiResponse.content,
        request.suggestionType
      );

      const response: WordSuggestionResponse = {
        suggestions,
        processingTimeMs: Date.now() - startTime,
      };

      // Cache completion suggestions
      if (request.suggestionType === 'completion') {
        await this.cacheSuggestions(request, response);
      }

      logger.info('Word AI suggestions generated', {
        requestId,
        suggestionCount: suggestions.length,
        processingTimeMs: response.processingTimeMs,
      });

      return response;
    } catch (error) {
      logger.error('Word AI suggestion failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Explain selected legal text
   */
  async explainText(request: WordExplainRequest): Promise<WordExplainResponse> {
    const startTime = Date.now();

    logger.info('Word AI explain request', {
      documentId: request.documentId,
      textLength: request.selectedText.length,
    });

    try {
      const prompt = EXPLANATION_PROMPT.replace('{selectedText}', request.selectedText);

      const aiResponse = await providerManager.execute({
        prompt,
        maxTokens: 500,
        temperature: 0.3,
      });

      const parsed = this.parseJsonResponse(aiResponse.content);

      return {
        explanation: parsed.explanation || 'Unable to generate explanation',
        legalBasis: parsed.legalBasis,
        sourceReferences: parsed.sourceReferences,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Word AI explain failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Improve selected text
   */
  async improveText(request: WordImproveRequest): Promise<WordImproveResponse> {
    const startTime = Date.now();

    logger.info('Word AI improve request', {
      documentId: request.documentId,
      improvementType: request.improvementType,
      textLength: request.selectedText.length,
    });

    try {
      const promptTemplate = IMPROVEMENT_PROMPTS[request.improvementType];
      const prompt = promptTemplate.replace('{selectedText}', request.selectedText);

      const aiResponse = await providerManager.execute({
        prompt,
        maxTokens: 1000,
        temperature: 0.5,
      });

      const parsed = this.parseJsonResponse(aiResponse.content);

      return {
        original: request.selectedText,
        improved: parsed.improved || request.selectedText,
        explanation: parsed.explanation || 'No changes suggested',
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Word AI improve failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build suggestion prompt from template
   */
  private buildSuggestionPrompt(
    type: SuggestionType,
    caseContext: string,
    selectedText: string,
    cursorContext: string,
    precedentContext: string
  ): string {
    const template = SUGGESTION_PROMPTS[type];

    return template
      .replace('{caseContext}', caseContext)
      .replace('{documentContext}', '')
      .replace('{selectedText}', selectedText)
      .replace('{cursorContext}', cursorContext)
      .replace('{precedentContext}', precedentContext);
  }

  /**
   * Parse AI response into suggestions array
   */
  private parseSuggestionResponse(
    response: string,
    type: SuggestionType
  ): WordAISuggestion[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('No JSON array found in AI response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return parsed.map((item: any) => ({
        id: uuidv4(),
        type,
        content: item.content || '',
        confidence: item.confidence || 0.5,
        source: item.source,
        reasoning: item.reasoning,
      }));
    } catch (error) {
      logger.warn('Failed to parse suggestion response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Parse JSON from AI response
   */
  private parseJsonResponse(response: string): Record<string, any> {
    try {
      // Extract JSON object from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {};
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.warn('Failed to parse JSON response', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  /**
   * Get precedent context using semantic search
   */
  private async getPrecedentContext(
    text: string,
    _firmId: string
  ): Promise<string> {
    try {
      const searchResults = await semanticSearchService.search({
        query: text,
        limit: 3,
        similarityThreshold: 0.7,
      });

      if (searchResults.results.length === 0) {
        return 'No relevant precedents found.';
      }

      const precedents = searchResults.results.map((r, i) =>
        `${i + 1}. Document ${r.documentId} (relevance: ${Math.round(r.similarity * 100)}%)\n   "${r.chunkText.substring(0, 200)}..."`
      ).join('\n\n');

      return `Relevant precedents found:\n${precedents}`;
    } catch (error) {
      logger.warn('Failed to get precedent context', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 'Precedent search unavailable.';
    }
  }

  /**
   * Get cached suggestions
   */
  private async getCachedSuggestions(
    request: WordSuggestionRequest
  ): Promise<WordSuggestionResponse | null> {
    try {
      const redis = getRedisClient();
      const cacheKey = this.buildCacheKey(request);
      const cached = await redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.warn('Cache read failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache suggestions
   */
  private async cacheSuggestions(
    request: WordSuggestionRequest,
    response: WordSuggestionResponse
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const cacheKey = this.buildCacheKey(request);
      await redis.setex(cacheKey, SUGGESTION_CACHE_TTL, JSON.stringify(response));
    } catch (error) {
      logger.warn('Cache write failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Build cache key for suggestion request
   */
  private buildCacheKey(request: WordSuggestionRequest): string {
    // Create a hash of the request for cache key
    const hash = Buffer.from(
      `${request.documentId}:${request.suggestionType}:${request.selectedText.substring(0, 100)}`
    ).toString('base64');
    return `word-ai:suggestions:${hash}`;
  }
}

// Singleton instance
export const wordAIService = new WordAIService();
