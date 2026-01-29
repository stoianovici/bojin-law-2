/**
 * Thread Summaries Processor
 * OPS-240: Thread Summaries Processor
 *
 * Pre-generates summaries for email threads with new messages.
 * Runs as part of the nightly batch processing.
 *
 * Features:
 * - Incremental processing (only threads with new messages)
 * - Romanian language summaries
 * - Extracts overview, key points, action items, and sentiment
 * - Supports Anthropic Batch API for 50% cost savings
 */

import { prisma } from '@legal-platform/database';
import type { Email } from '@prisma/client';
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

// ============================================================================
// Types & Validation Schemas
// ============================================================================

/**
 * Zod schema for validating AI-generated thread summary response.
 * Provides runtime type safety and defaults for missing fields.
 */
const ThreadSummarySchema = z.object({
  overview: z.string().default(''),
  keyPoints: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([]),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']).default('neutral'),
  participants: z.array(z.string()).default([]),
});

type ThreadSummaryData = z.infer<typeof ThreadSummarySchema>;

interface StaleThread {
  conversationId: string;
}

interface ThreadDataForBatch {
  conversationId: string;
  firmId: string;
  emails: EmailForSummary[];
  caseId: string | null;
}

/**
 * Cache entry with timestamp for TTL expiry.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// Thread Summaries Processor
// ============================================================================

export class ThreadSummariesProcessor implements BatchableProcessor {
  readonly name = 'Thread Summaries Generator';
  readonly feature = 'thread_summaries';

  // Batch API configuration
  readonly batchConfig: BatchProcessorConfig = {
    minBatchSize: 10, // Use batch mode when 10+ threads to process
    maxBatchSize: 1000, // Anthropic limit is 10,000 but we cap at 1000
    pollingIntervalMs: 30_000, // Poll every 30 seconds initially
    maxPollingDurationMs: 4 * 60 * 60 * 1000, // 4 hours max wait time
  };

  // Cache for thread data during batch processing with TTL
  private threadDataCache: Map<string, CacheEntry<ThreadDataForBatch>> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 2000; // Prevent unbounded memory growth

  /**
   * Get cache key with batch job scope.
   * Uses format: "batchJobId:entityType:entityId"
   */
  private getCacheKey(batchJobId: string, conversationId: string): string {
    return `${batchJobId}:thread:${conversationId}`;
  }

  /**
   * Get cached data if not expired.
   */
  private getCachedData(key: string): ThreadDataForBatch | undefined {
    const entry = this.threadDataCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.threadDataCache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * Set cached data with timestamp.
   * Enforces size limits to prevent unbounded memory growth.
   */
  private setCachedData(key: string, data: ThreadDataForBatch): void {
    // Cleanup if approaching limit
    if (this.threadDataCache.size >= this.MAX_CACHE_SIZE) {
      this.cleanupExpiredEntries();
    }
    // If still at limit, remove oldest entries
    if (this.threadDataCache.size >= this.MAX_CACHE_SIZE) {
      const entriesToRemove = this.threadDataCache.size - this.MAX_CACHE_SIZE + 100;
      let removed = 0;
      for (const cacheKey of this.threadDataCache.keys()) {
        if (removed >= entriesToRemove) break;
        this.threadDataCache.delete(cacheKey);
        removed++;
      }
      console.log(`[ThreadSummaries] Cache limit reached, removed ${removed} oldest entries`);
    }
    this.threadDataCache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Cleanup expired cache entries proactively.
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.threadDataCache) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.threadDataCache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      console.log(`[ThreadSummaries] Cleaned up ${removed} expired cache entries`);
    }
  }

  /**
   * Clear cache entries for a specific batch job.
   * Called after successful batch completion.
   */
  clearCacheForJob(batchJobId: string): void {
    for (const key of this.threadDataCache.keys()) {
      if (key.startsWith(`${batchJobId}:`)) {
        this.threadDataCache.delete(key);
      }
    }
  }

  /**
   * Process threads that need summary updates.
   *
   * Finds threads where:
   * - ThreadSummary doesn't exist OR
   * - lastAnalyzedAt is older than latest email
   * - Thread has 2+ emails
   *
   * Generates a summary with Claude and upserts the record.
   * Uses model configured in /admin/ai for thread_summaries feature.
   */
  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    const { firmId, batchJobId, onProgress } = ctx;

    let itemsProcessed = 0;
    let itemsFailed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];

    // Get configured model for thread_summaries feature
    const model = await getModelForFeature(firmId, this.feature);
    console.log(`[ThreadSummaries] Using model: ${model}`);

    // Find threads needing summary update
    const staleThreads = await this.findStaleThreads(firmId);

    console.log(
      `[ThreadSummaries] Found ${staleThreads.length} threads to summarize for firm ${firmId}`
    );

    const total = staleThreads.length;

    for (const { conversationId } of staleThreads) {
      try {
        const result = await this.summarizeThread(conversationId, firmId, batchJobId, model);
        itemsProcessed++;
        totalTokens += result.inputTokens + result.outputTokens;
        totalCost += result.costEur;
      } catch (error) {
        itemsFailed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Thread ${conversationId}: ${message}`);
        console.error(`[ThreadSummaries] Failed to summarize thread ${conversationId}:`, message);
      }

      onProgress?.(itemsProcessed + itemsFailed, total);
    }

    console.log(
      `[ThreadSummaries] Completed: ${itemsProcessed} processed, ${itemsFailed} failed, ${totalTokens} tokens, €${totalCost.toFixed(4)}`
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
   * 1. Finds all threads needing summaries
   * 2. Builds prompts for each thread
   * 3. Caches thread data for later processing
   * 4. Returns array of BatchableRequest objects
   */
  async prepareBatchRequests(ctx: BatchProcessorContext): Promise<BatchableRequest[]> {
    const { firmId, batchJobId } = ctx;

    console.log(
      `[ThreadSummaries] Preparing batch requests for firm ${firmId} (job ${batchJobId})`
    );

    // Note: We do NOT clear cache here. Cache is job-scoped via keys,
    // so different jobs don't interfere. Cache is cleared after job completion.

    // Find threads needing summary update
    const staleThreads = await this.findStaleThreads(firmId);
    console.log(`[ThreadSummaries] Found ${staleThreads.length} threads to summarize`);

    const requests: BatchableRequest[] = [];

    for (const { conversationId } of staleThreads) {
      // Fetch emails for this thread
      const emails = await prisma.email.findMany({
        where: { conversationId, firmId },
        orderBy: { receivedDateTime: 'asc' },
        select: {
          id: true,
          subject: true,
          bodyPreview: true,
          bodyContent: true,
          bodyContentClean: true,
          from: true,
          toRecipients: true,
          ccRecipients: true,
          receivedDateTime: true,
          caseId: true,
        },
      });

      if (emails.length < 2) {
        continue;
      }

      // Build conversation text
      const conversationText = this.buildConversationText(emails as unknown as EmailForSummary[]);

      // Build prompt
      const prompt = this.buildSummaryPrompt(conversationText);

      // Cache thread data for processBatchResult (job-scoped)
      this.setCachedData(this.getCacheKey(batchJobId, conversationId), {
        conversationId,
        firmId,
        emails: emails as unknown as EmailForSummary[],
        caseId: emails[0]?.caseId || null,
      });

      requests.push({
        customId: `thread:${conversationId}`,
        entityType: 'thread',
        entityId: conversationId,
        prompt,
        maxTokens: 512,
        temperature: 0.3,
      });
    }

    console.log(`[ThreadSummaries] Prepared ${requests.length} batch requests`);
    return requests;
  }

  /**
   * Process a single result from the Anthropic Batch API.
   *
   * This method:
   * 1. Retrieves cached thread data
   * 2. Parses the AI response
   * 3. Upserts the ThreadSummary record
   */
  async processBatchResult(result: BatchableResult, ctx: BatchProcessorContext): Promise<void> {
    // Use transaction client if available, otherwise fall back to global prisma
    const db = ctx.prisma || prisma;
    const { firmId, batchJobId } = ctx;
    const conversationId = result.entityId;

    // Get cached thread data (job-scoped)
    const cacheKey = this.getCacheKey(batchJobId, conversationId);
    const threadData = this.getCachedData(cacheKey);
    if (!threadData) {
      throw new Error(
        `No cached data for thread ${conversationId} - possible cache expiry or duplicate processing`
      );
    }

    if (!result.content) {
      console.warn(`[ThreadSummaries] Empty content for thread ${conversationId}`);
      return;
    }

    // Parse AI response
    const summaryData = this.parseAIResponse(result.content);

    // Upsert ThreadSummary
    await db.threadSummary.upsert({
      where: { conversationId },
      create: {
        conversationId,
        firmId,
        caseId: threadData.caseId,
        messageCount: threadData.emails.length,
        lastAnalyzedAt: new Date(),
        overview: summaryData.overview,
        keyPoints: summaryData.keyPoints,
        actionItems: summaryData.actionItems,
        sentiment: summaryData.sentiment,
        participants: summaryData.participants,
      },
      update: {
        caseId: threadData.caseId,
        messageCount: threadData.emails.length,
        lastAnalyzedAt: new Date(),
        overview: summaryData.overview,
        keyPoints: summaryData.keyPoints,
        actionItems: summaryData.actionItems,
        sentiment: summaryData.sentiment,
        participants: summaryData.participants,
      },
    });

    console.log(`[ThreadSummaries] Saved summary for thread ${conversationId}`);
  }

  /**
   * Build the summary prompt from conversation text.
   */
  private buildSummaryPrompt(conversationText: string): string {
    return `Analizează următoarea conversație email și generează un rezumat structurat în limba română.

CONVERSAȚIE:
${conversationText}

---

Generează un JSON cu următoarea structură:
{
  "overview": "1-2 propoziții care descriu scopul și rezultatul conversației",
  "keyPoints": ["punct 1", "punct 2", "punct 3"],
  "actionItems": ["acțiune 1", "acțiune 2"],
  "sentiment": "positive" | "neutral" | "negative" | "urgent",
  "participants": ["Nume Persoana 1 <email1@example.com>", "Nume Persoana 2 <email2@example.com>"]
}

Reguli:
- Scrie totul în limba română
- Overview: maxim 2 propoziții clare și concise
- KeyPoints: 3-5 puncte principale ale discuției
- ActionItems: doar dacă există acțiuni concrete de făcut (poate fi gol)
- Sentiment: "urgent" doar dacă sunt termene sau probleme critice
- Participants: include toți participanții cu email-ul lor

Răspunde DOAR cu JSON-ul, fără alt text.`;
  }

  /**
   * Parse AI response into ThreadSummaryData.
   */
  private parseAIResponse(content: string): ThreadSummaryData {
    const defaultResult: ThreadSummaryData = {
      overview: 'Rezumat indisponibil.',
      keyPoints: [],
      actionItems: [],
      sentiment: 'neutral',
      participants: [],
    };

    try {
      // Remove markdown code blocks if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const rawParsed = JSON.parse(jsonStr);

      // Validate with Zod schema - provides defaults for missing/invalid fields
      const validated = ThreadSummarySchema.safeParse(rawParsed);
      if (!validated.success) {
        console.warn('[ThreadSummaries] Invalid response schema:', validated.error.message);
        return defaultResult;
      }

      return validated.data;
    } catch {
      console.warn('[ThreadSummaries] Failed to parse AI response as JSON, using fallback');
      return defaultResult;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Find threads that need summary updates.
   *
   * Uses raw query to compare dates across tables efficiently.
   */
  private async findStaleThreads(firmId: string): Promise<StaleThread[]> {
    // Query threads where:
    // 1. No ThreadSummary exists, OR
    // 2. ThreadSummary.lastAnalyzedAt < max(Email.receivedDateTime)
    // AND thread has 2+ emails
    const staleThreads = await prisma.$queryRaw<StaleThread[]>`
      SELECT DISTINCT e.conversation_id as "conversationId"
      FROM emails e
      LEFT JOIN thread_summaries ts ON ts.conversation_id = e.conversation_id
      WHERE e.firm_id = ${firmId}
        AND e.conversation_id IS NOT NULL
        AND (
          ts.id IS NULL
          OR ts.last_analyzed_at < (
            SELECT MAX(e2.received_date_time)
            FROM emails e2
            WHERE e2.conversation_id = e.conversation_id
          )
        )
      GROUP BY e.conversation_id
      HAVING COUNT(e.id) >= 2
      LIMIT 100
    `;

    return staleThreads;
  }

  /**
   * Generate and save summary for a single thread.
   */
  private async summarizeThread(
    conversationId: string,
    firmId: string,
    batchJobId: string,
    model: string
  ): Promise<{ inputTokens: number; outputTokens: number; costEur: number }> {
    // Fetch all emails in thread
    const emails = await prisma.email.findMany({
      where: { conversationId, firmId },
      orderBy: { receivedDateTime: 'asc' },
      select: {
        id: true,
        subject: true,
        bodyPreview: true,
        bodyContent: true,
        bodyContentClean: true,
        from: true,
        toRecipients: true,
        ccRecipients: true,
        receivedDateTime: true,
        caseId: true,
      },
    });

    if (emails.length < 2) {
      // Shouldn't happen due to SQL filter, but be safe
      return { inputTokens: 0, outputTokens: 0, costEur: 0 };
    }

    // Build conversation text for AI
    const conversationText = this.buildConversationText(emails as unknown as EmailForSummary[]);

    // Generate summary with Claude
    const summaryData = await this.generateSummaryWithAI(
      conversationText,
      firmId,
      batchJobId,
      model
    );

    // Upsert ThreadSummary
    await prisma.threadSummary.upsert({
      where: { conversationId },
      create: {
        conversationId,
        firmId,
        caseId: emails[0]?.caseId || null,
        messageCount: emails.length,
        lastAnalyzedAt: new Date(),
        overview: summaryData.overview,
        keyPoints: summaryData.keyPoints,
        actionItems: summaryData.actionItems,
        sentiment: summaryData.sentiment,
        participants: summaryData.participants,
      },
      update: {
        caseId: emails[0]?.caseId || null,
        messageCount: emails.length,
        lastAnalyzedAt: new Date(),
        overview: summaryData.overview,
        keyPoints: summaryData.keyPoints,
        actionItems: summaryData.actionItems,
        sentiment: summaryData.sentiment,
        participants: summaryData.participants,
      },
    });

    return {
      inputTokens: summaryData.inputTokens,
      outputTokens: summaryData.outputTokens,
      costEur: summaryData.costEur,
    };
  }

  /**
   * Build a text representation of the conversation for AI processing.
   */
  private buildConversationText(emails: EmailForSummary[]): string {
    const parts: string[] = [];

    for (const email of emails) {
      const { from } = email;
      const date = new Date(email.receivedDateTime).toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Prefer cleaned content if available
      const body = email.bodyContentClean || email.bodyPreview || email.bodyContent || '';
      // Truncate long bodies
      const truncatedBody = body.length > 2000 ? body.substring(0, 2000) + '...' : body;

      parts.push(`[${date}] ${from.name || from.address}:\n${truncatedBody}`);
    }

    return parts.join('\n\n---\n\n');
  }

  /**
   * Generate summary using Claude AI.
   */
  private async generateSummaryWithAI(
    conversationText: string,
    firmId: string,
    batchJobId: string,
    model: string
  ): Promise<ThreadSummaryData & { inputTokens: number; outputTokens: number; costEur: number }> {
    const prompt = `Analizează următoarea conversație email și generează un rezumat structurat în limba română.

CONVERSAȚIE:
${conversationText}

---

Generează un JSON cu următoarea structură:
{
  "overview": "1-2 propoziții care descriu scopul și rezultatul conversației",
  "keyPoints": ["punct 1", "punct 2", "punct 3"],
  "actionItems": ["acțiune 1", "acțiune 2"],
  "sentiment": "positive" | "neutral" | "negative" | "urgent",
  "participants": ["Nume Persoana 1 <email1@example.com>", "Nume Persoana 2 <email2@example.com>"]
}

Reguli:
- Scrie totul în limba română
- Overview: maxim 2 propoziții clare și concise
- KeyPoints: 3-5 puncte principale ale discuției
- ActionItems: doar dacă există acțiuni concrete de făcut (poate fi gol)
- Sentiment: "urgent" doar dacă sunt termene sau probleme critice
- Participants: include toți participanții cu email-ul lor

Răspunde DOAR cu JSON-ul, fără alt text.`;

    const response = await aiClient.complete(
      prompt,
      {
        feature: this.feature,
        firmId,
        batchJobId,
        entityType: 'thread',
      },
      {
        model,
        maxTokens: 512,
        temperature: 0.3,
      }
    );

    // Parse AI response using the shared method
    const parsed = this.parseAIResponse(response.content);

    return {
      ...parsed,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costEur: response.costEur,
    };
  }
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Email address structure from Microsoft Graph API.
 */
interface EmailAddress {
  name?: string;
  address: string;
}

interface EmailForSummary {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  bodyContentClean: string | null;
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  receivedDateTime: Date;
  caseId: string | null;
}

// ============================================================================
// Export
// ============================================================================

export const threadSummariesProcessor = new ThreadSummariesProcessor();
