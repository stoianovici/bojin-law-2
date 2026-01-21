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
import { SYSTEM_PROMPTS } from './word-ai-prompts';
import {
  WEB_SEARCH_TOOL,
  createWebSearchHandler,
  RESEARCH_CONFIG,
  detectResearchIntent,
  calculateResearchScope,
  type ResearchScope,
  type ResearchDepth,
  type SourceType,
} from './word-ai-research';
import {
  PHASE1_RESEARCH_PROMPT,
  PHASE2_WRITING_PROMPT,
  OUTLINE_AGENT_PROMPT,
  SECTION_WRITER_PROMPT,
  ISOLATED_SECTION_AGENT_PROMPT,
  ASSEMBLY_PROMPT,
  SINGLE_WRITER_PROMPT,
  getDepthParameters,
  type ResearchNotes,
  type DocumentOutline,
  type SectionPlan,
  type SectionContent,
  type CitationUsed,
  type IsolatedSectionResult,
} from './research-phases';
import { createSemanticNormalizer } from './html-normalizer';
import { RESEARCH_STYLE_CONFIG } from './document-templates';
import pLimit from 'p-limit';

// ============================================================================
// Multi-Agent Model Configuration
// ============================================================================

/**
 * Model selection for multi-agent research pipeline.
 *
 * New fan-out/fan-in architecture:
 * - Each section agent is isolated (does own research + writes + produces summary)
 * - Assembly phase uses summaries only (stays under 25k tokens)
 * - Opus 4.5 for assembly to ensure coherent intro/conclusion synthesis
 */
const MULTI_AGENT_MODELS = {
  /** Orchestrator: parse prompt, calculate scope, plan sections */
  orchestrator: 'firm_config', // Uses firm's research_document config (typically Opus)

  /** Section Writers: isolated agents that do research + write + produce summary */
  sectionWriter: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 - good quality, parallel execution

  /** Assembly: generates intro/conclusion from summaries only (Opus 4.5 for synthesis) */
  assembly: 'claude-opus-4-5-20251101', // Opus 4.5 - superior synthesis from summaries
} as const;

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

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_suggest');

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

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_explain');

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
   */
  async draft(
    request: WordDraftRequest,
    userId: string,
    firmId: string
  ): Promise<WordDraftResponse> {
    const startTime = Date.now();

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

    // Get configured model for word_draft feature
    const model = await getModelForFeature(firmId, 'word_draft');
    logger.debug('Using model for word_draft', { firmId, model });

    const response = await aiClient.complete(
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
      }
    );

    // Generate OOXML only if requested
    const ooxmlContent = request.includeOoxml
      ? docxGeneratorService.markdownToOoxmlFragment(response.content)
      : undefined;

    return {
      content: response.content,
      ooxmlContent,
      title: request.documentName,
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
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
      const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
      if (!contextFile) {
        throw new Error('Contextul dosarului nu este disponibil');
      }
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
  // Two-Phase Research Architecture
  // ==========================================================================

  /**
   * Two-phase research document drafting.
   *
   * Phase 1: Research Agent - Finds and organizes sources (focused prompt)
   * Phase 2: Writing Agent - Composes academic document (focused prompt)
   *
   * Benefits:
   * - Each phase has a focused prompt (~3-4k words instead of 9k+)
   * - Better separation of concerns (research vs writing)
   * - Structured handoff allows quality validation between phases
   * - More consistent academic output
   */
  async draftWithResearchTwoPhase(
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    onProgress?: (event: {
      type: string;
      phase?: 'research' | 'writing';
      tool?: string;
      input?: Record<string, unknown>;
      text?: string;
    }) => void
  ): Promise<WordDraftResponse> {
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Get context
    const contextInfo = await this.getContextForDraft(request, firmId);

    logger.info('Starting two-phase research draft', {
      userId,
      firmId,
      documentName: request.documentName,
    });

    // ========================================================================
    // PHASE 1: Research
    // ========================================================================

    onProgress?.({ type: 'phase_start', phase: 'research', text: 'Începe cercetarea...' });

    const researchPrompt = `Cercetează pentru un document juridic.

## Nume document
${request.documentName}

${contextInfo.contextSection}

## Întrebarea de cercetare
${request.prompt}

Găsește surse relevante și organizează-le în formatul JSON specificat.`;

    const webSearchHandler = createWebSearchHandler();
    const researchModel = await getModelForFeature(firmId, 'research_document');

    const researchResponse = await aiClient.chatWithTools(
      [{ role: 'user', content: researchPrompt }],
      {
        feature: 'research_document',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model: researchModel,
        maxTokens: 4000, // Research notes don't need to be as long
        temperature: 0.3, // Lower temperature for structured output
        system: PHASE1_RESEARCH_PROMPT,
        tools: [WEB_SEARCH_TOOL],
        toolHandlers: { web_search: webSearchHandler },
        maxToolRounds: RESEARCH_CONFIG.maxToolRounds,
        onProgress: (event) => onProgress?.({ ...event, phase: 'research' }),
      }
    );

    totalInputTokens += researchResponse.inputTokens;
    totalOutputTokens += researchResponse.outputTokens;

    // Extract research notes from response
    const researchText = researchResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON from response (handle markdown code blocks or raw JSON)
    let researchNotes: ResearchNotes;
    try {
      // Try markdown code blocks first
      let jsonMatch =
        researchText.match(/```json\s*([\s\S]*?)\s*```/) ||
        researchText.match(/```\s*([\s\S]*?)\s*```/);

      let jsonString: string;
      if (jsonMatch) {
        jsonString = jsonMatch[1];
      } else {
        // Look for raw JSON object in the response (Claude might add text before/after)
        const jsonObjectMatch = researchText.match(/\{[\s\S]*"centralQuestion"[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonString = jsonObjectMatch[0];
        } else {
          jsonString = researchText;
        }
      }
      researchNotes = JSON.parse(jsonString.trim());

      logger.info('Phase 1 complete: Research notes parsed', {
        userId,
        sourcesFound: researchNotes.sources?.length || 0,
        positionsIdentified: researchNotes.positions?.length || 0,
        gapsNoted: researchNotes.gaps?.length || 0,
      });
    } catch (parseError) {
      logger.warn('Failed to parse research notes as JSON, falling back to single-phase', {
        userId,
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
      });

      // Fallback: Use the original single-phase approach
      return this.draftWithResearch(request, userId, firmId, startTime, onProgress);
    }

    onProgress?.({
      type: 'phase_complete',
      phase: 'research',
      text: `Cercetare completă: ${researchNotes.sources?.length || 0} surse găsite`,
    });

    // ========================================================================
    // PHASE 2: Writing
    // ========================================================================

    onProgress?.({ type: 'phase_start', phase: 'writing', text: 'Începe redactarea...' });

    // Give Claude creative freedom for styling
    const writingPrompt = `Creează un document HTML frumos și profesional.

Ai libertate deplină asupra stilului - fonturi, culori, spațiere.
Folosește inline styles. NU folosi markdown.

OBLIGATORIU: Fiecare sursă necesită footnote cu <sup><a href="#fnN">N</a></sup>

---

## Document: ${request.documentName}

## Instrucțiuni originale
${request.prompt}

${contextInfo.contextSection}

## NOTE DE CERCETARE (folosește EXCLUSIV aceste surse)

### Cum să folosești datele:

**sources[]** - Sursele găsite în cercetare
- sources[].id → identificator pentru referință (src1, src2...) - folosește ordinea pentru footnotes: src1 = [1], src2 = [2]
- sources[].citation → textul complet al citării pentru footnote (ex: "Art. 535 Cod Civil" sau "V. Stoica, Drept civil, p. 123")
- sources[].content → citat exact sau rezumat de integrat în textul documentului
- sources[].type → tipul sursei (legislation/jurisprudence/doctrine/comparative)
- sources[].relevance → de ce contează sursa pentru argument

**positions[]** - Interpretările/pozițiile identificate pe subiect
- positions[].position → descrierea interpretării
- positions[].status → majority/minority/contested/emerging
- positions[].sourceIds → referințe la sursele care susțin această poziție (ex: ["src1", "src3"])
- positions[].arguments → argumentele principale pentru această poziție
- positions[].counterarguments → obiecții sau slăbiciuni

**recommendedStructure[]** - Structura sugerată pentru document (urmează această ordine)

**keyTerms[]** - Termeni juridici de definit în document
- keyTerms[].term → termenul
- keyTerms[].definition → definiția
- keyTerms[].source → referința la sursa definiției

**gaps[]** - Lacune în cercetare de menționat (ex: "Nu am identificat jurisprudență ÎCCJ pe acest aspect")

### Datele cercetării:

${JSON.stringify(researchNotes, null, 2)}

---

Redactează documentul final folosind TOATE sursele de mai sus.
Integrează pozițiile diferite cu argumentele lor.
Urmează structura recomandată.
Creează un design profesional și elegant cu inline styles.`;

    // Writing phase doesn't need tools - pure composition
    // Use streaming to provide progress feedback during long generation
    const writingModel = await getModelForFeature(firmId, 'research_document');

    let writtenChars = 0;
    let lastProgressAt = 0;
    const PROGRESS_INTERVAL = 2000; // Emit progress every 2000 chars

    const writingResponse = await aiClient.completeStream(
      writingPrompt,
      {
        feature: 'research_document',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model: writingModel,
        maxTokens: RESEARCH_CONFIG.maxTokens,
        temperature: 0.5, // Slightly higher for creative composition
        system: PHASE2_WRITING_PROMPT,
      },
      (chunk) => {
        writtenChars += chunk.length;
        // Emit progress every PROGRESS_INTERVAL characters
        if (writtenChars - lastProgressAt >= PROGRESS_INTERVAL) {
          lastProgressAt = writtenChars;
          const kChars = Math.round(writtenChars / 100) / 10;
          onProgress?.({
            type: 'writing_progress',
            phase: 'writing',
            text: `Redactat ${kChars}k caractere...`,
          });
        }
      }
    );

    totalInputTokens += writingResponse.inputTokens;
    totalOutputTokens += writingResponse.outputTokens;

    // Extract HTML content, stripping any AI preamble text
    const rawContent = writingResponse.content;
    const htmlContent = extractHtmlContent(rawContent);

    onProgress?.({ type: 'phase_complete', phase: 'writing', text: 'Redactare completă' });

    logger.info('Two-phase research draft completed', {
      userId,
      firmId,
      totalTokens: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
      sourcesUsed: researchNotes.sources?.length || 0,
      htmlExtracted: htmlContent !== rawContent, // Log if we stripped preamble
    });

    // Generate OOXML only if requested
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
      tokensUsed: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ==========================================================================
  // Multi-Agent Research Architecture (Fan-out/Fan-in)
  // ==========================================================================

  /**
   * Multi-agent research document drafting with fan-out/fan-in architecture.
   *
   * Key innovation: Each section agent is ISOLATED (does own research + writes + summary).
   * Assembly only receives summaries, keeping context under 25k tokens.
   *
   * Architecture:
   * 1. Orchestrator: Parse prompt, calculate scope from sourceTypes × depth
   * 2. Fan-out: Spawn N parallel section agents (each does research + write + summary)
   * 3. Fan-in: Call assembly (Opus 4.5) with summaries only → intro/conclusion
   * 4. Merge: Deterministic stitch + footnote resolution
   *
   * Benefits:
   * - Parallel isolated agents = no context bloat
   * - Assembly context stays <25k tokens even for large documents
   * - Opus 4.5 synthesis produces coherent intro/conclusion
   * - Deterministic footnote ordering
   */
  async draftWithMultiAgent(
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    onProgress?: (event: {
      type: string;
      phase?: 'orchestrate' | 'writing' | 'assembly';
      tool?: string;
      input?: Record<string, unknown>;
      text?: string;
      sectionId?: string;
    }) => void
  ): Promise<WordDraftResponse> {
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Get context
    const contextInfo = await this.getContextForDraft(request, firmId);

    // Calculate scope from UI signals
    const sourceCount = request.sourceTypes?.length || 1;
    const depth: ResearchDepth = request.researchDepth || 'quick';
    const scope = calculateResearchScope(sourceCount, depth);

    logger.info('Starting fan-out/fan-in multi-agent research', {
      userId,
      firmId,
      documentName: request.documentName,
      sourceTypes: request.sourceTypes,
      depth,
      scope,
    });

    // ========================================================================
    // PHASE 1: Orchestrate - Plan sections based on scope
    // ========================================================================

    onProgress?.({ type: 'phase_start', phase: 'orchestrate', text: 'Planifică structura...' });

    const sectionPlans = this.planSectionsFromScope(
      request,
      scope,
      request.sourceTypes || ['legislation']
    );

    logger.info('Orchestrator: sections planned', {
      userId,
      sectionsPlanned: sectionPlans.length,
      totalTargetWords: scope.totalWords,
    });

    onProgress?.({
      type: 'phase_complete',
      phase: 'orchestrate',
      text: `Structură planificată: ${sectionPlans.length} secțiuni, ~${scope.estimatedPages} pagini`,
    });

    // ========================================================================
    // PHASE 2: Fan-out - Parallel isolated section agents
    // ========================================================================

    onProgress?.({
      type: 'phase_start',
      phase: 'writing',
      text: 'Redactează secțiunile în paralel...',
    });

    const sectionResults = await this.executeIsolatedSectionAgents(
      sectionPlans,
      request,
      userId,
      firmId,
      contextInfo,
      (sectionId, status, tokens) => {
        if (tokens) {
          totalInputTokens += tokens.input;
          totalOutputTokens += tokens.output;
        }
        onProgress?.({
          type: 'section_progress',
          phase: 'writing',
          sectionId,
          text: status,
        });
      }
    );

    // Check success rate
    const successRate = sectionResults.length / sectionPlans.length;
    if (successRate < 0.5) {
      logger.warn('Too many section failures, falling back to 2-phase', {
        userId,
        successRate,
        completed: sectionResults.length,
        total: sectionPlans.length,
      });
      // Note: We don't pass onProgress as the phases are different ('research'/'writing' vs 'orchestrate'/'writing'/'assembly')
      return this.draftWithResearchTwoPhase(request, userId, firmId);
    }

    logger.info('Fan-out complete: sections written', {
      userId,
      sectionsCompleted: sectionResults.length,
      totalSections: sectionPlans.length,
    });

    onProgress?.({
      type: 'phase_complete',
      phase: 'writing',
      text: `Secțiuni redactate: ${sectionResults.length}/${sectionPlans.length}`,
    });

    // ========================================================================
    // PHASE 3: Fan-in - Assembly with Opus 4.5
    // ========================================================================

    onProgress?.({
      type: 'phase_start',
      phase: 'assembly',
      text: 'Generează introducere și concluzii...',
    });

    // Collect summaries for assembly (keeps context small)
    const summaries = sectionResults.map((r, idx) => ({
      sectionNumber: idx + 1,
      heading: sectionPlans[idx]?.heading || `Secțiunea ${idx + 1}`,
      summary: r.summary,
    }));

    // Collect all sources for footnote resolution
    const allSources: Array<{ id: string; citation: string; url?: string }> = [];
    for (const result of sectionResults) {
      for (const source of result.sources) {
        if (!allSources.find((s) => s.id === source.id)) {
          allSources.push(source);
        }
      }
    }

    // Generate intro/conclusion with Opus 4.5
    const introConclusion = await this.generateIntroConclusion(
      request.documentName,
      request.prompt,
      summaries,
      [], // keyTerms can be extracted from summaries
      userId,
      firmId,
      contextInfo
    );

    totalInputTokens += introConclusion.inputTokens;
    totalOutputTokens += introConclusion.outputTokens;

    onProgress?.({
      type: 'phase_complete',
      phase: 'assembly',
      text: 'Introducere și concluzii generate',
    });

    // ========================================================================
    // PHASE 4: Merge - Deterministic stitch + footnote resolution
    // ========================================================================

    const finalContent = this.assembleDocumentFanIn(
      request.documentName,
      introConclusion.introduction,
      sectionResults.map((r) => r.html),
      introConclusion.conclusion,
      allSources
    );

    logger.info('Fan-out/fan-in multi-agent draft completed', {
      userId,
      firmId,
      totalTokens: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
      sectionsUsed: sectionResults.length,
      sourcesUsed: allSources.length,
    });

    // Generate OOXML only if requested
    const ooxmlContent = request.includeOoxml
      ? this.convertToOoxml(finalContent, {
          isResearch: true,
          title: request.documentName,
          subtitle: request.prompt.slice(0, 100),
        })
      : undefined;

    return {
      content: finalContent,
      ooxmlContent,
      title: request.documentName,
      tokensUsed: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Plan sections based on calculated scope.
   * Returns section plans without pre-assigned sources (each agent finds its own).
   */
  private planSectionsFromScope(
    request: WordDraftRequest,
    scope: ResearchScope,
    sourceTypes: string[]
  ): Array<{
    id: string;
    heading: string;
    topic: string;
    targetWordCount: number;
    sourceTypes: string[];
  }> {
    const sections: Array<{
      id: string;
      heading: string;
      topic: string;
      targetWordCount: number;
      sourceTypes: string[];
    }> = [];

    // Build section topics based on source types selected
    const topicMap: Record<string, string> = {
      legislation: 'Cadrul legislativ',
      jurisprudence: 'Jurisprudența relevantă',
      doctrine: 'Interpretări doctrinare',
      comparative: 'Perspectivă comparativă',
    };

    // Create sections based on source types
    for (let i = 0; i < Math.min(scope.sections, sourceTypes.length); i++) {
      const sourceType = sourceTypes[i];
      sections.push({
        id: `s${i + 1}`,
        heading: topicMap[sourceType] || `Secțiunea ${i + 1}`,
        topic: `Cercetează și analizează aspectul de ${topicMap[sourceType]?.toLowerCase() || sourceType} pentru: ${request.prompt}`,
        targetWordCount: scope.wordsPerSection,
        sourceTypes: [sourceType],
      });
    }

    // If we have more sections than source types, add analytical sections
    if (scope.sections > sourceTypes.length) {
      const remaining = scope.sections - sourceTypes.length;
      if (remaining >= 1) {
        sections.push({
          id: `s${sections.length + 1}`,
          heading: 'Analiză și interpretare',
          topic: `Sintetizează informațiile din perspectiva: ${request.prompt}`,
          targetWordCount: scope.wordsPerSection,
          sourceTypes: sourceTypes,
        });
      }
      if (remaining >= 2) {
        sections.push({
          id: `s${sections.length + 1}`,
          heading: 'Aplicabilitate practică',
          topic: `Analizează implicațiile practice pentru: ${request.prompt}`,
          targetWordCount: scope.wordsPerSection,
          sourceTypes: sourceTypes,
        });
      }
    }

    return sections;
  }

  /**
   * Execute isolated section agents in parallel.
   * Each agent does its own research + writes + produces summary.
   */
  private async executeIsolatedSectionAgents(
    sectionPlans: Array<{
      id: string;
      heading: string;
      topic: string;
      targetWordCount: number;
      sourceTypes: string[];
    }>,
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    contextInfo: {
      contextSection: string;
      entityType: 'case' | 'client' | 'firm';
      entityId: string | undefined;
    },
    onSectionProgress?: (
      sectionId: string,
      status: string,
      tokens?: { input: number; output: number }
    ) => void
  ): Promise<IsolatedSectionResult[]> {
    const limit = pLimit(3); // Max 3 concurrent agents
    const results: IsolatedSectionResult[] = [];

    const agentPromises = sectionPlans.map((plan) =>
      limit(async () => {
        onSectionProgress?.(plan.id, `Începe: ${plan.heading}...`);
        try {
          const result = await this.executeIsolatedSectionAgent(
            plan,
            request,
            userId,
            firmId,
            contextInfo,
            // Forward tool events with section prefix
            (event) => {
              if (event.type === 'tool_start') {
                const query = (event.input as { query?: string })?.query;
                onSectionProgress?.(plan.id, `[${plan.heading}] 🔍 ${query || 'Căutare...'}`);
              } else if (event.type === 'tool_end') {
                onSectionProgress?.(plan.id, `[${plan.heading}] ✓ Rezultate găsite`);
              }
            }
          );
          onSectionProgress?.(plan.id, `✓ ${plan.heading} completat`, {
            input: result.metadata?.inputTokens || 0,
            output: result.metadata?.outputTokens || 0,
          });
          return result;
        } catch (error) {
          logger.error('Isolated section agent failed', {
            sectionId: plan.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          onSectionProgress?.(plan.id, `✗ ${plan.heading} - eroare`);
          return null;
        }
      })
    );

    const settledResults = await Promise.allSettled(agentPromises);

    for (const result of settledResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    return results;
  }

  /**
   * Execute a single isolated section agent.
   * The agent does focused research + writes HTML + produces summary.
   */
  private async executeIsolatedSectionAgent(
    plan: {
      id: string;
      heading: string;
      topic: string;
      targetWordCount: number;
      sourceTypes: string[];
    },
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    contextInfo: {
      contextSection: string;
      entityType: 'case' | 'client' | 'firm';
      entityId: string | undefined;
    },
    onProgress?: (event: {
      type: string;
      tool?: string;
      input?: Record<string, unknown>;
      text?: string;
    }) => void
  ): Promise<IsolatedSectionResult & { metadata?: { inputTokens: number; outputTokens: number } }> {
    const sectionPrompt = `Redactezi secțiunea "${plan.heading}" pentru documentul "${request.documentName}".

## SARCINĂ

${plan.topic}

## CONTEXT DOCUMENT

${contextInfo.contextSection}

## ÎNTREBAREA DE CERCETARE ORIGINALĂ

${request.prompt}

## INSTRUCȚIUNI

1. Folosește web_search pentru a găsi surse de tip: ${plan.sourceTypes.join(', ')}
2. Redactează ~${plan.targetWordCount} cuvinte în HTML profesional
3. Fiecare sursă necesită footnote
4. Returnează JSON cu: html, summary (2-3 propoziții), sources

## TARGET

- Cuvinte: ${plan.targetWordCount}
- Focus pe: ${plan.sourceTypes.join(', ')}`;

    const webSearchHandler = createWebSearchHandler();

    const response = await aiClient.chatWithTools(
      [{ role: 'user', content: sectionPrompt }],
      {
        feature: 'research_document',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model: MULTI_AGENT_MODELS.sectionWriter,
        maxTokens: Math.max(3000, plan.targetWordCount * 4),
        temperature: 0.4,
        system: ISOLATED_SECTION_AGENT_PROMPT,
        tools: [WEB_SEARCH_TOOL],
        toolHandlers: { web_search: webSearchHandler },
        maxToolRounds: 15, // Thorough research per section
        onProgress,
      }
    );

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON response
    let result: IsolatedSectionResult;
    try {
      const jsonMatch =
        responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
        responseText.match(/\{[\s\S]*"html"[\s\S]*"summary"[\s\S]*\}/);

      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        result = JSON.parse(jsonString.trim());
      } else {
        // Fallback: treat response as HTML, generate synthetic summary
        result = {
          html: `<section id="${plan.id}"><h2>${plan.heading}</h2>${responseText}</section>`,
          summary: `Secțiunea analizează ${plan.topic.substring(0, 100)}...`,
          sources: [],
        };
      }
    } catch (parseError) {
      logger.warn('Failed to parse isolated section result, using fallback', {
        sectionId: plan.id,
        error: parseError instanceof Error ? parseError.message : 'Unknown',
      });
      result = {
        html: `<section id="${plan.id}"><h2>${plan.heading}</h2>${responseText}</section>`,
        summary: `Secțiunea analizează ${plan.topic.substring(0, 100)}...`,
        sources: [],
      };
    }

    return {
      ...result,
      metadata: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    };
  }

  /**
   * Generate introduction and conclusion using Opus 4.5.
   * Only receives summaries, keeping context under 25k tokens.
   */
  private async generateIntroConclusion(
    title: string,
    originalQuestion: string,
    summaries: Array<{ sectionNumber: number; heading: string; summary: string }>,
    keyTerms: Array<{ term: string; definition: string }>,
    userId: string,
    firmId: string,
    contextInfo: {
      contextSection: string;
      entityType: 'case' | 'client' | 'firm';
      entityId: string | undefined;
    }
  ): Promise<{
    introduction: string;
    conclusion: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const assemblyPrompt = `Generează introducerea și concluzia pentru documentul "${title}".

## ÎNTREBAREA ORIGINALĂ DE CERCETARE

${originalQuestion}

## REZUMATELE SECȚIUNILOR

${summaries.map((s) => `### ${s.sectionNumber}. ${s.heading}\n${s.summary}`).join('\n\n')}

${keyTerms.length > 0 ? `## TERMENI CHEIE\n${keyTerms.map((t) => `- **${t.term}**: ${t.definition}`).join('\n')}` : ''}

---

Generează introducerea (400-600 cuvinte) și concluzia (300-500 cuvinte) în format JSON.`;

    const response = await aiClient.chat(
      [{ role: 'user', content: assemblyPrompt }],
      {
        feature: 'research_document',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model: MULTI_AGENT_MODELS.assembly, // Opus 4.5
        maxTokens: 3000,
        temperature: 0.5,
        system: ASSEMBLY_PROMPT,
      }
    );

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON response
    let introduction = '';
    let conclusion = '';

    try {
      const jsonMatch =
        responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
        responseText.match(/\{[\s\S]*"introduction"[\s\S]*\}/);

      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonString.trim());
        introduction = parsed.introduction || '';
        conclusion = parsed.conclusion || '';
      }
    } catch {
      // Fallback: extract from response text
      logger.warn('Failed to parse assembly JSON, using fallback extraction');
      introduction = extractTag(responseText, 'section') || '';
      conclusion = '';
    }

    return {
      introduction,
      conclusion,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  }

  /**
   * Assemble final document from fan-in results.
   * Handles deterministic footnote resolution.
   */
  private assembleDocumentFanIn(
    title: string,
    introduction: string,
    sectionHtmls: string[],
    conclusion: string,
    allSources: Array<{ id: string; citation: string; url?: string }>
  ): string {
    // Build source map for footnote content
    const sourceMap = new Map<string, { citation: string; url?: string }>();
    for (const source of allSources) {
      sourceMap.set(source.id, { citation: source.citation, url: source.url });
    }

    // Track footnote assignments (source ID -> footnote number)
    const footnoteAssignments = new Map<string, number>();
    let nextFootnoteNumber = 1;

    // Process each section: replace footnote placeholders with numbers
    const processedSections: string[] = [];

    for (const html of sectionHtmls) {
      let processedHtml = html;

      // Find all footnote placeholders: [[src1]], [[src2]], etc.
      const placeholders = processedHtml.matchAll(/\[\[(src\d+)\]\]/g);

      for (const match of placeholders) {
        const sourceId = match[1];

        // Assign footnote number if not already assigned
        if (!footnoteAssignments.has(sourceId)) {
          footnoteAssignments.set(sourceId, nextFootnoteNumber++);
        }

        const fnNumber = footnoteAssignments.get(sourceId)!;
        const fnLink = `<sup><a href="#fn${fnNumber}" style="color: #0066cc; text-decoration: none;">${fnNumber}</a></sup>`;

        processedHtml = processedHtml.replace(match[0], fnLink);
      }

      // Also handle fn-{sourceId} format from isolated agents
      const fnPlaceholders = processedHtml.matchAll(/#fn-(src\d+)/g);
      for (const match of fnPlaceholders) {
        const sourceId = match[1];
        if (!footnoteAssignments.has(sourceId)) {
          footnoteAssignments.set(sourceId, nextFootnoteNumber++);
        }
        const fnNumber = footnoteAssignments.get(sourceId)!;
        processedHtml = processedHtml.replace(match[0], `#fn${fnNumber}`);
      }

      processedSections.push(processedHtml);
    }

    // Build footnote footer
    const footnotes: string[] = [];
    const sortedFootnotes = [...footnoteAssignments.entries()].sort((a, b) => a[1] - b[1]);

    for (const [sourceId, fnNumber] of sortedFootnotes) {
      const source = sourceMap.get(sourceId);
      if (source) {
        const citation = source.url
          ? `${source.citation} - <a href="${source.url}" style="color: #0066cc;">${source.url}</a>`
          : source.citation;
        footnotes.push(
          `<p id="fn${fnNumber}" style="margin: 5px 0; font-size: 0.9em;"><sup>${fnNumber}</sup> ${citation}</p>`
        );
      }
    }

    // Assemble final document
    const documentHtml = `<article style="font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333;">
  <header style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
    <h1 style="font-size: 1.8em; margin-bottom: 10px;">${title}</h1>
  </header>

  ${introduction ? `<section id="intro">${introduction}</section>` : ''}

  <main>
    ${processedSections.join('\n\n')}
  </main>

  ${conclusion ? `<section id="conclusion">${conclusion}</section>` : ''}

  ${
    footnotes.length > 0
      ? `
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
    <h2 style="font-size: 1.2em; margin-bottom: 15px;">Note de subsol</h2>
    ${footnotes.join('\n')}
  </footer>`
      : ''
  }
</article>`;

    return documentHtml;
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
   */
  async draftWithSingleWriter(
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    onProgress?: (event: {
      type: string;
      phase?: 'research' | 'writing' | 'formatting';
      tool?: string;
      input?: Record<string, unknown>;
      text?: string;
    }) => void
  ): Promise<WordDraftResponse> {
    const startTime = Date.now();

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
    });

    // ========================================================================
    // COMBINED RESEARCH + WRITING PHASE (Single Agent)
    // ========================================================================

    onProgress?.({
      type: 'phase_start',
      phase: 'research',
      text: 'Începe cercetarea și redactarea...',
    });

    // Build user prompt with context and instructions
    const sourceTypesStr = request.sourceTypes?.join(', ') || 'legislație, jurisprudență, doctrină';
    const userPrompt = `Creează un document de cercetare juridică.

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

    // Get configured model
    const model = await getModelForFeature(firmId, 'research_document');

    // Create web search handler
    const webSearchHandler = createWebSearchHandler();

    // Execute single-writer call with tools
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
        maxTokens: depthParams.maxTokens,
        temperature: 0.4,
        system: SINGLE_WRITER_PROMPT,
        tools: [WEB_SEARCH_TOOL],
        toolHandlers: { web_search: webSearchHandler },
        maxToolRounds: depthParams.maxSearchRounds,
        onProgress: (event) => {
          if (event.type === 'tool_start') {
            const query = (event.input as { query?: string })?.query;
            onProgress?.({
              type: 'tool_start',
              phase: 'research',
              tool: 'web_search',
              text: `🔍 ${query || 'Căutare...'}`,
            });
          } else if (event.type === 'tool_end') {
            onProgress?.({
              type: 'tool_end',
              phase: 'research',
              text: '✓ Rezultate găsite',
            });
          }
        },
      }
    );

    // Extract semantic HTML from response
    const rawContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Extract article content
    const semanticHtml = extractHtmlContent(rawContent);

    onProgress?.({
      type: 'phase_complete',
      phase: 'research',
      text: 'Cercetare și redactare completate',
    });

    // ========================================================================
    // FORMATTING PHASE (Code-Controlled)
    // ========================================================================

    onProgress?.({
      type: 'phase_start',
      phase: 'formatting',
      text: 'Aplică formatarea...',
    });

    // Create semantic normalizer with style config
    const semanticNormalizer = createSemanticNormalizer(RESEARCH_STYLE_CONFIG);

    // Apply all formatting transformations
    const styledHtml = semanticNormalizer.normalize(semanticHtml);

    onProgress?.({
      type: 'phase_complete',
      phase: 'formatting',
      text: 'Formatare completă',
    });

    logger.info('Single-writer research draft completed', {
      userId,
      firmId,
      totalTokens: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
      semanticHtmlLength: semanticHtml.length,
      styledHtmlLength: styledHtml.length,
    });

    // Generate OOXML if requested
    // Skip basic normalization since SemanticHtmlNormalizer already processed the HTML
    const ooxmlContent = request.includeOoxml
      ? this.convertToOoxml(styledHtml, {
          isResearch: true,
          title: request.documentName,
          subtitle: request.prompt.slice(0, 100),
          skipNormalization: true,
        })
      : undefined;

    return {
      content: styledHtml,
      ooxmlContent,
      title: request.documentName,
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
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
   */
  async draftStream(
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    onChunk: (chunk: string) => void,
    onProgress?: (event: {
      type: string;
      tool?: string;
      input?: Record<string, unknown>;
      text?: string;
    }) => void
  ): Promise<WordDraftResponse> {
    const startTime = Date.now();

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
      const result = await this.draftWithSingleWriter(request, userId, firmId, onProgress);
      onChunk(result.content);
      return result;
    }

    // Get context based on context type
    logger.info('Draft stream: fetching context', {
      contextType: request.contextType,
      clientId: request.clientId,
      caseId: request.caseId,
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

    // Get configured model for word_draft feature
    const model = await getModelForFeature(firmId, 'word_draft');
    logger.info('Draft stream: starting AI call', {
      firmId,
      model,
      promptLength: userPrompt.length,
    });

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
