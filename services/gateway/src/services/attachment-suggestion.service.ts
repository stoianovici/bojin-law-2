// @ts-nocheck
/**
 * Attachment Suggestion Service
 * Story 5.3: AI-Powered Email Drafting - Tasks 8 & 9
 *
 * Suggests relevant case documents to attach to email drafts using:
 * - Semantic search with Voyage AI embeddings
 * - Document type matching based on email content
 * - Relevance scoring algorithm
 */

import { prisma } from '@legal-platform/database';
import { EmbeddingService } from './embedding.service';

// ============================================================================
// Types
// ============================================================================

export interface AttachmentSuggestion {
  documentId: string;
  title: string;
  reason: string;
  relevanceScore: number;
  documentType: string;
  lastModified: Date;
}

export interface Email {
  id: string;
  subject: string;
  bodyContent: string;
}

// Document type relevance matrix (Task 9)
const ATTACHMENT_RELEVANCE_MATRIX: Record<string, string[]> = {
  contract_discussion: ['Contract', 'Amendment', 'Addendum', 'Agreement'],
  court_filing: ['Motion', 'Brief', 'Pleading', 'Evidence', 'Cerere', 'Întâmpinare'],
  client_update: ['Report', 'Summary', 'Invoice', 'Raport'],
  evidence_request: ['Evidence', 'Document', 'Report', 'Dovadă'],
  settlement_discussion: ['Settlement', 'Proposal', 'Agreement', 'Tranzacție', 'Acord'],
  deadline_related: ['Court Filing', 'Response', 'Motion', 'Răspuns'],
  general: ['Letter', 'Memo', 'Document', 'Scrisoare'],
};

// Email intent keywords for classification
const EMAIL_INTENT_KEYWORDS: Record<string, string[]> = {
  contract_discussion: [
    'contract',
    'agreement',
    'clause',
    'terms',
    'conditions',
    'contractul',
    'acord',
    'clauză',
    'termeni',
  ],
  court_filing: [
    'court',
    'judge',
    'hearing',
    'motion',
    'filing',
    'instanță',
    'judecător',
    'ședință',
    'cerere',
    'dosar',
  ],
  client_update: ['update', 'status', 'progress', 'report', 'actualizare', 'raport', 'stadiu'],
  evidence_request: [
    'evidence',
    'document',
    'proof',
    'records',
    'probă',
    'dovadă',
    'înscrisuri',
    'documente',
  ],
  settlement_discussion: [
    'settlement',
    'negotiate',
    'offer',
    'proposal',
    'tranzacție',
    'negociere',
    'propunere',
    'acord',
  ],
  deadline_related: [
    'deadline',
    'due date',
    'urgent',
    'termen',
    'dată limită',
    'urgent',
    'scadență',
  ],
};

// Relevance scoring weights
const RELEVANCE_WEIGHTS = {
  contentSimilarity: 0.4,
  documentRecency: 0.2,
  documentTypeMatch: 0.2,
  userAccessFrequency: 0.2,
};

// Minimum relevance score threshold
const MIN_RELEVANCE_SCORE = 0.6;

// Maximum suggestions to return
const MAX_SUGGESTIONS = 5;

// ============================================================================
// Service
// ============================================================================

export class AttachmentSuggestionService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Suggest relevant documents to attach to an email draft
   */
  async suggestAttachments(
    email: Email,
    caseId: string,
    draftContent: string,
    firmId: string,
    userId: string
  ): Promise<AttachmentSuggestion[]> {
    try {
      // 1. Extract key terms from email and draft
      const combinedContent = `${email.subject} ${email.bodyContent} ${draftContent}`;
      const keyTerms = this.extractKeyTerms(combinedContent);

      // 2. Get case documents
      const caseDocuments = await this.getCaseDocuments(caseId, firmId);

      if (caseDocuments.length === 0) {
        return [];
      }

      // 3. Classify email intent for document type matching
      const emailIntent = this.classifyEmailIntent(combinedContent);
      const relevantDocTypes = ATTACHMENT_RELEVANCE_MATRIX[emailIntent] || ATTACHMENT_RELEVANCE_MATRIX.general;

      // 4. Generate embeddings for key terms
      const queryEmbedding = await this.embeddingService.generateEmbedding(keyTerms.join(' '));

      // 5. Find similar documents using pgvector
      const similarDocs = await this.findSimilarDocuments(
        queryEmbedding,
        caseDocuments.map((d) => d.id),
        firmId
      );

      // 6. Calculate relevance scores
      const scoredDocs = await this.scoreDocuments(
        caseDocuments,
        similarDocs,
        relevantDocTypes,
        userId
      );

      // 7. Filter and sort by relevance
      const suggestions = scoredDocs
        .filter((d) => d.score > MIN_RELEVANCE_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SUGGESTIONS)
        .map((d) => ({
          documentId: d.document.id,
          title: d.document.fileName,
          reason: this.generateReason(d, emailIntent),
          relevanceScore: d.score,
          documentType: d.document.fileType,
          lastModified: d.document.updatedAt,
        }));

      return suggestions;
    } catch (error) {
      console.error('Failed to suggest attachments:', error);
      return [];
    }
  }

  /**
   * Extract key terms from content
   */
  private extractKeyTerms(content: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'shall',
      'can',
      'may',
      'might',
      'must',
      'of',
      'in',
      'to',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'and',
      'or',
      'but',
      'not',
      'this',
      'that',
      'these',
      'those',
      'it',
      'its',
      // Romanian stop words
      'și',
      'la',
      'în',
      'de',
      'pe',
      'cu',
      'pentru',
      'din',
      'ce',
      'care',
      'este',
      'sunt',
      'a',
      'o',
      'un',
      'să',
      'nu',
      'mai',
      'ca',
    ]);

    const words = content
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u024F]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Get unique terms
    return [...new Set(words)].slice(0, 50);
  }

  /**
   * Get documents linked to a case
   */
  private async getCaseDocuments(caseId: string, firmId: string) {
    const caseDocuments = await prisma.caseDocument.findMany({
      where: { caseId, firmId },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            updatedAt: true,
            metadataEmbedding: true,
          },
        },
      },
    });

    return caseDocuments.map((cd) => cd.document);
  }

  /**
   * Classify email intent based on content
   * Task 9: Document Type Matching
   */
  private classifyEmailIntent(content: string): string {
    const contentLower = content.toLowerCase();
    const intentScores: Record<string, number> = {};

    for (const [intent, keywords] of Object.entries(EMAIL_INTENT_KEYWORDS)) {
      intentScores[intent] = keywords.reduce((score, keyword) => {
        const matches = contentLower.split(keyword.toLowerCase()).length - 1;
        return score + matches;
      }, 0);
    }

    // Find the intent with highest score
    let maxIntent = 'general';
    let maxScore = 0;

    for (const [intent, score] of Object.entries(intentScores)) {
      if (score > maxScore) {
        maxScore = score;
        maxIntent = intent;
      }
    }

    return maxIntent;
  }

  /**
   * Find similar documents using vector search
   */
  private async findSimilarDocuments(
    queryEmbedding: number[],
    documentIds: string[],
    firmId: string
  ): Promise<Map<string, number>> {
    if (documentIds.length === 0) {
      return new Map();
    }

    // Use pgvector to find similar documents
    const results = await prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
      SELECT
        d.id,
        1 - (d.metadata_embedding <=> ${queryEmbedding}::vector) as similarity
      FROM documents d
      WHERE d.id = ANY(${documentIds})
        AND d.firm_id = ${firmId}
        AND d.metadata_embedding IS NOT NULL
      ORDER BY d.metadata_embedding <=> ${queryEmbedding}::vector
      LIMIT 20
    `;

    return new Map(results.map((r) => [r.id, r.similarity]));
  }

  /**
   * Calculate comprehensive relevance scores
   */
  private async scoreDocuments(
    documents: Array<{
      id: string;
      fileName: string;
      fileType: string;
      updatedAt: Date;
    }>,
    similarities: Map<string, number>,
    relevantDocTypes: string[],
    userId: string
  ): Promise<Array<{ document: typeof documents[0]; score: number }>> {
    // Get user access frequency (simplified - in production would use actual access logs)
    const accessFrequency = await this.getAccessFrequency(
      documents.map((d) => d.id),
      userId
    );

    return documents.map((doc) => {
      const contentSimilarity = similarities.get(doc.id) || 0;
      const recencyScore = this.getRecencyScore(doc.updatedAt);
      const typeMatchScore = this.getTypeMatchScore(doc.fileType, relevantDocTypes);
      const frequencyScore = accessFrequency.get(doc.id) || 0;

      const score =
        contentSimilarity * RELEVANCE_WEIGHTS.contentSimilarity +
        recencyScore * RELEVANCE_WEIGHTS.documentRecency +
        typeMatchScore * RELEVANCE_WEIGHTS.documentTypeMatch +
        frequencyScore * RELEVANCE_WEIGHTS.userAccessFrequency;

      return { document: doc, score };
    });
  }

  /**
   * Calculate recency score (0-1)
   */
  private getRecencyScore(updatedAt: Date): number {
    const ageInDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays < 7) return 1.0;
    if (ageInDays < 30) return 0.8;
    if (ageInDays < 90) return 0.6;
    if (ageInDays < 180) return 0.4;
    if (ageInDays < 365) return 0.2;
    return 0.1;
  }

  /**
   * Calculate document type match score (0-1)
   * Task 9: Document Type Matching
   */
  private getTypeMatchScore(fileType: string, relevantTypes: string[]): number {
    const fileTypeLower = fileType.toLowerCase();

    for (const type of relevantTypes) {
      if (fileTypeLower.includes(type.toLowerCase())) {
        return 1.0;
      }
    }

    // Partial match for common document types
    const commonTypes = ['pdf', 'doc', 'docx'];
    if (commonTypes.some((t) => fileTypeLower.includes(t))) {
      return 0.5;
    }

    return 0.2;
  }

  /**
   * Get user access frequency for documents (simplified)
   */
  private async getAccessFrequency(
    documentIds: string[],
    userId: string
  ): Promise<Map<string, number>> {
    // In production, would query document access logs
    // For now, return a default score
    return new Map(documentIds.map((id) => [id, 0.5]));
  }

  /**
   * Generate human-readable reason for suggestion
   */
  private generateReason(
    scoredDoc: { document: { fileName: string; fileType: string }; score: number },
    intent: string
  ): string {
    const { document, score } = scoredDoc;

    if (score > 0.8) {
      return `Highly relevant document matching the email discussion about ${intent.replace('_', ' ')}.`;
    }

    if (intent === 'contract_discussion') {
      return `Contract document that may be referenced in this discussion.`;
    }

    if (intent === 'court_filing') {
      return `Court-related document that may need to be attached for reference.`;
    }

    if (intent === 'evidence_request') {
      return `Supporting document that may serve as evidence.`;
    }

    if (intent === 'settlement_discussion') {
      return `Settlement-related document relevant to negotiations.`;
    }

    return `Document "${document.fileName}" may be relevant to this correspondence.`;
  }
}

// Export singleton instance
export const attachmentSuggestionService = new AttachmentSuggestionService();
