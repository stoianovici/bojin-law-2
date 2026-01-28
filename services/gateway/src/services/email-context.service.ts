/**
 * Email Context Service
 * OPS-259: Email Thread Summary Aggregation for Case Context
 *
 * Aggregates email thread summaries for a case, leveraging the existing
 * ThreadSummary table (populated by OPS-240 nightly processor).
 *
 * Returns structured email context for AI system prompts (~600 tokens max).
 */

import { prisma } from '@legal-platform/database';
import { subDays } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface EmailThreadSummary {
  threadId: string;
  subject: string;
  participants: string[];
  summary: string;
  actionItems: string[];
  lastMessageAt: string;
  isUrgent: boolean;
  isUnread: boolean;
}

export interface EmailThreadContext {
  threads: EmailThreadSummary[];
  pendingActionItems: string[];
  unreadCount: number;
  urgentCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_THREADS = 8;
const MAX_ACTION_ITEMS = 5;
const LOOKBACK_DAYS = 30;

// ============================================================================
// Service
// ============================================================================

export class EmailContextService {
  /**
   * Get aggregated email context for a case.
   * Returns recent threads with summaries and action items.
   * Target: ~600 tokens total
   *
   * Fallback: If no ThreadSummary records exist, generates basic context
   * directly from Email records (without AI-generated summaries).
   */
  async getForCase(caseId: string, firmId: string): Promise<EmailThreadContext> {
    const thirtyDaysAgo = subDays(new Date(), LOOKBACK_DAYS);

    // Query ThreadSummary records directly for this case
    // ThreadSummary stores conversationId + caseId + summary fields
    const threadSummaries = await prisma.threadSummary.findMany({
      where: {
        caseId,
        firmId,
        // Only include threads with generated summaries
        overview: { not: null },
      },
      orderBy: { lastAnalyzedAt: 'desc' },
      take: 15,
    });

    // If no ThreadSummary records, use fallback from Email table directly
    if (threadSummaries.length === 0) {
      return this.getFallbackContext(caseId, firmId, thirtyDaysAgo);
    }

    // Get the latest email per thread to check read status and recent activity
    const conversationIds = threadSummaries.map((t) => t.conversationId);

    // Find latest email per conversation with unread status
    const latestEmails =
      conversationIds.length > 0
        ? await prisma.email.findMany({
            where: {
              conversationId: { in: conversationIds },
              firmId,
            },
            orderBy: { receivedDateTime: 'desc' },
            distinct: ['conversationId'],
            select: {
              conversationId: true,
              subject: true,
              isRead: true,
              receivedDateTime: true,
            },
          })
        : [];

    // Create a lookup map for email metadata
    const emailMetaMap = new Map(latestEmails.map((e) => [e.conversationId, e]));

    // Filter to threads with recent activity
    const recentThreads = threadSummaries.filter((t) => {
      const emailMeta = emailMetaMap.get(t.conversationId);
      if (!emailMeta) return false;
      return emailMeta.receivedDateTime >= thirtyDaysAgo;
    });

    // Format thread summaries
    const formattedThreads: EmailThreadSummary[] = recentThreads.slice(0, MAX_THREADS).map((t) => {
      const emailMeta = emailMetaMap.get(t.conversationId);
      const participants = this.parseJsonArray<string>(t.participants);
      const actionItems = this.parseJsonArray<string>(t.actionItems);

      return {
        threadId: t.conversationId,
        subject: emailMeta?.subject || 'Fără subiect',
        participants: participants.slice(0, 3), // Limit for token budget
        summary: t.overview || '',
        actionItems,
        lastMessageAt: emailMeta?.receivedDateTime.toISOString() || t.lastAnalyzedAt.toISOString(),
        isUrgent: t.sentiment === 'urgent',
        isUnread: emailMeta ? !emailMeta.isRead : false,
      };
    });

    // Aggregate pending action items across all threads
    const allActionItems = recentThreads.flatMap((t) => this.parseJsonArray<string>(t.actionItems));
    const pendingActionItems = allActionItems.slice(0, MAX_ACTION_ITEMS);

    // Count unread and urgent
    const unreadCount = formattedThreads.filter((t) => t.isUnread).length;
    const urgentCount = formattedThreads.filter((t) => t.isUrgent).length;

    return {
      threads: formattedThreads,
      pendingActionItems,
      unreadCount,
      urgentCount,
    };
  }

  /**
   * Fallback: Get basic email context directly from Email table
   * when ThreadSummary records don't exist (nightly job hasn't run)
   */
  private async getFallbackContext(
    caseId: string,
    firmId: string,
    sinceDatetime: Date
  ): Promise<EmailThreadContext> {
    // Get emails linked to this case
    const emailLinks = await prisma.emailCaseLink.findMany({
      where: { caseId },
      include: {
        email: {
          select: {
            id: true,
            conversationId: true,
            subject: true,
            from: true,
            isRead: true,
            receivedDateTime: true,
            bodyPreview: true,
          },
        },
      },
      orderBy: { linkedAt: 'desc' },
      take: 50,
    });

    // Filter to recent emails
    const recentEmails = emailLinks
      .filter((link) => link.email.receivedDateTime >= sinceDatetime)
      .map((link) => link.email);

    if (recentEmails.length === 0) {
      return {
        threads: [],
        pendingActionItems: [],
        unreadCount: 0,
        urgentCount: 0,
      };
    }

    // Group by conversation (thread)
    const threadMap = new Map<string, typeof recentEmails>();
    for (const email of recentEmails) {
      const threadId = email.conversationId || email.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(email);
    }

    // Convert to thread summaries (basic, without AI summaries)
    const formattedThreads: EmailThreadSummary[] = [];

    for (const [threadId, emails] of threadMap.entries()) {
      if (formattedThreads.length >= MAX_THREADS) break;

      // Sort by date desc, get latest
      const sorted = emails.sort(
        (a, b) => b.receivedDateTime.getTime() - a.receivedDateTime.getTime()
      );
      const latest = sorted[0];

      // Extract sender name
      const from = latest.from as { emailAddress?: { name?: string } } | undefined;
      const senderName = from?.emailAddress?.name || 'Necunoscut';

      formattedThreads.push({
        threadId,
        subject: latest.subject || 'Fără subiect',
        participants: [senderName],
        summary: latest.bodyPreview?.slice(0, 100) || '', // Basic preview instead of AI summary
        actionItems: [],
        lastMessageAt: latest.receivedDateTime.toISOString(),
        isUrgent: false,
        isUnread: !latest.isRead,
      });
    }

    const unreadCount = formattedThreads.filter((t) => t.isUnread).length;

    return {
      threads: formattedThreads,
      pendingActionItems: [],
      unreadCount,
      urgentCount: 0,
    };
  }

  /**
   * Format email context for AI system prompt injection.
   * Target: ~600 tokens
   */
  formatForPrompt(context: EmailThreadContext): string {
    const lines: string[] = [];

    // Summary line
    lines.push(`### Corespondență (${context.threads.length} fire recente)`);
    if (context.unreadCount > 0 || context.urgentCount > 0) {
      const parts: string[] = [];
      if (context.unreadCount > 0) parts.push(`${context.unreadCount} necitite`);
      if (context.urgentCount > 0) parts.push(`${context.urgentCount} urgente`);
      lines.push(`*${parts.join(', ')}*`);
    }
    lines.push('');

    // Thread summaries
    for (const thread of context.threads.slice(0, 6)) {
      const urgentFlag = thread.isUrgent ? '⚠️ ' : '';
      const unreadFlag = thread.isUnread ? '● ' : '';
      lines.push(`**${unreadFlag}${urgentFlag}${thread.subject}**`);
      if (thread.summary) {
        lines.push(`${thread.summary}`);
      }
      if (thread.participants.length > 0) {
        lines.push(`_Cu: ${thread.participants.join(', ')}_`);
      }
      lines.push('');
    }

    // Action items
    if (context.pendingActionItems.length > 0) {
      lines.push('### Acțiuni din emailuri');
      for (const item of context.pendingActionItems) {
        lines.push(`- ${item}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Safely parse a JSON field that should be an array.
   */
  private parseJsonArray<T>(json: unknown): T[] {
    if (!json) return [];
    if (Array.isArray(json)) return json as T[];
    if (typeof json === 'string') {
      try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

// Export singleton instance
export const emailContextService = new EmailContextService();
