/**
 * Communication Intelligence Service
 * Story 5.2: Communication Intelligence Engine
 *
 * Extracts actionable items from email content using Claude AI:
 * - Deadlines and time-sensitive items
 * - Commitments made by parties
 * - Action items requiring attention
 * - Questions requiring response
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

export interface EmailForAnalysis {
  id: string;
  subject: string;
  bodyContent: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  ccRecipients?: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
  conversationId?: string;
}

export interface ExtractedDeadlineResult {
  description: string;
  dueDate: string; // ISO date string
  confidence: number; // 0.0 - 1.0
}

export interface ExtractedCommitmentResult {
  party: string;
  commitmentText: string;
  dueDate?: string; // ISO date string, optional
  confidence: number;
}

export interface ExtractedActionItemResult {
  description: string;
  suggestedAssignee?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  confidence: number;
}

export interface ExtractedQuestionResult {
  questionText: string;
  respondBy?: string; // ISO date string, optional
  confidence: number;
}

export interface EmailIntelligenceResult {
  emailId: string;
  deadlines: ExtractedDeadlineResult[];
  commitments: ExtractedCommitmentResult[];
  actionItems: ExtractedActionItemResult[];
  questions: ExtractedQuestionResult[];
  tokensUsed: number;
  processingTimeMs: number;
}

export interface BatchIntelligenceResult {
  results: EmailIntelligenceResult[];
  totalTokensUsed: number;
  totalProcessingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const INTELLIGENCE_EXTRACTION_SYSTEM_PROMPT = `You are an AI assistant for a Romanian law firm analyzing email communications.
Your task is to extract actionable items from emails with high accuracy.

IMPORTANT: Extrage informațiile și răspunde în limba română. Toate descrierile, angajamentele și întrebările trebuie să fie în română.

Extract the following types of items:

1. DEADLINES: Specific dates or timeframes when something must be done
   - Look for phrases like "by [date]", "due on", "deadline", "termen limită", "până la"
   - Include court dates, filing deadlines, response deadlines
   - Set confidence based on how explicitly the deadline is stated

2. COMMITMENTS: Promises or agreements made by any party
   - Look for phrases like "I will", "we agree to", "vom face", "ne angajăm"
   - Identify WHO made the commitment
   - Include any associated dates if mentioned

3. ACTION ITEMS: Tasks that need to be done
   - Look for requests, instructions, or implied work items
   - Identify suggested assignee if mentioned
   - Set priority based on urgency indicators:
     * Urgent: "urgent", "ASAP", "immediately", "imediat", "urgent"
     * High: "as soon as possible", "cât mai curând", "priority"
     * Medium: Normal requests without urgency
     * Low: "when you have time", "when convenient"

4. QUESTIONS: Questions that require a response
   - Look for direct questions (ending with ?)
   - Look for implicit questions ("please confirm", "let us know")
   - Include response deadline if mentioned

Rules:
- Only extract items that are clearly actionable or informative
- Set confidence 0.0-1.0 based on clarity:
  * >0.8: Explicit, clear item with specific details
  * 0.6-0.8: Clear intent but some details missing
  * <0.6: Implied or ambiguous item
- For dates, use ISO format (YYYY-MM-DD)
- If a date is relative (e.g., "next Monday"), calculate from the email received date
- Respond in the same language as the email when extracting text

Respond ONLY with valid JSON in this exact format:
{
  "deadlines": [
    { "description": "string", "dueDate": "YYYY-MM-DD", "confidence": 0.0-1.0 }
  ],
  "commitments": [
    { "party": "string", "commitmentText": "string", "dueDate": "YYYY-MM-DD or null", "confidence": 0.0-1.0 }
  ],
  "actionItems": [
    { "description": "string", "suggestedAssignee": "string or null", "priority": "Low|Medium|High|Urgent", "confidence": 0.0-1.0 }
  ],
  "questions": [
    { "questionText": "string", "respondBy": "YYYY-MM-DD or null", "confidence": 0.0-1.0 }
  ]
}

If no items of a type are found, return an empty array for that type.`;

// Minimum confidence threshold for storing extractions
const MIN_CONFIDENCE_THRESHOLD = 0.5;

// ============================================================================
// Communication Intelligence Service
// ============================================================================

export class CommunicationIntelligenceService {
  /**
   * Analyze a single email for actionable items (AC: 1, 2)
   *
   * @param email - Email to analyze
   * @param userId - User ID for token tracking
   * @param firmId - Firm ID for token tracking
   * @returns Extracted items with confidence scores
   */
  async analyzeSingleEmail(
    email: EmailForAnalysis,
    userId: string,
    firmId: string
  ): Promise<EmailIntelligenceResult> {
    const startTime = Date.now();

    // Build the prompt with email content
    const prompt = this.buildAnalysisPrompt(email);

    // Route to appropriate model (Sonnet for accuracy)
    const routing = modelRouter.selectModel({
      operationType: AIOperationType.CommunicationIntelligence,
      complexity: TaskComplexity.Standard,
    });

    // Make API request
    const request: ProviderRequest = {
      systemPrompt: INTELLIGENCE_EXTRACTION_SYSTEM_PROMPT,
      prompt,
      model: routing.model as ClaudeModel,
      maxTokens: 2000,
      temperature: 0.2, // Low temperature for consistent extractions
    };

    try {
      const response = await providerManager.execute(request);
      const result = this.parseExtractionResponse(response.content, email.id);

      // Track token usage
      const tokensUsed = response.inputTokens + response.outputTokens;
      await tokenTracker.recordUsage({
        userId,
        firmId,
        operationType: AIOperationType.CommunicationIntelligence,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      return {
        ...result,
        tokensUsed,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Email intelligence extraction failed:', error);
      return {
        emailId: email.id,
        deadlines: [],
        commitments: [],
        actionItems: [],
        questions: [],
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Batch analyze multiple emails (for worker processing)
   *
   * @param emails - Emails to analyze
   * @param userId - User ID for token tracking
   * @param firmId - Firm ID for token tracking
   * @returns Batch results
   */
  async batchAnalyze(
    emails: EmailForAnalysis[],
    userId: string,
    firmId: string
  ): Promise<BatchIntelligenceResult> {
    const startTime = Date.now();
    const results: EmailIntelligenceResult[] = [];
    let totalTokensUsed = 0;

    // Process emails sequentially to respect rate limits
    for (const email of emails) {
      const result = await this.analyzeSingleEmail(email, userId, firmId);
      results.push(result);
      totalTokensUsed += result.tokensUsed;

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      results,
      totalTokensUsed,
      totalProcessingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Filter extractions by minimum confidence threshold
   */
  filterByConfidence(result: EmailIntelligenceResult): EmailIntelligenceResult {
    return {
      ...result,
      deadlines: result.deadlines.filter((d) => d.confidence >= MIN_CONFIDENCE_THRESHOLD),
      commitments: result.commitments.filter((c) => c.confidence >= MIN_CONFIDENCE_THRESHOLD),
      actionItems: result.actionItems.filter((a) => a.confidence >= MIN_CONFIDENCE_THRESHOLD),
      questions: result.questions.filter((q) => q.confidence >= MIN_CONFIDENCE_THRESHOLD),
    };
  }

  /**
   * Check if email has any high-confidence extractions (>0.8)
   */
  hasHighConfidenceItems(result: EmailIntelligenceResult): boolean {
    const threshold = 0.8;
    return (
      result.deadlines.some((d) => d.confidence >= threshold) ||
      result.commitments.some((c) => c.confidence >= threshold) ||
      result.actionItems.some((a) => a.confidence >= threshold) ||
      result.questions.some((q) => q.confidence >= threshold)
    );
  }

  /**
   * Get count of items by confidence level
   */
  getItemCountsByConfidence(result: EmailIntelligenceResult): {
    high: number;
    medium: number;
    low: number;
  } {
    const allConfidences = [
      ...result.deadlines.map((d) => d.confidence),
      ...result.commitments.map((c) => c.confidence),
      ...result.actionItems.map((a) => a.confidence),
      ...result.questions.map((q) => q.confidence),
    ];

    return {
      high: allConfidences.filter((c) => c >= 0.8).length,
      medium: allConfidences.filter((c) => c >= 0.6 && c < 0.8).length,
      low: allConfidences.filter((c) => c < 0.6).length,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build analysis prompt with email content
   */
  private buildAnalysisPrompt(email: EmailForAnalysis): string {
    const formatRecipients = (recipients: Array<{ name?: string; address: string }>) =>
      recipients.map((r) => (r.name ? `${r.name} <${r.address}>` : r.address)).join(', ');

    const receivedDate =
      email.receivedDateTime instanceof Date
        ? email.receivedDateTime.toISOString().split('T')[0]
        : email.receivedDateTime;

    return `Analyze the following email received on ${receivedDate}:

From: ${email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address}
To: ${formatRecipients(email.toRecipients)}
${email.ccRecipients?.length ? `CC: ${formatRecipients(email.ccRecipients)}` : ''}
Subject: ${email.subject}

--- Email Body ---
${email.bodyContent}
--- End of Email ---

Extract all deadlines, commitments, action items, and questions from this email.`;
  }

  /**
   * Parse AI response into structured extraction result
   */
  private parseExtractionResponse(
    content: string,
    emailId: string
  ): Omit<EmailIntelligenceResult, 'tokensUsed' | 'processingTimeMs'> {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        emailId,
        deadlines: this.validateDeadlines(parsed.deadlines || []),
        commitments: this.validateCommitments(parsed.commitments || []),
        actionItems: this.validateActionItems(parsed.actionItems || []),
        questions: this.validateQuestions(parsed.questions || []),
      };
    } catch (error) {
      console.error('Failed to parse extraction response:', error);
      return {
        emailId,
        deadlines: [],
        commitments: [],
        actionItems: [],
        questions: [],
      };
    }
  }

  /**
   * Validate and normalize deadline extractions
   */
  private validateDeadlines(deadlines: unknown[]): ExtractedDeadlineResult[] {
    if (!Array.isArray(deadlines)) return [];

    return deadlines
      .filter(
        (d): d is Record<string, unknown> =>
          typeof d === 'object' &&
          d !== null &&
          typeof (d as Record<string, unknown>).description === 'string' &&
          typeof (d as Record<string, unknown>).dueDate === 'string'
      )
      .map((d) => ({
        description: String(d.description),
        dueDate: String(d.dueDate),
        confidence: this.normalizeConfidence(d.confidence),
      }));
  }

  /**
   * Validate and normalize commitment extractions
   */
  private validateCommitments(commitments: unknown[]): ExtractedCommitmentResult[] {
    if (!Array.isArray(commitments)) return [];

    return commitments
      .filter(
        (c): c is Record<string, unknown> =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as Record<string, unknown>).party === 'string' &&
          typeof (c as Record<string, unknown>).commitmentText === 'string'
      )
      .map((c) => ({
        party: String(c.party),
        commitmentText: String(c.commitmentText),
        dueDate: c.dueDate ? String(c.dueDate) : undefined,
        confidence: this.normalizeConfidence(c.confidence),
      }));
  }

  /**
   * Validate and normalize action item extractions
   */
  private validateActionItems(actionItems: unknown[]): ExtractedActionItemResult[] {
    if (!Array.isArray(actionItems)) return [];

    const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];

    return actionItems
      .filter(
        (a): a is Record<string, unknown> =>
          typeof a === 'object' &&
          a !== null &&
          typeof (a as Record<string, unknown>).description === 'string'
      )
      .map((a) => ({
        description: String(a.description),
        suggestedAssignee: a.suggestedAssignee ? String(a.suggestedAssignee) : undefined,
        priority: validPriorities.includes(String(a.priority))
          ? (String(a.priority) as 'Low' | 'Medium' | 'High' | 'Urgent')
          : 'Medium',
        confidence: this.normalizeConfidence(a.confidence),
      }));
  }

  /**
   * Validate and normalize question extractions
   */
  private validateQuestions(questions: unknown[]): ExtractedQuestionResult[] {
    if (!Array.isArray(questions)) return [];

    return questions
      .filter(
        (q): q is Record<string, unknown> =>
          typeof q === 'object' &&
          q !== null &&
          typeof (q as Record<string, unknown>).questionText === 'string'
      )
      .map((q) => ({
        questionText: String(q.questionText),
        respondBy: q.respondBy ? String(q.respondBy) : undefined,
        confidence: this.normalizeConfidence(q.confidence),
      }));
  }

  /**
   * Normalize confidence score to 0.0-1.0 range
   */
  private normalizeConfidence(value: unknown): number {
    if (typeof value !== 'number') return 0.5;
    return Math.max(0, Math.min(1, value));
  }
}

// Export singleton instance
export const communicationIntelligence = new CommunicationIntelligenceService();
