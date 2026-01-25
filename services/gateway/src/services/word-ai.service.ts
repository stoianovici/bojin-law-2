/**
 * Word AI Service
 * Handles AI operations for the Word add-in
 *
 * Refactored for better maintainability:
 * - Prompts extracted to word-ai-prompts.ts
 * - Research logic extracted to word-ai-research.ts
 * - Formatting guidelines in document-formatting-guidelines.ts
 */

import type {
  WordSuggestionRequest,
  WordSuggestionResponse,
  WordAISuggestion,
  WordExplainRequest,
  WordExplainResponse,
  WordImproveRequest,
  WordImproveResponse,
  WordDraftRequest,
  WordDraftResponse,
  WordDraftFromTemplateRequest,
  WordDraftFromTemplateResponse,
} from '@legal-platform/types';
import Anthropic from '@anthropic-ai/sdk';
import { aiClient, getModelForFeature } from './ai-client.service';
import { prisma } from '@legal-platform/database';
import { caseContextFileService } from './case-context-file.service';
import { wordTemplateService } from './word-template.service';
import { docxGeneratorService } from './docx-generator.service';
import { htmlToOoxmlService } from './html-to-ooxml.service';
import { htmlNormalizer } from './html-normalizer';
import { getTemplate, determineDocumentRoute, type DocumentTemplate } from './document-templates';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

// Import extracted modules
import { SYSTEM_PROMPTS, NOTIFICARI_KNOWLEDGE } from './word-ai-prompts';
import {
  WEB_SEARCH_TOOL,
  createWebSearchHandler,
  RESEARCH_CONFIG,
  detectResearchIntent,
} from './word-ai-research';
import { SINGLE_WRITER_PROMPT, getDepthParameters } from './research-phases';
import { createSemanticNormalizer } from './html-normalizer';
import { RESEARCH_STYLE_CONFIG } from './document-templates';

// ============================================================================
// Progress Event Types (Epic 6.8: Enhanced Streaming Progress)
// ============================================================================

/**
 * Detailed progress event for streaming updates to the UI.
 * Epic 6.8: Enhanced streaming progress
 *
 * Progress percentage breakdown:
 * - Research phase: 0-40%
 * - Thinking phase: 40-50%
 * - Writing phase: 50-90%
 * - Formatting phase: 90-100%
 */
export interface WordDraftProgressEvent {
  /** Event type for UI handling */
  type:
    | 'phase_start'
    | 'phase_complete'
    | 'search'
    | 'thinking'
    | 'writing'
    | 'formatting'
    | 'error';
  /** Current phase of the pipeline */
  phase?: 'research' | 'writing' | 'formatting';
  /** Human-readable status message (Romanian) */
  text: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Search query for 'search' events */
  query?: string;
  /** Partial content for 'writing' events */
  partialContent?: string;
  /** Whether this is a retry attempt (for error events) */
  retrying?: boolean;
}

// ============================================================================
// Premium Mode Types (Extended Request/Response)
// ============================================================================

/**
 * Extended draft request with premium mode support.
 * When premiumMode is true:
 * - Uses Opus 4.5 model regardless of other settings
 * - Enables extended thinking with 10k token budget
 * - Returns thinking blocks in the response
 */
export interface WordDraftRequestWithPremium extends WordDraftRequest {
  /** Enable premium mode: Opus 4.5 + extended thinking */
  premiumMode?: boolean;
}

/**
 * Extended draft response with thinking blocks for premium mode.
 */
export interface WordDraftResponseWithPremium extends WordDraftResponse {
  /** Thinking blocks from extended thinking (premium mode only) */
  thinkingBlocks?: string[];
}

// ============================================================================
// Premium Mode Constants
// ============================================================================

/** Opus 4.5 model ID for premium mode */
const PREMIUM_MODEL = 'claude-opus-4-5-20251101';

/** Extended thinking budget for premium mode (tokens) */
const PREMIUM_THINKING_BUDGET = 10000;

// ============================================================================
// Premium Mode Helper Functions
// ============================================================================

/**
 * Extract thinking blocks from Anthropic response for premium mode display.
 * Returns array of thinking text blocks.
 *
 * When extended thinking is enabled, the response may contain thinking blocks
 * that show Claude's internal reasoning process. These are valuable for
 * transparency and can be displayed to premium users.
 */
function extractThinkingBlocks(response: Anthropic.Message): string[] {
  const thinkingBlocks: string[] = [];
  for (const block of response.content) {
    if (block.type === 'thinking') {
      thinkingBlocks.push((block as { type: 'thinking'; thinking: string }).thinking);
    }
  }
  return thinkingBlocks;
}

/**
 * Extract thinking blocks from content blocks array (for chatWithTools response).
 */
function extractThinkingBlocksFromContent(content: Anthropic.ContentBlock[]): string[] {
  const thinkingBlocks: string[] = [];
  for (const block of content) {
    if (block.type === 'thinking') {
      thinkingBlocks.push((block as { type: 'thinking'; thinking: string }).thinking);
    }
  }
  return thinkingBlocks;
}

// ============================================================================
// Complexity Detection for Model Routing
// ============================================================================

/**
 * Detect text complexity for model routing.
 * Complex texts get upgraded to a more capable model.
 *
 * Criteria for "complex":
 * - Token estimate > 2000 (text length / 4)
 * - Contains legal citations (art., Cod, Legea, Decizia, etc.)
 * - Contains case references (dosar nr., nr. )
 *
 * @param text - The text to analyze
 * @returns 'simple' or 'complex'
 */
function detectComplexity(text: string): 'simple' | 'complex' {
  const tokenEstimate = text.length / 4;

  // Legal citation patterns in Romanian
  const hasLegalCitations =
    /art\.\s*\d+|Cod\s+Civil|Cod\s+Penal|Legea\s+nr\.|Decizia\s+nr\.|O\.U\.G\.|H\.G\.|dosar\s+nr\./i.test(
      text
    );

  // Multiple legal references suggest complex analysis needed
  const legalRefCount = (text.match(/art\.\s*\d+/gi) || []).length;

  if (tokenEstimate > 2000 || hasLegalCitations || legalRefCount >= 3) {
    return 'complex';
  }

  return 'simple';
}

// ============================================================================
// Single-Writer Model Configuration
// ============================================================================

/**
 * Default models for single-writer research by depth.
 * Used when no admin override is configured.
 */
const SINGLE_WRITER_MODEL_DEFAULTS = {
  /** Quick/standard research: Sonnet 4.5 for cost efficiency */
  quick: 'claude-sonnet-4-5-20250929',

  /** Deep research: Opus 4.5 for maximum quality */
  deep: 'claude-opus-4-5-20251101',
} as const;

/** Global default model - used to detect when no override is set */
const GLOBAL_DEFAULT_MODEL = 'claude-sonnet-4-20250514';

// ============================================================================
// XML Tag Parsing Helper
// ============================================================================

/**
 * Extract content from XML tags in AI responses.
 * More reliable than regex patterns for structured response parsing.
 *
 * @param content - The full AI response content
 * @param tag - The tag name to extract (without < >)
 * @returns The content between tags, trimmed, or null if not found
 */
function extractTag(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = content.match(regex);
  return match?.[1]?.trim() || null;
}

/**
 * Extract HTML content from AI response, stripping any preamble text.
 *
 * The AI sometimes outputs "thinking" text before the actual HTML document.
 * This function extracts only the HTML content (article tag or full HTML structure).
 *
 * @param content - The full AI response content
 * @returns The extracted HTML content, or original content if no HTML found
 */
function extractHtmlContent(content: string): string {
  // Try to extract <article> content first (preferred format)
  const articleMatch = content.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) {
    return articleMatch[0];
  }

  // Try to extract from first <h1> or <h2> to end of content
  // This handles cases where article wrapper is missing
  const headingMatch = content.match(/(<h[1-2][\s\S]*)/i);
  if (headingMatch) {
    // Wrap in article for consistent processing
    return `<article>${headingMatch[1]}</article>`;
  }

  // Try to find any HTML structure (starts with a tag)
  const htmlStartMatch = content.match(/(<(?:div|section|header|p|h[1-6])\b[\s\S]*)/i);
  if (htmlStartMatch) {
    return `<article>${htmlStartMatch[1]}</article>`;
  }

  // No HTML found - return original content
  // This allows fallback to markdown processing if needed
  return content;
}

// ============================================================================
// Service
// ============================================================================

export class WordAIService {
  /**
   * Extract the first H1 heading text from HTML content.
   * Used to get the actual document title from AI-generated content.
   */
  private extractTitleFromHtml(html: string): string | null {
    // First try simple text content (fastest)
    const simpleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (simpleMatch) {
      // Strip any numbering prefix (e.g., "1. " or "I. ")
      return simpleMatch[1].replace(/^[\d.IVXLCDM]+\.\s*/i, '').trim();
    }

    // Try to extract H1 with nested elements (e.g., <h1><strong>Title</strong></h1>)
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      // Strip HTML tags to get text content
      const textContent = h1Match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/^[\d.IVXLCDM]+\.\s*/i, '')
        .trim();
      if (textContent.length > 0) {
        return textContent;
      }
    }

    return null;
  }

  /**
   * Convert HTML to OOXML with template-based normalization and formatting.
   * This is the central conversion point that applies:
   * 1. HTML normalization (strip emojis, fix numbering, etc.)
   * 2. Template-based pagination rules
   * 3. Cover page generation (for research docs)
   */
  private convertToOoxml(
    html: string,
    options: {
      isResearch: boolean;
      templateId?: string;
      title: string;
      subtitle?: string;
      clientName?: string;
      authorName?: string;
      skipNormalization?: boolean;
    }
  ): string {
    // Determine which template to use
    const route = determineDocumentRoute(options.isResearch, options.templateId);
    const template = getTemplate(route);

    // Normalize HTML according to template rules
    // Skip for research docs that were already processed by SemanticHtmlNormalizer
    const normalizedHtml = options.skipNormalization
      ? html
      : htmlNormalizer.normalize(html, template);

    // Extract the actual document title from H1 if the provided title is generic
    const genericTitles = ['Document', 'Notă de cercetare', 'Memoriu', 'Studiu', 'Draft'];
    let documentTitle = options.title;
    if (genericTitles.some((g) => options.title.toLowerCase().includes(g.toLowerCase()))) {
      const extractedTitle = this.extractTitleFromHtml(html);
      // Only use extracted title if it's meaningful (not also generic)
      const isExtractedGeneric =
        extractedTitle &&
        genericTitles.some((g) => extractedTitle.toLowerCase().includes(g.toLowerCase()));
      if (extractedTitle && !isExtractedGeneric && extractedTitle.length > 15) {
        documentTitle = extractedTitle;
      } else if (options.subtitle && options.subtitle.length > 20) {
        // Fall back to subtitle (the research prompt) if title is generic
        documentTitle =
          options.subtitle.length > 100 ? options.subtitle.slice(0, 100) + '...' : options.subtitle;
      }
    }

    // Build OOXML conversion options from template
    const convertOptions: Parameters<typeof htmlToOoxmlService.convert>[1] = {
      // Cover page (only for research docs)
      coverPage: template.coverPage.enabled
        ? {
            title: documentTitle,
            subtitle: options.subtitle,
            documentType: template.name,
            client: options.clientName,
            author: options.authorName,
            date: new Date().toLocaleDateString('ro-RO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          }
        : undefined,

      // Pagination rules
      pagination: {
        pageBreaksBeforeH1: template.pagination.pageBreakBeforeH1,
        minParagraphsAfterHeading: template.pagination.minParagraphsAfterHeading,
        headingSpacing: template.pagination.headingSpacing,
      },

      // Generate bookmarks for cross-references
      generateBookmarks: true,
    };

    return htmlToOoxmlService.convert(normalizedHtml, convertOptions);
  }

  /**
   * Get suggestions for text
   */
  async getSuggestions(
    request: WordSuggestionRequest,
    userId: string,
    firmId: string
  ): Promise<WordSuggestionResponse> {
    const startTime = Date.now();

    // Build context
    let caseContext = '';
    if (request.caseId) {
      const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
      if (contextFile) {
        caseContext = `\n\n## Context dosar\n${contextFile.content}`;
      }
    }

    // Build prompt based on suggestion type
    let userPrompt = '';
    switch (request.suggestionType) {
      case 'completion':
        userPrompt = `Continuă următorul text juridic în mod natural:

Context înconjurător:
"""
${request.cursorContext}
"""

Text de continuat:
"""
${request.selectedText}
"""
${caseContext}

Oferă 3 variante de continuare, fiecare pe o linie separată.`;
        break;

      case 'alternative':
        userPrompt = `Oferă reformulări alternative pentru următorul text juridic:

Text original:
"""
${request.selectedText}
"""
${caseContext}

Oferă 3 alternative, fiecare pe o linie separată.`;
        break;

      case 'precedent':
        userPrompt = `Identifică clauze sau formulări standard din legislația românească relevante pentru:

Text de referință:
"""
${request.selectedText}
"""
${caseContext}

Oferă 3 precedente sau formulări standard, fiecare cu sursa legală.`;
        break;
    }

    // Add custom instructions if provided
    if (request.customInstructions?.trim()) {
      userPrompt += `\n\nInstrucțiuni suplimentare de la utilizator:\n${request.customInstructions}`;
    }

    // Detect complexity from selected text and context
    const complexity = detectComplexity(request.selectedText + caseContext);

    // Get base configured model
    const configuredModel = await getModelForFeature(firmId, 'word_ai_suggest');

    // Model routing based on complexity
    // If admin has set a specific model override, respect it
    // Otherwise, route based on complexity
    const model =
      configuredModel !== GLOBAL_DEFAULT_MODEL // Not default
        ? configuredModel // Use admin override
        : complexity === 'complex'
          ? 'claude-sonnet-4-5-20250929' // Upgrade to Sonnet 4.5 for complex
          : 'claude-haiku-4-5-20251001'; // Use Haiku for simple

    logger.debug('Model routing for suggestions', {
      complexity,
      configuredModel,
      selectedModel: model,
      textLength: request.selectedText.length,
    });

    // Call AI
    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_suggest',
        userId,
        firmId,
      },
      {
        system: SYSTEM_PROMPTS.suggest,
        model,
        temperature: 0.7,
      }
    );

    // Parse suggestions from response
    const lines = response.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const suggestions: WordAISuggestion[] = lines.slice(0, 3).map((content, index) => ({
      id: randomUUID(),
      type: request.suggestionType,
      content: content.replace(/^\d+\.\s*/, ''), // Remove leading numbers
      confidence: 0.9 - index * 0.1,
    }));

    return {
      suggestions,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Explain legal text
   * Uses XML tag parsing for structured response
   */
  async explainText(
    request: WordExplainRequest,
    userId: string,
    firmId: string
  ): Promise<WordExplainResponse> {
    const startTime = Date.now();

    // Build context
    let caseContext = '';
    if (request.caseId) {
      const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
      if (contextFile) {
        caseContext = `\n\n## Context dosar\n${contextFile.content}`;
      }
    }

    let userPrompt = `Explică următorul text juridic în limbaj simplu:

Text de explicat:
"""
${request.selectedText}
"""
${caseContext}`;

    // Add custom instructions if provided
    if (request.customInstructions?.trim()) {
      userPrompt += `\n\nInstrucțiuni suplimentare de la utilizator:\n${request.customInstructions}`;
    }

    // Detect complexity
    const complexity = detectComplexity(request.selectedText + caseContext);

    // Get base configured model
    const configuredModel = await getModelForFeature(firmId, 'word_ai_explain');

    // Model routing based on complexity
    const model =
      configuredModel !== GLOBAL_DEFAULT_MODEL
        ? configuredModel
        : complexity === 'complex'
          ? 'claude-sonnet-4-5-20250929'
          : 'claude-haiku-4-5-20251001';

    logger.debug('Model routing for explain', {
      complexity,
      configuredModel,
      selectedModel: model,
    });

    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_explain',
        userId,
        firmId,
      },
      {
        system: SYSTEM_PROMPTS.explain,
        model,
        temperature: 0.3,
      }
    );

    // Parse response using XML tags (fallback to full content if tags not found)
    const content = response.content;
    const explanation = extractTag(content, 'explanation');
    const legalBasis = extractTag(content, 'legal_basis');
    const implications = extractTag(content, 'implications');

    // Build full explanation with all parts
    let fullExplanation = content;
    if (explanation) {
      fullExplanation = explanation;
      if (implications) {
        fullExplanation += `\n\nImplicații practice:\n${implications}`;
      }
    }

    return {
      explanation: fullExplanation,
      legalBasis: legalBasis || undefined,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Improve text
   * Uses XML tag parsing for reliable response extraction
   */
  async improveText(
    request: WordImproveRequest,
    userId: string,
    firmId: string
  ): Promise<WordImproveResponse> {
    const startTime = Date.now();

    const improvementLabels: Record<string, string> = {
      clarity: 'claritate',
      formality: 'formalitate',
      brevity: 'concizie',
      legal_precision: 'precizie juridică',
    };

    let userPrompt = `Îmbunătățește următorul text juridic pentru ${improvementLabels[request.improvementType]}:

Text original:
"""
${request.selectedText}
"""`;

    // Add custom instructions if provided
    if (request.customInstructions?.trim()) {
      userPrompt += `\n\nInstrucțiuni suplimentare de la utilizator:\n${request.customInstructions}`;
    }

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_improve');

    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_improve',
        userId,
        firmId,
      },
      {
        system: SYSTEM_PROMPTS.improve,
        model,
        temperature: 0.3,
      }
    );

    // Parse response using XML tags
    const content = response.content;
    const improved = extractTag(content, 'improved') || content;
    const explanation = extractTag(content, 'explanation') || 'Textul a fost îmbunătățit.';

    // Generate OOXML for style-aware insertion
    const ooxmlContent = docxGeneratorService.markdownToOoxmlFragment(improved);

    return {
      original: request.selectedText,
      improved,
      ooxmlContent,
      explanation,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Draft document content based on case/client/internal context and user prompt.
   * Web search behavior:
   * - enableWebSearch === true: always use research
   * - enableWebSearch === false: never use research
   * - enableWebSearch === undefined: auto-detect based on keywords
   *
   * Premium mode (premiumMode: true):
   * - Uses Opus 4.5 model regardless of configured model
   * - Enables extended thinking with 10k token budget
   * - Returns thinking blocks in the response for transparency
   */
  async draft(
    request: WordDraftRequestWithPremium,
    userId: string,
    firmId: string
  ): Promise<WordDraftResponseWithPremium> {
    const startTime = Date.now();
    const isPremium = request.premiumMode === true;

    // Log premium mode activation
    if (isPremium) {
      logger.info('Premium mode enabled for Word draft', {
        userId,
        firmId,
        documentName: request.documentName,
        model: PREMIUM_MODEL,
        thinkingBudget: PREMIUM_THINKING_BUDGET,
      });
    }

    // Determine if research is needed:
    // - Explicit true: use research
    // - Explicit false: don't use research
    // - Undefined: auto-detect based on keywords
    const needsResearch =
      request.enableWebSearch === true ||
      (request.enableWebSearch !== false && detectResearchIntent(request.prompt));

    if (needsResearch) {
      logger.info('Web search enabled for Word draft', {
        userId,
        firmId,
        contextType: request.contextType,
        caseId: request.caseId,
        clientId: request.clientId,
        documentName: request.documentName,
        explicit: request.enableWebSearch === true,
        autoDetected: request.enableWebSearch === undefined,
        twoPhase: request.useTwoPhaseResearch ?? false,
        multiAgent: request.useMultiAgent ?? false,
        premiumMode: isPremium,
      });

      // Use multi-agent research if explicitly requested (4-phase pipeline)
      // (deprecated - use single-writer instead)
      if (request.useMultiAgent) {
        return this.draftWithMultiAgent(request, userId, firmId);
      }

      // Use two-phase research if explicitly requested
      // (deprecated - use single-writer instead)
      if (request.useTwoPhaseResearch) {
        return this.draftWithResearchTwoPhase(request, userId, firmId);
      }

      // Default: Use single-writer architecture (new)
      // Produces coherent, consistently formatted documents
      return this.draftWithSingleWriter(request, userId, firmId);
    }

    // Standard draft flow (no web search)
    const contextInfo = await this.getContextForDraft(request, firmId);

    // Build prompt
    let userPrompt = `Generează conținut pentru un document juridic.

## Nume document
${request.documentName}

${contextInfo.contextSection}

## Instrucțiuni
${request.prompt}`;

    // Add existing content if provided
    if (request.existingContent && request.existingContent.trim()) {
      userPrompt += `

## Conținut existent în document
Documentul conține deja următorul text (continuă de aici sau adaptează):
"""
${request.existingContent.substring(0, 2000)}
"""`;
    }

    userPrompt += '\n\nGenerează conținutul solicitat în limba română.';

    // Premium mode: bypass getModelForFeature and use Opus 4.5 with extended thinking
    const model = isPremium ? PREMIUM_MODEL : await getModelForFeature(firmId, 'word_draft');
    logger.debug('Using model for word_draft', { firmId, model, premiumMode: isPremium });

    const response = await aiClient.chat(
      [{ role: 'user', content: userPrompt }],
      {
        feature: isPremium ? 'word_draft_premium' : 'word_draft',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        system: SYSTEM_PROMPTS.draft,
        model,
        maxTokens: isPremium ? 8192 : 4096,
        // Premium mode: enable extended thinking
        // Note: temperature must be unset (or 1) for extended thinking
        ...(isPremium
          ? {
              thinking: {
                enabled: true,
                budgetTokens: PREMIUM_THINKING_BUDGET,
              },
            }
          : { temperature: 0.4 }),
      }
    );

    // Extract text content from response
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Extract thinking blocks for premium mode
    const thinkingBlocks = isPremium
      ? extractThinkingBlocksFromContent(response.content)
      : undefined;

    // Generate OOXML only if requested
    const ooxmlContent = request.includeOoxml
      ? docxGeneratorService.markdownToOoxmlFragment(textContent)
      : undefined;

    return {
      content: textContent,
      ooxmlContent,
      title: request.documentName,
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
      // Include thinking blocks only in premium mode
      ...(thinkingBlocks && thinkingBlocks.length > 0 ? { thinkingBlocks } : {}),
    };
  }

  /**
   * Get context information for drafting based on context type.
   */
  private async getContextForDraft(
    request: WordDraftRequest,
    firmId: string
  ): Promise<{
    contextSection: string;
    entityType: 'case' | 'client' | 'firm';
    entityId: string | undefined;
  }> {
    const contextType = request.contextType || 'case';

    if (contextType === 'case' && request.caseId) {
      // Get case context file
      logger.info('[Draft Context] Fetching case context', {
        caseId: request.caseId,
        documentName: request.documentName,
      });
      const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
      if (!contextFile) {
        logger.warn('[Draft Context] No context file available', { caseId: request.caseId });
        throw new Error('Contextul dosarului nu este disponibil');
      }
      // Log context details for debugging
      logger.info('[Draft Context] Context file retrieved', {
        caseId: request.caseId,
        tokenCount: contextFile.tokenCount,
        sectionsCount: contextFile.sections?.length ?? 0,
        sections: contextFile.sections?.map((s) => s.sectionId) ?? [],
        contentLength: contextFile.content.length,
        version: contextFile.version,
        generatedAt: contextFile.generatedAt,
      });
      // Log actual content preview for debugging (first 500 chars)
      logger.debug('[Draft Context] Content preview', {
        caseId: request.caseId,
        preview: contextFile.content.substring(0, 500),
      });
      return {
        contextSection: `## Context dosar\n${contextFile.content}`,
        entityType: 'case',
        entityId: request.caseId,
      };
    }

    if (contextType === 'client' && request.clientId) {
      // Fetch client details
      const client = await prisma.client.findUnique({
        where: { id: request.clientId },
        select: {
          id: true,
          name: true,
          clientType: true,
          address: true,
          contactInfo: true,
          cui: true,
          registrationNumber: true,
        },
      });

      if (!client) {
        throw new Error('Clientul nu a fost găsit');
      }

      // Extract contact info from JSON
      const contactInfo = client.contactInfo as { email?: string; phone?: string } | null;
      const email = contactInfo?.email;
      const phone = contactInfo?.phone;

      const clientContext = `## Context client
**Nume:** ${client.name}
**Tip:** ${client.clientType === 'individual' ? 'Persoană fizică' : 'Persoană juridică'}
${email ? `**Email:** ${email}` : ''}
${phone ? `**Telefon:** ${phone}` : ''}
${client.address ? `**Adresă:** ${client.address}` : ''}
${client.cui ? `**CUI:** ${client.cui}` : ''}
${client.registrationNumber ? `**Nr. Reg. Com.:** ${client.registrationNumber}` : ''}`;

      return {
        contextSection: clientContext,
        entityType: 'client',
        entityId: request.clientId,
      };
    }

    // Internal document - no specific context
    return {
      contextSection: '## Context\nDocument intern fără asociere la dosar sau client specific.',
      entityType: 'firm',
      entityId: firmId,
    };
  }

  /**
   * Draft document with web search capability.
   * Called when enableWebSearch is true.
   */
  private async draftWithResearch(
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    startTime: number,
    onProgress?: (event: {
      type: string;
      tool?: string;
      input?: Record<string, unknown>;
      text?: string;
    }) => void
  ): Promise<WordDraftResponse> {
    // Get context based on context type
    const contextInfo = await this.getContextForDraft(request, firmId);

    // Build prompt - give Claude design freedom
    let userPrompt = `Creează un document HTML frumos și profesional.

Ai libertate deplină asupra stilului - fonturi, culori, spațiere.
Folosește inline styles. NU folosi markdown.

OBLIGATORIU: Fiecare sursă necesită footnote cu <sup><a href="#fnN">N</a></sup>

---

## Document: ${request.documentName}

${contextInfo.contextSection}

## Instrucțiuni
${request.prompt}`;

    // Add existing content if provided
    if (request.existingContent && request.existingContent.trim()) {
      userPrompt += `

## Conținut existent în document
Documentul conține deja următorul text (continuă de aici sau adaptează):
"""
${request.existingContent.substring(0, 2000)}
"""`;
    }

    userPrompt +=
      '\n\nFolosește web_search pentru a găsi informații relevante. Creează un document frumos cu stiluri inline.';

    // Get configured model for research_document feature
    const model = await getModelForFeature(firmId, 'research_document');
    logger.debug('Using model for research_document (Word draft with research)', { firmId, model });

    // Create web search tool handler
    const webSearchHandler = createWebSearchHandler();

    // Call AI with tools
    const response = await aiClient.chatWithTools(
      [{ role: 'user', content: userPrompt }],
      {
        feature: 'research_document',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model,
        maxTokens: RESEARCH_CONFIG.maxTokens,
        temperature: RESEARCH_CONFIG.temperature,
        system: SYSTEM_PROMPTS.draftWithResearch,
        tools: [WEB_SEARCH_TOOL],
        toolHandlers: {
          web_search: webSearchHandler,
        },
        maxToolRounds: RESEARCH_CONFIG.maxToolRounds,
        onProgress,
      }
    );

    // Extract text content from response
    const rawContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Extract HTML content, stripping any AI preamble text
    const htmlContent = extractHtmlContent(rawContent);

    logger.info('Word draft with research completed', {
      userId,
      firmId,
      contextType: request.contextType,
      caseId: request.caseId,
      clientId: request.clientId,
      tokensUsed: response.inputTokens + response.outputTokens,
      costEur: response.costEur,
      htmlExtracted: htmlContent !== rawContent, // Log if we stripped preamble
    });

    // Generate OOXML using the new HTML pipeline with normalization
    const ooxmlContent = request.includeOoxml
      ? this.convertToOoxml(htmlContent, {
          isResearch: true,
          title: request.documentName,
          subtitle: request.prompt.slice(0, 100), // Use first part of prompt as subtitle
        })
      : undefined;

    return {
      content: htmlContent,
      ooxmlContent,
      title: request.documentName,
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ==========================================================================
  // Deprecated Research Architectures (redirect to single-writer)
  // ==========================================================================

  /**
   * @deprecated Use draftWithSingleWriter instead. This method now redirects to single-writer.
   */
  async draftWithResearchTwoPhase(
    request: WordDraftRequestWithPremium,
    userId: string,
    firmId: string,
    onProgress?: (event: WordDraftProgressEvent) => void
  ): Promise<WordDraftResponseWithPremium> {
    logger.warn('draftWithResearchTwoPhase is deprecated, using single-writer instead', {
      userId,
      firmId,
    });
    return this.draftWithSingleWriter(request, userId, firmId, onProgress);
  }

  /**
   * @deprecated Use draftWithSingleWriter instead. This method now redirects to single-writer.
   */
  async draftWithMultiAgent(
    request: WordDraftRequestWithPremium,
    userId: string,
    firmId: string,
    onProgress?: (event: WordDraftProgressEvent) => void
  ): Promise<WordDraftResponseWithPremium> {
    logger.warn('draftWithMultiAgent is deprecated, using single-writer instead', {
      userId,
      firmId,
    });
    return this.draftWithSingleWriter(request, userId, firmId, onProgress);
  }

  // ==========================================================================
  // Single-Writer Research Architecture (New)
  // ==========================================================================

  /**
   * Single-writer research document drafting.
   *
   * New architecture that produces more consistent, coherent documents:
   * 1. Research Phase: Single agent with web_search finds sources
   * 2. Write Phase: Same agent writes complete document in semantic HTML
   * 3. Format Phase: Code applies all styles via SemanticHtmlNormalizer
   *
   * Key benefits:
   * - Coherent voice (one writer, not multiple agents)
   * - Deterministic footnotes (order of appearance)
   * - Consistent styling (code-controlled, not AI-controlled)
   * - Semantic HTML is easier for AI to produce correctly
   *
   * Progress percentage breakdown (Epic 6.8):
   * - Research phase: 0-40%
   * - Thinking phase: 40-50%
   * - Writing phase: 50-90%
   * - Formatting phase: 90-100%
   *
   * Premium mode (premiumMode: true):
   * - Uses Opus 4.5 model regardless of depth settings
   * - Enables extended thinking with 10k token budget
   * - Returns thinking blocks in the response
   * - Streams thinking progress events
   */
  async draftWithSingleWriter(
    request: WordDraftRequestWithPremium,
    userId: string,
    firmId: string,
    onProgress?: (event: WordDraftProgressEvent) => void
  ): Promise<WordDraftResponseWithPremium> {
    const startTime = Date.now();
    const isPremium = (request as WordDraftRequestWithPremium).premiumMode === true;

    // Progress tracking for research phase (Epic 6.8)
    let researchProgress = 5; // Start at 5%
    let searchCount = 0;

    // Get context
    const contextInfo = await this.getContextForDraft(request, firmId);

    // Calculate parameters based on depth
    const depth = request.researchDepth || 'standard';
    const depthParams = getDepthParameters(depth);

    logger.info('Starting single-writer research draft', {
      userId,
      firmId,
      documentName: request.documentName,
      depth,
      targetWordCount: depthParams.targetWordCount,
      sourceTypes: request.sourceTypes,
      premiumMode: isPremium,
    });

    // ========================================================================
    // COMBINED RESEARCH + WRITING PHASE (Single Agent)
    // ========================================================================

    // Epic 6.8: Enhanced progress event - phase start
    onProgress?.({
      type: 'phase_start',
      phase: 'research',
      text: isPremium
        ? 'Începe cercetarea premium cu analiză aprofundată...'
        : 'Începe cercetarea și adunarea surselor...',
      progress: 5,
    });

    // Detect document type from name AND prompt for appropriate routing
    const docNameLower = request.documentName.toLowerCase();
    const promptLower = request.prompt.toLowerCase();
    const textToCheck = `${docNameLower} ${promptLower}`;

    // Check for notification keywords in either document name or prompt
    const isNotificare =
      textToCheck.includes('notificare') ||
      textToCheck.includes('somație') ||
      textToCheck.includes('somatie') ||
      textToCheck.includes('punere în întârziere') ||
      textToCheck.includes('reziliere') ||
      textToCheck.includes('reziliez') ||
      textToCheck.includes('denunțare') ||
      textToCheck.includes('denuntare') ||
      textToCheck.includes('denunț') ||
      textToCheck.includes('evacuare') ||
      textToCheck.includes('evacuez');

    logger.info('Document type detection', {
      userId,
      firmId,
      documentName: request.documentName,
      isNotificare,
      promptPreview: request.prompt.substring(0, 100),
    });

    // Build user prompt with context and instructions
    const sourceTypesStr = request.sourceTypes?.join(', ') || 'legislație, jurisprudență, doctrină';

    // Use different prompts for notifications vs research documents
    const userPrompt = isNotificare
      ? `Creează documentul juridic solicitat.

## DOCUMENT: ${request.documentName}

## INSTRUCȚIUNI DE LA UTILIZATOR
${request.prompt}

${contextInfo.contextSection}

## CERINȚE

1. Urmează instrucțiunile utilizatorului cu fidelitate
2. Integrează informațiile din contextul dosarului/clientului
3. Folosește web_search DOAR dacă ai nevoie de articole de lege sau clarificări
4. Aplică cunoștințele juridice despre notificări (termene, efecte, temeiul legal)
5. Formatează profesional cu secțiuni clare

Returnează documentul complet, gata pentru comunicare prin executor sau scrisoare recomandată.`
      : `Creează un document de cercetare juridică.

## DOCUMENT: ${request.documentName}

## ÎNTREBAREA DE CERCETARE
${request.prompt}

${contextInfo.contextSection}

## INSTRUCȚIUNI

1. Cercetează folosind web_search pentru surse de tip: ${sourceTypesStr}
2. Redactează documentul complet (~${depthParams.targetWordCount} cuvinte)
3. Folosește HTML semantic (fără stiluri)
4. Citări cu <ref id="srcN"/>, surse în <sources> la final

Returnează DOAR HTML semantic valid, de la <article> la </article>.`;

    // Premium mode: always use Opus 4.5, otherwise select based on depth
    let model: string;
    let featureKey: string;

    if (isPremium) {
      // Premium mode bypasses all model selection - always Opus 4.5
      model = PREMIUM_MODEL;
      featureKey = 'research_document_premium';
      logger.info('Premium mode: using Opus 4.5 with extended thinking', {
        model,
        thinkingBudget: PREMIUM_THINKING_BUDGET,
      });
    } else {
      // Standard model selection based on depth
      switch (depth) {
        case 'deep':
          featureKey = 'research_document';
          break;
        case 'standard':
          featureKey = 'research_document_standard';
          break;
        case 'quick':
        default:
          featureKey = 'research_document_quick';
          break;
      }

      const configuredModel = await getModelForFeature(firmId, featureKey);

      // If no admin override (returns global default), use depth-specific default
      model =
        configuredModel !== GLOBAL_DEFAULT_MODEL
          ? configuredModel
          : depth === 'deep'
            ? SINGLE_WRITER_MODEL_DEFAULTS.deep
            : SINGLE_WRITER_MODEL_DEFAULTS.quick; // Both quick and standard default to Sonnet 4.5

      logger.info('Single-writer model selected by depth', {
        depth,
        featureKey,
        configuredModel,
        finalModel: model,
        usingDefault: configuredModel === GLOBAL_DEFAULT_MODEL,
      });
    }

    // Create web search handler
    const webSearchHandler = createWebSearchHandler();

    // Execute single-writer call with tools
    const response = await aiClient.chatWithTools(
      [{ role: 'user', content: userPrompt }],
      {
        feature: featureKey,
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model,
        maxTokens: isPremium ? Math.max(depthParams.maxTokens, 16384) : depthParams.maxTokens,
        // Premium mode: enable extended thinking (temperature must be unset)
        ...(isPremium
          ? {
              thinking: {
                enabled: true,
                budgetTokens: PREMIUM_THINKING_BUDGET,
              },
            }
          : { temperature: 0.4 }),
        system: isNotificare
          ? `Data curentă: ${new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}.

## PRINCIPIU FUNDAMENTAL

Instrucțiunile utilizatorului sunt AUTORITATIVE. Respectă-le întocmai.
Avocații formulează cereri precise. NU interpreta, NU extinde, NU substitui. Execută fidel.

${NOTIFICARI_KNOWLEDGE}

## FORMAT OUTPUT

Generează documentul în format markdown profesional cu secțiuni clare.
Folosește formatare adecvată: bold pentru părți, italic pentru citate legale.
Include toate elementele juridice necesare pentru valabilitatea notificării.`
          : `Data curentă: ${new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}.

## PRINCIPIU FUNDAMENTAL

Instrucțiunile utilizatorului sunt AUTORITATIVE. Respectă-le întocmai:
- Ani specificați → folosește EXACT acei ani în căutări
- Instanțe menționate → caută DOAR la acele instanțe
- Domenii juridice → nu extinde la alte domenii
- Format cerut → respectă structura solicitată

Avocații formulează cereri precise. NU interpreta, NU extinde, NU substitui. Execută fidel.

${SINGLE_WRITER_PROMPT}`,
        tools: [WEB_SEARCH_TOOL],
        toolHandlers: { web_search: webSearchHandler },
        maxToolRounds: depthParams.maxSearchRounds,
        onProgress: (event) => {
          // Epic 6.8: Enhanced progress events with detailed tracking
          if (event.type === 'tool_start') {
            // Check if it's a web_search tool call
            if (event.tool === 'web_search') {
              searchCount++;
              const query = (event.input as { query?: string })?.query || '';
              // Increment progress per search, cap at 40%
              researchProgress = Math.min(researchProgress + 3, 40);
              onProgress?.({
                type: 'search',
                phase: 'research',
                text: `Căutare: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`,
                query,
                progress: researchProgress,
              });
            } else if (event.tool?.startsWith('parallel')) {
              // Parallel batch execution
              onProgress?.({
                type: 'search',
                phase: 'research',
                text: 'Execută căutări în paralel...',
                progress: researchProgress,
              });
            }
          } else if (event.type === 'tool_end') {
            // Small progress bump after each successful search
            researchProgress = Math.min(researchProgress + 2, 40);
            onProgress?.({
              type: 'search',
              phase: 'research',
              text: `Rezultate găsite (${searchCount} căutări)`,
              progress: researchProgress,
            });
          } else if (event.type === 'thinking') {
            // Thinking phase: 40-50%
            // This indicates the model is reasoning about the results
            // For premium mode, this includes extended thinking content
            onProgress?.({
              type: 'thinking',
              phase: 'research',
              text: isPremium
                ? event.text || 'Analiză premium în desfășurare...'
                : event.text || 'Analizează în profunzime informațiile găsite...',
              progress: 45,
            });
          }
        },
      }
    );

    // Epic 6.8: Transition to writing phase (50-90%)
    // The AI has finished research and is now generating the document
    onProgress?.({
      type: 'writing',
      phase: 'writing',
      text: 'Redactează documentul...',
      progress: 50,
    });

    // Extract content from response
    const rawContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Extract thinking blocks for premium mode
    const thinkingBlocks = isPremium
      ? extractThinkingBlocksFromContent(response.content)
      : undefined;

    // Epic 6.8: Research and writing complete
    onProgress?.({
      type: 'phase_complete',
      phase: 'writing',
      text: 'Redactare completă, formatare finală...',
      progress: 90,
    });

    // ========================================================================
    // FORMATTING PHASE (Code-Controlled)
    // ========================================================================

    // Epic 6.8: Formatting phase start
    onProgress?.({
      type: 'formatting',
      phase: 'formatting',
      text: 'Convertire în format Word...',
      progress: 95,
    });

    let finalContent: string;
    let ooxmlContent: string | undefined;

    if (isNotificare) {
      // Notificare documents: AI returns markdown, convert directly to OOXML
      // Clean up any markdown code fences if present
      const cleanedMarkdown = rawContent
        .replace(/^```(?:markdown)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();

      finalContent = cleanedMarkdown;

      if (request.includeOoxml) {
        ooxmlContent = docxGeneratorService.markdownToOoxmlFragment(cleanedMarkdown);
      }

      logger.info('Notificare document drafted (markdown flow)', {
        userId,
        firmId,
        totalTokens: response.inputTokens + response.outputTokens,
        processingTimeMs: Date.now() - startTime,
        markdownLength: cleanedMarkdown.length,
        searchCount,
        premiumMode: isPremium,
        thinkingBlocksCount: thinkingBlocks?.length ?? 0,
      });
    } else {
      // Research documents: AI returns HTML, normalize and convert
      const semanticHtml = extractHtmlContent(rawContent);

      // Create semantic normalizer with style config
      const semanticNormalizer = createSemanticNormalizer(RESEARCH_STYLE_CONFIG);

      // Apply all formatting transformations
      finalContent = semanticNormalizer.normalize(semanticHtml);

      // Generate OOXML if requested
      // Skip basic normalization since SemanticHtmlNormalizer already processed the HTML
      if (request.includeOoxml) {
        ooxmlContent = this.convertToOoxml(finalContent, {
          isResearch: true,
          title: request.documentName,
          subtitle: request.prompt.slice(0, 100),
          skipNormalization: true,
        });
      }

      logger.info('Single-writer research draft completed (HTML flow)', {
        userId,
        firmId,
        totalTokens: response.inputTokens + response.outputTokens,
        processingTimeMs: Date.now() - startTime,
        semanticHtmlLength: semanticHtml.length,
        styledHtmlLength: finalContent.length,
        searchCount,
        premiumMode: isPremium,
        thinkingBlocksCount: thinkingBlocks?.length ?? 0,
      });
    }

    // Epic 6.8: Document complete
    onProgress?.({
      type: 'phase_complete',
      phase: 'formatting',
      text: 'Document finalizat!',
      progress: 100,
    });

    return {
      content: finalContent,
      ooxmlContent,
      title: request.documentName,
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
      // Include thinking blocks only in premium mode
      ...(thinkingBlocks && thinkingBlocks.length > 0 ? { thinkingBlocks } : {}),
    };
  }

  /**
   * Draft document from template
   */
  async draftFromTemplate(
    request: WordDraftFromTemplateRequest,
    userId: string,
    firmId: string
  ): Promise<WordDraftFromTemplateResponse> {
    const startTime = Date.now();

    // Get template
    const template = await wordTemplateService.getTemplate(request.templateId, firmId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Get case context
    const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
    if (!contextFile) {
      throw new Error('Case context not available');
    }

    // Build prompt
    let userPrompt = `Generează un document juridic complet bazat pe următorul template și context.

## Template: ${template.name}
${template.description ? `Descriere: ${template.description}` : ''}

${template.contentText ? `Structura template-ului:\n${template.contentText.substring(0, 3000)}` : ''}

## Context dosar
${contextFile.content}`;

    if (request.customInstructions) {
      userPrompt += `\n\n## Instrucțiuni suplimentare\n${request.customInstructions}`;
    }

    if (request.placeholderValues && Object.keys(request.placeholderValues).length > 0) {
      userPrompt += `\n\n## Valori specifice\n${Object.entries(request.placeholderValues)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')}`;
    }

    userPrompt += '\n\nGenerează documentul complet în limba română.';

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_draft_from_template');

    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_draft_from_template',
        userId,
        firmId,
        entityType: 'case',
        entityId: request.caseId,
      },
      {
        system: SYSTEM_PROMPTS.draftFromTemplate,
        model,
        temperature: 0.4,
      }
    );

    // Record template usage
    await wordTemplateService.recordUsage(template.id, userId, request.caseId);

    // Generate OOXML for style-aware insertion
    const ooxmlContent = docxGeneratorService.markdownToOoxmlFragment(response.content);

    return {
      content: response.content,
      ooxmlContent,
      title: `${template.name} - Draft`,
      templateUsed: {
        id: template.id,
        name: template.name,
      },
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Draft document content with streaming response.
   * Yields text chunks via callback for real-time UI updates.
   * For research requests, streams progress events (tool usage, thinking) via onProgress.
   *
   * Epic 6.8: Enhanced streaming progress - now uses WordDraftProgressEvent
   * for detailed progress tracking with percentages.
   *
   * Premium mode (premiumMode: true):
   * - Uses Opus 4.5 model regardless of configured model
   * - Enables extended thinking with 10k token budget
   * - Streams thinking progress events for real-time visibility
   * - Returns thinking blocks in the response
   */
  async draftStream(
    request: WordDraftRequestWithPremium,
    userId: string,
    firmId: string,
    onChunk: (chunk: string) => void,
    onProgress?: (event: WordDraftProgressEvent) => void
  ): Promise<WordDraftResponseWithPremium> {
    const startTime = Date.now();
    const isPremium = request.premiumMode === true;

    // Log premium mode activation
    if (isPremium) {
      logger.info('Premium mode enabled for Word draft stream', {
        userId,
        firmId,
        documentName: request.documentName,
        model: PREMIUM_MODEL,
        thinkingBudget: PREMIUM_THINKING_BUDGET,
      });
    }

    // Determine if research is needed (same logic as draft())
    const needsResearch =
      request.enableWebSearch === true ||
      (request.enableWebSearch !== false && detectResearchIntent(request.prompt));

    if (needsResearch) {
      logger.info('Web search enabled for Word draft (streaming) - using tool flow with progress', {
        userId,
        firmId,
        contextType: request.contextType,
        caseId: request.caseId,
        clientId: request.clientId,
        documentName: request.documentName,
        explicit: request.enableWebSearch === true,
        autoDetected: request.enableWebSearch === undefined,
        twoPhase: request.useTwoPhaseResearch ?? false,
        multiAgent: request.useMultiAgent ?? false,
        premiumMode: isPremium,
      });

      // Use multi-agent research if explicitly requested (4-phase pipeline)
      // (deprecated - use single-writer instead)
      if (request.useMultiAgent) {
        const result = await this.draftWithMultiAgent(request, userId, firmId, onProgress);
        onChunk(result.content);
        return result;
      }

      // Use two-phase research if explicitly requested
      // (deprecated - use single-writer instead)
      if (request.useTwoPhaseResearch) {
        const result = await this.draftWithResearchTwoPhase(request, userId, firmId, onProgress);
        onChunk(result.content);
        return result;
      }

      // Default: Use single-writer architecture (new)
      // Produces coherent, consistently formatted documents
      // Premium mode is handled within draftWithSingleWriter
      const result = await this.draftWithSingleWriter(request, userId, firmId, onProgress);
      onChunk(result.content);
      return result;
    }

    // Get context based on context type
    logger.info('Draft stream: fetching context', {
      contextType: request.contextType,
      clientId: request.clientId,
      caseId: request.caseId,
      premiumMode: isPremium,
    });
    const contextInfo = await this.getContextForDraft(request, firmId);
    logger.info('Draft stream: context fetched', { entityType: contextInfo.entityType });

    // Build prompt
    let userPrompt = `Generează conținut pentru un document juridic.

## Nume document
${request.documentName}

${contextInfo.contextSection}

## Instrucțiuni
${request.prompt}`;

    // Add existing content if provided
    if (request.existingContent && request.existingContent.trim()) {
      userPrompt += `

## Conținut existent în document
Documentul conține deja următorul text (continuă de aici sau adaptează):
"""
${request.existingContent.substring(0, 2000)}
"""`;
    }

    userPrompt += '\n\nGenerează conținutul solicitat în limba română.';

    // Premium mode: bypass getModelForFeature and use Opus 4.5
    const model = isPremium ? PREMIUM_MODEL : await getModelForFeature(firmId, 'word_draft');
    logger.info('Draft stream: starting AI call', {
      firmId,
      model,
      promptLength: userPrompt.length,
      premiumMode: isPremium,
    });

    // For premium mode with streaming, we need to use chat() with streaming
    // because completeStream doesn't support extended thinking
    // However, for now we'll use the non-streaming path for premium mode
    // to properly capture thinking blocks, then send the full content
    if (isPremium) {
      // Premium mode: use chat() to get thinking blocks, then stream the content
      const response = await aiClient.chat(
        [{ role: 'user', content: userPrompt }],
        {
          feature: 'word_draft_premium',
          userId,
          firmId,
          entityType: contextInfo.entityType,
          entityId: contextInfo.entityId,
        },
        {
          system: SYSTEM_PROMPTS.draft,
          model,
          maxTokens: 8192,
          thinking: {
            enabled: true,
            budgetTokens: PREMIUM_THINKING_BUDGET,
          },
        }
      );

      // Extract text content
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Extract thinking blocks for progress events
      const thinkingBlocks = extractThinkingBlocksFromContent(response.content);

      // Stream thinking progress events first
      if (thinkingBlocks.length > 0 && onProgress) {
        for (const thinking of thinkingBlocks) {
          onProgress({
            type: 'thinking',
            phase: 'writing',
            text: thinking.substring(0, 200) + (thinking.length > 200 ? '...' : ''),
            progress: 50,
          });
        }
      }

      // Then stream the content
      onChunk(textContent);

      logger.info('Draft stream (premium): AI call completed', {
        contentLength: textContent.length,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        thinkingBlocksCount: thinkingBlocks.length,
      });

      return {
        content: textContent,
        ooxmlContent: undefined,
        title: request.documentName,
        tokensUsed: response.inputTokens + response.outputTokens,
        processingTimeMs: Date.now() - startTime,
        thinkingBlocks: thinkingBlocks.length > 0 ? thinkingBlocks : undefined,
      };
    }

    // Standard (non-premium) streaming
    const response = await aiClient.completeStream(
      userPrompt,
      {
        feature: 'word_draft',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        system: SYSTEM_PROMPTS.draft,
        model,
        temperature: 0.4,
      },
      onChunk
    );

    logger.info('Draft stream: AI call completed', {
      contentLength: response.content.length,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    // For streaming, OOXML is fetched separately via /ooxml endpoint
    // No need to generate it here

    return {
      content: response.content,
      ooxmlContent: undefined, // Client fetches via REST endpoint after streaming
      title: request.documentName,
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export const wordAIService = new WordAIService();
