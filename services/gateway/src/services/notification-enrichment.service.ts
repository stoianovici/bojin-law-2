/**
 * Notification Enrichment Service
 *
 * Enriches in-app notifications with AI-generated content for the
 * Flipboard-style mobile briefing experience.
 *
 * Responsibilities:
 * 1. Queue enrichment when InAppNotification is created
 * 2. Fetch context (case, client, deadline data)
 * 3. Call Claude to generate headline, summary, priority, actions
 * 4. Store in EnrichedNotification table
 * 5. Build Flipboard pages for the mobile UI
 */

import { prisma, Prisma } from '@legal-platform/database';
import { aiClient } from './ai-client.service';
import logger from '../utils/logger';
import {
  EnrichedNotificationData,
  FlipboardNotification,
  FlipboardPage,
  FlipboardPagesConnection,
  RelatedItem,
  SuggestedAction,
  AIEnrichmentResponse,
  NotificationPriority,
  EnrichmentStatus,
} from './notification-enrichment.types';

// ============================================================================
// Constants
// ============================================================================

const ENRICHMENT_MODEL = 'claude-3-5-haiku-20241022'; // Fast & cheap for enrichment
const MAX_TOKENS = 500;
const NOTIFICATIONS_PER_PAGE = 3;
const TOTAL_LAYOUT_VARIANTS = 6;

// Action templates based on notification type
const ACTION_TEMPLATES: Record<string, SuggestedAction[]> = {
  EMAIL_FROM_COURT: [
    { id: 'view', label: 'Vezi email', icon: 'Mail', type: 'view_email' },
    { id: 'task', label: 'Creeaza sarcina', icon: 'ListTodo', type: 'create_task' },
    { id: 'note', label: 'Adauga nota', icon: 'StickyNote', type: 'add_note' },
  ],
  TASK_OVERDUE: [
    { id: 'view', label: 'Vezi sarcina', icon: 'CheckSquare', type: 'navigate' },
    { id: 'snooze', label: 'Amana', icon: 'Clock', type: 'snooze' },
    { id: 'complete', label: 'Finalizeaza', icon: 'Check', type: 'complete' },
  ],
  TASK_DUE_TODAY: [
    { id: 'view', label: 'Vezi sarcina', icon: 'CheckSquare', type: 'navigate' },
    { id: 'complete', label: 'Finalizeaza', icon: 'Check', type: 'complete' },
  ],
  DOCUMENT_UPLOADED: [
    { id: 'view', label: 'Vezi document', icon: 'FileText', type: 'view_document' },
    { id: 'note', label: 'Adauga nota', icon: 'StickyNote', type: 'add_note' },
  ],
  EMAIL_RECEIVED: [
    { id: 'view', label: 'Vezi email', icon: 'Mail', type: 'view_email' },
    { id: 'reply', label: 'Raspunde', icon: 'Reply', type: 'navigate' },
  ],
  CASE_HEARING_TODAY: [
    { id: 'view', label: 'Vezi dosarul', icon: 'Briefcase', type: 'navigate' },
    { id: 'schedule', label: 'Calendar', icon: 'Calendar', type: 'schedule' },
  ],
  default: [{ id: 'view', label: 'Deschide', icon: 'ExternalLink', type: 'navigate' }],
};

// Priority mapping based on event type
const PRIORITY_MAP: Record<string, NotificationPriority> = {
  EMAIL_FROM_COURT: 'featured',
  TASK_OVERDUE: 'featured',
  CASE_HEARING_TODAY: 'featured',
  TASK_DUE_TODAY: 'secondary',
  DOCUMENT_UPLOADED: 'secondary',
  EMAIL_RECEIVED: 'secondary',
};

// ============================================================================
// Service Class
// ============================================================================

export class NotificationEnrichmentService {
  /**
   * Queue enrichment for a notification (async, non-blocking)
   */
  async queueEnrichment(notificationId: string, userId: string): Promise<void> {
    // Run enrichment in background to not block notification creation
    setImmediate(async () => {
      try {
        await this.enrichNotification(notificationId, userId);
      } catch (error) {
        logger.error('[NotificationEnrichment] Failed to enrich notification:', {
          notificationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Enrich a single notification with AI-generated content
   */
  async enrichNotification(
    notificationId: string,
    userId: string
  ): Promise<Prisma.EnrichedNotificationGetPayload<object> | null> {
    // Check if already enriched
    const existing = await prisma.enrichedNotification.findUnique({
      where: { notificationId },
    });

    if (existing) {
      return existing;
    }

    // Get the notification with context
    const notification = await prisma.inAppNotification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      logger.warn('[NotificationEnrichment] Notification not found', { notificationId });
      return null;
    }

    // Build context for AI enrichment
    const context = await this.buildNotificationContext(notification);

    // Generate enriched content
    const enrichedData = await this.generateEnrichedContent(notification, context, userId);

    // Store enriched notification
    const enriched = await prisma.enrichedNotification.create({
      data: {
        notificationId,
        userId,
        headline: enrichedData.headline,
        summary: enrichedData.summary,
        imageUrl: enrichedData.imageUrl,
        priority: enrichedData.priority,
        relatedItems: enrichedData.relatedItems as unknown as Prisma.InputJsonValue,
        suggestedActions: enrichedData.suggestedActions as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info('[NotificationEnrichment] Enriched notification:', {
      notificationId,
      headline: enrichedData.headline,
      priority: enrichedData.priority,
    });

    return enriched;
  }

  /**
   * Build context for AI enrichment
   */
  private async buildNotificationContext(
    notification: Prisma.InAppNotificationGetPayload<object>
  ): Promise<{
    caseName?: string;
    clientName?: string;
    dueDate?: string;
    relatedItems: RelatedItem[];
  }> {
    const actionData = notification.actionData as {
      entityId?: string;
      caseId?: string;
      type?: string;
    } | null;
    const relatedItems: RelatedItem[] = [];

    // Fetch case context if available
    let caseName: string | undefined;
    let clientName: string | undefined;

    if (actionData?.caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: actionData.caseId },
        select: {
          id: true,
          title: true,
          caseNumber: true,
          client: { select: { id: true, name: true } },
        },
      });

      if (caseData) {
        caseName = caseData.title;
        clientName = caseData.client?.name;

        relatedItems.push({
          type: 'case',
          id: caseData.id,
          title: caseData.caseNumber || caseData.title,
          subtitle: caseData.client?.name,
          href: `/cases/${caseData.id}`,
        });

        if (caseData.client) {
          relatedItems.push({
            type: 'client',
            id: caseData.client.id,
            title: caseData.client.name,
            href: `/clients/${caseData.client.id}`,
          });
        }
      }
    }

    // Fetch task context if it's a task notification
    if (actionData?.entityId && actionData.type?.includes('task')) {
      const task = await prisma.task.findUnique({
        where: { id: actionData.entityId },
        select: {
          id: true,
          title: true,
          dueDate: true,
          case: { select: { id: true, title: true, caseNumber: true } },
        },
      });

      if (task) {
        relatedItems.push({
          type: 'task',
          id: task.id,
          title: task.title,
          subtitle: task.dueDate
            ? `Termen: ${new Date(task.dueDate).toLocaleDateString('ro-RO')}`
            : undefined,
          href: `/tasks/${task.id}`,
        });
      }
    }

    return { caseName, clientName, relatedItems };
  }

  /**
   * Generate enriched content using AI
   */
  private async generateEnrichedContent(
    notification: Prisma.InAppNotificationGetPayload<object>,
    context: { caseName?: string; clientName?: string; relatedItems: RelatedItem[] },
    userId: string
  ): Promise<EnrichedNotificationData> {
    // Get user's firm for AI call tracking
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firmId: true },
    });

    const firmId = user?.firmId || 'unknown';

    // Determine event type from actionType
    const eventType = notification.actionType || 'default';
    const defaultPriority = PRIORITY_MAP[eventType] || 'secondary';
    const defaultActions = ACTION_TEMPLATES[eventType] || ACTION_TEMPLATES.default;

    // Build enrichment prompt
    const prompt = this.buildEnrichmentPrompt(notification, context, defaultPriority);

    try {
      const response = await aiClient.chat(
        [{ role: 'user', content: prompt }],
        {
          feature: 'notification_enrichment',
          userId,
          firmId,
          entityType: 'notification',
          entityId: notification.id,
        },
        {
          model: ENRICHMENT_MODEL,
          maxTokens: MAX_TOKENS,
          temperature: 0.3,
          system: `Esti un editor de stiri pentru o aplicatie juridica. Genereaza titluri si rezumate concise in limba romana pentru notificari. Raspunde DOAR cu JSON valid.`,
        }
      );

      // Parse AI response
      const content =
        typeof response.content === 'string'
          ? response.content
          : response.content.map((c) => (c.type === 'text' ? c.text : '')).join('');

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AIEnrichmentResponse;

        // Merge AI-generated actions with defaults
        const suggestedActions: SuggestedAction[] = (parsed.suggestedActions || []).map((a, i) => ({
          ...a,
          id: `ai-${i}`,
        }));

        // Add default actions that aren't duplicates
        defaultActions.forEach((defaultAction) => {
          if (!suggestedActions.some((a) => a.type === defaultAction.type)) {
            suggestedActions.push(defaultAction);
          }
        });

        return {
          headline: parsed.headline || notification.title,
          summary: parsed.summary || notification.body,
          priority: parsed.priority || defaultPriority,
          relatedItems: context.relatedItems,
          suggestedActions: suggestedActions.slice(0, 3), // Max 3 actions
        };
      }
    } catch (error) {
      logger.warn('[NotificationEnrichment] AI enrichment failed, using defaults:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Fallback to basic enrichment without AI
    return {
      headline: this.generateFallbackHeadline(notification),
      summary: notification.body,
      priority: defaultPriority,
      relatedItems: context.relatedItems,
      suggestedActions: defaultActions.slice(0, 3),
    };
  }

  /**
   * Build the enrichment prompt for AI
   */
  private buildEnrichmentPrompt(
    notification: Prisma.InAppNotificationGetPayload<object>,
    context: { caseName?: string; clientName?: string },
    defaultPriority: NotificationPriority
  ): string {
    const contextParts: string[] = [];
    if (context.caseName) contextParts.push(`Dosar: ${context.caseName}`);
    if (context.clientName) contextParts.push(`Client: ${context.clientName}`);

    return `Transforma aceasta notificare intr-un format de revista:

Titlu original: ${notification.title}
Continut: ${notification.body}
${contextParts.length > 0 ? `Context: ${contextParts.join(', ')}` : ''}

Genereaza un JSON cu:
{
  "headline": "Titlu captivant max 80 caractere",
  "summary": "Rezumat informativ max 200 caractere",
  "priority": "${defaultPriority}"
}

Reguli:
- Headline: Concis, la obiect, fara emoticoane
- Summary: Informatii cheie, actiunile necesare
- Priority: "featured" pentru urgent/important, "secondary" altfel`;
  }

  /**
   * Generate fallback headline without AI
   */
  private generateFallbackHeadline(
    notification: Prisma.InAppNotificationGetPayload<object>
  ): string {
    // Clean up the title for a more magazine-style headline
    let headline = notification.title;

    // Remove common prefixes
    headline = headline.replace(/^(Notificare|Alerta|Aviz):\s*/i, '');

    // Capitalize first letter
    headline = headline.charAt(0).toUpperCase() + headline.slice(1);

    // Truncate if too long
    if (headline.length > 80) {
      headline = headline.substring(0, 77) + '...';
    }

    return headline;
  }

  /**
   * Get enriched notifications for a user
   */
  async getEnrichedNotifications(
    userId: string,
    limit: number = 30
  ): Promise<FlipboardNotification[]> {
    const enriched = await prisma.enrichedNotification.findMany({
      where: { userId },
      include: {
        notification: true,
      },
      orderBy: { enrichedAt: 'desc' },
      take: limit,
    });

    return enriched.map((e) => ({
      id: e.id,
      notificationId: e.notificationId,
      headline: e.headline,
      summary: e.summary,
      imageUrl: e.imageUrl ?? undefined,
      priority: e.priority as NotificationPriority,
      relatedItems: (e.relatedItems as unknown as RelatedItem[]) || [],
      suggestedActions: (e.suggestedActions as unknown as SuggestedAction[]) || [],
      originalTitle: e.notification.title,
      action: e.notification.actionData as
        | { type: string; entityId?: string; caseId?: string }
        | undefined,
      createdAt: e.notification.createdAt,
      read: e.notification.read,
      enrichmentStatus: 'ENRICHED' as EnrichmentStatus,
    }));
  }

  /**
   * Get recent unenriched notifications for a user (created in last 5 minutes)
   * These show as "pending" in the UI while enrichment is processing
   */
  async getUnenrichedNotifications(
    userId: string,
    existingNotificationIds: string[]
  ): Promise<FlipboardNotification[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const unenriched = await prisma.inAppNotification.findMany({
      where: {
        userId,
        createdAt: { gte: fiveMinutesAgo },
        id: { notIn: existingNotificationIds },
      },
      orderBy: { createdAt: 'desc' },
    });

    return unenriched.map((n) => ({
      id: `pending-${n.id}`, // Prefix to distinguish from enriched
      notificationId: n.id,
      headline: n.title,
      summary: n.body,
      priority: 'secondary' as NotificationPriority,
      relatedItems: [],
      suggestedActions: [],
      originalTitle: n.title,
      action: n.actionData as { type: string; entityId?: string; caseId?: string } | undefined,
      createdAt: n.createdAt,
      read: n.read,
      enrichmentStatus: 'PENDING' as EnrichmentStatus,
    }));
  }

  /**
   * Build Flipboard pages for the mobile UI
   */
  async buildFlipboardPages(userId: string, limit: number = 30): Promise<FlipboardPage[]> {
    // Get enriched notifications
    const enrichedNotifications = await this.getEnrichedNotifications(userId, limit);

    // Get existing notification IDs to avoid duplicates
    const enrichedNotificationIds = enrichedNotifications.map((n) => n.notificationId);

    // Get recent unenriched notifications (pending enrichment)
    const pendingNotifications = await this.getUnenrichedNotifications(
      userId,
      enrichedNotificationIds
    );

    // Merge and sort all notifications
    const allNotifications = [...enrichedNotifications, ...pendingNotifications];

    if (allNotifications.length === 0) {
      return [];
    }

    // Sort by priority (featured first), then by enrichment status (enriched first), then by date
    const sorted = [...allNotifications].sort((a, b) => {
      // Featured priority first
      if (a.priority === 'featured' && b.priority !== 'featured') return -1;
      if (b.priority === 'featured' && a.priority !== 'featured') return 1;
      // Enriched before pending (so enriched content shows first)
      if (a.enrichmentStatus === 'ENRICHED' && b.enrichmentStatus === 'PENDING') return -1;
      if (b.enrichmentStatus === 'ENRICHED' && a.enrichmentStatus === 'PENDING') return 1;
      // Then by date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Group into pages of 3
    const pages: FlipboardPage[] = [];
    let previousVariant = -1;

    for (let i = 0; i < sorted.length; i += NOTIFICATIONS_PER_PAGE) {
      const pageNotifications = sorted.slice(i, i + NOTIFICATIONS_PER_PAGE);
      const pageIndex = Math.floor(i / NOTIFICATIONS_PER_PAGE);

      // Select layout variant, avoiding repetition
      let layoutVariant = pageIndex % TOTAL_LAYOUT_VARIANTS;
      if (layoutVariant === previousVariant) {
        layoutVariant = (layoutVariant + 1) % TOTAL_LAYOUT_VARIANTS;
      }
      previousVariant = layoutVariant;

      pages.push({
        pageIndex,
        layoutVariant,
        notifications: pageNotifications,
      });
    }

    return pages;
  }

  /**
   * Build paginated Flipboard pages for the mobile UI
   * Supports cursor-based pagination for infinite scroll
   */
  async buildFlipboardPagesConnection(
    userId: string,
    limit: number = 30,
    after?: string
  ): Promise<FlipboardPagesConnection> {
    // Decode cursor if provided (base64 encoded notification ID)
    let afterNotificationId: string | undefined;
    if (after) {
      try {
        afterNotificationId = Buffer.from(after, 'base64').toString('utf-8');
      } catch {
        // Invalid cursor, ignore
      }
    }

    // Get total count of enriched notifications
    const totalCount = await prisma.enrichedNotification.count({
      where: { userId },
    });

    // Get enriched notifications with cursor-based pagination
    const enriched = await prisma.enrichedNotification.findMany({
      where: {
        userId,
        ...(afterNotificationId && {
          id: { lt: afterNotificationId },
        }),
      },
      include: {
        notification: true,
      },
      orderBy: { enrichedAt: 'desc' },
      take: limit + 1, // Fetch one extra to determine hasNextPage
    });

    // Determine if there are more pages
    const hasNextPage = enriched.length > limit;
    const notifications = enriched.slice(0, limit);

    // Convert to FlipboardNotification format
    const flipboardNotifications: FlipboardNotification[] = notifications.map((e) => ({
      id: e.id,
      notificationId: e.notificationId,
      headline: e.headline,
      summary: e.summary,
      imageUrl: e.imageUrl ?? undefined,
      priority: e.priority as NotificationPriority,
      relatedItems: (e.relatedItems as unknown as RelatedItem[]) || [],
      suggestedActions: (e.suggestedActions as unknown as SuggestedAction[]) || [],
      originalTitle: e.notification.title,
      action: e.notification.actionData as
        | { type: string; entityId?: string; caseId?: string }
        | undefined,
      createdAt: e.notification.createdAt,
      read: e.notification.read,
      enrichmentStatus: 'ENRICHED' as EnrichmentStatus,
    }));

    // Get existing notification IDs to avoid duplicates for pending
    const enrichedNotificationIds = flipboardNotifications.map((n) => n.notificationId);

    // Get recent unenriched notifications (only for first page)
    let allNotifications = flipboardNotifications;
    if (!after) {
      const pendingNotifications = await this.getUnenrichedNotifications(
        userId,
        enrichedNotificationIds
      );
      allNotifications = [...pendingNotifications, ...flipboardNotifications];
    }

    if (allNotifications.length === 0) {
      return {
        pages: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: 0,
      };
    }

    // Sort by priority (featured first), then by enrichment status, then by date
    const sorted = [...allNotifications].sort((a, b) => {
      if (a.priority === 'featured' && b.priority !== 'featured') return -1;
      if (b.priority === 'featured' && a.priority !== 'featured') return 1;
      if (a.enrichmentStatus === 'ENRICHED' && b.enrichmentStatus === 'PENDING') return -1;
      if (b.enrichmentStatus === 'ENRICHED' && a.enrichmentStatus === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Group into pages of 3
    const pages: FlipboardPage[] = [];
    let previousVariant = -1;

    for (let i = 0; i < sorted.length; i += NOTIFICATIONS_PER_PAGE) {
      const pageNotifications = sorted.slice(i, i + NOTIFICATIONS_PER_PAGE);
      const pageIndex = Math.floor(i / NOTIFICATIONS_PER_PAGE);

      let layoutVariant = pageIndex % TOTAL_LAYOUT_VARIANTS;
      if (layoutVariant === previousVariant) {
        layoutVariant = (layoutVariant + 1) % TOTAL_LAYOUT_VARIANTS;
      }
      previousVariant = layoutVariant;

      pages.push({
        pageIndex,
        layoutVariant,
        notifications: pageNotifications,
      });
    }

    // Get the last enriched notification ID for cursor
    const lastEnrichedNotification = notifications[notifications.length - 1];
    const endCursor = lastEnrichedNotification
      ? Buffer.from(lastEnrichedNotification.id).toString('base64')
      : null;

    return {
      pages,
      pageInfo: {
        hasNextPage,
        endCursor,
      },
      totalCount,
    };
  }

  /**
   * Execute a notification action (e.g., create task, add note)
   */
  async executeAction(notificationId: string, actionId: string, userId: string): Promise<boolean> {
    const enriched = await prisma.enrichedNotification.findFirst({
      where: { notificationId, userId },
    });

    if (!enriched) {
      return false;
    }

    const actions = enriched.suggestedActions as unknown as SuggestedAction[];
    const action = actions.find((a) => a.id === actionId);

    if (!action) {
      return false;
    }

    // Handle different action types
    switch (action.type) {
      case 'complete':
        // Mark task as complete
        if (action.payload?.taskId) {
          await prisma.task.update({
            where: { id: action.payload.taskId as string },
            data: { status: 'Completed', completedAt: new Date() },
          });
        }
        break;

      case 'snooze':
        // Snooze would be handled client-side (dismiss notification)
        break;

      case 'create_task':
      case 'add_note':
      case 'navigate':
      case 'view_email':
      case 'view_document':
      case 'schedule':
        // These are navigation actions handled client-side
        break;

      default:
        logger.warn('[NotificationEnrichment] Unknown action type', { actionType: action.type });
        return false;
    }

    // Mark notification as read after action
    await prisma.inAppNotification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return true;
  }
}

// Export singleton instance
export const notificationEnrichmentService = new NotificationEnrichmentService();
