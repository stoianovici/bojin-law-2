/**
 * Availability Service Unit Tests
 * Story 4.5: Team Workload Management
 *
 * Tests for user availability CRUD operations
 * AC: 1, 5 - Team calendar shows availability, OOO configuration
 */

import { AvailabilityService } from './availability.service';

// Mock Prisma client
const mockPrisma = {
  userAvailability: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  const userId = 'user-123';
  const firmId = 'firm-456';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AvailabilityService(mockPrisma as any);
  });

  describe('createAvailability', () => {
    const validInput = {
      availabilityType: 'Vacation' as const,
      startDate: '2025-12-15',
      endDate: '2025-12-20',
      reason: 'Holiday',
      autoReassign: true,
    };

    it('should create availability record successfully', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null); // No overlap
      mockPrisma.userAvailability.create.mockResolvedValue({
        id: 'avail-1',
        userId,
        firmId,
        availabilityType: 'Vacation',
        startDate: new Date('2025-12-15'),
        endDate: new Date('2025-12-20'),
        hoursPerDay: null,
        reason: 'Holiday',
        autoReassign: true,
        delegateTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: userId, firstName: 'John', lastName: 'Doe', role: 'Associate' },
        delegate: null,
      });

      const result = await service.createAvailability(validInput, userId, firmId);

      expect(result.id).toBe('avail-1');
      expect(result.availabilityType).toBe('Vacation');
      expect(result.autoReassign).toBe(true);
      expect(mockPrisma.userAvailability.create).toHaveBeenCalled();
    });

    it('should throw error when end date is before start date', async () => {
      const invalidInput = {
        ...validInput,
        startDate: '2025-12-20',
        endDate: '2025-12-15',
      };

      await expect(
        service.createAvailability(invalidInput, userId, firmId)
      ).rejects.toThrow('End date must be after start date');
    });

    it('should throw error when overlapping availability exists', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        id: 'existing',
        startDate: new Date('2025-12-10'),
        endDate: new Date('2025-12-18'),
      });

      await expect(
        service.createAvailability(validInput, userId, firmId)
      ).rejects.toThrow('Overlapping availability already exists');
    });

    it('should validate delegate belongs to same firm', async () => {
      const inputWithDelegate = {
        ...validInput,
        delegateTo: 'delegate-user',
      };

      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        firmId: 'different-firm',
        status: 'Active',
      });

      await expect(
        service.createAvailability(inputWithDelegate, userId, firmId)
      ).rejects.toThrow('Delegate must be in the same firm');
    });

    it('should validate delegate is active', async () => {
      const inputWithDelegate = {
        ...validInput,
        delegateTo: 'delegate-user',
      };

      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        firmId,
        status: 'Inactive',
      });

      await expect(
        service.createAvailability(inputWithDelegate, userId, firmId)
      ).rejects.toThrow('Delegate must be an active user');
    });
  });

  describe('updateAvailability', () => {
    const availId = 'avail-1';

    it('should update availability successfully', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availId,
        userId,
        firmId,
        startDate: new Date('2025-12-15'),
        endDate: new Date('2025-12-20'),
      });

      mockPrisma.userAvailability.update.mockResolvedValue({
        id: availId,
        userId,
        firmId,
        availabilityType: 'Vacation',
        startDate: new Date('2025-12-15'),
        endDate: new Date('2025-12-22'),
        hoursPerDay: null,
        reason: 'Extended holiday',
        autoReassign: true,
        delegateTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: userId, firstName: 'John', lastName: 'Doe', role: 'Associate' },
        delegate: null,
      });

      const result = await service.updateAvailability(
        availId,
        { endDate: '2025-12-22', reason: 'Extended holiday' },
        userId,
        firmId
      );

      expect(result.id).toBe(availId);
      expect(mockPrisma.userAvailability.update).toHaveBeenCalled();
    });

    it('should throw error if not owner', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availId,
        userId: 'other-user',
        firmId,
      });

      await expect(
        service.updateAvailability(availId, {}, userId, firmId)
      ).rejects.toThrow('Unauthorized: Cannot update another user availability');
    });

    it('should throw error if different firm', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availId,
        userId,
        firmId: 'other-firm',
      });

      await expect(
        service.updateAvailability(availId, {}, userId, firmId)
      ).rejects.toThrow('Unauthorized: Availability not in your firm');
    });
  });

  describe('deleteAvailability', () => {
    const availId = 'avail-1';

    it('should delete availability successfully', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue({
        id: availId,
        userId,
        firmId,
      });
      mockPrisma.userAvailability.delete.mockResolvedValue({});

      await service.deleteAvailability(availId, userId, firmId);

      expect(mockPrisma.userAvailability.delete).toHaveBeenCalledWith({
        where: { id: availId },
      });
    });

    it('should throw error if not found', async () => {
      mockPrisma.userAvailability.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteAvailability(availId, userId, firmId)
      ).rejects.toThrow('Availability not found');
    });
  });

  describe('isUserAvailable', () => {
    it('should return available when no availability record', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue(null);

      const result = await service.isUserAvailable(userId, new Date());

      expect(result.available).toBe(true);
    });

    it('should return unavailable for vacation', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        availabilityType: 'Vacation',
        reason: 'Holiday trip',
      });

      const result = await service.isUserAvailable(userId, new Date());

      expect(result.available).toBe(false);
      expect(result.reason).toContain('Vacation');
    });

    it('should return available for reduced hours', async () => {
      mockPrisma.userAvailability.findFirst.mockResolvedValue({
        availabilityType: 'ReducedHours',
        hoursPerDay: 4,
      });

      const result = await service.isUserAvailable(userId, new Date());

      expect(result.available).toBe(true);
      expect(result.reason).toContain('ReducedHours');
    });
  });

  describe('getTeamAvailability', () => {
    it('should return team availability within date range', async () => {
      const dateRange = {
        start: new Date('2025-12-01'),
        end: new Date('2025-12-31'),
      };

      mockPrisma.userAvailability.findMany.mockResolvedValue([
        {
          id: 'avail-1',
          userId: 'user-1',
          firmId,
          availabilityType: 'Vacation',
          startDate: new Date('2025-12-15'),
          endDate: new Date('2025-12-20'),
          hoursPerDay: null,
          reason: null,
          autoReassign: true,
          delegateTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Associate' },
          delegate: null,
        },
      ]);

      const result = await service.getTeamAvailability(firmId, dateRange);

      expect(result.length).toBe(1);
      expect(mockPrisma.userAvailability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ firmId }),
        })
      );
    });
  });
});
