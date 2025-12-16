/**
 * Clause Suggestion Service
 * Story 3.3: Intelligent Document Drafting
 *
 * Provides real-time clause suggestions as users type
 * Uses Haiku model for fast inline completions (< 200ms target)
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@legal-platform/database';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  ClauseSuggestion,
  ClauseSuggestionRequest,
  ClauseSource,
  DocumentType,
  ClaudeModel,
  AIOperationType,
} from '@legal-platform/types';
import { createClaudeModel, AICallbackHandler } from '../lib/langchain/client';
import { tokenTracker } from './token-tracker.service';
import logger from '../lib/logger';
import { config } from '../config';
import Redis from 'ioredis';

// Debounce delay in milliseconds
const DEBOUNCE_MS = parseInt(process.env.AI_SUGGESTION_DEBOUNCE_MS || '300', 10);

// Cache TTL for suggestions in seconds
const SUGGESTION_CACHE_TTL = 300;

// Redis client for caching
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url);
  }
  return redisClient;
}

// System prompt for clause suggestions
const CLAUSE_SUGGESTION_SYSTEM = `You are an expert legal document assistant specializing in Romanian law.
Your role is to suggest completions for legal clauses and text as the user types.

Guidelines:
- Provide concise, contextually appropriate completions
- Use proper Romanian legal terminology
- Suggest common legal phrases and clauses
- Keep suggestions brief (1-2 sentences max)
- Ensure suggestions are grammatically correct
- Match the style and formality of the surrounding text`;

const CLAUSE_SUGGESTION_HUMAN = `Complete the following legal text. The user has typed:

"{currentText}"

Document Type: {documentType}
Category: {category}

Provide a natural continuation of this text (1-2 sentences max).
Return ONLY the completion text, nothing else.`;

// Pending suggestions map for debouncing
const pendingSuggestions = new Map<string, NodeJS.Timeout>();

export class ClauseSuggestionService {
  /**
   * Get clause suggestions for the current text
   */
  async getSuggestions(request: ClauseSuggestionRequest): Promise<ClauseSuggestion[]> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.debug('Clause suggestion requested', {
      requestId,
      documentId: request.documentId,
      cursorPosition: request.cursorPosition,
      textLength: request.currentText.length,
    });

    try {
      const suggestions: ClauseSuggestion[] = [];

      // 1. Check for firm-specific patterns first (fastest)
      const patternSuggestions = await this.findFirmPatterns(
        request.currentText,
        request.documentType
      );
      suggestions.push(...patternSuggestions);

      // 2. Check suggestion cache
      const cacheKey = this.buildCacheKey(request);
      const cachedSuggestion = await this.getCachedSuggestion(cacheKey);
      if (cachedSuggestion) {
        suggestions.push(cachedSuggestion);
      }

      // 3. If we don't have enough suggestions, generate with AI
      if (suggestions.length < 3 && request.currentText.trim().length > 10) {
        const aiSuggestion = await this.generateAISuggestion(request);
        if (aiSuggestion) {
          suggestions.push(aiSuggestion);
          // Cache the AI suggestion
          await this.cacheSuggestion(cacheKey, aiSuggestion);
        }
      }

      // Sort by confidence and deduplicate
      const uniqueSuggestions = this.deduplicateSuggestions(suggestions)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      const duration = Date.now() - startTime;
      logger.debug('Clause suggestions generated', {
        requestId,
        suggestionsCount: uniqueSuggestions.length,
        durationMs: duration,
      });

      return uniqueSuggestions;
    } catch (error) {
      logger.error('Clause suggestion failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get debounced suggestions (for real-time typing)
   */
  async getDebouncedSuggestions(request: ClauseSuggestionRequest): Promise<ClauseSuggestion[]> {
    const debounceKey = `${request.documentId}-${request.userId}`;

    // Cancel any pending suggestion for this user/document
    const pending = pendingSuggestions.get(debounceKey);
    if (pending) {
      clearTimeout(pending);
    }

    // Return a promise that resolves after debounce delay
    return new Promise((resolve) => {
      const timeout = setTimeout(async () => {
        pendingSuggestions.delete(debounceKey);
        const suggestions = await this.getSuggestions(request);
        resolve(suggestions);
      }, DEBOUNCE_MS);

      pendingSuggestions.set(debounceKey, timeout);
    });
  }

  /**
   * Find matching firm-specific patterns
   */
  private async findFirmPatterns(
    currentText: string,
    documentType: DocumentType
  ): Promise<ClauseSuggestion[]> {
    try {
      // Get the last 50 characters to match patterns
      const textEnd = currentText.slice(-50).trim().toLowerCase();

      // Map document type to categories
      const categoryMap: Record<DocumentType, string[]> = {
        Contract: ['Contract', 'Agreement'],
        Motion: ['Motion', 'Cerere'],
        Letter: ['Letter', 'Scrisoare'],
        Memo: ['Memo', 'Memorandum'],
        Pleading: ['Pleading', 'Cerere de chemare'],
        Other: [],
      };

      const categories = categoryMap[documentType];

      // Query patterns that could complete the current text
      const patterns = await prisma.documentPattern.findMany({
        where: {
          category: categories.length > 0 ? { in: categories } : undefined,
          patternType: { in: ['clause', 'phrase'] },
        },
        orderBy: { frequency: 'desc' },
        take: 5,
        select: {
          id: true,
          patternText: true,
          category: true,
          frequency: true,
          confidenceScore: true,
        },
      });

      return patterns
        .filter((pattern) => {
          // Check if pattern could be a continuation
          const patternStart = pattern.patternText.slice(0, 30).toLowerCase();
          return textEnd.length < 10 || patternStart.includes(textEnd.slice(-10));
        })
        .map((pattern) => ({
          id: pattern.id,
          text: pattern.patternText,
          source: ClauseSource.FirmPattern,
          confidence: pattern.confidenceScore ? Number(pattern.confidenceScore) : 0.8,
          category: pattern.category,
        }));
    } catch (error) {
      logger.warn('Pattern search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Generate AI suggestion using Haiku model
   */
  private async generateAISuggestion(
    request: ClauseSuggestionRequest
  ): Promise<ClauseSuggestion | null> {
    const startTime = Date.now();

    try {
      // Create prompt template
      const systemPrompt = SystemMessagePromptTemplate.fromTemplate(CLAUSE_SUGGESTION_SYSTEM);
      const humanPrompt = HumanMessagePromptTemplate.fromTemplate(CLAUSE_SUGGESTION_HUMAN);
      const chatPrompt = ChatPromptTemplate.fromMessages([systemPrompt, humanPrompt]);

      // Create callback handler for metrics
      const callbackHandler = new AICallbackHandler();

      // Use Haiku model for fast completions
      const model = createClaudeModel(ClaudeModel.Haiku, {
        maxTokens: parseInt(process.env.AI_CLAUSE_SUGGESTION_MAX_TOKENS || '256', 10),
        temperature: 0.3, // Lower temperature for more consistent completions
        callbacks: [callbackHandler],
      });

      // Create the chain
      const chain = chatPrompt.pipe(model).pipe(new StringOutputParser());

      // Get the context around cursor
      const textAroundCursor = request.currentText.slice(
        Math.max(0, request.cursorPosition - 200),
        request.cursorPosition
      );

      // Generate suggestion
      const suggestion = await chain.invoke({
        currentText: textAroundCursor,
        documentType: request.documentType,
        category: this.getDocumentCategory(request.documentType),
      });

      const metrics = callbackHandler.getMetrics();
      const latencyMs = Date.now() - startTime;

      // Track token usage
      await tokenTracker.recordUsage({
        userId: request.userId,
        firmId: request.firmId,
        operationType: AIOperationType.TextGeneration,
        modelUsed: config.claude.models.haiku,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        latencyMs,
        cached: false,
      });

      // Log if we exceeded target latency
      if (latencyMs > 200) {
        logger.warn('Clause suggestion exceeded target latency', {
          latencyMs,
          targetMs: 200,
        });
      }

      return {
        id: uuidv4(),
        text: suggestion.trim(),
        source: ClauseSource.AIGenerated,
        confidence: 0.7,
        category: this.getDocumentCategory(request.documentType),
      };
    } catch (error) {
      logger.warn('AI suggestion generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Build cache key for suggestion
   */
  private buildCacheKey(request: ClauseSuggestionRequest): string {
    // Use last 50 chars of text for cache key
    const textKey = request.currentText.slice(-50).replace(/\s+/g, ' ').trim();
    return `clause:${request.firmId}:${request.documentType}:${textKey}`;
  }

  /**
   * Get cached suggestion
   */
  private async getCachedSuggestion(key: string): Promise<ClauseSuggestion | null> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as ClauseSuggestion;
      }
      return null;
    } catch (error) {
      logger.warn('Cache read failed', { error });
      return null;
    }
  }

  /**
   * Cache a suggestion
   */
  private async cacheSuggestion(key: string, suggestion: ClauseSuggestion): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(key, SUGGESTION_CACHE_TTL, JSON.stringify(suggestion));
    } catch (error) {
      logger.warn('Cache write failed', { error });
    }
  }

  /**
   * Deduplicate suggestions by text similarity
   */
  private deduplicateSuggestions(suggestions: ClauseSuggestion[]): ClauseSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter((suggestion) => {
      const normalizedText = suggestion.text.toLowerCase().trim();
      if (seen.has(normalizedText)) {
        return false;
      }
      seen.add(normalizedText);
      return true;
    });
  }

  /**
   * Get document category string
   */
  private getDocumentCategory(documentType: DocumentType): string {
    const categoryMap: Record<DocumentType, string> = {
      Contract: 'Contract',
      Motion: 'Motion',
      Letter: 'Letter',
      Memo: 'Memo',
      Pleading: 'Pleading',
      Other: 'General',
    };
    return categoryMap[documentType];
  }

  /**
   * Cancel pending suggestion for a user/document
   */
  cancelPending(documentId: string, userId: string): void {
    const debounceKey = `${documentId}-${userId}`;
    const pending = pendingSuggestions.get(debounceKey);
    if (pending) {
      clearTimeout(pending);
      pendingSuggestions.delete(debounceKey);
    }
  }
}

// Singleton instance
export const clauseSuggestionService = new ClauseSuggestionService();
