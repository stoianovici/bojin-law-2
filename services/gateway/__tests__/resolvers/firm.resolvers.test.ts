/**
 * Firm Resolvers Unit Tests
 * Story 2.8.1: Billing & Rate Management
 *
 * Tests for firm settings and default rates resolvers
 */

import { GraphQLError } from 'graphql';
import { firmResolvers, Context } from '../../src/graphql/resolvers/firm.resolvers';
import { prisma } from '@legal-platform/database';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    firm: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Firm Resolvers - Story 2.8.1', () => {
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

  describe('Query: defaultRates', () => {
    it('should return default rates for Partner', async () => {
      const mockRates = {
        partnerRate: 50000,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      (prisma.firm.findUnique as jest.Mock).mockResolvedValue({
        id: 'firm-456',
        defaultRates: mockRates,
      });

      const result = await firmResolvers.Query.defaultRates({}, {}, mockContext);

      expect(result).toEqual(mockRates);
      expect(prisma.firm.findUnique).toHaveBeenCalledWith({
        where: { id: 'firm-456' },
        select: { defaultRates: true },
      });
    });

    it('should return null if rates not set', async () => {
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue({
        id: 'firm-456',
        defaultRates: null,
      });

      const result = await firmResolvers.Query.defaultRates({}, {}, mockContext);

      expect(result).toBeNull();
    });

    it('should throw error if firm not found', async () => {
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(firmResolvers.Query.defaultRates({}, {}, mockContext)).rejects.toThrow(
        GraphQLError
      );
    });

    it('should throw FORBIDDEN error for Associate', async () => {
      mockContext.user!.role = 'Associate';

      await expect(firmResolvers.Query.defaultRates({}, {}, mockContext)).rejects.toThrow(
        GraphQLError
      );
    });

    it('should throw FORBIDDEN error for Paralegal', async () => {
      mockContext.user!.role = 'Paralegal';

      await expect(firmResolvers.Query.defaultRates({}, {}, mockContext)).rejects.toThrow(
        GraphQLError
      );
    });

    it('should throw UNAUTHENTICATED error if no user', async () => {
      mockContext.user = undefined;

      await expect(firmResolvers.Query.defaultRates({}, {}, mockContext)).rejects.toThrow(
        GraphQLError
      );
    });
  });

  describe('Query: firm', () => {
    it('should return firm for authenticated user', async () => {
      const mockFirm = {
        id: 'firm-456',
        name: 'Test Law Firm',
        defaultRates: { partnerRate: 50000, associateRate: 30000, paralegalRate: 15000 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(mockFirm);

      const result = await firmResolvers.Query.firm({}, {}, mockContext);

      expect(result).toEqual(mockFirm);
      expect(prisma.firm.findUnique).toHaveBeenCalledWith({
        where: { id: 'firm-456' },
      });
    });

    it('should throw error if firm not found', async () => {
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(firmResolvers.Query.firm({}, {}, mockContext)).rejects.toThrow(GraphQLError);
    });

    it('should work for Associate', async () => {
      mockContext.user!.role = 'Associate';

      const mockFirm = {
        id: 'firm-456',
        name: 'Test Law Firm',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(mockFirm);

      const result = await firmResolvers.Query.firm({}, {}, mockContext);

      expect(result).toEqual(mockFirm);
    });
  });

  describe('Mutation: updateDefaultRates', () => {
    const validRates = {
      partnerRate: 50000,
      associateRate: 30000,
      paralegalRate: 15000,
    };

    it('should update default rates successfully', async () => {
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue({
        id: 'firm-456',
        defaultRates: { partnerRate: 40000, associateRate: 25000, paralegalRate: 12000 },
      });

      (prisma.firm.update as jest.Mock).mockResolvedValue({
        id: 'firm-456',
        defaultRates: validRates,
      });

      const result = await firmResolvers.Mutation.updateDefaultRates(
        {},
        { input: validRates },
        mockContext
      );

      expect(result).toEqual(validRates);
      expect(prisma.firm.update).toHaveBeenCalledWith({
        where: { id: 'firm-456' },
        data: { defaultRates: validRates },
        select: { defaultRates: true },
      });
    });

    it('should reject negative partnerRate', async () => {
      const invalidRates = {
        partnerRate: -1000,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: invalidRates }, mockContext)
      ).rejects.toThrow('All rates must be positive numbers');
    });

    it('should reject negative associateRate', async () => {
      const invalidRates = {
        partnerRate: 50000,
        associateRate: -1000,
        paralegalRate: 15000,
      };

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: invalidRates }, mockContext)
      ).rejects.toThrow('All rates must be positive numbers');
    });

    it('should reject zero rates', async () => {
      const invalidRates = {
        partnerRate: 0,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: invalidRates }, mockContext)
      ).rejects.toThrow('All rates must be positive numbers');
    });

    it('should reject non-integer rates (cents precision required)', async () => {
      const invalidRates = {
        partnerRate: 50000.5,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: invalidRates }, mockContext)
      ).rejects.toThrow('Rates must be in cents');
    });

    it('should reject NaN values', async () => {
      const invalidRates = {
        partnerRate: NaN,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: invalidRates }, mockContext)
      ).rejects.toThrow('Rates must be valid numbers');
    });

    it('should reject Infinity values', async () => {
      const invalidRates = {
        partnerRate: Infinity,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: invalidRates }, mockContext)
      ).rejects.toThrow('Rates must be valid numbers');
    });

    it('should throw FORBIDDEN for Associate', async () => {
      mockContext.user!.role = 'Associate';

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: validRates }, mockContext)
      ).rejects.toThrow('Only Partners can manage billing rates');
    });

    it('should throw FORBIDDEN for Paralegal', async () => {
      mockContext.user!.role = 'Paralegal';

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: validRates }, mockContext)
      ).rejects.toThrow('Only Partners can manage billing rates');
    });

    it('should throw UNAUTHENTICATED if no user', async () => {
      mockContext.user = undefined;

      await expect(
        firmResolvers.Mutation.updateDefaultRates({}, { input: validRates }, mockContext)
      ).rejects.toThrow(GraphQLError);
    });
  });

  describe('Field Resolver: Firm.defaultRates', () => {
    it('should return rates if set', () => {
      const mockRates = {
        partnerRate: 50000,
        associateRate: 30000,
        paralegalRate: 15000,
      };

      const result = firmResolvers.Firm.defaultRates({
        defaultRates: mockRates,
      });

      expect(result).toEqual(mockRates);
    });

    it('should return null if rates not set', () => {
      const result = firmResolvers.Firm.defaultRates({
        defaultRates: null,
      });

      expect(result).toBeNull();
    });

    it('should return null if rates undefined', () => {
      const result = firmResolvers.Firm.defaultRates({});

      expect(result).toBeNull();
    });
  });
});
