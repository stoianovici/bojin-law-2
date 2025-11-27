/**
 * Unit tests for Case Query Resolvers
 * Story 2.6: Case Management Data Model and API
 * Story 2.11.1: Business Owner Role
 *
 * Tests authorization, firm isolation, and query logic for:
 * - cases query (with filters)
 * - case query (single)
 * - searchCases query
 * - caseActors query
 * - caseActorsByRole query
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

describe('Case Query Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cases query', () => {
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

    const mockCases = [
      {
        id: 'case-1',
        firmId: 'firm-1',
        caseNumber: 'firm-1-2025-001',
        title: 'Test Case 1',
        status: 'Active',
        type: 'Litigation',
        description: 'Test description',
        clientId: 'client-1',
        openedDate: new Date('2025-01-01'),
        closedDate: null,
        value: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'case-2',
        firmId: 'firm-1',
        caseNumber: 'firm-1-2025-002',
        title: 'Test Case 2',
        status: 'Closed',
        type: 'Contract',
        description: 'Another test',
        clientId: 'client-2',
        openedDate: new Date('2025-01-15'),
        closedDate: new Date('2025-02-01'),
        value: 50000,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should throw error if user not authenticated', async () => {
      const context: MockContext = {};

      await expect(resolvers.Query.cases({}, {}, context)).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should return all firm cases for Partner role', async () => {
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);

      const result = await resolvers.Query.cases({}, {}, mockPartner);

      expect(result).toEqual(mockCases);
      expect(prisma.case.findMany).toHaveBeenCalledWith({
        where: { firmId: 'firm-1' },
        include: {
          client: true,
          teamMembers: {
            include: { user: true },
          },
          actors: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return only assigned cases for Associate role', async () => {
      const assignedCases = [mockCases[0]];

      (prisma.caseTeam.findMany as jest.Mock).mockResolvedValue([
        { caseId: 'case-1', userId: 'user-2' },
      ]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(assignedCases);

      const result = await resolvers.Query.cases({}, {}, mockAssociate);

      expect(result).toEqual(assignedCases);
      expect(prisma.caseTeam.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-2' },
        select: { caseId: true },
      });
      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['case-1'] },
            firmId: 'firm-1',
          }),
        })
      );
    });

    it('should filter cases by status when provided', async () => {
      (prisma.case.findMany as jest.Mock).mockResolvedValue([mockCases[0]]);

      await resolvers.Query.cases({}, { status: 'Active' }, mockPartner);

      expect(prisma.case.findMany).toHaveBeenCalledWith({
        where: {
          firmId: 'firm-1',
          status: 'Active',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('should filter cases by clientId when provided', async () => {
      (prisma.case.findMany as jest.Mock).mockResolvedValue([mockCases[0]]);

      await resolvers.Query.cases({}, { clientId: 'client-1' }, mockPartner);

      expect(prisma.case.findMany).toHaveBeenCalledWith({
        where: {
          firmId: 'firm-1',
          clientId: 'client-1',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('should filter to assigned cases when assignedToMe is true', async () => {
      (prisma.caseTeam.findMany as jest.Mock).mockResolvedValue([{ caseId: 'case-1' }]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([mockCases[0]]);

      await resolvers.Query.cases({}, { assignedToMe: true }, mockPartner);

      expect(prisma.caseTeam.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { caseId: true },
      });
    });
  });

  describe('case query (single)', () => {
    const mockCase = {
      id: 'case-1',
      firmId: 'firm-1',
      caseNumber: 'firm-1-2025-001',
      title: 'Test Case',
      status: 'Active',
      type: 'Litigation',
      description: 'Test',
      clientId: 'client-1',
      openedDate: new Date(),
      closedDate: null,
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
      await expect(resolvers.Query.case({}, { id: 'case-1' }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should return null if case not found', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await resolvers.Query.case({}, { id: 'case-999' }, mockPartner);

      expect(result).toBeNull();
    });

    it('should return null if case belongs to different firm (firm isolation)', async () => {
      const otherFirmCase = { ...mockCase, firmId: 'firm-2' };
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(otherFirmCase);

      const result = await resolvers.Query.case({}, { id: 'case-1' }, mockPartner);

      expect(result).toBeNull();
    });

    it('should return case if Partner in same firm', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const result = await resolvers.Query.case({}, { id: 'case-1' }, mockPartner);

      expect(result).toEqual(mockCase);
    });

    it('should return case if Associate is assigned to case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-1',
        userId: 'user-2',
      });

      const result = await resolvers.Query.case({}, { id: 'case-1' }, mockAssociate);

      expect(result).toEqual(mockCase);
      expect(prisma.caseTeam.findUnique).toHaveBeenCalledWith({
        where: {
          caseId_userId: {
            caseId: 'case-1',
            userId: 'user-2',
          },
        },
      });
    });

    it('should return null if Associate not assigned to case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await resolvers.Query.case({}, { id: 'case-1' }, mockAssociate);

      expect(result).toBeNull();
    });
  });

  describe('searchCases query', () => {
    const mockContext: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    it('should throw error if user not authenticated', async () => {
      await expect(resolvers.Query.searchCases({}, { query: 'test' }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should require minimum 3 characters for search', async () => {
      await expect(resolvers.Query.searchCases({}, { query: 'ab' }, mockContext)).rejects.toThrow(
        'Search query must be at least 3 characters'
      );
    });

    it('should execute pg_trgm search with similarity ranking', async () => {
      const mockResults = [{ id: 'case-1' }, { id: 'case-2' }];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([
        { id: 'case-1', title: 'Test Case' },
        { id: 'case-2', title: 'Another Test' },
      ]);

      const result = await resolvers.Query.searchCases(
        {},
        { query: 'test', limit: 50 },
        mockContext
      );

      expect(result).toHaveLength(2);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.case.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['case-1', 'case-2'] },
        },
        include: expect.any(Object),
      });
    });

    it('should limit results to specified limit', async () => {
      const mockResults = Array.from({ length: 20 }, (_, i) => ({ id: `case-${i}` }));
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockResults);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      await resolvers.Query.searchCases({}, { query: 'test', limit: 20 }, mockContext);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should default to limit of 50 if not provided', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);

      await resolvers.Query.searchCases({}, { query: 'test' }, mockContext);

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('caseActors query', () => {
    const mockContext: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Associate',
        email: 'associate@firm1.com',
      },
    };

    const mockActors = [
      {
        id: 'actor-1',
        caseId: 'case-1',
        role: 'Client',
        name: 'John Doe',
        email: 'john@example.com',
        organization: null,
        phone: '+1234567890',
        address: '123 Main St',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
      },
    ];

    it('should throw error if user not authenticated', async () => {
      await expect(resolvers.Query.caseActors({}, { caseId: 'case-1' }, {})).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should return empty array if user cannot access case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        firmId: 'firm-1',
      });
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await resolvers.Query.caseActors({}, { caseId: 'case-1' }, mockContext);

      expect(result).toEqual([]);
    });

    it('should return actors if user can access case', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        firmId: 'firm-1',
      });
      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-1',
        userId: 'user-1',
      });
      (prisma.caseActor.findMany as jest.Mock).mockResolvedValue(mockActors);

      const result = await resolvers.Query.caseActors({}, { caseId: 'case-1' }, mockContext);

      expect(result).toEqual(mockActors);
      expect(prisma.caseActor.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });
    });
  });

  describe('caseActorsByRole query', () => {
    const mockContext: MockContext = {
      user: {
        id: 'user-1',
        firmId: 'firm-1',
        role: 'Partner',
        email: 'partner@firm1.com',
      },
    };

    const mockWitnesses = [
      {
        id: 'actor-1',
        caseId: 'case-1',
        role: 'Witness',
        name: 'Jane Smith',
        email: 'jane@example.com',
        organization: null,
        phone: null,
        address: null,
        notes: 'Key witness',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-1',
      },
    ];

    it('should throw error if user not authenticated', async () => {
      await expect(
        resolvers.Query.caseActorsByRole({}, { caseId: 'case-1', role: 'Witness' }, {})
      ).rejects.toThrow('Authentication required');
    });

    it('should filter actors by role', async () => {
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        firmId: 'firm-1',
      });
      (prisma.caseActor.findMany as jest.Mock).mockResolvedValue(mockWitnesses);

      const result = await resolvers.Query.caseActorsByRole(
        {},
        { caseId: 'case-1', role: 'Witness' },
        mockContext
      );

      expect(result).toEqual(mockWitnesses);
      expect(prisma.caseActor.findMany).toHaveBeenCalledWith({
        where: {
          caseId: 'case-1',
          role: 'Witness',
        },
        orderBy: { name: 'asc' },
      });
    });
  });
});
