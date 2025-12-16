/**
 * Case Subscription Service Unit Tests
 * Story 4.6: Task Collaboration and Updates - Task 38
 *
 * Tests for subscription management and daily digest generation
 */

import { caseSubscriptionService } from './case-subscription.service';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
    },
    caseSubscription: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

jest.mock('./case-activity.service', () => ({
  caseActivityService: {
    getActivityForCases: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');
const { caseActivityService } = jest.requireMock('./case-activity.service');

describe('CaseSubscriptionService', () => {
  const mockCase = {
    id: 'case-123',
    firmId: 'firm-123',
    title: 'Test Case',
    caseNumber: 'CASE-001',
  };

  const mockSubscription = {
    id: 'sub-123',
    caseId: 'case-123',
    userId: 'user-123',
    digestEnabled: true,
    notifyOnTask: true,
    notifyOnDocument: true,
    notifyOnComment: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Subscribe Tests
  // ============================================================================

  describe('subscribe', () => {
    it('should create a subscription successfully', async () => {
      prisma.case.findUnique.mockResolvedValue(mockCase);
      prisma.caseSubscription.upsert.mockResolvedValue(mockSubscription);

      const result = await caseSubscriptionService.subscribe('case-123', 'user-123');

      expect(result.id).toBe('sub-123');
      expect(result.digestEnabled).toBe(true);
      expect(prisma.caseSubscription.upsert).toHaveBeenCalledWith({
        where: { caseId_userId: { caseId: 'case-123', userId: 'user-123' } },
        create: {
          caseId: 'case-123',
          userId: 'user-123',
          digestEnabled: true,
          notifyOnTask: true,
          notifyOnDocument: true,
          notifyOnComment: true,
        },
        update: {
          digestEnabled: undefined,
          notifyOnTask: undefined,
          notifyOnDocument: undefined,
          notifyOnComment: undefined,
        },
      });
    });

    it('should throw error if case not found', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      await expect(caseSubscriptionService.subscribe('nonexistent', 'user-123')).rejects.toThrow(
        'Case not found'
      );
    });

    it('should respect custom subscription options', async () => {
      prisma.case.findUnique.mockResolvedValue(mockCase);
      prisma.caseSubscription.upsert.mockResolvedValue({
        ...mockSubscription,
        digestEnabled: false,
        notifyOnComment: false,
      });

      await caseSubscriptionService.subscribe('case-123', 'user-123', {
        digestEnabled: false,
        notifyOnComment: false,
      });

      expect(prisma.caseSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            digestEnabled: false,
            notifyOnComment: false,
          }),
        })
      );
    });
  });

  // ============================================================================
  // Unsubscribe Tests
  // ============================================================================

  describe('unsubscribe', () => {
    it('should delete subscription successfully', async () => {
      prisma.caseSubscription.deleteMany.mockResolvedValue({ count: 1 });

      await caseSubscriptionService.unsubscribe('case-123', 'user-123');

      expect(prisma.caseSubscription.deleteMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123', userId: 'user-123' },
      });
    });
  });

  // ============================================================================
  // Update Subscription Tests
  // ============================================================================

  describe('updateSubscription', () => {
    it('should update subscription preferences', async () => {
      prisma.caseSubscription.update.mockResolvedValue({
        ...mockSubscription,
        digestEnabled: false,
      });

      const result = await caseSubscriptionService.updateSubscription('case-123', 'user-123', {
        digestEnabled: false,
      });

      expect(result.digestEnabled).toBe(false);
      expect(prisma.caseSubscription.update).toHaveBeenCalledWith({
        where: { caseId_userId: { caseId: 'case-123', userId: 'user-123' } },
        data: {
          digestEnabled: false,
          notifyOnTask: undefined,
          notifyOnDocument: undefined,
          notifyOnComment: undefined,
        },
      });
    });

    it('should update multiple preferences at once', async () => {
      prisma.caseSubscription.update.mockResolvedValue({
        ...mockSubscription,
        notifyOnTask: false,
        notifyOnDocument: false,
      });

      await caseSubscriptionService.updateSubscription('case-123', 'user-123', {
        notifyOnTask: false,
        notifyOnDocument: false,
      });

      expect(prisma.caseSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notifyOnTask: false,
            notifyOnDocument: false,
          }),
        })
      );
    });
  });

  // ============================================================================
  // Get Subscription Tests
  // ============================================================================

  describe('getSubscription', () => {
    it('should return subscription if exists', async () => {
      prisma.caseSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await caseSubscriptionService.getSubscription('case-123', 'user-123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('sub-123');
    });

    it('should return null if subscription does not exist', async () => {
      prisma.caseSubscription.findUnique.mockResolvedValue(null);

      const result = await caseSubscriptionService.getSubscription('case-123', 'user-123');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Get User Subscriptions Tests
  // ============================================================================

  describe('getUserSubscriptions', () => {
    it('should return all subscriptions for a user', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([
        { ...mockSubscription, case: mockCase },
        {
          ...mockSubscription,
          id: 'sub-456',
          caseId: 'case-456',
          case: { ...mockCase, id: 'case-456' },
        },
      ]);

      const result = await caseSubscriptionService.getUserSubscriptions('user-123');

      expect(result).toHaveLength(2);
      expect(prisma.caseSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', digestEnabled: true },
        include: { case: true },
      });
    });
  });

  // ============================================================================
  // Get Case Subscribers Tests
  // ============================================================================

  describe('getCaseSubscribers', () => {
    it('should return all subscriber IDs for a case', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      const result = await caseSubscriptionService.getCaseSubscribers('case-123');

      expect(result).toEqual(['user-1', 'user-2', 'user-3']);
    });
  });

  // ============================================================================
  // Get Notifiable Subscribers Tests
  // ============================================================================

  describe('getNotifiableSubscribers', () => {
    it('should return subscribers for task notifications', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result = await caseSubscriptionService.getNotifiableSubscribers('case-123', 'task');

      expect(result).toEqual(['user-1', 'user-2']);
      expect(prisma.caseSubscription.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123', notifyOnTask: true },
        select: { userId: true },
      });
    });

    it('should return subscribers for document notifications', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      const result = await caseSubscriptionService.getNotifiableSubscribers('case-123', 'document');

      expect(prisma.caseSubscription.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123', notifyOnDocument: true },
        select: { userId: true },
      });
    });

    it('should return subscribers for comment notifications', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      const result = await caseSubscriptionService.getNotifiableSubscribers('case-123', 'comment');

      expect(prisma.caseSubscription.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123', notifyOnComment: true },
        select: { userId: true },
      });
    });
  });

  // ============================================================================
  // Auto Subscribe Team Members Tests
  // ============================================================================

  describe('autoSubscribeTeamMembers', () => {
    it('should create subscriptions for new team members', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([{ userId: 'existing-user' }]);
      prisma.caseSubscription.createMany.mockResolvedValue({ count: 2 });

      await caseSubscriptionService.autoSubscribeTeamMembers('case-123', [
        'existing-user',
        'new-user-1',
        'new-user-2',
      ]);

      expect(prisma.caseSubscription.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ caseId: 'case-123', userId: 'new-user-1' }),
          expect.objectContaining({ caseId: 'case-123', userId: 'new-user-2' }),
        ],
      });
    });

    it('should not create duplicates for existing subscribers', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      await caseSubscriptionService.autoSubscribeTeamMembers('case-123', ['user-1', 'user-2']);

      expect(prisma.caseSubscription.createMany).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Generate Daily Digest Tests
  // ============================================================================

  describe('generateDailyDigest', () => {
    const mockActor = {
      id: 'actor-123',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    const mockActivities = [
      {
        id: 'activity-1',
        caseId: 'case-123',
        activityType: 'TaskCreated',
        entityId: 'task-1',
        title: 'New task created',
        summary: 'Task 1',
        createdAt: new Date(),
        actor: mockActor,
      },
      {
        id: 'activity-2',
        caseId: 'case-123',
        activityType: 'TaskCompleted',
        entityId: 'task-2',
        title: 'Task completed',
        summary: 'Task 2',
        createdAt: new Date(),
        actor: mockActor,
      },
      {
        id: 'activity-3',
        caseId: 'case-123',
        activityType: 'DocumentUploaded',
        entityId: 'doc-1',
        title: 'Document uploaded',
        summary: 'document.pdf',
        createdAt: new Date(),
        actor: mockActor,
      },
    ];

    it('should generate digest with activity summaries', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([{ ...mockSubscription, case: mockCase }]);

      const activityMap = new Map();
      activityMap.set('case-123', mockActivities);
      caseActivityService.getActivityForCases.mockResolvedValue(activityMap);

      const result = await caseSubscriptionService.generateDailyDigest('user-123');

      expect(result.userId).toBe('user-123');
      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].caseTitle).toBe('Test Case');
      expect(result.cases[0].taskUpdates).toHaveLength(2);
      expect(result.cases[0].newAttachments).toBe(1);
    });

    it('should return empty digest when no subscriptions', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([]);

      const result = await caseSubscriptionService.generateDailyDigest('user-123');

      expect(result.cases).toHaveLength(0);
    });

    it('should skip cases with no activity', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([
        { ...mockSubscription, case: mockCase },
        {
          ...mockSubscription,
          id: 'sub-456',
          caseId: 'case-456',
          case: { ...mockCase, id: 'case-456' },
        },
      ]);

      const activityMap = new Map();
      activityMap.set('case-123', mockActivities);
      // case-456 has no activity
      caseActivityService.getActivityForCases.mockResolvedValue(activityMap);

      const result = await caseSubscriptionService.generateDailyDigest('user-123');

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].caseId).toBe('case-123');
    });

    it('should categorize activity types correctly', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([{ ...mockSubscription, case: mockCase }]);

      const activities = [
        { ...mockActivities[0], activityType: 'TaskStatusChanged', title: 'Status changed' },
        { ...mockActivities[0], activityType: 'TaskAssigned', title: 'Task assigned' },
        { ...mockActivities[0], activityType: 'TaskCommented', title: 'Comment added' },
        { ...mockActivities[0], activityType: 'DocumentVersioned', title: 'Document versioned' },
      ];

      const activityMap = new Map();
      activityMap.set('case-123', activities);
      caseActivityService.getActivityForCases.mockResolvedValue(activityMap);

      const result = await caseSubscriptionService.generateDailyDigest('user-123');

      expect(result.cases[0].taskUpdates).toHaveLength(4);
      expect(result.cases[0].newComments).toBe(1);
      expect(result.cases[0].newAttachments).toBe(1);
    });

    it('should use provided date for digest', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([]);
      const customDate = new Date('2024-06-15');

      const result = await caseSubscriptionService.generateDailyDigest('user-123', customDate);

      expect(result.date.toISOString().slice(0, 10)).toBe('2024-06-15');
    });
  });

  // ============================================================================
  // Get Users For Daily Digest Tests
  // ============================================================================

  describe('getUsersForDailyDigest', () => {
    it('should return distinct user IDs with digest enabled', async () => {
      prisma.caseSubscription.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      const result = await caseSubscriptionService.getUsersForDailyDigest();

      expect(result).toEqual(['user-1', 'user-2', 'user-3']);
      expect(prisma.caseSubscription.findMany).toHaveBeenCalledWith({
        where: { digestEnabled: true },
        select: { userId: true },
        distinct: ['userId'],
      });
    });
  });
});
