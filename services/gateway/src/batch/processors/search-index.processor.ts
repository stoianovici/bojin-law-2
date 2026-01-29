/**
 * Search Index Processor
 * OPS-237: Search Index Processor (Nightly)
 *
 * Generates AI-enriched search terms for documents and cases to enable
 * fuzzy/abbreviation-based search (e.g., "act constit. tt solaria" finds
 * "Act Constitutiv TT Solaria SRL.docx").
 *
 * Features:
 * - Processes documents and cases modified since last successful run
 * - Uses Claude Haiku to generate abbreviations, alternates, entities, and tags
 * - Stores space-separated terms in searchTerms field
 * - Incremental processing for efficiency
 * - Supports Anthropic Batch API for 50% cost savings
 */

import { prisma } from '@legal-platform/database';
import type { Case, Document } from '@prisma/client';
import { z } from 'zod';
import { aiClient, getModelForFeature } from '../../services/ai-client.service';
import type {
  BatchableProcessor,
  BatchableRequest,
  BatchableResult,
  BatchProcessorConfig,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';
import { sanitizeForPrompt } from '../batch-utils';

// ============================================================================
// Types & Validation Schemas
// ============================================================================

/**
 * Zod schema for validating AI-generated search terms response.
 * Provides runtime type safety and defaults for missing fields.
 */
const SearchTermsSchema = z.object({
  abbreviations: z.array(z.string()).default([]),
  alternates: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

type SearchTermsResult = z.infer<typeof SearchTermsSchema>;

interface EntityDataForBatch {
  type: 'document' | 'case';
  id: string;
}

/**
 * Cache entry with timestamp for TTL expiry.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `Ești un asistent AI specializat în generarea termenilor de căutare pentru un sistem juridic românesc.

Returnează ÎNTOTDEAUNA un JSON valid cu structura exactă:
{
  "abbreviations": ["..."],
  "alternates": ["..."],
  "entities": ["..."],
  "tags": ["..."]
}

Reguli:
- abbreviations: abrevieri comune folosite în practica juridică (ex: "act constit" pentru "act constitutiv", "PV" pentru "proces verbal")
- alternates: variante de scriere, forme flexionate, greșeli frecvente de tastare
- entities: nume de companii, persoane, instituții menționate
- tags: categorii semantice relevante (tip document, domeniu juridic, etapă procedurală)

Generează minimum 3 termeni per categorie când este posibil.
Nu include termeni duplicați.
Toate termenele trebuie să fie în română.`;

// ============================================================================
// Processor
// ============================================================================

export class SearchIndexProcessor implements BatchableProcessor {
  readonly name = 'Search Index Generator';
  readonly feature = 'search_index';

  // Batch API configuration
  readonly batchConfig: BatchProcessorConfig = {
    minBatchSize: 10, // Use batch mode when 10+ items to process
    maxBatchSize: 1000, // Cap at 1000 items per batch
    pollingIntervalMs: 30_000, // Poll every 30 seconds initially
    maxPollingDurationMs: 4 * 60 * 60 * 1000, // 4 hours max wait time
  };

  // Cache for entity data during batch processing with TTL
  private entityDataCache: Map<string, CacheEntry<EntityDataForBatch>> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 2000; // Prevent unbounded memory growth

  /**
   * Get cache key with batch job scope.
   * Uses format: "batchJobId:entityType:entityId"
   */
  private getCacheKey(batchJobId: string, entityType: string, entityId: string): string {
    return `${batchJobId}:${entityType}:${entityId}`;
  }

  /**
   * Get cached data if not expired.
   */
  private getCachedData(key: string): EntityDataForBatch | undefined {
    const entry = this.entityDataCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.entityDataCache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * Set cached data with timestamp.
   * Enforces size limits to prevent unbounded memory growth.
   */
  private setCachedData(key: string, data: EntityDataForBatch): void {
    // Cleanup if approaching limit
    if (this.entityDataCache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupExpiredEntries();
    }
    // If still at limit, remove oldest entries
    if (this.entityDataCache.size >= this.MAX_CACHE_SIZE) {
      const entriesToRemove = this.entityDataCache.size - this.MAX_CACHE_SIZE + 100;
      let removed = 0;
      for (const cacheKey of this.entityDataCache.keys()) {
        if (removed >= entriesToRemove) break;
        this.entityDataCache.delete(cacheKey);
        removed++;
      }
      console.log(`[SearchIndexProcessor] Cache limit reached, removed ${removed} oldest entries`);
    }
    this.entityDataCache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Cleanup expired cache entries proactively.
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.entityDataCache) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.entityDataCache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[SearchIndexProcessor] Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Clear cache entries for a specific batch job.
   * Called after successful batch completion.
   */
  clearCacheForJob(batchJobId: string): void {
    for (const key of this.entityDataCache.keys()) {
      if (key.startsWith(`${batchJobId}:`)) {
        this.entityDataCache.delete(key);
      }
    }
  }

  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    let itemsProcessed = 0;
    let itemsFailed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];

    // Get configured model for search_index feature
    const model = await getModelForFeature(ctx.firmId, this.feature);
    console.log(`[SearchIndexProcessor] Using model: ${model}`);

    // Get last successful run time
    const lastRun = await this.getLastSuccessfulRunTime(ctx.firmId);
    console.log(
      `[SearchIndexProcessor] Processing items modified since: ${lastRun?.toISOString() || 'beginning of time'}`
    );

    // Process documents
    const docResult = await this.processDocuments(ctx, lastRun, model);
    itemsProcessed += docResult.itemsProcessed;
    itemsFailed += docResult.itemsFailed;
    totalTokens += docResult.totalTokens;
    totalCost += docResult.totalCost;
    if (docResult.errors) {
      errors.push(...docResult.errors);
    }

    // Process cases
    const caseResult = await this.processCases(ctx, lastRun, model);
    itemsProcessed += caseResult.itemsProcessed;
    itemsFailed += caseResult.itemsFailed;
    totalTokens += caseResult.totalTokens;
    totalCost += caseResult.totalCost;
    if (caseResult.errors) {
      errors.push(...caseResult.errors);
    }

    console.log(
      `[SearchIndexProcessor] Completed: ${itemsProcessed} processed, ${itemsFailed} failed`
    );

    return {
      itemsProcessed,
      itemsFailed,
      totalTokens,
      totalCost,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============================================================================
  // Batch API Methods (50% Cost Savings)
  // ============================================================================

  /**
   * Prepare all requests for Anthropic Batch API submission.
   *
   * This method:
   * 1. Finds documents and cases needing search term generation
   * 2. Builds prompts for each entity
   * 3. Caches entity data for later processing
   * 4. Returns array of BatchableRequest objects
   */
  async prepareBatchRequests(ctx: BatchProcessorContext): Promise<BatchableRequest[]> {
    const { firmId, batchJobId } = ctx;

    console.log(
      `[SearchIndexProcessor] Preparing batch requests for firm ${firmId} (job ${batchJobId})`
    );

    // Note: We do NOT clear cache here. Cache is job-scoped via keys,
    // so different jobs don't interfere. Cache is cleared after job completion.

    // Get last successful run time
    const lastRun = await this.getLastSuccessfulRunTime(firmId);
    const requests: BatchableRequest[] = [];

    // Prepare document requests
    const documents = await prisma.document.findMany({
      where: {
        firmId,
        status: 'FINAL',
        OR: [{ searchTermsUpdatedAt: null }, ...(lastRun ? [{ updatedAt: { gt: lastRun } }] : [])],
      },
      select: {
        id: true,
        fileName: true,
        metadata: true,
        updatedAt: true,
        searchTermsUpdatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: this.batchConfig.maxBatchSize,
    });

    for (const doc of documents) {
      if (doc.searchTermsUpdatedAt && doc.searchTermsUpdatedAt >= doc.updatedAt) {
        continue;
      }

      const description = (doc.metadata as Record<string, unknown>)?.description || '';
      const tags = (doc.metadata as Record<string, unknown>)?.tags || '';

      const prompt = `Analizează acest document și generează termeni de căutare în română.

Titlu/Nume fișier: ${sanitizeForPrompt(doc.fileName)}
Descriere: ${sanitizeForPrompt(description as string)}
Etichete: ${sanitizeForPrompt(tags as string)}

Returnează JSON-ul cu termenii de căutare.`;

      this.setCachedData(this.getCacheKey(batchJobId, 'document', doc.id), {
        type: 'document',
        id: doc.id,
      });

      requests.push({
        customId: `document:${doc.id}`,
        entityType: 'document',
        entityId: doc.id,
        prompt,
        system: SYSTEM_PROMPT,
        maxTokens: 512,
        temperature: 0.3,
      });
    }

    // Prepare case requests
    const cases = await prisma.case.findMany({
      where: {
        firmId,
        OR: [{ searchTermsUpdatedAt: null }, ...(lastRun ? [{ updatedAt: { gt: lastRun } }] : [])],
      },
      select: {
        id: true,
        title: true,
        description: true,
        caseNumber: true,
        keywords: true,
        referenceNumbers: true,
        updatedAt: true,
        searchTermsUpdatedAt: true,
        client: { select: { name: true } },
        actors: { select: { name: true, role: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: this.batchConfig.maxBatchSize,
    });

    for (const caseItem of cases) {
      if (caseItem.searchTermsUpdatedAt && caseItem.searchTermsUpdatedAt >= caseItem.updatedAt) {
        continue;
      }

      const actorNames = caseItem.actors
        .map((a) => `${sanitizeForPrompt(a.name)} (${a.role})`)
        .join(', ');

      const prompt = `Analizează acest dosar juridic și generează termeni de căutare în română.

Titlu: ${sanitizeForPrompt(caseItem.title)}
Număr dosar: ${sanitizeForPrompt(caseItem.caseNumber)}
Descriere: ${sanitizeForPrompt(caseItem.description)}
Client: ${sanitizeForPrompt(caseItem.client?.name) || 'N/A'}
Părți implicate: ${actorNames || 'N/A'}
Cuvinte cheie existente: ${caseItem.keywords.map((k) => sanitizeForPrompt(k)).join(', ') || 'N/A'}
Numere de referință: ${caseItem.referenceNumbers.map((r) => sanitizeForPrompt(r)).join(', ') || 'N/A'}

Returnează JSON-ul cu termenii de căutare.`;

      this.setCachedData(this.getCacheKey(batchJobId, 'case', caseItem.id), {
        type: 'case',
        id: caseItem.id,
      });

      requests.push({
        customId: `case:${caseItem.id}`,
        entityType: 'case',
        entityId: caseItem.id,
        prompt,
        system: SYSTEM_PROMPT,
        maxTokens: 512,
        temperature: 0.3,
      });
    }

    console.log(
      `[SearchIndexProcessor] Prepared ${requests.length} batch requests (${documents.length} docs, ${cases.length} cases)`
    );
    return requests;
  }

  /**
   * Process a single result from the Anthropic Batch API.
   *
   * This method:
   * 1. Retrieves cached entity data
   * 2. Parses the AI response
   * 3. Updates the document or case with search terms
   */
  async processBatchResult(result: BatchableResult, ctx: BatchProcessorContext): Promise<void> {
    // Use transaction client if available, otherwise fall back to global prisma
    const db = ctx.prisma || prisma;
    const cacheKey = this.getCacheKey(ctx.batchJobId, result.entityType, result.entityId);
    const entityData = this.getCachedData(cacheKey);

    if (!entityData) {
      throw new Error(
        `No cached data for ${result.entityType}:${result.entityId} - possible cache expiry or duplicate processing`
      );
    }

    if (!result.content) {
      console.warn(
        `[SearchIndexProcessor] Empty content for ${result.entityType}:${result.entityId}`
      );
      return;
    }

    // Parse search terms
    const searchTerms = this.parseSearchTermsResponse(result.content);
    const searchTermsString = this.searchTermsToString(searchTerms);

    // Update entity based on type
    if (entityData.type === 'document') {
      await db.document.update({
        where: { id: entityData.id },
        data: {
          searchTerms: searchTermsString,
          searchTermsUpdatedAt: new Date(),
        },
      });
    } else if (entityData.type === 'case') {
      await db.case.update({
        where: { id: entityData.id },
        data: {
          searchTerms: searchTermsString,
          searchTermsUpdatedAt: new Date(),
        },
      });
    }

    console.log(
      `[SearchIndexProcessor] Updated search terms for ${result.entityType}:${result.entityId}`
    );
  }

  // ============================================================================
  // Document Processing (Sync Mode)
  // ============================================================================

  private async processDocuments(
    ctx: BatchProcessorContext,
    lastRun: Date | null,
    model: string
  ): Promise<BatchProcessorResult> {
    let itemsProcessed = 0;
    let itemsFailed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];

    // Query documents needing processing:
    // - Status is FINAL (only index finalized documents for AI search)
    // - Never processed (searchTermsUpdatedAt is null)
    // - Modified since last run (updatedAt > lastRun)
    const documents = await prisma.document.findMany({
      where: {
        firmId: ctx.firmId,
        status: 'FINAL', // Only index finalized documents
        OR: [{ searchTermsUpdatedAt: null }, ...(lastRun ? [{ updatedAt: { gt: lastRun } }] : [])],
      },
      select: {
        id: true,
        fileName: true,
        metadata: true,
        updatedAt: true,
        searchTermsUpdatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: this.batchConfig.maxBatchSize,
    });

    console.log(`[SearchIndexProcessor] Found ${documents.length} documents to process`);

    for (const doc of documents) {
      // Skip if search terms are already up to date
      if (doc.searchTermsUpdatedAt && doc.searchTermsUpdatedAt >= doc.updatedAt) {
        continue;
      }

      try {
        const result = await this.generateDocumentSearchTerms(doc, ctx, model);
        itemsProcessed++;
        totalTokens += result.inputTokens + result.outputTokens;
        totalCost += result.costEur;
      } catch (error) {
        itemsFailed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Doc ${doc.id}: ${errorMsg}`);
        console.error(`[SearchIndexProcessor] Failed to process document ${doc.id}:`, errorMsg);
      }

      ctx.onProgress?.(itemsProcessed + itemsFailed, documents.length);
    }

    return { itemsProcessed, itemsFailed, totalTokens, totalCost, errors };
  }

  private async generateDocumentSearchTerms(
    doc: { id: string; fileName: string; metadata: any },
    ctx: BatchProcessorContext,
    model: string
  ): Promise<{ inputTokens: number; outputTokens: number; costEur: number }> {
    const description = doc.metadata?.description || '';
    const tags = doc.metadata?.tags || '';

    const prompt = `Analizează acest document și generează termeni de căutare în română.

Titlu/Nume fișier: ${sanitizeForPrompt(doc.fileName)}
Descriere: ${sanitizeForPrompt(description as string)}
Etichete: ${sanitizeForPrompt(tags as string)}

Returnează JSON-ul cu termenii de căutare.`;

    const response = await aiClient.complete(
      prompt,
      {
        feature: this.feature,
        firmId: ctx.firmId,
        entityType: 'document',
        entityId: doc.id,
        batchJobId: ctx.batchJobId,
      },
      {
        model,
        system: SYSTEM_PROMPT,
        maxTokens: 512,
        temperature: 0.3,
      }
    );

    // Parse response and update document
    const searchTerms = this.parseSearchTermsResponse(response.content);
    const searchTermsString = this.searchTermsToString(searchTerms);

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        searchTerms: searchTermsString,
        searchTermsUpdatedAt: new Date(),
      },
    });

    return {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costEur: response.costEur,
    };
  }

  // ============================================================================
  // Case Processing
  // ============================================================================

  private async processCases(
    ctx: BatchProcessorContext,
    lastRun: Date | null,
    model: string
  ): Promise<BatchProcessorResult> {
    let itemsProcessed = 0;
    let itemsFailed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];

    // Query cases needing processing:
    // - Never processed (searchTermsUpdatedAt is null)
    // - Modified since last run (updatedAt > lastRun)
    const cases = await prisma.case.findMany({
      where: {
        firmId: ctx.firmId,
        OR: [{ searchTermsUpdatedAt: null }, ...(lastRun ? [{ updatedAt: { gt: lastRun } }] : [])],
      },
      select: {
        id: true,
        title: true,
        description: true,
        caseNumber: true,
        keywords: true,
        referenceNumbers: true,
        updatedAt: true,
        searchTermsUpdatedAt: true,
        client: {
          select: { name: true },
        },
        actors: {
          select: { name: true, role: true },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: this.batchConfig.maxBatchSize,
    });

    console.log(`[SearchIndexProcessor] Found ${cases.length} cases to process`);

    for (const caseItem of cases) {
      // Skip if search terms are already up to date
      if (caseItem.searchTermsUpdatedAt && caseItem.searchTermsUpdatedAt >= caseItem.updatedAt) {
        continue;
      }

      try {
        const result = await this.generateCaseSearchTerms(caseItem, ctx, model);
        itemsProcessed++;
        totalTokens += result.inputTokens + result.outputTokens;
        totalCost += result.costEur;
      } catch (error) {
        itemsFailed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Case ${caseItem.id}: ${errorMsg}`);
        console.error(`[SearchIndexProcessor] Failed to process case ${caseItem.id}:`, errorMsg);
      }

      ctx.onProgress?.(itemsProcessed + itemsFailed, cases.length);
    }

    return { itemsProcessed, itemsFailed, totalTokens, totalCost, errors };
  }

  private async generateCaseSearchTerms(
    caseItem: {
      id: string;
      title: string;
      description: string;
      caseNumber: string;
      keywords: string[];
      referenceNumbers: string[];
      client: { name: string } | null;
      actors: Array<{ name: string; role: string }>;
    },
    ctx: BatchProcessorContext,
    model: string
  ): Promise<{ inputTokens: number; outputTokens: number; costEur: number }> {
    const actorNames = caseItem.actors
      .map((a) => `${sanitizeForPrompt(a.name)} (${a.role})`)
      .join(', ');

    const prompt = `Analizează acest dosar juridic și generează termeni de căutare în română.

Titlu: ${sanitizeForPrompt(caseItem.title)}
Număr dosar: ${sanitizeForPrompt(caseItem.caseNumber)}
Descriere: ${sanitizeForPrompt(caseItem.description)}
Client: ${sanitizeForPrompt(caseItem.client?.name) || 'N/A'}
Părți implicate: ${actorNames || 'N/A'}
Cuvinte cheie existente: ${caseItem.keywords.map((k) => sanitizeForPrompt(k)).join(', ') || 'N/A'}
Numere de referință: ${caseItem.referenceNumbers.map((r) => sanitizeForPrompt(r)).join(', ') || 'N/A'}

Returnează JSON-ul cu termenii de căutare.`;

    const response = await aiClient.complete(
      prompt,
      {
        feature: this.feature,
        firmId: ctx.firmId,
        entityType: 'case',
        entityId: caseItem.id,
        batchJobId: ctx.batchJobId,
      },
      {
        model,
        system: SYSTEM_PROMPT,
        maxTokens: 512,
        temperature: 0.3,
      }
    );

    // Parse response and update case
    const searchTerms = this.parseSearchTermsResponse(response.content);
    const searchTermsString = this.searchTermsToString(searchTerms);

    await prisma.case.update({
      where: { id: caseItem.id },
      data: {
        searchTerms: searchTermsString,
        searchTermsUpdatedAt: new Date(),
      },
    });

    return {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costEur: response.costEur,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private parseSearchTermsResponse(content: string): SearchTermsResult {
    const defaultResult: SearchTermsResult = {
      abbreviations: [],
      alternates: [],
      entities: [],
      tags: [],
    };

    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[SearchIndexProcessor] No JSON found in response, using empty result');
        return defaultResult;
      }

      const rawParsed = JSON.parse(jsonMatch[0]);

      // Validate with Zod schema - provides defaults for missing/invalid fields
      const validated = SearchTermsSchema.safeParse(rawParsed);
      if (!validated.success) {
        console.warn('[SearchIndexProcessor] Invalid response schema:', validated.error.message);
        return defaultResult;
      }

      return validated.data;
    } catch (error) {
      console.warn('[SearchIndexProcessor] Failed to parse search terms response:', error);
      return defaultResult;
    }
  }

  private searchTermsToString(terms: SearchTermsResult): string {
    // Combine all terms into a space-separated string for tsvector
    const allTerms = [
      ...terms.abbreviations,
      ...terms.alternates,
      ...terms.entities,
      ...terms.tags,
    ];

    // Deduplicate and normalize
    const uniqueTerms = [...new Set(allTerms.map((t) => t.toLowerCase().trim()))];

    return uniqueTerms.join(' ');
  }

  private async getLastSuccessfulRunTime(firmId: string): Promise<Date | null> {
    const lastRun = await prisma.aIBatchJobRun.findFirst({
      where: {
        firmId,
        feature: this.feature,
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    return lastRun?.completedAt || null;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const searchIndexProcessor = new SearchIndexProcessor();
