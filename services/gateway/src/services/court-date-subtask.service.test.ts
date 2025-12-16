/**
 * Court Date Subtask Service Unit Tests
 * Story 4.2: Task Type System Implementation - Task 23
 *
 * Tests for automatic subtask generation for Court Date tasks
 */

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { CourtDateSubtaskService } from './court-date-subtask.service';
import { prisma } from '@legal-platform/database';
import { Task as PrismaTask, TaskTypeEnum, TaskStatus, TaskPriority } from '@prisma/client';

describe('CourtDateSubtaskService', () => {
  let service: CourtDateSubtaskService;

  const mockCourtDateTask: PrismaTask = {
    id: 'task-123',
    firmId: 'firm-123',
    caseId: 'case-123',
    type: TaskTypeEnum.CourtDate,
    title: 'Superior Court Hearing',
    description: 'Motion hearing for summary judgment',
    assignedTo: 'user-123',
    dueDate: new Date('2025-12-31'), // Hearing date
    dueTime: '10:00',
    status: TaskStatus.Pending,
    priority: TaskPriority.High,
    estimatedHours: null,
    typeMetadata: {
      courtName: 'Superior Court',
      caseNumber: 'CV-2025-001',
      hearingType: 'Motion',
    },
    parentTaskId: null,
    parseHistoryId: null,
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CourtDateSubtaskService();
  });

  describe('generatePreparationSubtasks', () => {
    it('should throw error if task is not CourtDate type', async () => {
      const nonCourtDateTask = { ...mockCourtDateTask, type: TaskTypeEnum.Meeting };

      await expect(service.generatePreparationSubtasks(nonCourtDateTask)).rejects.toThrow(
        'Task must be of type CourtDate'
      );
    });

    it('should generate 5 subtasks with correct due dates', async () => {
      const hearingDate = new Date('2025-12-31');
      const task = { ...mockCourtDateTask, dueDate: hearingDate };

      // Mock create to return subtasks
      const mockSubtasks: Partial<PrismaTask>[] = [];
      (prisma.task.create as jest.Mock).mockImplementation((args: any) => {
        const subtask = {
          id: `subtask-${mockSubtasks.length}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        };
        mockSubtasks.push(subtask);
        return Promise.resolve(subtask);
      });

      (prisma.task.update as jest.Mock).mockResolvedValue(task);

      const result = await service.generatePreparationSubtasks(task);

      // Should create 5 subtasks (7, 5, 4, 3, 1 days before)
      expect(result.length).toBe(5);
      expect(prisma.task.create).toHaveBeenCalledTimes(5);

      // Verify due dates are correct
      const expectedDaysBefore = [7, 5, 4, 3, 1];
      result.forEach((subtask, index) => {
        const expectedDate = new Date(hearingDate);
        expectedDate.setDate(expectedDate.getDate() - expectedDaysBefore[index]);

        expect(subtask.dueDate).toEqual(expectedDate);
        expect(subtask.parentTaskId).toBe(task.id);
        expect(subtask.assignedTo).toBe(task.assignedTo);
        expect(subtask.priority).toBe(TaskPriority.High);
      });
    });

    it('should skip subtasks with past due dates', async () => {
      // Hearing is 3 days from now
      const nearFutureDate = new Date();
      nearFutureDate.setDate(nearFutureDate.getDate() + 3);

      const task = { ...mockCourtDateTask, dueDate: nearFutureDate };

      const mockSubtasks: Partial<PrismaTask>[] = [];
      (prisma.task.create as jest.Mock).mockImplementation((args: any) => {
        const subtask = {
          id: `subtask-${mockSubtasks.length}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        };
        mockSubtasks.push(subtask);
        return Promise.resolve(subtask);
      });

      (prisma.task.update as jest.Mock).mockResolvedValue(task);

      const result = await service.generatePreparationSubtasks(task);

      // Should only create subtasks for 3 days and 1 day before
      // (7, 5, 4 days would be in the past)
      expect(result.length).toBeLessThanOrEqual(2);

      // Verify all created subtasks have future due dates
      result.forEach((subtask) => {
        expect(subtask.dueDate.getTime()).toBeGreaterThanOrEqual(new Date().getTime());
      });
    });

    it('should replace {hearingType} placeholder in titles', async () => {
      const task = {
        ...mockCourtDateTask,
        typeMetadata: {
          courtName: 'Superior Court',
          caseNumber: 'CV-2025-001',
          hearingType: 'Trial',
        },
      };

      (prisma.task.create as jest.Mock).mockImplementation((args: any) => {
        return Promise.resolve({
          id: `subtask-${Date.now()}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        });
      });

      (prisma.task.update as jest.Mock).mockResolvedValue(task);

      const result = await service.generatePreparationSubtasks(task);

      // Check that some titles include "Trial" (the ones with {hearingType} placeholder)
      const titlesWithHearingType = result.filter((s) => s.title.includes('Trial'));
      expect(titlesWithHearingType.length).toBeGreaterThan(0);

      // Ensure no titles have the placeholder
      result.forEach((subtask) => {
        expect(subtask.title).not.toContain('{hearingType}');
      });
    });

    it('should update parent task metadata with subtask IDs', async () => {
      const task = { ...mockCourtDateTask };

      const subtaskIds = ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5'];
      let createCallCount = 0;
      (prisma.task.create as jest.Mock).mockImplementation((args: any) => {
        return Promise.resolve({
          id: subtaskIds[createCallCount++],
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        });
      });

      (prisma.task.update as jest.Mock).mockImplementation((args: any) => {
        return Promise.resolve(task);
      });

      await service.generatePreparationSubtasks(task);

      // Verify update was called with subtask IDs in metadata
      expect(prisma.task.update).toHaveBeenCalled();
      const updateCall = (prisma.task.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.where.id).toBe(task.id);
      expect(updateCall.data.typeMetadata.preparationSubtaskIds).toHaveLength(5);
    });

    it('should handle missing hearingType gracefully', async () => {
      const task = {
        ...mockCourtDateTask,
        typeMetadata: {
          courtName: 'Superior Court',
          caseNumber: 'CV-2025-001',
          // hearingType is missing
        },
      };

      (prisma.task.create as jest.Mock).mockImplementation((args: any) => {
        return Promise.resolve({
          id: `subtask-${Date.now()}`,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        });
      });

      (prisma.task.update as jest.Mock).mockResolvedValue(task);

      const result = await service.generatePreparationSubtasks(task);

      // Should use default "hearing" when hearingType is missing (in templates with {hearingType})
      const titlesWithHearingType = result.filter(
        (s) =>
          s.title.includes('hearing') ||
          s.title.includes('Confirm witness') ||
          s.title.includes('Final preparation')
      );
      expect(titlesWithHearingType.length).toBeGreaterThan(0);
    });
  });

  describe('hasGeneratedSubtasks', () => {
    it('should return true if preparationSubtaskIds exists in metadata', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        typeMetadata: {
          preparationSubtaskIds: ['sub-1', 'sub-2'],
        },
      });

      const result = await service.hasGeneratedSubtasks('task-123');

      expect(result).toBe(true);
    });

    it('should return false if preparationSubtaskIds does not exist', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        typeMetadata: {
          courtName: 'Court',
          // No preparationSubtaskIds
        },
      });

      const result = await service.hasGeneratedSubtasks('task-123');

      expect(result).toBe(false);
    });

    it('should return false if task not found', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.hasGeneratedSubtasks('nonexistent-task');

      expect(result).toBe(false);
    });
  });
});
