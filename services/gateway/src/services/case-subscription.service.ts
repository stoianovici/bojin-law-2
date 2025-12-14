// @ts-nocheck
/**
 * Case Subscription Service
 * Story 4.6: Task Collaboration and Updates (AC: 6)
 *
 * Manages user subscriptions to cases for daily digest notifications
 */

import { prisma } from '@legal-platform/database';
import { caseActivityService } from './case-activity.service';

// Local types for case subscription service
interface CaseSubscription {
  id: string;
  caseId: string;
  userId: string;
  digestEnabled: boolean;
  notifyOnTask: boolean;
  notifyOnDocument: boolean;
  notifyOnComment: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateSubscriptionInput {
  digestEnabled?: boolean;
  notifyOnTask?: boolean;
  notifyOnDocument?: boolean;
  notifyOnComment?: boolean;
}

interface SubscriptionOptions {
  digestEnabled?: boolean;
  notifyOnTask?: boolean;
  notifyOnDocument?: boolean;
  notifyOnComment?: boolean;
}

interface DailyDigest {
  userId: string;
  date: Date;
  cases: DigestCaseSummary[];
}

interface DigestCaseSummary {
  caseId: string;
  caseTitle: string;
  caseNumber: string;
  taskUpdates: DigestTaskUpdate[];
  newComments: number;
  newAttachments: number;
}

interface DigestTaskUpdate {
  taskId: string;
  taskTitle: string;
  updateType: 'created' | 'completed' | 'statusChanged' | 'assigned' | 'commented';
  summary: string;
  actor: string;
  timestamp: Date;
}

export class CaseSubscriptionService {
  /**
   * Subscribe a user to a case
   * @param caseId - ID of the case
   * @param userId - ID of the user
   * @param options - Subscription options
   */
  async subscribe(
    caseId: string,
    userId: string,
    options?: SubscriptionOptions
  ): Promise<CaseSubscription> {
    // Verify case exists
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord) {
      throw new Error('Case not found');
    }

    // Upsert subscription
    const subscription = await prisma.caseSubscription.upsert({
      where: {
        caseId_userId: {
          caseId,
          userId,
        },
      },
      create: {
        caseId,
        userId,
        digestEnabled: options?.digestEnabled ?? true,
        notifyOnTask: options?.notifyOnTask ?? true,
        notifyOnDocument: options?.notifyOnDocument ?? true,
        notifyOnComment: options?.notifyOnComment ?? true,
      },
      update: {
        digestEnabled: options?.digestEnabled,
        notifyOnTask: options?.notifyOnTask,
        notifyOnDocument: options?.notifyOnDocument,
        notifyOnComment: options?.notifyOnComment,
      },
    });

    return this.mapToCaseSubscription(subscription);
  }

  /**
   * Unsubscribe a user from a case
   * @param caseId - ID of the case
   * @param userId - ID of the user
   */
  async unsubscribe(caseId: string, userId: string): Promise<void> {
    await prisma.caseSubscription.deleteMany({
      where: {
        caseId,
        userId,
      },
    });
  }

  /**
   * Update subscription preferences
   * @param caseId - ID of the case
   * @param userId - ID of the user
   * @param input - Updated preferences
   */
  async updateSubscription(
    caseId: string,
    userId: string,
    input: UpdateSubscriptionInput
  ): Promise<CaseSubscription> {
    const subscription = await prisma.caseSubscription.update({
      where: {
        caseId_userId: {
          caseId,
          userId,
        },
      },
      data: {
        digestEnabled: input.digestEnabled,
        notifyOnTask: input.notifyOnTask,
        notifyOnDocument: input.notifyOnDocument,
        notifyOnComment: input.notifyOnComment,
      },
    });

    return this.mapToCaseSubscription(subscription);
  }

  /**
   * Get subscription status for a user on a case
   * @param caseId - ID of the case
   * @param userId - ID of the user
   */
  async getSubscription(caseId: string, userId: string): Promise<CaseSubscription | null> {
    const subscription = await prisma.caseSubscription.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId,
        },
      },
    });

    if (!subscription) {
      return null;
    }

    return this.mapToCaseSubscription(subscription);
  }

  /**
   * Get all subscriptions for a user
   * @param userId - ID of the user
   */
  async getUserSubscriptions(userId: string): Promise<CaseSubscription[]> {
    const subscriptions = await prisma.caseSubscription.findMany({
      where: {
        userId,
        digestEnabled: true,
      },
      include: {
        case: true,
      },
    });

    return subscriptions.map((s) => this.mapToCaseSubscription(s));
  }

  /**
   * Get all subscribers to a case
   * @param caseId - ID of the case
   */
  async getCaseSubscribers(caseId: string): Promise<string[]> {
    const subscriptions = await prisma.caseSubscription.findMany({
      where: {
        caseId,
      },
      select: {
        userId: true,
      },
    });

    return subscriptions.map((s) => s.userId);
  }

  /**
   * Get subscribers who should be notified for a specific event type
   * @param caseId - ID of the case
   * @param eventType - Type of event ('task', 'document', 'comment')
   */
  async getNotifiableSubscribers(
    caseId: string,
    eventType: 'task' | 'document' | 'comment'
  ): Promise<string[]> {
    const field =
      eventType === 'task'
        ? 'notifyOnTask'
        : eventType === 'document'
          ? 'notifyOnDocument'
          : 'notifyOnComment';

    const subscriptions = await prisma.caseSubscription.findMany({
      where: {
        caseId,
        [field]: true,
      },
      select: {
        userId: true,
      },
    });

    return subscriptions.map((s) => s.userId);
  }

  /**
   * Auto-subscribe team members to a case
   * Called when case team is updated
   * @param caseId - ID of the case
   * @param userIds - IDs of users to subscribe
   */
  async autoSubscribeTeamMembers(caseId: string, userIds: string[]): Promise<void> {
    // Create subscriptions for users who don't have one
    const existingSubscriptions = await prisma.caseSubscription.findMany({
      where: {
        caseId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const existingUserIds = new Set(existingSubscriptions.map((s) => s.userId));
    const newUserIds = userIds.filter((id) => !existingUserIds.has(id));

    if (newUserIds.length > 0) {
      await prisma.caseSubscription.createMany({
        data: newUserIds.map((userId) => ({
          caseId,
          userId,
          digestEnabled: true,
          notifyOnTask: true,
          notifyOnDocument: true,
          notifyOnComment: true,
        })),
      });
    }
  }

  /**
   * Generate daily digest for a user
   * @param userId - ID of the user
   * @param date - Date for the digest (defaults to yesterday)
   */
  async generateDailyDigest(userId: string, date?: Date): Promise<DailyDigest> {
    // Default to yesterday
    const digestDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const startOfDay = new Date(digestDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(digestDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get user's subscriptions
    const subscriptions = await prisma.caseSubscription.findMany({
      where: {
        userId,
        digestEnabled: true,
      },
      include: {
        case: true,
      },
    });

    if (subscriptions.length === 0) {
      return {
        userId,
        date: digestDate,
        cases: [],
      };
    }

    const caseIds = subscriptions.map((s) => s.caseId);

    // Get activity for all subscribed cases
    const activityByCase = await caseActivityService.getActivityForCases(
      caseIds,
      startOfDay,
      endOfDay
    );

    // Build digest summaries
    const caseSummaries: DigestCaseSummary[] = [];

    for (const subscription of subscriptions) {
      const activities = activityByCase.get(subscription.caseId) || [];

      if (activities.length === 0) {
        continue;
      }

      // Group activities by type
      const taskUpdates: DigestTaskUpdate[] = [];
      let newComments = 0;
      let newAttachments = 0;

      for (const activity of activities) {
        switch (activity.activityType) {
          case 'TaskCreated':
            taskUpdates.push({
              taskId: activity.entityId,
              taskTitle: activity.summary || activity.title,
              updateType: 'created',
              summary: activity.title,
              actor: activity.actor
                ? `${activity.actor.firstName} ${activity.actor.lastName}`
                : 'Unknown',
              timestamp: activity.createdAt,
            });
            break;
          case 'TaskCompleted':
            taskUpdates.push({
              taskId: activity.entityId,
              taskTitle: activity.summary || activity.title,
              updateType: 'completed',
              summary: activity.title,
              actor: activity.actor
                ? `${activity.actor.firstName} ${activity.actor.lastName}`
                : 'Unknown',
              timestamp: activity.createdAt,
            });
            break;
          case 'TaskStatusChanged':
            taskUpdates.push({
              taskId: activity.entityId,
              taskTitle: activity.summary || activity.title,
              updateType: 'statusChanged',
              summary: activity.title,
              actor: activity.actor
                ? `${activity.actor.firstName} ${activity.actor.lastName}`
                : 'Unknown',
              timestamp: activity.createdAt,
            });
            break;
          case 'TaskAssigned':
            taskUpdates.push({
              taskId: activity.entityId,
              taskTitle: activity.summary || activity.title,
              updateType: 'assigned',
              summary: activity.title,
              actor: activity.actor
                ? `${activity.actor.firstName} ${activity.actor.lastName}`
                : 'Unknown',
              timestamp: activity.createdAt,
            });
            break;
          case 'TaskCommented':
            newComments++;
            taskUpdates.push({
              taskId: activity.entityId,
              taskTitle: activity.summary || activity.title,
              updateType: 'commented',
              summary: activity.title,
              actor: activity.actor
                ? `${activity.actor.firstName} ${activity.actor.lastName}`
                : 'Unknown',
              timestamp: activity.createdAt,
            });
            break;
          case 'DocumentUploaded':
          case 'DocumentVersioned':
            newAttachments++;
            break;
        }
      }

      if (taskUpdates.length > 0 || newComments > 0 || newAttachments > 0) {
        caseSummaries.push({
          caseId: subscription.caseId,
          caseTitle: subscription.case.title,
          caseNumber: subscription.case.caseNumber,
          taskUpdates,
          newComments,
          newAttachments,
        });
      }
    }

    return {
      userId,
      date: digestDate,
      cases: caseSummaries,
    };
  }

  /**
   * Get all users who need daily digest
   */
  async getUsersForDailyDigest(): Promise<string[]> {
    const subscriptions = await prisma.caseSubscription.findMany({
      where: {
        digestEnabled: true,
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    return subscriptions.map((s) => s.userId);
  }

  /**
   * Map Prisma result to CaseSubscription type
   */
  private mapToCaseSubscription(subscription: any): CaseSubscription {
    return {
      id: subscription.id,
      caseId: subscription.caseId,
      userId: subscription.userId,
      digestEnabled: subscription.digestEnabled,
      notifyOnTask: subscription.notifyOnTask,
      notifyOnDocument: subscription.notifyOnDocument,
      notifyOnComment: subscription.notifyOnComment,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}

// Export singleton instance
export const caseSubscriptionService = new CaseSubscriptionService();
