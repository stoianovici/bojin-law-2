/**
 * Overdue Analysis Service Unit Tests
 * Story 4.7: Task Analytics and Optimization - Task 33
 *
 * Tests for:
 * - Overdue detection
 * - Bottleneck identification
 * - Impact estimation
 */

import { OverdueAnalysisService } from './overdue-analysis.service';
import {
  overdueTasksFixtures,
  defaultFilters,
  TEST_FIRM_ID,
  TEST_USER_IDS,
  mockUsers,
  mockCases,
} from '../../__tests__/fixtures/task-analytics.fixtures';
import { TaskStatus, TaskTypeEnum, TaskPriority } from '@prisma/client';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

describe('OverdueAnalysisService', () => {
  let service: OverdueAnalysisService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      task: {
        findMany: jest.fn(),
      },
    };

    service = new OverdueAnalysisService(mockPrisma, undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateEstimatedImpact', () => {
    it('should return critical for critical path tasks with high priority', () => {
      const impact = service.calculateEstimatedImpact(
        true, // isCriticalPath
        2, // successorCount
        TaskPriority.High,
        10 // daysOverdue
      );

      expect(impact).toBe('critical');
    });

    it('should return high for tasks blocking multiple others', () => {
      const impact = service.calculateEstimatedImpact(
        false,
        3, // 3 successors blocked
        TaskPriority.Medium,
        5
      );

      expect(impact).toBe('high');
    });

    it('should return medium for medium priority long overdue tasks', () => {
      const impact = service.calculateEstimatedImpact(
        false,
        0,
        TaskPriority.Medium,
        15 // 15 days overdue
      );

      expect(impact).toBe('medium');
    });

    it('should return low for low priority tasks not blocking anything', () => {
      const impact = service.calculateEstimatedImpact(
        false,
        0,
        TaskPriority.Low,
        2
      );

      expect(impact).toBe('low');
    });

    it('should increase impact score with more successors', () => {
      const lowSuccessors = service.calculateEstimatedImpact(false, 1, TaskPriority.Medium, 5);
      const highSuccessors = service.calculateEstimatedImpact(false, 3, TaskPriority.Medium, 5);

      // More successors should result in higher or equal impact
      const impactOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      expect(impactOrder[highSuccessors]).toBeGreaterThanOrEqual(impactOrder[lowSuccessors]);
    });
  });

  describe('getOverdueAnalytics', () => {
    it('should return complete overdue analytics', async () => {
      mockPrisma.task.findMany
        .mockResolvedValueOnce(overdueTasksFixtures) // getOverdueTasks
        .mockResolvedValueOnce(overdueTasksFixtures); // getCriticalOverdueTasks

      const result = await service.getOverdueAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(result.totalOverdue).toBe(overdueTasksFixtures.length);
      expect(result.overdueByType).toBeDefined();
      expect(result.overdueByUser).toBeDefined();
      expect(result.bottleneckPatterns).toBeDefined();
      expect(result.criticalTasks).toBeDefined();
    });

    it('should group overdue tasks by type correctly', async () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          priority: TaskPriority.High,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          case: mockCases[0],
        },
        {
          id: 'task-3',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.partner,
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
          case: mockCases[0],
        },
      ];

      mockPrisma.task.findMany
        .mockResolvedValueOnce(tasks)
        .mockResolvedValueOnce(tasks);

      const result = await service.getOverdueAnalytics(TEST_FIRM_ID, defaultFilters);

      const researchType = result.overdueByType.find((t) => t.taskType === TaskTypeEnum.Research);
      expect(researchType?.count).toBe(2);
      expect(researchType?.avgDaysOverdue).toBe(4); // (3 + 5) / 2 = 4

      const meetingType = result.overdueByType.find((t) => t.taskType === TaskTypeEnum.Meeting);
      expect(meetingType?.count).toBe(1);
    });

    it('should group overdue tasks by user correctly', async () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.DocumentRetrieval,
          assignedTo: TEST_USER_IDS.paralegal, // Same user
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        },
        {
          id: 'task-3',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.partner,
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
          case: mockCases[0],
        },
      ];

      mockPrisma.task.findMany
        .mockResolvedValueOnce(tasks)
        .mockResolvedValueOnce(tasks);

      const result = await service.getOverdueAnalytics(TEST_FIRM_ID, defaultFilters);

      // Paralegal should be first (2 overdue) - sorted by count
      expect(result.overdueByUser[0].userId).toBe(TEST_USER_IDS.paralegal);
      expect(result.overdueByUser[0].count).toBe(2);
      expect(result.overdueByUser[0].userName).toBe('Bob Paralegal');
    });

    it('should handle empty overdue list', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await service.getOverdueAnalytics(TEST_FIRM_ID, defaultFilters);

      expect(result.totalOverdue).toBe(0);
      expect(result.overdueByType).toHaveLength(0);
      expect(result.overdueByUser).toHaveLength(0);
      expect(result.bottleneckPatterns).toHaveLength(0);
    });
  });

  describe('identifyBottlenecks', () => {
    it('should identify user overload pattern', async () => {
      // Create tasks where one user has way more than others
      const tasks = [
        // Paralegal has 4 overdue tasks
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `task-overload-${i}`,
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          dueDate: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        })),
        // Other users have 1 each
        {
          id: 'task-other-1',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.partner,
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
          case: mockCases[0],
        },
        {
          id: 'task-other-2',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.associate,
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          case: mockCases[0],
        },
      ];

      const patterns = await service.identifyBottlenecks(TEST_FIRM_ID, tasks as any);

      const userOverloadPattern = patterns.find((p) => p.patternType === 'user_overload');
      expect(userOverloadPattern).toBeDefined();
      expect(userOverloadPattern?.relatedUsers).toContain(TEST_USER_IDS.paralegal);
    });

    it('should identify task type delay pattern', async () => {
      // Research tasks are much more overdue than others (>1.5x avg days overdue)
      // Avg = (20 + 15 + 1) / 3 = 12 days
      // Research avg = 17.5 days, which is > 12 * 1.5 = 18? No, need more extreme
      // Let's make Research avg = 30 days, Meeting avg = 2 days
      // Total avg = (30 + 30 + 2) / 3 = 20.67 days
      // Research avg = 30 days > 20.67 * 1.5 = 31 - still not quite
      // Let's add more Meeting tasks to bring avg down
      const tasks = [
        // Research tasks - very overdue
        {
          id: 'task-research-1',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days overdue
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        },
        {
          id: 'task-research-2',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.associate,
          dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days overdue
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          case: mockCases[0],
        },
        // Meeting tasks - slightly overdue (4 of them to bring avg down)
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `task-meeting-${i}`,
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.partner,
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days overdue
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
          case: mockCases[0],
        })),
      ];
      // Now: Total avg = (30 + 30 + 2 + 2 + 2 + 2) / 6 = 11.33 days
      // Research avg = 30 days, which is > 11.33 * 1.5 = 17 -> pattern should trigger

      const patterns = await service.identifyBottlenecks(TEST_FIRM_ID, tasks as any);

      const typeDelayPattern = patterns.find((p) => p.patternType === 'task_type_delay');
      expect(typeDelayPattern).toBeDefined();
      expect(typeDelayPattern?.relatedTaskTypes).toContain(TaskTypeEnum.Research);
    });

    it('should identify dependency chain pattern', async () => {
      // More than 30% of tasks have dependencies
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-dep-${i}`,
        type: TaskTypeEnum.Research,
        assignedTo: TEST_USER_IDS.paralegal,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        priority: TaskPriority.Medium,
        isCriticalPath: false,
        predecessors: i < 4 ? [{ predecessorId: `blocking-task-${i}` }] : [], // 40% blocked
        successors: [],
        assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
        case: mockCases[0],
      }));

      const patterns = await service.identifyBottlenecks(TEST_FIRM_ID, tasks as any);

      const dependencyPattern = patterns.find((p) => p.patternType === 'dependency_chain');
      expect(dependencyPattern).toBeDefined();
      expect(dependencyPattern?.affectedTasks).toBe(4);
    });

    it('should identify case complexity pattern', async () => {
      // Multiple overdue tasks on the same case
      const tasks = [
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `task-case-${i}`,
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          caseId: 'case-complex-1', // All on same case
          dueDate: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        })),
        {
          id: 'task-other-case',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.partner,
          caseId: 'case-other',
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
          case: mockCases[0],
        },
      ];

      const patterns = await service.identifyBottlenecks(TEST_FIRM_ID, tasks as any);

      const complexityPattern = patterns.find((p) => p.patternType === 'case_complexity');
      expect(complexityPattern).toBeDefined();
      expect(complexityPattern?.affectedTasks).toBe(6);
    });

    it('should return empty patterns for no overdue tasks', async () => {
      const patterns = await service.identifyBottlenecks(TEST_FIRM_ID, []);

      expect(patterns).toHaveLength(0);
    });
  });

  describe('getCriticalOverdueTasks', () => {
    it('should sort by impact and return limited results', async () => {
      const tasks = [
        {
          id: 'task-low',
          title: 'Low impact task',
          type: TaskTypeEnum.Meeting,
          assignedTo: TEST_USER_IDS.junior,
          caseId: mockCases[0].id,
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day
          priority: TaskPriority.Low,
          isCriticalPath: false,
          predecessors: [],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.junior),
          case: mockCases[0],
        },
        {
          id: 'task-critical',
          title: 'Critical path task',
          type: TaskTypeEnum.CourtDate,
          assignedTo: TEST_USER_IDS.associate,
          caseId: mockCases[0].id,
          dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days
          priority: TaskPriority.High,
          isCriticalPath: true,
          predecessors: [],
          successors: [{ successorId: 'blocked-1' }, { successorId: 'blocked-2' }],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
          case: mockCases[0],
        },
        {
          id: 'task-medium',
          title: 'Medium impact task',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          caseId: mockCases[0].id,
          dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [],
          successors: [{ successorId: 'blocked-3' }],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValueOnce(tasks);

      const result = await service.getCriticalOverdueTasks(TEST_FIRM_ID, 3);

      // Critical should be first
      expect(result[0].taskId).toBe('task-critical');
      expect(result[0].estimatedImpact).toBe('critical');

      // Low should be last
      expect(result[result.length - 1].taskId).toBe('task-low');
    });

    it('should include blocked by information', async () => {
      const tasks = [
        {
          id: 'task-blocked',
          title: 'Blocked task',
          type: TaskTypeEnum.Research,
          assignedTo: TEST_USER_IDS.paralegal,
          caseId: mockCases[0].id,
          dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          priority: TaskPriority.Medium,
          isCriticalPath: false,
          predecessors: [
            { predecessorId: 'blocking-task-1' },
            { predecessorId: 'blocking-task-2' },
          ],
          successors: [],
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
          case: mockCases[0],
        },
      ];

      mockPrisma.task.findMany.mockResolvedValueOnce(tasks);

      const result = await service.getCriticalOverdueTasks(TEST_FIRM_ID, 10);

      expect(result[0].blockedBy).toEqual(['blocking-task-1', 'blocking-task-2']);
    });
  });
});
