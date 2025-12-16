/**
 * Retainer Resolvers Unit Tests
 * Story 2.11.2: Retainer Billing Support - Task 12
 *
 * Tests for retainer usage queries and field resolvers:
 * - Query.retainerUsage authorization
 * - Query.retainerUsageHistory authorization
 * - Case.currentRetainerUsage field resolver
 * - Partner vs BusinessOwner access
 * - @requiresFinancialAccess enforcement
 */

import { GraphQLError } from 'graphql';
import { caseResolvers, Context } from '../../src/graphql/resolvers/case.resolvers';
import { prisma } from '@legal-platform/database';
import { retainerService } from '../../src/services/retainer.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    caseTeam: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock retainer service
jest.mock('../../src/services/retainer.service', () => ({
  retainerService: {
    getUsageForPeriod: jest.fn(),
    getUsageHistory: jest.fn(),
    calculateCurrentUsage: jest.fn(),
  },
}));

// Test data
const mockRetainerUsage = {
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
  hoursUsed: 15,
  hoursIncluded: 20,
  rolledOver: 5,
  remaining: 10,
  utilizationPercent: 60,
};

const mockUsageHistory = [
  {
    periodStart: new Date('2024-02-01'),
    periodEnd: new Date('2024-02-29'),
    hoursUsed: 18,
    hoursIncluded: 20,
    rolledOver: 5,
    remaining: 7,
    utilizationPercent: 72,
  },
  {
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-31'),
    hoursUsed: 15,
    hoursIncluded: 20,
    rolledOver: 0,
    remaining: 5,
    utilizationPercent: 75,
  },
];

const mockRetainerCase = {
  id: 'case-retainer-1',
  firmId: 'firm-456',
  caseNumber: 'firm-456-2025-001',
  billingType: 'Retainer',
  retainerAmount: 500000,
  retainerPeriod: 'Monthly',
  retainerRollover: true,
  retainerAutoRenew: true,
  customRates: { partnerRate: 25000 },
};

const mockHourlyCase = {
  id: 'case-hourly-1',
  firmId: 'firm-456',
  caseNumber: 'firm-456-2025-002',
  billingType: 'Hourly',
  retainerAmount: null,
  retainerPeriod: null,
  retainerRollover: false,
  retainerAutoRenew: false,
};

describe('Retainer Resolvers - Story 2.11.2', () => {
  let partnerContext: Context;
  let businessOwnerContext: Context;
  let associateContext: Context;
  let paralegalContext: Context;
  let unauthenticatedContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();

    // Partner context - has financial access for own cases
    partnerContext = {
      user: {
        id: 'user-partner',
        firmId: 'firm-456',
        role: 'Partner',
        email: 'partner@test.com',
      },
      financialDataScope: 'own',
    };

    // BusinessOwner context - has firm-wide financial access
    businessOwnerContext = {
      user: {
        id: 'user-owner',
        firmId: 'firm-456',
        role: 'BusinessOwner',
        email: 'owner@test.com',
      },
      financialDataScope: 'firm',
    };

    // Associate context - no financial access
    associateContext = {
      user: {
        id: 'user-associate',
        firmId: 'firm-456',
        role: 'Associate',
        email: 'associate@test.com',
      },
      financialDataScope: null,
    };

    // Paralegal context - no financial access
    paralegalContext = {
      user: {
        id: 'user-paralegal',
        firmId: 'firm-456',
        role: 'Paralegal',
        email: 'paralegal@test.com',
      },
      financialDataScope: null,
    };

    // Unauthenticated context
    unauthenticatedContext = {};
  });

  describe('Query: retainerUsage', () => {
    describe('Authorization', () => {
      it('should allow Partner to query retainer usage for cases in their firm', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageForPeriod as jest.Mock).mockResolvedValue(mockRetainerUsage);

        const result = await caseResolvers.Query.retainerUsage(
          {},
          { caseId: 'case-retainer-1' },
          partnerContext
        );

        expect(result).toEqual(mockRetainerUsage);
        expect(retainerService.getUsageForPeriod).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          undefined
        );
      });

      it('should allow BusinessOwner to query retainer usage for any case in their firm', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageForPeriod as jest.Mock).mockResolvedValue(mockRetainerUsage);

        const result = await caseResolvers.Query.retainerUsage(
          {},
          { caseId: 'case-retainer-1' },
          businessOwnerContext
        );

        expect(result).toEqual(mockRetainerUsage);
        expect(retainerService.getUsageForPeriod).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          undefined
        );
      });

      it('should deny Associate access to retainer usage', async () => {
        await expect(
          caseResolvers.Query.retainerUsage({}, { caseId: 'case-retainer-1' }, associateContext)
        ).rejects.toThrow('Financial access required');
      });

      it('should deny Paralegal access to retainer usage', async () => {
        await expect(
          caseResolvers.Query.retainerUsage({}, { caseId: 'case-retainer-1' }, paralegalContext)
        ).rejects.toThrow('Financial access required');
      });

      it('should require authentication', async () => {
        await expect(
          caseResolvers.Query.retainerUsage(
            {},
            { caseId: 'case-retainer-1' },
            unauthenticatedContext
          )
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('Firm Isolation', () => {
      it('should prevent Partner from accessing cases in other firms', async () => {
        // Case exists but belongs to different firm
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          caseResolvers.Query.retainerUsage({}, { caseId: 'case-other-firm' }, partnerContext)
        ).rejects.toThrow('Case not found');
      });

      it('should prevent BusinessOwner from accessing cases in other firms', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          caseResolvers.Query.retainerUsage({}, { caseId: 'case-other-firm' }, businessOwnerContext)
        ).rejects.toThrow('Case not found');
      });
    });

    describe('Period Selection', () => {
      it('should pass periodStart to service when provided', async () => {
        const periodStart = new Date('2024-01-01');
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageForPeriod as jest.Mock).mockResolvedValue(mockRetainerUsage);

        await caseResolvers.Query.retainerUsage(
          {},
          { caseId: 'case-retainer-1', periodStart },
          partnerContext
        );

        expect(retainerService.getUsageForPeriod).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          periodStart
        );
      });

      it('should use current period when periodStart not provided', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageForPeriod as jest.Mock).mockResolvedValue(mockRetainerUsage);

        await caseResolvers.Query.retainerUsage({}, { caseId: 'case-retainer-1' }, partnerContext);

        expect(retainerService.getUsageForPeriod).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          undefined
        );
      });
    });
  });

  describe('Query: retainerUsageHistory', () => {
    describe('Authorization', () => {
      it('should allow Partner to query retainer usage history', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageHistory as jest.Mock).mockResolvedValue(mockUsageHistory);

        const result = await caseResolvers.Query.retainerUsageHistory(
          {},
          { caseId: 'case-retainer-1' },
          partnerContext
        );

        expect(result).toEqual(mockUsageHistory);
        expect(retainerService.getUsageHistory).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          12 // default limit
        );
      });

      it('should allow BusinessOwner to query retainer usage history', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageHistory as jest.Mock).mockResolvedValue(mockUsageHistory);

        const result = await caseResolvers.Query.retainerUsageHistory(
          {},
          { caseId: 'case-retainer-1', limit: 6 },
          businessOwnerContext
        );

        expect(result).toEqual(mockUsageHistory);
        expect(retainerService.getUsageHistory).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          6
        );
      });

      it('should deny Associate access to retainer usage history', async () => {
        await expect(
          caseResolvers.Query.retainerUsageHistory(
            {},
            { caseId: 'case-retainer-1' },
            associateContext
          )
        ).rejects.toThrow('Financial access required');
      });

      it('should deny Paralegal access to retainer usage history', async () => {
        await expect(
          caseResolvers.Query.retainerUsageHistory(
            {},
            { caseId: 'case-retainer-1' },
            paralegalContext
          )
        ).rejects.toThrow('Financial access required');
      });

      it('should require authentication', async () => {
        await expect(
          caseResolvers.Query.retainerUsageHistory(
            {},
            { caseId: 'case-retainer-1' },
            unauthenticatedContext
          )
        ).rejects.toThrow('Authentication required');
      });
    });

    describe('Limit Parameter', () => {
      it('should use default limit of 12 when not specified', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageHistory as jest.Mock).mockResolvedValue([]);

        await caseResolvers.Query.retainerUsageHistory(
          {},
          { caseId: 'case-retainer-1' },
          partnerContext
        );

        expect(retainerService.getUsageHistory).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          12
        );
      });

      it('should respect custom limit parameter', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageHistory as jest.Mock).mockResolvedValue([]);

        await caseResolvers.Query.retainerUsageHistory(
          {},
          { caseId: 'case-retainer-1', limit: 24 },
          partnerContext
        );

        expect(retainerService.getUsageHistory).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          24
        );
      });

      it('should cap limit at 100', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(mockRetainerCase);
        (retainerService.getUsageHistory as jest.Mock).mockResolvedValue([]);

        await caseResolvers.Query.retainerUsageHistory(
          {},
          { caseId: 'case-retainer-1', limit: 500 },
          partnerContext
        );

        expect(retainerService.getUsageHistory).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456',
          100 // Capped at 100
        );
      });
    });

    describe('Firm Isolation', () => {
      it('should prevent access to cases in other firms', async () => {
        (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          caseResolvers.Query.retainerUsageHistory(
            {},
            { caseId: 'case-other-firm' },
            partnerContext
          )
        ).rejects.toThrow('Case not found');
      });
    });
  });

  describe('Field Resolver: Case.currentRetainerUsage', () => {
    describe('Billing Type Check', () => {
      it('should return usage for Retainer billing type cases', async () => {
        (retainerService.calculateCurrentUsage as jest.Mock).mockResolvedValue(mockRetainerUsage);

        const result = await caseResolvers.Case.currentRetainerUsage(
          mockRetainerCase,
          {},
          partnerContext
        );

        expect(result).toEqual(mockRetainerUsage);
        expect(retainerService.calculateCurrentUsage).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456'
        );
      });

      it('should return null for Hourly billing type cases', async () => {
        const result = await caseResolvers.Case.currentRetainerUsage(
          mockHourlyCase,
          {},
          partnerContext
        );

        expect(result).toBeNull();
        expect(retainerService.calculateCurrentUsage).not.toHaveBeenCalled();
      });

      it('should return null for Fixed billing type cases', async () => {
        const fixedCase = { ...mockHourlyCase, billingType: 'Fixed' };

        const result = await caseResolvers.Case.currentRetainerUsage(fixedCase, {}, partnerContext);

        expect(result).toBeNull();
        expect(retainerService.calculateCurrentUsage).not.toHaveBeenCalled();
      });
    });

    describe('Authorization Handling', () => {
      it('should return null when user is not authenticated', async () => {
        const result = await caseResolvers.Case.currentRetainerUsage(
          mockRetainerCase,
          {},
          unauthenticatedContext
        );

        expect(result).toBeNull();
        expect(retainerService.calculateCurrentUsage).not.toHaveBeenCalled();
      });

      it('should use user firmId for service call', async () => {
        (retainerService.calculateCurrentUsage as jest.Mock).mockResolvedValue(mockRetainerUsage);

        await caseResolvers.Case.currentRetainerUsage(mockRetainerCase, {}, businessOwnerContext);

        expect(retainerService.calculateCurrentUsage).toHaveBeenCalledWith(
          'case-retainer-1',
          'firm-456'
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle null return from service gracefully', async () => {
        (retainerService.calculateCurrentUsage as jest.Mock).mockResolvedValue(null);

        const result = await caseResolvers.Case.currentRetainerUsage(
          mockRetainerCase,
          {},
          partnerContext
        );

        expect(result).toBeNull();
      });

      it('should handle service errors gracefully', async () => {
        (retainerService.calculateCurrentUsage as jest.Mock).mockRejectedValue(
          new Error('Service error')
        );

        await expect(
          caseResolvers.Case.currentRetainerUsage(mockRetainerCase, {}, partnerContext)
        ).rejects.toThrow('Service error');
      });
    });
  });

  describe('Financial Access Enforcement', () => {
    it('Partner should have "own" financial data scope', () => {
      expect(partnerContext.financialDataScope).toBe('own');
    });

    it('BusinessOwner should have "firm" financial data scope', () => {
      expect(businessOwnerContext.financialDataScope).toBe('firm');
    });

    it('Associate should have null financial data scope', () => {
      expect(associateContext.financialDataScope).toBeNull();
    });

    it('Paralegal should have null financial data scope', () => {
      expect(paralegalContext.financialDataScope).toBeNull();
    });
  });

  describe('Multi-tenancy Security', () => {
    const differentFirmContext: Context = {
      user: {
        id: 'user-other-firm',
        firmId: 'firm-999',
        role: 'Partner',
        email: 'partner@otherfirm.com',
      },
      financialDataScope: 'own',
    };

    it('should only query cases matching user firmId', async () => {
      (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        caseResolvers.Query.retainerUsage({}, { caseId: 'case-retainer-1' }, differentFirmContext)
      ).rejects.toThrow('Case not found');

      // Verify the query was filtered by firmId
      expect(prisma.case.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'case-retainer-1',
          firmId: 'firm-999',
        },
      });
    });

    it('Partner from Firm A cannot access Firm B retainer usage history', async () => {
      (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        caseResolvers.Query.retainerUsageHistory(
          {},
          { caseId: 'case-retainer-1' },
          differentFirmContext
        )
      ).rejects.toThrow('Case not found');

      expect(prisma.case.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'case-retainer-1',
          firmId: 'firm-999',
        },
      });
    });
  });
});
