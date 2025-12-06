/**
 * Time Entry Service Unit Tests
 * Story 4.3: Time Estimation & Manual Time Logging - Task 20
 *
 * Tests for time entry CRUD operations, rate calculation, and firm isolation
 */

import { PrismaClient } from '@legal-platform/database';
import {
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getTimeEntryById,
  getTimeEntriesByTask,
  getTimeEntriesByUser,
  getTimeEntriesByCase,
} from './time-entry.service';
import type { TimeEntryInput, TimeEntryDateRange } from '@legal-platform/types';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  PrismaClient: jest.fn(),
}));

describe('TimeEntryService', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
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
      user: {
        findUnique: jest.fn(),
      },
      firm: {
        findUnique: jest.fn(),
      },
    } as any;

    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTimeEntry', () => {
    const mockInput: TimeEntryInput = {
      caseId: 'case-123',
      taskId: 'task-456',
      date: '2025-12-01',
      hours: 2.5,
      description: 'Legal research',
      narrative: 'Detailed billing narrative',
      billable: true,
    };

    const mockUser = {
      id: 'user-123',
      role: 'Partner',
      firmId: 'firm-123',
    };

    const mockCase = {
      id: 'case-123',
      firmId: 'firm-123',
      customRates: { partnerRate: 50000 }, // $500.00
    };

    const mockFirm = {
      id: 'firm-123',
      defaultRates: { partnerRate: 40000 }, // $400.00
    };

    it('should create time entry with case custom rate', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.firm.findUnique.mockResolvedValue(mockFirm as any);

      const mockCreatedEntry = {
        id: 'entry-123',
        ...mockInput,
        userId: mockUser.id,
        firmId: mockUser.firmId,
        hourlyRate: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.timeEntry.create.mockResolvedValue(mockCreatedEntry as any);

      const result = await createTimeEntry(mockInput, mockUser.id);

      expect(result).toEqual(mockCreatedEntry);
      expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hourlyRate: 50000, // Uses case custom rate
        }),
      });
    });

    it('should create time entry with firm default rate when no custom rate', async () => {
      const caseWithoutCustomRate = {
        ...mockCase,
        customRates: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(caseWithoutCustomRate as any);
      mockPrisma.firm.findUnique.mockResolvedValue(mockFirm as any);

      const mockCreatedEntry = {
        id: 'entry-123',
        ...mockInput,
        userId: mockUser.id,
        firmId: mockUser.firmId,
        hourlyRate: 40000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.timeEntry.create.mockResolvedValue(mockCreatedEntry as any);

      const result = await createTimeEntry(mockInput, mockUser.id);

      expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          hourlyRate: 40000, // Falls back to firm default rate
        }),
      });
    });

    it('should create time entry without task when taskId is not provided', async () => {
      const inputWithoutTask = { ...mockInput, taskId: undefined };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(mockCase as any);
      mockPrisma.firm.findUnique.mockResolvedValue(mockFirm as any);

      const mockCreatedEntry = {
        id: 'entry-123',
        ...inputWithoutTask,
        taskId: null,
        userId: mockUser.id,
        firmId: mockUser.firmId,
        hourlyRate: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.timeEntry.create.mockResolvedValue(mockCreatedEntry as any);

      const result = await createTimeEntry(inputWithoutTask, mockUser.id);

      expect(result).toEqual(mockCreatedEntry);
      expect(mockPrisma.timeEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          taskId: undefined,
        }),
      });
    });

    it('should throw error when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(createTimeEntry(mockInput, 'invalid-user')).rejects.toThrow('User not found');
    });

    it('should throw error when case not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(createTimeEntry(mockInput, mockUser.id)).rejects.toThrow('Case not found');
    });

    it('should enforce firm isolation - case must belong to user firm', async () => {
      const caseFromDifferentFirm = {
        ...mockCase,
        firmId: 'different-firm',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.case.findUnique.mockResolvedValue(caseFromDifferentFirm as any);

      await expect(createTimeEntry(mockInput, mockUser.id)).rejects.toThrow(
        'Case does not belong to user firm'
      );
    });
  });

  describe('updateTimeEntry', () => {
    it('should update time entry fields', async () => {
      const mockExistingEntry = {
        id: 'entry-123',
        userId: 'user-123',
        firmId: 'firm-123',
      };

      const updateData = {
        hours: 3.0,
        description: 'Updated description',
        billable: false,
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(mockExistingEntry as any);
      mockPrisma.timeEntry.update.mockResolvedValue({
        ...mockExistingEntry,
        ...updateData,
      } as any);

      const result = await updateTimeEntry('entry-123', updateData, 'user-123');

      expect(result).toMatchObject(updateData);
      expect(mockPrisma.timeEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-123' },
        data: updateData,
      });
    });

    it('should throw error when trying to update another user entry', async () => {
      const mockEntry = {
        id: 'entry-123',
        userId: 'other-user',
        firmId: 'firm-123',
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(mockEntry as any);

      await expect(
        updateTimeEntry('entry-123', { hours: 3.0 }, 'user-123')
      ).rejects.toThrow('Not authorized to update this time entry');
    });

    it('should throw error when entry not found', async () => {
      mockPrisma.timeEntry.findUnique.mockResolvedValue(null);

      await expect(
        updateTimeEntry('invalid-entry', { hours: 3.0 }, 'user-123')
      ).rejects.toThrow('Time entry not found');
    });
  });

  describe('deleteTimeEntry', () => {
    it('should delete time entry when user is owner', async () => {
      const mockEntry = {
        id: 'entry-123',
        userId: 'user-123',
        firmId: 'firm-123',
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(mockEntry as any);
      mockPrisma.timeEntry.delete.mockResolvedValue(mockEntry as any);

      await deleteTimeEntry('entry-123', 'user-123');

      expect(mockPrisma.timeEntry.delete).toHaveBeenCalledWith({
        where: { id: 'entry-123' },
      });
    });

    it('should throw error when trying to delete another user entry', async () => {
      const mockEntry = {
        id: 'entry-123',
        userId: 'other-user',
        firmId: 'firm-123',
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(mockEntry as any);

      await expect(deleteTimeEntry('entry-123', 'user-123')).rejects.toThrow(
        'Not authorized to delete this time entry'
      );
    });
  });

  describe('getTimeEntriesByTask', () => {
    it('should return time entries for a task', async () => {
      const mockEntries = [
        { id: 'entry-1', taskId: 'task-123', hours: 2.0 },
        { id: 'entry-2', taskId: 'task-123', hours: 1.5 },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValue(mockEntries as any);

      const result = await getTimeEntriesByTask('task-123');

      expect(result).toEqual(mockEntries);
      expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task-123' },
        include: expect.any(Object),
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('getTimeEntriesByUser', () => {
    it('should return user time entries with date range', async () => {
      const mockEntries = [
        { id: 'entry-1', userId: 'user-123', date: new Date('2025-12-01') },
        { id: 'entry-2', userId: 'user-123', date: new Date('2025-12-05') },
      ];

      const dateRange: TimeEntryDateRange = {
        start: new Date('2025-12-01'),
        end: new Date('2025-12-31'),
      };

      mockPrisma.timeEntry.findMany.mockResolvedValue(mockEntries as any);

      const result = await getTimeEntriesByUser('user-123', dateRange);

      expect(result).toEqual(mockEntries);
      expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        include: expect.any(Object),
        orderBy: { date: 'desc' },
      });
    });

    it('should return all user time entries when no date range', async () => {
      const mockEntries = [{ id: 'entry-1', userId: 'user-123' }];

      mockPrisma.timeEntry.findMany.mockResolvedValue(mockEntries as any);

      await getTimeEntriesByUser('user-123');

      expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
        },
        include: expect.any(Object),
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('getTimeEntriesByCase', () => {
    it('should return time entries for a case', async () => {
      const mockEntries = [
        { id: 'entry-1', caseId: 'case-123', hours: 2.0 },
        { id: 'entry-2', caseId: 'case-123', hours: 3.5 },
      ];

      mockPrisma.timeEntry.findMany.mockResolvedValue(mockEntries as any);

      const result = await getTimeEntriesByCase('case-123');

      expect(result).toEqual(mockEntries);
      expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123' },
        include: expect.any(Object),
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('getTimeEntryById', () => {
    it('should return time entry with relations', async () => {
      const mockEntry = {
        id: 'entry-123',
        caseId: 'case-123',
        firmId: 'firm-123',
        case: { id: 'case-123', title: 'Test Case' },
        user: { id: 'user-123', firstName: 'John', lastName: 'Doe' },
      };

      mockPrisma.timeEntry.findUnique.mockResolvedValue(mockEntry as any);

      const result = await getTimeEntryById('entry-123', 'firm-123');

      expect(result).toEqual(mockEntry);
      expect(mockPrisma.timeEntry.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'entry-123',
          firmId: 'firm-123',
        },
        include: expect.any(Object),
      });
    });

    it('should return null when entry not in firm', async () => {
      mockPrisma.timeEntry.findUnique.mockResolvedValue(null);

      const result = await getTimeEntryById('entry-123', 'different-firm');

      expect(result).toBeNull();
    });
  });
});
