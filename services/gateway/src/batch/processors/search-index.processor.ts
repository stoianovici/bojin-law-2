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
 */

import { prisma } from '@legal-platform/database';
import type { Case, Document } from '@prisma/client';
import { aiClient, getModelForFeature } from '../../services/ai-client.service';
import type {
  BatchProcessor,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';

// ============================================================================
// Types
// ============================================================================

interface SearchTermsResult {
  abbreviations: string[];
  alternates: string[];
  entities: string[];
  tags: string[];
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

export class SearchIndexProcessor implements BatchProcessor {
  readonly name = 'Search Index Generator';
  readonly feature = 'search_index';

  private readonly BATCH_SIZE = 50;

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
  // Document Processing
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
    // - Never processed (searchTermsUpdatedAt is null)
    // - Modified since last run (updatedAt > lastRun)
    const documents = await prisma.document.findMany({
      where: {
        firmId: ctx.firmId,
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
      take: this.BATCH_SIZE,
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

Titlu/Nume fișier: ${doc.fileName}
Descriere: ${description}
Etichete: ${tags}

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
      take: this.BATCH_SIZE,
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
    const actorNames = caseItem.actors.map((a) => `${a.name} (${a.role})`).join(', ');

    const prompt = `Analizează acest dosar juridic și generează termeni de căutare în română.

Titlu: ${caseItem.title}
Număr dosar: ${caseItem.caseNumber}
Descriere: ${caseItem.description}
Client: ${caseItem.client?.name || 'N/A'}
Părți implicate: ${actorNames || 'N/A'}
Cuvinte cheie existente: ${caseItem.keywords.join(', ') || 'N/A'}
Numere de referință: ${caseItem.referenceNumbers.join(', ') || 'N/A'}

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
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[SearchIndexProcessor] No JSON found in response, using empty result');
        return { abbreviations: [], alternates: [], entities: [], tags: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        abbreviations: Array.isArray(parsed.abbreviations) ? parsed.abbreviations : [],
        alternates: Array.isArray(parsed.alternates) ? parsed.alternates : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    } catch (error) {
      console.warn('[SearchIndexProcessor] Failed to parse search terms response:', error);
      return { abbreviations: [], alternates: [], entities: [], tags: [] };
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
