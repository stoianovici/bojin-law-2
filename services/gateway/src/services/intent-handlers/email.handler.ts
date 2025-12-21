/**
 * Email Intent Handler
 * OPS-074: Email Intent Handler
 *
 * Handles email-related intents: search, summarize thread, draft replies, recent emails.
 * Uses EmailSearchService for queries and EmailDraftingService for draft generation.
 */

import { prisma } from '@legal-platform/database';
import { AIOperationType } from '@legal-platform/types';
import { EmailSearchService, EmailSearchFilters } from '../email-search.service';
import { emailDraftingService, EmailTone, RecipientType } from '../email-drafting.service';
import { aiService } from '../ai.service';
import type { AssistantContext, UserContext, HandlerResult, IntentHandler } from './types';

// ============================================================================
// Types
// ============================================================================

export interface EmailHandlerParams {
  // For SearchEmails
  query?: string;
  sender?: string;
  timeRange?: 'today' | 'week' | 'month' | 'all';
  hasAttachments?: boolean;
  isUnread?: boolean;

  // For SummarizeThread
  threadId?: string;
  emailId?: string;

  // For DraftEmail
  replyToEmailId?: string;
  tone?: 'formal' | 'professional' | 'brief';
  recipientType?: 'Client' | 'Court' | 'OpposingCounsel' | 'ThirdParty';
  instructions?: string;
}

interface ThreadSummary {
  summary: string;
  keyPoints: string[];
}

// ============================================================================
// Handler
// ============================================================================

export class EmailIntentHandler implements IntentHandler {
  readonly name = 'EmailIntentHandler';

  private emailSearchService: EmailSearchService;

  constructor() {
    this.emailSearchService = new EmailSearchService(prisma);
  }

  /**
   * Search emails with filters.
   * Supports query text, sender, date range, attachments, unread status.
   */
  async handleSearchEmails(
    params: EmailHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    // Build search query - combine query and sender if both provided
    const searchText = [params.query, params.sender].filter(Boolean).join(' ');
    const dateRange = this.getDateRange(params.timeRange);

    // Build filters for EmailSearchService
    const filters: EmailSearchFilters = {
      userId: userContext.userId,
      caseId: context.currentCaseId,
      search: searchText || undefined,
      hasAttachments: params.hasAttachments,
      isUnread: params.isUnread,
      dateFrom: dateRange.start,
      dateTo: dateRange.end,
    };

    const results = await this.emailSearchService.searchEmails(filters, 10);

    if (results.totalCount === 0) {
      return {
        success: true,
        message: 'Nu am găsit emailuri care să corespundă căutării.',
      };
    }

    // Format email list for display
    const emailList = results.emails
      .map((e) => {
        const senderName = e.from.name || e.from.address;
        const dateStr = this.formatDate(e.receivedDateTime);
        return `• ${senderName}: "${e.subject}" (${dateStr})`;
      })
      .join('\n');

    return {
      success: true,
      data: results,
      message: `Am găsit ${results.totalCount} emailuri:\n${emailList}`,
    };
  }

  /**
   * Summarize an email thread using AI.
   * Gets all emails in the conversation and generates a summary with key points.
   */
  async handleSummarizeThread(
    params: EmailHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const emailId = params.emailId || context.selectedEmailId;

    if (!emailId) {
      return {
        success: false,
        message: 'Selectați un email sau specificați thread-ul pentru rezumat.',
      };
    }

    // Get the email to find its case and conversation
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      select: {
        id: true,
        conversationId: true,
        caseId: true,
        caseLinks: {
          where: { isPrimary: true },
          take: 1,
          select: { caseId: true },
        },
      },
    });

    if (!email) {
      return {
        success: false,
        message: 'Emailul nu a fost găsit.',
      };
    }

    // Get case ID from links if not directly on email
    const caseId = email.caseId || email.caseLinks[0]?.caseId;

    if (!caseId) {
      return {
        success: false,
        message: 'Emailul nu este asociat unui dosar.',
      };
    }

    // Generate thread summary
    const summary = await this.generateThreadSummary(
      caseId,
      emailId,
      email.conversationId,
      userContext
    );

    const keyPointsList = summary.keyPoints.map((p) => `• ${p}`).join('\n');

    return {
      success: true,
      data: summary,
      message: `**Rezumat conversație:**\n\n${summary.summary}\n\n**Puncte cheie:**\n${keyPointsList}`,
    };
  }

  /**
   * Generate a draft reply to an email.
   * Returns a proposed action that requires user confirmation.
   */
  async handleDraftEmail(
    params: EmailHandlerParams,
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const emailId = params.replyToEmailId || context.selectedEmailId;

    if (!emailId) {
      return {
        success: false,
        message: 'Selectați emailul la care doriți să răspundeți.',
      };
    }

    // Map tone to service enum
    const toneMap: Record<string, EmailTone> = {
      formal: 'Formal',
      professional: 'Professional',
      brief: 'Brief',
    };
    const tone = toneMap[params.tone || 'professional'] || 'Professional';

    // Map recipient type to service enum
    const recipientType = (params.recipientType || 'Client') as RecipientType;

    // Generate draft using email drafting service
    const draft = await emailDraftingService.generateDraft(
      {
        emailId,
        tone,
        recipientType,
        instructions: params.instructions,
      },
      {
        userId: userContext.userId,
        firmId: userContext.firmId,
      }
    );

    // Build preview for confirmation
    const preview = draft.body.length > 200 ? draft.body.substring(0, 200) + '...' : draft.body;

    return {
      success: true,
      proposedAction: {
        type: 'DraftEmail',
        displayText: 'Răspuns email generat',
        payload: {
          emailId,
          draftId: draft.id,
          subject: draft.subject,
          body: draft.body,
          tone: params.tone || 'professional',
        },
        confirmationPrompt: 'Folosiți acest răspuns?',
        entityPreview: {
          subiect: draft.subject,
          ton: this.translateTone(params.tone || 'professional'),
          previzualizare: preview,
        },
      },
    };
  }

  /**
   * Get recent unread emails from the last 24 hours.
   */
  async handleRecentEmails(
    context: AssistantContext,
    userContext: UserContext
  ): Promise<HandlerResult> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const filters: EmailSearchFilters = {
      userId: userContext.userId,
      caseId: context.currentCaseId,
      dateFrom: oneDayAgo,
      isUnread: true,
    };

    const results = await this.emailSearchService.searchEmails(filters, 10);

    if (results.totalCount === 0) {
      return {
        success: true,
        message: 'Nu aveți emailuri necitite în ultimele 24 de ore.',
      };
    }

    // Format email list
    const emailList = results.emails
      .map((e) => {
        const senderName = e.from.name || e.from.address;
        return `• ${senderName}: "${e.subject}"`;
      })
      .join('\n');

    return {
      success: true,
      data: results,
      message: `Aveți ${results.totalCount} emailuri noi:\n${emailList}`,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generate thread summary using AI service.
   * Fetches all emails in the conversation and generates summary with key points.
   */
  private async generateThreadSummary(
    caseId: string,
    emailId: string,
    conversationId: string | null,
    userContext: UserContext
  ): Promise<ThreadSummary> {
    // Get all emails in the thread
    const whereClause = conversationId
      ? { caseId, userId: userContext.userId, conversationId }
      : { caseId, userId: userContext.userId, id: emailId };

    const threadEmails = await prisma.email.findMany({
      where: whereClause,
      orderBy: { receivedDateTime: 'asc' },
      select: {
        receivedDateTime: true,
        from: true,
        bodyPreview: true,
        subject: true,
      },
    });

    if (threadEmails.length === 0) {
      return { summary: 'Nu există emailuri în acest thread.', keyPoints: [] };
    }

    // Build thread context for AI
    const threadContext = threadEmails
      .map((e) => {
        const from = e.from as { name?: string; address: string };
        const senderName = from.name || from.address;
        const date = e.receivedDateTime.toISOString().split('T')[0];
        return `[${date}] ${senderName}:\n${e.bodyPreview}`;
      })
      .join('\n\n---\n\n');

    // Generate summary via AI
    const result = await aiService.generate({
      prompt: `Analizează următoarea conversație email și generează:
1. Un rezumat concis (2-3 propoziții) în limba română
2. Lista punctelor cheie (maxim 5) în limba română

Conversație:
${threadContext}

Răspunde în format JSON strict:
{
  "summary": "rezumatul aici",
  "keyPoints": ["punct 1", "punct 2", "punct 3"]
}`,
      operationType: AIOperationType.CommunicationIntelligence,
      firmId: userContext.firmId,
      userId: userContext.userId,
      maxTokens: 500,
      temperature: 0.3,
    });

    // Parse AI response
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Rezumat indisponibil.',
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        };
      }
    } catch {
      // If JSON parsing fails, return raw content as summary
    }

    return {
      summary: result.content,
      keyPoints: [],
    };
  }

  /**
   * Get date range for time filter.
   */
  private getDateRange(timeRange?: string): { start?: Date; end?: Date } {
    const now = new Date();

    switch (timeRange) {
      case 'today': {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        return { start: startOfDay };
      }
      case 'week':
        return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      case 'month':
        return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      default:
        return {};
    }
  }

  /**
   * Translate tone to Romanian.
   */
  private translateTone(tone: string): string {
    const tones: Record<string, string> = {
      formal: 'Formal',
      professional: 'Profesional',
      brief: 'Scurt',
    };
    return tones[tone] || tone;
  }

  /**
   * Format date for display in Romanian locale.
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  }
}

// Export singleton instance
export const emailIntentHandler = new EmailIntentHandler();
