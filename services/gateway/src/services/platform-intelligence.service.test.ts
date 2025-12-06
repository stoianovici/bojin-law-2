/**
 * Platform Intelligence Service Unit Tests
 * Story 5.7: Platform Intelligence Dashboard - Task 24
 *
 * Tests for:
 * - Dashboard aggregation
 * - Health score calculation
 * - Recommendation generation
 */

import { PlatformIntelligenceService } from './platform-intelligence.service';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(0),
  }));
});

// Test constants
const TEST_FIRM_ID = 'test-firm-123';
const DEFAULT_DATE_RANGE = {
  startDate: new Date('2025-11-01'),
  endDate: new Date('2025-11-30'),
};

describe('PlatformIntelligenceService', () => {
  let service: PlatformIntelligenceService;
  let mockCommService: any;
  let mockDocService: any;
  let mockAIService: any;
  let mockTaskService: any;
  let mockROIService: any;
  let mockOverdueService: any;
  let mockPrisma: any;

  beforeEach(() => {
    // Mock communication service
    mockCommService = {
      getCommunicationAnalytics: jest.fn().mockResolvedValue({
        currentResponseTime: {
          avgResponseTimeHours: 4.5,
          medianResponseTimeHours: 3.2,
          p90ResponseTimeHours: 8.0,
          totalEmailsAnalyzed: 250,
          withinSLAPercent: 85,
        },
        baselineComparison: {
          currentPeriod: { avgResponseTimeHours: 4.5 },
          baselinePeriod: { avgResponseTimeHours: 6.0 },
          improvementPercent: 25,
        },
        byRecipientType: [
          { emailType: 'client', metrics: { avgResponseTimeHours: 3.0 }, volumeCount: 150 },
        ],
        trend: [],
      }),
    };

    // Mock document quality service
    mockDocService = {
      getDocumentQualityAnalytics: jest.fn().mockResolvedValue({
        revisionMetrics: {
          totalDocumentsCreated: 100,
          avgRevisionsPerDocument: 1.5,
          documentsWithZeroRevisions: 60,
          documentsWithMultipleRevisions: 40,
          firstTimeRightPercent: 60,
        },
        errorMetrics: {
          totalReviewsCompleted: 80,
          reviewsWithIssues: 20,
          issuesByCategory: { spelling: 5, content: 10, formatting: 3, legal_reference: 2 },
          avgIssuesPerReview: 0.25,
          issueResolutionTimeHours: 2.5,
        },
        qualityTrend: [],
      }),
    };

    // Mock AI service
    mockAIService = {
      getAIUtilizationSummary: jest.fn().mockResolvedValue({
        firmTotal: {
          totalRequests: 5000,
          totalTokens: 1000000,
          totalCostCents: 5000,
          avgRequestsPerUser: 250,
        },
        byUser: [
          { userId: 'user-1', userName: 'Test User', totalRequests: 500, adoptionScore: 80 },
          { userId: 'user-2', userName: 'Test User 2', totalRequests: 100, adoptionScore: 30 },
        ],
        byFeature: [
          { feature: 'email_drafting', requestCount: 2000, tokenCount: 400000 },
          { feature: 'document_generation', requestCount: 1500, tokenCount: 300000 },
        ],
        topUsers: [{ userId: 'user-1', userName: 'Test User', adoptionScore: 80 }],
        underutilizedUsers: [{ userId: 'user-2', userName: 'Test User 2', adoptionScore: 30 }],
      }),
    };

    // Mock task service
    mockTaskService = {
      getCompletionMetrics: jest.fn().mockResolvedValue({
        totalTasks: 200,
        completedTasks: 180,
        completionRate: 90,
        avgCompletionTimeHours: 24,
        onTimeCompletionRate: 85,
      }),
    };

    // Mock ROI service
    mockROIService = {
      calculateROI: jest.fn().mockResolvedValue({
        currentPeriod: {
          totalValueSaved: 15000,
          totalTimeSavedHours: 75,
        },
        projectedAnnualSavings: 180000,
        topSavingsCategories: [
          { category: 'Document Generation', valueSaved: 8000, percentOfTotal: 53 },
          { category: 'Email Drafting', valueSaved: 5000, percentOfTotal: 33 },
        ],
      }),
    };

    // Mock overdue service
    mockOverdueService = {
      getOverdueMetrics: jest.fn().mockResolvedValue({
        overdueCount: 3,
        criticalOverdue: 1,
        avgDaysOverdue: 2.5,
      }),
    };

    // Mock prisma
    mockPrisma = {
      firm: {
        findUnique: jest.fn().mockResolvedValue({ id: TEST_FIRM_ID, name: 'Test Firm' }),
      },
    };

    service = new PlatformIntelligenceService(mockPrisma, undefined, {
      commService: mockCommService,
      docService: mockDocService,
      aiService: mockAIService,
      taskService: mockTaskService,
      roiService: mockROIService,
      overdueService: mockOverdueService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('should aggregate data from all services', async () => {
      const result = await service.getDashboard(TEST_FIRM_ID, DEFAULT_DATE_RANGE);

      expect(result.firmId).toBe(TEST_FIRM_ID);
      expect(result.dateRange).toBeDefined();
      expect(result.generatedAt).toBeDefined();

      // Verify all sections are populated
      expect(result.efficiency).toBeDefined();
      expect(result.communication).toBeDefined();
      expect(result.documentQuality).toBeDefined();
      expect(result.taskCompletion).toBeDefined();
      expect(result.aiUtilization).toBeDefined();
      expect(result.roi).toBeDefined();
      expect(result.platformHealthScore).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should call all underlying services', async () => {
      await service.getDashboard(TEST_FIRM_ID, DEFAULT_DATE_RANGE);

      expect(mockCommService.getCommunicationAnalytics).toHaveBeenCalled();
      expect(mockDocService.getDocumentQualityAnalytics).toHaveBeenCalled();
      expect(mockAIService.getAIUtilizationSummary).toHaveBeenCalled();
      expect(mockTaskService.getCompletionMetrics).toHaveBeenCalled();
      expect(mockROIService.calculateROI).toHaveBeenCalled();
    });

    it('should return valid health score between 0 and 100', async () => {
      const result = await service.getDashboard(TEST_FIRM_ID, DEFAULT_DATE_RANGE);

      expect(result.platformHealthScore).toBeGreaterThanOrEqual(0);
      expect(result.platformHealthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('calculatePlatformHealthScore', () => {
    // Helper to create mock params for calculatePlatformHealthScore
    const createHealthScoreParams = (overrides: {
      commImprovement?: number;
      firstTimeRight?: number;
      completionRate?: number;
      adoptionScores?: number[];
      billableHoursRecovered?: number;
    } = {}) => {
      const communication = {
        baselineComparison: { improvementPercent: overrides.commImprovement ?? 30 },
      } as any;

      const documentQuality = {
        revisionMetrics: { firstTimeRightPercent: overrides.firstTimeRight ?? 80 },
      } as any;

      const taskCompletion = {
        completionRate: overrides.completionRate ?? 90,
      } as any;

      const byUser = (overrides.adoptionScores ?? [70, 70]).map((score, i) => ({
        userId: `user-${i}`,
        adoptionScore: score,
      }));
      const aiUtilization = { byUser } as any;

      const roiData = {
        billableHoursRecovered: overrides.billableHoursRecovered ?? 10,
      } as any;

      return { communication, documentQuality, taskCompletion, aiUtilization, roiData };
    };

    it('should calculate weighted score from all categories', () => {
      const { communication, documentQuality, taskCompletion, aiUtilization, roiData } =
        createHealthScoreParams({
          commImprovement: 30,
          firstTimeRight: 80,
          completionRate: 90,
          adoptionScores: [70, 70],
          billableHoursRecovered: 10,
        });

      const score = service.calculatePlatformHealthScore(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        roiData
      );

      // All categories at or near target = high score
      expect(score).toBeGreaterThan(70);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle partial data gracefully', () => {
      const communication = { baselineComparison: null } as any;
      const documentQuality = { revisionMetrics: { firstTimeRightPercent: 50 } } as any;
      const taskCompletion = { completionRate: 50 } as any;
      const aiUtilization = { byUser: [] } as any;
      const roiData = { billableHoursRecovered: 0 } as any;

      const score = service.calculatePlatformHealthScore(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        roiData
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return low score when all metrics are at minimum', () => {
      const communication = { baselineComparison: { improvementPercent: 0 } } as any;
      const documentQuality = { revisionMetrics: { firstTimeRightPercent: 0 } } as any;
      const taskCompletion = { completionRate: 0 } as any;
      const aiUtilization = { byUser: [] } as any;
      const roiData = { billableHoursRecovered: 0 } as any;

      const score = service.calculatePlatformHealthScore(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        roiData
      );

      expect(score).toBeLessThanOrEqual(20);
    });
  });

  describe('generateRecommendations', () => {
    // Helper to create mock data for generateRecommendations
    const createMockParams = (overrides: {
      commImprovement?: number;
      firstTimeRight?: number;
      completionRate?: number;
      underutilizedUsers?: Array<{ userId: string; userName: string; adoptionScore: number }>;
      overdueCount?: number;
    } = {}) => {
      const communication = {
        baselineComparison: { improvementPercent: overrides.commImprovement ?? 30 },
      } as any;

      const documentQuality = {
        revisionMetrics: { firstTimeRightPercent: overrides.firstTimeRight ?? 80 },
      } as any;

      const taskCompletion = {
        completionRate: overrides.completionRate ?? 90,
      } as any;

      const aiUtilization = {
        underutilizedUsers: overrides.underutilizedUsers ?? [],
      } as any;

      const overdueCount = overrides.overdueCount ?? 0;

      return { communication, documentQuality, taskCompletion, aiUtilization, overdueCount };
    };

    it('should generate recommendation when response time improvement is low', () => {
      const { communication, documentQuality, taskCompletion, aiUtilization, overdueCount } =
        createMockParams({ commImprovement: 5 }); // Below 10% threshold

      const recommendations = service.generateRecommendations(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        overdueCount
      );

      const commRec = recommendations.find((r) => r.category === 'communication');
      expect(commRec).toBeDefined();
      expect(commRec?.priority).toBe('medium');
    });

    it('should generate recommendation when document quality is poor', () => {
      const { communication, documentQuality, taskCompletion, aiUtilization, overdueCount } =
        createMockParams({ firstTimeRight: 50 }); // Below 70% threshold

      const recommendations = service.generateRecommendations(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        overdueCount
      );

      const qualityRec = recommendations.find((r) => r.category === 'quality');
      expect(qualityRec).toBeDefined();
    });

    it('should generate recommendation when task completion is low', () => {
      const { communication, documentQuality, taskCompletion, aiUtilization, overdueCount } =
        createMockParams({ completionRate: 70 }); // Below 85% threshold

      const recommendations = service.generateRecommendations(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        overdueCount
      );

      const taskRec = recommendations.find((r) => r.category === 'efficiency');
      expect(taskRec).toBeDefined();
    });

    it('should generate recommendation for underutilized users', () => {
      const { communication, documentQuality, taskCompletion, aiUtilization, overdueCount } =
        createMockParams({
          underutilizedUsers: [
            { userId: 'user-1', userName: 'Test', adoptionScore: 20 },
            { userId: 'user-2', userName: 'Test2', adoptionScore: 25 },
            { userId: 'user-3', userName: 'Test3', adoptionScore: 30 },
          ],
        });

      const recommendations = service.generateRecommendations(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        overdueCount
      );

      const adoptionRec = recommendations.find((r) => r.category === 'adoption');
      expect(adoptionRec).toBeDefined();
      expect(adoptionRec?.priority).toBe('high');
    });

    it('should return empty array when all metrics are good', () => {
      const { communication, documentQuality, taskCompletion, aiUtilization, overdueCount } =
        createMockParams({
          commImprovement: 30,
          firstTimeRight: 85,
          completionRate: 95,
          underutilizedUsers: [],
          overdueCount: 0,
        });

      const recommendations = service.generateRecommendations(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        overdueCount
      );

      expect(recommendations.length).toBe(0);
    });

    it('should include actionable steps in recommendations', () => {
      const { communication, documentQuality, taskCompletion, aiUtilization, overdueCount } =
        createMockParams({ firstTimeRight: 50 }); // Will generate quality recommendation

      const recommendations = service.generateRecommendations(
        communication,
        documentQuality,
        taskCompletion,
        aiUtilization,
        overdueCount
      );

      expect(recommendations[0].actionableSteps).toBeDefined();
      expect(recommendations[0].actionableSteps.length).toBeGreaterThan(0);
    });
  });

  describe('caching', () => {
    it('should cache dashboard data', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        keys: jest.fn().mockResolvedValue([]),
        del: jest.fn().mockResolvedValue(0),
      };

      const serviceWithRedis = new PlatformIntelligenceService(mockPrisma, mockRedis as any, {
        commService: mockCommService,
        docService: mockDocService,
        aiService: mockAIService,
        taskService: mockTaskService,
        roiService: mockROIService,
        overdueService: mockOverdueService,
      });

      await serviceWithRedis.getDashboard(TEST_FIRM_ID, DEFAULT_DATE_RANGE);

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return cached data if available', async () => {
      const cachedData = {
        firmId: TEST_FIRM_ID,
        platformHealthScore: 85,
        recommendations: [],
      };

      const mockRedis = {
        get: jest.fn().mockResolvedValue(JSON.stringify(cachedData)),
        setex: jest.fn(),
        keys: jest.fn().mockResolvedValue([]),
        del: jest.fn().mockResolvedValue(0),
      };

      const serviceWithRedis = new PlatformIntelligenceService(mockPrisma, mockRedis as any, {
        commService: mockCommService,
        docService: mockDocService,
        aiService: mockAIService,
        taskService: mockTaskService,
        roiService: mockROIService,
        overdueService: mockOverdueService,
      });

      const result = await serviceWithRedis.getDashboard(TEST_FIRM_ID, DEFAULT_DATE_RANGE);

      expect(result.platformHealthScore).toBe(85);
      expect(mockCommService.getCommunicationAnalytics).not.toHaveBeenCalled();
    });

    it('should invalidate cache', async () => {
      const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        keys: jest.fn().mockResolvedValue([`platform-intelligence:${TEST_FIRM_ID}:*`]),
        del: jest.fn().mockResolvedValue(1),
      };

      const serviceWithRedis = new PlatformIntelligenceService(mockPrisma, mockRedis as any, {
        commService: mockCommService,
        docService: mockDocService,
        aiService: mockAIService,
        taskService: mockTaskService,
        roiService: mockROIService,
        overdueService: mockOverdueService,
      });

      await serviceWithRedis.invalidateCache(TEST_FIRM_ID);

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle service failures gracefully', async () => {
      mockCommService.getCommunicationAnalytics.mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      // Service should still return a result with partial data
      const result = await service.getDashboard(TEST_FIRM_ID, DEFAULT_DATE_RANGE);

      // Should still have some data even if one service fails
      expect(result.firmId).toBe(TEST_FIRM_ID);
    });
  });
});
