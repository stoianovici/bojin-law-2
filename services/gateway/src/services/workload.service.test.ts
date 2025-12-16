/**
 * Workload Service Unit Tests
 * Story 4.5: Team Workload Management
 *
 * Tests for workload calculations, daily workload, and capacity metrics
 * AC: 2 - Workload meter displays hours allocated per person per day
 */

import { WorkloadService } from './workload.service';

// Mock Prisma client
const mockPrisma = {
  task: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  userAvailability: {
    findFirst: jest.fn(),
  },
  userWorkloadSettings: {
    findUnique: jest.fn(),
  },
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

describe('WorkloadService', () => {
  let service: WorkloadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkloadService(mockPrisma as any);
  });

  describe('calculateDailyWorkload', () => {
    const mockDate = new Date('2025-12-01');
    const userId = 'user-123';

    it('should calculate correct workload metrics for a day with tasks', async () => {
      // Mock tasks for the day
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'task-1', estimatedHours: 2.0 },
        { id: 'task-2', estimatedHours: 3.0 },
        { id: 'task-3', estimatedHours: 1.5 },
      ]);

      // Mock no availability override
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);

      // Mock workload settings (8 hours capacity)
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        overloadThreshold: 1.2,
      });

      const result = await service.calculateDailyWorkload(userId, mockDate);

      expect(result.allocatedHours).toBe(6.5); // 2 + 3 + 1.5
      expect(result.capacityHours).toBe(8);
      expect(result.utilizationPercent).toBeCloseTo(81.25); // 6.5/8 * 100
      expect(result.taskCount).toBe(3);
      expect(result.overloaded).toBe(false); // 81.25% < 120%
    });

    it('should detect overloaded status when utilization exceeds threshold', async () => {
      // Mock overloaded day
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'task-1', estimatedHours: 5.0 },
        { id: 'task-2', estimatedHours: 6.0 },
      ]);

      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5],
        overloadThreshold: 1.2,
      });

      const result = await service.calculateDailyWorkload(userId, mockDate);

      expect(result.allocatedHours).toBe(11); // 5 + 6
      expect(result.capacityHours).toBe(8);
      expect(result.utilizationPercent).toBeCloseTo(137.5); // 11/8 * 100
      expect(result.overloaded).toBe(true); // 137.5% > 120%
    });

    it('should return zero capacity for OOO day', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1', estimatedHours: 4.0 }]);

      // User is out of office
      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        availabilityType: 'Vacation',
        hoursPerDay: null,
      });

      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5],
        overloadThreshold: 1.2,
      });

      const result = await service.calculateDailyWorkload(userId, mockDate);

      expect(result.capacityHours).toBe(0);
      expect(result.utilizationPercent).toBe(0);
    });

    it('should use reduced hours from availability override', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1', estimatedHours: 3.0 }]);

      // User has reduced hours
      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        availabilityType: 'ReducedHours',
        hoursPerDay: 4.0,
      });

      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue(null);

      const result = await service.calculateDailyWorkload(userId, mockDate);

      expect(result.capacityHours).toBe(4);
      expect(result.utilizationPercent).toBeCloseTo(75); // 3/4 * 100
    });

    it('should default to 8 hours for weekdays with no settings', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue(null);

      const weekday = new Date('2025-12-01'); // Monday
      const result = await service.calculateDailyWorkload(userId, weekday);

      expect(result.capacityHours).toBe(8);
    });

    it('should return zero capacity for weekends with no settings', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue(null);

      const saturday = new Date('2025-11-29'); // Saturday
      const result = await service.calculateDailyWorkload(userId, saturday);

      expect(result.capacityHours).toBe(0);
    });
  });

  describe('getWorkloadStatus', () => {
    it('should return UnderUtilized for < 50%', () => {
      expect(service.getWorkloadStatus(30)).toBe('UnderUtilized');
      expect(service.getWorkloadStatus(49)).toBe('UnderUtilized');
    });

    it('should return Optimal for 50-80%', () => {
      expect(service.getWorkloadStatus(50)).toBe('Optimal');
      expect(service.getWorkloadStatus(70)).toBe('Optimal');
      expect(service.getWorkloadStatus(80)).toBe('Optimal');
    });

    it('should return NearCapacity for 81-100%', () => {
      expect(service.getWorkloadStatus(81)).toBe('NearCapacity');
      expect(service.getWorkloadStatus(90)).toBe('NearCapacity');
      expect(service.getWorkloadStatus(100)).toBe('NearCapacity');
    });

    it('should return Overloaded for > 100%', () => {
      expect(service.getWorkloadStatus(101)).toBe('Overloaded');
      expect(service.getWorkloadStatus(150)).toBe('Overloaded');
    });
  });

  describe('getCurrentWorkload', () => {
    it('should sum estimated hours from active tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { estimatedHours: 2.5 },
        { estimatedHours: 4.0 },
        { estimatedHours: 1.5 },
        { estimatedHours: null }, // Task without estimate
      ]);

      const result = await service.getCurrentWorkload('user-123');

      expect(result).toBe(8.0); // 2.5 + 4 + 1.5 + 0
    });

    it('should return 0 for user with no active tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      const result = await service.getCurrentWorkload('user-123');

      expect(result).toBe(0);
    });
  });

  describe('getUserDailyCapacity', () => {
    const userId = 'user-123';

    it('should return 0 for vacation days', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        availabilityType: 'Vacation',
      });

      const result = await service.getUserDailyCapacity(userId, new Date());

      expect(result).toBe(0);
    });

    it('should return custom hours for reduced hours', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        availabilityType: 'ReducedHours',
        hoursPerDay: 4,
      });

      const result = await service.getUserDailyCapacity(userId, new Date());

      expect(result).toBe(4);
    });

    it('should use workload settings when no availability override', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 6,
        workingDays: [1, 2, 3, 4, 5],
      });

      const monday = new Date('2025-12-01'); // Monday
      const result = await service.getUserDailyCapacity(userId, monday);

      expect(result).toBe(6);
    });

    it('should return 0 for non-working days', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri only
      });

      const saturday = new Date('2025-11-29'); // Saturday (day 6)
      const result = await service.getUserDailyCapacity(userId, saturday);

      expect(result).toBe(0);
    });
  });

  describe('getAvailableCapacity', () => {
    it('should calculate available capacity correctly', async () => {
      // Mock daily workload
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1', estimatedHours: 3.0 }]);
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5],
        overloadThreshold: 1.2,
      });

      const result = await service.getAvailableCapacity('user-123', new Date('2025-12-01'));

      expect(result).toBe(5); // 8 - 3
    });

    it('should return 0 when overloaded', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1', estimatedHours: 10.0 }]);
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5],
        overloadThreshold: 1.2,
      });

      const result = await service.getAvailableCapacity('user-123', new Date('2025-12-01'));

      expect(result).toBe(0); // max(0, 8 - 10) = 0
    });
  });

  describe('calculateUserWorkload', () => {
    it('should calculate weekly workload correctly', async () => {
      const userId = 'user-123';
      const dateRange = {
        start: new Date('2025-12-01'),
        end: new Date('2025-12-05'), // 5 days
      };

      // Mock user info
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Associate',
      });

      // Mock same data for each day
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1', estimatedHours: 4.0 }]);
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5],
        overloadThreshold: 1.2,
      });

      const result = await service.calculateUserWorkload(userId, dateRange);

      expect(result.userId).toBe(userId);
      expect(result.user.firstName).toBe('John');
      expect(result.dailyWorkloads.length).toBe(5);
      expect(result.status).toBe('Optimal'); // ~50% utilization
    });

    it('should throw error for unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateUserWorkload('unknown-user', {
          start: new Date(),
          end: new Date(),
        })
      ).rejects.toThrow('User not found');
    });
  });

  describe('getTeamWorkloadSummary', () => {
    it('should aggregate team workload correctly', async () => {
      const firmId = 'firm-123';
      const dateRange = {
        start: new Date('2025-12-01'),
        end: new Date('2025-12-01'),
      };

      // Mock team members
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);

      // Mock user info for each
      mockPrisma.user.findUnique.mockImplementation(({ where }: any) => {
        return Promise.resolve({
          id: where.id,
          firstName: 'Test',
          lastName: 'User',
          role: 'Associate',
        });
      });

      // Mock workload data
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1', estimatedHours: 4.0 }]);
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.userWorkloadSettings.findUnique.mockResolvedValue({
        dailyCapacityHours: 8,
        workingDays: [1, 2, 3, 4, 5],
        overloadThreshold: 1.2,
      });

      const result = await service.getTeamWorkloadSummary(firmId, dateRange);

      expect(result.firmId).toBe(firmId);
      expect(result.members.length).toBe(2);
      expect(result.teamAverageUtilization).toBeGreaterThan(0);
    });
  });
});
