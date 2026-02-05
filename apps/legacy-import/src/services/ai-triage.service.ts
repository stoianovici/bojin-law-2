/**
 * AI Triage Service
 * Classifies extracted documents into categories for template candidacy.
 *
 * Uses Anthropic Batch API with Claude Haiku for cost-effective classification.
 * Classifies documents as: FirmDrafted | ThirdParty | Irrelevant | CourtDoc | Uncertain
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { TriageStatus } from '@/generated/prisma';

// ============================================================================
// Types
// ============================================================================

export interface TriageResult {
  documentId: string;
  status: TriageStatus;
  confidence: number;
  reason: string;
  suggestedDocType: string | null;
}

export interface TriageStats {
  total: number;
  firmDrafted: number;
  thirdParty: number;
  irrelevant: number;
  courtDoc: number;
  uncertain: number;
  errors: number;
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
const BATCH_SIZE = 10_000; // Anthropic batch limit

const TRIAGE_SYSTEM_PROMPT = `You are a legal document classifier for a Romanian law firm.
Classify documents into one of these categories based on their content and context:

- FirmDrafted: Documents created/drafted by this law firm (contracts, legal opinions, court submissions, letters to clients)
- ThirdParty: Documents received from external parties (opposing counsel, government agencies, clients' documents)
- Irrelevant: Non-legal content (newsletters, spam, internal admin, personal emails)
- CourtDoc: Court-issued documents (decisions, rulings, summons, notifications from courts)
- Uncertain: Cannot determine origin with confidence

Consider these signals:
- Sent emails with attachments → likely FirmDrafted
- Received emails → consider the attachment source
- Professional letterhead or signature blocks → indicates origin
- Document type (contract, decision, notification) → helps classification
- Folder path containing "Trimis" or "Sent" → likely FirmDrafted

Respond in JSON format:
{
  "status": "FirmDrafted" | "ThirdParty" | "Irrelevant" | "CourtDoc" | "Uncertain",
  "confidence": 0.0-1.0,
  "reason": "Brief explanation in Romanian",
  "documentType": "Suggested document type in Romanian or null"
}`;

// ============================================================================
// Service
// ============================================================================

export class AITriageService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Triage all documents in a session using Anthropic Batch API.
   */
  async triageSession(sessionId: string): Promise<TriageStats> {
    // Get all documents that haven't been triaged yet and have extracted text
    // Note: empty string means extraction was attempted but failed
    const documents = await prisma.extractedDocument.findMany({
      where: {
        sessionId,
        triageStatus: null,
        extractedText: { not: '' },
        NOT: { extractedText: null },
      },
      select: {
        id: true,
        fileName: true,
        extractedText: true,
        folderPath: true,
        isSent: true,
        emailSubject: true,
        emailSender: true,
        emailReceiver: true,
      },
    });

    if (documents.length === 0) {
      return {
        total: 0,
        firmDrafted: 0,
        thirdParty: 0,
        irrelevant: 0,
        courtDoc: 0,
        uncertain: 0,
        errors: 0,
      };
    }

    console.log(`[AITriage] Processing ${documents.length} documents for session ${sessionId}`);

    // Build batch requests
    // custom_id must match pattern ^[a-zA-Z0-9_-]{1,64}$
    const requests: BatchRequest[] = documents.map((doc) => ({
      custom_id: `doc_${doc.id}`,
      params: {
        model: HAIKU_MODEL,
        max_tokens: 256,
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user' as const,
            content: this.buildTriagePrompt(doc),
          },
        ],
      },
    }));

    // Submit batch (split if needed)
    const results: TriageResult[] = [];
    for (let i = 0; i < requests.length; i += BATCH_SIZE) {
      const batch = requests.slice(i, i + BATCH_SIZE);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
    }

    // Update documents with triage results
    await this.updateDocuments(results);

    // Calculate stats
    const stats = this.calculateStats(results);

    // Update session with triage stats
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        triageStats: stats as any,
      },
    });

    // Log processing
    await prisma.aIProcessingLog.create({
      data: {
        sessionId,
        model: HAIKU_MODEL,
        tokensUsed: 0, // Will be updated from batch results
        costUSD: 0, // Batch API has 50% discount
        processingTimeMs: 0,
        metadata: {
          operation: 'triage',
          documentCount: documents.length,
          ...stats,
        } as object,
      },
    });

    return stats;
  }

  /**
   * Build the triage prompt for a document.
   */
  private buildTriagePrompt(doc: {
    fileName: string;
    extractedText: string | null;
    folderPath: string;
    isSent: boolean;
    emailSubject: string | null;
    emailSender: string | null;
    emailReceiver: string | null;
  }): string {
    const parts: string[] = [];

    // Email context
    if (doc.isSent) {
      parts.push('📤 SENT EMAIL');
    }
    if (doc.emailSubject) {
      parts.push(`Subject: ${doc.emailSubject}`);
    }
    if (doc.emailSender) {
      parts.push(`From: ${doc.emailSender}`);
    }
    if (doc.emailReceiver) {
      parts.push(`To: ${doc.emailReceiver}`);
    }

    // File context
    parts.push(`File: ${doc.fileName}`);
    parts.push(`Folder: ${doc.folderPath}`);

    // Document text (truncated)
    if (doc.extractedText) {
      const textPreview = doc.extractedText.substring(0, 3000);
      parts.push(`\n--- Document Content ---\n${textPreview}`);
      if (doc.extractedText.length > 3000) {
        parts.push('\n[...truncated...]');
      }
    }

    return parts.join('\n');
  }

  /**
   * Process a batch of triage requests.
   */
  private async processBatch(requests: BatchRequest[]): Promise<TriageResult[]> {
    console.log(`[AITriage] Submitting batch of ${requests.length} requests`);

    // Submit batch to Anthropic
    const batch = await this.anthropic.messages.batches.create({
      requests,
    });

    console.log(`[AITriage] Batch submitted: ${batch.id}`);

    // Wait for completion with polling
    let status = await this.anthropic.messages.batches.retrieve(batch.id);
    while (status.processing_status !== 'ended') {
      console.log(
        `[AITriage] Batch ${batch.id}: ${status.processing_status}, succeeded: ${status.request_counts.succeeded}/${requests.length}`
      );
      await this.sleep(30_000); // Poll every 30 seconds
      status = await this.anthropic.messages.batches.retrieve(batch.id);
    }

    console.log(
      `[AITriage] Batch completed: ${status.request_counts.succeeded} succeeded, ${status.request_counts.errored} errored`
    );

    // Retrieve results
    const results: TriageResult[] = [];
    const resultsStream = await this.anthropic.messages.batches.results(batch.id);

    for await (const result of resultsStream) {
      const documentId = result.custom_id.replace('doc_', '');

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
            // Try to find raw JSON object
            const objectMatch = textContent.match(/\{[\s\S]*\}/);
            if (objectMatch) {
              jsonText = objectMatch[0];
            }
          }

          const parsed = JSON.parse(jsonText);
          results.push({
            documentId,
            status: this.parseStatus(parsed.status),
            confidence: parsed.confidence || 0.5,
            reason: parsed.reason || '',
            suggestedDocType: parsed.documentType || null,
          });
        } catch {
          // Parsing error - mark as uncertain
          results.push({
            documentId,
            status: 'Uncertain',
            confidence: 0,
            reason: 'Failed to parse AI response',
            suggestedDocType: null,
          });
        }
      } else {
        // Error - mark as uncertain
        results.push({
          documentId,
          status: 'Uncertain',
          confidence: 0,
          reason: `Batch error: ${result.result.type}`,
          suggestedDocType: null,
        });
      }
    }

    return results;
  }

  /**
   * Parse status string to TriageStatus enum.
   */
  private parseStatus(status: string): TriageStatus {
    const statusMap: Record<string, TriageStatus> = {
      FirmDrafted: 'FirmDrafted',
      ThirdParty: 'ThirdParty',
      Irrelevant: 'Irrelevant',
      CourtDoc: 'CourtDoc',
      Uncertain: 'Uncertain',
    };
    return statusMap[status] || 'Uncertain';
  }

  /**
   * Update documents with triage results.
   */
  private async updateDocuments(results: TriageResult[]): Promise<void> {
    // Batch update in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < results.length; i += chunkSize) {
      const chunk = results.slice(i, i + chunkSize);
      await prisma.$transaction(
        chunk.map((result) =>
          prisma.extractedDocument.update({
            where: { id: result.documentId },
            data: {
              triageStatus: result.status,
              triageConfidence: result.confidence,
              triageReason: result.reason,
              suggestedDocType: result.suggestedDocType,
            },
          })
        )
      );
    }
  }

  /**
   * Calculate triage statistics from results.
   */
  private calculateStats(results: TriageResult[]): TriageStats {
    const stats: TriageStats = {
      total: results.length,
      firmDrafted: 0,
      thirdParty: 0,
      irrelevant: 0,
      courtDoc: 0,
      uncertain: 0,
      errors: 0,
    };

    for (const result of results) {
      switch (result.status) {
        case 'FirmDrafted':
          stats.firmDrafted++;
          break;
        case 'ThirdParty':
          stats.thirdParty++;
          break;
        case 'Irrelevant':
          stats.irrelevant++;
          break;
        case 'CourtDoc':
          stats.courtDoc++;
          break;
        case 'Uncertain':
          stats.uncertain++;
          break;
      }
      if (result.confidence === 0) {
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const aiTriageService = new AITriageService();
