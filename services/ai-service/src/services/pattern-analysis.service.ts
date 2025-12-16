/**
 * Pattern Analysis Service
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Identifies repeated patterns, common phrases, and clauses across documents
 */

import { prisma } from '@legal-platform/database';
import { NGrams } from 'natural';
import type {
  IdentifyPatternsInput,
  IdentifyPatternsOutput,
  TrainingDocumentPattern,
  PatternType,
} from '@legal-platform/types';
import logger from '../lib/logger';

/**
 * Pattern Analysis Service Class
 * Analyzes documents to identify common patterns and clauses
 */
export class PatternAnalysisService {
  /**
   * Identify patterns in documents of a specific category
   * @param input - Pattern identification input
   * @returns Identified patterns
   */
  async identifyPatterns(input: IdentifyPatternsInput): Promise<IdentifyPatternsOutput> {
    const startTime = Date.now();
    const minFrequency = input.minFrequency || 3;
    const minDocuments = input.minDocuments || 3;

    try {
      // Get all documents in category
      const documents = await prisma.trainingDocument.findMany({
        where: { category: input.category },
        select: {
          id: true,
          textContent: true,
        },
      });

      if (documents.length < minDocuments) {
        logger.warn('Not enough documents for pattern analysis', {
          category: input.category,
          documentCount: documents.length,
          minDocuments,
        });
        return {
          patterns: [],
          totalPatternsFound: 0,
        };
      }

      // Extract phrases (n-grams)
      const phrasePatterns = await this.identifyPhrasePatterns(
        documents,
        minFrequency,
        minDocuments
      );

      // Extract structural patterns
      const structurePatterns = await this.identifyStructurePatterns(documents, input.category);

      const allPatterns = [...phrasePatterns, ...structurePatterns];

      // Store patterns in database
      for (const pattern of allPatterns) {
        await this.storePattern(pattern);
      }

      const duration = Date.now() - startTime;

      logger.info('Pattern analysis completed', {
        category: input.category,
        documentsAnalyzed: documents.length,
        patternsFound: allPatterns.length,
        durationMs: duration,
      });

      return {
        patterns: allPatterns as unknown as TrainingDocumentPattern[],
        totalPatternsFound: allPatterns.length,
      };
    } catch (error) {
      logger.error('Pattern analysis failed', {
        category: input.category,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Identify phrase patterns using n-grams
   * @param documents - Documents to analyze
   * @param minFrequency - Minimum frequency threshold
   * @param minDocuments - Minimum document threshold
   * @returns Phrase patterns
   */
  private async identifyPhrasePatterns(
    documents: Array<{ id: string; textContent: string }>,
    minFrequency: number,
    minDocuments: number
  ): Promise<Omit<TrainingDocumentPattern, 'id' | 'createdAt' | 'updatedAt'>[]> {
    const ngramSizes = [3, 4, 5]; // 3-5 word phrases
    const phraseFrequency = new Map<string, { count: number; documentIds: Set<string> }>();

    // Extract n-grams from all documents
    for (const doc of documents) {
      const words = this.tokenize(doc.textContent);

      for (const n of ngramSizes) {
        const ngrams = NGrams.ngrams(words, n);

        for (const ngram of ngrams) {
          const phrase = ngram.join(' ').toLowerCase();

          // Skip short phrases
          if (phrase.length < 15) continue;

          if (!phraseFrequency.has(phrase)) {
            phraseFrequency.set(phrase, {
              count: 0,
              documentIds: new Set(),
            });
          }

          const entry = phraseFrequency.get(phrase)!;
          entry.count++;
          entry.documentIds.add(doc.id);
        }
      }
    }

    // Filter patterns by frequency and document count
    const patterns: Omit<TrainingDocumentPattern, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (const [phrase, data] of phraseFrequency.entries()) {
      if (data.count >= minFrequency && data.documentIds.size >= minDocuments) {
        patterns.push({
          category: documents[0] ? await this.getCategory(documents[0].id) : '',
          patternType: 'phrase' as PatternType,
          patternText: phrase,
          frequency: data.count,
          documentIds: Array.from(data.documentIds),
          confidenceScore: this.calculateConfidence(data.documentIds.size, documents.length),
          metadata: {
            wordCount: phrase.split(' ').length,
          },
        });
      }
    }

    // Sort by frequency descending
    patterns.sort((a, b) => b.frequency - a.frequency);

    return patterns.slice(0, 50); // Limit to top 50 patterns
  }

  /**
   * Identify structural patterns (headings, sections)
   * @param documents - Documents to analyze
   * @param category - Document category
   * @returns Structure patterns
   */
  private async identifyStructurePatterns(
    documents: Array<{ id: string; textContent: string }>,
    category: string
  ): Promise<Omit<TrainingDocumentPattern, 'id' | 'createdAt' | 'updatedAt'>[]> {
    const headingPattern = /^([A-Z][A-Za-z\s]+)[:.]?\s*$/gm;
    const headingFrequency = new Map<string, { count: number; documentIds: Set<string> }>();

    for (const doc of documents) {
      const lines = doc.textContent.split('\n');
      const headings = new Set<string>();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 5 && trimmed.length < 100) {
          const match = trimmed.match(headingPattern);
          if (match) {
            headings.add(trimmed.toLowerCase());
          }
        }
      }

      for (const heading of headings) {
        if (!headingFrequency.has(heading)) {
          headingFrequency.set(heading, {
            count: 0,
            documentIds: new Set(),
          });
        }

        const entry = headingFrequency.get(heading)!;
        entry.count++;
        entry.documentIds.add(doc.id);
      }
    }

    const patterns: Omit<TrainingDocumentPattern, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (const [heading, data] of headingFrequency.entries()) {
      if (data.documentIds.size >= 3) {
        patterns.push({
          category,
          patternType: 'structure' as PatternType,
          patternText: heading,
          frequency: data.count,
          documentIds: Array.from(data.documentIds),
          confidenceScore: this.calculateConfidence(data.documentIds.size, documents.length),
          metadata: {
            type: 'heading',
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Store pattern in database
   * @param pattern - Pattern to store
   */
  private async storePattern(
    pattern: Omit<TrainingDocumentPattern, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    try {
      await prisma.documentPattern.create({
        data: {
          category: pattern.category,
          patternType: pattern.patternType,
          patternText: pattern.patternText,
          frequency: pattern.frequency,
          documentIds: pattern.documentIds,
          confidenceScore: pattern.confidenceScore || 0,
          metadata: pattern.metadata || {},
        },
      });
    } catch (error) {
      // Ignore duplicate pattern errors
      if (error instanceof Error && !error.message.includes('Unique constraint')) {
        logger.error('Failed to store pattern', {
          patternText: pattern.patternText.substring(0, 50),
          error: error.message,
        });
      }
    }
  }

  /**
   * Tokenize text into words
   * @param text - Text to tokenize
   * @returns Array of words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  /**
   * Calculate confidence score based on document coverage
   * @param documentsWithPattern - Number of documents containing pattern
   * @param totalDocuments - Total documents analyzed
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(documentsWithPattern: number, totalDocuments: number): number {
    return Math.min(documentsWithPattern / totalDocuments, 1.0);
  }

  /**
   * Get category for document
   * @param documentId - Document ID
   * @returns Category name
   */
  private async getCategory(documentId: string): Promise<string> {
    const doc = await prisma.trainingDocument.findUnique({
      where: { id: documentId },
      select: { category: true },
    });
    return doc?.category || '';
  }
}

export const patternAnalysisService = new PatternAnalysisService();
