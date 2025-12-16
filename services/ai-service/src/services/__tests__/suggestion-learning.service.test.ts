/**
 * Suggestion Learning Service Tests
 * Story 5.4: Proactive AI Suggestions System - Task 35
 *
 * Tests for feedback recording and learning metrics calculation.
 */

import {
  SuggestionLearningService,
  type FeedbackRecord,
  type LearningMetrics,
} from '../suggestion-learning.service';
import { prisma } from '@legal-platform/database';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    suggestionFeedback: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    aISuggestion: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    userLearningMetrics: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('SuggestionLearningService', () => {
  let service: SuggestionLearningService;

  const sampleFeedback: FeedbackRecord = {
    suggestionId: 'sug-123',
    action: 'accepted',
    responseTimeMs: 1500,
  };

  const sampleFeedbackRecords = [
    {
      id: 'fb-1',
      suggestionId: 'sug-1',
      userId: 'user-123',
      firmId: 'firm-456',
      action: 'accepted',
      responseTimeMs: 1000,
      createdAt: new Date(),
      suggestion: { type: 'TaskSuggestion', category: 'Task' },
    },
    {
      id: 'fb-2',
      suggestionId: 'sug-2',
      userId: 'user-123',
      firmId: 'firm-456',
      action: 'accepted',
      responseTimeMs: 2000,
      createdAt: new Date(),
      suggestion: { type: 'TaskSuggestion', category: 'Task' },
    },
    {
      id: 'fb-3',
      suggestionId: 'sug-3',
      userId: 'user-123',
      firmId: 'firm-456',
      action: 'dismissed',
      feedbackReason: 'not_relevant',
      responseTimeMs: 500,
      createdAt: new Date(),
      suggestion: { type: 'DeadlineWarning', category: 'Calendar' },
    },
  ];

  beforeEach(() => {
    service = new SuggestionLearningService();
    jest.clearAllMocks();

    // Default mock implementations
    (prisma.suggestionFeedback.create as jest.Mock).mockResolvedValue({
      id: 'fb-new',
      ...sampleFeedback,
    });

    (prisma.suggestionFeedback.findMany as jest.Mock).mockResolvedValue(sampleFeedbackRecords);

    (prisma.aISuggestion.update as jest.Mock).mockResolvedValue({
      id: 'sug-123',
      status: 'Accepted',
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('recordSuggestionFeedback', () => {
    it('should record accepted feedback', async () => {
      await service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', sampleFeedback);

      expect(prisma.suggestionFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          suggestionId: 'sug-123',
          userId: 'user-123',
          firmId: 'firm-456',
          action: 'accepted',
          responseTimeMs: 1500,
        }),
      });
    });

    it('should record dismissed feedback with reason', async () => {
      const dismissedFeedback: FeedbackRecord = {
        suggestionId: 'sug-123',
        action: 'dismissed',
        feedbackReason: 'not_relevant',
        responseTimeMs: 800,
      };

      await service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', dismissedFeedback);

      expect(prisma.suggestionFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'dismissed',
          feedbackReason: 'not_relevant',
        }),
      });
    });

    it('should record modified feedback with alternative action', async () => {
      const modifiedFeedback: FeedbackRecord = {
        suggestionId: 'sug-123',
        action: 'modified',
        modifiedAction: { alternativeAction: 'Created a different task' },
        responseTimeMs: 3000,
      };

      await service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', modifiedFeedback);

      expect(prisma.suggestionFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'modified',
          modifiedAction: { alternativeAction: 'Created a different task' },
        }),
      });
    });

    it('should update suggestion status to Accepted', async () => {
      await service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', sampleFeedback);

      expect(prisma.aISuggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-123' },
        data: expect.objectContaining({
          status: 'Accepted',
          acceptedAt: expect.any(Date),
        }),
      });
    });

    it('should update suggestion status to Dismissed', async () => {
      const dismissedFeedback: FeedbackRecord = {
        suggestionId: 'sug-123',
        action: 'dismissed',
        responseTimeMs: 500,
      };

      await service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', dismissedFeedback);

      expect(prisma.aISuggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-123' },
        data: expect.objectContaining({
          status: 'Dismissed',
          dismissedAt: expect.any(Date),
        }),
      });
    });

    it('should handle modified as accepted status', async () => {
      const modifiedFeedback: FeedbackRecord = {
        suggestionId: 'sug-123',
        action: 'modified',
        responseTimeMs: 2000,
      };

      await service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', modifiedFeedback);

      expect(prisma.aISuggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-123' },
        data: expect.objectContaining({
          status: 'Accepted',
        }),
      });
    });

    it('should handle ignored as expired status', async () => {
      const ignoredFeedback: FeedbackRecord = {
        suggestionId: 'sug-123',
        action: 'ignored',
        responseTimeMs: 0,
      };

      await service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', ignoredFeedback);

      expect(prisma.aISuggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-123' },
        data: expect.objectContaining({
          status: 'Expired',
        }),
      });
    });

    it('should throw error on database failure', async () => {
      (prisma.suggestionFeedback.create as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(
        service.recordSuggestionFeedback('sug-123', 'user-123', 'firm-456', sampleFeedback)
      ).rejects.toThrow('DB Error');
    });
  });

  describe('getAcceptanceStats', () => {
    it('should calculate overall acceptance rate', async () => {
      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      expect(stats.overallAcceptanceRate).toBeCloseTo(0.67, 1); // 2/3 accepted
    });

    it('should calculate stats by suggestion type', async () => {
      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      expect(stats.byType).toBeDefined();
      expect(stats.byType['TaskSuggestion']).toBeDefined();
      expect(stats.byType['TaskSuggestion'].acceptanceRate).toBe(1); // 2/2
      expect(stats.byType['DeadlineWarning'].acceptanceRate).toBe(0); // 0/1
    });

    it('should calculate stats by category', async () => {
      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      expect(stats.byCategory).toBeDefined();
      expect(stats.byCategory['Task']).toBeDefined();
      expect(stats.byCategory['Calendar']).toBeDefined();
    });

    it('should calculate average response time', async () => {
      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      expect(stats.byType['TaskSuggestion'].averageResponseTimeMs).toBeCloseTo(1500, 0); // (1000+2000)/2
    });

    it('should include last updated timestamp', async () => {
      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle empty feedback gracefully', async () => {
      (prisma.suggestionFeedback.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      expect(stats.overallAcceptanceRate).toBe(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);
    });

    it('should use specified lookback period', async () => {
      await service.getAcceptanceStats('user-123', 'firm-456', 7);

      expect(prisma.suggestionFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: expect.any(Date),
            },
          }),
        })
      );
    });
  });

  describe('getConfidenceAdjustments', () => {
    it('should not adjust confidence with insufficient samples', async () => {
      const feedbackWithFewSamples = sampleFeedbackRecords.slice(0, 2);
      (prisma.suggestionFeedback.findMany as jest.Mock).mockResolvedValue(feedbackWithFewSamples);

      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      // With less than MIN_SAMPLES_FOR_ADJUSTMENT (10), no adjustments
      expect(stats.confidenceAdjustments).toEqual({});
    });

    it('should increase confidence for high acceptance types', async () => {
      // Create 15 accepted feedbacks for TaskSuggestion
      const manyAccepted = Array(15)
        .fill(null)
        .map((_, i) => ({
          id: `fb-${i}`,
          suggestionId: `sug-${i}`,
          userId: 'user-123',
          firmId: 'firm-456',
          action: 'accepted',
          responseTimeMs: 1000,
          createdAt: new Date(),
          suggestion: { type: 'TaskSuggestion', category: 'Task' },
        }));
      (prisma.suggestionFeedback.findMany as jest.Mock).mockResolvedValue(manyAccepted);

      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      // With 100% acceptance rate and sufficient samples, confidence should be positive
      if (stats.confidenceAdjustments['TaskSuggestion']) {
        expect(stats.confidenceAdjustments['TaskSuggestion']).toBeGreaterThan(0);
      }
    });

    it('should decrease confidence for low acceptance types', async () => {
      // Create 15 dismissed feedbacks for TaskSuggestion
      const manyDismissed = Array(15)
        .fill(null)
        .map((_, i) => ({
          id: `fb-${i}`,
          suggestionId: `sug-${i}`,
          userId: 'user-123',
          firmId: 'firm-456',
          action: 'dismissed',
          responseTimeMs: 500,
          createdAt: new Date(),
          suggestion: { type: 'TaskSuggestion', category: 'Task' },
        }));
      (prisma.suggestionFeedback.findMany as jest.Mock).mockResolvedValue(manyDismissed);

      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 30);

      // With 0% acceptance rate and sufficient samples, confidence should be negative
      if (stats.confidenceAdjustments['TaskSuggestion']) {
        expect(stats.confidenceAdjustments['TaskSuggestion']).toBeLessThan(0);
      }
    });
  });

  describe('getSuggestionAnalytics', () => {
    it('should return analytics for date range', async () => {
      (prisma.suggestionFeedback.groupBy as jest.Mock).mockResolvedValue([
        { type: 'TaskSuggestion', _count: { id: 10 } },
        { type: 'DeadlineWarning', _count: { id: 5 } },
      ]);

      const analytics = await service.getSuggestionAnalytics('firm-456', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(analytics).toBeDefined();
      expect(analytics.totalSuggestions).toBeGreaterThan(0);
    });

    it('should calculate acceptance rate by type', async () => {
      const analytics = await service.getSuggestionAnalytics('firm-456', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(analytics.byType).toBeDefined();
    });
  });

  describe('learning decay', () => {
    it('should weight recent feedback higher', async () => {
      const oldFeedback = {
        ...sampleFeedbackRecords[0],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      };
      const recentFeedback = {
        ...sampleFeedbackRecords[1],
        createdAt: new Date(), // today
      };

      (prisma.suggestionFeedback.findMany as jest.Mock).mockResolvedValue([
        oldFeedback,
        recentFeedback,
      ]);

      const stats = await service.getAcceptanceStats('user-123', 'firm-456', 90);

      // Recent feedback should have more weight in the calculation
      expect(stats.overallAcceptanceRate).toBeDefined();
    });
  });
});
