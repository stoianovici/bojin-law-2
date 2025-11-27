/**
 * Case Billing Resolvers Unit Tests
 * Story 2.8.1: Billing & Rate Management
 *
 * Tests for case creation and updates with billing functionality
 */

import { GraphQLError } from 'graphql';
import { caseResolvers, Context } from '../../src/graphql/resolvers/case.resolvers';
import { prisma } from '@legal-platform/database';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    firm: {
      findUnique: jest.fn(),
    },
    client: {
      findUnique: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    caseTeam: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    caseAuditLog: {
      create: jest.fn(),
    },
    caseRateHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Case Billing Resolvers - Story 2.8.1', () => {
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Partner context
    mockContext = {
      user: {
        id: 'user-123',
        firmId: 'firm-456',
        role: 'Partner',
        email: 'partner@test.com',
      },
    };
  });

  describe('Mutation: createCase with Billing', () => {
    const baseInput = {
      title: 'Test Case',
      clientId: 'client-789',
      type: 'Litigation',
      description: 'Test case description for billing',
    };

    beforeEach(() => {
      // Mock client exists
      (prisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client-789',
        firmId: 'firm-456',
        name: 'Test Client',
      });

      // Mock case number generation
      (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('should create Hourly case and inherit firm default rates', async () => {
      const firmRates = {
        partnerRate: 50000,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      (prisma.firm.findUnique as jest.Mock).mockResolvedValue({
        id: 'firm-456',
        defaultRates: firmRates,
      });

      const mockCase = {
        id: 'case-001',
        firmId: 'firm-456',
        caseNumber: 'firm-456-2025-001',
        billingType: 'Hourly',
        customRates: firmRates,
        client: { id: 'client-789', name: 'Test Client' },
        teamMembers: [],
        actors: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          caseTeam: {
            create: jest.fn(),
          },
          caseAuditLog: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caseResolvers.Mutation.createCase(
        {},
        {
          input: {
            ...baseInput,
            billingType: 'Hourly',
          },
        },
        mockContext
      );

      expect(result.billingType).toBe('Hourly');
      expect(result.customRates).toEqual(firmRates);
    });

    it('should create Fixed case with fixedAmount', async () => {
      const firmRates = {
        partnerRate: 50000,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      (prisma.firm.findUnique as jest.Mock).mockResolvedValue({
        id: 'firm-456',
        defaultRates: firmRates,
      });

      const mockCase = {
        id: 'case-001',
        firmId: 'firm-456',
        caseNumber: 'firm-456-2025-001',
        billingType: 'Fixed',
        fixedAmount: 100000,
        customRates: firmRates,
        client: { id: 'client-789', name: 'Test Client' },
        teamMembers: [],
        actors: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          caseTeam: {
            create: jest.fn(),
          },
          caseAuditLog: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caseResolvers.Mutation.createCase(
        {},
        {
          input: {
            ...baseInput,
            billingType: 'Fixed',
            fixedAmount: 100000,
          },
        },
        mockContext
      );

      expect(result.billingType).toBe('Fixed');
      expect(result.fixedAmount).toBe(100000);
    });

    it('should reject Fixed case without fixedAmount', async () => {
      await expect(
        caseResolvers.Mutation.createCase(
          {},
          {
            input: {
              ...baseInput,
              billingType: 'Fixed',
              // Missing fixedAmount
            },
          },
          mockContext
        )
      ).rejects.toThrow('Fixed amount is required when billing type is Fixed');
    });

    it('should reject negative fixedAmount', async () => {
      await expect(
        caseResolvers.Mutation.createCase(
          {},
          {
            input: {
              ...baseInput,
              billingType: 'Fixed',
              fixedAmount: -1000,
            },
          },
          mockContext
        )
      ).rejects.toThrow('Fixed amount must be a positive number');
    });

    it('should allow custom rates override', async () => {
      const customRates = {
        partnerRate: 60000,
        associateRate: 35000,
        paralegalRate: 18000,
      };

      const mockCase = {
        id: 'case-001',
        firmId: 'firm-456',
        caseNumber: 'firm-456-2025-001',
        billingType: 'Hourly',
        customRates,
        client: { id: 'client-789', name: 'Test Client' },
        teamMembers: [],
        actors: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          caseTeam: {
            create: jest.fn(),
          },
          caseAuditLog: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caseResolvers.Mutation.createCase(
        {},
        {
          input: {
            ...baseInput,
            billingType: 'Hourly',
            customRates,
          },
        },
        mockContext
      );

      expect(result.customRates).toEqual(customRates);
    });

    it('should reject negative custom rates', async () => {
      await expect(
        caseResolvers.Mutation.createCase(
          {},
          {
            input: {
              ...baseInput,
              billingType: 'Hourly',
              customRates: {
                partnerRate: -1000,
                associateRate: 30000,
                paralegalRate: 15000,
              },
            },
          },
          mockContext
        )
      ).rejects.toThrow('Partner rate must be positive');
    });
  });

  describe('Mutation: updateCase with Billing', () => {
    beforeEach(() => {
      // Mock case access check
      (prisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-001',
        firmId: 'firm-456',
        billingType: 'Hourly',
        fixedAmount: null,
        customRates: { partnerRate: 50000, associateRate: 30000, paralegalRate: 15000 },
      });

      (prisma.caseTeam.findUnique as jest.Mock).mockResolvedValue({
        caseId: 'case-001',
        userId: 'user-123',
      });
    });

    it('should allow Partner to update billing type to Fixed', async () => {
      const mockUpdatedCase = {
        id: 'case-001',
        firmId: 'firm-456',
        billingType: 'Fixed',
        fixedAmount: 100000,
        customRates: { partnerRate: 50000, associateRate: 30000, paralegalRate: 15000 },
        client: { id: 'client-789', name: 'Test Client' },
        teamMembers: [],
        actors: [],
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          case: {
            update: jest.fn().mockResolvedValue(mockUpdatedCase),
          },
          caseAuditLog: {
            create: jest.fn(),
          },
          caseRateHistory: {
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await caseResolvers.Mutation.updateCase(
        {},
        {
          id: 'case-001',
          input: {
            billingType: 'Fixed',
            fixedAmount: 100000,
          },
        },
        mockContext
      );

      expect(result.billingType).toBe('Fixed');
      expect(result.fixedAmount).toBe(100000);
    });

    it('should prevent Associate from updating rates', async () => {
      mockContext.user!.role = 'Associate';

      await expect(
        caseResolvers.Mutation.updateCase(
          {},
          {
            id: 'case-001',
            input: {
              fixedAmount: 100000,
            },
          },
          mockContext
        )
      ).rejects.toThrow('Only Partners can modify billing rates');
    });

    it('should prevent Paralegal from updating rates', async () => {
      mockContext.user!.role = 'Paralegal';

      await expect(
        caseResolvers.Mutation.updateCase(
          {},
          {
            id: 'case-001',
            input: {
              customRates: {
                partnerRate: 60000,
                associateRate: 35000,
                paralegalRate: 18000,
              },
            },
          },
          mockContext
        )
      ).rejects.toThrow('Only Partners can modify billing rates');
    });

    it('should update custom rates and track history', async () => {
      const newRates = {
        partnerRate: 60000,
        associateRate: 35000,
        paralegalRate: 18000,
      };

      const mockUpdatedCase = {
        id: 'case-001',
        firmId: 'firm-456',
        billingType: 'Hourly',
        customRates: newRates,
        client: { id: 'client-789', name: 'Test Client' },
        teamMembers: [],
        actors: [],
      };

      let historyCreated = false;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          case: {
            update: jest.fn().mockResolvedValue(mockUpdatedCase),
          },
          caseAuditLog: {
            create: jest.fn(),
          },
          caseRateHistory: {
            create: jest.fn().mockImplementation(() => {
              historyCreated = true;
              return Promise.resolve({});
            }),
          },
        };
        return callback(tx);
      });

      const result = await caseResolvers.Mutation.updateCase(
        {},
        {
          id: 'case-001',
          input: {
            customRates: newRates,
          },
        },
        mockContext
      );

      expect(result.customRates).toEqual(newRates);
      expect(historyCreated).toBe(true);
    });

    it('should reject changing to Fixed without fixedAmount', async () => {
      await expect(
        caseResolvers.Mutation.updateCase(
          {},
          {
            id: 'case-001',
            input: {
              billingType: 'Fixed',
              // Missing fixedAmount
            },
          },
          mockContext
        )
      ).rejects.toThrow('Fixed amount is required when billing type is Fixed');
    });
  });

  describe('Field Resolver: Case.rateHistory', () => {
    it('should return rate history sorted by date descending', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          caseId: 'case-001',
          changedAt: new Date('2025-01-15'),
          rateType: 'partner',
          oldRate: 40000,
          newRate: 50000,
          changer: { id: 'user-123', firstName: 'John', lastName: 'Partner' },
        },
        {
          id: 'history-2',
          caseId: 'case-001',
          changedAt: new Date('2025-01-10'),
          rateType: 'associate',
          oldRate: 25000,
          newRate: 30000,
          changer: { id: 'user-123', firstName: 'John', lastName: 'Partner' },
        },
      ];

      (prisma.caseRateHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await caseResolvers.Case.rateHistory(
        { id: 'case-001' },
        {},
        mockContext
      );

      expect(result).toHaveLength(2);
      expect(result[0].rateType).toBe('PARTNER');
      expect(result[1].rateType).toBe('ASSOCIATE');
      expect(prisma.caseRateHistory.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-001' },
        include: { changer: true },
        orderBy: { changedAt: 'desc' },
        take: 50,
      });
    });

    it('should limit results to 50 entries', async () => {
      (prisma.caseRateHistory.findMany as jest.Mock).mockResolvedValue([]);

      await caseResolvers.Case.rateHistory(
        { id: 'case-001' },
        {},
        mockContext
      );

      expect(prisma.caseRateHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should convert rate type to uppercase', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          caseId: 'case-001',
          changedAt: new Date(),
          rateType: 'paralegal',
          oldRate: 12000,
          newRate: 15000,
          changer: { id: 'user-123', firstName: 'John', lastName: 'Partner' },
        },
      ];

      (prisma.caseRateHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await caseResolvers.Case.rateHistory(
        { id: 'case-001' },
        {},
        mockContext
      );

      expect(result[0].rateType).toBe('PARALEGAL');
    });
  });
});
