/**
 * Task Dependencies GraphQL API Integration Tests
 * Story 4.4: Task Dependencies and Automation - Task 36
 */

// Set environment variables
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    taskTemplate: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskTemplateStep: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    templateStepDependency: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    taskTemplateUsage: {
      create: jest.fn(),
      count: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    taskDependency: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    firm: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@legal-platform/database';
import {
  taskTemplateResolvers,
  taskDependencyResolvers,
} from '../../src/graphql/resolvers/task-template.resolvers';
import { taskDependencyResolvers as depResolvers } from '../../src/graphql/resolvers/task-dependency.resolvers';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test data
const testFirm = {
  id: 'firm-123',
  name: 'Test Law Firm',
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
  caseNumber: '123/2024',
  title: 'Test Case',
  firmId: testFirm.id,
  status: 'Active',
};

const mockContext: any = {
  user: testUser,
  req: {} as any,
  res: {} as any,
};

describe('Task Dependencies Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Task Template CRUD Tests
  // ============================================================================

  describe('Task Template Operations', () => {
    it('should create task template successfully', async () => {
      const templateData = {
        id: 'template-123',
        firmId: testFirm.id,
        name: 'Litigation Template',
        description: 'Standard litigation workflow',
        caseType: 'Litigation',
        isDefault: true,
        isActive: true,
        createdBy: testUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
      };

      mockPrisma.taskTemplate.create.mockResolvedValue(templateData as any);

      const result = await taskTemplateResolvers.Mutation.createTaskTemplate(
        {},
        {
          input: {
            name: 'Litigation Template',
            description: 'Standard litigation workflow',
            caseType: 'Litigation',
            isDefault: true,
          },
        },
        mockContext
      );

      expect(result).toEqual(templateData);
      expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
        data: {
          firmId: testFirm.id,
          name: 'Litigation Template',
          description: 'Standard litigation workflow',
          caseType: 'Litigation',
          isDefault: true,
          createdBy: testUser.id,
        },
        include: expect.any(Object),
      });
    });

    it('should get templates filtered by case type', async () => {
      const templates = [
        {
          id: 'template-1',
          firmId: testFirm.id,
          name: 'Litigation Template',
          caseType: 'Litigation',
          steps: [],
        },
      ];

      mockPrisma.taskTemplate.findMany.mockResolvedValue(templates as any);

      const result = await taskTemplateResolvers.Query.taskTemplates(
        {},
        { caseType: 'Litigation' },
        mockContext
      );

      expect(result).toEqual(templates);
      expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirm.id,
            caseType: 'Litigation',
          }),
        })
      );
    });

    it('should delete template with soft delete when used', async () => {
      const existingTemplate = {
        id: 'template-123',
        firmId: testFirm.id,
        name: 'Used Template',
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(existingTemplate as any);
      mockPrisma.taskTemplateUsage.count.mockResolvedValue(5);
      mockPrisma.taskTemplate.update.mockResolvedValue({
        ...existingTemplate,
        isActive: false,
      } as any);

      const result = await taskTemplateResolvers.Mutation.deleteTaskTemplate(
        {},
        { id: 'template-123' },
        mockContext
      );

      expect(result).toBe(true);
      expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: { isActive: false },
      });
      expect(mockPrisma.taskTemplate.delete).not.toHaveBeenCalled();
    });

    it('should reject template operations from different firm', async () => {
      const wrongFirmTemplate = {
        id: 'template-123',
        firmId: 'firm-999',
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(wrongFirmTemplate as any);

      await expect(
        taskTemplateResolvers.Mutation.updateTaskTemplate(
          {},
          {
            id: 'template-123',
            input: { name: 'Updated' },
          },
          mockContext
        )
      ).rejects.toThrow('Template not found or access denied');
    });
  });

  // ============================================================================
  // Template Step Management Tests
  // ============================================================================

  describe('Template Step Operations', () => {
    it('should add step to template', async () => {
      const template = {
        id: 'template-123',
        firmId: testFirm.id,
      };

      const lastStep = {
        id: 'step-1',
        stepOrder: 2,
      };

      const newStep = {
        id: 'step-new',
        templateId: 'template-123',
        stepOrder: 3,
        taskType: 'CourtDate',
        title: 'File Motion',
        offsetDays: 0,
        offsetFrom: 'CaseStart',
        isParallel: false,
        isCriticalPath: true,
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(template as any);
      mockPrisma.taskTemplateStep.findFirst.mockResolvedValue(lastStep as any);
      mockPrisma.taskTemplateStep.create.mockResolvedValue(newStep as any);

      const result = await taskTemplateResolvers.Mutation.addTemplateStep(
        {},
        {
          templateId: 'template-123',
          input: {
            taskType: 'CourtDate',
            title: 'File Motion',
            offsetDays: 0,
            offsetFrom: 'CaseStart',
            isCriticalPath: true,
          },
        },
        mockContext
      );

      expect(result.stepOrder).toBe(3);
      expect(mockPrisma.taskTemplateStep.create).toHaveBeenCalled();
    });

    it('should prevent circular dependencies in steps', async () => {
      const sourceStep = {
        id: 'step-1',
        templateId: 'template-123',
        template: { firmId: testFirm.id },
      };

      const targetStep = {
        id: 'step-2',
        templateId: 'template-123',
        template: { firmId: testFirm.id },
      };

      // Existing dependency: step-1 -> step-2
      const existingDeps = [
        {
          id: 'dep-1',
          sourceStepId: 'step-1',
          targetStepId: 'step-2',
        },
      ];

      mockPrisma.taskTemplateStep.findUnique
        .mockResolvedValueOnce(sourceStep as any)
        .mockResolvedValueOnce(targetStep as any);
      mockPrisma.templateStepDependency.findMany.mockResolvedValue(existingDeps as any);

      // Try to add: step-2 -> step-1 (creates cycle)
      await expect(
        taskTemplateResolvers.Mutation.addStepDependency(
          {},
          {
            sourceStepId: 'step-2',
            targetStepId: 'step-1',
            type: 'FinishToStart',
          },
          mockContext
        )
      ).rejects.toThrow('circular dependency');
    });
  });

  // ============================================================================
  // Task Dependency Tests
  // ============================================================================

  describe('Task Dependency Operations', () => {
    it('should create dependency between tasks', async () => {
      const task1 = {
        id: 'task-1',
        firmId: testFirm.id,
        caseId: testCase.id,
        title: 'Task 1',
        status: 'InProgress',
        case: { id: testCase.id },
      };

      const task2 = {
        id: 'task-2',
        firmId: testFirm.id,
        caseId: testCase.id,
        title: 'Task 2',
        status: 'Pending',
        case: { id: testCase.id },
      };

      const dependency = {
        id: 'dep-123',
        predecessorId: 'task-1',
        successorId: 'task-2',
        dependencyType: 'FinishToStart',
        lagDays: 0,
        predecessor: task1,
        successor: task2,
      };

      mockPrisma.task.findUnique
        .mockResolvedValueOnce(task1 as any)
        .mockResolvedValueOnce(task2 as any);
      mockPrisma.taskDependency.findMany.mockResolvedValue([]);
      mockPrisma.taskDependency.create.mockResolvedValue(dependency as any);
      mockPrisma.task.update.mockResolvedValue(task2 as any);

      const result = await depResolvers.Mutation.addTaskDependency(
        {},
        {
          predecessorId: 'task-1',
          successorId: 'task-2',
          type: 'FinishToStart',
          lagDays: 0,
        },
        mockContext
      );

      expect(result).toEqual(dependency);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: {
          blockedReason: 'Waiting for "Task 1" to be completed',
        },
      });
    });

    it('should prevent dependencies between different cases', async () => {
      const task1 = {
        id: 'task-1',
        firmId: testFirm.id,
        caseId: 'case-1',
        case: { id: 'case-1' },
      };

      const task2 = {
        id: 'task-2',
        firmId: testFirm.id,
        caseId: 'case-2',
        case: { id: 'case-2' },
      };

      mockPrisma.task.findUnique
        .mockResolvedValueOnce(task1 as any)
        .mockResolvedValueOnce(task2 as any);

      await expect(
        depResolvers.Mutation.addTaskDependency(
          {},
          {
            predecessorId: 'task-1',
            successorId: 'task-2',
            type: 'FinishToStart',
          },
          mockContext
        )
      ).rejects.toThrow('different cases');
    });

    it('should enforce firm isolation on dependencies', async () => {
      const task1 = {
        id: 'task-1',
        firmId: 'firm-999',
        caseId: testCase.id,
        case: { id: testCase.id },
      };

      const task2 = {
        id: 'task-2',
        firmId: testFirm.id,
        caseId: testCase.id,
        case: { id: testCase.id },
      };

      mockPrisma.task.findUnique
        .mockResolvedValueOnce(task1 as any)
        .mockResolvedValueOnce(task2 as any);

      await expect(
        depResolvers.Mutation.addTaskDependency(
          {},
          {
            predecessorId: 'task-1',
            successorId: 'task-2',
            type: 'FinishToStart',
          },
          mockContext
        )
      ).rejects.toThrow('Access denied');
    });
  });

  // ============================================================================
  // Critical Path Tests
  // ============================================================================

  describe('Critical Path Calculation', () => {
    it('should calculate critical path for case', async () => {
      const tasks = [
        {
          id: 'task-1',
          title: 'Task 1',
          caseId: testCase.id,
          estimatedHours: 8,
          dueDate: new Date('2025-12-10'),
          status: 'Pending',
          predecessors: [],
          successors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
        },
        {
          id: 'task-2',
          title: 'Task 2',
          caseId: testCase.id,
          estimatedHours: 16,
          dueDate: new Date('2025-12-11'),
          status: 'Pending',
          predecessors: [
            {
              id: 'dep-1',
              predecessorId: 'task-1',
              successorId: 'task-2',
              lagDays: 0,
            },
          ],
          successors: [],
        },
      ];

      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.task.findMany.mockResolvedValue(tasks as any);

      const result = await depResolvers.Query.criticalPath(
        {},
        { caseId: testCase.id },
        mockContext
      );

      expect(result.criticalTasks).toHaveLength(2);
      expect(result.totalDuration).toBe(3); // 1 day + 2 days
      expect(result.caseId).toBe(testCase.id);
    });

    it('should enforce firm isolation on critical path queries', async () => {
      const wrongFirmCase = {
        id: testCase.id,
        firmId: 'firm-999',
      };

      mockPrisma.case.findUnique.mockResolvedValue(wrongFirmCase as any);

      await expect(
        depResolvers.Query.criticalPath({}, { caseId: testCase.id }, mockContext)
      ).rejects.toThrow('access denied');
    });
  });

  // ============================================================================
  // Deadline Cascade Tests
  // ============================================================================

  describe('Deadline Cascade', () => {
    it('should preview deadline cascade without applying', async () => {
      const task = {
        id: 'task-1',
        firmId: testFirm.id,
        caseId: testCase.id,
        title: 'Task 1',
        dueDate: new Date('2025-12-10'),
        successors: [],
      };

      const successor = {
        id: 'task-2',
        title: 'Task 2',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(task as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await depResolvers.Mutation.previewDeadlineCascade(
        {},
        {
          taskId: 'task-1',
          newDueDate: '2025-12-12',
        },
        mockContext
      );

      expect(result.affectedTasks).toHaveLength(1);
      expect(result.affectedTasks[0].taskId).toBe('task-2');
      // Should not actually update tasks
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('should apply deadline cascade with confirmation', async () => {
      const task = {
        id: 'task-1',
        firmId: testFirm.id,
        caseId: testCase.id,
        title: 'Task 1',
        dueDate: new Date('2025-12-10'),
        successors: [],
      };

      const successor = {
        id: 'task-2',
        title: 'Task 2',
        dueDate: new Date('2025-12-15'),
        assignedTo: 'user-1',
        status: 'Pending',
        assignee: { id: 'user-1', name: 'John' },
      };

      mockPrisma.task.findUnique.mockResolvedValue(task as any);
      mockPrisma.taskDependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-2',
            dependencyType: 'FinishToStart',
            lagDays: 0,
            successor,
          },
        ] as any)
        .mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.update
        .mockResolvedValueOnce({ ...task, dueDate: new Date('2025-12-12') } as any)
        .mockResolvedValueOnce({ ...successor, dueDate: new Date('2025-12-12') } as any);

      const result = await depResolvers.Mutation.applyDeadlineCascade(
        {},
        {
          taskId: 'task-1',
          newDueDate: '2025-12-12',
          confirmConflicts: false,
        },
        mockContext
      );

      expect(result).toHaveLength(2);
      expect(mockPrisma.task.update).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Template Application Tests
  // ============================================================================

  describe('Template Application', () => {
    it('should apply template to case', async () => {
      const template = {
        id: 'template-123',
        firmId: testFirm.id,
        name: 'Litigation Template',
        steps: [
          {
            id: 'step-1',
            stepOrder: 1,
            taskType: 'CourtDate',
            title: 'File Motion',
            estimatedHours: 8,
            offsetDays: 0,
            offsetFrom: 'CaseStart',
            isParallel: false,
            isCriticalPath: true,
            dependsOn: [],
          },
        ],
      };

      const createdTask = {
        id: 'task-created',
        caseId: testCase.id,
        title: 'File Motion',
        type: 'CourtDate',
        dueDate: new Date('2025-12-10'),
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(template as any);
      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.task.create.mockResolvedValue(createdTask as any);
      mockPrisma.taskTemplateUsage.create.mockResolvedValue({
        id: 'usage-123',
        templateId: 'template-123',
        caseId: testCase.id,
      } as any);

      const result = await taskTemplateResolvers.Mutation.applyTemplate(
        {},
        {
          input: {
            templateId: 'template-123',
            caseId: testCase.id,
            startDate: '2025-12-10',
          },
        },
        mockContext
      );

      expect(result.createdTasks).toHaveLength(1);
      expect(result.usageId).toBe('usage-123');
      expect(mockPrisma.task.create).toHaveBeenCalled();
    });
  });
});
