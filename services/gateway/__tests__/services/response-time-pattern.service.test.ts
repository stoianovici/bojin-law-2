/**
 * Unit tests for Response Time Pattern Service
 * Story 5.6: AI Learning and Personalization (Task 41)
 */

import { ResponseTimePatternService } from '../../src/services/response-time-pattern.service';
import { prisma } from '@legal-platform/database';

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
    responseTimePattern: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ResponseTimePatternService', () => {
  let service: ResponseTimePatternService;
  const userId = 'user-123';
  const firmId = 'firm-456';

  const mockPattern = {
    id: 'pattern-1',
    firmId,
    userId,
    taskType: 'document_review',
    caseType: 'civil',
    averageResponseHours: 4.5,
    medianResponseHours: 4.0,
    minResponseHours: 2.0,
    maxResponseHours: 8.0,
    sampleCount: 15,
    stdDeviation: 1.5,
    dayOfWeekPattern: {
      monday: 4.0,
      tuesday: 3.5,
      wednesday: 4.5,
      thursday: 5.0,
      friday: 5.5,
      saturday: 0,
      sunday: 0,
    },
    timeOfDayPattern: {
      earlyMorning: 3.0,
      morning: 4.0,
      afternoon: 5.0,
      evening: 6.0,
      night: 0,
    },
    lastCalculatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = new ResponseTimePatternService();
    jest.clearAllMocks();
  });

  describe('recordResponseTime', () => {
    it('should create new pattern for first measurement', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.responseTimePattern.create as jest.Mock).mockResolvedValue(mockPattern);

      const input = {
        taskType: 'document_review',
        caseType: 'civil',
        responseHours: 4.5,
        completedAt: new Date('2024-01-15T10:00:00Z'), // Monday morning
      };

      const result = await service.recordResponseTime(input, userId, firmId);

      expect(result.id).toBe('pattern-1');
      expect(mockPrisma.responseTimePattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firmId,
          userId,
          taskType: 'document_review',
          caseType: 'civil',
          averageResponseHours: 4.5,
          medianResponseHours: 4.5,
          minResponseHours: 4.5,
          maxResponseHours: 4.5,
          sampleCount: 1,
          stdDeviation: null,
        }),
      });
    });

    it('should update existing pattern with new sample', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(mockPattern);
      (mockPrisma.responseTimePattern.update as jest.Mock).mockResolvedValue({
        ...mockPattern,
        sampleCount: 16,
        averageResponseHours: 4.6,
      });

      const input = {
        taskType: 'document_review',
        caseType: 'civil',
        responseHours: 6.0,
        completedAt: new Date('2024-01-16T14:00:00Z'),
      };

      const result = await service.recordResponseTime(input, userId, firmId);

      expect(result.sampleCount).toBe(16);
      expect(mockPrisma.responseTimePattern.update).toHaveBeenCalled();
    });

    it('should update min/max when appropriate', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(mockPattern);
      (mockPrisma.responseTimePattern.update as jest.Mock).mockResolvedValue({
        ...mockPattern,
        minResponseHours: 1.0,
      });

      const input = {
        taskType: 'document_review',
        responseHours: 1.0, // New minimum
        completedAt: new Date(),
      };

      await service.recordResponseTime(input, userId, firmId);

      expect(mockPrisma.responseTimePattern.update).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
        data: expect.objectContaining({
          minResponseHours: 1.0,
        }),
      });
    });
  });

  describe('getUserPatterns', () => {
    it('should return all user patterns', async () => {
      (mockPrisma.responseTimePattern.findMany as jest.Mock).mockResolvedValue([mockPattern]);

      const result = await service.getUserPatterns(userId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.responseTimePattern.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ sampleCount: 'desc' }, { lastCalculatedAt: 'desc' }],
        take: 50,
      });
    });

    it('should filter by task type', async () => {
      (mockPrisma.responseTimePattern.findMany as jest.Mock).mockResolvedValue([mockPattern]);

      await service.getUserPatterns(userId, { taskType: 'document_review' });

      expect(mockPrisma.responseTimePattern.findMany).toHaveBeenCalledWith({
        where: { userId, taskType: 'document_review' },
        orderBy: [{ sampleCount: 'desc' }, { lastCalculatedAt: 'desc' }],
        take: 50,
      });
    });

    it('should respect limit parameter', async () => {
      (mockPrisma.responseTimePattern.findMany as jest.Mock).mockResolvedValue([]);

      await service.getUserPatterns(userId, { limit: 10 });

      expect(mockPrisma.responseTimePattern.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe('getPatternByTaskType', () => {
    it('should return pattern for specific task type', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(mockPattern);

      const result = await service.getPatternByTaskType('document_review', userId, 'civil');

      expect(result).not.toBeNull();
      expect(result!.taskType).toBe('document_review');
      expect(mockPrisma.responseTimePattern.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          taskType: 'document_review',
          caseType: 'civil',
        },
      });
    });

    it('should return null when not found', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getPatternByTaskType('unknown', userId);

      expect(result).toBeNull();
    });
  });

  describe('predictCompletionTime', () => {
    it('should predict completion time based on patterns', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(mockPattern);

      const result = await service.predictCompletionTime('document_review', userId, 'civil');

      expect(result).not.toBeNull();
      expect(result!.basedOnSamples).toBe(15);
      expect(result!.estimatedHours).toBeGreaterThan(0);
      expect(result!.confidenceLevel).toBeGreaterThan(0);
    });

    it('should return null when insufficient samples', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue({
        ...mockPattern,
        sampleCount: 2,
      });

      const result = await service.predictCompletionTime('document_review', userId);

      expect(result).toBeNull();
    });

    it('should adjust for day of week', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(mockPattern);

      // Use a Monday
      const monday = new Date('2024-01-15T10:00:00Z');
      const result = await service.predictCompletionTime(
        'document_review',
        userId,
        undefined,
        monday
      );

      expect(result).not.toBeNull();
      // Monday has lower response time (4.0) than average, so adjustment should be applied
    });

    it('should adjust for time of day', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(mockPattern);

      // Use morning time
      const morningTime = new Date('2024-01-15T10:00:00Z');
      const result = await service.predictCompletionTime(
        'document_review',
        userId,
        undefined,
        morningTime
      );

      expect(result).not.toBeNull();
      // Morning has specific response time pattern
    });

    it('should return null when pattern not found', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.predictCompletionTime('unknown', userId);

      expect(result).toBeNull();
    });
  });

  describe('getProductivityInsights', () => {
    it('should calculate productivity insights', async () => {
      (mockPrisma.responseTimePattern.findMany as jest.Mock).mockResolvedValue([
        mockPattern,
        {
          ...mockPattern,
          id: 'pattern-2',
          taskType: 'email_response',
          averageResponseHours: 2.0,
        },
      ]);

      const result = await service.getProductivityInsights(userId);

      expect(result.mostProductiveDay).not.toBeNull();
      expect(result.mostProductiveTime).not.toBeNull();
      expect(result.fastestTaskType).toBe('email_response');
      expect(result.slowestTaskType).toBe('document_review');
      expect(result.averageResponseTime).toBeGreaterThan(0);
    });

    it('should return null values when no patterns exist', async () => {
      (mockPrisma.responseTimePattern.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getProductivityInsights(userId);

      expect(result.mostProductiveDay).toBeNull();
      expect(result.mostProductiveTime).toBeNull();
      expect(result.fastestTaskType).toBeNull();
      expect(result.slowestTaskType).toBeNull();
      expect(result.averageResponseTime).toBe(0);
    });

    it('should only consider patterns with sufficient samples', async () => {
      (mockPrisma.responseTimePattern.findMany as jest.Mock).mockResolvedValue([mockPattern]);

      await service.getProductivityInsights(userId);

      expect(mockPrisma.responseTimePattern.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          sampleCount: { gte: 5 },
        },
        orderBy: { sampleCount: 'desc' },
      });
    });
  });

  describe('deleteUserPatterns', () => {
    it('should delete all user patterns', async () => {
      (mockPrisma.responseTimePattern.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const result = await service.deleteUserPatterns(userId);

      expect(result).toBe(5);
      expect(mockPrisma.responseTimePattern.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('recalculatePattern', () => {
    it('should update lastCalculatedAt', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(mockPattern);
      (mockPrisma.responseTimePattern.update as jest.Mock).mockResolvedValue({
        ...mockPattern,
        lastCalculatedAt: new Date(),
      });

      const result = await service.recalculatePattern('pattern-1', userId);

      expect(result).not.toBeNull();
      expect(mockPrisma.responseTimePattern.update).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
        data: {
          lastCalculatedAt: expect.any(Date),
        },
      });
    });

    it('should return null when pattern not found', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.recalculatePattern('nonexistent', userId);

      expect(result).toBeNull();
    });
  });

  describe('day and time detection', () => {
    it('should correctly identify day of week from date', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.responseTimePattern.create as jest.Mock).mockResolvedValue(mockPattern);

      // Create on a Wednesday
      const wednesday = new Date('2024-01-17T12:00:00Z');
      await service.recordResponseTime(
        { taskType: 'test', responseHours: 5, completedAt: wednesday },
        userId,
        firmId
      );

      expect(mockPrisma.responseTimePattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dayOfWeekPattern: expect.objectContaining({
            wednesday: 5,
          }),
        }),
      });
    });

    it('should correctly identify time of day periods', async () => {
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.responseTimePattern.create as jest.Mock).mockResolvedValue(mockPattern);

      // Create in the afternoon (14:00)
      const afternoon = new Date('2024-01-15T14:00:00Z');
      await service.recordResponseTime(
        { taskType: 'test', responseHours: 3, completedAt: afternoon },
        userId,
        firmId
      );

      expect(mockPrisma.responseTimePattern.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timeOfDayPattern: expect.objectContaining({
            afternoon: 3,
          }),
        }),
      });
    });
  });

  describe('statistics calculations', () => {
    it('should calculate running average correctly', async () => {
      const existingPattern = {
        ...mockPattern,
        averageResponseHours: 4.0,
        sampleCount: 4,
        stdDeviation: 1.0,
      };
      (mockPrisma.responseTimePattern.findFirst as jest.Mock).mockResolvedValue(existingPattern);
      (mockPrisma.responseTimePattern.update as jest.Mock).mockImplementation((params) => {
        return Promise.resolve({
          ...existingPattern,
          ...params.data,
          sampleCount: 5,
        });
      });

      // New sample of 6 hours
      // New average should be (4*4 + 6) / 5 = 22/5 = 4.4
      await service.recordResponseTime(
        { taskType: 'document_review', responseHours: 6, completedAt: new Date() },
        userId,
        firmId
      );

      const updateCall = (mockPrisma.responseTimePattern.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.averageResponseHours).toBeCloseTo(4.4, 1);
    });
  });
});
