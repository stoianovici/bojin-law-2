/**
 * Activity Event Service
 * OPS-116: Event Emission Infrastructure
 *
 * Centralized service for emitting and querying user activity events.
 * Powers the AI context system and notification engine.
 */

import { prisma } from '@legal-platform/database';
import {
  UserActivityEvent,
  ActivityEventType,
  ActivityEntityType,
  EventImportance,
  Prisma,
} from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface EmitEventInput {
  userId: string;
  firmId: string;
  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string;
  entityTitle?: string;
  metadata?: Record<string, unknown>;
  importance?: EventImportance;
  occurredAt?: Date;
}

export interface QueryEventsOptions {
  userId: string;
  eventTypes?: ActivityEventType[];
  entityTypes?: ActivityEntityType[];
  minImportance?: EventImportance;
  notified?: boolean;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface EmitBatchResult {
  created: number;
  skipped: number;
}

// ============================================================================
// Constants
// ============================================================================

const IMPORTANCE_ORDER: EventImportance[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

// Court-related email patterns
const COURT_EMAIL_PATTERNS = [
  /@just\.ro$/i,
  /@scj\.ro$/i,
  /@portal\.just\.ro$/i,
  /instanta/i,
  /tribunal/i,
  /judecatorie/i,
  /curte.*apel/i,
];

// ============================================================================
// Service
// ============================================================================

export class ActivityEventService {
  /**
   * Emit a single activity event
   */
  async emit(input: EmitEventInput): Promise<UserActivityEvent> {
    const importance = input.importance ?? this.calculateImportance(input);

    return prisma.userActivityEvent.create({
      data: {
        userId: input.userId,
        firmId: input.firmId,
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        entityTitle: input.entityTitle,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
        importance,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  /**
   * Emit events for multiple users (e.g., shared document, case team notification)
   */
  async emitForUsers(
    userIds: string[],
    event: Omit<EmitEventInput, 'userId'>
  ): Promise<EmitBatchResult> {
    if (userIds.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const importance = event.importance ?? this.calculateImportance(event);
    const occurredAt = event.occurredAt ?? new Date();

    const result = await prisma.userActivityEvent.createMany({
      data: userIds.map((userId) => ({
        userId,
        firmId: event.firmId,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        entityTitle: event.entityTitle,
        metadata: (event.metadata as Prisma.InputJsonValue) ?? undefined,
        importance,
        occurredAt,
      })),
      skipDuplicates: true,
    });

    return {
      created: result.count,
      skipped: userIds.length - result.count,
    };
  }

  /**
   * Emit multiple events in a batch (e.g., after email sync)
   */
  async emitBatch(events: EmitEventInput[]): Promise<EmitBatchResult> {
    if (events.length === 0) {
      return { created: 0, skipped: 0 };
    }

    const result = await prisma.userActivityEvent.createMany({
      data: events.map((event) => ({
        userId: event.userId,
        firmId: event.firmId,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        entityTitle: event.entityTitle,
        metadata: (event.metadata as Prisma.InputJsonValue) ?? undefined,
        importance: event.importance ?? this.calculateImportance(event),
        occurredAt: event.occurredAt ?? new Date(),
      })),
      skipDuplicates: true,
    });

    return {
      created: result.count,
      skipped: events.length - result.count,
    };
  }

  /**
   * Query events with filtering options
   */
  async query(options: QueryEventsOptions): Promise<UserActivityEvent[]> {
    const where: Record<string, unknown> = {
      userId: options.userId,
    };

    if (options.eventTypes?.length) {
      where.eventType = { in: options.eventTypes };
    }

    if (options.entityTypes?.length) {
      where.entityType = { in: options.entityTypes };
    }

    if (options.minImportance) {
      where.importance = { in: this.importanceAtOrAbove(options.minImportance) };
    }

    if (options.notified !== undefined) {
      where.notified = options.notified;
    }

    if (options.since) {
      where.occurredAt = { ...((where.occurredAt as object) || {}), gte: options.since };
    }

    if (options.until) {
      where.occurredAt = { ...((where.occurredAt as object) || {}), lte: options.until };
    }

    return prisma.userActivityEvent.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { occurredAt: 'desc' }],
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
  }

  /**
   * Get unnotified events for a user, prioritized by importance
   */
  async getUnnotified(
    userId: string,
    options?: {
      minImportance?: EventImportance;
      limit?: number;
    }
  ): Promise<UserActivityEvent[]> {
    return this.query({
      userId,
      notified: false,
      minImportance: options?.minImportance,
      limit: options?.limit ?? 50,
    });
  }

  /**
   * Get events since a specific date (for "what's new" queries)
   */
  async getEventsSince(
    userId: string,
    since: Date,
    options?: {
      eventTypes?: ActivityEventType[];
      limit?: number;
    }
  ): Promise<UserActivityEvent[]> {
    return this.query({
      userId,
      since,
      eventTypes: options?.eventTypes,
      limit: options?.limit ?? 100,
    });
  }

  /**
   * Mark events as notified
   */
  async markNotified(eventIds: string[]): Promise<number> {
    if (eventIds.length === 0) return 0;

    const result = await prisma.userActivityEvent.updateMany({
      where: { id: { in: eventIds } },
      data: { notified: true },
    });

    return result.count;
  }

  /**
   * Mark events as seen for a user
   */
  async markSeen(userId: string, beforeDate: Date): Promise<number> {
    const result = await prisma.userActivityEvent.updateMany({
      where: {
        userId,
        occurredAt: { lte: beforeDate },
        seenAt: null,
      },
      data: { seenAt: new Date() },
    });

    return result.count;
  }

  /**
   * Count unnotified events by importance
   */
  async countUnnotified(userId: string): Promise<Record<EventImportance, number>> {
    const counts = await prisma.userActivityEvent.groupBy({
      by: ['importance'],
      where: {
        userId,
        notified: false,
      },
      _count: true,
    });

    // Initialize all importance levels to 0
    const result: Record<EventImportance, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      URGENT: 0,
    };

    // Fill in actual counts
    for (const count of counts) {
      result[count.importance] = count._count;
    }

    return result;
  }

  /**
   * Delete old events (for cleanup jobs)
   */
  async deleteOlderThan(date: Date, options?: { notifiedOnly?: boolean }): Promise<number> {
    const result = await prisma.userActivityEvent.deleteMany({
      where: {
        occurredAt: { lt: date },
        ...(options?.notifiedOnly ? { notified: true } : {}),
      },
    });

    return result.count;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Calculate importance based on event type and metadata
   */
  private calculateImportance(event: Partial<EmitEventInput>): EventImportance {
    // Court emails are always urgent
    if (event.eventType === 'EMAIL_FROM_COURT') {
      return 'URGENT';
    }

    // Hearings today are urgent
    if (event.eventType === 'CASE_HEARING_TODAY') {
      return 'URGENT';
    }

    // Overdue tasks are high importance
    if (event.eventType === 'TASK_OVERDUE') {
      return 'HIGH';
    }

    // Today's deadlines are high
    if (event.eventType === 'TASK_DUE_TODAY' || event.eventType === 'CASE_DEADLINE_APPROACHING') {
      return 'HIGH';
    }

    // Calendar events today
    if (event.eventType === 'CALENDAR_EVENT_TODAY') {
      return 'HIGH';
    }

    // Task assignments
    if (event.eventType === 'TASK_ASSIGNED') {
      return 'NORMAL';
    }

    // Default to NORMAL
    return 'NORMAL';
  }

  /**
   * Get all importance levels at or above a given level
   */
  private importanceAtOrAbove(minImportance: EventImportance): EventImportance[] {
    const minIndex = IMPORTANCE_ORDER.indexOf(minImportance);
    return IMPORTANCE_ORDER.slice(minIndex);
  }

  /**
   * Check if an email is from a court based on sender patterns
   */
  isCourtEmail(fromAddress: string): boolean {
    return COURT_EMAIL_PATTERNS.some((pattern) => pattern.test(fromAddress));
  }
}

// Export singleton instance
export const activityEventService = new ActivityEventService();
