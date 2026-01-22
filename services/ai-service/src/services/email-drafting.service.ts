/**
 * Email Drafting Service
 * Story 5.3: AI-Powered Email Drafting
 *
 * Generates contextual email responses using AI based on case context and email thread history
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeModel, AIOperationType } from '@legal-platform/types';
import { chat } from '../lib/claude/client';
import { tokenTracker } from './token-tracker.service';
import { cacheService } from './cache.service';
import logger from '../lib/logger';
import { config } from '../config';

// Email tone options matching Prisma enum
export enum EmailTone {
  Formal = 'Formal', // Court, official correspondence
  Professional = 'Professional', // Standard business communication
  Brief = 'Brief', // Quick acknowledgment, simple responses
  Detailed = 'Detailed', // Comprehensive, thorough explanations
}

// Recipient type options matching Prisma enum
export enum RecipientType {
  Client = 'Client',
  OpposingCounsel = 'OpposingCounsel',
  Court = 'Court',
  ThirdParty = 'ThirdParty',
  Internal = 'Internal',
}

// Email address structure
export interface EmailAddress {
  name?: string;
  address: string;
}

// Email structure from database
export interface Email {
  id: string;
  graphMessageId: string;
  subject: string;
  bodyContent: string;
  bodyContentType: string;
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  receivedDateTime: Date;
  sentDateTime: Date;
  hasAttachments: boolean;
}

// Case context for draft generation
export interface CaseContext {
  case: {
    id: string;
    title: string;
    caseNumber: string;
    type: string;
    status: string;
    client: {
      id: string;
      name: string;
      email?: string;
    };
    opposingParties: Array<{
      id: string;
      name: string;
      role: string;
    }>;
  };
  recentDocuments: Array<{
    id: string;
    fileName: string;
    fileType: string;
    uploadedAt: Date;
  }>;
  priorCommunications: Array<{
    subject: string;
    date: Date;
    summary: string;
  }>;
  activeDeadlines: Array<{
    description: string;
    dueDate: Date;
  }>;
  pendingTasks: Array<{
    title: string;
    priority: string;
    dueDate?: Date;
  }>;
  extractedCommitments: Array<{
    party: string;
    commitmentText: string;
    dueDate?: Date;
  }>;
  riskIndicators: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
}

// User preferences for draft generation
export interface UserPreferences {
  preferredTone?: EmailTone;
  signatureTemplate?: string;
  languagePreference?: 'ro' | 'en';
}

// Draft generation input parameters
export interface DraftGenerationParams {
  originalEmail: Email;
  caseContext?: CaseContext;
  threadHistory: Email[];
  tone: EmailTone;
  recipientType: RecipientType;
  userPreferences?: UserPreferences;
  firmId: string;
  userId: string;
  // Pre-compiled rich context from gateway (case + client context)
  richContext?: string;
}

// Suggested attachment structure
export interface SuggestedAttachment {
  documentId: string;
  title: string;
  reason: string;
  relevanceScore: number;
}

// Draft generation result
export interface DraftGenerationResult {
  subject: string;
  body: string;
  htmlBody: string;
  confidence: number;
  suggestedAttachments: SuggestedAttachment[];
  keyPointsAddressed: string[];
  tokensUsed: {
    input: number;
    output: number;
  };
}

// Multiple drafts result
export interface MultipleDraftsResult {
  drafts: Array<{
    tone: EmailTone;
    draft: DraftGenerationResult;
  }>;
  recommendedTone: EmailTone;
  recommendationReason: string;
}

// Tone-specific prompt templates
const TONE_PROMPTS: Record<EmailTone, string> = {
  [EmailTone.Formal]: `
Use formal legal language appropriate for court or official correspondence.
Address the recipient by their title (e.g., "Onorate Instanță", "Stimat Domn/Doamnă").
Use passive voice where appropriate.
Include proper salutations and closings.
Maintain maximum formality throughout.`,

  [EmailTone.Professional]: `
Use standard business communication language.
Be clear and concise while maintaining professionalism.
Address the recipient appropriately based on relationship.
Include appropriate salutation and professional closing.`,

  [EmailTone.Brief]: `
Keep the response concise and to the point.
Acknowledge receipt or confirm understanding.
Omit unnecessary pleasantries while remaining polite.
Maximum 3-4 sentences for simple matters.
Focus on essential information only.`,

  [EmailTone.Detailed]: `
Provide comprehensive explanations.
Address all points raised in the original email.
Include relevant background context.
Use numbered lists for multiple items.
Be thorough while maintaining clarity.`,
};

// Recipient type adaptations
const RECIPIENT_ADAPTATIONS: Record<
  RecipientType,
  {
    languageLevel: string;
    includeExplanations: boolean;
    toneGuidance: string;
  }
> = {
  [RecipientType.Client]: {
    languageLevel: 'accessible',
    includeExplanations: true,
    toneGuidance:
      'Use warm, reassuring language. Explain legal concepts in simple terms. Show empathy and professionalism.',
  },
  [RecipientType.OpposingCounsel]: {
    languageLevel: 'legal-technical',
    includeExplanations: false,
    toneGuidance:
      'Use formal legal terminology. Be precise and professional. Maintain clear position statements.',
  },
  [RecipientType.Court]: {
    languageLevel: 'legal-formal',
    includeExplanations: false,
    toneGuidance:
      'Use highest formality. Follow court correspondence protocols. Be respectful and precise.',
  },
  [RecipientType.ThirdParty]: {
    languageLevel: 'professional',
    includeExplanations: true,
    toneGuidance: 'Maintain neutrality. Be clear and professional. Avoid assuming legal knowledge.',
  },
  [RecipientType.Internal]: {
    languageLevel: 'casual-professional',
    includeExplanations: false,
    toneGuidance:
      'Be direct and efficient. Use familiar tone appropriate for colleagues. Focus on action items.',
  },
};

// Base system prompt for email drafting
const BASE_SYSTEM_PROMPT = `You are an AI assistant for a Romanian law firm, specializing in drafting professional email responses.

CRITICAL RULES:
1. Generate complete, contextually appropriate email responses
2. Use appropriate language based on recipient type
3. Reference case-specific information when relevant
4. Address all points from the original email
5. Maintain appropriate legal formality
6. Ensure the response is ready to send with minimal editing
7. IMPORTANT: Default to Romanian (limba română) for all responses. Only use English if the original email is explicitly in English.
8. Use proper Romanian legal terminology and formulations (e.g., "Cu stimă", "Vă rugăm", "Cu respect").

RECIPIENT TYPE: {recipientType}
{recipientAdaptation}

REQUESTED TONE: {tone}
{toneInstructions}

CASE CONTEXT:
{caseContextSummary}

THREAD HISTORY (most recent first):
{threadHistorySummary}

RELEVANT CASE INFORMATION:
- Recent Documents: {recentDocuments}
- Active Deadlines: {activeDeadlines}
- Pending Commitments: {pendingCommitments}
- Risk Indicators: {riskIndicators}`;

const HUMAN_PROMPT = `Generate a reply to the following email:

ORIGINAL EMAIL:
From: {originalFrom}
To: {originalTo}
Subject: {originalSubject}
Date: {originalDate}

Body:
{originalBody}

Generate a complete email response with:
1. Appropriate subject line (with "Re:" prefix if replying)
2. Email body matching the requested tone and recipient type
3. Address all questions or points from the original email
4. Include relevant case references where appropriate
5. Proper salutation and closing

Return your response as JSON with this exact structure:
{{
  "subject": "string",
  "body": "string (plain text)",
  "htmlBody": "string (formatted HTML with <p>, <br>, <ul>, etc.)",
  "keyPointsAddressed": ["string array of main points you addressed"],
  "confidence": number (0-1, your confidence in the quality of this response)
}}`;

// Sanitize content for AI prompt injection protection (SEC-001)
function sanitizeForPrompt(content: string): string {
  return content
    .replace(/```/g, '\\`\\`\\`') // Escape code blocks
    .replace(/\${/g, '\\${') // Escape template literals
    .substring(0, 10000); // Limit length
}

export class EmailDraftingService {
  /**
   * Generate a single email draft with specified tone
   */
  async generateEmailDraft(params: DraftGenerationParams): Promise<DraftGenerationResult> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.info('Starting email draft generation', {
      requestId,
      emailId: params.originalEmail.id,
      tone: params.tone,
      recipientType: params.recipientType,
    });

    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(params);
      const cachedResponse = await cacheService.get(cacheKey, params.firmId);
      if (cachedResponse) {
        logger.info('Cache hit for email draft', { requestId, cacheKey });
        return JSON.parse(cachedResponse.response) as DraftGenerationResult;
      }

      // Build prompt variables
      const promptVars = this.buildPromptVariables(params);

      // Build system prompt with interpolated values
      const systemPrompt = BASE_SYSTEM_PROMPT.replace('{recipientType}', promptVars.recipientType)
        .replace('{recipientAdaptation}', promptVars.recipientAdaptation)
        .replace('{tone}', promptVars.tone)
        .replace('{toneInstructions}', promptVars.toneInstructions)
        .replace('{caseContextSummary}', promptVars.caseContextSummary)
        .replace('{threadHistorySummary}', promptVars.threadHistorySummary)
        .replace('{recentDocuments}', promptVars.recentDocuments)
        .replace('{activeDeadlines}', promptVars.activeDeadlines)
        .replace('{pendingCommitments}', promptVars.pendingCommitments)
        .replace('{riskIndicators}', promptVars.riskIndicators);

      // Build user prompt with interpolated values
      const userPrompt = HUMAN_PROMPT.replace('{originalFrom}', promptVars.originalFrom)
        .replace('{originalTo}', promptVars.originalTo)
        .replace('{originalSubject}', promptVars.originalSubject)
        .replace('{originalDate}', promptVars.originalDate)
        .replace('{originalBody}', promptVars.originalBody);

      // Generate response using direct Anthropic SDK
      const response = await chat(systemPrompt, userPrompt, {
        model: ClaudeModel.Sonnet,
        maxTokens: 2048,
        temperature: 0.3,
      });

      // Parse JSON response
      const parsed = this.parseAIResponse(response.content);
      const metrics = {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - startTime,
      };

      // Track token usage
      await tokenTracker.recordUsage({
        operationType: AIOperationType.TextGeneration,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        modelUsed: ClaudeModel.Sonnet,
        userId: params.userId,
        firmId: params.firmId,
        latencyMs: metrics.latencyMs,
      });

      const result: DraftGenerationResult = {
        subject: parsed.subject,
        body: parsed.body,
        htmlBody: parsed.htmlBody || this.convertToHtml(parsed.body),
        confidence: parsed.confidence || 0.8,
        suggestedAttachments: [], // Will be populated by attachment suggestion service
        keyPointsAddressed: parsed.keyPointsAddressed || [],
        tokensUsed: {
          input: metrics.inputTokens,
          output: metrics.outputTokens,
        },
      };

      // Cache the result
      await cacheService.set(
        cacheKey,
        JSON.stringify(promptVars),
        JSON.stringify(result),
        ClaudeModel.Sonnet,
        AIOperationType.TextGeneration,
        params.firmId
      );

      logger.info('Email draft generated successfully', {
        requestId,
        latencyMs: Date.now() - startTime,
        confidence: result.confidence,
        keyPointsCount: result.keyPointsAddressed.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate email draft', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Build prompt variables from params
   */
  private buildPromptVariables(params: DraftGenerationParams): Record<string, string> {
    const recipientAdapt = RECIPIENT_ADAPTATIONS[params.recipientType];

    // Use pre-compiled rich context from gateway if available
    // This includes comprehensive case + client information
    let contextSummary: string;
    let documentsInfo: string;
    let deadlinesInfo: string;
    let commitmentsInfo: string;
    let risksInfo: string;

    if (params.richContext) {
      // Rich context already contains all case/client info formatted
      contextSummary = params.richContext;
      // These are already included in rich context, mark as such
      documentsInfo = '(inclus în context)';
      deadlinesInfo = '(inclus în context)';
      commitmentsInfo = '(inclus în context)';
      risksInfo = '(inclus în context)';
    } else if (params.caseContext) {
      // Fall back to legacy context aggregation
      contextSummary = this.formatCaseContext(params.caseContext);
      documentsInfo = this.formatRecentDocuments(params.caseContext.recentDocuments);
      deadlinesInfo = this.formatDeadlines(params.caseContext.activeDeadlines);
      commitmentsInfo = this.formatCommitments(params.caseContext.extractedCommitments);
      risksInfo = this.formatRisks(params.caseContext.riskIndicators);
    } else {
      contextSummary = 'No case context available.';
      documentsInfo = 'None';
      deadlinesInfo = 'None';
      commitmentsInfo = 'None';
      risksInfo = 'None';
    }

    return {
      recipientType: params.recipientType,
      recipientAdaptation: `Language Level: ${recipientAdapt.languageLevel}
Include Explanations: ${recipientAdapt.includeExplanations}
Tone Guidance: ${recipientAdapt.toneGuidance}`,
      tone: params.tone,
      toneInstructions: TONE_PROMPTS[params.tone],
      caseContextSummary: contextSummary,
      threadHistorySummary: this.formatThreadHistory(params.threadHistory),
      recentDocuments: documentsInfo,
      activeDeadlines: deadlinesInfo,
      pendingCommitments: commitmentsInfo,
      riskIndicators: risksInfo,
      originalFrom: `${params.originalEmail.from.name || ''} <${params.originalEmail.from.address}>`,
      originalTo: params.originalEmail.toRecipients
        .map((r) => `${r.name || ''} <${r.address}>`)
        .join(', '),
      originalSubject: sanitizeForPrompt(params.originalEmail.subject),
      originalDate: params.originalEmail.receivedDateTime.toISOString(),
      originalBody: sanitizeForPrompt(params.originalEmail.bodyContent),
    };
  }

  /**
   * Format case context for prompt
   */
  private formatCaseContext(context: CaseContext): string {
    return `Case: ${context.case.title} (${context.case.caseNumber})
Type: ${context.case.type}
Status: ${context.case.status}
Client: ${context.case.client.name}
Opposing Parties: ${context.case.opposingParties.map((p) => `${p.name} (${p.role})`).join(', ') || 'None'}`;
  }

  /**
   * Format thread history for prompt
   */
  private formatThreadHistory(emails: Email[]): string {
    if (emails.length === 0) return 'No prior messages in thread.';

    return emails
      .slice(0, 5) // Limit to last 5 messages
      .map((email, i) => {
        const preview = sanitizeForPrompt(email.bodyContent).substring(0, 500);
        return `[${i + 1}] From: ${email.from.address}
Date: ${email.sentDateTime.toISOString()}
Subject: ${email.subject}
Preview: ${preview}...`;
      })
      .join('\n\n');
  }

  /**
   * Format recent documents
   */
  private formatRecentDocuments(
    docs: Array<{ id: string; fileName: string; fileType: string; uploadedAt: Date }>
  ): string {
    if (!docs || docs.length === 0) return 'None';
    return docs
      .slice(0, 5)
      .map((d) => `${d.fileName} (${d.fileType})`)
      .join(', ');
  }

  /**
   * Format deadlines
   */
  private formatDeadlines(deadlines: Array<{ description: string; dueDate: Date }>): string {
    if (!deadlines || deadlines.length === 0) return 'None';
    return deadlines
      .map((d) => `${d.description} - Due: ${d.dueDate.toLocaleDateString()}`)
      .join('; ');
  }

  /**
   * Format commitments
   */
  private formatCommitments(
    commitments: Array<{ party: string; commitmentText: string; dueDate?: Date }>
  ): string {
    if (!commitments || commitments.length === 0) return 'None';
    return commitments.map((c) => `${c.party}: ${c.commitmentText}`).join('; ');
  }

  /**
   * Format risk indicators
   */
  private formatRisks(
    risks: Array<{ type: string; severity: string; description: string }>
  ): string {
    if (!risks || risks.length === 0) return 'None identified';
    return risks.map((r) => `[${r.severity}] ${r.type}: ${r.description}`).join('; ');
  }

  /**
   * Parse AI response JSON
   */
  private parseAIResponse(response: string): {
    subject: string;
    body: string;
    htmlBody?: string;
    keyPointsAddressed?: string[];
    confidence?: number;
  } {
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON, using fallback', { response });
      // Fallback: treat entire response as body
      return {
        subject: 'Re: Reply',
        body: response,
        confidence: 0.5,
      };
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

  /**
   * Build cache key for draft
   */
  private buildCacheKey(params: DraftGenerationParams): string {
    return `email-draft:${params.originalEmail.id}:${params.tone}:${params.recipientType}`;
  }

  /**
   * Generate multiple drafts with different tones in parallel
   * Task 5: Multi-Draft Generation
   */
  async generateMultipleDrafts(
    params: Omit<DraftGenerationParams, 'tone'>
  ): Promise<MultipleDraftsResult> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.info('Starting multi-draft generation', {
      requestId,
      emailId: params.originalEmail.id,
      recipientType: params.recipientType,
    });

    try {
      // Generate drafts for Formal, Professional, and Brief tones in parallel
      const tonesToGenerate: EmailTone[] = [
        EmailTone.Formal,
        EmailTone.Professional,
        EmailTone.Brief,
      ];

      const draftPromises = tonesToGenerate.map((tone) =>
        this.generateEmailDraft({ ...params, tone }).then((draft) => ({
          tone,
          draft,
        }))
      );

      const drafts = await Promise.all(draftPromises);

      // Determine recommended tone based on email analysis
      const recommendation = this.recommendTone(params.originalEmail, params.recipientType);

      const result: MultipleDraftsResult = {
        drafts,
        recommendedTone: recommendation.tone,
        recommendationReason: recommendation.reason,
      };

      logger.info('Multi-draft generation completed', {
        requestId,
        latencyMs: Date.now() - startTime,
        draftsGenerated: drafts.length,
        recommendedTone: recommendation.tone,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate multiple drafts', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Recommend best tone based on email content and context
   */
  private recommendTone(
    email: Email,
    recipientType: RecipientType
  ): { tone: EmailTone; reason: string } {
    const bodyLower = email.bodyContent.toLowerCase();
    const subjectLower = email.subject.toLowerCase();

    // Court correspondence always formal
    if (recipientType === RecipientType.Court) {
      return {
        tone: EmailTone.Formal,
        reason: 'Court correspondence requires formal language and proper legal terminology.',
      };
    }

    // Check for urgent/simple acknowledgment needs
    const isSimpleAcknowledgment =
      (bodyLower.includes('mulțumesc') ||
        bodyLower.includes('confirmat') ||
        bodyLower.includes('primit')) &&
      email.bodyContent.length < 500;

    if (isSimpleAcknowledgment && recipientType !== RecipientType.OpposingCounsel) {
      return {
        tone: EmailTone.Brief,
        reason: 'Email appears to be a simple acknowledgment that warrants a brief response.',
      };
    }

    // Check for detailed inquiry
    const hasMultipleQuestions =
      (email.bodyContent.match(/\?/g) || []).length >= 3 ||
      bodyLower.includes('vă rugăm să ne comunicați') ||
      bodyLower.includes('doresc să știu');

    if (hasMultipleQuestions) {
      return {
        tone: EmailTone.Detailed,
        reason: 'Email contains multiple questions that require comprehensive responses.',
      };
    }

    // Opposing counsel defaults to formal/professional
    if (recipientType === RecipientType.OpposingCounsel) {
      return {
        tone: EmailTone.Professional,
        reason: 'Correspondence with opposing counsel should maintain professional legal tone.',
      };
    }

    // Check for formal requests
    const isFormalRequest =
      subjectLower.includes('cerere') ||
      subjectLower.includes('solicitare') ||
      bodyLower.includes('onorate') ||
      bodyLower.includes('stimat');

    if (isFormalRequest) {
      return {
        tone: EmailTone.Formal,
        reason: 'Email tone and content suggest formal response is appropriate.',
      };
    }

    // Default to professional for most cases
    return {
      tone: EmailTone.Professional,
      reason: 'Standard business communication calls for professional tone.',
    };
  }
}

// Export singleton instance
export const emailDraftingService = new EmailDraftingService();
