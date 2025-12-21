/**
 * Document Intent Handler
 * OPS-075: Document Intent Handler
 *
 * Handles document search, summarization, listing, and generation intents.
 * Uses SearchService for finding documents and DocumentGenerationService for creation.
 */

import { prisma } from '@legal-platform/database';
import { AIOperationType } from '@legal-platform/types';
import { searchService, SearchMode } from '../search.service';
import { documentGenerationService, DocumentType } from '../document-generation.service';
import { aiService } from '../ai.service';
import type { AssistantContext, UserContext, HandlerResult, IntentHandler } from './types';

// ============================================================================
// Handler-specific Types
// ============================================================================

export interface DocumentHandlerParams {
  // For FindDocument
  query?: string;
  documentType?: string; // contract, cerere, sentinta, etc.

  // For SummarizeDocument
  documentId?: string;

  // For GenerateDocument
  templateType?: DocumentType;
  instructions?: string;
}

// Romanian document type mappings
const DOCUMENT_TYPE_MAPPINGS: Record<string, string[]> = {
  contract: ['contract', 'acord', 'convenție'],
  cerere: ['cerere', 'motion', 'request'],
  sentinta: ['sentință', 'hotărâre', 'decizie'],
  scrisoare: ['scrisoare', 'letter', 'notificare'],
  memoriu: ['memoriu', 'memo', 'notă'],
  intampinare: ['întâmpinare', 'pleading', 'răspuns'],
};

// ============================================================================
// Handler
// ============================================================================

export class DocumentIntentHandler implements IntentHandler {
  readonly name = 'DocumentIntentHandler';

  /**
   * Handle document search intent using hybrid search.
   */
  async handleFindDocument(
    params: DocumentHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const searchQuery = params.query || params.documentType || '';

    if (!searchQuery) {
      return {
        success: false,
        message: 'Te rog specifică ce document cauți.',
      };
    }

    // Build search filters
    const filters: { caseIds?: string[]; documentTypes?: string[] } = {};

    if (context.currentCaseId) {
      filters.caseIds = [context.currentCaseId];
    }

    // Map document type to search terms if provided
    if (params.documentType) {
      const mappedTypes = this.getMappedDocumentTypes(params.documentType);
      if (mappedTypes.length > 0) {
        filters.documentTypes = mappedTypes;
      }
    }

    const searchResponse = await searchService.search(
      searchQuery,
      userContext.firmId,
      SearchMode.HYBRID,
      filters,
      5, // limit
      0 // offset
    );

    // Filter to only document results
    const documents = searchResponse.results.filter((r) => r.type === 'document');

    if (documents.length === 0) {
      const contextMsg = context.currentCaseId ? ' în acest dosar' : '';
      return {
        success: true,
        message: `Nu am găsit documente care să corespundă căutării "${searchQuery}"${contextMsg}.`,
      };
    }

    const docList = documents
      .map((d) => {
        if (d.type === 'document') {
          return `• ${d.fileName} (scor: ${Math.round(d.score * 100)}%)`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      data: documents,
      message: `Am găsit ${documents.length} documente:\n${docList}\n\nDoriți să deschid unul dintre ele?`,
    };
  }

  /**
   * Handle document summarization intent.
   * Uses AI service to generate a summary of the document content.
   */
  async handleSummarizeDocument(
    params: DocumentHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const documentId = params.documentId || context.currentDocumentId;

    if (!documentId) {
      return {
        success: false,
        message: 'Selectați documentul pe care doriți să-l rezumați.',
      };
    }

    // Get document with content
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        metadata: true,
        firmId: true,
        storagePath: true,
      },
    });

    if (!document) {
      return {
        success: false,
        message: 'Documentul nu a fost găsit.',
      };
    }

    // Verify firm access
    if (document.firmId !== userContext.firmId) {
      return {
        success: false,
        message: 'Nu aveți acces la acest document.',
      };
    }

    // Extract text content from metadata if available, otherwise use file info
    const metadata = document.metadata as Record<string, unknown> | null;
    const textContent = metadata?.extractedText as string | undefined;

    if (!textContent) {
      return {
        success: false,
        message: `Documentul "${document.fileName}" nu are conținut text extractabil. Procesarea documentului poate să nu fie completă.`,
      };
    }

    // Generate summary using AI service
    const summaryPrompt = `
Rezumă următorul document juridic în limba română, evidențiind:
1. Tipul documentului
2. Părțile implicate (dacă există)
3. Obiectul principal
4. Obligațiile sau drepturile cheie
5. Termene importante (dacă există)

Fii concis dar cuprinzător. Folosește bullet points unde este potrivit.

Document:
${textContent.substring(0, 10000)}
    `.trim();

    const response = await aiService.generate({
      prompt: summaryPrompt,
      systemPrompt:
        'Ești un avocat cu experiență care analizează documente juridice. Răspunzi întotdeauna în română.',
      operationType: AIOperationType.TextGeneration,
      firmId: userContext.firmId,
      userId: userContext.userId,
      maxTokens: 1000,
      temperature: 0.3,
    });

    return {
      success: true,
      data: { documentId, summary: response.content },
      message: `**Rezumat: ${document.fileName}**\n\n${response.content}`,
    };
  }

  /**
   * Handle document generation intent.
   * Returns a proposed action for user confirmation.
   */
  async handleGenerateDocument(
    params: DocumentHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    if (!params.templateType) {
      return {
        success: false,
        message:
          'Specificați tipul documentului: contract, cerere, scrisoare, notă, sau întâmpinare.',
      };
    }

    // Validate template type
    const validTypes: DocumentType[] = [
      'Contract',
      'Motion',
      'Letter',
      'Memo',
      'Pleading',
      'Other',
    ];
    if (!validTypes.includes(params.templateType)) {
      return {
        success: false,
        message: `Tip de document nerecunoscut. Tipuri disponibile: ${validTypes.join(', ')}.`,
      };
    }

    // Get case context if available
    let caseContext: {
      title: string;
      caseNumber: string | null;
      clientName: string | null;
      actors: Array<{ role: string; name: string }>;
    } | null = null;

    if (context.currentCaseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: context.currentCaseId },
        include: {
          client: { select: { name: true } },
          actors: { select: { name: true, role: true } },
        },
      });

      if (caseData) {
        caseContext = {
          title: caseData.title,
          caseNumber: caseData.caseNumber,
          clientName: caseData.client?.name || null,
          actors: caseData.actors.map((a) => ({
            role: a.role,
            name: a.name,
          })),
        };
      }
    }

    // Build preview
    const preview = {
      tip: this.translateDocType(params.templateType),
      dosar: caseContext?.title || 'Fără dosar',
      client: caseContext?.clientName || 'Nespecificat',
    };

    return {
      success: true,
      proposedAction: {
        type: 'GenerateDocument',
        displayText: `Generează ${this.translateDocType(params.templateType)}`,
        payload: {
          templateType: params.templateType,
          caseId: context.currentCaseId,
          instructions: params.instructions,
          caseContext,
        },
        requiresConfirmation: true,
        confirmationPrompt: 'Generez acest document?',
        entityPreview: preview,
      },
    };
  }

  /**
   * Handle list documents intent for current case.
   */
  async handleListDocuments(
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    if (!context.currentCaseId) {
      return {
        success: false,
        message: 'Deschideți un dosar pentru a vedea documentele.',
      };
    }

    // Get documents linked to case
    const caseDocuments = await prisma.caseDocument.findMany({
      where: { caseId: context.currentCaseId },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            status: true,
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
      take: 10,
    });

    if (caseDocuments.length === 0) {
      return {
        success: true,
        message: 'Nu există documente în acest dosar.',
      };
    }

    // Format document list
    const docList = caseDocuments
      .map((cd) => {
        const doc = cd.document;
        const sizeStr = this.formatFileSize(doc.fileSize);
        const dateStr = this.formatDate(cd.linkedAt);
        return `• ${doc.fileName} (${sizeStr}, ${dateStr})`;
      })
      .join('\n');

    return {
      success: true,
      data: caseDocuments.map((cd) => ({
        id: cd.document.id,
        fileName: cd.document.fileName,
        fileType: cd.document.fileType,
        addedAt: cd.linkedAt.toISOString(),
      })),
      message: `**Documente în dosar (${caseDocuments.length}):**\n${docList}`,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map Romanian document type input to search terms
   */
  private getMappedDocumentTypes(input: string): string[] {
    const normalizedInput = input.toLowerCase().trim();

    for (const [, terms] of Object.entries(DOCUMENT_TYPE_MAPPINGS)) {
      if (terms.some((term) => normalizedInput.includes(term))) {
        return terms;
      }
    }

    // If no mapping found, return the original input
    return [normalizedInput];
  }

  /**
   * Translate document type to Romanian
   */
  private translateDocType(type: DocumentType): string {
    const translations: Record<DocumentType, string> = {
      Contract: 'Contract',
      Motion: 'Cerere',
      Letter: 'Scrisoare',
      Memo: 'Notă internă',
      Pleading: 'Întâmpinare',
      Other: 'Document',
    };
    return translations[type] || type;
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Format date for Romanian display
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'astăzi';
    if (diffDays === 1) return 'ieri';
    if (diffDays < 7) return `acum ${diffDays} zile`;

    return date.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
    });
  }
}

// Export singleton instance
export const documentIntentHandler = new DocumentIntentHandler();
