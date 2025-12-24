/**
 * Email Categorization Service
 * Story 5.1: Email Integration and Synchronization
 *
 * Uses Claude API to categorize emails by matching them to user's cases.
 * Analyzes email content, participants, and subject to determine best case match.
 *
 * [Source: docs/architecture/external-apis.md#anthropic-claude-api]
 */

import { AIOperationType, ClaudeModel, TaskComplexity } from '@legal-platform/types';
import { providerManager, ProviderRequest } from './provider-manager.service';
import { modelRouter } from './model-router.service';
import { tokenTracker } from './token-tracker.service';

// ============================================================================
// Types
// ============================================================================

export interface CaseContext {
  id: string;
  title: string;
  caseNumber: string;
  clientName: string;
  clientEmail?: string;
  description?: string;
  actors: CaseActor[];
}

export interface CaseActor {
  name: string;
  email?: string;
  role: string; // e.g., 'Client', 'OpposingCounsel', 'Judge', etc.
}

export interface EmailForCategorization {
  id: string;
  subject: string;
  bodyPreview: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  ccRecipients?: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
}

export interface CategorizationResult {
  emailId: string;
  caseId: string | null;
  confidence: number;
  reasoning: string;
  tokensUsed: number;
}

export interface BatchCategorizationResult {
  results: CategorizationResult[];
  totalTokensUsed: number;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const EMAIL_CATEGORIZATION_SYSTEM_PROMPT = `You are an AI assistant for a Romanian law firm email management system.
Your task is to analyze an email and determine which case it belongs to based on the provided case list.

IMPORTANT: Răspunde în limba română. Toate explicațiile (reasoning) trebuie să fie în română.

Analyze the following signals to match the email to a case:
1. Email participants (from, to, cc) vs. case actors (clients, opposing counsel, etc.)
2. Subject line keywords vs. case title/description
3. Email body content vs. case context
4. Case numbers or client names mentioned in the email

Rules:
- Match based on participant email addresses first (highest priority)
- Then match based on client/actor names
- Consider case numbers and keywords in subject/body
- If no strong match found, return null for caseId
- Set confidence 0.0-1.0 based on match strength:
  - >0.9: Email address exact match with case actor
  - 0.7-0.9: Strong keyword match or name match
  - 0.5-0.7: Possible match, needs review
  - <0.5: Weak match, likely incorrect

Respond ONLY with valid JSON:
{
  "caseId": "uuid-string or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this case was selected or why no match was found"
}`;

// Confidence threshold for auto-assignment
const AUTO_ASSIGN_CONFIDENCE_THRESHOLD = 0.7;

// Retry with more context threshold
const RETRY_THRESHOLD_MIN = 0.5;
const RETRY_THRESHOLD_MAX = 0.7;

// ============================================================================
// Email Categorization Service
// ============================================================================

export class EmailCategorizationService {
  /**
   * Categorize a single email against available cases (AC: 2)
   *
   * @param email - Email to categorize
   * @param userCases - Available cases for the user
   * @param userId - User ID for token tracking
   * @param firmId - Firm ID for token tracking
   * @returns Categorization result with case ID and confidence
   */
  async categorizeEmail(
    email: EmailForCategorization,
    userCases: CaseContext[],
    userId: string,
    firmId: string
  ): Promise<CategorizationResult> {
    const startTime = Date.now();

    // Build the prompt with case context
    const prompt = this.buildCategorizationPrompt(email, userCases);

    // Route to appropriate model (Sonnet for accuracy)
    const routing = modelRouter.selectModel({
      operationType: AIOperationType.Classification,
      complexity: TaskComplexity.Standard,
    });

    // Make API request
    const request: ProviderRequest = {
      systemPrompt: EMAIL_CATEGORIZATION_SYSTEM_PROMPT,
      prompt,
      model: routing.model,
      maxTokens: 500,
      temperature: 0.1, // Low temperature for consistent results
    };

    try {
      const response = await providerManager.execute(request);
      const result = this.parseCategorizationResponse(response.content, email.id);

      // Track token usage
      const tokensUsed = response.inputTokens + response.outputTokens;
      await tokenTracker.recordUsage({
        userId,
        firmId,
        operationType: AIOperationType.Classification,
        modelUsed: routing.modelName,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - startTime,
      });

      return {
        ...result,
        tokensUsed,
      };
    } catch (error) {
      console.error('Email categorization failed:', error);
      return {
        emailId: email.id,
        caseId: null,
        confidence: 0,
        reasoning: `Categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Categorize with retry for borderline confidence (0.5-0.7)
   *
   * Includes additional context like recent case activity for better matching.
   *
   * @param email - Email to categorize
   * @param userCases - Available cases
   * @param additionalContext - Extra context for retry
   * @param userId - User ID
   * @param firmId - Firm ID
   * @returns Categorization result
   */
  async categorizeWithRetry(
    email: EmailForCategorization,
    userCases: CaseContext[],
    additionalContext: {
      recentCaseActivity?: Array<{ caseId: string; activitySummary: string }>;
      clientContactHistory?: Array<{ email: string; caseIds: string[] }>;
    },
    userId: string,
    firmId: string
  ): Promise<CategorizationResult> {
    // First attempt
    const firstResult = await this.categorizeEmail(email, userCases, userId, firmId);

    // Check if retry needed (borderline confidence)
    if (
      firstResult.confidence >= RETRY_THRESHOLD_MIN &&
      firstResult.confidence < RETRY_THRESHOLD_MAX &&
      (additionalContext.recentCaseActivity || additionalContext.clientContactHistory)
    ) {
      // Retry with more context
      const enhancedResult = await this.categorizeWithEnhancedContext(
        email,
        userCases,
        additionalContext,
        userId,
        firmId
      );

      // Use enhanced result if it has higher confidence
      if (enhancedResult.confidence > firstResult.confidence) {
        return enhancedResult;
      }
    }

    return firstResult;
  }

  /**
   * Batch categorize multiple emails (for worker processing)
   *
   * @param emails - Emails to categorize
   * @param userCases - Available cases
   * @param userId - User ID
   * @param firmId - Firm ID
   * @returns Batch results
   */
  async batchCategorize(
    emails: EmailForCategorization[],
    userCases: CaseContext[],
    userId: string,
    firmId: string
  ): Promise<BatchCategorizationResult> {
    const startTime = Date.now();
    const results: CategorizationResult[] = [];
    let totalTokensUsed = 0;

    // Process emails sequentially to respect rate limits
    for (const email of emails) {
      const result = await this.categorizeEmail(email, userCases, userId, firmId);
      results.push(result);
      totalTokensUsed += result.tokensUsed;

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      results,
      totalTokensUsed,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if email should be auto-assigned based on confidence
   */
  shouldAutoAssign(result: CategorizationResult): boolean {
    return result.caseId !== null && result.confidence >= AUTO_ASSIGN_CONFIDENCE_THRESHOLD;
  }

  /**
   * Check if email needs manual review
   */
  needsManualReview(result: CategorizationResult): boolean {
    return result.caseId === null || result.confidence < AUTO_ASSIGN_CONFIDENCE_THRESHOLD;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build categorization prompt with email and case context
   */
  private buildCategorizationPrompt(email: EmailForCategorization, cases: CaseContext[]): string {
    // Format cases for prompt
    const casesContext = cases
      .map((c) => {
        const actors = c.actors
          .map((a) => `${a.role}: ${a.name}${a.email ? ` <${a.email}>` : ''}`)
          .join(', ');

        return `- Case ID: ${c.id}
  Title: ${c.title}
  Case Number: ${c.caseNumber}
  Client: ${c.clientName}${c.clientEmail ? ` <${c.clientEmail}>` : ''}
  ${c.description ? `Description: ${c.description.substring(0, 200)}...` : ''}
  Actors: ${actors || 'None specified'}`;
      })
      .join('\n\n');

    // Format email
    const recipients = [
      ...email.toRecipients.map((r) => `${r.name || ''} <${r.address}>`),
      ...(email.ccRecipients || []).map((r) => `${r.name || ''} <${r.address}> (CC)`),
    ].join(', ');

    return `Available Cases:
${casesContext}

Email to Categorize:
From: ${email.from.name || ''} <${email.from.address}>
To: ${recipients}
Subject: ${email.subject}
Date: ${email.receivedDateTime.toISOString()}
Body Preview: ${email.bodyPreview}

Determine which case this email belongs to and provide your confidence level.`;
  }

  /**
   * Parse AI response safely
   */
  private parseCategorizationResponse(
    content: string,
    emailId: string
  ): Omit<CategorizationResult, 'tokensUsed'> {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      const parsed = JSON.parse(jsonStr);

      return {
        emailId,
        caseId: parsed.caseId || null,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      console.error('Failed to parse categorization response:', content);
      return {
        emailId,
        caseId: null,
        confidence: 0,
        reasoning: 'Failed to parse AI response',
      };
    }
  }

  /**
   * Categorize with enhanced context for retry
   */
  private async categorizeWithEnhancedContext(
    email: EmailForCategorization,
    userCases: CaseContext[],
    additionalContext: {
      recentCaseActivity?: Array<{ caseId: string; activitySummary: string }>;
      clientContactHistory?: Array<{ email: string; caseIds: string[] }>;
    },
    userId: string,
    firmId: string
  ): Promise<CategorizationResult> {
    const startTime = Date.now();

    // Build enhanced prompt
    let enhancedPrompt = this.buildCategorizationPrompt(email, userCases);

    if (additionalContext.recentCaseActivity?.length) {
      enhancedPrompt += `\n\nRecent Case Activity:\n${additionalContext.recentCaseActivity
        .map((a) => `- Case ${a.caseId}: ${a.activitySummary}`)
        .join('\n')}`;
    }

    if (additionalContext.clientContactHistory?.length) {
      const senderHistory = additionalContext.clientContactHistory.find(
        (h) => h.email.toLowerCase() === email.from.address.toLowerCase()
      );
      if (senderHistory) {
        enhancedPrompt += `\n\nSender Contact History:\n${email.from.address} has previously communicated regarding cases: ${senderHistory.caseIds.join(', ')}`;
      }
    }

    enhancedPrompt += '\n\nUse this additional context to improve your categorization confidence.';

    const routing = modelRouter.selectModel({
      operationType: AIOperationType.Classification,
      complexity: TaskComplexity.Standard,
    });

    const request: ProviderRequest = {
      systemPrompt: EMAIL_CATEGORIZATION_SYSTEM_PROMPT,
      prompt: enhancedPrompt,
      model: routing.model,
      maxTokens: 500,
      temperature: 0.1,
    };

    try {
      const response = await providerManager.execute(request);
      const result = this.parseCategorizationResponse(response.content, email.id);

      const tokensUsed = response.inputTokens + response.outputTokens;
      await tokenTracker.recordUsage({
        userId,
        firmId,
        operationType: AIOperationType.Classification,
        modelUsed: routing.modelName,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - startTime,
      });

      return {
        ...result,
        tokensUsed,
      };
    } catch (error) {
      console.error('Enhanced categorization failed:', error);
      return {
        emailId: email.id,
        caseId: null,
        confidence: 0,
        reasoning: `Enhanced categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokensUsed: 0,
      };
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const emailCategorizationService = new EmailCategorizationService();
