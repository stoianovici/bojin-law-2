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
