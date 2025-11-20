/**
 * User Management Service Unit Tests
 * Story 2.4.1: Partner User Management
 *
 * Tests user management operations (activate, deactivate, role change)
 * Target: 80%+ code coverage
 */

// Mock Prisma Client before importing
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userAuditLog: {
    create: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    UserRole: {
      Partner: 'Partner',
      Associate: 'Associate',
      Paralegal: 'Paralegal',
    },
    UserStatus: {
      Pending: 'Pending',
      Active: 'Active',
      Inactive: 'Inactive',
    },
  };
});

import { UserManagementService } from '../../src/services/user-management.service';
import { UserRole, UserStatus } from '@prisma/client';

describe('UserManagementService', () => {
  let userManagementService: UserManagementService;

  beforeEach(() => {
    // Create new UserManagementService instance and inject mocked Prisma
    userManagementService = new UserManagementService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('getPendingUsers', () => {
    it('should return all pending users ordered by createdAt desc', async () => {
      const mockPendingUsers = [
        {
          id: 'user-1',
          email: 'user1@lawfirm.ro',
          firstName: 'John',
          lastName: 'Doe',
          role: UserRole.Paralegal,
          status: UserStatus.Pending,
          azureAdId: 'azure-123',
          firmId: null,
          preferences: {},
          createdAt: new Date('2025-11-20T10:00:00Z'),
          lastActive: new Date('2025-11-20T10:00:00Z'),
        },
        {
          id: 'user-2',
          email: 'user2@lawfirm.ro',
          firstName: 'Jane',
          lastName: 'Smith',
          role: UserRole.Paralegal,
          status: UserStatus.Pending,
          azureAdId: 'azure-456',
          firmId: null,
          preferences: {},
          createdAt: new Date('2025-11-19T10:00:00Z'),
          lastActive: new Date('2025-11-19T10:00:00Z'),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockPendingUsers);

      const result = await userManagementService.getPendingUsers();

      expect(result).toEqual(mockPendingUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          status: UserStatus.Pending,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return empty array if no pending users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await userManagementService.getPendingUsers();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveUsers', () => {
    it('should return active users for specific firm ordered by lastName', async () => {
      const firmId = 'firm-123';
      const mockActiveUsers = [
        {
          id: 'user-1',
          email: 'alice@lawfirm.ro',
          firstName: 'Alice',
          lastName: 'Anderson',
          role: UserRole.Associate,
          status: UserStatus.Active,
          azureAdId: 'azure-123',
          firmId: firmId,
          preferences: {},
          createdAt: new Date('2025-11-20T10:00:00Z'),
          lastActive: new Date('2025-11-20T10:00:00Z'),
        },
        {
          id: 'user-2',
          email: 'bob@lawfirm.ro',
          firstName: 'Bob',
          lastName: 'Brown',
          role: UserRole.Partner,
          status: UserStatus.Active,
          azureAdId: 'azure-456',
          firmId: firmId,
          preferences: {},
          createdAt: new Date('2025-11-19T10:00:00Z'),
          lastActive: new Date('2025-11-20T12:00:00Z'),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockActiveUsers);

      const result = await userManagementService.getActiveUsers(firmId);

      expect(result).toEqual(mockActiveUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          firmId: firmId,
          status: UserStatus.Active,
        },
        orderBy: {
          lastName: 'asc',
        },
      });
    });

    it('should return empty array if no active users in firm', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await userManagementService.getActiveUsers('firm-123');

      expect(result).toEqual([]);
    });
  });

  describe('activateUser', () => {
    it('should activate a pending user successfully', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440001';
      const firmId = '550e8400-e29b-41d4-a716-446655440002';
      const role = UserRole.Associate;
      const adminUserId = '550e8400-e29b-41d4-a716-446655440003';

      const mockPendingUser = {
        id: userId,
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Paralegal,
        status: UserStatus.Pending,
        azureAdId: 'azure-123',
        firmId: null,
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      const mockActivatedUser = {
        ...mockPendingUser,
        status: UserStatus.Active,
        firmId: firmId,
        role: role,
        lastActive: expect.any(Date),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockPendingUser);
      mockPrisma.user.update.mockResolvedValue(mockActivatedUser);
      mockPrisma.userAuditLog.create.mockResolvedValue({});

      const result = await userManagementService.activateUser(
        userId,
        firmId,
        role,
        adminUserId
      );

      expect(result).toEqual(mockActivatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          status: UserStatus.Active,
          firmId: firmId,
          role: role,
          lastActive: expect.any(Date),
        },
      });
      expect(mockPrisma.userAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: userId,
          action: 'Activated',
          adminUserId: adminUserId,
          oldValue: 'Pending',
          newValue: `Active|${role}|${firmId}`,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userManagementService.activateUser(
          'nonexistent-user',
          'firm-123',
          UserRole.Associate,
          'admin-123'
        )
      ).rejects.toThrow('User not found: nonexistent-user');
    });

    it('should throw error if user is not pending', async () => {
      const mockActiveUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Active, // Already active
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(
        userManagementService.activateUser(
          'user-123',
          'firm-123',
          UserRole.Associate,
          'admin-123'
        )
      ).rejects.toThrow('User cannot be activated. Current status: Active. Expected: Pending');
    });

    it('should throw error if invalid role provided', async () => {
      const mockPendingUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Paralegal,
        status: UserStatus.Pending,
        azureAdId: 'azure-123',
        firmId: null,
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockPendingUser);

      await expect(
        userManagementService.activateUser(
          'user-123',
          'firm-123',
          'InvalidRole' as any,
          'admin-123'
        )
      ).rejects.toThrow('Invalid role: InvalidRole');
    });

    it('should throw error if firmId is empty (SEC-001)', async () => {
      const mockPendingUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Paralegal,
        status: UserStatus.Pending,
        azureAdId: 'azure-123',
        firmId: null,
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockPendingUser);

      await expect(
        userManagementService.activateUser(
          'user-123',
          '', // Empty firmId
          UserRole.Associate,
          'admin-123'
        )
      ).rejects.toThrow('Firm ID is required');
    });

    it('should throw error if firmId has invalid UUID format (SEC-001)', async () => {
      const mockPendingUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Paralegal,
        status: UserStatus.Pending,
        azureAdId: 'azure-123',
        firmId: null,
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockPendingUser);

      await expect(
        userManagementService.activateUser(
          'user-123',
          'invalid-uuid-format', // Invalid UUID
          UserRole.Associate,
          'admin-123'
        )
      ).rejects.toThrow('Invalid firm ID format');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate an active user successfully', async () => {
      const userId = 'user-123';
      const adminUserId = 'admin-789';

      const mockActiveUser = {
        id: userId,
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Active,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      const mockDeactivatedUser = {
        ...mockActiveUser,
        status: UserStatus.Inactive,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue(mockDeactivatedUser);
      mockPrisma.userAuditLog.create.mockResolvedValue({});

      const result = await userManagementService.deactivateUser(
        userId,
        adminUserId
      );

      expect(result).toEqual(mockDeactivatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          status: UserStatus.Inactive,
        },
      });
      expect(mockPrisma.userAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: userId,
          action: 'Deactivated',
          adminUserId: adminUserId,
          oldValue: 'Active',
          newValue: 'Inactive',
          timestamp: expect.any(Date),
        },
      });
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userManagementService.deactivateUser('nonexistent-user', 'admin-123')
      ).rejects.toThrow('User not found: nonexistent-user');
    });

    it('should throw error if user is not active', async () => {
      const mockInactiveUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Inactive, // Already inactive
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockInactiveUser);

      await expect(
        userManagementService.deactivateUser('user-123', 'admin-123')
      ).rejects.toThrow('User cannot be deactivated. Current status: Inactive. Expected: Active');
    });

    it('should throw error if trying to deactivate own account (SEC-002)', async () => {
      const userId = 'user-123';
      const adminUserId = 'user-123'; // Same user trying to deactivate themselves

      const mockActiveUser = {
        id: userId,
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Partner,
        status: UserStatus.Active,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(
        userManagementService.deactivateUser(userId, adminUserId)
      ).rejects.toThrow('Cannot deactivate your own account');
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const userId = 'user-123';
      const newRole = UserRole.Partner;
      const adminUserId = 'admin-789';

      const mockActiveUser = {
        id: userId,
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate, // Current role
        status: UserStatus.Active,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      const mockUpdatedUser = {
        ...mockActiveUser,
        role: newRole,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);
      mockPrisma.userAuditLog.create.mockResolvedValue({});

      const result = await userManagementService.updateUserRole(
        userId,
        newRole,
        adminUserId
      );

      expect(result).toEqual(mockUpdatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          role: newRole,
        },
      });
      expect(mockPrisma.userAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: userId,
          action: 'RoleChanged',
          adminUserId: adminUserId,
          oldValue: UserRole.Associate,
          newValue: newRole,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userManagementService.updateUserRole(
          'nonexistent-user',
          UserRole.Partner,
          'admin-123'
        )
      ).rejects.toThrow('User not found: nonexistent-user');
    });

    it('should throw error if user is not active', async () => {
      const mockInactiveUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Inactive,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockInactiveUser);

      await expect(
        userManagementService.updateUserRole('user-123', UserRole.Partner, 'admin-123')
      ).rejects.toThrow('User role cannot be changed. Current status: Inactive. Expected: Active');
    });

    it('should throw error if new role is same as current role', async () => {
      const mockActiveUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Active,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(
        userManagementService.updateUserRole(
          'user-123',
          UserRole.Associate, // Same as current
          'admin-123'
        )
      ).rejects.toThrow('User already has role: Associate. No change needed.');
    });

    it('should throw error if invalid role provided', async () => {
      const mockActiveUser = {
        id: 'user-123',
        email: 'user@lawfirm.ro',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.Associate,
        status: UserStatus.Active,
        azureAdId: 'azure-123',
        firmId: 'firm-123',
        preferences: {},
        createdAt: new Date('2025-11-20T10:00:00Z'),
        lastActive: new Date('2025-11-20T10:00:00Z'),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(
        userManagementService.updateUserRole(
          'user-123',
          'InvalidRole' as any,
          'admin-123'
        )
      ).rejects.toThrow('Invalid role: InvalidRole');
    });
  });

  describe('disconnect', () => {
    it('should disconnect Prisma client', async () => {
      await userManagementService.disconnect();

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });
  });
});
