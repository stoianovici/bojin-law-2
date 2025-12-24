/**
 * Case Conversation Summary Service
 * OPS-026: AI Thread Summary Agent for Communications
 *
 * Generates a unified chronological summary of ALL communications for a case.
 * Unlike thread analysis (per-conversation), this provides a case-wide view
 * of the entire communication history with key developments and insights.
 */

import { AIOperationType, ClaudeModel, TaskComplexity } from '@legal-platform/types';
import { providerManager, ProviderRequest } from './provider-manager.service';
import { modelRouter } from './model-router.service';
import { tokenTracker } from './token-tracker.service';

// ============================================================================
// Types
// ============================================================================

export interface CaseEmail {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
  isFromFirm: boolean;
  conversationId?: string;
}

export interface CaseInfo {
  id: string;
  title: string;
  caseNumber: string;
  clientName: string;
  opposingParty?: string;
  caseType?: string;
}

export interface ChronologyEvent {
  date: string;
  summary: string;
  significance: 'high' | 'medium' | 'low';
  parties: string[];
  emailId: string;
}

export interface CaseConversationSummaryResult {
  caseId: string;
  executiveSummary: string;
  chronology: ChronologyEvent[];
  keyDevelopments: string[];
  currentStatus: string;
  openIssues: string[];
  nextSteps: string[];
  lastEmailDate: string;
  emailCount: number;
  generatedAt: string;
  tokensUsed: number;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const CASE_SUMMARY_SYSTEM_PROMPT = `You are an AI legal assistant for a Romanian law firm. Your task is to analyze ALL email communications for a legal case and produce a comprehensive summary.

IMPORTANT:
1. Răspunde ÎNTOTDEAUNA în limba română. Toate rezumatele, cronologiile și sugestiile trebuie să fie în română.
2. Focus on extracting LEGALLY RELEVANT information only. Ignore pleasantries, signatures, and administrative details.

Your output must include:

1. EXECUTIVE SUMMARY (2-3 paragraphs)
   - What is this case about?
   - Who are the key parties and what are their positions?
   - What is the current state of the matter?

2. CHRONOLOGY (list of key events)
   - Date and brief description of each significant development
   - Mark significance: high (major development), medium (notable), low (routine)
   - Include which parties were involved

3. KEY DEVELOPMENTS (bullet points)
   - Most important facts or agreements reached
   - Position changes by any party
   - Critical deadlines mentioned

4. CURRENT STATUS
   - Where does the matter currently stand?
   - What was the last significant action?

5. OPEN ISSUES
   - Unresolved questions or disputes
   - Pending responses or actions

6. SUGGESTED NEXT STEPS
   - What should the law firm consider doing next?

Respond ONLY with valid JSON in this exact format:
{
  "executiveSummary": "Full executive summary text...",
  "chronology": [
    {
      "date": "YYYY-MM-DD",
      "summary": "What happened",
      "significance": "high|medium|low",
      "parties": ["Party 1", "Party 2"],
      "emailId": "email-id"
    }
  ],
  "keyDevelopments": ["Development 1", "Development 2"],
  "currentStatus": "Current state of the matter",
  "openIssues": ["Issue 1", "Issue 2"],
  "nextSteps": ["Step 1", "Step 2"]
}`;

// ============================================================================
// Case Conversation Summary Service
// ============================================================================

export class CaseConversationSummaryService {
  /**
   * Generate a comprehensive summary of all case communications
   */
  async generateSummary(
    emails: CaseEmail[],
    caseInfo: CaseInfo,
    userId: string,
    firmId: string
  ): Promise<CaseConversationSummaryResult> {
    const startTime = Date.now();

    if (emails.length === 0) {
      return this.emptyResult(caseInfo.id, startTime);
    }

    // Sort emails chronologically
    const sortedEmails = [...emails].sort(
      (a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime()
    );

    // Build the prompt
    const prompt = this.buildPrompt(sortedEmails, caseInfo);

    // Route to appropriate model (use Sonnet for complex analysis)
    const routing = modelRouter.selectModel({
      operationType: AIOperationType.ThreadAnalysis, // Reuse existing type
      complexity: TaskComplexity.Complex,
    });

    // Make API request
    const request: ProviderRequest = {
      systemPrompt: CASE_SUMMARY_SYSTEM_PROMPT,
      prompt,
      model: routing.model as ClaudeModel,
      maxTokens: 4000,
      temperature: 0.3,
    };

    try {
      const response = await providerManager.execute(request);
      const result = this.parseResponse(response.content, caseInfo.id, sortedEmails);

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
        emailCount: sortedEmails.length,
        lastEmailDate: sortedEmails[sortedEmails.length - 1].receivedDateTime.toISOString(),
        generatedAt: new Date().toISOString(),
        tokensUsed,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Case conversation summary generation failed:', error);
      return this.emptyResult(caseInfo.id, startTime);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildPrompt(emails: CaseEmail[], caseInfo: CaseInfo): string {
    // Format emails for the prompt (truncate if too many)
    const maxEmails = 50; // Limit to avoid token overflow
    const emailsToProcess =
      emails.length > maxEmails
        ? [...emails.slice(0, 10), ...emails.slice(-40)] // First 10 + last 40
        : emails;

    const emailsFormatted = emailsToProcess
      .map((email, index) => {
        const date =
          email.receivedDateTime instanceof Date
            ? email.receivedDateTime.toISOString().split('T')[0]
            : String(email.receivedDateTime).split('T')[0];

        const fromLabel = email.isFromFirm ? '[FIRM]' : '[EXTERNAL]';
        const fromName = email.from.name || email.from.address;

        // Use preview or truncated content
        const content =
          email.bodyContent.length > 1000
            ? email.bodyContent.substring(0, 1000) + '...'
            : email.bodyContent;

        return `--- Email ${index + 1} (ID: ${email.id}) ---
Date: ${date}
From: ${fromLabel} ${fromName}
Subject: ${email.subject}

${content}
--- End ---`;
      })
      .join('\n\n');

    return `Analyze ALL communications for case: "${caseInfo.title}"
Case Number: ${caseInfo.caseNumber}
Client: ${caseInfo.clientName}
${caseInfo.opposingParty ? `Opposing Party: ${caseInfo.opposingParty}` : ''}
${caseInfo.caseType ? `Case Type: ${caseInfo.caseType}` : ''}

Total emails: ${emails.length}
${emails.length > maxEmails ? `(Showing ${emailsToProcess.length} most relevant emails)` : ''}

${emailsFormatted}

Generate a comprehensive summary covering the entire communication history.`;
  }

  private parseResponse(
    content: string,
    caseId: string,
    emails: CaseEmail[]
  ): Omit<
    CaseConversationSummaryResult,
    'tokensUsed' | 'processingTimeMs' | 'emailCount' | 'lastEmailDate' | 'generatedAt'
  > {
    try {
      // Extract JSON from response
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        caseId,
        executiveSummary: parsed.executiveSummary || 'No summary available.',
        chronology: this.validateChronology(parsed.chronology || [], emails),
        keyDevelopments: Array.isArray(parsed.keyDevelopments)
          ? parsed.keyDevelopments.filter((d: unknown) => typeof d === 'string')
          : [],
        currentStatus: parsed.currentStatus || 'Status unknown.',
        openIssues: Array.isArray(parsed.openIssues)
          ? parsed.openIssues.filter((i: unknown) => typeof i === 'string')
          : [],
        nextSteps: Array.isArray(parsed.nextSteps)
          ? parsed.nextSteps.filter((s: unknown) => typeof s === 'string')
          : [],
      };
    } catch (error) {
      console.error('Failed to parse case summary response:', error);
      return {
        caseId,
        executiveSummary: 'Failed to generate summary.',
        chronology: [],
        keyDevelopments: [],
        currentStatus: 'Unknown',
        openIssues: [],
        nextSteps: [],
      };
    }
  }

  private validateChronology(events: unknown[], emails: CaseEmail[]): ChronologyEvent[] {
    if (!Array.isArray(events)) return [];

    const validSignificance = ['high', 'medium', 'low'];
    const emailIds = new Set(emails.map((e) => e.id));

    return events
      .filter(
        (e): e is Record<string, unknown> =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as Record<string, unknown>).summary === 'string'
      )
      .map((e) => ({
        date: String(e.date || new Date().toISOString().split('T')[0]),
        summary: String(e.summary),
        significance: validSignificance.includes(String(e.significance))
          ? (String(e.significance) as 'high' | 'medium' | 'low')
          : 'medium',
        parties: Array.isArray(e.parties) ? e.parties.map((p) => String(p)) : [],
        emailId: emailIds.has(String(e.emailId)) ? String(e.emailId) : emails[0]?.id || '',
      }));
  }

  private emptyResult(caseId: string, startTime: number): CaseConversationSummaryResult {
    return {
      caseId,
      executiveSummary: 'Nu există comunicări pentru acest dosar.',
      chronology: [],
      keyDevelopments: [],
      currentStatus: 'Nu există comunicări.',
      openIssues: [],
      nextSteps: [],
      lastEmailDate: '',
      emailCount: 0,
      generatedAt: new Date().toISOString(),
      tokensUsed: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// Export singleton instance
export const caseConversationSummary = new CaseConversationSummaryService();
