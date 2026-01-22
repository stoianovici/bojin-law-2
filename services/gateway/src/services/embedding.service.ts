/**
 * Voyage AI Embedding Service
 * Story 2.10: Basic AI Search Implementation - Tasks 4-7
 *
 * Generates vector embeddings using Voyage AI for semantic search capabilities.
 * Supports embedding generation for Cases and Documents with Redis caching.
 *
 * Features:
 * - Voyage AI integration with voyage-large-2 model (1536 dimensions)
 * - Text chunking for long documents (max 8000 tokens)
 * - Redis caching for embeddings (24h TTL)
 * - Batch processing queue for async embedding generation
 * - Rate limiting with retry logic (300 requests/min)
 *
 * References:
 * - Voyage AI API: https://docs.voyageai.com/reference/embeddings-api
 * - pgvector: https://github.com/pgvector/pgvector
 */

import { redis, cacheManager, prisma } from '@legal-platform/database';
import { createHash } from 'crypto';
import { retryWithBackoff } from '../utils/retry.util';

// ============================================================================
// Configuration
// ============================================================================

// Voyage AI Configuration
const VOYAGE_API_URL = process.env.VOYAGE_API_URL || 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-large-2';
const VOYAGE_MAX_TOKENS = 8000; // Max tokens per request
const VOYAGE_RATE_LIMIT = 300; // requests per minute

// Embedding Configuration
const EMBEDDING_DIMENSIONS = 1536; // Voyage voyage-large-2 dimensions
const EMBEDDING_CACHE_TTL = parseInt(process.env.EMBEDDING_CACHE_TTL || '86400', 10); // 24 hours
const EMBEDDING_CACHE_PREFIX = 'embedding';

// Queue Configuration
const EMBEDDING_QUEUE_KEY = 'embedding:queue';
const EMBEDDING_ERROR_QUEUE_KEY = 'embedding:error';
const EMBEDDING_BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '50', 10);
const EMBEDDING_BATCH_INTERVAL = parseInt(process.env.EMBEDDING_BATCH_INTERVAL || '5000', 10); // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    totalTokens: number;
  };
}

export interface EmbeddingQueueItem {
  type: 'case' | 'document';
  id: string;
  firmId: string;
  retryCount?: number;
  createdAt?: string;
}

interface VoyageAPIResponse {
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
// Embedding Service Class
// ============================================================================

export class EmbeddingService {
  private isProcessingQueue: boolean = false;
  private queueInterval: NodeJS.Timeout | null = null;

  /**
   * Generate embedding for text using Voyage AI
   *
   * @param text - Text to embed
   * @returns Array of embedding values (1536 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(text);
    const cached = await cacheManager.get<number[]>(`${EMBEDDING_CACHE_PREFIX}:${cacheKey}`);
    if (cached) {
      console.log(`[Embedding Service] Cache hit for text hash: ${cacheKey.substring(0, 8)}...`);
      return cached;
    }

    // Chunk long text if necessary
    const chunks = this.chunkText(text, VOYAGE_MAX_TOKENS);

    // Generate embeddings for each chunk
    const embeddings = await Promise.all(chunks.map((chunk) => this.callVoyageAPI(chunk)));

    // Average embeddings if multiple chunks
    const averaged = this.averageEmbeddings(embeddings);

    // Cache result
    await cacheManager.set(`${EMBEDDING_CACHE_PREFIX}:${cacheKey}`, averaged, EMBEDDING_CACHE_TTL);
    console.log(
      `[Embedding Service] Cached embedding for text hash: ${cacheKey.substring(0, 8)}...`
    );

    return averaged;
  }

  /**
   * Call Voyage AI API to generate embedding
   *
   * @param text - Text to embed
   * @returns Embedding vector
   */
  private async callVoyageAPI(text: string): Promise<number[]> {
    if (!VOYAGE_API_KEY) {
      throw new Error('VOYAGE_API_KEY environment variable is not set');
    }

    return retryWithBackoff(
      async () => {
        const response = await fetch(VOYAGE_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${VOYAGE_API_KEY}`,
          },
          body: JSON.stringify({
            model: VOYAGE_MODEL,
            input: text,
          }),
        });

        if (!response.ok) {
          const error: any = new Error(
            `Voyage AI API error: ${response.status} ${response.statusText}`
          );
          error.statusCode = response.status;

          // Parse error body if available
          try {
            const errorBody = (await response.json()) as { detail?: string };
            error.message = errorBody.detail || error.message;
          } catch {
            // Ignore JSON parse errors
          }

          throw error;
        }

        const data = (await response.json()) as VoyageAPIResponse;

        if (!data.data || data.data.length === 0) {
          throw new Error('Voyage AI API returned no embeddings');
        }

        console.log(
          `[Embedding Service] Generated embedding using ${data.model}, tokens: ${data.usage.total_tokens}`
        );

        return data.data[0].embedding;
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        shouldRetry: (error: any) => {
          // Retry on rate limit (429) and server errors (5xx)
          const status = error.statusCode || error.status || 0;
          return status === 429 || status >= 500;
        },
      },
      'voyage-ai-embedding'
    );
  }

  /**
   * Chunk text into smaller pieces for embedding
   * Simple word-based chunking (approximately 4 characters per token)
   *
   * @param text - Text to chunk
   * @param maxTokens - Maximum tokens per chunk
   * @returns Array of text chunks
   */
  private chunkText(text: string, maxTokens: number): string[] {
    // Rough estimate: 1 token ≈ 4 characters for English
    const maxChars = maxTokens * 4;

    if (text.length <= maxChars) {
      return [text];
    }

    const chunks: string[] = [];
    const words = text.split(/\s+/);
    let currentChunk = '';

    for (const word of words) {
      if ((currentChunk + ' ' + word).length > maxChars) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    console.log(`[Embedding Service] Split text into ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Average multiple embedding vectors
   *
   * @param embeddings - Array of embedding vectors
   * @returns Averaged embedding vector
   */
  private averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 1) {
      return embeddings[0];
    }

    const dimensions = embeddings[0].length;
    const averaged = new Array(dimensions).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        averaged[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      averaged[i] /= embeddings.length;
    }

    return averaged;
  }

  /**
   * Generate cache key from text hash
   *
   * @param text - Text to hash
   * @returns SHA-256 hash of text
   */
  private getCacheKey(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  // ============================================================================
  // Queue Processing (Task 5)
  // ============================================================================

  /**
   * Queue an entity for embedding generation
   *
   * @param item - Queue item with entity type and ID
   */
  async queueForEmbedding(item: EmbeddingQueueItem): Promise<void> {
    const queueItem: EmbeddingQueueItem = {
      ...item,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };

    await redis.lpush(EMBEDDING_QUEUE_KEY, JSON.stringify(queueItem));
    console.log(`[Embedding Service] Queued ${item.type}:${item.id} for embedding`);
  }

  /**
   * Start background queue processing
   */
  startQueueProcessor(): void {
    if (this.queueInterval) {
      return;
    }

    console.log(
      `[Embedding Service] Starting queue processor (interval: ${EMBEDDING_BATCH_INTERVAL}ms)`
    );

    this.queueInterval = setInterval(async () => {
      await this.processQueue();
    }, EMBEDDING_BATCH_INTERVAL);

    // Process immediately on start
    this.processQueue();
  }

  /**
   * Stop background queue processing
   */
  stopQueueProcessor(): void {
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
      console.log('[Embedding Service] Stopped queue processor');
    }
  }

  /**
   * Process queued embedding requests in batches
   */
  async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Get batch of items from queue
      const items: EmbeddingQueueItem[] = [];

      for (let i = 0; i < EMBEDDING_BATCH_SIZE; i++) {
        const itemJson = await redis.rpop(EMBEDDING_QUEUE_KEY);
        if (!itemJson) break;

        try {
          items.push(JSON.parse(itemJson));
        } catch {
          console.error('[Embedding Service] Invalid queue item JSON:', itemJson);
        }
      }

      if (items.length === 0) {
        return;
      }

      console.log(`[Embedding Service] Processing batch of ${items.length} items`);

      // Process each item
      for (const item of items) {
        try {
          if (item.type === 'case') {
            await this.generateCaseEmbedding(item.id, item.firmId);
          } else if (item.type === 'document') {
            await this.generateDocumentEmbedding(item.id, item.firmId);
          }
        } catch (error) {
          console.error(`[Embedding Service] Failed to process ${item.type}:${item.id}:`, error);

          // Retry logic
          const retryCount = (item.retryCount || 0) + 1;

          if (retryCount < MAX_RETRY_ATTEMPTS) {
            // Re-queue with incremented retry count
            await redis.lpush(EMBEDDING_QUEUE_KEY, JSON.stringify({ ...item, retryCount }));
            console.log(
              `[Embedding Service] Re-queued ${item.type}:${item.id} (attempt ${retryCount})`
            );
          } else {
            // Move to error queue after max retries
            await redis.lpush(
              EMBEDDING_ERROR_QUEUE_KEY,
              JSON.stringify({
                ...item,
                error: error instanceof Error ? error.message : 'Unknown error',
                failedAt: new Date().toISOString(),
              })
            );
            console.error(
              `[Embedding Service] Moved ${item.type}:${item.id} to error queue after ${retryCount} attempts`
            );
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // ============================================================================
  // Case Embedding Generation (Task 6)
  // ============================================================================

  /**
   * Generate and store embedding for a Case
   *
   * @param caseId - Case UUID
   * @param firmId - Firm UUID (for verification)
   */
  async generateCaseEmbedding(caseId: string, firmId: string): Promise<void> {
    // Fetch case with client info
    const caseData = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId: firmId,
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!caseData) {
      throw new Error(`Case not found: ${caseId}`);
    }

    // Build searchable text
    const searchableText = this.buildCaseSearchText(caseData);

    // Generate embedding
    const embedding = await this.generateEmbedding(searchableText);

    // Update case with embedding and search text
    // Use raw query for vector field (Prisma doesn't support pgvector natively)
    await prisma.$executeRaw`
      UPDATE cases
      SET
        content_embedding = ${embedding}::vector,
        search_text = ${searchableText},
        updated_at = NOW()
      WHERE id = ${caseId}::uuid
    `;

    console.log(`[Embedding Service] Updated case ${caseId} with embedding`);
  }

  /**
   * Build searchable text from Case data
   *
   * @param caseData - Case with relations
   * @returns Concatenated searchable text
   */
  private buildCaseSearchText(caseData: {
    caseNumber: string;
    title: string;
    description: string;
    client?: { name: string } | null;
    metadata?: any;
  }): string {
    const parts = [
      caseData.caseNumber,
      caseData.title,
      caseData.description,
      caseData.client?.name || '',
    ];

    // Add metadata tags if present
    if (caseData.metadata && typeof caseData.metadata === 'object') {
      const meta = caseData.metadata as Record<string, any>;
      if (meta.tags && Array.isArray(meta.tags)) {
        parts.push(meta.tags.join(' '));
      }
      if (meta.notes) {
        parts.push(String(meta.notes));
      }
    }

    return parts.filter(Boolean).join(' ').trim();
  }

  // ============================================================================
  // Document Embedding Generation (Task 7)
  // ============================================================================

  /**
   * Generate and store embedding for a Document
   * Only processes FINAL documents to avoid indexing drafts.
   *
   * @param documentId - Document UUID
   * @param firmId - Firm UUID (for verification)
   */
  async generateDocumentEmbedding(documentId: string, firmId: string): Promise<void> {
    // Fetch document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        firmId: firmId,
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Only index FINAL documents - skip drafts and documents pending review
    if (document.status !== 'FINAL') {
      console.log(
        `[Embedding Service] Skipping document ${documentId} - status is ${document.status}, not FINAL`
      );
      return;
    }

    // Build searchable text from metadata
    const searchableText = this.buildDocumentSearchText(document);

    // Generate embedding
    const embedding = await this.generateEmbedding(searchableText);

    // Update document with embedding
    await prisma.$executeRaw`
      UPDATE documents
      SET
        metadata_embedding = ${embedding}::vector,
        updated_at = NOW()
      WHERE id = ${documentId}::uuid
    `;

    console.log(`[Embedding Service] Updated document ${documentId} with embedding`);
  }

  /**
   * Build searchable text from Document data
   *
   * @param document - Document model
   * @returns Concatenated searchable text
   */
  private buildDocumentSearchText(document: { fileName: string; metadata?: any }): string {
    const parts = [document.fileName];

    // Add metadata fields
    if (document.metadata && typeof document.metadata === 'object') {
      const meta = document.metadata as Record<string, any>;

      if (meta.description) {
        parts.push(String(meta.description));
      }

      if (meta.tags && Array.isArray(meta.tags)) {
        parts.push(meta.tags.join(' '));
      }

      if (meta.notes) {
        parts.push(String(meta.notes));
      }

      if (meta.keywords && Array.isArray(meta.keywords)) {
        parts.push(meta.keywords.join(' '));
      }
    }

    return parts.filter(Boolean).join(' ').trim();
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Queue all cases in a firm for embedding generation
   *
   * @param firmId - Firm UUID
   */
  async queueAllCasesForFirm(firmId: string): Promise<number> {
    // Use raw query since Prisma doesn't support querying Unsupported types
    const cases = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM cases
      WHERE firm_id = ${firmId}::uuid
      AND content_embedding IS NULL
    `;

    for (const c of cases) {
      await this.queueForEmbedding({
        type: 'case',
        id: c.id,
        firmId: firmId,
      });
    }

    console.log(`[Embedding Service] Queued ${cases.length} cases for firm ${firmId}`);
    return cases.length;
  }

  /**
   * Queue all documents in a firm for embedding generation
   *
   * @param firmId - Firm UUID
   */
  async queueAllDocumentsForFirm(firmId: string): Promise<number> {
    // Use raw query since Prisma doesn't support querying Unsupported types
    const documents = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM documents
      WHERE firm_id = ${firmId}::uuid
      AND metadata_embedding IS NULL
    `;

    for (const doc of documents) {
      await this.queueForEmbedding({
        type: 'document',
        id: doc.id,
        firmId: firmId,
      });
    }

    console.log(`[Embedding Service] Queued ${documents.length} documents for firm ${firmId}`);
    return documents.length;
  }

  // ============================================================================
  // Queue Stats
  // ============================================================================

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    errors: number;
  }> {
    const [pending, errors] = await Promise.all([
      redis.llen(EMBEDDING_QUEUE_KEY),
      redis.llen(EMBEDDING_ERROR_QUEUE_KEY),
    ]);

    return { pending, errors };
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
