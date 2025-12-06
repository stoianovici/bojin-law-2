/**
 * Platform Intelligence GraphQL API Integration Tests
 * Story 5.7: Platform Intelligence Dashboard - Task 25
 *
 * Tests for:
 * - platformIntelligenceDashboard query (AC: 1-6)
 * - communicationAnalytics query (AC: 2)
 * - documentQualityAnalytics query (AC: 3)
 * - aiUtilizationAnalytics query (AC: 5)
 * - exportPlatformIntelligence mutation
 * - Authorization (Partner/BusinessOwner only)
 */

// Set environment variables
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    firm: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    email: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    documentVersion: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    reviewComment: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    aIUsageLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    taskDependency: {
      count: jest.fn(),
    },
    taskHistory: {
      count: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@legal-platform/database';
import { platformIntelligenceResolvers } from '../../src/graphql/resolvers/platform-intelligence.resolvers';

// Cast to any for mocking
const mockPrisma = prisma as any;

// Define Context type
interface Context {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    firmId: string;
  };
  req: unknown;
  res: unknown;
}

// Test data
const testFirm = {
  id: 'firm-123',
  name: 'Test Law Firm',
  defaultRates: { Standard: 200 },
  metadata: {
    platformIntelligence: {
      baselineStartDate: '2025-01-01',
    },
  },
};

const testPartner = {
  id: 'partner-123',
  email: 'partner@testfirm.com',
  firstName: 'Test',
  lastName: 'Partner',
  role: 'Partner',
  firmId: testFirm.id,
};

const testAssociate = {
  id: 'associate-123',
  email: 'associate@testfirm.com',
  firstName: 'Test',
  lastName: 'Associate',
  role: 'Associate',
  firmId: testFirm.id,
};

const testDateRange = {
  startDate: '2025-11-01T00:00:00.000Z',
  endDate: '2025-11-30T23:59:59.999Z',
};

const partnerContext: Context = {
  user: testPartner,
  req: {},
  res: {},
};

const associateContext: Context = {
  user: testAssociate,
  req: {},
  res: {},
};

describe('Platform Intelligence GraphQL Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setups
    mockPrisma.firm.findUnique.mockResolvedValue(testFirm);
    mockPrisma.user.findMany.mockResolvedValue([testPartner, testAssociate]);
  });

  describe('Query: platformIntelligenceDashboard', () => {
    beforeEach(() => {
      // Mock communication data
      mockPrisma.email.findMany.mockResolvedValue([
        {
          id: 'email-1',
          receivedDateTime: new Date('2025-11-01T10:00:00Z'),
          sentDateTime: new Date('2025-11-01T14:00:00Z'),
          senderType: 'client',
        },
      ]);
      mockPrisma.email.count.mockResolvedValue(100);

      // Mock document data
      mockPrisma.document.count.mockResolvedValue(50);
      mockPrisma.documentVersion.count.mockResolvedValue(75);
      mockPrisma.documentVersion.groupBy.mockResolvedValue([
        { documentId: 'doc-1', _count: { id: 1 } },
        { documentId: 'doc-2', _count: { id: 3 } },
      ]);
      mockPrisma.reviewComment.count.mockResolvedValue(20);
      mockPrisma.reviewComment.findMany.mockResolvedValue([]);

      // Mock AI usage data
      mockPrisma.aIUsageLog.groupBy.mockResolvedValue([
        { userId: 'user-1', _sum: { tokenCount: 50000, costCents: 500 }, _count: { id: 100 } },
      ]);

      // Mock task data
      mockPrisma.task.count.mockResolvedValue(200);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.taskDependency.count.mockResolvedValue(10);
      mockPrisma.taskHistory.count.mockResolvedValue(5);
    });

    it('should return full dashboard for Partner role', async () => {
      const result = await platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.firmId).toBe(testFirm.id);
      expect(result.platformHealthScore).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should throw authorization error for Associate role', async () => {
      await expect(
        platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
          {},
          { dateRange: testDateRange },
          associateContext
        )
      ).rejects.toThrow(/unauthorized|forbidden|access denied/i);
    });

    it('should include all sections in response', async () => {
      const result = await platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result.efficiency).toBeDefined();
      expect(result.communication).toBeDefined();
      expect(result.documentQuality).toBeDefined();
      expect(result.taskCompletion).toBeDefined();
      expect(result.aiUtilization).toBeDefined();
      expect(result.roi).toBeDefined();
    });

    it('should return valid date range in response', async () => {
      const result = await platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result.dateRange).toBeDefined();
      expect(result.dateRange.startDate).toBeDefined();
      expect(result.dateRange.endDate).toBeDefined();
    });

    it('should return generatedAt timestamp', async () => {
      const result = await platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt)).toBeInstanceOf(Date);
    });
  });

  describe('Query: communicationAnalytics', () => {
    beforeEach(() => {
      mockPrisma.email.findMany.mockResolvedValue([
        {
          id: 'email-1',
          receivedDateTime: new Date('2025-11-01T10:00:00Z'),
          replies: [{ sentDateTime: new Date('2025-11-01T14:00:00Z') }],
        },
      ]);
      mockPrisma.email.count.mockResolvedValue(100);
    });

    it('should return communication analytics for Partner', async () => {
      const result = await platformIntelligenceResolvers.Query.communicationAnalytics(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.currentResponseTime).toBeDefined();
      expect(result.byRecipientType).toBeDefined();
    });

    it('should include response time metrics', async () => {
      const result = await platformIntelligenceResolvers.Query.communicationAnalytics(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result.currentResponseTime.avgResponseTimeHours).toBeDefined();
      expect(result.currentResponseTime.withinSLAPercent).toBeDefined();
    });
  });

  describe('Query: documentQualityAnalytics', () => {
    beforeEach(() => {
      mockPrisma.document.count.mockResolvedValue(100);
      mockPrisma.documentVersion.groupBy.mockResolvedValue([
        { documentId: 'doc-1', _count: { id: 1 } },
        { documentId: 'doc-2', _count: { id: 2 } },
      ]);
      mockPrisma.reviewComment.findMany.mockResolvedValue([
        { id: 'comment-1', content: 'Typo in paragraph 3', resolved: true },
      ]);
    });

    it('should return document quality analytics for Partner', async () => {
      const result = await platformIntelligenceResolvers.Query.documentQualityAnalytics(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.revisionMetrics).toBeDefined();
      expect(result.errorMetrics).toBeDefined();
    });

    it('should calculate first-time-right percentage', async () => {
      const result = await platformIntelligenceResolvers.Query.documentQualityAnalytics(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result.revisionMetrics.firstTimeRightPercent).toBeDefined();
      expect(result.revisionMetrics.firstTimeRightPercent).toBeGreaterThanOrEqual(0);
      expect(result.revisionMetrics.firstTimeRightPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Query: aiUtilizationAnalytics', () => {
    beforeEach(() => {
      mockPrisma.aIUsageLog.groupBy.mockResolvedValue([
        {
          userId: testPartner.id,
          operation: 'email_draft_generate',
          _sum: { tokenCount: 50000, costCents: 500 },
          _count: { id: 100 },
        },
        {
          userId: testAssociate.id,
          operation: 'document_generate',
          _sum: { tokenCount: 30000, costCents: 300 },
          _count: { id: 50 },
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([testPartner, testAssociate]);
    });

    it('should return AI utilization analytics for Partner', async () => {
      const result = await platformIntelligenceResolvers.Query.aiUtilizationAnalytics(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.firmTotal).toBeDefined();
      expect(result.byUser).toBeDefined();
      expect(result.byFeature).toBeDefined();
    });

    it('should identify top and underutilized users', async () => {
      const result = await platformIntelligenceResolvers.Query.aiUtilizationAnalytics(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result.topUsers).toBeDefined();
      expect(result.underutilizedUsers).toBeDefined();
    });

    it('should include firm totals', async () => {
      const result = await platformIntelligenceResolvers.Query.aiUtilizationAnalytics(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      expect(result.firmTotal.totalRequests).toBeDefined();
      expect(result.firmTotal.totalTokens).toBeDefined();
      expect(result.firmTotal.avgRequestsPerUser).toBeDefined();
    });
  });

  describe('Query: userAIUtilization', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(testPartner);
      mockPrisma.aIUsageLog.groupBy.mockResolvedValue([
        {
          operation: 'email_draft_generate',
          _sum: { tokenCount: 25000, costCents: 250 },
          _count: { id: 50 },
          _avg: { latencyMs: 1200 },
        },
      ]);
    });

    it('should return user-specific AI utilization', async () => {
      const result = await platformIntelligenceResolvers.Query.userAIUtilization(
        {},
        { userId: testPartner.id, dateRange: testDateRange },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(testPartner.id);
      expect(result.adoptionScore).toBeDefined();
    });
  });

  describe('Mutation: exportPlatformIntelligence', () => {
    it('should initiate PDF export for Partner', async () => {
      const result = await platformIntelligenceResolvers.Mutation.exportPlatformIntelligence(
        {},
        { dateRange: testDateRange, format: 'PDF' },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.format).toBe('PDF');
      expect(result.expiresAt).toBeDefined();
    });

    it('should initiate Excel export for Partner', async () => {
      const result = await platformIntelligenceResolvers.Mutation.exportPlatformIntelligence(
        {},
        { dateRange: testDateRange, format: 'EXCEL' },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.format).toBe('EXCEL');
    });

    it('should initiate CSV export for Partner', async () => {
      const result = await platformIntelligenceResolvers.Mutation.exportPlatformIntelligence(
        {},
        { dateRange: testDateRange, format: 'CSV' },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.format).toBe('CSV');
    });

    it('should throw authorization error for Associate role', async () => {
      await expect(
        platformIntelligenceResolvers.Mutation.exportPlatformIntelligence(
          {},
          { dateRange: testDateRange, format: 'PDF' },
          associateContext
        )
      ).rejects.toThrow(/unauthorized|forbidden|access denied/i);
    });
  });

  describe('Mutation: refreshPlatformIntelligence', () => {
    it('should clear cache and return true for Partner', async () => {
      const result = await platformIntelligenceResolvers.Mutation.refreshPlatformIntelligence(
        {},
        {},
        partnerContext
      );

      expect(result).toBe(true);
    });

    it('should throw authorization error for Associate role', async () => {
      await expect(
        platformIntelligenceResolvers.Mutation.refreshPlatformIntelligence({}, {}, associateContext)
      ).rejects.toThrow(/unauthorized|forbidden|access denied/i);
    });
  });

  describe('Authorization', () => {
    const queries = [
      'platformIntelligenceDashboard',
      'communicationAnalytics',
      'documentQualityAnalytics',
      'aiUtilizationAnalytics',
    ];

    queries.forEach((queryName) => {
      it(`should allow BusinessOwner access to ${queryName}`, async () => {
        const businessOwnerContext: Context = {
          user: { ...testPartner, role: 'BusinessOwner' },
          req: {},
          res: {},
        };

        // Should not throw
        await expect(
          platformIntelligenceResolvers.Query[queryName](
            {},
            { dateRange: testDateRange },
            businessOwnerContext
          )
        ).resolves.toBeDefined();
      });

      it(`should deny Paralegal access to ${queryName}`, async () => {
        const paralegalContext: Context = {
          user: { ...testPartner, role: 'Paralegal' },
          req: {},
          res: {},
        };

        await expect(
          platformIntelligenceResolvers.Query[queryName](
            {},
            { dateRange: testDateRange },
            paralegalContext
          )
        ).rejects.toThrow(/unauthorized|forbidden|access denied/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing firm gracefully', async () => {
      mockPrisma.firm.findUnique.mockResolvedValue(null);

      await expect(
        platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
          {},
          { dateRange: testDateRange },
          partnerContext
        )
      ).rejects.toThrow(/firm not found|invalid firm/i);
    });

    it('should handle invalid date range', async () => {
      const invalidDateRange = {
        startDate: '2025-12-01T00:00:00.000Z',
        endDate: '2025-11-01T00:00:00.000Z', // End before start
      };

      await expect(
        platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
          {},
          { dateRange: invalidDateRange },
          partnerContext
        )
      ).rejects.toThrow(/invalid date range|start date must be before end date/i);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.email.findMany.mockRejectedValue(new Error('Database connection failed'));

      // Service should handle partial failures gracefully
      const result = await platformIntelligenceResolvers.Query.platformIntelligenceDashboard(
        {},
        { dateRange: testDateRange },
        partnerContext
      );

      // Should still return a result, even if some sections have default/empty data
      expect(result).toBeDefined();
    });
  });
});
