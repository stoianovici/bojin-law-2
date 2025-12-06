/**
 * Task Analytics GraphQL API Integration Tests
 * Story 4.7: Task Analytics and Optimization - Task 38
 *
 * Tests for:
 * - Completion time analytics queries (AC: 1)
 * - Overdue analysis queries (AC: 2)
 * - Velocity trends queries (AC: 3)
 * - Pattern detection queries (AC: 4)
 * - Delegation analytics queries (AC: 5)
 * - ROI dashboard queries (AC: 6)
 */

// Set environment variables
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    taskDelegation: {
      findMany: jest.fn(),
    },
    taskDependency: {
      count: jest.fn(),
    },
    taskHistory: {
      count: jest.fn(),
    },
    taskPatternAnalysis: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    taskTemplate: {
      create: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    firm: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@legal-platform/database';
import { taskAnalyticsResolvers } from '../../src/graphql/resolvers/task-analytics.resolvers';
import { TaskStatus, TaskTypeEnum, TaskPriority, DelegationStatus, CaseType } from '@prisma/client';

// Define Context type locally (matches resolver context type)
interface Context {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    firmId: string;
  };
  req: unknown;
  res: unknown;
}

// Cast to any for mocking - Jest mocks don't play well with Prisma's complex types
const mockPrisma = prisma as any;

// Test data
const testFirm = {
  id: 'firm-123',
  name: 'Test Law Firm',
  defaultRates: { Standard: 200 },
};

const testUser = {
  id: 'user-123',
  email: 'user@testfirm.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'Partner',
  firmId: testFirm.id,
};

const testCase = {
  id: 'case-123',
  title: 'Test Case',
  firmId: testFirm.id,
};

const mockContext: Context = {
  user: testUser,
  req: {} as any,
  res: {} as any,
};

const defaultFilters = {
  dateRange: {
    start: new Date('2025-11-01'),
    end: new Date('2025-11-30'),
  },
};

describe('Task Analytics GraphQL API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query - completionTimeAnalytics (AC: 1)', () => {
    it('should return completion time analytics with byType and byUser', async () => {
      const completedTasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: 'user-associate',
          createdAt: new Date('2025-11-10T10:00:00Z'),
          completedAt: new Date('2025-11-11T10:00:00Z'), // 24 hours
          assignee: { id: 'user-associate', firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research,
          assignedTo: 'user-associate',
          createdAt: new Date('2025-11-12T10:00:00Z'),
          completedAt: new Date('2025-11-14T10:00:00Z'), // 48 hours
          assignee: { id: 'user-associate', firstName: 'Jane', lastName: 'Associate' },
        },
        {
          id: 'task-3',
          type: TaskTypeEnum.DocumentCreation,
          assignedTo: 'user-paralegal',
          createdAt: new Date('2025-11-15T10:00:00Z'),
          completedAt: new Date('2025-11-16T10:00:00Z'), // 24 hours
          assignee: { id: 'user-paralegal', firstName: 'Bob', lastName: 'Paralegal' },
        },
      ];

      // Current period
      mockPrisma.task.findMany.mockResolvedValueOnce(completedTasks as any);
      // Previous period for comparison
      mockPrisma.task.findMany.mockResolvedValueOnce([]);

      const result = await taskAnalyticsResolvers.Query.taskCompletionAnalytics(
        null,
        { filters: defaultFilters },
        mockContext
      );

      expect(result.firmMetrics.totalTasksAnalyzed).toBe(3);
      expect(result.byType).toBeDefined();
      expect(result.byUser).toBeDefined();
      expect(result.dateRange).toBeDefined();

      // Check Research type has 2 tasks
      const researchType = result.byType.find((t: any) => t.taskType === TaskTypeEnum.Research);
      expect(researchType?.metrics.totalTasksAnalyzed).toBe(2);

      // Check user grouping
      const associateUser = result.byUser.find((u: any) => u.userId === 'user-associate');
      expect(associateUser?.taskCount).toBe(2);
    });

    it('should handle empty results gracefully', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await taskAnalyticsResolvers.Query.taskCompletionAnalytics(
        null,
        { filters: defaultFilters },
        mockContext
      );

      expect(result.firmMetrics.totalTasksAnalyzed).toBe(0);
      expect(result.byType).toHaveLength(0);
      expect(result.byUser).toHaveLength(0);
    });
  });

  describe('Query - overdueAnalytics (AC: 2)', () => {
    it('should return overdue analytics with bottleneck patterns', async () => {
      const overdueTasks = [
        {
          id: 'task-overdue-1',
          title: 'Overdue Research',
          type: TaskTypeEnum.Research,
          assignedTo: 'user-paralegal',
          caseId: testCase.id,
          dueDate: new Date('2025-11-20'),
          priority: TaskPriority.High,
          isCriticalPath: true,
          predecessors: [],
          successors: [{ successorId: 'blocked-task' }],
          assignee: { id: 'user-paralegal', firstName: 'Bob', lastName: 'Paralegal' },
          case: { id: testCase.id, title: testCase.title },
        },
        {
          id: 'task-overdue-2',
          title: 'Overdue Meeting',
          type: TaskTypeEnum.Meeting,
          assignedTo: 'user-paralegal', // Same user - potential overload
          caseId: testCase.id,
          dueDate: new Date('2025-11-25'),
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: { id: 'user-paralegal', firstName: 'Bob', lastName: 'Paralegal' },
          case: { id: testCase.id, title: testCase.title },
        },
      ];

      // getOverdueTasks
      mockPrisma.task.findMany.mockResolvedValueOnce(overdueTasks as any);
      // getCriticalOverdueTasks
      mockPrisma.task.findMany.mockResolvedValueOnce(overdueTasks as any);

      const result = await taskAnalyticsResolvers.Query.overdueAnalytics(
        null,
        { filters: defaultFilters },
        mockContext
      );

      expect(result.totalOverdue).toBe(2);
      expect(result.overdueByType).toBeDefined();
      expect(result.overdueByUser).toBeDefined();
      expect(result.bottleneckPatterns).toBeDefined();
      expect(result.criticalTasks).toBeDefined();

      // Check critical task is identified
      const criticalTask = result.criticalTasks.find(
        (t: any) => t.taskId === 'task-overdue-1'
      );
      expect(criticalTask?.estimatedImpact).toBe('critical');
    });

    it('should identify bottleneck patterns correctly', async () => {
      // Create 5 overdue tasks for same user (overload pattern)
      const overloadedTasks: any[] = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        type: TaskTypeEnum.Research,
        assignedTo: 'user-overloaded',
        caseId: testCase.id,
        dueDate: new Date(`2025-11-${20 + i}`),
        priority: TaskPriority.Medium,
        isCriticalPath: false,
        predecessors: [],
        successors: [],
        assignee: { id: 'user-overloaded', firstName: 'Overloaded', lastName: 'User' },
        case: { id: testCase.id, title: testCase.title },
      }));

      // Add one task for another user (for comparison)
      overloadedTasks.push({
        id: 'task-other',
        title: 'Other Task',
        type: TaskTypeEnum.Meeting,
        assignedTo: 'user-other',
        caseId: testCase.id,
        dueDate: new Date('2025-11-25'),
        priority: TaskPriority.Low,
        isCriticalPath: false,
        predecessors: [],
        successors: [],
        assignee: { id: 'user-other', firstName: 'Other', lastName: 'User' },
        case: { id: testCase.id, title: testCase.title },
      });

      mockPrisma.task.findMany.mockResolvedValueOnce(overloadedTasks as any);
      mockPrisma.task.findMany.mockResolvedValueOnce(overloadedTasks as any);

      const result = await taskAnalyticsResolvers.Query.overdueAnalytics(
        null,
        { filters: defaultFilters },
        mockContext
      );

      // Should detect user overload pattern
      const overloadPattern = result.bottleneckPatterns.find(
        (p: any) => p.patternType === 'user_overload'
      );
      expect(overloadPattern).toBeDefined();
      expect(overloadPattern?.relatedUsers).toContain('user-overloaded');
    });
  });

  describe('Query - velocityTrends (AC: 3)', () => {
    it('should return velocity trends with time series data', async () => {
      // Created tasks
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { createdAt: new Date('2025-11-05'), _count: { id: 5 } },
        { createdAt: new Date('2025-11-12'), _count: { id: 8 } },
      ]);

      // Completed tasks
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { completedAt: new Date('2025-11-06'), _count: { id: 4 } },
        { completedAt: new Date('2025-11-13'), _count: { id: 7 } },
      ]);

      // Historical target
      mockPrisma.task.count.mockResolvedValueOnce(60); // 60 completed in 90 days

      // Current period count
      mockPrisma.task.count.mockResolvedValueOnce(30);
      // Previous period count
      mockPrisma.task.count.mockResolvedValueOnce(25);

      // User velocity
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const result = await taskAnalyticsResolvers.Query.velocityTrends(
        null,
        { filters: defaultFilters, interval: 'WEEKLY' as const },
        mockContext
      );

      expect(result.firmVelocity).toBeDefined();
      expect(result.timeSeries).toBeDefined();
      expect(result.byUser).toBeDefined();
      expect(result.interval).toBe('weekly');

      // Verify firm velocity has expected properties
      expect(result.firmVelocity.current).toBeDefined();
      expect(result.firmVelocity.previous).toBeDefined();
      expect(['improving', 'stable', 'declining']).toContain(result.firmVelocity.trend);
    });

    it('should calculate user velocity comparisons', async () => {
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.task.groupBy.mockResolvedValueOnce([]);
      mockPrisma.task.count.mockResolvedValueOnce(30);
      mockPrisma.task.count.mockResolvedValueOnce(25);
      mockPrisma.task.count.mockResolvedValueOnce(60);

      // Current user stats
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: 'user-fast', _count: { id: 15 } },
        { assignedTo: 'user-slow', _count: { id: 5 } },
      ]);

      // Previous user stats
      mockPrisma.task.groupBy.mockResolvedValueOnce([
        { assignedTo: 'user-fast', _count: { id: 10 } },
        { assignedTo: 'user-slow', _count: { id: 8 } },
      ]);

      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-fast', firstName: 'Fast', lastName: 'User' },
        { id: 'user-slow', firstName: 'Slow', lastName: 'User' },
      ]);

      const result = await taskAnalyticsResolvers.Query.velocityTrends(
        null,
        { filters: defaultFilters, interval: 'DAILY' as const },
        mockContext
      );

      expect(result.byUser).toHaveLength(2);

      const fastUser = result.byUser.find((u: any) => u.userId === 'user-fast');
      expect(fastUser?.trendDirection).toBe('up'); // 15 > 10

      const slowUser = result.byUser.find((u: any) => u.userId === 'user-slow');
      expect(slowUser?.trendDirection).toBe('down'); // 5 < 8
    });
  });

  describe('Query - taskPatterns (AC: 4)', () => {
    it('should return detected task patterns', async () => {
      const storedPatterns = [
        {
          id: 'pattern-1',
          firmId: testFirm.id,
          patternType: 'CoOccurrence',
          taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
          caseTypes: [CaseType.Contract],
          occurrenceCount: 5,
          confidence: 0.85,
          suggestedName: 'Research and Documentation',
          avgSequenceGap: null,
          commonAssignees: ['user-associate'],
          isTemplateCreated: false,
          isDismissed: false,
          templateId: null,
          analyzedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ];

      mockPrisma.taskPatternAnalysis.findMany.mockResolvedValueOnce(storedPatterns);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-associate', firstName: 'Jane', lastName: 'Associate' },
      ]);
      mockPrisma.case.findMany.mockResolvedValueOnce([]);

      const result = await taskAnalyticsResolvers.Query.taskPatterns(
        null,
        {},
        mockContext
      );

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].confidence).toBe(0.85);
      expect(result.patterns[0].isTemplateCreated).toBe(false);
      expect(result.highConfidenceCount).toBe(1); // 0.85 >= 0.8
    });
  });

  describe('Query - delegationAnalytics (AC: 5)', () => {
    it('should return delegation analytics with training opportunities', async () => {
      const delegations = [
        // Successful delegation
        {
          id: 'd1',
          delegatedBy: 'user-partner',
          delegatedTo: 'user-associate',
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-10'),
            completedAt: new Date('2025-11-09'), // On time
          },
          delegate: { id: 'user-associate', firstName: 'Jane', lastName: 'Associate', role: 'Associate' },
          delegator: { id: 'user-partner', firstName: 'John', lastName: 'Partner' },
        },
        // Failed delegation (late)
        {
          id: 'd2',
          delegatedBy: 'user-partner',
          delegatedTo: 'user-paralegal',
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-15'),
            completedAt: new Date('2025-11-20'), // Late
          },
          delegate: { id: 'user-paralegal', firstName: 'Bob', lastName: 'Paralegal', role: 'Paralegal' },
          delegator: { id: 'user-partner', firstName: 'John', lastName: 'Partner' },
        },
        // Another failed for paralegal
        {
          id: 'd3',
          delegatedBy: 'user-partner',
          delegatedTo: 'user-paralegal',
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-18'),
            completedAt: new Date('2025-11-25'), // Late
          },
          delegate: { id: 'user-paralegal', firstName: 'Bob', lastName: 'Paralegal', role: 'Paralegal' },
          delegator: { id: 'user-partner', firstName: 'John', lastName: 'Partner' },
        },
      ];

      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegations);

      const result = await taskAnalyticsResolvers.Query.delegationAnalytics(
        null,
        { filters: defaultFilters },
        mockContext
      );

      expect(result.byUser).toBeDefined();
      expect(result.topDelegationFlows).toBeDefined();
      expect(result.firmWideSuccessRate).toBeDefined();
      expect(result.trainingOpportunities).toBeDefined();

      // Firm success rate: 1/3 = 0.33
      expect(result.firmWideSuccessRate).toBeCloseTo(0.33, 1);

      // Paralegal should have training opportunity
      const paralegalOpportunity = result.trainingOpportunities.find(
        (o: any) => o.userId === 'user-paralegal'
      );
      expect(paralegalOpportunity).toBeDefined();
      expect(paralegalOpportunity?.suggestions.length).toBeGreaterThan(0);
    });

    it('should calculate delegation flows between users', async () => {
      const delegations = [
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `d-pa-${i}`,
          delegatedBy: 'user-partner',
          delegatedTo: 'user-associate',
          status: DelegationStatus.Accepted,
          sourceTask: {
            type: TaskTypeEnum.Research,
            status: TaskStatus.Completed,
            dueDate: new Date('2025-11-10'),
            completedAt: new Date('2025-11-09'),
          },
          delegate: { id: 'user-associate', firstName: 'Jane', lastName: 'Associate', role: 'Associate' },
          delegator: { id: 'user-partner', firstName: 'John', lastName: 'Partner' },
        })),
      ];

      mockPrisma.taskDelegation.findMany.mockResolvedValueOnce(delegations);

      const result = await taskAnalyticsResolvers.Query.delegationAnalytics(
        null,
        { filters: defaultFilters },
        mockContext
      );

      expect(result.topDelegationFlows[0].fromUserId).toBe('user-partner');
      expect(result.topDelegationFlows[0].toUserId).toBe('user-associate');
      expect(result.topDelegationFlows[0].count).toBe(3);
    });
  });

  describe('Query - roiDashboard (AC: 6)', () => {
    it('should return ROI dashboard with time savings', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce(testFirm);

      // Template tasks: 10 * 5 min = 50 min
      mockPrisma.task.count.mockResolvedValueOnce(10);
      // Manual tasks
      mockPrisma.task.count.mockResolvedValueOnce(20);
      // NLP tasks: 15 * 2 min = 30 min
      mockPrisma.task.count.mockResolvedValueOnce(15);
      // Auto reminders
      mockPrisma.task.count.mockResolvedValueOnce(30);
      // Dependencies
      mockPrisma.taskDependency.count.mockResolvedValueOnce(5);
      // Reassignments
      mockPrisma.taskHistory.count.mockResolvedValueOnce(2);

      // Previous period
      mockPrisma.task.count.mockResolvedValueOnce(8); // prev template
      mockPrisma.task.count.mockResolvedValueOnce(12); // prev NLP

      // Time series
      mockPrisma.task.count.mockResolvedValueOnce(3);
      mockPrisma.task.count.mockResolvedValueOnce(5);

      const result = await taskAnalyticsResolvers.Query.roiDashboard(
        null,
        { filters: defaultFilters },
        mockContext
      );

      expect(result.currentPeriod).toBeDefined();
      expect(result.timeSeries).toBeDefined();
      expect(result.projectedAnnualSavings).toBeGreaterThan(0);
      expect(result.topSavingsCategories).toBeDefined();

      // Check template time saved: 10 * 5 min = 50 min = 0.83 hours
      expect(result.currentPeriod.estimatedTemplateTimeSavedHours).toBeCloseTo(0.83, 1);

      // Check NLP time saved: 15 * 2 min = 30 min = 0.5 hours
      expect(result.currentPeriod.estimatedNLPTimeSavedHours).toBe(0.5);
    });

    it('should calculate template adoption rate', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce(testFirm);
      mockPrisma.task.count
        .mockResolvedValueOnce(30) // template
        .mockResolvedValueOnce(50) // manual
        .mockResolvedValueOnce(20) // nlp
        .mockResolvedValueOnce(0);
      mockPrisma.taskDependency.count.mockResolvedValueOnce(0);
      mockPrisma.taskHistory.count.mockResolvedValueOnce(0);
      mockPrisma.task.count.mockResolvedValueOnce(25).mockResolvedValueOnce(15);
      mockPrisma.task.count.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      const result = await taskAnalyticsResolvers.Query.roiDashboard(
        null,
        { filters: defaultFilters },
        mockContext
      );

      // Adoption rate: 30 / (30 + 50 + 20) = 30%
      expect(result.currentPeriod.templateAdoptionRate).toBe(30);
    });
  });

  describe('Mutation - createTemplateFromPattern (AC: 4)', () => {
    it('should create template from detected pattern', async () => {
      const pattern = {
        id: 'pattern-1',
        firmId: testFirm.id,
        taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
        avgSequenceGap: 2,
      };

      mockPrisma.taskPatternAnalysis.findUnique.mockResolvedValueOnce(pattern);
      mockPrisma.taskTemplate.create.mockResolvedValueOnce({
        id: 'template-new',
        name: 'Research & Documentation',
      });
      mockPrisma.taskPatternAnalysis.update.mockResolvedValueOnce({
        ...pattern,
        isTemplateCreated: true,
        templateId: 'template-new',
      });

      const result = await taskAnalyticsResolvers.Mutation.createTemplateFromPattern(
        null,
        {
          input: {
            patternId: 'pattern-1',
            templateName: 'Research & Documentation',
            description: 'Standard workflow for research followed by documentation',
          },
        },
        mockContext
      );

      expect(result.id).toBe('template-new');
      expect(result.name).toBe('Research & Documentation');
    });
  });

  describe('Mutation - dismissPattern (AC: 4)', () => {
    it('should mark pattern as dismissed', async () => {
      mockPrisma.taskPatternAnalysis.update.mockResolvedValueOnce({
        id: 'pattern-1',
        isDismissed: true,
      });

      const result = await taskAnalyticsResolvers.Mutation.dismissPattern(
        null,
        { patternId: 'pattern-1' },
        mockContext
      );

      expect(result).toBe(true);
      expect(mockPrisma.taskPatternAnalysis.update).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
        data: { isDismissed: true },
      });
    });
  });
});
