/**
 * Unit tests for Case Mutation Resolvers
 * Story 2.6: Case Management Data Model and API
 * Story 2.11.1: Business Owner Role
 *
 * Tests authorization, validation, and mutation logic for:
 * - createCase
 * - updateCase
 * - archiveCase
 * - assignTeam
 * - removeTeamMember
 * - addCaseActor
 * - updateCaseActor
 * - removeCaseActor
 */

// Set up test environment variables
process.env.NODE_ENV = 'test';

import { GraphQLError } from 'graphql';

// Mock @legal-platform/database before importing resolvers
jest.mock('@legal-platform/database');

import { prisma } from '@legal-platform/database';
import { resolvers } from '../../../src/graphql/resolvers/case.resolvers';

// Type definitions
interface MockContext {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

describe('Case Mutation Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCase mutation', () => {
    const mockPartner: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    const validInput = {
      title: 'Test Case',
      clientId: 'client-1',
      type: 'Litigation',
      description: 'Test case description',
      value: 100000,
    };

    it('should throw error if user not authenticated', async () => {
      await expect(resolvers.Mutation.createCase({}, { input: validInput }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should throw error if title too short', async () => {
      await expect(
        resolvers.Mutation.createCase({}, { input: { ...validInput, title: 'ab' } }, mockPartner)
      ).rejects.toThrow('Title must be 3-500 characters');
    });

    it('should throw error if title too long', async () => {
      const longTitle = 'a'.repeat(501);
      await expect(
        resolvers.Mutation.createCase(
          {},
          { input: { ...validInput, title: longTitle } },
          mockPartner
        )
      ).rejects.toThrow('Title must be 3-500 characters');
    });

    it('should throw error if client not found', async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        resolvers.Mutation.createCase({}, { input: validInput }, mockPartner)
      ).rejects.toThrow('Client not found');
    });

    it('should throw error if client belongs to different firm', async () => {
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-1',
        firmId: 'firm-2', // Different firm
      });

      await expect(
        resolvers.Mutation.createCase({}, { input: validInput }, mockPartner)
      ).rejects.toThrow('Client not found');
    });

    it('should create case with generated case number', async () => {
      const mockClient = { id: 'client-1', firmId: 'firm-1' };
      const mockCreatedCase = {
        id: 'case-1',
        firmId: 'firm-1',
        caseNumber: 'firm-1-2025-001',
        title: 'Test Case',
        clientId: 'client-1',
        status: 'Active',
        type: 'Litigation',
        description: 'Test case description',
        openedDate: new Date(),
        value: 100000,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.client.findUnique as jest.Mock).mockResolvedValue(mockClient);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          case: {
            create: jest.fn().mockResolvedValue(mockCreatedCase),
          },
          caseTeam: {
            create: jest.fn(),
          },
          caseAuditLog: {
            create: jest.fn(),
          },
        });
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        ...mockCreatedCase,
        client: mockClient,
        team: [{ user: mockPartner.user }],
        actors: [],
      });

      const result = await resolvers.Mutation.createCase({}, { input: validInput }, mockPartner);

      expect(result.caseNumber).toMatch(/^firm-1-\d{4}-\d{3}$/);
      expect(result.status).toBe('Active');
      expect(result.openedDate).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should assign creator to case team as Lead', async () => {
      const mockClient = { id: 'client-1', firmId: 'firm-1' };

      (prisma.client.findUnique as jest.Mock).mockResolvedValue(mockClient);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const mockTransaction = jest.fn();
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          case: { create: jest.fn().mockResolvedValue({ id: 'case-1' }) },
          caseTeam: { create: mockTransaction },
          caseAuditLog: { create: jest.fn() },
        };
        await callback(mockTx);
        return mockTx.case.create();
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        client: mockClient,
        team: [],
        actors: [],
      });

      await resolvers.Mutation.createCase({}, { input: validInput }, mockPartner);

      expect(mockTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          role: 'Lead',
          assignedBy: 'user-1',
        })
      );
    });

    it('should create audit log entry for case creation', async () => {
      const mockClient = { id: 'client-1', firmId: 'firm-1' };
      const mockAuditLog = jest.fn();

      (prisma.client.findUnique as jest.Mock).mockResolvedValue(mockClient);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          case: { create: jest.fn().mockResolvedValue({ id: 'case-1' }) },
          caseTeam: { create: jest.fn() },
          caseAuditLog: { create: mockAuditLog },
        };
        await callback(mockTx);
        return mockTx.case.create();
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        client: mockClient,
        team: [],
        actors: [],
      });

      await resolvers.Mutation.createCase({}, { input: validInput }, mockPartner);

      expect(mockAuditLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATED',
            userId: 'user-1',
          }),
        }),
      });
    });
  });

  describe('updateCase mutation', () => {
    const mockCase = {
      id: 'case-1',
      firmId: 'firm-1',
      title: 'Original Title',
      status: 'Active',
      type: 'Litigation',
      description: 'Original description',
      clientId: 'client-1',
      openedDate: new Date(),
      closedDate: null,
      value: 50000,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPartner: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    const mockAssociate: MockContext = {
      user: {
        id: 'user-2',
        firmId: 'firm-1',
        role: 'Associate',
        email: 'associate@firm1.com',
      },
    };

    it('should throw error if user not authenticated', async () => {
      await expect(
        resolvers.Mutation.updateCase({}, { id: 'case-1', input: {} }, {})
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error if title validation fails', async () => {
      await expect(
        resolvers.Mutation.updateCase({}, { id: 'case-1', input: { title: 'ab' } }, mockPartner)
      ).rejects.toThrow('Title must be 3-500 characters');
    });

    it('should throw error if user cannot access case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        resolvers.Mutation.updateCase(
          {},
          { id: 'case-1', input: { title: 'New Title' } },
          mockAssociate
        )
      ).rejects.toThrow('Access denied');
    });

    it('should allow Partner to update case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const mockUpdate = jest.fn().mockResolvedValue({ ...mockCase, title: 'Updated Title' });
      const mockAuditLog = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          case: { update: mockUpdate, findUnique: jest.fn().mockResolvedValue(mockCase) },
          caseAuditLog: { create: mockAuditLog },
        };
        return callback(mockTx);
      });

      await resolvers.Mutation.updateCase(
        {},
        { id: 'case-1', input: { title: 'Updated Title' } },
        mockPartner
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: { title: 'Updated Title' },
        include: expect.any(Object),
      });
    });

    it('should allow assigned Associate to update case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-1',
        userId: 'user-2',
      });

      const mockUpdate = jest.fn().mockResolvedValue({ ...mockCase, description: 'Updated' });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          case: { update: mockUpdate, findUnique: jest.fn().mockResolvedValue(mockCase) },
          caseAuditLog: { create: jest.fn() },
        };
        return callback(mockTx);
      });

      await resolvers.Mutation.updateCase(
        {},
        { id: 'case-1', input: { description: 'Updated' } },
        mockAssociate
      );

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should create audit log for each changed field', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const mockAuditLog = jest.fn();
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          case: {
            update: jest
              .fn()
              .mockResolvedValue({ ...mockCase, title: 'New Title', status: 'Closed' }),
            findUnique: jest.fn().mockResolvedValue(mockCase),
          },
          caseAuditLog: { create: mockAuditLog },
        };
        return callback(mockTx);
      });

      await resolvers.Mutation.updateCase(
        {},
        { id: 'case-1', input: { title: 'New Title', status: 'Closed' } },
        mockPartner
      );

      expect(mockAuditLog).toHaveBeenCalledTimes(2); // Once for each field
      expect(mockAuditLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPDATED',
          fieldName: 'title',
          oldValue: 'Original Title',
          newValue: 'New Title',
        }),
      });
    });

    it('should prevent reopening archived case', async () => {
      const archivedCase = { ...mockCase, status: 'Archived' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(archivedCase);

      await expect(
        resolvers.Mutation.updateCase(
          {},
          { id: 'case-1', input: { status: 'Active' } },
          mockPartner
        )
      ).rejects.toThrow('Cannot reopen archived case');
    });
  });

  describe('archiveCase mutation', () => {
    const mockCase = {
      id: 'case-1',
      firmId: 'firm-1',
      status: 'Closed',
      caseNumber: 'firm-1-2025-001',
      title: 'Test Case',
      clientId: 'client-1',
      type: 'Litigation',
      description: 'Test',
      openedDate: new Date(),
      closedDate: new Date(),
      value: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPartner: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    const mockAssociate: MockContext = {
      user: {
        id: 'user-2',
        firmId: 'firm-1',
        role: 'Associate',
        email: 'associate@firm1.com',
      },
    };

    it('should throw error if user not authenticated', async () => {
      await expect(resolvers.Mutation.archiveCase({}, { id: 'case-1' }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should throw error if user is not Partner', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      await expect(
        resolvers.Mutation.archiveCase({}, { id: 'case-1' }, mockAssociate)
      ).rejects.toThrow('Only Partners can archive cases');
    });

    it('should throw error if case not closed', async () => {
      const activeCase = { ...mockCase, status: 'Active' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(activeCase);

      await expect(
        resolvers.Mutation.archiveCase({}, { id: 'case-1' }, mockPartner)
      ).rejects.toThrow('Only closed cases can be archived');
    });

    it('should archive case if Partner and case is closed', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const mockUpdate = jest.fn().mockResolvedValue({ ...mockCase, status: 'Archived' });
      const mockAuditLog = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          case: { update: mockUpdate },
          caseAuditLog: { create: mockAuditLog },
        };
        return callback(mockTx);
      });

      const result = await resolvers.Mutation.archiveCase({}, { id: 'case-1' }, mockPartner);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'case-1' },
        data: { status: 'Archived' },
        include: expect.any(Object),
      });
      expect(mockAuditLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ARCHIVED',
          userId: 'user-1',
        }),
      });
    });
  });

  describe('assignTeam mutation', () => {
    const mockCase = {
      id: 'case-1',
      firmId: 'firm-1',
    };

    const mockUser = {
      id: 'user-2',
      firmId: 'firm-1',
      role: 'Associate',
    };

    const mockPartner: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    const mockParalegal: MockContext = {
      user: {
        id: 'user-3',
        firmId: 'firm-1',
        role: 'Paralegal',
        email: 'paralegal@firm1.com',
      },
    };

    const validInput = {
      caseId: 'case-1',
      userId: 'user-2',
      role: 'Support',
    };

    it('should throw error if user not authenticated', async () => {
      await expect(resolvers.Mutation.assignTeam({}, { input: validInput }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should throw error if Paralegal attempts to assign', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-1',
        userId: 'user-3',
      });

      await expect(
        resolvers.Mutation.assignTeam({}, { input: validInput }, mockParalegal)
      ).rejects.toThrow('Paralegals cannot assign team members');
    });

    it('should throw error if user being assigned from different firm', async () => {
      const otherFirmUser = { ...mockUser, firmId: 'firm-2' };

      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(otherFirmUser);

      await expect(
        resolvers.Mutation.assignTeam({}, { input: validInput }, mockPartner)
      ).rejects.toThrow('User not found or not in same firm');
    });

    it('should throw error if user already assigned to case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.caseTeam.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // First call for authorization
        .mockResolvedValueOnce({ caseId: 'case-1', userId: 'user-2' }); // Second call for duplicate check

      await expect(
        resolvers.Mutation.assignTeam({}, { input: validInput }, mockPartner)
      ).rejects.toThrow('User already assigned to this case');
    });

    it('should assign user to case team and create audit log', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreate = jest.fn().mockResolvedValue({
        id: 'team-1',
        caseId: 'case-1',
        userId: 'user-2',
        role: 'Support',
        user: mockUser,
      });
      const mockAuditLog = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          caseTeam: { create: mockCreate },
          caseAuditLog: { create: mockAuditLog },
        };
        return callback(mockTx);
      });

      const result = await resolvers.Mutation.assignTeam({}, { input: validInput }, mockPartner);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          caseId: 'case-1',
          userId: 'user-2',
          role: 'Support',
          assignedBy: 'user-1',
          assignedAt: expect.any(Date),
        },
        include: { user: true },
      });
      expect(mockAuditLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'TEAM_ASSIGNED',
          newValue: 'user-2',
        }),
      });
    });
  });

  describe('addCaseActor mutation', () => {
    const mockCase = {
      id: 'case-1',
      firmId: 'firm-1',
    };

    const mockContext: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Associate',
        email: 'associate@firm1.com',
      },
    };

    const validInput = {
      caseId: 'case-1',
      role: 'Witness',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    };

    it('should throw error if user not authenticated', async () => {
      await expect(resolvers.Mutation.addCaseActor({}, { input: validInput }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should throw error if name too short', async () => {
      await expect(
        resolvers.Mutation.addCaseActor({}, { input: { ...validInput, name: 'A' } }, mockContext)
      ).rejects.toThrow('Name must be 2-200 characters');
    });

    it('should throw error if email format invalid', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-1',
        userId: 'user-1',
      });

      await expect(
        resolvers.Mutation.addCaseActor(
          {},
          { input: { ...validInput, email: 'invalid-email' } },
          mockContext
        )
      ).rejects.toThrow('Invalid email format');
    });

    it('should create case actor and audit log', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-1',
        userId: 'user-1',
      });

      const mockCreate = jest.fn().mockResolvedValue({
        id: 'actor-1',
        ...validInput,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const mockAuditLog = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          caseActor: { create: mockCreate },
          caseAuditLog: { create: mockAuditLog },
        };
        return callback(mockTx);
      });

      const result = await resolvers.Mutation.addCaseActor({}, { input: validInput }, mockContext);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId: 'case-1',
          role: 'Witness',
          name: 'John Doe',
          email: 'john@example.com',
          createdBy: 'user-1',
        }),
      });
      expect(mockAuditLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ACTOR_ADDED',
          newValue: 'Witness: John Doe',
        }),
      });
    });
  });

  describe('updateCaseActor mutation', () => {
    const mockActor = {
      id: 'actor-1',
      caseId: 'case-1',
      role: 'Witness',
      name: 'John Doe',
      email: 'john@example.com',
      phone: null,
      organization: null,
      address: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-1',
    };

    const mockCase = {
      id: 'case-1',
      firmId: 'firm-1',
    };

    const mockContext: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    it('should throw error if user not authenticated', async () => {
      await expect(
        resolvers.Mutation.updateCaseActor({}, { id: 'actor-1', input: {} }, {})
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error if email format invalid', async () => {
      (prisma.caseActor.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      await expect(
        resolvers.Mutation.updateCaseActor(
          {},
          { id: 'actor-1', input: { email: 'bad-email' } },
          mockContext
        )
      ).rejects.toThrow('Invalid email format');
    });

    it('should update case actor and create audit log', async () => {
      (prisma.caseActor.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const mockUpdate = jest.fn().mockResolvedValue({
        ...mockActor,
        phone: '+9876543210',
      });
      const mockAuditLog = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          caseActor: { update: mockUpdate, findUnique: jest.fn().mockResolvedValue(mockActor) },
          caseAuditLog: { create: mockAuditLog },
        };
        return callback(mockTx);
      });

      await resolvers.Mutation.updateCaseActor(
        {},
        { id: 'actor-1', input: { phone: '+9876543210' } },
        mockContext
      );

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'actor-1' },
        data: { phone: '+9876543210' },
      });
      expect(mockAuditLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'UPDATED',
          fieldName: 'phone',
        }),
      });
    });
  });

  describe('removeCaseActor mutation', () => {
    const mockActor = {
      id: 'actor-1',
      caseId: 'case-1',
      role: 'Witness',
      name: 'John Doe',
    };

    const mockCase = {
      id: 'case-1',
      firmId: 'firm-1',
    };

    const mockContext: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    it('should throw error if user not authenticated', async () => {
      await expect(resolvers.Mutation.removeCaseActor({}, { id: 'actor-1' }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should delete case actor and create audit log', async () => {
      (prisma.caseActor.findUnique as jest.Mock).mockResolvedValue(mockActor);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const mockDelete = jest.fn().mockResolvedValue(mockActor);
      const mockAuditLog = jest.fn();

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        const mockTx = {
          caseActor: { delete: mockDelete },
          caseAuditLog: { create: mockAuditLog },
        };
        return callback(mockTx);
      });

      const result = await resolvers.Mutation.removeCaseActor({}, { id: 'actor-1' }, mockContext);

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: 'actor-1' },
      });
      expect(mockAuditLog).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'ACTOR_REMOVED',
          oldValue: 'Witness: John Doe',
        }),
      });
    });
  });
});
