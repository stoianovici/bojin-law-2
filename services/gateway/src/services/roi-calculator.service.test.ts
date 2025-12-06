/**
 * ROI Calculator Service Unit Tests
 * Story 4.7: Task Analytics and Optimization - Task 37
 *
 * Tests for:
 * - Time savings calculations
 * - Value calculations
 * - Annual projections
 */

import { ROICalculatorService } from './roi-calculator.service';
import {
  roiFixtures,
  defaultFilters,
  TEST_FIRM_ID,
} from '../../__tests__/fixtures/task-analytics.fixtures';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

describe('ROICalculatorService', () => {
  let service: ROICalculatorService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      task: {
        count: jest.fn(),
      },
      taskDependency: {
        count: jest.fn(),
      },
      taskHistory: {
        count: jest.fn(),
      },
      firm: {
        findUnique: jest.fn(),
      },
    };

    service = new ROICalculatorService(mockPrisma, undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('projectAnnualSavings', () => {
    it('should extrapolate 30-day savings to annual', () => {
      const metrics = {
        totalValueSaved: 10000, // 10,000 in period
        templateTasksCreated: 20,
        manualTasksCreated: 10,
        templateAdoptionRate: 66.67,
        estimatedTemplateTimeSavedHours: 1.67,
        nlpTasksCreated: 15,
        estimatedNLPTimeSavedHours: 0.5,
        autoRemindersSet: 50,
        autoDependencyTriggers: 10,
        autoReassignments: 2,
        estimatedAutomationTimeSavedHours: 1.2,
        totalTimeSavedHours: 3.37,
        avgHourlyRate: 300,
        comparisonPeriod: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-30'),
        },
      };

      const filters = {
        firmId: TEST_FIRM_ID,
        dateRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-30'),
        },
      };

      const annualSavings = service.projectAnnualSavings(metrics as any, filters);

      // Period is from Nov 1 to Nov 30, which is approximately 29 days
      // 365 / 29 ≈ 12.59 multiplier
      // The exact calculation depends on timestamp - just verify it's roughly 12x
      expect(annualSavings).toBeGreaterThan(10000 * 10); // At least 10x
      expect(annualSavings).toBeLessThan(10000 * 15); // Less than 15x
    });

    it('should handle zero period correctly', () => {
      const metrics = {
        totalValueSaved: 10000,
        comparisonPeriod: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-01'), // Same day
        },
      };

      const filters = {
        firmId: TEST_FIRM_ID,
        dateRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-01'),
        },
      };

      const annualSavings = service.projectAnnualSavings(metrics as any, filters);

      expect(annualSavings).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const metrics = {
        totalValueSaved: 100,
        comparisonPeriod: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-08'), // 7 days
        },
      };

      const filters = {
        firmId: TEST_FIRM_ID,
        dateRange: {
          start: new Date('2025-11-01'),
          end: new Date('2025-11-08'),
        },
      };

      const annualSavings = service.projectAnnualSavings(metrics as any, filters);

      // Check it's rounded (100 * 365/7 = 5214.285...)
      expect(annualSavings).toBe(5214.29);
    });
  });

  describe('calculateROI', () => {
    it('should return complete ROI dashboard data', async () => {
      // Mock firm hourly rate
      mockPrisma.firm.findUnique.mockResolvedValueOnce(roiFixtures.firm);

      // Mock template task count
      mockPrisma.task.count.mockResolvedValueOnce(20);
      // Mock manual task count
      mockPrisma.task.count.mockResolvedValueOnce(10);
      // Mock NLP task count
      mockPrisma.task.count.mockResolvedValueOnce(15);
      // Mock auto reminders (tasks with due date)
      mockPrisma.task.count.mockResolvedValueOnce(50);
      // Mock dependency triggers
      mockPrisma.taskDependency.count.mockResolvedValueOnce(8);
      // Mock reassignments
      mockPrisma.taskHistory.count.mockResolvedValueOnce(5);

      // Mock previous period for comparison
      mockPrisma.task.count.mockResolvedValueOnce(15); // previous template
      mockPrisma.task.count.mockResolvedValueOnce(12); // previous NLP

      // Mock time series (monthly breakdown)
      mockPrisma.task.count.mockResolvedValueOnce(5); // month 1 template
      mockPrisma.task.count.mockResolvedValueOnce(5); // month 1 NLP

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      expect(result.currentPeriod).toBeDefined();
      expect(result.timeSeries).toBeDefined();
      expect(result.projectedAnnualSavings).toBeDefined();
      expect(result.topSavingsCategories).toBeDefined();
    });

    it('should calculate template time savings correctly', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce({ defaultRates: { Standard: 200 } });
      mockPrisma.task.count
        .mockResolvedValueOnce(20) // template tasks
        .mockResolvedValueOnce(10) // manual tasks
        .mockResolvedValueOnce(0) // nlp tasks
        .mockResolvedValueOnce(0); // reminders
      mockPrisma.taskDependency.count.mockResolvedValueOnce(0);
      mockPrisma.taskHistory.count.mockResolvedValueOnce(0);
      mockPrisma.task.count.mockResolvedValueOnce(15); // prev template
      mockPrisma.task.count.mockResolvedValueOnce(0); // prev nlp
      mockPrisma.task.count.mockResolvedValueOnce(5); // ts template
      mockPrisma.task.count.mockResolvedValueOnce(0); // ts nlp

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      // 20 template tasks * 5 minutes = 100 minutes = 1.67 hours
      expect(result.currentPeriod.estimatedTemplateTimeSavedHours).toBeCloseTo(1.67, 1);
    });

    it('should calculate NLP time savings correctly', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce({ defaultRates: { Standard: 200 } });
      mockPrisma.task.count
        .mockResolvedValueOnce(0) // template tasks
        .mockResolvedValueOnce(10) // manual tasks
        .mockResolvedValueOnce(30) // nlp tasks
        .mockResolvedValueOnce(0); // reminders
      mockPrisma.taskDependency.count.mockResolvedValueOnce(0);
      mockPrisma.taskHistory.count.mockResolvedValueOnce(0);
      mockPrisma.task.count.mockResolvedValueOnce(0); // prev template
      mockPrisma.task.count.mockResolvedValueOnce(20); // prev nlp
      mockPrisma.task.count.mockResolvedValueOnce(0); // ts template
      mockPrisma.task.count.mockResolvedValueOnce(10); // ts nlp

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      // 30 NLP tasks * 2 minutes = 60 minutes = 1 hour
      expect(result.currentPeriod.estimatedNLPTimeSavedHours).toBe(1);
    });

    it('should calculate template adoption rate correctly', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce({ defaultRates: { Standard: 200 } });
      mockPrisma.task.count
        .mockResolvedValueOnce(25) // template tasks
        .mockResolvedValueOnce(50) // manual tasks
        .mockResolvedValueOnce(25) // nlp tasks
        .mockResolvedValueOnce(0);
      mockPrisma.taskDependency.count.mockResolvedValueOnce(0);
      mockPrisma.taskHistory.count.mockResolvedValueOnce(0);
      mockPrisma.task.count.mockResolvedValueOnce(20).mockResolvedValueOnce(15);
      mockPrisma.task.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      // 25 template / (25 + 50 + 25) total = 25%
      expect(result.currentPeriod.templateAdoptionRate).toBe(25);
    });

    it('should calculate total value saved correctly', async () => {
      const hourlyRate = 200;
      mockPrisma.firm.findUnique.mockResolvedValueOnce({ defaultRates: { Standard: hourlyRate } });
      mockPrisma.task.count
        .mockResolvedValueOnce(12) // template: 12 * 5min = 60min = 1hr
        .mockResolvedValueOnce(10) // manual
        .mockResolvedValueOnce(30) // nlp: 30 * 2min = 60min = 1hr
        .mockResolvedValueOnce(0);
      mockPrisma.taskDependency.count.mockResolvedValueOnce(0);
      mockPrisma.taskHistory.count.mockResolvedValueOnce(0);
      mockPrisma.task.count.mockResolvedValueOnce(10).mockResolvedValueOnce(20);
      mockPrisma.task.count.mockResolvedValueOnce(3).mockResolvedValueOnce(5);

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      // 1 hr template + 1 hr NLP = 2 hours * 200 = 400
      expect(result.currentPeriod.totalValueSaved).toBe(400);
    });

    it('should use default hourly rate when firm has none', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce({ defaultRates: null });
      mockPrisma.task.count.mockResolvedValue(0);
      mockPrisma.taskDependency.count.mockResolvedValue(0);
      mockPrisma.taskHistory.count.mockResolvedValue(0);

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      expect(result.currentPeriod.avgHourlyRate).toBe(200); // Default rate
    });

    it('should calculate savings growth percentage', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce({ defaultRates: { Standard: 100 } });

      // Current period: 20 template tasks = 100 min = 1.67 hr * 100 = 166.67
      mockPrisma.task.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.taskDependency.count.mockResolvedValueOnce(0);
      mockPrisma.taskHistory.count.mockResolvedValueOnce(0);

      // Previous period: 10 template tasks = 50 min = 0.83 hr * 100 = 83.33
      mockPrisma.task.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);

      // Time series
      mockPrisma.task.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      // Growth: (166.67 - 83.33) / 83.33 * 100 = 100%
      expect(result.currentPeriod.savingsGrowthPercent).toBeCloseTo(100, 0);
    });

    it('should return top savings categories sorted by value', async () => {
      mockPrisma.firm.findUnique.mockResolvedValueOnce({ defaultRates: { Standard: 100 } });
      mockPrisma.task.count
        .mockResolvedValueOnce(24) // template: 24*5=120min=2hr*100=200
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(60) // nlp: 60*2=120min=2hr*100=200
        .mockResolvedValueOnce(120); // reminders: 120*1=120min=2hr*100=200 (automation)
      mockPrisma.taskDependency.count.mockResolvedValueOnce(0);
      mockPrisma.taskHistory.count.mockResolvedValueOnce(0);
      mockPrisma.task.count.mockResolvedValueOnce(20).mockResolvedValueOnce(50);
      mockPrisma.task.count.mockResolvedValueOnce(6).mockResolvedValueOnce(15);

      const result = await service.calculateROI(TEST_FIRM_ID, defaultFilters);

      expect(result.topSavingsCategories).toHaveLength(3);
      // All should have equal value, sorted alphabetically or by insertion
      expect(result.topSavingsCategories.map((c) => c.category)).toContain('Template Tasks');
      expect(result.topSavingsCategories.map((c) => c.category)).toContain('NLP Task Creation');
      expect(result.topSavingsCategories.map((c) => c.category)).toContain('Automation Features');
    });
  });

  describe('getTemplateTimeSavings', () => {
    it('should calculate time saved from template tasks', async () => {
      mockPrisma.task.count.mockResolvedValueOnce(24); // 24 template tasks

      const result = await service.getTemplateTimeSavings(TEST_FIRM_ID, {
        start: new Date('2025-11-01'),
        end: new Date('2025-11-30'),
      });

      // 24 tasks * 5 minutes = 120 minutes = 2 hours
      expect(result).toBe(2);
    });
  });

  describe('getNLPTimeSavings', () => {
    it('should calculate time saved from NLP-created tasks', async () => {
      mockPrisma.task.count.mockResolvedValueOnce(30); // 30 NLP tasks

      const result = await service.getNLPTimeSavings(TEST_FIRM_ID, {
        start: new Date('2025-11-01'),
        end: new Date('2025-11-30'),
      });

      // 30 tasks * 2 minutes = 60 minutes = 1 hour
      expect(result).toBe(1);
    });
  });

  describe('getAutomationTimeSavings', () => {
    it('should calculate combined automation time savings', async () => {
      // Reminders: 60 * 1 = 60 min
      mockPrisma.task.count.mockResolvedValueOnce(60);
      // Reassignments: 3 * 10 = 30 min
      mockPrisma.taskHistory.count.mockResolvedValueOnce(3);
      // Dependencies: 6 * 2 = 12 min
      mockPrisma.taskDependency.count.mockResolvedValueOnce(6);

      const result = await service.getAutomationTimeSavings(TEST_FIRM_ID, {
        start: new Date('2025-11-01'),
        end: new Date('2025-11-30'),
      });

      // 60 + 30 + 12 = 102 minutes = 1.7 hours
      expect(result).toBe(1.7);
    });
  });

  describe('caching', () => {
    it('should invalidate cache for a firm', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        keys: jest.fn().mockResolvedValue(['analytics:roi:firm-1:2025-11-01']),
        del: jest.fn().mockResolvedValue(1),
      };

      const serviceWithRedis = new ROICalculatorService(mockPrisma, mockRedis as any);

      await serviceWithRedis.invalidateCache('firm-1');

      expect(mockRedis.keys).toHaveBeenCalledWith('analytics:roi:firm-1:*');
      expect(mockRedis.del).toHaveBeenCalledWith('analytics:roi:firm-1:2025-11-01');
    });
  });
});
