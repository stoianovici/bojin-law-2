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
 */

import { prisma } from '@legal-platform/database';
import type { Email } from '@prisma/client';
import { aiClient, getModelForFeature } from '../../services/ai-client.service';
import type {
  BatchProcessor,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';

// ============================================================================
// Types
// ============================================================================

interface ThreadSummaryData {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  participants: string[];
}

interface StaleThread {
  conversationId: string;
}

// ============================================================================
// Thread Summaries Processor
// ============================================================================

export class ThreadSummariesProcessor implements BatchProcessor {
  readonly name = 'Thread Summaries Generator';
  readonly feature = 'thread_summaries';

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
      const from = email.from as { name?: string; address: string };
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

    // Parse JSON response
    let parsed: ThreadSummaryData;
    try {
      // Remove markdown code blocks if present
      let jsonStr = response.content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback if JSON parsing fails
      console.warn('[ThreadSummaries] Failed to parse AI response as JSON, using fallback');
      parsed = {
        overview: 'Rezumat indisponibil.',
        keyPoints: [],
        actionItems: [],
        sentiment: 'neutral',
        participants: [],
      };
    }

    // Validate and normalize sentiment
    const validSentiments = ['positive', 'neutral', 'negative', 'urgent'];
    if (!validSentiments.includes(parsed.sentiment)) {
      parsed.sentiment = 'neutral';
    }

    return {
      overview: parsed.overview || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      sentiment: parsed.sentiment as ThreadSummaryData['sentiment'],
      participants: Array.isArray(parsed.participants) ? parsed.participants : [],
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costEur: response.costEur,
    };
  }
}

// ============================================================================
// Helper Type
// ============================================================================

interface EmailForSummary {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  bodyContentClean: string | null;
  from: unknown;
  toRecipients: unknown;
  ccRecipients: unknown;
  receivedDateTime: Date;
  caseId: string | null;
}

// ============================================================================
// Export
// ============================================================================

export const threadSummariesProcessor = new ThreadSummariesProcessor();
