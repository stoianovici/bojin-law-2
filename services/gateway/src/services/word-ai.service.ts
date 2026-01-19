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
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

// Import extracted modules
import { SYSTEM_PROMPTS } from './word-ai-prompts';
import {
  WEB_SEARCH_TOOL,
  createWebSearchHandler,
  RESEARCH_CONFIG,
  detectResearchIntent,
} from './word-ai-research';
import {
  PHASE1_RESEARCH_PROMPT,
  PHASE2_WRITING_PROMPT,
  OUTLINE_AGENT_PROMPT,
  SECTION_WRITER_PROMPT,
  type ResearchNotes,
  type DocumentOutline,
  type SectionPlan,
  type SectionContent,
  type CitationUsed,
} from './research-phases';
import pLimit from 'p-limit';

// ============================================================================
// Multi-Agent Model Configuration
// ============================================================================

/**
 * Model selection for multi-agent research pipeline.
 *
 * Strategic phases (Research, Outline) benefit from Opus's superior judgment.
 * Section writing is more mechanical and runs in parallel - Sonnet is cost-effective.
 */
const MULTI_AGENT_MODELS = {
  /** Phase 1: Research - strategic source finding and evaluation */
  research: 'firm_config', // Uses firm's research_document config (typically Opus)

  /** Phase 2: Outline - architectural planning and source assignment */
  outline: 'firm_config', // Uses firm's research_document config (typically Opus)

  /** Phase 3: Section Writers - follows plan, parallel calls, cost-sensitive */
  sectionWriter: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 - good quality, cost-effective for parallel
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

// ============================================================================
// Service
// ============================================================================

export class WordAIService {
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
      if (request.useMultiAgent) {
        return this.draftWithMultiAgent(request, userId, firmId);
      }

      // Use two-phase research if explicitly requested
      if (request.useTwoPhaseResearch) {
        return this.draftWithResearchTwoPhase(request, userId, firmId);
      }

      return this.draftWithResearch(request, userId, firmId, startTime);
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
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    logger.info('Word draft with research completed', {
      userId,
      firmId,
      contextType: request.contextType,
      caseId: request.caseId,
      clientId: request.clientId,
      tokensUsed: response.inputTokens + response.outputTokens,
      costEur: response.costEur,
    });

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

    // Parse JSON from response (handle potential markdown code blocks)
    let researchNotes: ResearchNotes;
    try {
      const jsonMatch = researchText.match(/```json\s*([\s\S]*?)\s*```/) ||
        researchText.match(/```\s*([\s\S]*?)\s*```/) || [null, researchText];
      const jsonString = jsonMatch[1] || researchText;
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

    const finalContent = writingResponse.content;

    onProgress?.({ type: 'phase_complete', phase: 'writing', text: 'Redactare completă' });

    logger.info('Two-phase research draft completed', {
      userId,
      firmId,
      totalTokens: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
      sourcesUsed: researchNotes.sources?.length || 0,
    });

    // Generate OOXML only if requested
    const ooxmlContent = request.includeOoxml
      ? htmlToOoxmlService.convert(finalContent)
      : undefined;

    return {
      content: finalContent,
      ooxmlContent,
      title: request.documentName,
      tokensUsed: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ==========================================================================
  // Multi-Agent Research Architecture (4-Phase)
  // ==========================================================================

  /**
   * Multi-agent research document drafting (4-phase pipeline).
   *
   * Phase 1: Research Agent - Finds and organizes sources (existing)
   * Phase 2: Outline Agent - Plans document structure and assigns sources
   * Phase 3: Section Writers - Write sections in parallel
   * Phase 4: Assembly - Deterministic footnote resolution and final HTML
   *
   * Benefits:
   * - Guaranteed correct footnote ordering (deterministic assembly)
   * - Better structure quality (planned upfront)
   * - Parallel section writing (faster for large documents)
   * - Partial success recovery (>50% sections = success)
   */
  async draftWithMultiAgent(
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    onProgress?: (event: {
      type: string;
      phase?: 'research' | 'outline' | 'writing' | 'assembly';
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

    logger.info('Starting multi-agent research draft', {
      userId,
      firmId,
      documentName: request.documentName,
    });

    // ========================================================================
    // PHASE 1: Research (existing logic)
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

    logger.info('Multi-agent model selection', {
      userId,
      phase1_research: researchModel,
      phase2_outline: researchModel, // Same as research (firm config)
      phase3_sectionWriter: MULTI_AGENT_MODELS.sectionWriter,
    });

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
        maxTokens: 4000,
        temperature: 0.3,
        system: PHASE1_RESEARCH_PROMPT,
        tools: [WEB_SEARCH_TOOL],
        toolHandlers: { web_search: webSearchHandler },
        maxToolRounds: RESEARCH_CONFIG.maxToolRounds,
        onProgress: (event) => onProgress?.({ ...event, phase: 'research' }),
      }
    );

    totalInputTokens += researchResponse.inputTokens;
    totalOutputTokens += researchResponse.outputTokens;

    // Parse research notes
    const researchText = researchResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let researchNotes: ResearchNotes;
    try {
      const jsonMatch = researchText.match(/```json\s*([\s\S]*?)\s*```/) ||
        researchText.match(/```\s*([\s\S]*?)\s*```/) || [null, researchText];
      const jsonString = jsonMatch[1] || researchText;
      researchNotes = JSON.parse(jsonString.trim());

      logger.info('Phase 1 complete: Research notes parsed', {
        userId,
        sourcesFound: researchNotes.sources?.length || 0,
        positionsIdentified: researchNotes.positions?.length || 0,
      });
    } catch (parseError) {
      logger.warn('Failed to parse research notes, falling back to 2-phase', {
        userId,
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
      });
      return this.draftWithResearchTwoPhase(request, userId, firmId, onProgress);
    }

    onProgress?.({
      type: 'phase_complete',
      phase: 'research',
      text: `Cercetare completă: ${researchNotes.sources?.length || 0} surse găsite`,
    });

    // ========================================================================
    // PHASE 2: Outline
    // ========================================================================

    onProgress?.({ type: 'phase_start', phase: 'outline', text: 'Planifică structura...' });

    let outline: DocumentOutline;
    try {
      outline = await this.executeOutlinePhase(researchNotes, request, userId, firmId, contextInfo);
      totalInputTokens += outline.estimatedFootnotes; // Rough proxy for tokens used

      logger.info('Phase 2 complete: Outline created', {
        userId,
        sectionsPlanned: outline.sections.length,
        estimatedFootnotes: outline.estimatedFootnotes,
      });
    } catch (outlineError) {
      logger.warn('Failed to create outline, falling back to 2-phase', {
        userId,
        error: outlineError instanceof Error ? outlineError.message : 'Unknown error',
      });
      return this.draftWithResearchTwoPhase(request, userId, firmId, onProgress);
    }

    onProgress?.({
      type: 'phase_complete',
      phase: 'outline',
      text: `Structură planificată: ${outline.sections.length} secțiuni`,
    });

    // ========================================================================
    // PHASE 3: Section Writers (Parallel)
    // ========================================================================

    onProgress?.({ type: 'phase_start', phase: 'writing', text: 'Redactează secțiunile...' });

    let sectionContents: SectionContent[];
    try {
      const writeResult = await this.writeSectionsInParallel(
        outline,
        researchNotes,
        userId,
        firmId,
        contextInfo,
        (sectionId, status) => {
          onProgress?.({
            type: 'section_progress',
            phase: 'writing',
            sectionId,
            text: status,
          });
        }
      );
      sectionContents = writeResult.sections;
      totalInputTokens += writeResult.totalInputTokens;
      totalOutputTokens += writeResult.totalOutputTokens;

      // Check if we have enough sections (>50% success)
      const successRate = sectionContents.length / outline.sections.length;
      if (successRate < 0.5) {
        logger.warn('Too many section failures, falling back to 2-phase', {
          userId,
          successRate,
          completed: sectionContents.length,
          total: outline.sections.length,
        });
        return this.draftWithResearchTwoPhase(request, userId, firmId, onProgress);
      }

      logger.info('Phase 3 complete: Sections written', {
        userId,
        sectionsCompleted: sectionContents.length,
        totalSections: outline.sections.length,
      });
    } catch (writeError) {
      logger.warn('Section writing failed, falling back to 2-phase', {
        userId,
        error: writeError instanceof Error ? writeError.message : 'Unknown error',
      });
      return this.draftWithResearchTwoPhase(request, userId, firmId, onProgress);
    }

    onProgress?.({
      type: 'phase_complete',
      phase: 'writing',
      text: `Secțiuni redactate: ${sectionContents.length}/${outline.sections.length}`,
    });

    // ========================================================================
    // PHASE 4: Assembly (Deterministic)
    // ========================================================================

    onProgress?.({ type: 'phase_start', phase: 'assembly', text: 'Asamblează documentul...' });

    const finalContent = this.assembleDocument(outline, sectionContents, researchNotes);

    onProgress?.({ type: 'phase_complete', phase: 'assembly', text: 'Document complet' });

    logger.info('Multi-agent research draft completed', {
      userId,
      firmId,
      totalTokens: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
      sectionsUsed: sectionContents.length,
    });

    // Generate OOXML only if requested
    const ooxmlContent = request.includeOoxml
      ? htmlToOoxmlService.convert(finalContent)
      : undefined;

    return {
      content: finalContent,
      ooxmlContent,
      title: outline.title || request.documentName,
      tokensUsed: totalInputTokens + totalOutputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Execute Phase 2: Generate document outline from research notes.
   */
  private async executeOutlinePhase(
    researchNotes: ResearchNotes,
    request: WordDraftRequest,
    userId: string,
    firmId: string,
    contextInfo: {
      contextSection: string;
      entityType: 'case' | 'client' | 'firm';
      entityId: string | undefined;
    }
  ): Promise<DocumentOutline> {
    const outlinePrompt = `Creează un plan detaliat pentru document.

## Document: ${request.documentName}

## Instrucțiuni originale
${request.prompt}

${contextInfo.contextSection}

## NOTE DE CERCETARE

${JSON.stringify(researchNotes, null, 2)}

---

Creează planul documentului în formatul JSON specificat.
Asigură-te că TOATE sursele sunt asignate cel puțin unei secțiuni.`;

    const outlineModel = await getModelForFeature(firmId, 'research_document');

    const outlineResponse = await aiClient.chat(
      [{ role: 'user', content: outlinePrompt }],
      {
        feature: 'research_document',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model: outlineModel,
        maxTokens: 2000,
        temperature: 0.3,
        system: OUTLINE_AGENT_PROMPT,
      }
    );

    const outlineText = outlineResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON
    const jsonMatch = outlineText.match(/```json\s*([\s\S]*?)\s*```/) ||
      outlineText.match(/```\s*([\s\S]*?)\s*```/) || [null, outlineText];
    const jsonString = jsonMatch[1] || outlineText;
    const outline: DocumentOutline = JSON.parse(jsonString.trim());

    // Validate outline
    this.validateOutline(outline, researchNotes);

    return outline;
  }

  /**
   * Validate outline has proper structure and all sources assigned.
   */
  private validateOutline(outline: DocumentOutline, researchNotes: ResearchNotes): void {
    if (!outline.title || !outline.sections || outline.sections.length === 0) {
      throw new Error('Invalid outline: missing title or sections');
    }

    // Check all sources are assigned
    const assignedSourceIds = new Set<string>();
    for (const section of outline.sections) {
      for (const sourceId of section.assignedSourceIds || []) {
        assignedSourceIds.add(sourceId);
      }
    }

    const allSourceIds = new Set(researchNotes.sources?.map((s) => s.id) || []);
    const unassigned = [...allSourceIds].filter((id) => !assignedSourceIds.has(id));

    if (unassigned.length > 0) {
      logger.warn('Some sources not assigned to sections', {
        unassigned,
        total: allSourceIds.size,
      });
      // Don't throw - just warn. The document can still be valid.
    }

    // Validate section structure
    for (const section of outline.sections) {
      if (!section.id || !section.heading || !section.number) {
        throw new Error(`Invalid section: missing required fields in ${JSON.stringify(section)}`);
      }
    }
  }

  /**
   * Write sections in parallel with concurrency control.
   */
  private async writeSectionsInParallel(
    outline: DocumentOutline,
    researchNotes: ResearchNotes,
    userId: string,
    firmId: string,
    contextInfo: {
      contextSection: string;
      entityType: 'case' | 'client' | 'firm';
      entityId: string | undefined;
    },
    onSectionProgress?: (sectionId: string, status: string) => void
  ): Promise<{ sections: SectionContent[]; totalInputTokens: number; totalOutputTokens: number }> {
    const limit = pLimit(3); // Max 3 concurrent section writers
    const completedSections: SectionContent[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Group sections by dependency
    const noDeps = outline.sections.filter((s) => !s.dependsOn);
    const withDeps = outline.sections.filter((s) => s.dependsOn);

    // Write sections without dependencies in parallel
    const noDepResults = await Promise.allSettled(
      noDeps.map((section) =>
        limit(async () => {
          onSectionProgress?.(section.id, 'Începe...');
          try {
            const result = await this.writeSingleSection(
              section,
              outline,
              researchNotes,
              userId,
              firmId,
              contextInfo
            );
            onSectionProgress?.(section.id, 'Completat');
            return result;
          } catch (error) {
            onSectionProgress?.(section.id, 'Eroare');
            throw error;
          }
        })
      )
    );

    // Collect successful results
    for (const result of noDepResults) {
      if (result.status === 'fulfilled' && result.value) {
        completedSections.push(result.value);
        totalInputTokens += result.value.metadata.inputTokens;
        totalOutputTokens += result.value.metadata.outputTokens;
      }
    }

    // Write sections with dependencies sequentially
    for (const section of withDeps) {
      // Check if dependency is completed
      const depCompleted = completedSections.some((s) => s.sectionId === section.dependsOn);
      if (!depCompleted) {
        logger.warn('Skipping section due to missing dependency', {
          sectionId: section.id,
          dependsOn: section.dependsOn,
        });
        continue;
      }

      onSectionProgress?.(section.id, 'Începe...');
      try {
        const result = await this.writeSingleSection(
          section,
          outline,
          researchNotes,
          userId,
          firmId,
          contextInfo
        );
        completedSections.push(result);
        totalInputTokens += result.metadata.inputTokens;
        totalOutputTokens += result.metadata.outputTokens;
        onSectionProgress?.(section.id, 'Completat');
      } catch (error) {
        onSectionProgress?.(section.id, 'Eroare');
        logger.error('Failed to write section with dependency', {
          sectionId: section.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { sections: completedSections, totalInputTokens, totalOutputTokens };
  }

  /**
   * Write a single section using the Section Writer prompt.
   */
  private async writeSingleSection(
    section: SectionPlan,
    outline: DocumentOutline,
    researchNotes: ResearchNotes,
    userId: string,
    firmId: string,
    contextInfo: {
      contextSection: string;
      entityType: 'case' | 'client' | 'firm';
      entityId: string | undefined;
    }
  ): Promise<SectionContent> {
    const startTime = Date.now();

    // Get assigned sources
    const assignedSources =
      researchNotes.sources?.filter((s) => section.assignedSourceIds.includes(s.id)) || [];

    // Get assigned positions
    const assignedPositions =
      researchNotes.positions?.filter((_, idx) =>
        section.assignedPositionIds?.includes(`pos${idx + 1}`)
      ) || [];

    const sectionPrompt = `Redactează secțiunea "${section.heading}" pentru documentul "${outline.title}".

## PLANUL SECȚIUNII

${JSON.stringify(section, null, 2)}

## SURSELE ASIGNATE

${JSON.stringify(assignedSources, null, 2)}

## POZIȚIILE DE DISCUTAT

${JSON.stringify(assignedPositions, null, 2)}

---

Folosește placeholder-uri [[srcN]] pentru citări.
Respectă targetWordCount: ${section.targetWordCount} cuvinte.
Output: HTML pentru secțiune + metadata JSON.`;

    // Use Sonnet 4.5 for section writing - more mechanical work, parallel calls, cost-effective
    const model = MULTI_AGENT_MODELS.sectionWriter;

    const response = await aiClient.chat(
      [{ role: 'user', content: sectionPrompt }],
      {
        feature: 'research_document',
        userId,
        firmId,
        entityType: contextInfo.entityType,
        entityId: contextInfo.entityId,
      },
      {
        model,
        maxTokens: Math.max(1000, section.targetWordCount * 2),
        temperature: 0.4,
        system: SECTION_WRITER_PROMPT,
      }
    );

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse HTML and metadata from response
    const htmlMatch = responseText.match(/<SECTION_HTML>([\s\S]*?)<\/SECTION_HTML>/);
    const metadataMatch = responseText.match(/<SECTION_METADATA>([\s\S]*?)<\/SECTION_METADATA>/);

    // Fallback: if no structured output, treat entire response as HTML
    let html = htmlMatch?.[1]?.trim() || responseText;

    // Ensure it's wrapped in a section tag
    if (!html.includes('<section')) {
      html = `<section id="${section.id}">\n<h${section.level + 1}>${section.number}. ${section.heading}</h${section.level + 1}>\n${html}\n</section>`;
    }

    // Parse metadata or create default
    let citationsUsed: CitationUsed[] = [];
    let wordCount = section.targetWordCount;

    if (metadataMatch?.[1]) {
      try {
        const metadata = JSON.parse(metadataMatch[1].trim());
        citationsUsed = metadata.citationsUsed || [];
        wordCount = metadata.wordCount || wordCount;
      } catch {
        // Use defaults
      }
    }

    // Extract citations from placeholders if metadata parsing failed
    if (citationsUsed.length === 0) {
      const placeholderMatches = html.matchAll(/\[\[(src\d+)\]\]/g);
      let order = 1;
      for (const match of placeholderMatches) {
        citationsUsed.push({
          sourceId: match[1],
          quoteUsed: '',
          placeholderMarker: match[0],
          orderInSection: order++,
        });
      }
    }

    return {
      sectionId: section.id,
      html,
      citationsUsed,
      wordCount,
      metadata: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Assemble final document from sections (deterministic).
   * Handles footnote numbering by first-citation order.
   */
  private assembleDocument(
    outline: DocumentOutline,
    sectionContents: SectionContent[],
    researchNotes: ResearchNotes
  ): string {
    // Build source map for footnote content
    const sourceMap = new Map<string, { citation: string; url?: string }>();
    for (const source of researchNotes.sources || []) {
      sourceMap.set(source.id, { citation: source.citation, url: source.url });
    }

    // Track footnote assignments (source ID -> footnote number)
    const footnoteAssignments = new Map<string, number>();
    let nextFootnoteNumber = 1;

    // Sort sections by outline order
    const sectionOrder = new Map<string, number>();
    outline.sections.forEach((s, idx) => sectionOrder.set(s.id, idx));
    const orderedSections = [...sectionContents].sort(
      (a, b) => (sectionOrder.get(a.sectionId) ?? 999) - (sectionOrder.get(b.sectionId) ?? 999)
    );

    // Process each section: replace placeholders with footnote numbers
    const processedSections: string[] = [];

    for (const section of orderedSections) {
      let html = section.html;

      // Find all placeholders in this section
      const placeholders = html.matchAll(/\[\[(src\d+)\]\]/g);

      for (const match of placeholders) {
        const sourceId = match[1];

        // Assign footnote number if not already assigned
        if (!footnoteAssignments.has(sourceId)) {
          footnoteAssignments.set(sourceId, nextFootnoteNumber++);
        }

        const fnNumber = footnoteAssignments.get(sourceId)!;
        const fnLink = `<sup><a href="#fn${fnNumber}" style="color: #0066cc; text-decoration: none;">${fnNumber}</a></sup>`;

        // Replace placeholder with footnote link
        html = html.replace(match[0], fnLink);
      }

      processedSections.push(html);
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
    <h1 style="font-size: 1.8em; margin-bottom: 10px;">${outline.title}</h1>
  </header>

  <main>
    ${processedSections.join('\n\n')}
  </main>

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
      if (request.useMultiAgent) {
        const result = await this.draftWithMultiAgent(request, userId, firmId, onProgress);
        onChunk(result.content);
        return result;
      }

      // Use two-phase research if explicitly requested
      if (request.useTwoPhaseResearch) {
        const result = await this.draftWithResearchTwoPhase(request, userId, firmId, onProgress);
        onChunk(result.content);
        return result;
      }

      // Use research flow with progress callback for tool visibility
      const result = await this.draftWithResearch(request, userId, firmId, startTime, onProgress);
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
