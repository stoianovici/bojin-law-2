/**
 * Activity Notification Service
 * OPS-120: Notification Engine
 *
 * Processes user activity events and routes notifications to appropriate channels:
 * - URGENT events → Push notification + in-app
 * - HIGH events → In-app notification (push if online)
 * - NORMAL events → Batched for daily digest
 *
 * Works with ActivityEventService (OPS-116) for event data.
 *
 * Note: This is separate from notification.service.ts which handles
 * case approval and document review notifications.
 */

import { prisma, redis } from '@legal-platform/database';
import { ActivityEventType, UserActivityEvent, Prisma } from '@prisma/client';
import { addDays, startOfDay, format, setHours, setMinutes } from 'date-fns';
import { ro } from 'date-fns/locale';
import { activityEventService } from './activity-event.service';
import { notificationEnrichmentService } from './notification-enrichment.service';

// ============================================================================
// Types
// ============================================================================

export interface NotificationContent {
  title: string;
  body: string;
  icon?: string;
  action?: NotificationAction;
}

export interface NotificationAction {
  type: string;
  entityId?: string;
  caseId?: string;
}

interface ProcessingStats {
  usersProcessed: number;
  urgentSent: number;
  highSent: number;
  normalQueued: number;
  errors: number;
}

// ============================================================================
// Constants
// ============================================================================

const ONLINE_USER_KEY_PREFIX = 'user-online:';
const ONLINE_TTL_SECONDS = 10 * 60; // 10 minutes
const BATCH_SIZE = 50;

// Digest is scheduled for 7:00 AM Bucharest time (UTC+2/+3)
const DIGEST_HOUR = 7;
const DIGEST_MINUTE = 0;

// ============================================================================
// Service
// ============================================================================

export class ActivityNotificationService {
  /**
   * Process pending events for all users
   * Called by background job every 5 minutes
   */
  async processAllPendingEvents(): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      usersProcessed: 0,
      urgentSent: 0,
      highSent: 0,
      normalQueued: 0,
      errors: 0,
    };

    console.log('[ActivityNotificationService] Starting notification processing');
    const startTime = Date.now();

    try {
      // Find users with unnotified events
      const usersWithEvents = await prisma.userActivityEvent.groupBy({
        by: ['userId'],
        where: { notified: false },
        _count: true,
      });

      console.log(
        `[ActivityNotificationService] Found ${usersWithEvents.length} users with pending events`
      );

      for (const { userId } of usersWithEvents) {
        try {
          const userStats = await this.processUserEvents(userId);
          stats.usersProcessed++;
          stats.urgentSent += userStats.urgent;
          stats.highSent += userStats.high;
          stats.normalQueued += userStats.normal;
        } catch (error) {
          console.error(`[ActivityNotificationService] Error processing user ${userId}:`, error);
          stats.errors++;
        }
      }
    } catch (error) {
      console.error('[ActivityNotificationService] Error in batch processing:', error);
      stats.errors++;
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[ActivityNotificationService] Completed in ${elapsed}ms. ` +
        `Users: ${stats.usersProcessed}, Urgent: ${stats.urgentSent}, ` +
        `High: ${stats.highSent}, Queued: ${stats.normalQueued}, Errors: ${stats.errors}`
    );

    return stats;
  }

  /**
   * Process events for a single user
   */
  async processUserEvents(
    userId: string
  ): Promise<{ urgent: number; high: number; normal: number }> {
    const events = await activityEventService.getUnnotified(userId, { limit: BATCH_SIZE });
    if (events.length === 0) {
      return { urgent: 0, high: 0, normal: 0 };
    }

    // Group by importance
    const urgent = events.filter((e) => e.importance === 'URGENT');
    const high = events.filter((e) => e.importance === 'HIGH');
    const normal = events.filter((e) => e.importance === 'NORMAL' || e.importance === 'LOW');

    // Process urgent immediately - push + in-app
    for (const event of urgent) {
      await this.sendPushNotification(userId, event);
      await this.createInAppNotification(userId, this.formatNotification(event), event.id);
    }
    if (urgent.length > 0) {
      await activityEventService.markNotified(urgent.map((e) => e.id));
    }

    // Process high - in-app always, push if online
    if (high.length > 0) {
      const isOnline = await this.isUserOnline(userId);

      // Always create in-app notifications for high priority
      if (high.length === 1) {
        await this.createInAppNotification(userId, this.formatNotification(high[0]), high[0].id);
      } else {
        await this.createInAppNotification(
          userId,
          this.formatBatchNotification(high),
          undefined // No single source event for batch
        );
      }

      // Send push if online
      if (isOnline) {
        for (const event of high) {
          await this.sendPushNotification(userId, event);
        }
      }

      await activityEventService.markNotified(high.map((e) => e.id));
    }

    // Queue normal events for daily digest
    if (normal.length > 0) {
      await this.queueForDigest(userId, normal);
      await activityEventService.markNotified(normal.map((e) => e.id));
    }

    return {
      urgent: urgent.length,
      high: high.length,
      normal: normal.length,
    };
  }

  /**
   * Send push notification for a single event
   */
  private async sendPushNotification(userId: string, event: UserActivityEvent): Promise<boolean> {
    const notification = this.formatNotification(event);

    // Get user's active push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId, active: true },
    });

    if (subscriptions.length === 0) {
      return false;
    }

    // TODO: Integrate with web-push library when push is enabled
    // For now, log the notification that would be sent
    console.log(
      `[ActivityNotificationService] Would send push to ${subscriptions.length} devices for user ${userId}:`,
      notification.title
    );

    return true;
  }

  /**
   * Create in-app notification
   */
  async createInAppNotification(
    userId: string,
    notification: NotificationContent,
    sourceEventId?: string
  ): Promise<void> {
    const created = await prisma.inAppNotification.create({
      data: {
        userId,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        actionType: notification.action?.type,
        actionData: notification.action as unknown as Prisma.InputJsonValue,
        sourceEventId,
      },
    });

    // Queue enrichment for Flipboard-style briefing (async, non-blocking)
    notificationEnrichmentService.queueEnrichment(created.id, userId).catch((err) => {
      console.error('[ActivityNotificationService] Failed to queue enrichment:', err);
    });
  }

  /**
   * Queue events for daily digest email
   */
  private async queueForDigest(userId: string, events: UserActivityEvent[]): Promise<void> {
    const scheduledFor = this.getNextDigestTime();

    await prisma.digestQueue.createMany({
      data: events.map((e) => ({
        userId,
        eventId: e.id,
        eventType: e.eventType,
        eventTitle: e.entityTitle,
        eventData: e.metadata as Prisma.InputJsonValue,
        scheduledFor,
      })),
    });
  }

  /**
   * Send daily digest emails
   * Called by cron at 7:00 AM
   */
  async sendDailyDigests(): Promise<{ sent: number; errors: number }> {
    console.log('[ActivityNotificationService] Starting daily digest generation');
    const startTime = Date.now();
    let sent = 0;
    let errors = 0;

    const now = new Date();

    // Get all users with pending digest items
    const usersWithDigest = await prisma.digestQueue.groupBy({
      by: ['userId'],
      where: {
        scheduledFor: { lte: now },
        sent: false,
      },
      _count: true,
    });

    for (const { userId } of usersWithDigest) {
      try {
        await this.sendUserDigest(userId);
        sent++;
      } catch (error) {
        console.error(`[ActivityNotificationService] Error sending digest to ${userId}:`, error);
        errors++;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[ActivityNotificationService] Daily digest completed in ${elapsed}ms. Sent: ${sent}, Errors: ${errors}`
    );

    return { sent, errors };
  }

  /**
   * Send digest email to a single user
   */
  private async sendUserDigest(userId: string): Promise<void> {
    const now = new Date();

    // Get pending digest items
    const items = await prisma.digestQueue.findMany({
      where: {
        userId,
        scheduledFor: { lte: now },
        sent: false,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    if (items.length === 0) {
      return;
    }

    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });

    if (!user?.email) {
      console.warn(`[ActivityNotificationService] User ${userId} has no email for digest`);
      return;
    }

    // Build digest content
    const digest = this.buildDigestContent(items, user.firstName);

    // TODO: Send email via SendGrid/AWS SES
    console.log(
      `[ActivityNotificationService] Would send digest email to ${user.email} with ${items.length} items`
    );
    console.log(`[ActivityNotificationService] Digest content:`, digest.subject);

    // Mark items as sent
    await prisma.digestQueue.updateMany({
      where: {
        id: { in: items.map((i) => i.id) },
      },
      data: { sent: true },
    });
  }

  /**
   * Build digest email content
   */
  private buildDigestContent(
    items: Array<{ eventType: string; eventTitle: string | null; eventData: Prisma.JsonValue }>,
    firstName: string
  ): { subject: string; body: string } {
    const today = format(new Date(), 'd MMMM yyyy', { locale: ro });

    // Group by type
    const byType: Record<string, number> = {};
    for (const item of items) {
      byType[item.eventType] = (byType[item.eventType] || 0) + 1;
    }

    const parts: string[] = [];
    if (byType.EMAIL_RECEIVED) parts.push(`${byType.EMAIL_RECEIVED} emailuri noi`);
    if (byType.DOCUMENT_UPLOADED) parts.push(`${byType.DOCUMENT_UPLOADED} documente noi`);
    if (byType.TASK_ASSIGNED) parts.push(`${byType.TASK_ASSIGNED} sarcini noi`);

    const summary = parts.length > 0 ? parts.join(', ') : 'activitate nouă';

    return {
      subject: `[Legal Platform] Rezumat ${today}: ${summary}`,
      body: `Bună, ${firstName}!\n\nIată ce s-a întâmplat:\n\n${items.map((i) => `- ${i.eventTitle || i.eventType}`).join('\n')}\n\nAccesează platforma pentru detalii.`,
    };
  }

  // ============================================================================
  // Notification Formatting
  // ============================================================================

  /**
   * Format notification content from an activity event
   */
  formatNotification(event: UserActivityEvent): NotificationContent {
    const templates: Partial<
      Record<ActivityEventType, (e: UserActivityEvent) => NotificationContent>
    > = {
      EMAIL_FROM_COURT: (e) => ({
        title: 'Email de la instanță',
        body: e.entityTitle || 'Ai primit un email de la instanță',
        icon: 'court',
        action: { type: 'open_email', entityId: e.entityId },
      }),

      TASK_OVERDUE: (e) => ({
        title: 'Sarcină întârziată',
        body: e.entityTitle || 'Ai o sarcină întârziată',
        icon: 'warning',
        action: { type: 'open_task', entityId: e.entityId },
      }),

      TASK_DUE_TODAY: (e) => ({
        title: 'Termen azi',
        body: e.entityTitle || 'Ai o sarcină cu termen azi',
        icon: 'calendar',
        action: { type: 'open_task', entityId: e.entityId },
      }),

      CASE_HEARING_TODAY: (e) => ({
        title: 'Ședință azi',
        body: e.entityTitle || 'Ai o ședință programată azi',
        icon: 'court',
        action: { type: 'open_case', entityId: e.entityId },
      }),

      EMAIL_RECEIVED: (e) => ({
        title: 'Email nou',
        body: e.entityTitle || 'Ai primit un email nou',
        icon: 'email',
        action: { type: 'open_email', entityId: e.entityId },
      }),

      DOCUMENT_UPLOADED: (e) => ({
        title: 'Document nou',
        body: e.entityTitle || 'Un document nou a fost adăugat',
        icon: 'document',
        action: { type: 'open_document', entityId: e.entityId },
      }),

      TASK_ASSIGNED: (e) => ({
        title: 'Sarcină nouă',
        body: e.entityTitle || 'Ți-a fost asignată o sarcină nouă',
        icon: 'task',
        action: { type: 'open_task', entityId: e.entityId },
      }),

      TASK_COMPLETED: (e) => ({
        title: 'Sarcină finalizată',
        body: e.entityTitle || 'O sarcină a fost finalizată',
        icon: 'check',
        action: { type: 'open_task', entityId: e.entityId },
      }),

      CASE_DEADLINE_APPROACHING: (e) => ({
        title: 'Termen apropiat',
        body: e.entityTitle || 'Un termen se apropie',
        icon: 'calendar',
        action: { type: 'open_case', entityId: e.entityId },
      }),

      CASE_STATUS_CHANGED: (e) => ({
        title: 'Status dosar modificat',
        body: e.entityTitle || 'Statusul unui dosar s-a schimbat',
        icon: 'case',
        action: { type: 'open_case', entityId: e.entityId },
      }),

      CALENDAR_EVENT_TODAY: (e) => ({
        title: 'Eveniment azi',
        body: e.entityTitle || 'Ai un eveniment programat azi',
        icon: 'calendar',
        action: { type: 'open_calendar', entityId: e.entityId },
      }),

      CALENDAR_EVENT_REMINDER: (e) => ({
        title: 'Reminder',
        body: e.entityTitle || 'Eveniment în curând',
        icon: 'calendar',
        action: { type: 'open_calendar', entityId: e.entityId },
      }),

      EMAIL_CLASSIFIED: (e) => ({
        title: 'Email clasificat',
        body: e.entityTitle || 'Un email a fost clasificat automat',
        icon: 'email',
        action: { type: 'open_email', entityId: e.entityId },
      }),

      DOCUMENT_SHARED: (e) => ({
        title: 'Document partajat',
        body: e.entityTitle || 'Un document a fost partajat cu tine',
        icon: 'document',
        action: { type: 'open_document', entityId: e.entityId },
      }),
    };

    const formatter = templates[event.eventType] || this.defaultFormatter;
    return formatter(event);
  }

  /**
   * Default formatter for unknown event types
   */
  private defaultFormatter(event: UserActivityEvent): NotificationContent {
    return {
      title: 'Notificare',
      body: event.entityTitle || 'Activitate nouă',
      icon: 'notification',
      action: { type: 'open_inbox' },
    };
  }

  /**
   * Format batch notification for multiple events
   */
  formatBatchNotification(events: UserActivityEvent[]): NotificationContent {
    const typeCount = events.reduce(
      (acc, e) => {
        acc[e.eventType] = (acc[e.eventType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const parts: string[] = [];
    if (typeCount.EMAIL_RECEIVED || typeCount.EMAIL_FROM_COURT) {
      const count = (typeCount.EMAIL_RECEIVED || 0) + (typeCount.EMAIL_FROM_COURT || 0);
      parts.push(`${count} emailuri`);
    }
    if (typeCount.DOCUMENT_UPLOADED || typeCount.DOCUMENT_SHARED) {
      const count = (typeCount.DOCUMENT_UPLOADED || 0) + (typeCount.DOCUMENT_SHARED || 0);
      parts.push(`${count} documente`);
    }
    if (typeCount.TASK_ASSIGNED || typeCount.TASK_DUE_TODAY || typeCount.TASK_OVERDUE) {
      const count =
        (typeCount.TASK_ASSIGNED || 0) +
        (typeCount.TASK_DUE_TODAY || 0) +
        (typeCount.TASK_OVERDUE || 0);
      parts.push(`${count} sarcini`);
    }

    return {
      title: 'Activitate nouă',
      body: parts.length > 0 ? parts.join(', ') : `${events.length} notificări noi`,
      icon: 'notification',
      action: { type: 'open_inbox' },
    };
  }

  // ============================================================================
  // User Online Status
  // ============================================================================

  /**
   * Mark user as online (called on API requests)
   */
  async markUserOnline(userId: string): Promise<void> {
    const key = `${ONLINE_USER_KEY_PREFIX}${userId}`;
    await redis.setex(key, ONLINE_TTL_SECONDS, '1');
  }

  /**
   * Check if user is currently online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const key = `${ONLINE_USER_KEY_PREFIX}${userId}`;
    const result = await redis.get(key);
    return result === '1';
  }

  // ============================================================================
  // Query Methods for UI
  // ============================================================================

  /**
   * Get in-app notifications for a user
   */
  async getInAppNotifications(
    userId: string,
    options?: { includeRead?: boolean; limit?: number }
  ): Promise<
    Array<{
      id: string;
      title: string;
      body: string;
      icon: string | null;
      read: boolean;
      action: NotificationAction | null;
      createdAt: Date;
    }>
  > {
    const notifications = await prisma.inAppNotification.findMany({
      where: {
        userId,
        ...(options?.includeRead ? {} : { read: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 20,
    });

    return notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      icon: n.icon,
      read: n.read,
      action: n.actionData as unknown as NotificationAction | null,
      createdAt: n.createdAt,
    }));
  }

  /**
   * Get notification count for a user
   */
  async getInAppNotificationCount(userId: string): Promise<number> {
    return prisma.inAppNotification.count({
      where: { userId, read: false },
    });
  }

  /**
   * Mark a notification as read
   */
  async markInAppNotificationRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.inAppNotification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return result.count > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllInAppNotificationsRead(userId: string): Promise<number> {
    const result = await prisma.inAppNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  }

  // ============================================================================
  // Push Subscription Management
  // ============================================================================

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(
    userId: string,
    subscription: { endpoint: string; p256dhKey: string; authKey: string; userAgent?: string }
  ): Promise<string> {
    const existing = await prisma.pushSubscription.findFirst({
      where: { userId, endpoint: subscription.endpoint },
    });

    if (existing) {
      // Reactivate if exists
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { active: true, updatedAt: new Date() },
      });
      return existing.id;
    }

    const result = await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.p256dhKey,
        authKey: subscription.authKey,
        userAgent: subscription.userAgent,
      },
    });

    return result.id;
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(subscriptionId: string, userId: string): Promise<boolean> {
    const result = await prisma.pushSubscription.updateMany({
      where: { id: subscriptionId, userId },
      data: { active: false },
    });
    return result.count > 0;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the next digest time (7:00 AM tomorrow if past today's digest)
   */
  private getNextDigestTime(): Date {
    const now = new Date();
    let digestTime = setMinutes(setHours(startOfDay(now), DIGEST_HOUR), DIGEST_MINUTE);

    // If it's past today's digest time, schedule for tomorrow
    if (now >= digestTime) {
      digestTime = addDays(digestTime, 1);
    }

    return digestTime;
  }

  /**
   * Clean up old notifications and digest queue entries
   */
  async cleanup(options?: { olderThanDays?: number }): Promise<{ deleted: number }> {
    const olderThan = addDays(new Date(), -(options?.olderThanDays ?? 30));

    const [notifications, digestItems] = await Promise.all([
      prisma.inAppNotification.deleteMany({
        where: { createdAt: { lt: olderThan }, read: true },
      }),
      prisma.digestQueue.deleteMany({
        where: { createdAt: { lt: olderThan }, sent: true },
      }),
    ]);

    return { deleted: notifications.count + digestItems.count };
  }
}

// Export singleton instance
export const activityNotificationService = new ActivityNotificationService();
