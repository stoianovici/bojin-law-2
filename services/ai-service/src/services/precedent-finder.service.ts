/**
 * Precedent Finder Service
 * Story 3.3: Intelligent Document Drafting
 *
 * Finds similar documents from firm library using semantic search
 */

import { prisma } from '@legal-platform/database';
import { Prisma } from '@prisma/client';
import {
  PrecedentDocument,
  SimilarDocumentSearchInput,
  DocumentType,
} from '@legal-platform/types';
import { embeddingGenerationService } from './embedding-generation.service';
import { semanticSearchService } from './semantic-search.service';
import logger from '../lib/logger';

// Map document types to training categories
const DOCUMENT_TYPE_CATEGORIES: Record<DocumentType, string[]> = {
  Contract: ['Contract', 'Agreement', 'Acord', 'Contract de Vanzare'],
  Motion: ['Motion', 'Cerere', 'Recurs'],
  Letter: ['Letter', 'Scrisoare', 'Notificare'],
  Memo: ['Memo', 'Memorandum', 'Nota'],
  Pleading: ['Pleading', 'Cerere de chemare', 'Actiune'],
  Other: [],
};

export class PrecedentFinderService {
  /**
   * Find similar documents from the firm library
   */
  async findSimilarDocuments(input: SimilarDocumentSearchInput): Promise<PrecedentDocument[]> {
    const startTime = Date.now();
    const limit = input.limit || 5;

    logger.info('Finding similar documents', {
      caseId: input.caseId,
      documentType: input.documentType,
      queryLength: input.query?.length || 0,
    });

    try {
      const results: PrecedentDocument[] = [];

      // Get relevant categories for the document type
      const categories = DOCUMENT_TYPE_CATEGORIES[input.documentType];

      // Search in document_embeddings table (from Story 3.2.6)
      if (input.query) {
        const semanticResults = await this.searchBySemanticSimilarity(
          input.query,
          categories,
          limit
        );
        results.push(...semanticResults);
      }

      // Search in training_documents table
      const trainingResults = await this.searchTrainingDocuments(
        categories,
        limit - results.length
      );
      results.push(...trainingResults);

      // Search in document_patterns table for relevant clauses
      const patternResults = await this.searchDocumentPatterns(
        input.documentType,
        Math.max(0, limit - results.length)
      );
      results.push(...patternResults);

      // Deduplicate and sort by similarity
      const uniqueResults = this.deduplicateResults(results);
      const sortedResults = uniqueResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      const duration = Date.now() - startTime;
      logger.info('Similar document search completed', {
        caseId: input.caseId,
        resultsFound: sortedResults.length,
        durationMs: duration,
      });

      return sortedResults;
    } catch (error) {
      logger.error('Similar document search failed', {
        caseId: input.caseId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Search by semantic similarity using pgvector embeddings
   */
  private async searchBySemanticSimilarity(
    query: string,
    categories: string[],
    limit: number
  ): Promise<PrecedentDocument[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await embeddingGenerationService.generateQueryEmbedding(query);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Build category filter
      const categoryFilter = categories.length > 0
        ? Prisma.sql`AND td.category IN (${Prisma.join(categories)})`
        : Prisma.empty;

      // Perform vector similarity search
      const results = await prisma.$queryRaw<
        Array<{
          document_id: string;
          chunk_text: string;
          similarity: number;
          category: string;
          original_filename: string;
        }>
      >(Prisma.sql`
        SELECT
          de.document_id,
          de.chunk_text,
          1 - (de.embedding <=> ${embeddingStr}::vector) as similarity,
          td.category,
          td.original_filename
        FROM document_embeddings de
        JOIN training_documents td ON td.id = de.document_id
        WHERE 1 - (de.embedding <=> ${embeddingStr}::vector) >= 0.6
        ${categoryFilter}
        ORDER BY de.embedding <=> ${embeddingStr}::vector
        LIMIT ${limit}
      `);

      return results.map((row) => ({
        documentId: row.document_id,
        title: row.original_filename,
        similarity: Number(row.similarity),
        relevantSections: [this.extractRelevantSection(row.chunk_text)],
        category: row.category,
      }));
    } catch (error) {
      logger.warn('Semantic search failed, falling back to text search', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Search training documents by category
   */
  private async searchTrainingDocuments(
    categories: string[],
    limit: number
  ): Promise<PrecedentDocument[]> {
    if (limit <= 0) return [];

    try {
      const whereClause = categories.length > 0
        ? { category: { in: categories } }
        : {};

      const documents = await prisma.trainingDocument.findMany({
        where: whereClause,
        orderBy: { processedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          category: true,
          originalFilename: true,
          textContent: true,
        },
      });

      return documents.map((doc) => ({
        documentId: doc.id,
        title: doc.originalFilename,
        similarity: 0.5, // Default similarity for category matches
        relevantSections: [this.extractRelevantSection(doc.textContent)],
        category: doc.category,
      }));
    } catch (error) {
      logger.warn('Training document search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Search document patterns for relevant clauses
   */
  private async searchDocumentPatterns(
    documentType: DocumentType,
    limit: number
  ): Promise<PrecedentDocument[]> {
    if (limit <= 0) return [];

    const categories = DOCUMENT_TYPE_CATEGORIES[documentType];
    if (categories.length === 0) return [];

    try {
      const patterns = await prisma.documentPattern.findMany({
        where: {
          category: { in: categories },
          patternType: 'clause',
        },
        orderBy: { frequency: 'desc' },
        take: limit,
        select: {
          id: true,
          category: true,
          patternText: true,
          frequency: true,
          confidenceScore: true,
        },
      });

      return patterns.map((pattern) => ({
        documentId: pattern.id,
        title: `${pattern.category} - Common Clause`,
        similarity: pattern.confidenceScore ? Number(pattern.confidenceScore) : 0.7,
        relevantSections: [pattern.patternText.substring(0, 200)],
        category: pattern.category,
      }));
    } catch (error) {
      logger.warn('Document pattern search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Extract a relevant section from text
   */
  private extractRelevantSection(text: string): string {
    // Get first meaningful paragraph
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 50);
    if (paragraphs.length > 0) {
      return paragraphs[0].substring(0, 200) + (paragraphs[0].length > 200 ? '...' : '');
    }
    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
  }

  /**
   * Deduplicate results by document ID
   */
  private deduplicateResults(results: PrecedentDocument[]): PrecedentDocument[] {
    const seen = new Map<string, PrecedentDocument>();

    for (const result of results) {
      const existing = seen.get(result.documentId);
      if (!existing || result.similarity > existing.similarity) {
        seen.set(result.documentId, result);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Get precedents by specific document IDs
   */
  async getPrecedentsByIds(documentIds: string[]): Promise<PrecedentDocument[]> {
    try {
      const documents = await prisma.trainingDocument.findMany({
        where: { id: { in: documentIds } },
        select: {
          id: true,
          category: true,
          originalFilename: true,
          textContent: true,
        },
      });

      return documents.map((doc) => ({
        documentId: doc.id,
        title: doc.originalFilename,
        similarity: 1.0, // Direct lookup, full match
        relevantSections: [this.extractRelevantSection(doc.textContent)],
        category: doc.category,
      }));
    } catch (error) {
      logger.error('Get precedents by IDs failed', {
        documentIds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
export const precedentFinderService = new PrecedentFinderService();
