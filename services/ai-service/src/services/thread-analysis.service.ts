/**
 * Thread Analysis Service
 * Story 5.2: Communication Intelligence Engine
 *
 * Analyzes email threads to provide:
 * - Opposing counsel position summaries
 * - Conversation evolution tracking
 * - Position change identification
 * - Key arguments and counter-arguments extraction
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

export interface EmailInThread {
  id: string;
  subject: string;
  bodyContent: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
  isFromUser: boolean; // Is this from the law firm?
}

export interface CaseContext {
  id: string;
  title: string;
  caseNumber: string;
  clientName: string;
  opposingParty?: string;
  caseType?: string;
}

export interface KeyArgument {
  party: 'client' | 'opposingCounsel' | 'court' | 'other';
  argument: string;
  evidence?: string; // Quote from email
  date: string; // ISO date
  emailId: string;
}

export interface PositionChange {
  date: string;
  previousPosition: string;
  newPosition: string;
  trigger?: string; // What caused the change
  emailId: string;
}

export interface ThreadSummaryResult {
  conversationId: string;
  opposingCounselPosition?: string;
  keyArguments: KeyArgument[];
  positionChanges: PositionChange[];
  overallSentiment: 'cooperative' | 'adversarial' | 'neutral';
  urgencyLevel: 'low' | 'medium' | 'high';
  suggestedNextSteps?: string[];
  tokensUsed: number;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const THREAD_ANALYSIS_SYSTEM_PROMPT = `You are an AI legal assistant analyzing email threads for a Romanian law firm.
Your task is to extract key insights from multi-party legal correspondence.

IMPORTANT: Răspunde ÎNTOTDEAUNA în limba română. Toate rezumatele, argumentele și sugestiile trebuie să fie în română.

Analyze the email thread to identify:

1. OPPOSING COUNSEL POSITION: Summarize the opposing party's current stance
   - What do they want/demand?
   - What are their main arguments?
   - What is their negotiating position?

2. KEY ARGUMENTS: List significant arguments made by each party
   - Include direct quotes as evidence
   - Identify who made the argument
   - Note the date/email where it appeared

3. POSITION CHANGES: Track how positions have evolved
   - Note shifts in demands or offers
   - Identify what triggered the change
   - Track concessions or hardening of positions

4. SENTIMENT & URGENCY:
   - Overall tone: cooperative, adversarial, or neutral
   - Urgency level based on language and deadlines mentioned

5. SUGGESTED NEXT STEPS (optional):
   - What should the law firm consider doing next?
   - Are there any risks that need addressing?

Important notes:
- Focus on legally relevant information
- Be objective and factual
- Quote directly when identifying arguments
- Note any deadlines or time-sensitive items
- The law firm represents the "client" party

Respond ONLY with valid JSON in this exact format:
{
  "opposingCounselPosition": "Summary of opposing party's current position",
  "keyArguments": [
    {
      "party": "client|opposingCounsel|court|other",
      "argument": "The argument made",
      "evidence": "Direct quote if available",
      "date": "YYYY-MM-DD",
      "emailId": "email ID where this was found"
    }
  ],
  "positionChanges": [
    {
      "date": "YYYY-MM-DD",
      "previousPosition": "What they were saying before",
      "newPosition": "What they are saying now",
      "trigger": "What caused this change (if known)",
      "emailId": "email ID where change was observed"
    }
  ],
  "overallSentiment": "cooperative|adversarial|neutral",
  "urgencyLevel": "low|medium|high",
  "suggestedNextSteps": ["Step 1", "Step 2"]
}`;

// ============================================================================
// Thread Analysis Service
// ============================================================================

export class ThreadAnalysisService {
  /**
   * Analyze an email thread for legal insights (AC: 5)
   *
   * @param threadEmails - Emails in the thread, ordered chronologically
   * @param caseContext - Case information for context
   * @param conversationId - Graph conversation ID
   * @param userId - User ID for token tracking
   * @param firmId - Firm ID for token tracking
   * @returns Thread analysis with positions and arguments
   */
  async analyzeThread(
    threadEmails: EmailInThread[],
    caseContext: CaseContext,
    conversationId: string,
    userId: string,
    firmId: string
  ): Promise<ThreadSummaryResult> {
    const startTime = Date.now();

    if (threadEmails.length === 0) {
      return this.emptyResult(conversationId, startTime);
    }

    // Build the prompt with thread content
    const prompt = this.buildThreadAnalysisPrompt(threadEmails, caseContext);

    // Route to appropriate model (Sonnet for complex analysis)
    const routing = modelRouter.selectModel({
      operationType: AIOperationType.ThreadAnalysis,
      complexity: TaskComplexity.Complex, // Thread analysis requires more reasoning
    });

    // Make API request
    const request: ProviderRequest = {
      systemPrompt: THREAD_ANALYSIS_SYSTEM_PROMPT,
      prompt,
      model: routing.model as ClaudeModel,
      maxTokens: 3000,
      temperature: 0.3,
    };

    try {
      const response = await providerManager.execute(request);
      const result = this.parseAnalysisResponse(response.content, conversationId);

      // Track token usage
      const tokensUsed = response.inputTokens + response.outputTokens;
      await tokenTracker.recordUsage({
        userId,
        firmId,
        operationType: AIOperationType.ThreadAnalysis,
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
      console.error('Thread analysis failed:', error);
      return this.emptyResult(conversationId, startTime);
    }
  }

  /**
   * Analyze thread and store/update summary in database
   * Called by the worker for incremental updates
   */
  async analyzeAndStore(
    threadEmails: EmailInThread[],
    caseContext: CaseContext,
    conversationId: string,
    caseId: string | null,
    userId: string,
    firmId: string,
    prisma: unknown // PrismaClient - passed in to avoid import issues
  ): Promise<ThreadSummaryResult> {
    const result = await this.analyzeThread(
      threadEmails,
      caseContext,
      conversationId,
      userId,
      firmId
    );

    // Store/update in database
    const db = prisma as {
      threadSummary: {
        upsert: (args: {
          where: { conversationId: string };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => Promise<unknown>;
      };
    };

    await db.threadSummary.upsert({
      where: { conversationId },
      create: {
        conversationId,
        caseId,
        firmId,
        opposingCounselPosition: result.opposingCounselPosition,
        keyArguments: result.keyArguments,
        positionChanges: result.positionChanges,
        lastAnalyzedAt: new Date(),
        messageCount: threadEmails.length,
      },
      update: {
        opposingCounselPosition: result.opposingCounselPosition,
        keyArguments: result.keyArguments,
        positionChanges: result.positionChanges,
        lastAnalyzedAt: new Date(),
        messageCount: threadEmails.length,
      },
    });

    return result;
  }

  /**
   * Check if thread needs re-analysis (new messages added)
   */
  async needsReanalysis(
    conversationId: string,
    currentMessageCount: number,
    prisma: unknown
  ): Promise<boolean> {
    const db = prisma as {
      threadSummary: {
        findUnique: (args: {
          where: { conversationId: string };
          select: { messageCount: boolean };
        }) => Promise<{ messageCount: number } | null>;
      };
    };

    const existing = await db.threadSummary.findUnique({
      where: { conversationId },
      select: { messageCount: true },
    });

    if (!existing) return true;
    return currentMessageCount > existing.messageCount;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildThreadAnalysisPrompt(emails: EmailInThread[], caseContext: CaseContext): string {
    // Sort emails chronologically
    const sortedEmails = [...emails].sort(
      (a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime()
    );

    // Format emails for the prompt
    const emailsFormatted = sortedEmails
      .map((email, index) => {
        const date =
          email.receivedDateTime instanceof Date
            ? email.receivedDateTime.toISOString().split('T')[0]
            : String(email.receivedDateTime).split('T')[0];

        const fromLabel = email.isFromUser ? '[LAW FIRM]' : '[EXTERNAL]';
        const fromName = email.from.name || email.from.address;

        return `--- Email ${index + 1} (ID: ${email.id}) ---
Date: ${date}
From: ${fromLabel} ${fromName} <${email.from.address}>
Subject: ${email.subject}

${email.bodyContent}
--- End Email ${index + 1} ---`;
      })
      .join('\n\n');

    return `Analyze this email thread in the context of case: "${caseContext.title}"
Case Number: ${caseContext.caseNumber}
Client: ${caseContext.clientName}
${caseContext.opposingParty ? `Opposing Party: ${caseContext.opposingParty}` : ''}
${caseContext.caseType ? `Case Type: ${caseContext.caseType}` : ''}

The thread contains ${sortedEmails.length} emails:

${emailsFormatted}

Analyze this thread to identify the opposing counsel's position, key arguments, and any position changes over time.`;
  }

  private parseAnalysisResponse(
    content: string,
    conversationId: string
  ): Omit<ThreadSummaryResult, 'tokensUsed' | 'processingTimeMs'> {
    try {
      // Extract JSON from response
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        conversationId,
        opposingCounselPosition: parsed.opposingCounselPosition || undefined,
        keyArguments: this.validateKeyArguments(parsed.keyArguments || []),
        positionChanges: this.validatePositionChanges(parsed.positionChanges || []),
        overallSentiment: this.validateSentiment(parsed.overallSentiment),
        urgencyLevel: this.validateUrgency(parsed.urgencyLevel),
        suggestedNextSteps: Array.isArray(parsed.suggestedNextSteps)
          ? parsed.suggestedNextSteps.filter((s: unknown) => typeof s === 'string')
          : undefined,
      };
    } catch (error) {
      console.error('Failed to parse thread analysis response:', error);
      return {
        conversationId,
        keyArguments: [],
        positionChanges: [],
        overallSentiment: 'neutral',
        urgencyLevel: 'low',
      };
    }
  }

  private validateKeyArguments(args: unknown[]): KeyArgument[] {
    if (!Array.isArray(args)) return [];

    const validParties = ['client', 'opposingCounsel', 'court', 'other'];

    return args
      .filter(
        (a): a is Record<string, unknown> =>
          typeof a === 'object' &&
          a !== null &&
          typeof (a as Record<string, unknown>).argument === 'string'
      )
      .map((a) => ({
        party: validParties.includes(String(a.party))
          ? (String(a.party) as 'client' | 'opposingCounsel' | 'court' | 'other')
          : 'other',
        argument: String(a.argument),
        evidence: a.evidence ? String(a.evidence) : undefined,
        date: String(a.date || new Date().toISOString().split('T')[0]),
        emailId: String(a.emailId || ''),
      }));
  }

  private validatePositionChanges(changes: unknown[]): PositionChange[] {
    if (!Array.isArray(changes)) return [];

    return changes
      .filter(
        (c): c is Record<string, unknown> =>
          typeof c === 'object' &&
          c !== null &&
          typeof (c as Record<string, unknown>).previousPosition === 'string' &&
          typeof (c as Record<string, unknown>).newPosition === 'string'
      )
      .map((c) => ({
        date: String(c.date || new Date().toISOString().split('T')[0]),
        previousPosition: String(c.previousPosition),
        newPosition: String(c.newPosition),
        trigger: c.trigger ? String(c.trigger) : undefined,
        emailId: String(c.emailId || ''),
      }));
  }

  private validateSentiment(value: unknown): 'cooperative' | 'adversarial' | 'neutral' {
    const valid = ['cooperative', 'adversarial', 'neutral'];
    return valid.includes(String(value))
      ? (String(value) as 'cooperative' | 'adversarial' | 'neutral')
      : 'neutral';
  }

  private validateUrgency(value: unknown): 'low' | 'medium' | 'high' {
    const valid = ['low', 'medium', 'high'];
    return valid.includes(String(value)) ? (String(value) as 'low' | 'medium' | 'high') : 'low';
  }

  private emptyResult(conversationId: string, startTime: number): ThreadSummaryResult {
    return {
      conversationId,
      keyArguments: [],
      positionChanges: [],
      overallSentiment: 'neutral',
      urgencyLevel: 'low',
      tokensUsed: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// Export singleton instance
export const threadAnalysis = new ThreadAnalysisService();
