/**
 * Cluster Naming Service
 * Uses AI to suggest names for document clusters based on sample documents.
 *
 * Uses Anthropic Batch API with Claude Haiku for cost-effective naming.
 * Generates Romanian names with English translations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

export interface NamingResult {
  clusterId: string;
  suggestedName: string;
  suggestedNameEn: string;
  description: string;
}

interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    messages: Array<{ role: 'user'; content: string }>;
    system?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const HAIKU_MODEL = 'claude-3-5-haiku-20241022';
const MAX_TEXT_PER_SAMPLE = 2000; // Characters per sample document

const NAMING_SYSTEM_PROMPT = `You are a legal document categorization expert for a Romanian law firm.
Your task is to suggest a concise, descriptive name for a group of similar legal documents.

Based on the sample documents provided, suggest:
1. A name in Romanian (max 50 characters) - formal legal terminology
2. The English translation of the name
3. A brief description in Romanian (1-2 sentences) explaining what type of documents are in this group

Common Romanian legal document categories:
- Contract de Vânzare-Cumpărare (Sale Agreement)
- Contract de Închiriere (Lease Agreement)
- Procură (Power of Attorney)
- Cerere de Chemare în Judecată (Lawsuit Filing)
- Întâmpinare (Statement of Defense)
- Notificare (Notice/Notification)
- Acord de Confidențialitate (NDA)
- Contract de Muncă (Employment Contract)

Respond in JSON format:
{
  "nameRo": "Name in Romanian",
  "nameEn": "Name in English",
  "description": "Brief description in Romanian"
}`;

// ============================================================================
// Service
// ============================================================================

export class ClusterNamingService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Name all pending clusters in a session.
   */
  async nameClusters(sessionId: string): Promise<void> {
    // Get clusters that need naming (exclude noise cluster which is auto-rejected)
    const clusters = await prisma.documentCluster.findMany({
      where: {
        sessionId,
        status: 'Pending',
        suggestedName: { startsWith: 'Cluster' }, // Only rename auto-named clusters
      },
      select: {
        id: true,
        sampleDocumentIds: true,
      },
    });

    if (clusters.length === 0) {
      console.log('[ClusterNaming] No clusters to name');
      return;
    }

    console.log(`[ClusterNaming] Naming ${clusters.length} clusters`);

    // Build batch requests
    const requests: BatchRequest[] = [];

    for (const cluster of clusters) {
      const sampleTexts = await this.getSampleTexts(cluster.sampleDocumentIds);
      if (sampleTexts.length === 0) continue;

      // custom_id must match pattern ^[a-zA-Z0-9_-]{1,64}$
      requests.push({
        custom_id: `cluster_${cluster.id}`,
        params: {
          model: HAIKU_MODEL,
          max_tokens: 256,
          system: NAMING_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user' as const,
              content: this.buildNamingPrompt(sampleTexts),
            },
          ],
        },
      });
    }

    if (requests.length === 0) {
      console.log('[ClusterNaming] No valid clusters to process');
      return;
    }

    // Submit batch
    const results = await this.processBatch(requests);

    // Update clusters with names
    for (const result of results) {
      await this.updateCluster(result);
    }

    console.log(`[ClusterNaming] Named ${results.length} clusters`);
  }

  /**
   * Get sample document texts for a cluster.
   */
  private async getSampleTexts(sampleDocumentIds: string[]): Promise<string[]> {
    if (sampleDocumentIds.length === 0) return [];

    const documents = await prisma.extractedDocument.findMany({
      where: {
        id: { in: sampleDocumentIds },
      },
      select: {
        fileName: true,
        extractedText: true,
      },
    });

    return documents
      .filter((d) => d.extractedText)
      .map((d) => {
        const text = d.extractedText!;
        const truncated =
          text.length > MAX_TEXT_PER_SAMPLE ? text.substring(0, MAX_TEXT_PER_SAMPLE) + '...' : text;
        return `[${d.fileName}]\n${truncated}`;
      });
  }

  /**
   * Build the naming prompt from sample texts.
   */
  private buildNamingPrompt(sampleTexts: string[]): string {
    const parts = [
      'Analyze these sample documents from the same cluster and suggest a category name:\n',
    ];

    for (let i = 0; i < sampleTexts.length; i++) {
      parts.push(`\n--- Sample ${i + 1} ---\n${sampleTexts[i]}`);
    }

    return parts.join('');
  }

  /**
   * Process a batch of naming requests.
   */
  private async processBatch(requests: BatchRequest[]): Promise<NamingResult[]> {
    console.log(`[ClusterNaming] Submitting batch of ${requests.length} requests`);

    // Submit batch to Anthropic
    const batch = await this.anthropic.messages.batches.create({
      requests,
    });

    console.log(`[ClusterNaming] Batch submitted: ${batch.id}`);

    // Wait for completion
    let status = await this.anthropic.messages.batches.retrieve(batch.id);
    while (status.processing_status !== 'ended') {
      console.log(`[ClusterNaming] Batch ${batch.id}: ${status.processing_status}`);
      await this.sleep(15_000); // Poll every 15 seconds (smaller batches)
      status = await this.anthropic.messages.batches.retrieve(batch.id);
    }

    console.log(`[ClusterNaming] Batch completed: ${status.request_counts.succeeded} succeeded`);

    // Retrieve results
    const results: NamingResult[] = [];
    const resultsStream = await this.anthropic.messages.batches.results(batch.id);

    for await (const result of resultsStream) {
      const clusterId = result.custom_id.replace('cluster_', '');

      if (result.result.type === 'succeeded' && result.result.message) {
        const textContent = result.result.message.content
          .filter(
            (block: Anthropic.ContentBlock): block is Anthropic.TextBlock => block.type === 'text'
          )
          .map((block: Anthropic.TextBlock) => block.text)
          .join('');

        try {
          // Extract JSON from response (may be wrapped in markdown code blocks)
          let jsonText = textContent;
          const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
          } else {
            const objectMatch = textContent.match(/\{[\s\S]*\}/);
            if (objectMatch) {
              jsonText = objectMatch[0];
            }
          }

          const parsed = JSON.parse(jsonText);
          results.push({
            clusterId,
            suggestedName: parsed.nameRo || 'Documente',
            suggestedNameEn: parsed.nameEn || 'Documents',
            description: parsed.description || '',
          });
        } catch {
          // Keep original name if parsing fails
          console.warn(`[ClusterNaming] Failed to parse response for cluster ${clusterId}`);
        }
      }
    }

    return results;
  }

  /**
   * Update a cluster with naming result.
   */
  private async updateCluster(result: NamingResult): Promise<void> {
    await prisma.documentCluster.update({
      where: { id: result.clusterId },
      data: {
        suggestedName: result.suggestedName,
        suggestedNameEn: result.suggestedNameEn,
        description: result.description,
      },
    });
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const clusterNamingService = new ClusterNamingService();
