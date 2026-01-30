/**
 * Document Summary Aggregation Service
 * OPS-258: Get aggregated document summaries for a case
 *
 * Provides pre-aggregated document summaries for AI context.
 * Ranks documents by importance and recency, generates summaries via Haiku.
 * Includes email attachments with full content extraction and OCR support.
 */

import { prisma } from '@legal-platform/database';
import { aiClient, getModelForFeature } from './ai-client.service';
import { extractContent, isSupportedFormat } from './content-extraction.service';
import { extractWithOCR, isImageFormat, isPdfFormat } from './ocr.service';
import logger from '../utils/logger';

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

// Maximum tokens for summary output
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
  // Email attachments (RECEIVED) get medium priority - they're confirmed documents
  if (doc.status === 'FINAL') {
    score += 20;
  } else if (doc.status === 'RECEIVED') {
    score += 15; // Email attachments are real documents, just not reviewed
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
 * Rank documents by importance (no limit - returns all documents sorted by score)
 */
function rankDocuments(docs: DocumentForRanking[]): Array<DocumentForRanking & { score: number }> {
  return docs
    .map((doc) => ({
      ...doc,
      score: calculateScore(doc),
    }))
    .sort((a, b) => b.score - a.score);
}

// ============================================================================
// Service Class
// ============================================================================

export class DocumentSummaryService {
  /**
   * Get aggregated document summaries for a case
   * Includes:
   * - Documents directly linked to the case (CaseDocument)
   * - Email attachments from emails linked to the case
   * Returns all documents sorted by importance score (no limit)
   */
  async getForCase(caseId: string, firmId: string): Promise<DocumentSummary[]> {
    // 1. Get documents directly linked to this case (only public documents)
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

    // 2. Get email attachments from emails linked to this case
    // These include attachments that may not have been "promoted" to CaseDocument yet
    const emailAttachments = await prisma.emailAttachment.findMany({
      where: {
        isPrivate: false, // Exclude private attachments
        irrelevant: false, // Exclude filtered/irrelevant attachments
        email: {
          OR: [
            { caseId }, // Direct case link
            { caseLinks: { some: { caseId } } }, // Via EmailCaseLink
          ],
        },
      },
      include: {
        email: {
          select: {
            receivedDateTime: true,
            subject: true,
          },
        },
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

    // Track document IDs we've already seen (to dedupe)
    const seenDocumentIds = new Set<string>();

    // Extract linked documents
    const documents: DocumentForRanking[] = caseDocuments.map((cd) => {
      seenDocumentIds.add(cd.document.id);
      return {
        id: cd.document.id,
        fileName: cd.document.fileName,
        fileType: cd.document.fileType,
        fileSize: cd.document.fileSize,
        status: cd.document.status,
        updatedAt: cd.document.updatedAt,
        metadata: (cd.document.metadata as Record<string, unknown>) || {},
      };
    });

    // Add email attachments (avoiding duplicates)
    for (const att of emailAttachments) {
      // If attachment has been promoted to a document
      if (att.document && att.documentId) {
        // Skip if we already have this document from CaseDocument
        if (seenDocumentIds.has(att.documentId)) {
          continue;
        }
        seenDocumentIds.add(att.documentId);
        documents.push({
          id: att.documentId,
          fileName: att.document.fileName,
          fileType: att.document.fileType,
          fileSize: att.document.fileSize,
          status: att.document.status,
          updatedAt: att.document.updatedAt,
          metadata: {
            ...((att.document.metadata as Record<string, unknown>) || {}),
            sourceType: 'EMAIL_ATTACHMENT',
            emailSubject: att.email.subject,
          },
        });
      } else {
        // Attachment not promoted - use attachment metadata directly
        // Use attachment ID prefixed to distinguish from document IDs
        const attachmentId = `attachment:${att.id}`;
        if (seenDocumentIds.has(attachmentId)) {
          continue;
        }
        seenDocumentIds.add(attachmentId);

        // Extract file extension from name
        const extMatch = att.name.match(/\.([^.]+)$/);
        const fileType = extMatch ? `.${extMatch[1].toLowerCase()}` : att.contentType;

        documents.push({
          id: attachmentId,
          fileName: att.name,
          fileType,
          fileSize: att.size,
          status: 'RECEIVED', // Email attachments are always "received"
          updatedAt: att.email.receivedDateTime,
          metadata: {
            sourceType: 'EMAIL_ATTACHMENT',
            contentType: att.contentType,
            emailSubject: att.email.subject,
            isUnpromoted: true, // Flag that this isn't a full Document yet
          },
        });
      }
    }

    // No documents for this case
    if (documents.length === 0) {
      return [];
    }

    const rankedDocs = rankDocuments(documents);

    // Generate summaries for all documents
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
   * Generate a brief summary for a document or unpromoted attachment
   * Uses configured model (defaults to Haiku for cost efficiency)
   * Returns a 2-3 sentence summary in Romanian
   *
   * Priority: extractedContent > metadata > basic summary from filename
   */
  async generateSummary(documentId: string, firmId: string): Promise<string> {
    // Handle unpromoted email attachments (prefixed with "attachment:")
    if (documentId.startsWith('attachment:')) {
      const attachmentId = documentId.replace('attachment:', '');
      return this.generateAttachmentSummary(attachmentId, firmId);
    }

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
        extractionError: true,
      },
    });

    if (!document) {
      return 'Document nu a fost găsit.';
    }

    // Build a description from available metadata
    const metadata = (document.metadata as Record<string, unknown>) || {};
    const description = metadata.description ? String(metadata.description) : '';
    const tags = Array.isArray(metadata.tags) ? (metadata.tags as string[]).join(', ') : '';

    // Handle FAILED or UNSUPPORTED extraction - provide clear indicator
    if (document.extractionStatus === 'FAILED' || document.extractionStatus === 'UNSUPPORTED') {
      const isScanned =
        document.extractionError?.includes('scanned') ||
        document.extractionError?.includes('too short');

      // If we have metadata/description, still try to use that
      if (description || tags) {
        return this.buildBasicSummary(
          document.fileName,
          document.fileType,
          document.status,
          description
        );
      }

      // Otherwise return a clear "scan" indicator
      if (isScanned) {
        return `📷 Document scanat - conținutul nu poate fi extras automat.`;
      }

      return this.buildBasicSummary(document.fileName, document.fileType, document.status, '');
    }

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

        // Check if AI returned a "can't summarize" response
        const aiResponse = response.content;
        if (this.isAiErrorResponse(aiResponse)) {
          console.warn('[DocumentSummary] AI returned error response, falling back', {
            documentId,
            preview: aiResponse.substring(0, 100),
          });
          // Fall through to metadata/basic summary
        } else {
          return aiResponse;
        }
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
   * Generate a summary for an unpromoted email attachment.
   * Fetches the file, extracts content (with OCR fallback), and generates AI summary.
   */
  private async generateAttachmentSummary(attachmentId: string, firmId: string): Promise<string> {
    const attachment = await prisma.emailAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        email: {
          select: {
            subject: true,
            from: true,
            receivedDateTime: true,
            firmId: true,
          },
        },
      },
    });

    if (!attachment) {
      return 'Atașament nu a fost găsit.';
    }

    // Build context for fallback summary
    const fromObj = attachment.email.from as { name?: string; address?: string } | null;
    const senderName = fromObj?.name || fromObj?.address || 'expeditor necunoscut';
    const fileSizeKB = Math.round(attachment.size / 1024);
    const fileSizeStr =
      fileSizeKB > 1024 ? `${(fileSizeKB / 1024).toFixed(1)} MB` : `${fileSizeKB} KB`;
    const cleanName = attachment.name.replace(/\.[^/.]+$/, '');
    const dateStr = attachment.email.receivedDateTime.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const emailContext = `din email "${attachment.email.subject}" de la ${senderName}`;

    // If no storage URL, return metadata-only summary
    if (!attachment.storageUrl) {
      logger.warn('[DocumentSummary] Attachment has no storageUrl', { attachmentId });
      return `📎 Atașament "${cleanName}" (${fileSizeStr}) primit pe ${dateStr} ${emailContext}.`;
    }

    // Check if format is extractable
    const mimeType = attachment.contentType;
    const isImage = isImageFormat(mimeType);
    const isPdf = isPdfFormat(mimeType);
    const isStandardSupported = isSupportedFormat(mimeType);

    if (!isStandardSupported && !isImage) {
      // Unsupported format - return metadata summary
      return `📎 Atașament "${cleanName}" (${fileSizeStr}, ${mimeType}) primit pe ${dateStr} ${emailContext}. Format nu suportă extragere text.`;
    }

    try {
      // Fetch file from storage
      logger.info('[DocumentSummary] Fetching attachment for extraction', {
        attachmentId,
        name: attachment.name,
        contentType: mimeType,
        size: attachment.size,
      });

      const response = await fetch(attachment.storageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch attachment: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      let extractedContent: string = '';

      // Extraction strategy: images → OCR, PDFs → try standard then OCR, others → standard
      if (isImage) {
        // Images go directly to OCR
        const ocrResult = await extractWithOCR(fileBuffer, mimeType, attachment.name, {
          feature: 'document_summary',
          firmId,
          entityType: 'email_attachment',
          entityId: attachmentId,
        });

        if (ocrResult.success) {
          extractedContent = ocrResult.content;
        } else {
          logger.warn('[DocumentSummary] OCR failed for image attachment', {
            attachmentId,
            error: ocrResult.error,
          });
          return `📷 Atașament imagine "${cleanName}" (${fileSizeStr}) primit pe ${dateStr} ${emailContext}. OCR nu a putut extrage text.`;
        }
      } else {
        // Try standard extraction first
        const result = await extractContent(fileBuffer, mimeType, attachment.name);

        if (result.success) {
          extractedContent = result.content;
        } else if (
          isPdf &&
          (result.error?.includes('too short') || result.error?.includes('page markers'))
        ) {
          // PDF likely scanned - try OCR
          logger.info('[DocumentSummary] Standard extraction failed, trying OCR', {
            attachmentId,
            originalError: result.error,
          });

          const ocrResult = await extractWithOCR(fileBuffer, mimeType, attachment.name, {
            feature: 'document_summary',
            firmId,
            entityType: 'email_attachment',
            entityId: attachmentId,
          });

          if (ocrResult.success) {
            extractedContent = ocrResult.content;
          } else {
            logger.warn('[DocumentSummary] OCR fallback also failed', {
              attachmentId,
              ocrError: ocrResult.error,
            });
            return `📷 Atașament scanat "${cleanName}" (${fileSizeStr}) primit pe ${dateStr} ${emailContext}. Conținutul nu poate fi extras.`;
          }
        } else {
          // Standard extraction failed for other reasons
          logger.warn('[DocumentSummary] Extraction failed for attachment', {
            attachmentId,
            error: result.error,
          });
          return `📎 Atașament "${cleanName}" (${fileSizeStr}) primit pe ${dateStr} ${emailContext}. Extragere eșuată: ${result.error}`;
        }
      }

      // Generate AI summary from extracted content
      if (extractedContent && extractedContent.length > 50) {
        const model = await getModelForFeature(firmId, 'document_summary');
        const contentSnippet = extractedContent.slice(0, 4000);

        const prompt = `Rezumă acest document juridic (atașament email) în 2-3 propoziții în limba română.

Nume fișier: ${attachment.name}
Email subiect: ${attachment.email.subject}
De la: ${senderName}
Data: ${dateStr}

Conținut document:
${contentSnippet}

Răspunde doar cu rezumatul, fără alte explicații.`;

        try {
          const response = await aiClient.complete(
            prompt,
            {
              feature: 'document_summary',
              firmId,
              entityType: 'email_attachment',
              entityId: attachmentId,
            },
            {
              model,
              maxTokens: MAX_SUMMARY_TOKENS,
              temperature: 0.3,
            }
          );

          // Check for AI error response
          if (!this.isAiErrorResponse(response.content)) {
            return response.content;
          }
        } catch (error) {
          logger.error('[DocumentSummary] AI summary generation failed', {
            attachmentId,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      // Fallback: return first 200 chars of extracted content
      if (extractedContent) {
        const preview = extractedContent.slice(0, 200).trim();
        return `📎 "${cleanName}" (${emailContext}): ${preview}${extractedContent.length > 200 ? '...' : ''}`;
      }

      // Last resort: metadata only
      return `📎 Atașament "${cleanName}" (${fileSizeStr}) primit pe ${dateStr} ${emailContext}.`;
    } catch (error) {
      logger.error('[DocumentSummary] Attachment extraction failed', {
        attachmentId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Return metadata summary on error
      return `📎 Atașament "${cleanName}" (${fileSizeStr}) primit pe ${dateStr} ${emailContext}. Eroare la procesare.`;
    }
  }

  /**
   * Check if AI response is an error/can't summarize message
   */
  private isAiErrorResponse(response: string): boolean {
    const errorPatterns = [
      'nu pot rezuma',
      'nu pot furniza',
      'nu am acces',
      'nu conține text',
      'conținut gol',
      'pagini goale',
      'fără conținut',
    ];

    const lowerResponse = response.toLowerCase();
    return errorPatterns.some((pattern) => lowerResponse.includes(pattern));
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
      RECEIVED: 'primit prin email',
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
