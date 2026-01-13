/**
 * Semantic Cache Service
 * Story 3.1: AI Service Infrastructure
 *
 * NOTE: AIResponseCache model was removed from schema as dead code.
 * This service is now a no-op stub that always returns cache misses.
 * AI responses are not cached, which may increase API costs but simplifies the system.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { AIOperationType, AICacheEntry } from '@legal-platform/types';
import { config } from '../config';

// Initialize Prisma client (kept for interface compatibility)
let _prisma: PrismaClient;

export function initializeCachePrisma(client: PrismaClient) {
  _prisma = client;
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
   * NOTE: AIResponseCache model removed - always returns cache miss
   */
  async lookupByHash(_prompt: string, _firmId: string): Promise<CacheLookupResult> {
    this.misses++;
    return { found: false };
  }

  /**
   * Look up cache entry by semantic similarity
   * NOTE: AIResponseCache model removed - always returns cache miss
   */
  async lookupBySimilarity(
    _embedding: number[],
    _firmId: string,
    _operationType?: AIOperationType
  ): Promise<CacheLookupResult> {
    this.misses++;
    return { found: false };
  }

  /**
   * Store a response in the cache
   * NOTE: AIResponseCache model removed - returns mock entry without persisting
   */
  async store(input: CacheStoreInput): Promise<AICacheEntry> {
    const hash = this.hashPrompt(input.prompt);
    const expiresAt = new Date(Date.now() + this.ttlHours * 60 * 60 * 1000);

    // Return mock entry without persisting
    return {
      id: `mock-${Date.now()}`,
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
  }

  /**
   * Invalidate cache entries by firm
   * NOTE: AIResponseCache model removed - no-op
   */
  async invalidateByFirm(_firmId: string): Promise<number> {
    return 0;
  }

  /**
   * Invalidate cache entries by operation type
   * NOTE: AIResponseCache model removed - no-op
   */
  async invalidateByOperationType(_firmId: string, _operationType: AIOperationType): Promise<number> {
    return 0;
  }

  /**
   * Clean up expired cache entries
   * NOTE: AIResponseCache model removed - no-op
   */
  async cleanupExpired(): Promise<number> {
    return 0;
  }

  /**
   * Get cache metrics
   * NOTE: AIResponseCache model removed - returns in-memory metrics only
   */
  async getMetrics(_firmId?: string): Promise<CacheMetrics> {
    return {
      totalEntries: 0,
      hitCount: this.hits,
      missCount: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      avgHitsPerEntry: 0,
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
   * NOTE: AIResponseCache model removed - always returns null
   */
  async get(_key: string, _firmId: string): Promise<AICacheEntry | null> {
    this.misses++;
    return null;
  }

  /**
   * Simple set method for compatibility with other services
   * NOTE: AIResponseCache model removed - no-op
   */
  async set(
    _key: string,
    _prompt: string,
    _response: string,
    _modelUsed: string,
    _operationType: AIOperationType,
    _firmId: string
  ): Promise<void> {
    // No-op - caching disabled
  }
}

// Singleton instance
export const cacheService = new CacheService();
