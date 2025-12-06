/**
 * Deadline Warning Service Unit Tests
 * Story 5.4: Proactive AI Suggestions System - Task 36
 *
 * Tests for deadline warning generation, severity calculation, and suggested actions
 */

import { PrismaClient } from '@legal-platform/database';
import { DeadlineWarningService } from './deadline-warning.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
    },
    extractedDeadline: {
      findMany: jest.fn(),
    },
  },
}));

// Import mocked prisma
import { prisma } from '@legal-platform/database';

describe('DeadlineWarningService', () => {
  let service: DeadlineWarningService;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to create date X days from now
  const daysFromNow = (days: number): Date => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return date;
  };

  const mockTasks = [
    {
      id: 'task-1',
      title: 'Depunere cerere instanță',
      dueDate: daysFromNow(1), // Tomorrow - Critical
      priority: 'Urgent',
      status: 'Pending',
      caseId: 'case-1',
      assignedToId: 'user-123',
      firmId: 'firm-456',
      case: {
        id: 'case-1',
        title: 'Dosar Civil nr. 123/2024',
        caseNumber: '123/2024',
        client: { name: 'SC Example SRL' },
      },
      dependsOn: [],
    },
    {
      id: 'task-2',
      title: 'Revizuire contract',
      dueDate: daysFromNow(5), // 5 days - Warning
      priority: 'High',
      status: 'InProgress',
      caseId: 'case-2',
      assignedToId: 'user-123',
      firmId: 'firm-456',
      case: {
        id: 'case-2',
        title: 'Dosar Comercial nr. 456/2024',
        caseNumber: '456/2024',
        client: { name: 'PF Ionescu' },
      },
      dependsOn: [],
    },
    {
      id: 'task-3',
      title: 'Pregătire documente',
      dueDate: daysFromNow(10), // 10 days - Info
      priority: 'Normal',
      status: 'Pending',
      caseId: 'case-1',
      assignedToId: 'user-123',
      firmId: 'firm-456',
      case: {
        id: 'case-1',
        title: 'Dosar Civil nr. 123/2024',
        caseNumber: '123/2024',
        client: { name: 'SC Example SRL' },
      },
      dependsOn: [],
    },
  ];

  const mockExtractedDeadlines = [
    {
      id: 'deadline-1',
      description: 'Termen depunere apel',
      deadlineDate: daysFromNow(2),
      status: 'Pending',
      emailId: 'email-1',
      caseId: 'case-3',
      firmId: 'firm-456',
      case: {
        id: 'case-3',
        title: 'Dosar Penal nr. 789/2024',
      },
    },
  ];

  beforeEach(() => {
    service = new DeadlineWarningService();
    jest.clearAllMocks();

    // Default mock implementations
    (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);
    (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue(mockExtractedDeadlines);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // getUpcomingDeadlineWarnings Tests
  // ============================================================================

  describe('getUpcomingDeadlineWarnings', () => {
    it('should return warnings for upcoming deadlines', async () => {
      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toHaveProperty('taskId');
      expect(warnings[0]).toHaveProperty('title');
      expect(warnings[0]).toHaveProperty('dueDate');
      expect(warnings[0]).toHaveProperty('severity');
    });

    it('should filter by case when caseId is provided', async () => {
      await service.getUpcomingDeadlineWarnings('user-123', 'firm-456', { caseId: 'case-1' });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseId: 'case-1',
          }),
        })
      );
    });

    it('should use custom lookahead days when provided', async () => {
      await service.getUpcomingDeadlineWarnings('user-123', 'firm-456', { lookaheadDays: 7 });

      // Verify the date filter uses 7 days
      expect(prisma.task.findMany).toHaveBeenCalled();
    });

    it('should include extracted deadlines from emails', async () => {
      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      // Should include both task deadlines and extracted deadlines
      const extractedWarning = warnings.find(w => !w.taskId);
      expect(extractedWarning).toBeDefined();
      expect(extractedWarning?.title).toBe('Termen depunere apel');
    });

    it('should sort warnings by severity then due date', async () => {
      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      // Critical warnings should come first
      expect(warnings[0].severity).toBe('critical');

      // Within same severity, earlier dates should come first
      const criticalWarnings = warnings.filter(w => w.severity === 'critical');
      if (criticalWarnings.length > 1) {
        expect(criticalWarnings[0].daysUntilDue).toBeLessThanOrEqual(criticalWarnings[1].daysUntilDue);
      }
    });

    it('should include task dependencies when requested', async () => {
      const taskWithDeps = {
        ...mockTasks[0],
        dependsOn: [
          {
            dependsOnTask: {
              id: 'task-dep-1',
              title: 'Prerequisite task',
              status: 'InProgress',
            },
          },
        ],
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([taskWithDeps]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456', {
        includeDependencies: true,
      });

      expect(warnings[0].blockedBy).toBeDefined();
      expect(warnings[0].blockedBy).toContain('Prerequisite task');
    });

    it('should not include completed dependencies in blockedBy', async () => {
      const taskWithCompletedDep = {
        ...mockTasks[0],
        dependsOn: [
          {
            dependsOnTask: {
              id: 'task-dep-1',
              title: 'Completed task',
              status: 'Completed',
            },
          },
        ],
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([taskWithCompletedDep]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456', {
        includeDependencies: true,
      });

      expect(warnings[0].blockedBy).toBeUndefined();
    });
  });

  // ============================================================================
  // Severity Calculation Tests
  // ============================================================================

  describe('severity calculation', () => {
    it('should return "critical" for deadlines within 3 days', async () => {
      const urgentTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(2),
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([urgentTask]);
      (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      expect(warnings[0].severity).toBe('critical');
    });

    it('should return "critical" for overdue deadlines', async () => {
      const overdueTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(-1), // Yesterday
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([overdueTask]);
      (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      expect(warnings[0].severity).toBe('critical');
      expect(warnings[0].daysUntilDue).toBeLessThan(0);
    });

    it('should return "warning" for deadlines 4-7 days away', async () => {
      const mediumTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(5),
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([mediumTask]);
      (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      expect(warnings[0].severity).toBe('warning');
    });

    it('should return "info" for deadlines 8-14 days away', async () => {
      const futureTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(10),
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([futureTask]);
      (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      expect(warnings[0].severity).toBe('info');
    });

    it('should calculate daysUntilDue correctly', async () => {
      const exactDaysTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(5),
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([exactDaysTask]);
      (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      expect(warnings[0].daysUntilDue).toBe(5);
    });
  });

  // ============================================================================
  // Suggested Actions Tests
  // ============================================================================

  describe('suggested actions', () => {
    it('should include suggested actions for task warnings', async () => {
      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      const taskWarning = warnings.find(w => w.taskId);
      expect(taskWarning?.suggestedActions).toBeDefined();
      expect(taskWarning?.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should include create_task action for extracted deadlines', async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      const extractedWarning = warnings[0];
      const createAction = extractedWarning.suggestedActions.find(
        a => a.actionType === 'create_task'
      );
      expect(createAction).toBeDefined();
      expect(createAction?.payload).toHaveProperty('extractedDeadlineId');
    });

    it('should include navigate action to review original email', async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      const extractedWarning = warnings[0];
      const navigateAction = extractedWarning.suggestedActions.find(
        a => a.actionType === 'navigate'
      );
      expect(navigateAction).toBeDefined();
      expect(navigateAction?.payload).toHaveProperty('emailId');
    });

    it('should suggest send_reminder action for critical deadlines', async () => {
      const criticalTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(1),
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([criticalTask]);
      (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getUpcomingDeadlineWarnings('user-123', 'firm-456');

      const hasReminderAction = warnings[0].suggestedActions.some(
        a => a.action === 'send_reminder' || a.actionType === 'send_email'
      );
      expect(hasReminderAction).toBe(true);
    });
  });

  // ============================================================================
  // getCaseDeadlineWarnings Tests
  // ============================================================================

  describe('getCaseDeadlineWarnings', () => {
    it('should return warnings for all tasks in a case', async () => {
      const caseTasks = mockTasks.filter(t => t.caseId === 'case-1');
      (prisma.task.findMany as jest.Mock).mockResolvedValue(caseTasks);

      const warnings = await service.getCaseDeadlineWarnings('case-1', 'firm-456');

      expect(warnings.length).toBe(2);
      warnings.forEach(w => {
        expect(w.caseId).toBe('case-1');
      });
    });

    it('should sort case warnings by severity', async () => {
      const caseTasks = [
        { ...mockTasks[2], dueDate: daysFromNow(10), caseId: 'case-1' }, // Info
        { ...mockTasks[0], dueDate: daysFromNow(1), caseId: 'case-1' }, // Critical
        { ...mockTasks[1], dueDate: daysFromNow(5), caseId: 'case-1' }, // Warning
      ];
      (prisma.task.findMany as jest.Mock).mockResolvedValue(caseTasks);

      const warnings = await service.getCaseDeadlineWarnings('case-1', 'firm-456');

      expect(warnings[0].severity).toBe('critical');
      expect(warnings[1].severity).toBe('warning');
      expect(warnings[2].severity).toBe('info');
    });
  });

  // ============================================================================
  // getOverdueDeadlines Tests
  // ============================================================================

  describe('getOverdueDeadlines', () => {
    it('should return only overdue tasks', async () => {
      const overdueTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(-3), // 3 days overdue
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([overdueTask]);

      const warnings = await service.getOverdueDeadlines('user-123', 'firm-456');

      expect(warnings.length).toBe(1);
      expect(warnings[0].daysUntilDue).toBeLessThan(0);
    });

    it('should return empty array when no overdue tasks', async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      const warnings = await service.getOverdueDeadlines('user-123', 'firm-456');

      expect(warnings).toHaveLength(0);
    });

    it('should include case information for overdue tasks', async () => {
      const overdueTask = {
        ...mockTasks[0],
        dueDate: daysFromNow(-1),
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([overdueTask]);

      const warnings = await service.getOverdueDeadlines('user-123', 'firm-456');

      expect(warnings[0].caseId).toBeDefined();
    });
  });

  // ============================================================================
  // getDeadlineStats Tests
  // ============================================================================

  describe('getDeadlineStats', () => {
    it('should return statistics about deadline warnings', async () => {
      const stats = await service.getDeadlineStats('user-123', 'firm-456');

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('critical');
      expect(stats).toHaveProperty('warning');
      expect(stats).toHaveProperty('info');
    });

    it('should count warnings by severity correctly', async () => {
      const mixedTasks = [
        { ...mockTasks[0], dueDate: daysFromNow(1) }, // Critical
        { ...mockTasks[1], dueDate: daysFromNow(2) }, // Critical
        { ...mockTasks[2], dueDate: daysFromNow(5) }, // Warning
      ];
      (prisma.task.findMany as jest.Mock).mockResolvedValue(mixedTasks);
      (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await service.getDeadlineStats('user-123', 'firm-456');

      expect(stats.critical).toBe(2);
      expect(stats.warning).toBe(1);
    });
  });
});
