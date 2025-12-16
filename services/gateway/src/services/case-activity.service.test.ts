/**
 * Case Activity Service Unit Tests
 * Story 4.6: Task Collaboration and Updates - Task 35
 *
 * Tests for recording and retrieving case activity feed entries
 */

import { CaseActivityType } from '@prisma/client';
import { caseActivityService } from './case-activity.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findFirst: jest.fn(),
    },
    caseActivityEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('CaseActivityService', () => {
  const mockActor = {
    id: 'user-123',
    email: 'user@test.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'Lawyer',
    status: 'Active',
    firmId: 'firm-123',
    azureAdId: 'azure-123',
    preferences: {},
    createdAt: new Date(),
    lastActive: new Date(),
  };

  const mockCase = {
    id: 'case-123',
    firmId: 'firm-123',
    title: 'Test Case',
    caseNumber: 'CASE-001',
  };

  const mockActivityEntry = {
    id: 'activity-123',
    caseId: 'case-123',
    actorId: 'user-123',
    activityType: CaseActivityType.TaskCreated,
    entityType: 'Task',
    entityId: 'task-123',
    title: 'New task created',
    summary: 'Task Title',
    metadata: null,
    createdAt: new Date(),
    actor: mockActor,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Record Activity Tests
  // ============================================================================

  describe('recordActivity', () => {
    it('should create an activity entry successfully', async () => {
      prisma.caseActivityEntry.create.mockResolvedValue(mockActivityEntry);

      const result = await caseActivityService.recordActivity(
        'case-123',
        'user-123',
        'TaskCreated',
        'Task',
        'task-123',
        'New task created',
        'Task Title'
      );

      expect(result.id).toBe('activity-123');
      expect(result.activityType).toBe('TaskCreated');
      expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith({
        data: {
          caseId: 'case-123',
          actorId: 'user-123',
          activityType: CaseActivityType.TaskCreated,
          entityType: 'Task',
          entityId: 'task-123',
          title: 'New task created',
          summary: 'Task Title',
          metadata: undefined,
        },
        include: { actor: true },
      });
    });

    it('should include metadata when provided', async () => {
      const entryWithMetadata = {
        ...mockActivityEntry,
        metadata: { taskType: 'Deadline' },
      };
      prisma.caseActivityEntry.create.mockResolvedValue(entryWithMetadata);

      const result = await caseActivityService.recordActivity(
        'case-123',
        'user-123',
        'TaskCreated',
        'Task',
        'task-123',
        'New task created',
        'Task Title',
        { taskType: 'Deadline' }
      );

      expect(result.metadata).toEqual({ taskType: 'Deadline' });
    });
  });

  // ============================================================================
  // Get Activity Feed Tests
  // ============================================================================

  describe('getActivityFeed', () => {
    it('should retrieve activity feed for a case', async () => {
      prisma.case.findFirst.mockResolvedValue(mockCase);
      prisma.caseActivityEntry.findMany.mockResolvedValue([mockActivityEntry]);

      const result = await caseActivityService.getActivityFeed('case-123', 'firm-123');

      expect(result.entries).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(prisma.caseActivityEntry.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123' },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 21, // 20 + 1 for pagination check
      });
    });

    it('should throw error if case not found', async () => {
      prisma.case.findFirst.mockResolvedValue(null);

      await expect(caseActivityService.getActivityFeed('case-123', 'firm-123')).rejects.toThrow(
        'Case not found or access denied'
      );
    });

    it('should indicate hasMore when more entries exist', async () => {
      prisma.case.findFirst.mockResolvedValue(mockCase);
      // Return 21 entries (limit + 1)
      const entries = Array(21)
        .fill(mockActivityEntry)
        .map((e, i) => ({ ...e, id: `activity-${i}` }));
      prisma.caseActivityEntry.findMany.mockResolvedValue(entries);

      const result = await caseActivityService.getActivityFeed('case-123', 'firm-123');

      expect(result.entries).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('activity-19');
    });

    it('should filter by activity types', async () => {
      prisma.case.findFirst.mockResolvedValue(mockCase);
      prisma.caseActivityEntry.findMany.mockResolvedValue([]);

      await caseActivityService.getActivityFeed('case-123', 'firm-123', {
        activityTypes: ['TaskCreated', 'TaskCompleted'],
      });

      expect(prisma.caseActivityEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            caseId: 'case-123',
            activityType: {
              in: [CaseActivityType.TaskCreated, CaseActivityType.TaskCompleted],
            },
          },
        })
      );
    });

    it('should filter by date range', async () => {
      const since = new Date('2024-01-01');
      const until = new Date('2024-12-31');
      prisma.case.findFirst.mockResolvedValue(mockCase);
      prisma.caseActivityEntry.findMany.mockResolvedValue([]);

      await caseActivityService.getActivityFeed('case-123', 'firm-123', { since, until });

      expect(prisma.caseActivityEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            caseId: 'case-123',
            createdAt: { gte: since, lte: until },
          },
        })
      );
    });

    it('should support cursor-based pagination', async () => {
      prisma.case.findFirst.mockResolvedValue(mockCase);
      prisma.caseActivityEntry.findMany.mockResolvedValue([mockActivityEntry]);

      await caseActivityService.getActivityFeed('case-123', 'firm-123', {
        cursor: 'previous-cursor',
      });

      expect(prisma.caseActivityEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            caseId: 'case-123',
            id: { lt: 'previous-cursor' },
          },
        })
      );
    });

    it('should respect custom limit', async () => {
      prisma.case.findFirst.mockResolvedValue(mockCase);
      prisma.caseActivityEntry.findMany.mockResolvedValue([]);

      await caseActivityService.getActivityFeed('case-123', 'firm-123', { limit: 10 });

      expect(prisma.caseActivityEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 11 }) // 10 + 1 for pagination
      );
    });
  });

  // ============================================================================
  // Get Recent Activity Tests
  // ============================================================================

  describe('getRecentActivity', () => {
    it('should return recent activity entries', async () => {
      prisma.case.findFirst.mockResolvedValue(mockCase);
      prisma.caseActivityEntry.findMany.mockResolvedValue([mockActivityEntry]);

      const result = await caseActivityService.getRecentActivity('case-123', 'firm-123', 5);

      expect(result).toHaveLength(1);
    });

    it('should default to 10 entries', async () => {
      prisma.case.findFirst.mockResolvedValue(mockCase);
      prisma.caseActivityEntry.findMany.mockResolvedValue([]);

      await caseActivityService.getRecentActivity('case-123', 'firm-123');

      expect(prisma.caseActivityEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 11 }) // 10 + 1
      );
    });
  });

  // ============================================================================
  // Get Activity For Cases Tests
  // ============================================================================

  describe('getActivityForCases', () => {
    it('should retrieve activity for multiple cases grouped by caseId', async () => {
      const entries = [
        { ...mockActivityEntry, caseId: 'case-1', id: 'activity-1' },
        { ...mockActivityEntry, caseId: 'case-1', id: 'activity-2' },
        { ...mockActivityEntry, caseId: 'case-2', id: 'activity-3' },
      ];
      prisma.caseActivityEntry.findMany.mockResolvedValue(entries);

      const since = new Date('2024-01-01');
      const until = new Date('2024-12-31');
      const result = await caseActivityService.getActivityForCases(
        ['case-1', 'case-2'],
        since,
        until
      );

      expect(result.size).toBe(2);
      expect(result.get('case-1')).toHaveLength(2);
      expect(result.get('case-2')).toHaveLength(1);
      expect(prisma.caseActivityEntry.findMany).toHaveBeenCalledWith({
        where: {
          caseId: { in: ['case-1', 'case-2'] },
          createdAt: { gte: since, lte: until },
        },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty map when no entries found', async () => {
      prisma.caseActivityEntry.findMany.mockResolvedValue([]);

      const result = await caseActivityService.getActivityForCases(
        ['case-1'],
        new Date(),
        new Date()
      );

      expect(result.size).toBe(0);
    });
  });

  // ============================================================================
  // Convenience Methods Tests
  // ============================================================================

  describe('convenience methods', () => {
    describe('recordTaskCreated', () => {
      it('should record task creation activity', async () => {
        prisma.caseActivityEntry.create.mockResolvedValue(mockActivityEntry);

        await caseActivityService.recordTaskCreated(
          'case-123',
          'user-123',
          'task-123',
          'Task Title',
          'Deadline'
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.TaskCreated,
              entityType: 'Task',
              entityId: 'task-123',
              title: 'New Deadline task created',
              summary: 'Task Title',
              metadata: { taskType: 'Deadline' },
            }),
          })
        );
      });
    });

    describe('recordTaskStatusChanged', () => {
      it('should record task status change activity', async () => {
        prisma.caseActivityEntry.create.mockResolvedValue({
          ...mockActivityEntry,
          activityType: CaseActivityType.TaskStatusChanged,
        });

        await caseActivityService.recordTaskStatusChanged(
          'case-123',
          'user-123',
          'task-123',
          'Task Title',
          'Pending',
          'InProgress'
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.TaskStatusChanged,
              title: 'Task status changed to InProgress',
              metadata: { oldStatus: 'Pending', newStatus: 'InProgress' },
            }),
          })
        );
      });
    });

    describe('recordTaskCompleted', () => {
      it('should record task completion activity', async () => {
        prisma.caseActivityEntry.create.mockResolvedValue({
          ...mockActivityEntry,
          activityType: CaseActivityType.TaskCompleted,
        });

        await caseActivityService.recordTaskCompleted(
          'case-123',
          'user-123',
          'task-123',
          'Task Title'
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.TaskCompleted,
              title: 'Task completed',
            }),
          })
        );
      });
    });

    describe('recordTaskAssigned', () => {
      it('should record task assignment activity', async () => {
        prisma.caseActivityEntry.create.mockResolvedValue({
          ...mockActivityEntry,
          activityType: CaseActivityType.TaskAssigned,
        });

        await caseActivityService.recordTaskAssigned(
          'case-123',
          'user-123',
          'task-123',
          'Task Title',
          'John Doe'
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.TaskAssigned,
              title: 'Task assigned to John Doe',
              metadata: { assigneeName: 'John Doe' },
            }),
          })
        );
      });
    });

    describe('recordDocumentUploaded', () => {
      it('should record document upload activity', async () => {
        prisma.caseActivityEntry.create.mockResolvedValue({
          ...mockActivityEntry,
          activityType: CaseActivityType.DocumentUploaded,
        });

        await caseActivityService.recordDocumentUploaded(
          'case-123',
          'user-123',
          'doc-123',
          'contract.pdf',
          'application/pdf'
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.DocumentUploaded,
              entityType: 'Document',
              entityId: 'doc-123',
              title: 'Document uploaded',
              summary: 'contract.pdf',
              metadata: { fileType: 'application/pdf' },
            }),
          })
        );
      });
    });

    describe('recordDocumentVersioned', () => {
      it('should record document version activity', async () => {
        prisma.caseActivityEntry.create.mockResolvedValue({
          ...mockActivityEntry,
          activityType: CaseActivityType.DocumentVersioned,
        });

        await caseActivityService.recordDocumentVersioned(
          'case-123',
          'user-123',
          'doc-123',
          'contract.pdf',
          2
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.DocumentVersioned,
              title: 'Document updated to version 2',
              metadata: { version: 2 },
            }),
          })
        );
      });
    });

    describe('recordDeadlineApproaching', () => {
      it('should record deadline approaching activity', async () => {
        const dueDate = new Date('2024-06-15');
        prisma.caseActivityEntry.create.mockResolvedValue({
          ...mockActivityEntry,
          activityType: CaseActivityType.DeadlineApproaching,
        });

        await caseActivityService.recordDeadlineApproaching(
          'case-123',
          'user-123',
          'task-123',
          'Submit Brief',
          dueDate
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.DeadlineApproaching,
              title: 'Deadline approaching',
              metadata: { dueDate: dueDate.toISOString() },
            }),
          })
        );
      });
    });

    describe('recordMilestoneReached', () => {
      it('should record milestone reached activity', async () => {
        prisma.caseActivityEntry.create.mockResolvedValue({
          ...mockActivityEntry,
          activityType: CaseActivityType.MilestoneReached,
        });

        await caseActivityService.recordMilestoneReached(
          'case-123',
          'user-123',
          'Task',
          'task-123',
          'Discovery Complete',
          'All discovery tasks finished'
        );

        expect(prisma.caseActivityEntry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              activityType: CaseActivityType.MilestoneReached,
              title: 'Milestone reached: Discovery Complete',
              summary: 'All discovery tasks finished',
            }),
          })
        );
      });
    });
  });
});
