/**
 * Time Entry GraphQL API Integration Tests
 * Story 4.3: Time Estimation & Manual Time Logging - Task 22
 */

// Set environment variables
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    timeEntry: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    firm: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// Mock AI service
jest.mock('axios', () => ({
  default: {
    post: jest.fn(),
    create: jest.fn(() => ({
      post: jest.fn(),
    })),
  },
}));

import { prisma } from '@legal-platform/database';
import { timeEntryResolvers, Context } from '../../src/graphql/resolvers/time-entry.resolvers';
import axios from 'axios';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAxios = axios as jest.Mocked<typeof axios>;

// Test data
const testFirm = {
  id: 'firm-123',
  name: 'Test Law Firm',
  defaultRates: { partnerRate: 40000 },
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
  customRates: { partnerRate: 50000 },
};

const testTask = {
  id: 'task-123',
  caseId: testCase.id,
  type: 'Research',
  title: 'Legal Research',
  estimatedHours: 5.0,
};

const mockContext: Context = {
  user: testUser,
  req: {} as any,
  res: {} as any,
};

describe('Time Entry GraphQL API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mutations - createTimeEntry', () => {
    it('should create time entry with task link', async () => {
      const input = {
        caseId: testCase.id,
        taskId: testTask.id,
        date: '2025-12-01',
        hours: 2.5,
        description: 'Legal research',
        narrative: 'Detailed billing narrative',
        billable: true,
      };

      const createdEntry = {
        id: 'entry-123',
        ...input,
        userId: testUser.id,
        firmId: testFirm.id,
        hourlyRate: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(testUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.firm.findUnique.mockResolvedValue(testFirm as any);
      mockPrisma.timeEntry.create.mockResolvedValue(createdEntry as any);

      const result = await timeEntryResolvers.Mutation.createTimeEntry({}, { input }, mockContext);

      expect(result.id).toBe('entry-123');
      expect(result.hourlyRate).toBe(50000);
      expect(mockPrisma.timeEntry.create).toHaveBeenCalled();
    });

    it('should create time entry without task', async () => {
      const input = {
        caseId: testCase.id,
        date: '2025-12-01',
        hours: 2.5,
        description: 'Client meeting',
        billable: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(testUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.firm.findUnique.mockResolvedValue(testFirm as any);
      mockPrisma.timeEntry.create.mockResolvedValue({ id: 'entry-456', ...input } as any);

      const result = await timeEntryResolvers.Mutation.createTimeEntry({}, { input }, mockContext);

      expect(result.id).toBe('entry-456');
    });

    it('should reject time entry for case in different firm', async () => {
      const differentFirmCase = { ...testCase, firmId: 'other-firm' };

      mockPrisma.user.findUnique.mockResolvedValue(testUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(differentFirmCase as any);

      await expect(
        timeEntryResolvers.Mutation.createTimeEntry(
          {},
          {
            input: {
              caseId: testCase.id,
              date: '2025-12-01',
              hours: 1,
              description: 'Test',
              billable: true,
            },
          },
          mockContext
        )
      ).rejects.toThrow();
    });
  });

  describe('Mutations - updateTimeEntry', () => {
    it('should update time entry when user is owner', async () => {
      const existingEntry = {
        id: 'entry-123',
        userId: testUser.id,
        firmId: testFirm.id,
        hours: 2.0,
      };

      const updateData = {
        hours: 3.0,
        description: 'Updated description',
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(existingEntry as any);
      mockPrisma.timeEntry.update.mockResolvedValue({ ...existingEntry, ...updateData } as any);

      const result = await timeEntryResolvers.Mutation.updateTimeEntry(
        {},
        { id: 'entry-123', input: updateData },
        mockContext
      );

      expect(result.hours).toBe(3.0);
      expect(mockPrisma.timeEntry.update).toHaveBeenCalled();
    });

    it('should reject update when user is not owner', async () => {
      const otherUserEntry = {
        id: 'entry-123',
        userId: 'other-user',
        firmId: testFirm.id,
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(otherUserEntry as any);

      await expect(
        timeEntryResolvers.Mutation.updateTimeEntry(
          {},
          { id: 'entry-123', input: { hours: 3.0 } },
          mockContext
        )
      ).rejects.toThrow();
    });
  });

  describe('Mutations - deleteTimeEntry', () => {
    it('should delete time entry when user is owner', async () => {
      const entry = {
        id: 'entry-123',
        userId: testUser.id,
        firmId: testFirm.id,
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(entry as any);
      mockPrisma.timeEntry.delete.mockResolvedValue(entry as any);

      const result = await timeEntryResolvers.Mutation.deleteTimeEntry(
        {},
        { id: 'entry-123' },
        mockContext
      );

      expect(result).toBe(true);
      expect(mockPrisma.timeEntry.delete).toHaveBeenCalled();
    });
  });

  describe('Mutations - logTimeAgainstTask', () => {
    it('should create time entry linked to task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(testTask as any);
      mockPrisma.user.findUnique.mockResolvedValue(testUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);
      mockPrisma.firm.findUnique.mockResolvedValue(testFirm as any);
      mockPrisma.timeEntry.create.mockResolvedValue({
        id: 'entry-quick',
        taskId: testTask.id,
        caseId: testCase.id,
        hours: 1.5,
      } as any);

      const result = await timeEntryResolvers.Mutation.logTimeAgainstTask(
        {},
        {
          taskId: testTask.id,
          hours: 1.5,
          description: 'Quick log',
          billable: true,
        },
        mockContext
      );

      expect(result.id).toBe('entry-quick');
      expect(result.taskId).toBe(testTask.id);
    });

    it('should reject when task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(
        timeEntryResolvers.Mutation.logTimeAgainstTask(
          {},
          { taskId: 'invalid', hours: 1, description: 'Test', billable: true },
          mockContext
        )
      ).rejects.toThrow();
    });
  });

  describe('Mutations - estimateTaskTime', () => {
    it('should return AI time estimation', async () => {
      const mockEstimation = {
        estimatedHours: 5.5,
        confidence: 0.85,
        reasoning: 'Based on similar research tasks',
        basedOnSimilarTasks: 10,
        range: { min: 4.0, max: 7.0 },
      };

      mockAxios.post.mockResolvedValue({
        data: { estimation: mockEstimation },
      });

      const result = await timeEntryResolvers.Mutation.estimateTaskTime(
        {},
        {
          input: {
            taskType: 'Research',
            taskTitle: 'Contract law research',
            taskDescription: 'Review precedents',
          },
        },
        mockContext
      );

      expect(result.estimatedHours).toBe(5.5);
      expect(result.confidence).toBe(0.85);
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/estimate-time'),
        expect.any(Object)
      );
    });
  });

  describe('Queries - timeEntry', () => {
    it('should return time entry by ID with firm isolation', async () => {
      const entry = {
        id: 'entry-123',
        firmId: testFirm.id,
        userId: testUser.id,
        hours: 2.5,
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(entry as any);

      const result = await timeEntryResolvers.Query.timeEntry({}, { id: 'entry-123' }, mockContext);

      expect(result.id).toBe('entry-123');
      expect(mockPrisma.timeEntry.findUnique).toHaveBeenCalledWith({
        where: { id: 'entry-123', firmId: testFirm.id },
        include: expect.any(Object),
      });
    });

    it('should return null for entry in different firm', async () => {
      mockPrisma.timeEntry.findUnique.mockResolvedValue(null);

      const result = await timeEntryResolvers.Query.timeEntry(
        {},
        { id: 'entry-other-firm' },
        mockContext
      );

      expect(result).toBeNull();
    });
  });

  describe('Queries - myTimeEntries', () => {
    it('should return current user time entries', async () => {
      const entries = [
        { id: 'entry-1', userId: testUser.id, hours: 2.0 },
        { id: 'entry-2', userId: testUser.id, hours: 1.5 },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValue(entries as any);

      const result = await timeEntryResolvers.Query.myTimeEntries({}, { filters: {} }, mockContext);

      expect(result).toHaveLength(2);
      expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: { userId: testUser.id },
        include: expect.any(Object),
        orderBy: { date: 'desc' },
      });
    });

    it('should filter by date range', async () => {
      mockPrisma.timeEntry.findMany.mockResolvedValue([] as any);

      await timeEntryResolvers.Query.myTimeEntries(
        {},
        {
          filters: {
            dateFrom: '2025-12-01',
            dateTo: '2025-12-31',
          },
        },
        mockContext
      );

      expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId: testUser.id,
          date: {
            gte: new Date('2025-12-01'),
            lte: new Date('2025-12-31'),
          },
        },
        include: expect.any(Object),
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('Queries - timeEntriesByTask', () => {
    it('should return time entries for a task', async () => {
      const entries = [
        { id: 'entry-1', taskId: testTask.id, hours: 2.0 },
        { id: 'entry-2', taskId: testTask.id, hours: 1.5 },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValue(entries as any);

      const result = await timeEntryResolvers.Query.timeEntriesByTask(
        {},
        { taskId: testTask.id },
        mockContext
      );

      expect(result).toHaveLength(2);
    });
  });

  describe('Field Resolvers', () => {
    it('should resolve amount field (hours * hourlyRate)', () => {
      const entry = {
        hours: 2.5,
        hourlyRate: 50000,
      };

      const result = timeEntryResolvers.TimeEntry.amount(entry as any);

      expect(result).toBe(125000); // 2.5 * 50000
    });

    it('should resolve case relation', async () => {
      const entry = { id: 'entry-123', caseId: testCase.id };
      mockPrisma.case.findUnique.mockResolvedValue(testCase as any);

      const result = await timeEntryResolvers.TimeEntry.case(entry as any, {}, mockContext);

      expect(result.id).toBe(testCase.id);
    });

    it('should resolve task relation', async () => {
      const entry = { id: 'entry-123', taskId: testTask.id };
      mockPrisma.task.findUnique.mockResolvedValue(testTask as any);

      const result = await timeEntryResolvers.TimeEntry.task(entry as any, {}, mockContext);

      expect(result.id).toBe(testTask.id);
    });

    it('should resolve user relation', async () => {
      const entry = { id: 'entry-123', userId: testUser.id };
      mockPrisma.user.findUnique.mockResolvedValue(testUser as any);

      const result = await timeEntryResolvers.TimeEntry.user(entry as any, {}, mockContext);

      expect(result.id).toBe(testUser.id);
    });
  });
});
