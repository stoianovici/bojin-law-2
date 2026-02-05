/**
 * Embedding Batch Service
 * Generates vector embeddings for documents using Voyage AI.
 *
 * Only embeds FirmDrafted + canonical documents.
 * Uses voyage-large-2 model (1536 dimensions).
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

export interface EmbedStats {
  total: number;
  embedded: number;
  skipped: number;
  errors: number;
}

interface VoyageResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-large-2';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 10; // Reduced to stay under 120K token limit per batch
const RATE_LIMIT_DELAY_MS = 500; // ~120 requests/min
const MAX_TEXT_LENGTH = 8000; // ~2K tokens per doc, 10 docs = 20K tokens (well under 120K limit)

// ============================================================================
// Service
// ============================================================================

export class EmbeddingBatchService {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error('VOYAGE_API_KEY environment variable is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Generate embeddings for all eligible documents in a session.
   * Eligible = FirmDrafted + isCanonical + has extractedText
   */
  async embedSession(sessionId: string): Promise<EmbedStats> {
    // Get documents to embed
    const documents = await this.getDocsForEmbedding(sessionId);

    if (documents.length === 0) {
      return { total: 0, embedded: 0, skipped: 0, errors: 0 };
    }

    console.log(`[Embedding] Processing ${documents.length} documents for session ${sessionId}`);

    const stats: EmbedStats = {
      total: documents.length,
      embedded: 0,
      skipped: 0,
      errors: 0,
    };

    // Process in batches
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);

      try {
        await this.processBatch(batch);
        stats.embedded += batch.length;
      } catch (error) {
        console.error(`[Embedding] Batch error at index ${i}:`, error);
        stats.errors += batch.length;
      }

      // Rate limiting
      if (i + BATCH_SIZE < documents.length) {
        await this.sleep(RATE_LIMIT_DELAY_MS);
      }

      // Progress logging
      if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= documents.length) {
        console.log(
          `[Embedding] Progress: ${Math.min(i + BATCH_SIZE, documents.length)}/${documents.length}`
        );
      }
    }

    console.log(`[Embedding] Complete: ${stats.embedded} embedded, ${stats.errors} errors`);

    return stats;
  }

  /**
   * Get documents eligible for embedding.
   */
  private async getDocsForEmbedding(
    sessionId: string
  ): Promise<Array<{ id: string; extractedText: string }>> {
    // Use raw query to check for null embedding (Prisma doesn't support Unsupported type queries)
    const docs = await prisma.$queryRaw<Array<{ id: string; extracted_text: string }>>`
      SELECT id, extracted_text
      FROM extracted_documents
      WHERE session_id = ${sessionId}
        AND triage_status = 'FirmDrafted'
        AND is_canonical = true
        AND extracted_text IS NOT NULL
        AND content_embedding IS NULL
      ORDER BY created_at
    `;

    return docs.map((d) => ({
      id: d.id,
      extractedText: d.extracted_text,
    }));
  }

  /**
   * Process a batch of documents.
   */
  private async processBatch(
    documents: Array<{ id: string; extractedText: string }>
  ): Promise<void> {
    // Prepare texts (truncate if needed)
    const texts = documents.map((doc) =>
      doc.extractedText.length > MAX_TEXT_LENGTH
        ? doc.extractedText.substring(0, MAX_TEXT_LENGTH)
        : doc.extractedText
    );

    // Call Voyage API
    const embeddings = await this.callVoyageAPI(texts);

    // Store embeddings
    for (let i = 0; i < documents.length; i++) {
      await this.storeEmbedding(documents[i].id, embeddings[i]);
    }
  }

  /**
   * Call Voyage AI API to generate embeddings.
   */
  private async callVoyageAPI(texts: string[]): Promise<number[][]> {
    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voyage API error ${response.status}: ${errorText}`);
    }

    const data: VoyageResponse = await response.json();

    // Sort by index to ensure correct order
    const sorted = [...data.data].sort((a, b) => a.index - b.index);

    // Validate dimensions
    for (const item of sorted) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding dimensions: ${item.embedding.length}, expected ${EMBEDDING_DIMENSIONS}`
        );
      }
    }

    return sorted.map((item) => item.embedding);
  }

  /**
   * Store embedding in database using raw SQL (for pgvector support).
   */
  private async storeEmbedding(documentId: string, embedding: number[]): Promise<void> {
    // Format embedding as PostgreSQL vector literal
    const vectorLiteral = `[${embedding.join(',')}]`;

    await prisma.$executeRaw`
      UPDATE extracted_documents
      SET content_embedding = ${vectorLiteral}::vector
      WHERE id = ${documentId}
    `;
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const embeddingBatchService = new EmbeddingBatchService();
