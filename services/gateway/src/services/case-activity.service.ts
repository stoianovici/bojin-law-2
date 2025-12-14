// @ts-nocheck
/**
 * Case Activity Service
 * Story 4.6: Task Collaboration and Updates (AC: 2)
 *
 * Manages the case activity feed - a chronological stream of all activity on a case
 */

import { prisma } from '@legal-platform/database';
import { CaseActivityType } from '@prisma/client';

// Local types for case activity service
type CaseActivityTypeEnum =
  | 'TaskCreated'
  | 'TaskStatusChanged'
  | 'TaskCompleted'
  | 'TaskAssigned'
  | 'TaskCommented'
  | 'DocumentUploaded'
  | 'DocumentVersioned'
  | 'CommunicationReceived'
  | 'CommunicationSent'
  | 'DeadlineApproaching'
  | 'MilestoneReached';

type EntityType = 'Task' | 'Document' | 'Communication';

interface CaseActivityEntry {
  id: string;
  caseId: string;
  actorId: string;
  activityType: CaseActivityTypeEnum;
  entityType: EntityType;
  entityId: string;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  actor?: any;
}

interface CaseActivityFeedResponse {
  entries: CaseActivityEntry[];
  hasMore: boolean;
  nextCursor?: string;
}

interface FeedOptions {
  limit?: number;
  cursor?: string;
  activityTypes?: CaseActivityTypeEnum[];
  since?: Date;
  until?: Date;
}

export class CaseActivityService {
  /**
   * Record an activity entry for a case
   * @param caseId - ID of the case
   * @param actorId - ID of the user who performed the action
   * @param activityType - Type of activity
   * @param entityType - Type of entity (Task, Document, Communication)
   * @param entityId - ID of the related entity
   * @param title - Activity title
   * @param summary - Optional summary text
   * @param metadata - Optional additional data
   */
  async recordActivity(
    caseId: string,
    actorId: string,
    activityType: CaseActivityTypeEnum,
    entityType: EntityType,
    entityId: string,
    title: string,
    summary?: string,
    metadata?: Record<string, unknown>
  ): Promise<CaseActivityEntry> {
    // Convert string to enum
    const activityTypeEnum = CaseActivityType[activityType as keyof typeof CaseActivityType];

    const entry = await prisma.caseActivityEntry.create({
      data: {
        caseId,
        actorId,
        activityType: activityTypeEnum,
        entityType,
        entityId,
        title,
        summary,
        metadata: metadata || undefined,
      },
      include: {
        actor: true,
      },
    });

    return this.mapToCaseActivityEntry(entry);
  }

  /**
   * Get the activity feed for a case with pagination
   * @param caseId - ID of the case
   * @param firmId - Firm ID for access control
   * @param options - Feed options (limit, cursor, filters)
   */
  async getActivityFeed(
    caseId: string,
    firmId: string,
    options?: FeedOptions
  ): Promise<CaseActivityFeedResponse> {
    // Verify case belongs to firm
    const caseRecord = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
      },
    });

    if (!caseRecord) {
      throw new Error('Case not found or access denied');
    }

    const limit = options?.limit || 20;

    const where: any = { caseId };

    // Filter by activity types
    if (options?.activityTypes && options.activityTypes.length > 0) {
      where.activityType = {
        in: options.activityTypes.map(
          (t) => CaseActivityType[t as keyof typeof CaseActivityType]
        ),
      };
    }

    // Filter by date range
    if (options?.since) {
      where.createdAt = {
        ...where.createdAt,
        gte: options.since,
      };
    }

    if (options?.until) {
      where.createdAt = {
        ...where.createdAt,
        lte: options.until,
      };
    }

    // Cursor-based pagination
    if (options?.cursor) {
      where.id = { lt: options.cursor };
    }

    const entries = await prisma.caseActivityEntry.findMany({
      where,
      include: {
        actor: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1, // Fetch one extra to determine if there's more
    });

    const hasMore = entries.length > limit;
    const resultEntries = hasMore ? entries.slice(0, -1) : entries;
    const nextCursor = hasMore ? resultEntries[resultEntries.length - 1]?.id : undefined;

    return {
      entries: resultEntries.map((e) => this.mapToCaseActivityEntry(e)),
      hasMore,
      nextCursor,
    };
  }

  /**
   * Get recent activity for a case
   * @param caseId - ID of the case
   * @param firmId - Firm ID for access control
   * @param limit - Maximum number of entries
   */
  async getRecentActivity(
    caseId: string,
    firmId: string,
    limit: number = 10
  ): Promise<CaseActivityEntry[]> {
    const response = await this.getActivityFeed(caseId, firmId, { limit });
    return response.entries;
  }

  /**
   * Get activity entries for multiple cases (for digest)
   * @param caseIds - IDs of cases to get activity for
   * @param since - Start date for activity
   * @param until - End date for activity
   */
  async getActivityForCases(
    caseIds: string[],
    since: Date,
    until: Date
  ): Promise<Map<string, CaseActivityEntry[]>> {
    const entries = await prisma.caseActivityEntry.findMany({
      where: {
        caseId: { in: caseIds },
        createdAt: {
          gte: since,
          lte: until,
        },
      },
      include: {
        actor: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by case ID
    const activityByCase = new Map<string, CaseActivityEntry[]>();
    for (const entry of entries) {
      const caseActivity = activityByCase.get(entry.caseId) || [];
      caseActivity.push(this.mapToCaseActivityEntry(entry));
      activityByCase.set(entry.caseId, caseActivity);
    }

    return activityByCase;
  }

  // ============================================================================
  // Convenience methods for specific activity types
  // ============================================================================

  /**
   * Record task created activity
   */
  async recordTaskCreated(
    caseId: string,
    actorId: string,
    taskId: string,
    taskTitle: string,
    taskType: string
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'TaskCreated',
      'Task',
      taskId,
      `New ${taskType} task created`,
      taskTitle,
      { taskType }
    );
  }

  /**
   * Record task status change activity
   */
  async recordTaskStatusChanged(
    caseId: string,
    actorId: string,
    taskId: string,
    taskTitle: string,
    oldStatus: string,
    newStatus: string
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'TaskStatusChanged',
      'Task',
      taskId,
      `Task status changed to ${newStatus}`,
      taskTitle,
      { oldStatus, newStatus }
    );
  }

  /**
   * Record task completed activity
   */
  async recordTaskCompleted(
    caseId: string,
    actorId: string,
    taskId: string,
    taskTitle: string
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'TaskCompleted',
      'Task',
      taskId,
      'Task completed',
      taskTitle
    );
  }

  /**
   * Record task assigned activity
   */
  async recordTaskAssigned(
    caseId: string,
    actorId: string,
    taskId: string,
    taskTitle: string,
    assigneeName: string
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'TaskAssigned',
      'Task',
      taskId,
      `Task assigned to ${assigneeName}`,
      taskTitle,
      { assigneeName }
    );
  }

  /**
   * Record document uploaded activity
   */
  async recordDocumentUploaded(
    caseId: string,
    actorId: string,
    documentId: string,
    fileName: string,
    fileType: string
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'DocumentUploaded',
      'Document',
      documentId,
      'Document uploaded',
      fileName,
      { fileType }
    );
  }

  /**
   * Record document versioned activity
   */
  async recordDocumentVersioned(
    caseId: string,
    actorId: string,
    documentId: string,
    fileName: string,
    version: number
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'DocumentVersioned',
      'Document',
      documentId,
      `Document updated to version ${version}`,
      fileName,
      { version }
    );
  }

  /**
   * Record deadline approaching activity
   */
  async recordDeadlineApproaching(
    caseId: string,
    actorId: string,
    taskId: string,
    taskTitle: string,
    dueDate: Date
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'DeadlineApproaching',
      'Task',
      taskId,
      'Deadline approaching',
      `${taskTitle} due ${dueDate.toLocaleDateString()}`,
      { dueDate: dueDate.toISOString() }
    );
  }

  /**
   * Record milestone reached activity
   */
  async recordMilestoneReached(
    caseId: string,
    actorId: string,
    entityType: EntityType,
    entityId: string,
    milestoneName: string,
    description?: string
  ): Promise<CaseActivityEntry> {
    return this.recordActivity(
      caseId,
      actorId,
      'MilestoneReached',
      entityType,
      entityId,
      `Milestone reached: ${milestoneName}`,
      description
    );
  }

  /**
   * Map Prisma result to CaseActivityEntry type
   */
  private mapToCaseActivityEntry(entry: any): CaseActivityEntry {
    return {
      id: entry.id,
      caseId: entry.caseId,
      actorId: entry.actorId,
      activityType: entry.activityType as CaseActivityTypeEnum,
      entityType: entry.entityType as EntityType,
      entityId: entry.entityId,
      title: entry.title,
      summary: entry.summary || undefined,
      metadata: entry.metadata || undefined,
      createdAt: entry.createdAt,
      actor: entry.actor
        ? {
            id: entry.actor.id,
            email: entry.actor.email,
            firstName: entry.actor.firstName,
            lastName: entry.actor.lastName,
            role: entry.actor.role,
            status: entry.actor.status,
            firmId: entry.actor.firmId,
            azureAdId: entry.actor.azureAdId,
            preferences: entry.actor.preferences || {},
            createdAt: entry.actor.createdAt,
            lastActive: entry.actor.lastActive,
          }
        : undefined,
    };
  }
}

// Export singleton instance
export const caseActivityService = new CaseActivityService();
