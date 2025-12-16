/**
 * OOO Reassignment Service Unit Tests
 * Story 4.5: Team Workload Management
 *
 * Tests for automatic task reassignment when users are out-of-office
 * AC: 5 - Out-of-office automatically reassigns urgent tasks
 */

import { OOOReassignmentService } from './ooo-reassignment.service';
import { WorkloadService } from './workload.service';

// Mock Prisma client
const mockPrisma = {
  userAvailability: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

// Mock WorkloadService
const mockWorkloadService = {
  getAvailableCapacity: jest.fn(),
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

describe('OOOReassignmentService', () => {
  let service: OOOReassignmentService;
  const userId = 'user-123';
  const firmId = 'firm-456';
  const availabilityId = 'avail-789';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OOOReassignmentService(
      mockPrisma as any,
      mockWorkloadService as unknown as WorkloadService
    );
  });

  describe('processOOOReassignments', () => {
    it('should reassign urgent tasks to specified delegate', async () => {
      const delegateId = 'delegate-user';

      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availabilityId,
        userId,
        startDate: new Date('2025-12-15'),
        endDate: new Date('2025-12-20'),
        autoReassign: true,
        delegateTo: delegateId,
        user: { id: userId, firmId },
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Urgent filing',
          dueDate: new Date('2025-12-17'),
          priority: 'Urgent',
          assignedTo: userId,
        },
      ]);

      mockPrisma.task.update.mockResolvedValue({
        id: 'task-1',
        assignedTo: delegateId,
      });

      const result = await service.processOOOReassignments(userId, availabilityId);

      expect(result.tasksReassigned.length).toBe(1);
      expect(result.tasksReassigned[0].newAssignee).toBe(delegateId);
      expect(result.delegateTo).toBe(delegateId);
    });

    it('should not reassign when autoReassign is false', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availabilityId,
        userId,
        startDate: new Date('2025-12-15'),
        endDate: new Date('2025-12-20'),
        autoReassign: false,
        delegateTo: null,
        user: { id: userId, firmId },
      });

      const result = await service.processOOOReassignments(userId, availabilityId);

      expect(result.tasksReassigned.length).toBe(0);
      expect(result.tasksSkipped.length).toBe(0);
      expect(mockPrisma.task.findMany).not.toHaveBeenCalled();
    });

    it('should throw error when availability not found', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue(null);

      await expect(service.processOOOReassignments(userId, availabilityId)).rejects.toThrow(
        'Availability not found'
      );
    });

    it('should throw error when availability belongs to different user', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availabilityId,
        userId: 'other-user',
      });

      await expect(service.processOOOReassignments(userId, availabilityId)).rejects.toThrow(
        'Availability does not belong to this user'
      );
    });

    it('should skip tasks when no suitable delegate available', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availabilityId,
        userId,
        startDate: new Date('2025-12-15'),
        endDate: new Date('2025-12-20'),
        autoReassign: true,
        delegateTo: null,
        user: { id: userId, firmId },
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Urgent filing',
          dueDate: new Date('2025-12-17'),
          priority: 'Urgent',
        },
      ]);

      // No available delegates
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.processOOOReassignments(userId, availabilityId);

      expect(result.tasksSkipped.length).toBe(1);
      expect(result.tasksSkipped[0].reason).toContain('No suitable delegate');
    });
  });

  describe('getUrgentTasksForReassignment', () => {
    it('should only return urgent and high priority tasks', async () => {
      const dateRange = {
        start: new Date('2025-12-15'),
        end: new Date('2025-12-20'),
      };

      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Urgent', priority: 'Urgent' },
        { id: 'task-2', title: 'High', priority: 'High' },
      ]);

      const result = await service.getUrgentTasksForReassignment(userId, dateRange);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: { in: ['Urgent', 'High'] },
          }),
        })
      );
      expect(result.length).toBe(2);
    });

    it('should only return tasks due during OOO period', async () => {
      const dateRange = {
        start: new Date('2025-12-15'),
        end: new Date('2025-12-20'),
      };

      await service.getUrgentTasksForReassignment(userId, dateRange);

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          }),
        })
      );
    });
  });

  describe('selectBestDelegate', () => {
    it('should select delegate with highest available capacity', async () => {
      const task = {
        id: 'task-1',
        type: 'Research',
        estimatedHours: 4,
        dueDate: new Date('2025-12-17'),
      };

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        { id: 'user-2', firstName: 'Jane', lastName: 'Smith' },
      ]);

      mockWorkloadService.getAvailableCapacity
        .mockResolvedValueOnce(2) // user-1
        .mockResolvedValueOnce(6); // user-2

      // Mock that neither user is OOO
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);

      const result = await service.selectBestDelegate(userId, task, firmId);

      expect(result).toBe('user-2'); // Higher capacity
    });

    it('should not select delegate who is also OOO', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe' },
      ]);

      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        availabilityType: 'Vacation',
      });

      const result = await service.selectBestDelegate(userId, null, firmId);

      expect(result).toBeNull();
    });
  });

  describe('reassignTask', () => {
    it('should update task with new assignee', async () => {
      mockPrisma.task.update.mockResolvedValue({
        id: 'task-1',
        title: 'Urgent filing',
        assignedTo: 'new-assignee',
      });

      const result = await service.reassignTask('task-1', 'new-assignee', 'OOO reassignment');

      expect(result.success).toBe(true);
      expect(result.newAssignee).toBe('new-assignee');
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { assignedTo: 'new-assignee' },
      });
    });

    it('should return error on update failure', async () => {
      mockPrisma.task.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.reassignTask('task-1', 'new-assignee', 'OOO reassignment');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
