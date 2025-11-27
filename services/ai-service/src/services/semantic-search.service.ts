/**
 * Semantic Search Service
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Provides semantic search over trained document embeddings
 */

import { prisma } from '@legal-platform/database';
import { Prisma } from '@prisma/client';
import type {
  SemanticSearchInput,
  SemanticSearchOutput,
  EmbeddingSearchResult,
} from '@legal-platform/types';
import { embeddingGenerationService } from './embedding-generation.service';
import logger from '../lib/logger';

/**
 * Semantic Search Service Class
 * Searches document embeddings for relevant content
 */
export class SemanticSearchService {
  /**
   * Perform semantic search on training documents
   * @param input - Search input
   * @returns Search results
   */
  async search(input: SemanticSearchInput): Promise<SemanticSearchOutput> {
    const startTime = Date.now();
    const limit = input.limit || 5;
    const similarityThreshold = input.similarityThreshold || 0.7;

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingGenerationService.generateQueryEmbedding(
        input.query
      );

      // Convert embedding to pgvector format string
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Perform vector similarity search using pgvector with parameterized query
      let results: Array<{
        document_id: string;
        chunk_text: string;
        similarity: number;
        category: string;
        original_filename: string;
        metadata: any;
      }>;

      if (input.category) {
        // Query with category filter
        results = await prisma.$queryRaw<
          Array<{
            document_id: string;
            chunk_text: string;
            similarity: number;
            category: string;
            original_filename: string;
            metadata: any;
          }>
        >(Prisma.sql`
          SELECT
            de.document_id,
            de.chunk_text,
            1 - (de.embedding <=> ${embeddingStr}::vector) as similarity,
            td.category,
            td.original_filename,
            td.metadata
          FROM document_embeddings de
          JOIN training_documents td ON td.id = de.document_id
          WHERE 1 - (de.embedding <=> ${embeddingStr}::vector) >= ${similarityThreshold}
            AND td.category = ${input.category}
          ORDER BY de.embedding <=> ${embeddingStr}::vector
          LIMIT ${limit}
        `);
      } else {
        // Query without category filter
        results = await prisma.$queryRaw<
          Array<{
            document_id: string;
            chunk_text: string;
            similarity: number;
            category: string;
            original_filename: string;
            metadata: any;
          }>
        >(Prisma.sql`
          SELECT
            de.document_id,
            de.chunk_text,
            1 - (de.embedding <=> ${embeddingStr}::vector) as similarity,
            td.category,
            td.original_filename,
            td.metadata
          FROM document_embeddings de
          JOIN training_documents td ON td.id = de.document_id
          WHERE 1 - (de.embedding <=> ${embeddingStr}::vector) >= ${similarityThreshold}
          ORDER BY de.embedding <=> ${embeddingStr}::vector
          LIMIT ${limit}
        `);
      }

      const searchResults: EmbeddingSearchResult[] = results.map((row) => ({
        documentId: row.document_id,
        chunkText: row.chunk_text,
        similarity: Number(row.similarity),
        metadata: row.metadata,
      }));

      const duration = Date.now() - startTime;

      logger.info('Semantic search completed', {
        query: input.query,
        category: input.category,
        resultsFound: searchResults.length,
        durationMs: duration,
      });

      return {
        results: searchResults,
        totalResults: searchResults.length,
      };
    } catch (error) {
      logger.error('Semantic search failed', {
        query: input.query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get patterns for a category
   * @param category - Document category
   * @param limit - Maximum patterns to return
   * @returns Top patterns
   */
  async getCategoryPatterns(
    category: string,
    limit: number = 10
  ): Promise<any[]> {
    return prisma.documentPattern.findMany({
      where: { category },
      orderBy: { frequency: 'desc' },
      take: limit,
    });
  }

  /**
   * Get templates for a category
   * @param category - Document category
   * @param limit - Maximum templates to return
   * @returns Top templates
   */
  async getCategoryTemplates(
    category: string,
    limit: number = 5
  ): Promise<any[]> {
    return prisma.templateLibrary.findMany({
      where: { category },
      orderBy: [
        { qualityScore: 'desc' },
        { usageCount: 'desc' },
      ],
      take: limit,
    });
  }

  /**
   * Full-text search on training documents using PostgreSQL tsvector
   * @param query - Search query string
   * @param category - Optional category filter
   * @param limit - Maximum results to return
   * @returns Matching documents with relevance ranking
   */
  async fullTextSearch(
    query: string,
    category?: string,
    limit: number = 10
  ): Promise<Array<{
    id: string;
    category: string;
    originalFilename: string;
    textContent: string;
    rank: number;
    headline: string;
  }>> {
    const startTime = Date.now();

    try {
      // Sanitize query for tsquery
      const sanitizedQuery = query
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .join(' & ');

      let results: Array<{
        id: string;
        category: string;
        original_filename: string;
        text_content: string;
        rank: number;
        headline: string;
      }>;

      if (category) {
        results = await prisma.$queryRaw<
          Array<{
            id: string;
            category: string;
            original_filename: string;
            text_content: string;
            rank: number;
            headline: string;
          }>
        >(Prisma.sql`
          SELECT
            id,
            category,
            original_filename,
            text_content,
            ts_rank(text_search_vector, plainto_tsquery('simple', ${query})) as rank,
            ts_headline('simple', text_content, plainto_tsquery('simple', ${query}),
              'MaxWords=50, MinWords=25, StartSel=<b>, StopSel=</b>') as headline
          FROM training_documents
          WHERE text_search_vector @@ plainto_tsquery('simple', ${query})
            AND category = ${category}
          ORDER BY rank DESC
          LIMIT ${limit}
        `);
      } else {
        results = await prisma.$queryRaw<
          Array<{
            id: string;
            category: string;
            original_filename: string;
            text_content: string;
            rank: number;
            headline: string;
          }>
        >(Prisma.sql`
          SELECT
            id,
            category,
            original_filename,
            text_content,
            ts_rank(text_search_vector, plainto_tsquery('simple', ${query})) as rank,
            ts_headline('simple', text_content, plainto_tsquery('simple', ${query}),
              'MaxWords=50, MinWords=25, StartSel=<b>, StopSel=</b>') as headline
          FROM training_documents
          WHERE text_search_vector @@ plainto_tsquery('simple', ${query})
          ORDER BY rank DESC
          LIMIT ${limit}
        `);
      }

      const duration = Date.now() - startTime;

      logger.info('Full-text search completed', {
        query,
        category,
        resultsFound: results.length,
        durationMs: duration,
      });

      return results.map((row) => ({
        id: row.id,
        category: row.category,
        originalFilename: row.original_filename,
        textContent: row.text_content,
        rank: Number(row.rank),
        headline: row.headline,
      }));
    } catch (error) {
      logger.error('Full-text search failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Hybrid search combining semantic and full-text search
   * @param query - Search query
   * @param category - Optional category filter
   * @param limit - Maximum results to return
   * @param semanticWeight - Weight for semantic results (0-1)
   * @returns Combined search results
   */
  async hybridSearch(
    query: string,
    category?: string,
    limit: number = 10,
    semanticWeight: number = 0.7
  ): Promise<Array<{
    documentId: string;
    category: string;
    filename: string;
    chunkText: string;
    combinedScore: number;
    semanticScore: number;
    textScore: number;
  }>> {
    const startTime = Date.now();

    try {
      // Run both searches in parallel
      const [semanticResults, textResults] = await Promise.all([
        this.search({ query, category, limit: limit * 2 }),
        this.fullTextSearch(query, category, limit * 2),
      ]);

      // Create a map to combine scores
      const combinedMap = new Map<string, {
        documentId: string;
        category: string;
        filename: string;
        chunkText: string;
        semanticScore: number;
        textScore: number;
      }>();

      // Add semantic results
      for (const result of semanticResults.results) {
        combinedMap.set(result.documentId, {
          documentId: result.documentId,
          category: (result.metadata as any)?.category || '',
          filename: (result.metadata as any)?.original_filename || '',
          chunkText: result.chunkText,
          semanticScore: result.similarity,
          textScore: 0,
        });
      }

      // Add/merge text results
      for (const result of textResults) {
        const existing = combinedMap.get(result.id);
        if (existing) {
          existing.textScore = result.rank;
        } else {
          combinedMap.set(result.id, {
            documentId: result.id,
            category: result.category,
            filename: result.originalFilename,
            chunkText: result.headline,
            semanticScore: 0,
            textScore: result.rank,
          });
        }
      }

      // Calculate combined scores and sort
      const textWeight = 1 - semanticWeight;
      const results = Array.from(combinedMap.values())
        .map((item) => ({
          ...item,
          combinedScore:
            item.semanticScore * semanticWeight +
            item.textScore * textWeight,
        }))
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit);

      const duration = Date.now() - startTime;

      logger.info('Hybrid search completed', {
        query,
        category,
        resultsFound: results.length,
        durationMs: duration,
      });

      return results;
    } catch (error) {
      logger.error('Hybrid search failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const semanticSearchService = new SemanticSearchService();
