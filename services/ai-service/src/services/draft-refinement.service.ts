/**
 * Draft Refinement Service
 * Story 5.3: AI-Powered Email Drafting - Tasks 10 & 11
 *
 * Provides AI-powered draft refinement and inline suggestions:
 * - Refine drafts based on user instructions
 * - Preserve user edits while applying refinements
 * - Provide inline suggestions during editing
 * - Track refinement history for learning
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeModel, AIOperationType } from '@legal-platform/types';
import { chat } from '../lib/claude/client';
import { tokenTracker } from './token-tracker.service';
import logger from '../lib/logger';
import type { CaseContext } from './email-drafting.service';

// ============================================================================
// Types
// ============================================================================

export interface RefinementParams {
  draftId: string;
  currentBody: string;
  instruction: string;
  caseContext?: CaseContext;
  firmId: string;
  userId: string;
}

export interface RefinementResult {
  refinedBody: string;
  refinedHtmlBody: string;
  changesApplied: string[];
  tokensUsed: number;
}

export interface InlineSuggestion {
  type: 'completion' | 'correction' | 'improvement';
  suggestion: string;
  confidence: number;
  reason?: string;
}

export interface DraftContext {
  originalEmailSubject: string;
  originalEmailBody: string;
  recipientType: string;
  tone: string;
  caseTitle?: string;
}

// ============================================================================
// Prompts
// ============================================================================

// Common refinement instructions with Romanian translations
const COMMON_REFINEMENTS: Record<string, { en: string; ro: string }> = {
  shorter: {
    en: 'Make this email shorter and more concise while keeping the key points.',
    ro: 'Fă acest email mai scurt și concis, păstrând punctele cheie.',
  },
  more_formal: {
    en: 'Make this email more formal and professional, using appropriate legal language.',
    ro: 'Fă acest email mai formal și profesional, folosind limbaj juridic adecvat.',
  },
  add_details: {
    en: 'Add more details and explanations to make the email more comprehensive.',
    ro: 'Adaugă mai multe detalii și explicații pentru a face emailul mai comprehensiv.',
  },
  translate_ro: {
    en: 'Translate this email to Romanian while maintaining professional tone.',
    ro: 'Traduceți acest email în română, menținând tonul profesional.',
  },
  translate_en: {
    en: 'Translate this email to English while maintaining professional tone.',
    ro: 'Traduceți acest email în engleză, menținând tonul profesional.',
  },
};

const REFINEMENT_SYSTEM_PROMPT = `You are an AI assistant helping refine email drafts for a Romanian law firm.

CRITICAL RULES:
1. Apply the requested refinement while preserving the core message
2. Maintain the original intent and key points
3. Keep the same salutation and closing style unless specifically asked to change
4. Preserve any case-specific references (case numbers, document names, dates)
5. Do not add new information not implied by the refinement request
6. Maintain appropriate legal language for the context

CASE CONTEXT (if available):
{caseContext}`;

const REFINEMENT_HUMAN_PROMPT = `Current email draft:
---
{currentBody}
---

Refinement request: {instruction}

Please refine the email according to the request.
Return your response as JSON:
{
  "refinedBody": "string (plain text of refined email)",
  "refinedHtmlBody": "string (HTML formatted version)",
  "changesApplied": ["array of changes you made"]
}`;

const INLINE_SUGGESTION_SYSTEM_PROMPT = `You are an AI assistant providing real-time suggestions for email composition in a Romanian law firm.

CONTEXT:
- Original email subject: {originalSubject}
- Recipient type: {recipientType}
- Desired tone: {tone}
- Case: {caseTitle}

Provide helpful suggestions that:
1. Complete the user's thought if they appear to be mid-sentence
2. Correct any grammatical or spelling errors
3. Suggest improvements to legal language or clarity

Be concise - suggestions should be natural continuations or corrections.`;

const INLINE_SUGGESTION_HUMAN_PROMPT = `The user is writing an email and paused after:
---
{partialText}
---

Original email they are replying to:
{originalBody}

Provide a helpful suggestion (completion, correction, or improvement).
Return JSON:
{
  "type": "completion" | "correction" | "improvement",
  "suggestion": "string",
  "confidence": number (0-1),
  "reason": "optional brief explanation"
}`;

// ============================================================================
// Service
// ============================================================================

export class DraftRefinementService {
  /**
   * Refine a draft based on user instruction
   * Task 10: Draft Refinement
   */
  async refineDraft(params: RefinementParams): Promise<RefinementResult> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.info('Starting draft refinement', {
      requestId,
      draftId: params.draftId,
      instructionLength: params.instruction.length,
    });

    try {
      // Normalize instruction (check for common refinements)
      const normalizedInstruction = this.normalizeInstruction(params.instruction);

      // Build prompt variables
      const caseContextStr = params.caseContext
        ? this.formatCaseContext(params.caseContext)
        : 'No case context available.';

      // Build system prompt with interpolated values
      const systemPrompt = REFINEMENT_SYSTEM_PROMPT.replace('{caseContext}', caseContextStr);

      // Build user prompt with interpolated values
      const userPrompt = REFINEMENT_HUMAN_PROMPT.replace(
        '{currentBody}',
        params.currentBody
      ).replace('{instruction}', normalizedInstruction);

      // Generate response using direct Anthropic SDK
      const response = await chat(systemPrompt, userPrompt, {
        model: ClaudeModel.Sonnet,
        maxTokens: 2048,
        temperature: 0.2,
      });

      const latencyMs = Date.now() - startTime;

      // Parse JSON response
      const parsed = this.parseRefinementResponse(response.content);

      // Track token usage
      await tokenTracker.recordUsage({
        operationType: AIOperationType.TextGeneration,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        modelUsed: ClaudeModel.Sonnet,
        userId: params.userId,
        firmId: params.firmId,
        latencyMs,
      });

      const result: RefinementResult = {
        refinedBody: parsed.refinedBody,
        refinedHtmlBody: parsed.refinedHtmlBody || this.convertToHtml(parsed.refinedBody),
        changesApplied: parsed.changesApplied || [normalizedInstruction],
        tokensUsed: response.inputTokens + response.outputTokens,
      };

      logger.info('Draft refinement completed', {
        requestId,
        latencyMs: Date.now() - startTime,
        changesCount: result.changesApplied.length,
        tokensUsed: result.tokensUsed,
      });

      return result;
    } catch (error) {
      logger.error('Draft refinement failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get inline suggestions during draft editing
   * Task 11: Inline AI Assistance
   */
  async getInlineSuggestions(
    partialText: string,
    context: DraftContext,
    firmId: string,
    userId: string
  ): Promise<InlineSuggestion | null> {
    const startTime = Date.now();
    const requestId = uuidv4();

    // Don't provide suggestions for very short text
    if (partialText.length < 10) {
      return null;
    }

    logger.debug('Getting inline suggestion', {
      requestId,
      textLength: partialText.length,
    });

    try {
      // Build system prompt with interpolated values
      const systemPrompt = INLINE_SUGGESTION_SYSTEM_PROMPT.replace(
        '{originalSubject}',
        context.originalEmailSubject
      )
        .replace('{recipientType}', context.recipientType)
        .replace('{tone}', context.tone)
        .replace('{caseTitle}', context.caseTitle || 'N/A');

      // Build user prompt with interpolated values
      const userPrompt = INLINE_SUGGESTION_HUMAN_PROMPT.replace(
        '{partialText}',
        partialText.slice(-500)
      ).replace('{originalBody}', context.originalEmailBody.slice(0, 500));

      // Generate response using direct Anthropic SDK
      const response = await chat(systemPrompt, userPrompt, {
        model: ClaudeModel.Haiku,
        maxTokens: 256,
        temperature: 0.3,
      });

      const latencyMs = Date.now() - startTime;

      // Parse JSON response
      const parsed = this.parseInlineSuggestionResponse(response.content);

      // Track token usage
      await tokenTracker.recordUsage({
        operationType: AIOperationType.TextGeneration,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        modelUsed: ClaudeModel.Haiku,
        userId,
        firmId,
        latencyMs,
      });

      logger.debug('Inline suggestion generated', {
        requestId,
        latencyMs: Date.now() - startTime,
        type: parsed?.type,
        confidence: parsed?.confidence,
      });

      return parsed;
    } catch (error) {
      logger.warn('Inline suggestion failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Normalize instruction to match common refinements
   */
  private normalizeInstruction(instruction: string): string {
    const lowerInstruction = instruction.toLowerCase().trim();

    // Check for common refinement patterns
    if (
      lowerInstruction.includes('shorter') ||
      lowerInstruction.includes('scurt') ||
      lowerInstruction.includes('concis')
    ) {
      return COMMON_REFINEMENTS.shorter.en;
    }

    if (lowerInstruction.includes('formal') || lowerInstruction.includes('professional')) {
      return COMMON_REFINEMENTS.more_formal.en;
    }

    if (
      lowerInstruction.includes('detail') ||
      lowerInstruction.includes('explain') ||
      lowerInstruction.includes('detalii')
    ) {
      return COMMON_REFINEMENTS.add_details.en;
    }

    if (
      lowerInstruction.includes('translate to romanian') ||
      lowerInstruction.includes('în română')
    ) {
      return COMMON_REFINEMENTS.translate_ro.en;
    }

    if (
      lowerInstruction.includes('translate to english') ||
      lowerInstruction.includes('în engleză')
    ) {
      return COMMON_REFINEMENTS.translate_en.en;
    }

    return instruction;
  }

  /**
   * Format case context for prompt
   */
  private formatCaseContext(context: CaseContext): string {
    return `Case: ${context.case.title} (${context.case.caseNumber})
Client: ${context.case.client.name}
Status: ${context.case.status}`;
  }

  /**
   * Parse refinement response JSON
   */
  private parseRefinementResponse(response: string): {
    refinedBody: string;
    refinedHtmlBody?: string;
    changesApplied?: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.warn('Failed to parse refinement response as JSON', { response });
      return {
        refinedBody: response,
      };
    }
  }

  /**
   * Parse inline suggestion response JSON
   */
  private parseInlineSuggestionResponse(response: string): InlineSuggestion | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.suggestion || !parsed.type) {
        return null;
      }

      return {
        type: parsed.type,
        suggestion: parsed.suggestion,
        confidence: parsed.confidence || 0.7,
        reason: parsed.reason,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert plain text to basic HTML
   */
  private convertToHtml(text: string): string {
    return text
      .split('\n\n')
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
}

// Export singleton instance
export const draftRefinementService = new DraftRefinementService();
