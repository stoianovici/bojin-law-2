/**
 * Document Summary Aggregation Service
 * OPS-258: Get aggregated document summaries for a case
 *
 * Provides pre-aggregated document summaries for AI context.
 * Ranks documents by importance and recency, generates summaries via Haiku.
 */

import { prisma } from '@legal-platform/database';
import { aiClient, getModelForFeature } from './ai-client.service';

// ============================================================================
// Types
// ============================================================================

export interface DocumentSummary {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  score: number;
  summary: string;
  updatedAt: Date;
}

export interface DocumentForRanking {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

// Document type importance scores
const TYPE_SCORES: Record<string, number> = {
  // High priority types
  CONTRACT: 30,
  COURT_FILING: 30,
  LEGAL_BRIEF: 25,
  JUDGMENT: 25,
  MOTION: 25,
  // Medium priority
  CORRESPONDENCE: 15,
  AGREEMENT: 20,
  MEMO: 15,
  // Lower priority
  INVOICE: 10,
  OTHER: 5,
};

// Map file extensions to document types for heuristic classification
const FILE_TYPE_TO_DOC_TYPE: Record<string, string> = {
  '.docx': 'CORRESPONDENCE',
  '.doc': 'CORRESPONDENCE',
  '.pdf': 'LEGAL_BRIEF',
  '.xlsx': 'OTHER',
  '.xls': 'OTHER',
  '.pptx': 'OTHER',
  '.ppt': 'OTHER',
  '.txt': 'OTHER',
  '.rtf': 'CORRESPONDENCE',
};

// Maximum documents to return
const MAX_DOCUMENTS = 10;

// Maximum tokens for summary output (~500 tokens for 10 docs)
const MAX_SUMMARY_TOKENS = 150;

// ============================================================================
// Ranking Logic
// ============================================================================

/**
 * Calculate importance score for a document
 * Score range: 0-90 points
 */
function calculateScore(doc: DocumentForRanking): number {
  let score = 0;

  // Recency (0-40 points)
  // Documents updated recently score higher
  const daysSinceUpdate = Math.floor(
    (Date.now() - doc.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  score += Math.max(0, 40 - daysSinceUpdate);

  // Type importance (0-30 points)
  // Check metadata for document type first, then infer from file extension
  const docType = inferDocumentType(doc);
  score += TYPE_SCORES[docType] ?? 5;

  // Status (0-20 points)
  // Final documents are most relevant, ready for review are next, drafts least
  if (doc.status === 'FINAL') {
    score += 20;
  } else if (doc.status === 'READY_FOR_REVIEW') {
    score += 10;
  } else if (doc.status === 'DRAFT') {
    score += 5;
  }

  return score;
}

/**
 * Infer document type from metadata or file extension
 */
function inferDocumentType(doc: DocumentForRanking): string {
  // Check metadata for explicit type
  const metadata = doc.metadata || {};
  if (typeof metadata === 'object' && 'documentType' in metadata) {
    const metaType = String((metadata as { documentType?: string }).documentType).toUpperCase();
    if (TYPE_SCORES[metaType] !== undefined) {
      return metaType;
    }
  }

  // Infer from file name patterns
  const fileName = doc.fileName.toLowerCase();
  if (fileName.includes('contract') || fileName.includes('acord')) {
    return 'CONTRACT';
  }
  if (
    fileName.includes('sentinta') ||
    fileName.includes('hotarare') ||
    fileName.includes('decizie')
  ) {
    return 'JUDGMENT';
  }
  if (fileName.includes('cerere') || fileName.includes('plangere')) {
    return 'MOTION';
  }
  if (fileName.includes('factura') || fileName.includes('invoice')) {
    return 'INVOICE';
  }

  // Fall back to file extension
  const ext = doc.fileType?.toLowerCase() || '';
  return FILE_TYPE_TO_DOC_TYPE[ext] || 'OTHER';
}

/**
 * Rank documents by importance and return top N
 */
function rankDocuments(docs: DocumentForRanking[]): Array<DocumentForRanking & { score: number }> {
  return docs
    .map((doc) => ({
      ...doc,
      score: calculateScore(doc),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DOCUMENTS);
}

// ============================================================================
// Service Class
// ============================================================================

export class DocumentSummaryService {
  /**
   * Get aggregated document summaries for a case
   * Returns top 10 most relevant documents with summaries
   * Target: ~500 tokens total
   */
  async getForCase(caseId: string, firmId: string): Promise<DocumentSummary[]> {
    // Get documents linked to this case (only public documents)
    const caseDocuments = await prisma.caseDocument.findMany({
      where: {
        caseId,
        firmId,
        document: {
          isPrivate: false, // Exclude private documents from AI context
        },
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            status: true,
            updatedAt: true,
            metadata: true,
          },
        },
      },
    });

    // No documents for this case
    if (caseDocuments.length === 0) {
      return [];
    }

    // Extract documents and rank them
    const documents: DocumentForRanking[] = caseDocuments.map((cd) => ({
      id: cd.document.id,
      fileName: cd.document.fileName,
      fileType: cd.document.fileType,
      fileSize: cd.document.fileSize,
      status: cd.document.status,
      updatedAt: cd.document.updatedAt,
      metadata: (cd.document.metadata as Record<string, unknown>) || {},
    }));

    const rankedDocs = rankDocuments(documents);

    // Generate summaries for top documents
    const summaries: DocumentSummary[] = [];

    for (const doc of rankedDocs) {
      const summary = await this.generateSummary(doc.id, firmId);
      summaries.push({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        status: doc.status,
        score: doc.score,
        summary,
        updatedAt: doc.updatedAt,
      });
    }

    return summaries;
  }

  /**
   * Generate a brief summary for a document
   * Uses configured model (defaults to Haiku for cost efficiency)
   * Returns a 2-3 sentence summary in Romanian
   *
   * Priority: extractedContent > metadata > basic summary from filename
   */
  async generateSummary(documentId: string, firmId: string): Promise<string> {
    // Get configured model for document_summary feature
    const model = await getModelForFeature(firmId, 'document_summary');

    // Get document details including extracted content
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        metadata: true,
        status: true,
        extractedContent: true,
        extractionStatus: true,
      },
    });

    if (!document) {
      return 'Document nu a fost găsit.';
    }

    // Build a description from available metadata
    const metadata = (document.metadata as Record<string, unknown>) || {};
    const description = metadata.description ? String(metadata.description) : '';
    const tags = Array.isArray(metadata.tags) ? (metadata.tags as string[]).join(', ') : '';

    // Priority 1: Use extracted content if available (COMPLETED status)
    if (document.extractionStatus === 'COMPLETED' && document.extractedContent) {
      try {
        // Use first 4000 chars of extracted content for summary
        const contentSnippet = document.extractedContent.slice(0, 4000);

        const prompt = `Rezumă acest document juridic în 2-3 propoziții în limba română bazându-te pe conținutul extras.

Nume fișier: ${document.fileName}
Tip: ${document.fileType}
Stare: ${document.status}

Conținut document:
${contentSnippet}

Răspunde doar cu rezumatul, fără alte explicații.`;

        const response = await aiClient.complete(
          prompt,
          {
            feature: 'document_summary',
            firmId,
            entityType: 'document',
            entityId: documentId,
          },
          {
            model,
            maxTokens: MAX_SUMMARY_TOKENS,
            temperature: 0.3,
          }
        );

        return response.content;
      } catch (error) {
        console.error('[DocumentSummary] Failed to generate AI summary from content:', error);
        // Fall through to metadata-based summary
      }
    }

    // Priority 2: Use metadata if available
    if (description || tags) {
      // Generate AI summary from metadata
      try {
        const prompt = `Rezumă acest document juridic în 2-3 propoziții în limba română.

Nume fișier: ${document.fileName}
Tip: ${document.fileType}
Stare: ${document.status}
${description ? `Descriere: ${description}` : ''}
${tags ? `Etichete: ${tags}` : ''}

Răspunde doar cu rezumatul, fără alte explicații.`;

        const response = await aiClient.complete(
          prompt,
          {
            feature: 'document_summary',
            firmId,
            entityType: 'document',
            entityId: documentId,
          },
          {
            model,
            maxTokens: MAX_SUMMARY_TOKENS,
            temperature: 0.3,
          }
        );

        return response.content;
      } catch (error) {
        console.error('[DocumentSummary] Failed to generate AI summary:', error);
        // Fall back to basic summary
        return this.buildBasicSummary(
          document.fileName,
          document.fileType,
          document.status,
          description
        );
      }
    }

    // Priority 3: No extracted content or metadata - return basic summary from file name
    return this.buildBasicSummary(document.fileName, document.fileType, document.status, '');
  }

  /**
   * Build a basic summary without AI when metadata is limited
   */
  private buildBasicSummary(
    fileName: string,
    fileType: string,
    status: string,
    description: string
  ): string {
    const statusLabels: Record<string, string> = {
      DRAFT: 'draft',
      IN_REVIEW: 'în revizuire',
      FINAL: 'finalizat',
      CHANGES_REQUESTED: 'modificări solicitate',
      PENDING: 'în așteptare',
      ARCHIVED: 'arhivat',
    };

    const statusLabel = statusLabels[status] || status;
    const cleanName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

    if (description) {
      return `${cleanName} (${fileType}, ${statusLabel}): ${description}`;
    }

    return `Document ${cleanName} (${fileType}), stare: ${statusLabel}.`;
  }

  /**
   * Format document summaries for AI context injection
   * Returns a formatted string suitable for system prompts
   * Target: ~500 tokens
   */
  formatForContext(summaries: DocumentSummary[]): string {
    if (summaries.length === 0) {
      return 'Nu există documente asociate acestui dosar.';
    }

    const lines = summaries.map((doc, i) => {
      const priority = doc.score >= 60 ? '★' : doc.score >= 40 ? '◆' : '◇';
      return `${priority} ${i + 1}. ${doc.fileName} (${doc.status}): ${doc.summary}`;
    });

    return `Documente cheie (${summaries.length}):\n${lines.join('\n')}`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const documentSummaryService = new DocumentSummaryService();
