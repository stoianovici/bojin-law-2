/**
 * Capacity Planning Service Unit Tests
 * Story 4.5: Team Workload Management
 *
 * Tests for capacity forecasting and bottleneck detection
 * AC: 6 - Capacity planning shows future bottlenecks based on deadlines
 */

import { CapacityPlanningService } from './capacity-planning.service';
import { WorkloadService } from './workload.service';

// Mock Prisma client
const mockPrisma = {
  user: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
  userAvailability: {
    findFirst: jest.fn(),
  },
  userWorkloadSettings: {
    findUnique: jest.fn(),
  },
};

// Mock WorkloadService
const mockWorkloadService = {
  calculateDailyWorkload: jest.fn(),
  getUserDailyCapacity: jest.fn(),
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

describe('CapacityPlanningService', () => {
  let service: CapacityPlanningService;
  const firmId = 'firm-123';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CapacityPlanningService(
      mockPrisma as any,
      mockWorkloadService as unknown as WorkloadService
    );
  });

  describe('getForecast', () => {
    it('should return capacity forecast with bottlenecks', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Associate' },
      ]);

      // Mock overloaded day
      mockWorkloadService.calculateDailyWorkload.mockResolvedValue({
        date: new Date(),
        allocatedHours: 12,
        capacityHours: 8,
        utilizationPercent: 150,
        taskCount: 5,
        overloaded: true,
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Urgent filing',
          dueDate: new Date(),
          estimatedHours: 4,
          isCriticalPath: true,
          caseId: 'case-1',
        },
      ]);

      const result = await service.getForecast(firmId, 7);

      expect(result.firmId).toBe(firmId);
      expect(result.bottlenecks).toBeDefined();
      expect(result.teamCapacityByDay).toBeDefined();
      expect(result.overallRisk).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should use default 30 days when not specified', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getForecast(firmId);

      const daysDiff = Math.ceil(
        (result.forecastRange.end.getTime() - result.forecastRange.start.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBe(30);
    });
  });

  describe('identifyBottlenecks', () => {
    const dateRange = {
      start: new Date('2025-12-01'),
      end: new Date('2025-12-07'),
    };

    it('should identify bottlenecks when utilization exceeds 120%', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Associate' },
      ]);

      // Day with 150% utilization
      mockWorkloadService.calculateDailyWorkload.mockResolvedValue({
        date: new Date('2025-12-03'),
        allocatedHours: 12,
        capacityHours: 8,
        utilizationPercent: 150,
        taskCount: 4,
        overloaded: true,
      });

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Critical deadline',
          dueDate: new Date('2025-12-03'),
          estimatedHours: 6,
          isCriticalPath: true,
          caseId: 'case-1',
          case: { title: 'Test Case' },
        },
      ]);

      const result = await service.identifyBottlenecks(firmId, dateRange);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].overageHours).toBeGreaterThan(0);
      expect(result[0].severity).toBeDefined();
    });

    it('should return empty array when no bottlenecks', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Associate' },
      ]);

      // Day with 50% utilization
      mockWorkloadService.calculateDailyWorkload.mockResolvedValue({
        date: new Date('2025-12-03'),
        allocatedHours: 4,
        capacityHours: 8,
        utilizationPercent: 50,
        taskCount: 2,
        overloaded: false,
      });

      const result = await service.identifyBottlenecks(firmId, dateRange);

      expect(result.length).toBe(0);
    });
  });

  describe('getTeamCapacityByDay', () => {
    it('should calculate team capacity for each day', async () => {
      const dateRange = {
        start: new Date('2025-12-01'),
        end: new Date('2025-12-03'),
      };

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);

      mockWorkloadService.getUserDailyCapacity.mockResolvedValue(8);
      mockWorkloadService.calculateDailyWorkload.mockResolvedValue({
        allocatedHours: 4,
        capacityHours: 8,
      });

      const result = await service.getTeamCapacityByDay(firmId, dateRange);

      expect(result.length).toBe(3); // 3 days
      result.forEach((day: { totalCapacity: number; totalAllocated: number }) => {
        expect(day.totalCapacity).toBeDefined();
        expect(day.totalAllocated).toBeDefined();
      });
    });
  });

  describe('calculateOverallRisk', () => {
    it('should return High risk for many critical bottlenecks', () => {
      const bottlenecks = [
        { severity: 'Critical', overageHours: 10 },
        { severity: 'Critical', overageHours: 8 },
        { severity: 'Warning', overageHours: 4 },
      ] as any[];

      const teamCapacity = [
        { totalCapacity: 40, totalAllocated: 50 },
        { totalCapacity: 40, totalAllocated: 48 },
      ];

      const result = service.calculateOverallRisk(bottlenecks, teamCapacity);

      expect(result).toBe('High');
    });

    it('should return Medium risk for some bottlenecks', () => {
      const bottlenecks = [
        { severity: 'Warning', overageHours: 4 },
      ] as any[];

      const teamCapacity = [
        { totalCapacity: 40, totalAllocated: 35 },
        { totalCapacity: 40, totalAllocated: 38 },
      ];

      const result = service.calculateOverallRisk(bottlenecks, teamCapacity);

      expect(result).toBe('Medium');
    });

    it('should return Low risk for no bottlenecks', () => {
      const bottlenecks: any[] = [];
      const teamCapacity = [
        { totalCapacity: 40, totalAllocated: 20 },
        { totalCapacity: 40, totalAllocated: 25 },
      ];

      const result = service.calculateOverallRisk(bottlenecks, teamCapacity);

      expect(result).toBe('Low');
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for bottlenecks', () => {
      const bottlenecks = [
        {
          userId: 'user-1',
          user: { firstName: 'John', lastName: 'Doe' },
          date: new Date('2025-12-03'),
          severity: 'Critical',
          impactedTasks: [{ isCriticalPath: true }],
        },
      ] as any[];

      const teamCapacity = [
        { date: new Date('2025-12-03'), totalCapacity: 40, totalAllocated: 50 },
      ];

      const result = service.generateRecommendations(bottlenecks, teamCapacity);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no issues', () => {
      const result = service.generateRecommendations([], [
        { totalCapacity: 40, totalAllocated: 20 },
      ]);

      expect(result.length).toBe(0);
    });
  });
});
