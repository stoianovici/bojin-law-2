/**
 * Document Intelligence Service Unit Tests
 * Story 3.7: AI Document Intelligence Dashboard - Task 14
 *
 * Tests for all dashboard metrics calculations including velocity,
 * AI utilization, error detection, time savings, template usage, and quality trends.
 * Target coverage: 80%
 */

// Mock Prisma
jest.mock('@legal-platform/database', () => ({
  prisma: {
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
  },
}));

import {
  DocumentIntelligenceService,
  createDocumentIntelligenceService,
  clearDocumentIntelligenceCache,
} from './document-intelligence.service';
import { prisma } from '@legal-platform/database';
import type { Context } from '../graphql/resolvers/case.resolvers';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockPartnerContext: Context = {
  user: {
    id: 'user-partner-1',
    firmId: 'firm-1',
    role: 'Partner',
    email: 'partner@firm.com',
  },
  financialDataScope: 'own',
};

const mockFilters = {
  dateRange: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
  },
  compareWithPrevious: true,
};

const mockDocuments = [
  {
    id: 'doc-1',
    uploadedBy: 'user-1',
    fileType: 'Contract',
    uploadedAt: new Date('2024-01-15'),
    uploader: { id: 'user-1', firstName: 'Maria', lastName: 'Popescu', role: 'Partner' },
  },
  {
    id: 'doc-2',
    uploadedBy: 'user-2',
    fileType: 'Motion',
    uploadedAt: new Date('2024-01-16'),
    uploader: { id: 'user-2', firstName: 'Ion', lastName: 'Ionescu', role: 'Associate' },
  },
  {
    id: 'doc-3',
    uploadedBy: 'user-1',
    fileType: 'Contract',
    uploadedAt: new Date('2024-01-17'),
    uploader: { id: 'user-1', firstName: 'Maria', lastName: 'Popescu', role: 'Partner' },
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
  {
    userId: 'user-2',
    documentType: 'Motion',
    timeToFinalizeMinutes: 30,
    createdAt: new Date('2024-01-16'),
    documentId: 'doc-2',
    editPercentage: 15,
  },
];

const mockConcerns = [
  {
    id: 'concern-1',
    concernType: 'LEGAL_INCONSISTENCY',
    severity: 'ERROR',
    dismissed: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'concern-2',
    concernType: 'AMBIGUOUS_LANGUAGE',
    severity: 'WARNING',
    dismissed: true,
    createdAt: new Date('2024-01-16'),
  },
  {
    id: 'concern-3',
    concernType: 'MISSING_CLAUSE',
    severity: 'INFO',
    dismissed: false,
    createdAt: new Date('2024-01-17'),
  },
];

const mockTemplates = [
  {
    id: 'template-1',
    name: 'Contract de Vanzare',
    category: 'Contracte',
    usageCount: 25,
    qualityScore: 92,
    updatedAt: new Date('2024-01-20'),
  },
];

const mockPatterns = [
  {
    id: 'pattern-1',
    patternText: 'Partile convin ca...',
    category: 'Introducere',
    frequency: 40,
    confidenceScore: 0.85,
  },
];

const mockUsers = [
  { id: 'user-1', firstName: 'Maria', lastName: 'Popescu' },
  { id: 'user-2', firstName: 'Ion', lastName: 'Ionescu' },
];

// ============================================================================
// Setup & Teardown
// ============================================================================

describe('DocumentIntelligenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDocumentIntelligenceCache();
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('createDocumentIntelligenceService', () => {
    it('should create a service instance with context', () => {
      const service = createDocumentIntelligenceService(mockPartnerContext);
      expect(service).toBeInstanceOf(DocumentIntelligenceService);
    });
  });

  // ============================================================================
  // Authorization Tests
  // ============================================================================

  describe('Authorization', () => {
    it('should throw error when user has no firmId', async () => {
      const contextNoFirm: Context = {
        user: {
          id: 'user-1',
          firmId: undefined as unknown as string,
          role: 'Partner',
          email: 'test@test.com',
        },
      };

      const service = createDocumentIntelligenceService(contextNoFirm);
      await expect(service.getDashboardMetrics(mockFilters)).rejects.toThrow(
        'User must belong to a firm'
      );
    });
  });

  // ============================================================================
  // Document Velocity Stats Tests
  // ============================================================================

  describe('getDocumentVelocityStats', () => {
    it('should calculate document velocity stats correctly', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.document.count as jest.Mock).mockResolvedValue(2);
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDocumentVelocityStats(mockFilters);

      expect(result.totalDocuments).toBe(3);
      expect(result.byUser).toHaveLength(2);
      expect(result.byType).toHaveLength(2); // Contract and Motion
      expect(result.averagePerDay).toBeGreaterThan(0);
    });

    it('should group documents by user correctly', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.document.count as jest.Mock).mockResolvedValue(2);
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue([]);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDocumentVelocityStats(mockFilters);

      // User 1 should have 2 documents
      const user1Stats = result.byUser.find(
        (u: { userId: string; documentCount: number }) => u.userId === 'user-1'
      );
      expect(user1Stats?.documentCount).toBe(2);

      // User 2 should have 1 document
      const user2Stats = result.byUser.find(
        (u: { userId: string; documentCount: number }) => u.userId === 'user-2'
      );
      expect(user2Stats?.documentCount).toBe(1);
    });

    it('should group documents by type correctly', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.document.count as jest.Mock).mockResolvedValue(2);
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue([]);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDocumentVelocityStats(mockFilters);

      const contractStats = result.byType.find(
        (t: { documentType: string; documentCount: number }) => t.documentType === 'Contract'
      );
      expect(contractStats?.documentCount).toBe(2);
    });
  });

  // ============================================================================
  // AI Utilization Stats Tests
  // ============================================================================

  describe('getAIUtilizationStats', () => {
    it('should calculate AI utilization stats correctly', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.document.count as jest.Mock).mockResolvedValue(5);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      // Mock first groupBy call (by uploadedBy)
      (prisma.document.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { uploadedBy: 'user-1', _count: { id: 3 } },
          { uploadedBy: 'user-2', _count: { id: 2 } },
        ])
        // Mock second groupBy call (by uploadedAt for daily trend)
        .mockResolvedValueOnce([
          { uploadedAt: new Date('2024-01-15'), _count: { id: 3 } },
          { uploadedAt: new Date('2024-01-16'), _count: { id: 2 } },
        ]);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getAIUtilizationStats(mockFilters);

      expect(result.totalAIAssistedDocuments).toBe(2);
      expect(result.totalManualDocuments).toBe(3);
      expect(result.overallUtilizationRate).toBe(40); // 2/5 = 40%
    });

    it('should calculate per-user utilization rates', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.document.count as jest.Mock).mockResolvedValue(5);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      // Mock first groupBy call (by uploadedBy)
      (prisma.document.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { uploadedBy: 'user-1', _count: { id: 2 } },
          { uploadedBy: 'user-2', _count: { id: 1 } },
        ])
        // Mock second groupBy call (by uploadedAt for daily trend)
        .mockResolvedValueOnce([
          { uploadedAt: new Date('2024-01-15'), _count: { id: 2 } },
          { uploadedAt: new Date('2024-01-16'), _count: { id: 1 } },
        ]);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getAIUtilizationStats(mockFilters);

      expect(result.byUser).toHaveLength(2);
    });
  });

  // ============================================================================
  // Error Detection Stats Tests
  // ============================================================================

  describe('getErrorDetectionStats', () => {
    it('should calculate error detection stats correctly', async () => {
      (prisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue(mockConcerns);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getErrorDetectionStats(mockFilters);

      expect(result.totalConcernsDetected).toBe(3);
      expect(result.concernsResolvedBeforeFiling).toBe(2); // 2 dismissed
      expect(result.detectionRate).toBeCloseTo(66.67, 0); // 2/3 * 100
    });

    it('should group concerns by severity', async () => {
      (prisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue(mockConcerns);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getErrorDetectionStats(mockFilters);

      expect(result.bySeverity).toHaveLength(3);
      const errorSeverity = result.bySeverity.find(
        (s: { severity: string; count: number }) => s.severity === 'ERROR'
      );
      expect(errorSeverity?.count).toBe(1);
    });

    it('should group concerns by type', async () => {
      (prisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue(mockConcerns);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getErrorDetectionStats(mockFilters);

      expect(result.byType.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Time Savings Stats Tests
  // ============================================================================

  describe('getTimeSavingsStats', () => {
    it('should calculate time savings correctly', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue({
        defaultRates: { partnerRate: 300, associateRate: 200, paralegalRate: 100 },
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getTimeSavingsStats(mockFilters);

      // Contract: 120 - 45 = 75 min saved
      // Motion: 90 - 30 = 60 min saved
      // Total: 135 min saved
      expect(result.totalMinutesSaved).toBe(135);
    });

    it('should calculate estimated cost savings', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue({
        defaultRates: { partnerRate: 300, associateRate: 200, paralegalRate: 100 },
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getTimeSavingsStats(mockFilters);

      expect(result.estimatedCostSavings).toBeGreaterThan(0);
    });

    it('should include methodology explanation', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getTimeSavingsStats(mockFilters);

      expect(result.methodology).toContain('Time savings calculated');
    });
  });

  // ============================================================================
  // Template Usage Stats Tests
  // ============================================================================

  describe('getTemplateUsageStats', () => {
    it('should return top templates', async () => {
      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue(mockPatterns);
      (prisma.documentDraftMetrics.count as jest.Mock)
        .mockResolvedValueOnce(10) // with template
        .mockResolvedValueOnce(15); // total

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getTemplateUsageStats(mockFilters);

      expect(result.topTemplates).toHaveLength(1);
      expect(result.topTemplates[0].templateName).toBe('Contract de Vanzare');
    });

    it('should return top clauses', async () => {
      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue(mockPatterns);
      (prisma.documentDraftMetrics.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(15);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getTemplateUsageStats(mockFilters);

      expect(result.topClauses).toHaveLength(1);
      expect(result.topClauses[0].frequency).toBe(40);
    });

    it('should calculate template adoption rate', async () => {
      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue(mockPatterns);
      (prisma.documentDraftMetrics.count as jest.Mock)
        .mockResolvedValueOnce(10) // with template
        .mockResolvedValueOnce(20); // total

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getTemplateUsageStats(mockFilters);

      expect(result.templateAdoptionRate).toBe(50); // 10/20 = 50%
    });
  });

  // ============================================================================
  // Document Quality Trends Tests
  // ============================================================================

  describe('getDocumentQualityTrends', () => {
    it('should calculate overall quality score', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.documentVersion.groupBy as jest.Mock).mockResolvedValue([
        { documentId: 'doc-1', _count: { id: 2 } },
        { documentId: 'doc-2', _count: { id: 1 } },
      ]);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDocumentQualityTrends(mockFilters);

      // Average edit: (20 + 15) / 2 = 17.5%
      // Quality score: 100 - (17.5 * 2.5) = 56.25
      expect(result.overallQualityScore).toBeGreaterThan(50);
    });

    it('should calculate average revision count', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.documentVersion.groupBy as jest.Mock).mockResolvedValue([
        { documentId: 'doc-1', _count: { id: 3 } },
        { documentId: 'doc-2', _count: { id: 2 } },
      ]);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDocumentQualityTrends(mockFilters);

      // Average: (3 + 2) / 2 = 2.5
      expect(result.averageRevisionCount).toBe(2.5);
    });

    it('should include quality threshold', async () => {
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.documentVersion.groupBy as jest.Mock).mockResolvedValue([]);

      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDocumentQualityTrends(mockFilters);

      expect(result.qualityThreshold).toBe(30);
    });
  });

  // ============================================================================
  // Dashboard Metrics Tests
  // ============================================================================

  describe('getDashboardMetrics', () => {
    beforeEach(() => {
      // Set up all mocks for dashboard call
      (prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.document.count as jest.Mock).mockResolvedValue(3);
      (prisma.document.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.documentDraftMetrics.count as jest.Mock).mockResolvedValue(2);
      (prisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue(mockConcerns);
      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue(mockPatterns);
      (prisma.documentVersion.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(null);
    });

    it('should return all dashboard metrics', async () => {
      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDashboardMetrics(mockFilters);

      expect(result.velocity).toBeDefined();
      expect(result.aiUtilization).toBeDefined();
      expect(result.errorDetection).toBeDefined();
      expect(result.timeSavings).toBeDefined();
      expect(result.templateUsage).toBeDefined();
      expect(result.qualityTrends).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
      expect(result.dateRange).toBeDefined();
    });

    it('should return correct date range in response', async () => {
      const service = createDocumentIntelligenceService(mockPartnerContext);
      const result = await service.getDashboardMetrics(mockFilters);

      expect(result.dateRange.startDate).toEqual(mockFilters.dateRange.startDate);
      expect(result.dateRange.endDate).toEqual(mockFilters.dateRange.endDate);
    });
  });

  // ============================================================================
  // Cache Tests
  // ============================================================================

  describe('Caching', () => {
    it('should cache dashboard results', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.document.count as jest.Mock).mockResolvedValue(3);
      (prisma.document.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.documentDraftMetrics.count as jest.Mock).mockResolvedValue(2);
      (prisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue(mockConcerns);
      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue(mockPatterns);
      (prisma.documentVersion.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(null);

      const service = createDocumentIntelligenceService(mockPartnerContext);

      // First call
      await service.getDashboardMetrics(mockFilters);
      const callCount = (prisma.document.findMany as jest.Mock).mock.calls.length;

      // Second call (should use cache)
      await service.getDashboardMetrics(mockFilters);
      expect((prisma.document.findMany as jest.Mock).mock.calls.length).toBe(callCount);
    });

    it('should clear cache when requested', async () => {
      (prisma.document.findMany as jest.Mock).mockResolvedValue(mockDocuments);
      (prisma.document.count as jest.Mock).mockResolvedValue(3);
      (prisma.document.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.documentDraftMetrics.findMany as jest.Mock).mockResolvedValue(mockDraftMetrics);
      (prisma.documentDraftMetrics.count as jest.Mock).mockResolvedValue(2);
      (prisma.aIReviewConcern.findMany as jest.Mock).mockResolvedValue(mockConcerns);
      (prisma.templateLibrary.findMany as jest.Mock).mockResolvedValue(mockTemplates);
      (prisma.documentPattern.findMany as jest.Mock).mockResolvedValue(mockPatterns);
      (prisma.documentVersion.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.firm.findUnique as jest.Mock).mockResolvedValue(null);

      const service = createDocumentIntelligenceService(mockPartnerContext);

      // First call
      await service.getDashboardMetrics(mockFilters);
      const callCount = (prisma.document.findMany as jest.Mock).mock.calls.length;

      // Clear cache
      clearDocumentIntelligenceCache();

      // Third call (should not use cache)
      await service.getDashboardMetrics(mockFilters);
      expect((prisma.document.findMany as jest.Mock).mock.calls.length).toBeGreaterThan(callCount);
    });
  });
});
