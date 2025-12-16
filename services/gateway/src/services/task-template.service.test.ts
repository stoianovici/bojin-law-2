/**
 * Task Template Service Unit Tests
 * Story 4.4: Task Dependencies and Automation - Task 32
 *
 * Tests for task template CRUD operations, step management, dependency validation, and firm isolation
 */

import { PrismaClient } from '@legal-platform/database';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplates,
  duplicateTemplate,
  addStep,
  updateStep,
  removeStep,
  reorderSteps,
  addStepDependency,
  removeStepDependency,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type CreateStepInput,
  type UpdateStepInput,
} from './task-template.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  PrismaClient: jest.fn(),
}));

describe('TaskTemplateService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
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
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    } as any;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Template CRUD Tests
  // ============================================================================

  describe('createTemplate', () => {
    const mockInput: CreateTemplateInput = {
      name: 'Litigation Template',
      description: 'Standard litigation workflow',
      caseType: 'Litigation',
      isDefault: true,
    };

    it('should create template with all fields', async () => {
      const mockTemplate = {
        id: 'template-123',
        firmId: 'firm-123',
        name: mockInput.name,
        description: mockInput.description,
        caseType: mockInput.caseType,
        isDefault: true,
        isActive: true,
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
      };

      mockPrisma.taskTemplate.create.mockResolvedValue(mockTemplate as any);

      const result = await createTemplate(mockInput, 'user-123', 'firm-123');

      expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
        data: {
          firmId: 'firm-123',
          name: mockInput.name,
          description: mockInput.description,
          caseType: mockInput.caseType,
          isDefault: true,
          createdBy: 'user-123',
        },
        include: {
          steps: {
            include: {
              dependsOn: true,
              dependents: true,
            },
            orderBy: {
              stepOrder: 'asc',
            },
          },
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should default isDefault to false if not provided', async () => {
      const inputWithoutDefault = {
        name: 'Custom Template',
      };

      const mockTemplate = {
        id: 'template-124',
        firmId: 'firm-123',
        name: inputWithoutDefault.name,
        isDefault: false,
        isActive: true,
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
      };

      mockPrisma.taskTemplate.create.mockResolvedValue(mockTemplate as any);

      await createTemplate(inputWithoutDefault, 'user-123', 'firm-123');

      expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: false,
          }),
        })
      );
    });
  });

  describe('updateTemplate', () => {
    const mockInput: UpdateTemplateInput = {
      name: 'Updated Litigation Template',
      description: 'Updated description',
      isActive: false,
    };

    it('should update template when firm matches', async () => {
      const existingTemplate = {
        id: 'template-123',
        firmId: 'firm-123',
        name: 'Old Name',
      };

      const updatedTemplate = {
        ...existingTemplate,
        ...mockInput,
        updatedAt: new Date(),
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(existingTemplate as any);
      mockPrisma.taskTemplate.update.mockResolvedValue(updatedTemplate as any);

      const result = await updateTemplate('template-123', mockInput, 'user-123', 'firm-123');

      expect(mockPrisma.taskTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });
      expect(mockPrisma.taskTemplate.update).toHaveBeenCalled();
      expect(result.name).toBe(mockInput.name);
    });

    it('should throw error when template not found', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(null);

      await expect(
        updateTemplate('template-999', mockInput, 'user-123', 'firm-123')
      ).rejects.toThrow('Template not found or access denied');
    });

    it('should throw error when firm does not match (firm isolation)', async () => {
      const existingTemplate = {
        id: 'template-123',
        firmId: 'firm-999',
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(existingTemplate as any);

      await expect(
        updateTemplate('template-123', mockInput, 'user-123', 'firm-123')
      ).rejects.toThrow('Template not found or access denied');
    });
  });

  describe('deleteTemplate', () => {
    it('should hard delete template when never used', async () => {
      const existingTemplate = {
        id: 'template-123',
        firmId: 'firm-123',
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(existingTemplate as any);
      mockPrisma.taskTemplateUsage.count.mockResolvedValue(0);
      mockPrisma.taskTemplate.delete.mockResolvedValue(existingTemplate as any);

      await deleteTemplate('template-123', 'user-123', 'firm-123');

      expect(mockPrisma.taskTemplateUsage.count).toHaveBeenCalledWith({
        where: { templateId: 'template-123' },
      });
      expect(mockPrisma.taskTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });
      expect(mockPrisma.taskTemplate.update).not.toHaveBeenCalled();
    });

    it('should soft delete template when previously used', async () => {
      const existingTemplate = {
        id: 'template-123',
        firmId: 'firm-123',
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(existingTemplate as any);
      mockPrisma.taskTemplateUsage.count.mockResolvedValue(5);
      mockPrisma.taskTemplate.update.mockResolvedValue({
        ...existingTemplate,
        isActive: false,
      } as any);

      await deleteTemplate('template-123', 'user-123', 'firm-123');

      expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: { isActive: false },
      });
      expect(mockPrisma.taskTemplate.delete).not.toHaveBeenCalled();
    });

    it('should throw error when firm does not match', async () => {
      const existingTemplate = {
        id: 'template-123',
        firmId: 'firm-999',
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(existingTemplate as any);

      await expect(deleteTemplate('template-123', 'user-123', 'firm-123')).rejects.toThrow(
        'Template not found or access denied'
      );
    });
  });

  describe('getTemplateById', () => {
    it('should return template when found and firm matches', async () => {
      const mockTemplate = {
        id: 'template-123',
        firmId: 'firm-123',
        name: 'Litigation Template',
        steps: [],
      };

      mockPrisma.taskTemplate.findFirst.mockResolvedValue(mockTemplate as any);

      const result = await getTemplateById('template-123', 'firm-123');

      expect(mockPrisma.taskTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'template-123',
          firmId: 'firm-123',
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should return null when template not found', async () => {
      mockPrisma.taskTemplate.findFirst.mockResolvedValue(null);

      const result = await getTemplateById('template-999', 'firm-123');

      expect(result).toBeNull();
    });
  });

  describe('getTemplates', () => {
    it('should return all templates for firm', async () => {
      const mockTemplates = [
        { id: 'template-1', firmId: 'firm-123', name: 'Template 1', steps: [] },
        { id: 'template-2', firmId: 'firm-123', name: 'Template 2', steps: [] },
      ];

      mockPrisma.taskTemplate.findMany.mockResolvedValue(mockTemplates as any);

      const result = await getTemplates('firm-123');

      expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith({
        where: {
          firmId: 'firm-123',
        },
        include: expect.any(Object),
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
      expect(result).toEqual(mockTemplates);
    });

    it('should filter by caseType when provided', async () => {
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);

      await getTemplates('firm-123', { caseType: 'Litigation' });

      expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseType: 'Litigation',
          }),
        })
      );
    });

    it('should filter by active status when activeOnly is true', async () => {
      mockPrisma.taskTemplate.findMany.mockResolvedValue([]);

      await getTemplates('firm-123', { activeOnly: true });

      expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      );
    });
  });

  describe('duplicateTemplate', () => {
    it('should duplicate template with steps and dependencies', async () => {
      const originalTemplate = {
        id: 'template-123',
        firmId: 'firm-123',
        name: 'Original Template',
        description: 'Original description',
        caseType: 'Litigation',
        steps: [
          {
            id: 'step-1',
            stepOrder: 1,
            taskType: 'CourtDate',
            title: 'File Motion',
            estimatedHours: 5,
            offsetDays: 0,
            offsetFrom: 'CaseStart',
            isParallel: false,
            isCriticalPath: true,
            dependsOn: [],
          },
          {
            id: 'step-2',
            stepOrder: 2,
            taskType: 'CourtDate',
            title: 'Hearing',
            estimatedHours: 3,
            offsetDays: 14,
            offsetFrom: 'PreviousTask',
            isParallel: false,
            isCriticalPath: true,
            dependsOn: [
              {
                id: 'dep-1',
                sourceStepId: 'step-1',
                targetStepId: 'step-2',
                dependencyType: 'FinishToStart',
                lagDays: 0,
              },
            ],
          },
        ],
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(originalTemplate as any);

      const newTemplate = {
        id: 'template-456',
        firmId: 'firm-123',
        name: 'Duplicated Template',
        steps: [],
      };

      const newStep1 = { id: 'step-new-1', templateId: 'template-456' };
      const newStep2 = { id: 'step-new-2', templateId: 'template-456' };

      mockPrisma.taskTemplate.create.mockResolvedValue(newTemplate as any);
      mockPrisma.taskTemplateStep.create
        .mockResolvedValueOnce(newStep1 as any)
        .mockResolvedValueOnce(newStep2 as any);
      mockPrisma.templateStepDependency.create.mockResolvedValue({} as any);
      mockPrisma.taskTemplate.findUniqueOrThrow.mockResolvedValue({
        ...newTemplate,
        steps: [newStep1, newStep2],
      } as any);

      const result = await duplicateTemplate(
        'template-123',
        'Duplicated Template',
        'user-123',
        'firm-123'
      );

      expect(mockPrisma.taskTemplate.create).toHaveBeenCalled();
      expect(mockPrisma.taskTemplateStep.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.templateStepDependency.create).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Duplicated Template');
    });

    it('should throw error when original template not found', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(null);

      await expect(
        duplicateTemplate('template-999', 'New Name', 'user-123', 'firm-123')
      ).rejects.toThrow('Template not found or access denied');
    });

    it('should throw error when firm does not match', async () => {
      const originalTemplate = {
        id: 'template-123',
        firmId: 'firm-999',
        steps: [],
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(originalTemplate as any);

      await expect(
        duplicateTemplate('template-123', 'New Name', 'user-123', 'firm-123')
      ).rejects.toThrow('Template not found or access denied');
    });
  });

  // ============================================================================
  // Step Management Tests
  // ============================================================================

  describe('addStep', () => {
    const mockInput: CreateStepInput = {
      taskType: 'CourtDate',
      title: 'File Motion',
      description: 'File initial motion',
      estimatedHours: 5,
      offsetDays: 0,
      offsetFrom: 'CaseStart',
      isParallel: false,
      isCriticalPath: true,
    };

    it('should add step to template', async () => {
      const mockTemplate = { id: 'template-123', firmId: 'firm-123' };
      const mockLastStep = { id: 'step-1', stepOrder: 3 };
      const mockNewStep = {
        id: 'step-new',
        templateId: 'template-123',
        stepOrder: 4,
        ...mockInput,
      };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(mockTemplate as any);
      mockPrisma.taskTemplateStep.findFirst.mockResolvedValue(mockLastStep as any);
      mockPrisma.taskTemplateStep.create.mockResolvedValue(mockNewStep as any);

      const result = await addStep('template-123', mockInput, 'firm-123');

      expect(mockPrisma.taskTemplateStep.create).toHaveBeenCalledWith({
        data: {
          templateId: 'template-123',
          stepOrder: 4,
          taskType: mockInput.taskType,
          title: mockInput.title,
          description: mockInput.description,
          estimatedHours: mockInput.estimatedHours,
          typeMetadata: undefined,
          offsetDays: mockInput.offsetDays,
          offsetFrom: mockInput.offsetFrom,
          isParallel: false,
          isCriticalPath: true,
        },
        include: {
          dependsOn: true,
          dependents: true,
        },
      });
      expect(result.stepOrder).toBe(4);
    });

    it('should add step with stepOrder 1 when no existing steps', async () => {
      const mockTemplate = { id: 'template-123', firmId: 'firm-123' };

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(mockTemplate as any);
      mockPrisma.taskTemplateStep.findFirst.mockResolvedValue(null);
      mockPrisma.taskTemplateStep.create.mockResolvedValue({ stepOrder: 1 } as any);

      await addStep('template-123', mockInput, 'firm-123');

      expect(mockPrisma.taskTemplateStep.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stepOrder: 1,
          }),
        })
      );
    });

    it('should throw error when template not found', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(null);

      await expect(addStep('template-999', mockInput, 'firm-123')).rejects.toThrow(
        'Template not found or access denied'
      );
    });
  });

  describe('updateStep', () => {
    const mockInput: UpdateStepInput = {
      title: 'Updated Title',
      estimatedHours: 10,
    };

    it('should update step when firm matches', async () => {
      const existingStep = {
        id: 'step-123',
        templateId: 'template-123',
        template: {
          id: 'template-123',
          firmId: 'firm-123',
        },
      };

      const updatedStep = {
        ...existingStep,
        ...mockInput,
      };

      mockPrisma.taskTemplateStep.findUnique.mockResolvedValue(existingStep as any);
      mockPrisma.taskTemplateStep.update.mockResolvedValue(updatedStep as any);

      const result = await updateStep('step-123', mockInput, 'firm-123');

      expect(mockPrisma.taskTemplateStep.update).toHaveBeenCalled();
      expect(result.title).toBe(mockInput.title);
    });

    it('should throw error when step not found', async () => {
      mockPrisma.taskTemplateStep.findUnique.mockResolvedValue(null);

      await expect(updateStep('step-999', mockInput, 'firm-123')).rejects.toThrow(
        'Step not found or access denied'
      );
    });

    it('should throw error when firm does not match', async () => {
      const existingStep = {
        id: 'step-123',
        template: {
          firmId: 'firm-999',
        },
      };

      mockPrisma.taskTemplateStep.findUnique.mockResolvedValue(existingStep as any);

      await expect(updateStep('step-123', mockInput, 'firm-123')).rejects.toThrow(
        'Step not found or access denied'
      );
    });
  });

  describe('removeStep', () => {
    it('should remove step and reorder remaining steps', async () => {
      const existingStep = {
        id: 'step-2',
        templateId: 'template-123',
        stepOrder: 2,
        template: {
          firmId: 'firm-123',
        },
      };

      const remainingSteps = [
        { id: 'step-1', stepOrder: 1 },
        { id: 'step-3', stepOrder: 3 },
      ];

      mockPrisma.taskTemplateStep.findUnique.mockResolvedValue(existingStep as any);
      mockPrisma.taskTemplateStep.delete.mockResolvedValue(existingStep as any);
      mockPrisma.taskTemplateStep.findMany.mockResolvedValue(remainingSteps as any);
      mockPrisma.taskTemplateStep.update.mockResolvedValue({} as any);

      await removeStep('step-2', 'firm-123');

      expect(mockPrisma.taskTemplateStep.delete).toHaveBeenCalledWith({
        where: { id: 'step-2' },
      });
      expect(mockPrisma.taskTemplateStep.update).toHaveBeenCalledTimes(2);
    });

    it('should throw error when step not found', async () => {
      mockPrisma.taskTemplateStep.findUnique.mockResolvedValue(null);

      await expect(removeStep('step-999', 'firm-123')).rejects.toThrow(
        'Step not found or access denied'
      );
    });
  });

  describe('reorderSteps', () => {
    it('should reorder steps according to provided order', async () => {
      const mockTemplate = { id: 'template-123', firmId: 'firm-123' };
      const stepIds = ['step-3', 'step-1', 'step-2'];

      mockPrisma.taskTemplate.findUnique.mockResolvedValue(mockTemplate as any);
      mockPrisma.taskTemplateStep.update.mockResolvedValue({} as any);
      mockPrisma.taskTemplateStep.findMany.mockResolvedValue([]);

      await reorderSteps('template-123', stepIds, 'firm-123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.taskTemplateStep.findMany).toHaveBeenCalledWith({
        where: { templateId: 'template-123' },
        include: expect.any(Object),
        orderBy: { stepOrder: 'asc' },
      });
    });

    it('should throw error when template not found', async () => {
      mockPrisma.taskTemplate.findUnique.mockResolvedValue(null);

      await expect(reorderSteps('template-999', [], 'firm-123')).rejects.toThrow(
        'Template not found or access denied'
      );
    });
  });

  // ============================================================================
  // Dependency Management Tests
  // ============================================================================

  describe('addStepDependency', () => {
    it('should add dependency when no cycle is created', async () => {
      const sourceStep = {
        id: 'step-1',
        templateId: 'template-123',
        template: { firmId: 'firm-123' },
      };

      const targetStep = {
        id: 'step-2',
        templateId: 'template-123',
        template: { firmId: 'firm-123' },
      };

      const mockDependency = {
        id: 'dep-123',
        sourceStepId: 'step-1',
        targetStepId: 'step-2',
        dependencyType: 'FinishToStart',
        lagDays: 0,
      };

      mockPrisma.taskTemplateStep.findUnique
        .mockResolvedValueOnce(sourceStep as any)
        .mockResolvedValueOnce(targetStep as any);
      mockPrisma.templateStepDependency.findMany.mockResolvedValue([]);
      mockPrisma.templateStepDependency.create.mockResolvedValue(mockDependency as any);

      const result = await addStepDependency('step-1', 'step-2', 'FinishToStart', 0, 'firm-123');

      expect(mockPrisma.templateStepDependency.create).toHaveBeenCalledWith({
        data: {
          sourceStepId: 'step-1',
          targetStepId: 'step-2',
          dependencyType: 'FinishToStart',
          lagDays: 0,
        },
      });
      expect(result).toEqual(mockDependency);
    });

    it('should throw error when steps belong to different templates', async () => {
      const sourceStep = {
        id: 'step-1',
        templateId: 'template-123',
        template: { firmId: 'firm-123' },
      };

      const targetStep = {
        id: 'step-2',
        templateId: 'template-456',
        template: { firmId: 'firm-123' },
      };

      mockPrisma.taskTemplateStep.findUnique
        .mockResolvedValueOnce(sourceStep as any)
        .mockResolvedValueOnce(targetStep as any);

      await expect(
        addStepDependency('step-1', 'step-2', 'FinishToStart', 0, 'firm-123')
      ).rejects.toThrow('Steps not found or belong to different templates');
    });

    it('should throw error when adding dependency would create cycle', async () => {
      const sourceStep = {
        id: 'step-2',
        templateId: 'template-123',
        template: { firmId: 'firm-123' },
      };

      const targetStep = {
        id: 'step-1',
        templateId: 'template-123',
        template: { firmId: 'firm-123' },
      };

      // Existing dependency: step-1 -> step-2
      const existingDependencies = [
        {
          id: 'dep-1',
          sourceStepId: 'step-1',
          targetStepId: 'step-2',
          dependencyType: 'FinishToStart',
        },
      ];

      mockPrisma.taskTemplateStep.findUnique
        .mockResolvedValueOnce(sourceStep as any)
        .mockResolvedValueOnce(targetStep as any);
      mockPrisma.templateStepDependency.findMany.mockResolvedValue(existingDependencies as any);

      // Trying to add: step-2 -> step-1 (creates cycle)
      await expect(
        addStepDependency('step-2', 'step-1', 'FinishToStart', 0, 'firm-123')
      ).rejects.toThrow('Adding this dependency would create a circular dependency');
    });
  });

  describe('removeStepDependency', () => {
    it('should remove dependency when firm matches', async () => {
      const mockDependency = {
        id: 'dep-123',
        sourceStepId: 'step-1',
        targetStepId: 'step-2',
        sourceStep: {
          id: 'step-1',
          template: {
            firmId: 'firm-123',
          },
        },
      };

      mockPrisma.templateStepDependency.findUnique.mockResolvedValue(mockDependency as any);
      mockPrisma.templateStepDependency.delete.mockResolvedValue(mockDependency as any);

      await removeStepDependency('dep-123', 'firm-123');

      expect(mockPrisma.templateStepDependency.delete).toHaveBeenCalledWith({
        where: { id: 'dep-123' },
      });
    });

    it('should throw error when dependency not found', async () => {
      mockPrisma.templateStepDependency.findUnique.mockResolvedValue(null);

      await expect(removeStepDependency('dep-999', 'firm-123')).rejects.toThrow(
        'Dependency not found or access denied'
      );
    });

    it('should throw error when firm does not match', async () => {
      const mockDependency = {
        id: 'dep-123',
        sourceStep: {
          template: {
            firmId: 'firm-999',
          },
        },
      };

      mockPrisma.templateStepDependency.findUnique.mockResolvedValue(mockDependency as any);

      await expect(removeStepDependency('dep-123', 'firm-123')).rejects.toThrow(
        'Dependency not found or access denied'
      );
    });
  });
});
