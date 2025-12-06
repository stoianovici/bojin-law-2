/**
 * Semantic Cache Service
 * Story 3.1: AI Service Infrastructure
 *
 * Implements response caching with semantic similarity lookup using pgvector
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { AIOperationType, AICacheEntry } from '@legal-platform/types';
import { config } from '../config';

// Initialize Prisma client (will be injected in production)
let prisma: PrismaClient;

export function initializeCachePrisma(client: PrismaClient) {
  prisma = client;
}

export interface CacheStoreInput {
  prompt: string;
  response: string;
  embedding?: number[];
  modelUsed: string;
  operationType: AIOperationType;
  firmId: string;
}

export interface CacheLookupResult {
  found: boolean;
  entry?: AICacheEntry;
  similarity?: number;
}

export interface CacheMetrics {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  avgHitsPerEntry: number;
}

export class CacheService {
  private readonly similarityThreshold: number;
  private readonly ttlHours: number;

  // In-memory metrics for fast access
  private hits = 0;
  private misses = 0;

  constructor() {
    this.similarityThreshold = config.cache.similarityThreshold;
    this.ttlHours = config.cache.ttlHours;
  }

  /**
   * Generate SHA-256 hash of prompt for exact match lookup
   */
  private hashPrompt(prompt: string): string {
    return crypto.createHash('sha256').update(prompt).digest('hex');
  }

  /**
   * Look up cache entry by exact hash match
   */
  async lookupByHash(prompt: string, firmId: string): Promise<CacheLookupResult> {
    const hash = this.hashPrompt(prompt);

    const entry = await prisma.aIResponseCache.findFirst({
      where: {
        promptHash: hash,
        firmId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (entry) {
      // Increment hit count
      await prisma.aIResponseCache.update({
        where: { id: entry.id },
        data: { hitCount: { increment: 1 } },
      });

      this.hits++;

      return {
        found: true,
        entry: {
          id: entry.id,
          promptHash: entry.promptHash,
          prompt: entry.prompt,
          response: entry.response,
          modelUsed: entry.modelUsed,
          operationType: entry.operationType as AIOperationType,
          firmId: entry.firmId,
          hitCount: entry.hitCount + 1,
          createdAt: entry.createdAt,
          expiresAt: entry.expiresAt,
        },
        similarity: 1.0,
      };
    }

    this.misses++;
    return { found: false };
  }

  /**
   * Look up cache entry by semantic similarity using pgvector
   */
  async lookupBySimilarity(
    embedding: number[],
    firmId: string,
    operationType?: AIOperationType
  ): Promise<CacheLookupResult> {
    // Build the vector query
    const embeddingString = `[${embedding.join(',')}]`;

    // Query for similar prompts using cosine distance
    const results = await prisma.$queryRaw<Array<{
      id: string;
      prompt_hash: string;
      prompt: string;
      response: string;
      model_used: string;
      operation_type: string;
      firm_id: string;
      hit_count: number;
      created_at: Date;
      expires_at: Date;
      similarity: number;
    }>>`
      SELECT
        id,
        prompt_hash,
        prompt,
        response,
        model_used,
        operation_type,
        firm_id,
        hit_count,
        created_at,
        expires_at,
        1 - (prompt_embedding <=> ${embeddingString}::vector) as similarity
      FROM ai_response_cache
      WHERE firm_id = ${firmId}
        AND expires_at > NOW()
        AND prompt_embedding IS NOT NULL
        ${operationType ? prisma.$queryRaw`AND operation_type = ${operationType}` : prisma.$queryRaw``}
      ORDER BY prompt_embedding <=> ${embeddingString}::vector
      LIMIT 1
    `;

    if (results.length > 0 && results[0].similarity >= this.similarityThreshold) {
      const result = results[0];

      // Increment hit count
      await prisma.aIResponseCache.update({
        where: { id: result.id },
        data: { hitCount: { increment: 1 } },
      });

      this.hits++;

      return {
        found: true,
        entry: {
          id: result.id,
          promptHash: result.prompt_hash,
          prompt: result.prompt,
          response: result.response,
          modelUsed: result.model_used,
          operationType: result.operation_type as AIOperationType,
          firmId: result.firm_id,
          hitCount: result.hit_count + 1,
          createdAt: result.created_at,
          expiresAt: result.expires_at,
        },
        similarity: result.similarity,
      };
    }

    this.misses++;
    return { found: false };
  }

  /**
   * Store a response in the cache
   */
  async store(input: CacheStoreInput): Promise<AICacheEntry> {
    const hash = this.hashPrompt(input.prompt);
    const expiresAt = new Date(Date.now() + this.ttlHours * 60 * 60 * 1000);

    // Check if entry already exists
    const existing = await prisma.aIResponseCache.findUnique({
      where: { promptHash: hash },
    });

    if (existing) {
      // Update existing entry
      const updated = await prisma.aIResponseCache.update({
        where: { id: existing.id },
        data: {
          response: input.response,
          modelUsed: input.modelUsed,
          expiresAt,
        },
      });

      return {
        id: updated.id,
        promptHash: updated.promptHash,
        prompt: updated.prompt,
        response: updated.response,
        modelUsed: updated.modelUsed,
        operationType: updated.operationType as AIOperationType,
        firmId: updated.firmId,
        hitCount: updated.hitCount,
        createdAt: updated.createdAt,
        expiresAt: updated.expiresAt,
      };
    }

    // Create new entry
    if (input.embedding) {
      // Use raw SQL to insert with vector embedding
      const embeddingString = `[${input.embedding.join(',')}]`;
      const id = crypto.randomUUID();

      await prisma.$executeRaw`
        INSERT INTO ai_response_cache (
          id, prompt_hash, prompt_embedding, prompt, response,
          model_used, operation_type, firm_id, hit_count, created_at, expires_at
        ) VALUES (
          ${id}, ${hash}, ${embeddingString}::vector, ${input.prompt}, ${input.response},
          ${input.modelUsed}, ${input.operationType}, ${input.firmId}, 0, NOW(), ${expiresAt}
        )
      `;

      return {
        id,
        promptHash: hash,
        promptEmbedding: input.embedding,
        prompt: input.prompt,
        response: input.response,
        modelUsed: input.modelUsed,
        operationType: input.operationType,
        firmId: input.firmId,
        hitCount: 0,
        createdAt: new Date(),
        expiresAt,
      };
    } else {
      // Create without embedding
      const created = await prisma.aIResponseCache.create({
        data: {
          promptHash: hash,
          prompt: input.prompt,
          response: input.response,
          modelUsed: input.modelUsed,
          operationType: input.operationType,
          firmId: input.firmId,
          expiresAt,
        },
      });

      return {
        id: created.id,
        promptHash: created.promptHash,
        prompt: created.prompt,
        response: created.response,
        modelUsed: created.modelUsed,
        operationType: created.operationType as AIOperationType,
        firmId: created.firmId,
        hitCount: created.hitCount,
        createdAt: created.createdAt,
        expiresAt: created.expiresAt,
      };
    }
  }

  /**
   * Invalidate cache entries by firm
   */
  async invalidateByFirm(firmId: string): Promise<number> {
    const result = await prisma.aIResponseCache.deleteMany({
      where: { firmId },
    });
    return result.count;
  }

  /**
   * Invalidate cache entries by operation type
   */
  async invalidateByOperationType(firmId: string, operationType: AIOperationType): Promise<number> {
    const result = await prisma.aIResponseCache.deleteMany({
      where: { firmId, operationType },
    });
    return result.count;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.aIResponseCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  /**
   * Get cache metrics
   */
  async getMetrics(firmId?: string): Promise<CacheMetrics> {
    const where = firmId ? { firmId } : {};

    const entries = await prisma.aIResponseCache.aggregate({
      where,
      _count: true,
      _sum: {
        hitCount: true,
      },
    });

    const totalEntries = entries._count || 0;
    const totalHits = entries._sum.hitCount || 0;

    return {
      totalEntries,
      hitCount: this.hits,
      missCount: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      avgHitsPerEntry: totalEntries > 0 ? totalHits / totalEntries : 0,
    };
  }

  /**
   * Reset in-memory metrics
   */
  resetMetrics(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Simple get method for compatibility with other services
   * Returns the cache entry if found, null otherwise
   */
  async get(key: string, firmId: string): Promise<AICacheEntry | null> {
    const result = await this.lookupByHash(key, firmId);
    return result.found ? result.entry || null : null;
  }

  /**
   * Simple set method for compatibility with other services
   * Stores a response in the cache
   */
  async set(
    key: string,
    prompt: string,
    response: string,
    modelUsed: string,
    operationType: AIOperationType,
    firmId: string
  ): Promise<void> {
    await this.store({
      prompt,
      response,
      modelUsed,
      operationType,
      firmId,
    });
  }
}

// Singleton instance
export const cacheService = new CacheService();
