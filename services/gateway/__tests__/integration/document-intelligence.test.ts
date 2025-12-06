/**
 * Document Intelligence Integration Tests
 * Story 3.7: AI Document Intelligence Dashboard - Task 15
 *
 * Tests for GraphQL API integration including:
 * - Authorization enforcement
 * - Query parameter validation
 * - Response structure validation
 * - Error handling
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    document: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    documentDraftMetrics: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    aIReviewConcern: {
      findMany: jest.fn(),
    },
    templateLibrary: {
      findMany: jest.fn(),
    },
    documentPattern: {
      findMany: jest.fn(),
    },
    documentVersion: {
      groupBy: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    firm: {
      findUnique: jest.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@legal-platform/database';
import {
  createDocumentIntelligenceService,
  clearDocumentIntelligenceCache,
} from '../../src/services/document-intelligence.service';
import type { Context } from '../../src/graphql/resolvers/case.resolvers';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ============================================================================
// Test Data
// ============================================================================

const testFirm = {
  id: 'firm-test-123',
  name: 'Test Law Firm',
};

const testPartner = {
  id: 'partner-test-123',
  email: 'partner@testfirm.com',
  firstName: 'Partner',
  lastName: 'User',
  role: 'Partner',
  firmId: testFirm.id,
};

const testAssociate = {
  id: 'associate-test-123',
  email: 'associate@testfirm.com',
  firstName: 'Associate',
  lastName: 'User',
  role: 'Associate',
  firmId: testFirm.id,
};

const testBusinessOwner = {
  id: 'bo-test-123',
  email: 'bo@testfirm.com',
  firstName: 'Business',
  lastName: 'Owner',
  role: 'BusinessOwner',
  firmId: testFirm.id,
};

const mockFilters = {
  dateRange: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
  },
};

const mockDocuments = [
  {
    id: 'doc-1',
    uploadedBy: 'user-1',
    fileType: 'Contract',
    uploadedAt: new Date('2024-01-15'),
    uploader: { id: 'user-1', firstName: 'Test', lastName: 'User', role: 'Partner' },
  },
];

const mockDraftMetrics = [
  {
    userId: 'user-1',
    documentType: 'Contract',
    timeToFinalizeMinutes: 45,
    createdAt: new Date('2024-01-15'),
    documentId: 'doc-1',
    editPercentage: 20,
  },
];

// ============================================================================
// Setup & Teardown
// ============================================================================

describe('Document Intelligence Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDocumentIntelligenceCache();

    // Set up default mocks
    mockPrisma.document.findMany.mockResolvedValue(mockDocuments as any);
    mockPrisma.document.count.mockResolvedValue(1);
    mockPrisma.document.groupBy.mockResolvedValue([]);
    mockPrisma.documentDraftMetrics.findMany.mockResolvedValue(mockDraftMetrics as any);
    mockPrisma.documentDraftMetrics.count.mockResolvedValue(1);
    mockPrisma.aIReviewConcern.findMany.mockResolvedValue([]);
    mockPrisma.templateLibrary.findMany.mockResolvedValue([]);
    mockPrisma.documentPattern.findMany.mockResolvedValue([]);
    mockPrisma.documentVersion.groupBy.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user-1', firstName: 'Test', lastName: 'User' },
    ] as any);
    mockPrisma.firm.findUnique.mockResolvedValue(null);
  });

  // ============================================================================
  // Authorization Tests
  // ============================================================================

  describe('Authorization', () => {
    it('should allow Partner to access dashboard', async () => {
      const context: Context = {
        user: testPartner,
      };

      const service = createDocumentIntelligenceService(context);
      const result = await service.getDashboardMetrics(mockFilters);

      expect(result).toBeDefined();
      expect(result.velocity).toBeDefined();
      expect(result.aiUtilization).toBeDefined();
    });

    it('should allow BusinessOwner to access dashboard', async () => {
      const context: Context = {
        user: testBusinessOwner,
      };

      const service = createDocumentIntelligenceService(context);
      const result = await service.getDashboardMetrics(mockFilters);

      expect(result).toBeDefined();
    });

    it('should reject user without firmId', async () => {
      const context: Context = {
        user: {
          ...testPartner,
          firmId: undefined,
        },
      };

      const service = createDocumentIntelligenceService(context);
      await expect(service.getDashboardMetrics(mockFilters)).rejects.toThrow(
        'User must belong to a firm'
      );
    });
  });

  // ============================================================================
  // Query Parameter Validation Tests
  // ============================================================================

  describe('Query Parameter Validation', () => {
    it('should accept valid date range', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const validFilters = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
      };

      const result = await service.getDashboardMetrics(validFilters);
      expect(result.dateRange.startDate).toEqual(validFilters.dateRange.startDate);
      expect(result.dateRange.endDate).toEqual(validFilters.dateRange.endDate);
    });

    it('should handle filters with userIds', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const filtersWithUsers = {
        dateRange: mockFilters.dateRange,
        userIds: ['user-1', 'user-2'],
      };

      const result = await service.getDocumentVelocityStats(filtersWithUsers);
      expect(result).toBeDefined();
    });

    it('should handle filters with documentTypes', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const filtersWithTypes = {
        dateRange: mockFilters.dateRange,
        documentTypes: ['Contract', 'Motion'],
      };

      const result = await service.getDocumentVelocityStats(filtersWithTypes);
      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // Response Structure Tests
  // ============================================================================

  describe('Response Structure', () => {
    it('should return complete dashboard structure', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getDashboardMetrics(mockFilters);

      // Check all required fields
      expect(result).toHaveProperty('dateRange');
      expect(result).toHaveProperty('velocity');
      expect(result).toHaveProperty('aiUtilization');
      expect(result).toHaveProperty('errorDetection');
      expect(result).toHaveProperty('timeSavings');
      expect(result).toHaveProperty('templateUsage');
      expect(result).toHaveProperty('qualityTrends');
      expect(result).toHaveProperty('lastUpdated');
    });

    it('should return valid velocity structure', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getDocumentVelocityStats(mockFilters);

      expect(result).toHaveProperty('byUser');
      expect(result).toHaveProperty('byType');
      expect(result).toHaveProperty('totalDocuments');
      expect(result).toHaveProperty('averagePerDay');
      expect(result).toHaveProperty('trendPercentage');
      expect(Array.isArray(result.byUser)).toBe(true);
      expect(Array.isArray(result.byType)).toBe(true);
    });

    it('should return valid AI utilization structure', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getAIUtilizationStats(mockFilters);

      expect(result).toHaveProperty('overallUtilizationRate');
      expect(result).toHaveProperty('byUser');
      expect(result).toHaveProperty('adoptionTrend');
      expect(result).toHaveProperty('totalAIAssistedDocuments');
      expect(result).toHaveProperty('totalManualDocuments');
    });

    it('should return valid error detection structure', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getErrorDetectionStats(mockFilters);

      expect(result).toHaveProperty('totalConcernsDetected');
      expect(result).toHaveProperty('concernsResolvedBeforeFiling');
      expect(result).toHaveProperty('detectionRate');
      expect(result).toHaveProperty('bySeverity');
      expect(result).toHaveProperty('byType');
      expect(result).toHaveProperty('trendData');
    });

    it('should return valid time savings structure', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getTimeSavingsStats(mockFilters);

      expect(result).toHaveProperty('totalMinutesSaved');
      expect(result).toHaveProperty('averageMinutesSavedPerDocument');
      expect(result).toHaveProperty('estimatedCostSavings');
      expect(result).toHaveProperty('byUser');
      expect(result).toHaveProperty('byDocumentType');
      expect(result).toHaveProperty('methodology');
    });

    it('should return valid template usage structure', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getTemplateUsageStats(mockFilters);

      expect(result).toHaveProperty('topTemplates');
      expect(result).toHaveProperty('topClauses');
      expect(result).toHaveProperty('totalTemplateUsage');
      expect(result).toHaveProperty('templateAdoptionRate');
    });

    it('should return valid quality trends structure', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getDocumentQualityTrends(mockFilters);

      expect(result).toHaveProperty('overallQualityScore');
      expect(result).toHaveProperty('averageRevisionCount');
      expect(result).toHaveProperty('qualityTrend');
      expect(result).toHaveProperty('byDocumentType');
      expect(result).toHaveProperty('qualityThreshold');
    });
  });

  // ============================================================================
  // Data Isolation Tests
  // ============================================================================

  describe('Data Isolation', () => {
    it('should filter documents by firmId', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      await service.getDocumentVelocityStats(mockFilters);

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirm.id,
          }),
        })
      );
    });

    it('should filter draft metrics by firmId', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      await service.getAIUtilizationStats(mockFilters);

      expect(mockPrisma.documentDraftMetrics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirm.id,
          }),
        })
      );
    });
  });

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('Caching Behavior', () => {
    it('should cache dashboard results', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      // First call
      await service.getDashboardMetrics(mockFilters);
      const firstCallCount = mockPrisma.document.findMany.mock.calls.length;

      // Second call should use cache
      await service.getDashboardMetrics(mockFilters);
      expect(mockPrisma.document.findMany.mock.calls.length).toBe(firstCallCount);
    });

    it('should not use cache for different filters', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      // First call
      await service.getDashboardMetrics(mockFilters);
      const firstCallCount = mockPrisma.document.findMany.mock.calls.length;

      // Different filters should not use cache
      const differentFilters = {
        dateRange: {
          startDate: new Date('2024-02-01'),
          endDate: new Date('2024-02-28'),
        },
      };
      await service.getDashboardMetrics(differentFilters);

      expect(mockPrisma.document.findMany.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });

  // ============================================================================
  // Empty Data Handling Tests
  // ============================================================================

  describe('Empty Data Handling', () => {
    beforeEach(() => {
      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.document.count.mockResolvedValue(0);
      mockPrisma.documentDraftMetrics.findMany.mockResolvedValue([]);
      mockPrisma.aIReviewConcern.findMany.mockResolvedValue([]);
    });

    it('should handle empty document list gracefully', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getDocumentVelocityStats(mockFilters);

      expect(result.totalDocuments).toBe(0);
      expect(result.byUser).toHaveLength(0);
      expect(result.byType).toHaveLength(0);
    });

    it('should handle zero AI utilization gracefully', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getAIUtilizationStats(mockFilters);

      expect(result.overallUtilizationRate).toBe(0);
      expect(result.totalAIAssistedDocuments).toBe(0);
    });

    it('should handle no concerns detected gracefully', async () => {
      const context: Context = { user: testPartner };
      const service = createDocumentIntelligenceService(context);

      const result = await service.getErrorDetectionStats(mockFilters);

      expect(result.totalConcernsDetected).toBe(0);
      expect(result.detectionRate).toBe(0);
    });
  });
});
