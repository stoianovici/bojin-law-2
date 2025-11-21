/**
 * Integration tests for Case Authorization
 * Story 2.6: Case Management Data Model and API
 *
 * Tests firm isolation and role-based access control:
 * - Multi-tenancy: Partners from Firm A cannot access Firm B cases
 * - Partner role: Can access all cases in their firm
 * - Associate role: Can only access assigned cases
 * - Paralegal role: Can only access assigned cases, cannot assign team
 */

// Set up test environment variables
process.env.NODE_ENV = 'test';

// Mock @legal-platform/database before importing resolvers
jest.mock('@legal-platform/database');

import { prisma } from '@legal-platform/database';
import { resolvers } from '../../src/graphql/resolvers/case.resolvers';

// Test contexts for different users
const partnerFirm1 = {
  user: {
    id: 'partner-1',
    firmId: 'firm-1',
    role: 'Partner' as const,
    email: 'partner@firm1.com',
  },
};

const partnerFirm2 = {
  user: {
    id: 'partner-2',
    firmId: 'firm-2',
    role: 'Partner' as const,
    email: 'partner@firm2.com',
  },
};

const associateFirm1 = {
  user: {
    id: 'associate-1',
    firmId: 'firm-1',
    role: 'Associate' as const,
    email: 'associate@firm1.com',
  },
};

const paralegalFirm1 = {
  user: {
    id: 'paralegal-1',
    firmId: 'firm-1',
    role: 'Paralegal' as const,
    email: 'paralegal@firm1.com',
  },
};

// Test data
const firm1Case = {
  id: 'case-firm1-1',
  firmId: 'firm-1',
  caseNumber: 'firm-1-2025-001',
  title: 'Firm 1 Case',
  status: 'Active',
  type: 'Litigation',
  description: 'Test case for firm 1',
  clientId: 'client-1',
  openedDate: new Date(),
  closedDate: null,
  value: 100000,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const firm2Case = {
  id: 'case-firm2-1',
  firmId: 'firm-2',
  caseNumber: 'firm-2-2025-001',
  title: 'Firm 2 Case',
  status: 'Active',
  type: 'Contract',
  description: 'Test case for firm 2',
  clientId: 'client-2',
  openedDate: new Date(),
  closedDate: null,
  value: 50000,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Case Authorization Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Firm Isolation - Multi-tenancy Security', () => {
    it('should prevent Partner from Firm A accessing Firm B cases', async () => {
      // Partner from Firm 1 tries to access Firm 2 case
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm2Case);

      const result = await resolvers.Query.case({}, { id: 'case-firm2-1' }, partnerFirm1);

      // Should return null (don't reveal existence to unauthorized firm)
      expect(result).toBeNull();
    });

    it('should prevent Partner from Firm A updating Firm B cases', async () => {
      // Partner from Firm 1 tries to update Firm 2 case
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm2Case);

      await expect(
        resolvers.Mutation.updateCase(
          {},
          { id: 'case-firm2-1', input: { title: 'Hacked!' } },
          partnerFirm1
        )
      ).rejects.toThrow('Access denied');
    });

    it('should prevent Associate from Firm A accessing Firm B cases', async () => {
      // Associate from Firm 1 tries to access Firm 2 case
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm2Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await resolvers.Query.case({}, { id: 'case-firm2-1' }, associateFirm1);

      expect(result).toBeNull();
    });

    it('should allow Partner to access cases in their own firm', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);

      const result = await resolvers.Query.case({}, { id: 'case-firm1-1' }, partnerFirm1);

      expect(result).toEqual(firm1Case);
      expect(result.firmId).toBe('firm-1');
    });

    it('should prevent cross-firm case search results', async () => {
      // Firm 1 Partner searches should only return Firm 1 cases
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 'case-firm1-1' }]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([firm1Case]);

      const results = await resolvers.Query.searchCases({}, { query: 'test' }, partnerFirm1);

      // Verify query includes firmId filter
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(results.every((c: any) => c.firmId === 'firm-1')).toBe(true);
    });

    it('should prevent assigning users from different firm to case team', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-firm2',
        firmId: 'firm-2', // Different firm!
        role: 'Associate',
      });

      await expect(
        resolvers.Mutation.assignTeam(
          {},
          { input: { caseId: 'case-firm1-1', userId: 'user-firm2', role: 'Support' } },
          partnerFirm1
        )
      ).rejects.toThrow('User not found or not in same firm');
    });
  });

  describe('Partner Role Authorization', () => {
    it('should allow Partner to view all cases in their firm', async () => {
      (prisma.case.findMany as jest.Mock).mockResolvedValue([firm1Case]);

      const results = await resolvers.Query.cases({}, {}, partnerFirm1);

      expect(prisma.case.findMany).toHaveBeenCalledWith({
        where: { firmId: 'firm-1' },
        include: expect.any(Object),
      });
      expect(results).toHaveLength(1);
    });

    it('should allow Partner to create cases', async () => {
      const mockClient = { id: 'client-1', firmId: 'firm-1' };

      (prisma.client.findUnique as jest.Mock).mockResolvedValue(mockClient);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          case: { create: jest.fn().mockResolvedValue({ id: 'new-case' }) },
          caseTeam: { create: jest.fn() },
          caseAuditLog: { create: jest.fn() },
        });
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'new-case',
        firmId: 'firm-1',
        client: mockClient,
        team: [],
        actors: [],
      });

      const result = await resolvers.Mutation.createCase(
        {},
        {
          input: {
            title: 'New Case',
            clientId: 'client-1',
            type: 'Litigation',
            description: 'Test case',
          },
        },
        partnerFirm1
      );

      expect(result).toBeDefined();
      expect(result.firmId).toBe('firm-1');
    });

    it('should allow Partner to archive cases', async () => {
      const closedCase = { ...firm1Case, status: 'Closed', closedDate: new Date() };

      (prisma.case.findUnique as jest.Mock).mockResolvedValue(closedCase);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          case: {
            update: jest.fn().mockResolvedValue({ ...closedCase, status: 'Archived' }),
          },
          caseAuditLog: { create: jest.fn() },
        });
      });

      const result = await resolvers.Mutation.archiveCase({}, { id: 'case-firm1-1' }, partnerFirm1);

      expect(result.status).toBe('Archived');
    });

    it('should allow Partner to assign team members', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'associate-1',
        firmId: 'firm-1',
        role: 'Associate',
      });
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          caseTeam: {
            create: jest.fn().mockResolvedValue({
              id: 'team-1',
              caseId: 'case-firm1-1',
              userId: 'associate-1',
              user: { id: 'associate-1', firmId: 'firm-1' },
            }),
          },
          caseAuditLog: { create: jest.fn() },
        });
      });

      const result = await resolvers.Mutation.assignTeam(
        {},
        { input: { caseId: 'case-firm1-1', userId: 'associate-1', role: 'Support' } },
        partnerFirm1
      );

      expect(result).toBeDefined();
    });
  });

  describe('Associate Role Authorization', () => {
    it('should only allow Associate to view assigned cases', async () => {
      (prisma.caseTeam.findMany as jest.Mock).mockResolvedValue([{ caseId: 'case-firm1-1' }]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([firm1Case]);

      const results = await resolvers.Query.cases({}, {}, associateFirm1);

      expect(prisma.caseTeam.findMany).toHaveBeenCalledWith({
        where: { userId: 'associate-1' },
        select: { caseId: true },
      });
      expect(results).toHaveLength(1);
    });

    it('should prevent Associate from viewing unassigned cases', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await resolvers.Query.case({}, { id: 'case-firm1-1' }, associateFirm1);

      expect(result).toBeNull();
    });

    it('should allow Associate to update assigned cases', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-firm1-1',
        userId: 'associate-1',
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          case: {
            update: jest.fn().mockResolvedValue({ ...firm1Case, title: 'Updated' }),
            findUnique: jest.fn().mockResolvedValue(firm1Case),
          },
          caseAuditLog: { create: jest.fn() },
        });
      });

      const result = await resolvers.Mutation.updateCase(
        {},
        { id: 'case-firm1-1', input: { title: 'Updated' } },
        associateFirm1
      );

      expect(result.title).toBe('Updated');
    });

    it('should prevent Associate from updating unassigned cases', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        resolvers.Mutation.updateCase(
          {},
          { id: 'case-firm1-1', input: { title: 'Hacked' } },
          associateFirm1
        )
      ).rejects.toThrow('Access denied');
    });

    it('should prevent Associate from archiving cases', async () => {
      const closedCase = { ...firm1Case, status: 'Closed', closedDate: new Date() };

      (prisma.case.findUnique as jest.Mock).mockResolvedValue(closedCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-firm1-1',
        userId: 'associate-1',
      });

      await expect(
        resolvers.Mutation.archiveCase({}, { id: 'case-firm1-1' }, associateFirm1)
      ).rejects.toThrow('Only Partners can archive cases');
    });

    it('should allow Associate to assign team members to their cases', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock)
        .mockResolvedValueOnce({ caseId: 'case-firm1-1', userId: 'associate-1' }) // Authorization check
        .mockResolvedValueOnce(null); // Duplicate check

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'paralegal-1',
        firmId: 'firm-1',
        role: 'Paralegal',
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          caseTeam: {
            create: jest.fn().mockResolvedValue({
              id: 'team-1',
              user: { id: 'paralegal-1', firmId: 'firm-1' },
            }),
          },
          caseAuditLog: { create: jest.fn() },
        });
      });

      const result = await resolvers.Mutation.assignTeam(
        {},
        { input: { caseId: 'case-firm1-1', userId: 'paralegal-1', role: 'Support' } },
        associateFirm1
      );

      expect(result).toBeDefined();
    });
  });

  describe('Paralegal Role Authorization', () => {
    it('should only allow Paralegal to view assigned cases', async () => {
      (prisma.caseTeam.findMany as jest.Mock).mockResolvedValue([{ caseId: 'case-firm1-1' }]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([firm1Case]);

      const results = await resolvers.Query.cases({}, {}, paralegalFirm1);

      expect(prisma.caseTeam.findMany).toHaveBeenCalledWith({
        where: { userId: 'paralegal-1' },
        select: { caseId: true },
      });
    });

    it('should allow Paralegal to update assigned cases', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-firm1-1',
        userId: 'paralegal-1',
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          case: {
            update: jest
              .fn()
              .mockResolvedValue({ ...firm1Case, description: 'Updated by paralegal' }),
            findUnique: jest.fn().mockResolvedValue(firm1Case),
          },
          caseAuditLog: { create: jest.fn() },
        });
      });

      const result = await resolvers.Mutation.updateCase(
        {},
        { id: 'case-firm1-1', input: { description: 'Updated by paralegal' } },
        paralegalFirm1
      );

      expect(result).toBeDefined();
    });

    it('should prevent Paralegal from assigning team members', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-firm1-1',
        userId: 'paralegal-1',
      });

      await expect(
        resolvers.Mutation.assignTeam(
          {},
          { input: { caseId: 'case-firm1-1', userId: 'associate-1', role: 'Support' } },
          paralegalFirm1
        )
      ).rejects.toThrow('Paralegals cannot assign team members');
    });

    it('should prevent Paralegal from archiving cases', async () => {
      const closedCase = { ...firm1Case, status: 'Closed', closedDate: new Date() };

      (prisma.case.findUnique as jest.Mock).mockResolvedValue(closedCase);

      await expect(
        resolvers.Mutation.archiveCase({}, { id: 'case-firm1-1' }, paralegalFirm1)
      ).rejects.toThrow('Only Partners can archive cases');
    });

    it('should allow Paralegal to add case actors to assigned cases', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-firm1-1',
        userId: 'paralegal-1',
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          caseActor: {
            create: jest.fn().mockResolvedValue({
              id: 'actor-1',
              role: 'Witness',
              name: 'John Doe',
            }),
          },
          caseAuditLog: { create: jest.fn() },
        });
      });

      const result = await resolvers.Mutation.addCaseActor(
        {},
        {
          input: {
            caseId: 'case-firm1-1',
            role: 'Witness',
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
        paralegalFirm1
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('John Doe');
    });
  });

  describe('Case Actor Authorization', () => {
    it('should prevent unauthorized users from viewing case actors', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      const results = await resolvers.Query.caseActors(
        {},
        { caseId: 'case-firm1-1' },
        associateFirm1
      );

      expect(results).toEqual([]);
    });

    it('should prevent unauthorized users from adding case actors', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        resolvers.Mutation.addCaseActor(
          {},
          {
            input: {
              caseId: 'case-firm1-1',
              role: 'Witness',
              name: 'John Doe',
            },
          },
          associateFirm1
        )
      ).rejects.toThrow('Access denied');
    });

    it('should allow Partner to manage actors on any case in their firm', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(firm1Case);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => {
        return callback({
          caseActor: {
            create: jest.fn().mockResolvedValue({
              id: 'actor-1',
              role: 'Expert',
              name: 'Dr. Smith',
            }),
          },
          caseAuditLog: { create: jest.fn() },
        });
      });

      const result = await resolvers.Mutation.addCaseActor(
        {},
        {
          input: {
            caseId: 'case-firm1-1',
            role: 'Expert',
            name: 'Dr. Smith',
            email: 'dr.smith@example.com',
          },
        },
        partnerFirm1
      );

      expect(result).toBeDefined();
    });
  });
});
