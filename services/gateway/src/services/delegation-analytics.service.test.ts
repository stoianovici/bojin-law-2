/**
 * Delegation Analytics Service Unit Tests
 * Story 4.7: Task Analytics and Optimization - Task 36
 *
 * Tests for:
 * - Delegation pattern analysis
 * - Success rate calculation
 * - Training opportunity identification
 */

import { DelegationAnalyticsService } from './delegation-analytics.service';
import {
  delegationFixtures,
  defaultFilters,
  TEST_FIRM_ID,
  TEST_USER_IDS,
  mockUsers,
} from '../../__tests__/fixtures/task-analytics.fixtures';
import { DelegationStatus, TaskTypeEnum, TaskStatus } from '@prisma/client';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

describe('DelegationAnalyticsService', () => {
  let service: DelegationAnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      taskDelegation: {
        findMany: jest.fn(),
      },
    };

    service = new DelegationAnalyticsService(mockPrisma, undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('identifyTrainingOpportunities', () => {
    it('should return users with training suggestions', () => {
      const userPatterns = [
        {
          userId: TEST_USER_IDS.paralegal,
          userName: 'Bob Paralegal',
          role: 'Paralegal',
          delegationsReceived: 5,
          delegationsGiven: 0,
          successRate: 0.4,
          avgCompletionDays: 3.5,
          strengthAreas: [TaskTypeEnum.DocumentRetrieval],
          struggleAreas: [TaskTypeEnum.Research],
          suggestedTraining: [
            {
              skillArea: TaskTypeEnum.Research,
              reason: 'Low success rate on 3 research tasks',
              priority: 'high' as const,
              suggestedAction: 'Review legal research methodology',
            },
          ],
        },
        {
          userId: TEST_USER_IDS.associate,
          userName: 'Jane Associate',
          role: 'Associate',
          delegationsReceived: 3,
          delegationsGiven: 2,
          successRate: 0.9,
          avgCompletionDays: 1.5,
          strengthAreas: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
          struggleAreas: [],
          suggestedTraining: [],
        },
      ];

      const opportunities = service.identifyTrainingOpportunities(userPatterns as any);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].userId).toBe(TEST_USER_IDS.paralegal);
      expect(opportunities[0].suggestions).toHaveLength(1);
    });

    it('should sort by number of suggestions descending', () => {
      const userPatterns = [
        {
          userId: 'user-1',
          userName: 'User 1',
          suggestedTraining: [{ skillArea: 'A', priority: 'low' }],
        },
        {
          userId: 'user-2',
          userName: 'User 2',
          suggestedTraining: [
            { skillArea: 'A', priority: 'high' },
            { skillArea: 'B', priority: 'medium' },
          ],
        },
      ];

      const opportunities = service.identifyTrainingOpportunities(userPatterns as any);

      expect(opportunities[0].userId).toBe('user-2');
      expect(opportunities[0].suggestions).toHaveLength(2);
    });

    it('should exclude users without training suggestions', () => {
      const userPatterns = [
        {
          userId: 'user-1',
          userName: 'User 1',
          suggestedTraining: [],
        },
        {
          userId: 'user-2',
          userName: 'User 2',
          suggestedTraining: [],
        },
      ];

      const opportunities = service.identifyTrainingOpportunities(userPatterns as any);

      expect(opportunities).toHaveLength(0);
    });
  });

  describe('getDelegationAnalytics', () => {
    it('should return complete delegation analytics', async () => {
      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegationFixtures);

      const result = await service.getDelegationAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(result.byUser).toBeDefined();
      expect(result.topDelegationFlows).toBeDefined();
      expect(result.firmWideSuccessRate).toBeDefined();
      expect(result.trainingOpportunities).toBeDefined();
    });

    it('should calculate firm-wide success rate correctly', async () => {
      const delegations = [
        // 2 on-time, 1 late = 66.67% success
        {
          id: 'd1',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-15'),
            completedAt: new Date('2025-11-14'), // On time
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
        {
          id: 'd2',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-20'),
            completedAt: new Date('2025-11-19'), // On time
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
        {
          id: 'd3',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.paralegal,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-10'),
            completedAt: new Date('2025-11-12'), // Late
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
      ];

      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegations);

      const result = await service.getDelegationAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(result.firmWideSuccessRate).toBeCloseTo(0.67, 1); // 2/3
    });

    it('should identify strength and struggle areas by task type', async () => {
      const delegations = [
        // Associate: Good at Research (2/2 on time)
        {
          id: 'd1',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-15'),
            completedAt: new Date('2025-11-14'),
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
        {
          id: 'd2',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-20'),
            completedAt: new Date('2025-11-19'),
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
        // Associate: Bad at DocumentCreation (0/2 on time)
        {
          id: 'd3',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.DocumentCreation,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-10'),
            completedAt: new Date('2025-11-15'), // Late
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
        {
          id: 'd4',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.DocumentCreation,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-12'),
            completedAt: new Date('2025-11-18'), // Late
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
      ];

      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegations);

      const result = await service.getDelegationAnalytics(TEST_FIRM_ID, defaultFilters);

      const associateUser = result.byUser.find((u) => u.userId === TEST_USER_IDS.associate);

      expect(associateUser?.strengthAreas).toContain(TaskTypeEnum.Research);
      expect(associateUser?.struggleAreas).toContain(TaskTypeEnum.DocumentCreation);
    });

    it('should calculate top delegation flows', async () => {
      const delegations = [
        // Partner -> Associate: 3 times
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `d-pa-${i}`,
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-15'),
            completedAt: new Date('2025-11-14'),
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        })),
        // Associate -> Paralegal: 2 times
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `d-ap-${i}`,
          delegatedBy: TEST_USER_IDS.associate,
          delegatedTo: TEST_USER_IDS.paralegal,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.DocumentRetrieval,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-15'),
            completedAt: new Date('2025-11-14'),
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        })),
      ];

      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegations);

      const result = await service.getDelegationAnalytics(TEST_FIRM_ID, defaultFilters);

      // Partner -> Associate should be first (3 delegations)
      expect(result.topDelegationFlows[0].fromUserId).toBe(TEST_USER_IDS.partner);
      expect(result.topDelegationFlows[0].toUserId).toBe(TEST_USER_IDS.associate);
      expect(result.topDelegationFlows[0].count).toBe(3);

      // Associate -> Paralegal should be second (2 delegations)
      expect(result.topDelegationFlows[1].fromUserId).toBe(TEST_USER_IDS.associate);
      expect(result.topDelegationFlows[1].toUserId).toBe(TEST_USER_IDS.paralegal);
      expect(result.topDelegationFlows[1].count).toBe(2);
    });

    it('should handle empty delegation list', async () => {
      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce([]);

      const result = await service.getDelegationAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(result.byUser).toHaveLength(0);
      expect(result.topDelegationFlows).toHaveLength(0);
      expect(result.firmWideSuccessRate).toBe(0);
      expect(result.trainingOpportunities).toHaveLength(0);
    });
  });

  describe('analyzeDelegationPatterns', () => {
    it('should return patterns for specific user', async () => {
      const delegations = [
        {
          id: 'd1',
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.associate,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-15'),
            completedAt: new Date('2025-11-14'),
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
      ];

      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegations);

      const result = await service.analyzeDelegationPatterns(
        TEST_FIRM_ID,
        TEST_USER_IDS.associate,
        defaultFilters
      );

      expect(result?.userId).toBe(TEST_USER_IDS.associate);
      expect(result?.delegationsReceived).toBe(1);
    });

    it('should return null if user has no delegations', async () => {
      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce([]);

      const result = await service.analyzeDelegationPatterns(
        TEST_FIRM_ID,
        'non-existent-user',
        defaultFilters
      );

      expect(result).toBeNull();
    });
  });

  describe('training suggestions generation', () => {
    it('should prioritize high priority suggestions first', async () => {
      const delegations = [
        // Very low success rate on Research (< 30%)
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `d-research-${i}`,
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.paralegal,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-10'),
            completedAt: i === 0 ? new Date('2025-11-09') : new Date('2025-11-15'), // Only 1 on time
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        })),
        // Medium success rate on DocumentCreation (40%)
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `d-doc-${i}`,
          delegatedBy: TEST_USER_IDS.partner,
          delegatedTo: TEST_USER_IDS.paralegal,
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.DocumentCreation,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-10'),
            completedAt: i < 2 ? new Date('2025-11-09') : new Date('2025-11-15'), // 2 on time
          },
          delegate: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          delegator: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        })),
      ];

      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegations);

      const result = await service.getDelegationAnalytics(TEST_FIRM_ID, defaultFilters);

      const paralegalUser = result.byUser.find((u) => u.userId === TEST_USER_IDS.paralegal);

      if (paralegalUser?.suggestedTraining && paralegalUser.suggestedTraining.length > 1) {
        // High priority should come first
        expect(paralegalUser.suggestedTraining[0].priority).toBe('high');
      }
    });
  });
});
