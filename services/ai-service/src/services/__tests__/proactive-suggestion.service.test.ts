/**
 * Proactive Suggestion Service Tests
 * Story 5.4: Proactive AI Suggestions System - Task 35
 *
 * Tests for contextual AI suggestion generation with mocked dependencies.
 */

import { ProactiveSuggestionService } from '../proactive-suggestion.service';
import { providerManager } from '../provider-manager.service';
import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import {
  SuggestionContext,
  SuggestionType,
  SuggestionCategory,
  SuggestionPriority,
  ClaudeModel,
} from '@legal-platform/types';

// Mock dependencies
jest.mock('../provider-manager.service');
jest.mock('@legal-platform/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    task: { findMany: jest.fn() },
    email: { count: jest.fn() },
    userActionPattern: { findMany: jest.fn() },
    aISuggestion: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

describe('ProactiveSuggestionService', () => {
  let service: ProactiveSuggestionService;
  let mockRedis: jest.Mocked<Redis>;

  const sampleContext: SuggestionContext = {
    userId: 'user-123',
    firmId: 'firm-456',
    currentScreen: 'case_detail',
    currentCaseId: 'case-789',
    recentActions: [
      { type: 'viewed_document', timestamp: new Date() },
      { type: 'opened_email', timestamp: new Date() },
    ],
    userPreferences: {
      language: 'ro',
      aiSuggestionLevel: 'moderate',
      emailDigestFrequency: 'daily',
      dashboardLayout: {},
      timeZone: 'Europe/Bucharest',
    },
  };

  const sampleAIResponse = {
    content: JSON.stringify([
      {
        type: 'TaskSuggestion',
        category: 'Task',
        title: 'Complete contract review',
        description: 'You have pending contract review due tomorrow',
        suggestedAction: 'open_task',
        actionPayload: { taskId: 'task-123' },
        confidence: 0.85,
        priority: 'High',
      },
      {
        type: 'DeadlineWarning',
        category: 'Calendar',
        title: 'Deadline approaching',
        description: 'Filing deadline in 2 days',
        suggestedAction: 'view_deadline',
        actionPayload: { caseId: 'case-789' },
        confidence: 0.92,
        priority: 'Urgent',
      },
    ]),
    model: ClaudeModel.Haiku,
    inputTokens: 300,
    outputTokens: 150,
    latencyMs: 400,
  };

  beforeEach(() => {
    service = new ProactiveSuggestionService();
    mockRedis = new Redis() as jest.Mocked<Redis>;

    jest.clearAllMocks();

    // Setup default mock implementations
    (mockRedis.get as jest.Mock).mockResolvedValue(null);
    (mockRedis.setex as jest.Mock).mockResolvedValue('OK');
    (mockRedis.keys as jest.Mock).mockResolvedValue([]);
    (mockRedis.del as jest.Mock).mockResolvedValue(0);

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-123',
      role: 'Associate',
      firstName: 'Ion',
      lastName: 'Popescu',
    });

    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'task-1',
        title: 'Review contract',
        dueDate: new Date(),
        priority: 'High',
        status: 'Pending',
        type: 'DocumentReview',
      },
    ]);

    (prisma.email.count as jest.Mock).mockResolvedValue(5);

    (prisma.userActionPattern.findMany as jest.Mock).mockResolvedValue([]);

    (providerManager.execute as jest.Mock).mockResolvedValue(sampleAIResponse);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateContextualSuggestions', () => {
    it('should generate suggestions based on context', async () => {
      const suggestions = await service.generateContextualSuggestions(sampleContext);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].type).toBe('TaskSuggestion');
      expect(suggestions[1].type).toBe('DeadlineWarning');
    });

    it('should filter suggestions based on confidence threshold for moderate level', async () => {
      const lowConfidenceResponse = {
        ...sampleAIResponse,
        content: JSON.stringify([
          {
            type: 'TaskSuggestion',
            category: 'Task',
            title: 'Low confidence',
            description: 'Low confidence suggestion',
            suggestedAction: 'test',
            actionPayload: {},
            confidence: 0.3, // Below moderate threshold (0.5)
            priority: 'Normal',
          },
          {
            type: 'TaskSuggestion',
            category: 'Task',
            title: 'High confidence',
            description: 'High confidence suggestion',
            suggestedAction: 'test',
            actionPayload: {},
            confidence: 0.8, // Above threshold
            priority: 'Normal',
          },
        ]),
      };
      (providerManager.execute as jest.Mock).mockResolvedValue(lowConfidenceResponse);

      const suggestions = await service.generateContextualSuggestions(sampleContext);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should respect aggressive suggestion level (lower threshold)', async () => {
      const aggressiveContext = {
        ...sampleContext,
        userPreferences: {
          ...sampleContext.userPreferences,
          aiSuggestionLevel: 'aggressive' as const,
        },
      };

      const lowConfidenceResponse = {
        ...sampleAIResponse,
        content: JSON.stringify([
          {
            type: 'TaskSuggestion',
            category: 'Task',
            title: 'Low confidence',
            description: 'Low confidence suggestion',
            suggestedAction: 'test',
            actionPayload: {},
            confidence: 0.35, // Above aggressive threshold (0.3)
            priority: 'Normal',
          },
        ]),
      };
      (providerManager.execute as jest.Mock).mockResolvedValue(lowConfidenceResponse);

      const suggestions = await service.generateContextualSuggestions(aggressiveContext);

      expect(suggestions).toHaveLength(1);
    });

    it('should respect minimal suggestion level (higher threshold)', async () => {
      const minimalContext = {
        ...sampleContext,
        userPreferences: {
          ...sampleContext.userPreferences,
          aiSuggestionLevel: 'minimal' as const,
        },
      };

      const suggestions = await service.generateContextualSuggestions(minimalContext);

      // Only the DeadlineWarning (0.92) should pass the 0.7 threshold
      expect(suggestions.every(s => s.confidence >= 0.7)).toBe(true);
    });

    it('should use Haiku model for fast suggestions', async () => {
      await service.generateContextualSuggestions(sampleContext);

      expect(providerManager.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: ClaudeModel.Haiku,
        })
      );
    });

    it('should return cached suggestions if available', async () => {
      const cachedSuggestions = [
        {
          type: 'TaskSuggestion',
          category: 'Task',
          title: 'Cached suggestion',
          description: 'From cache',
          suggestedAction: 'test',
          actionPayload: {},
          confidence: 0.9,
          priority: 'Normal',
        },
      ];
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedSuggestions));

      const suggestions = await service.generateContextualSuggestions(sampleContext);

      expect(providerManager.execute).not.toHaveBeenCalled();
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Cached suggestion');
    });

    it('should return empty array on API error', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(new Error('API Error'));

      const suggestions = await service.generateContextualSuggestions(sampleContext);

      expect(suggestions).toHaveLength(0);
    });

    it('should handle JSON response wrapped in markdown code blocks', async () => {
      const markdownResponse = {
        ...sampleAIResponse,
        content: '```json\n' + sampleAIResponse.content + '\n```',
      };
      (providerManager.execute as jest.Mock).mockResolvedValue(markdownResponse);

      const suggestions = await service.generateContextualSuggestions(sampleContext);

      expect(suggestions).toHaveLength(2);
    });

    it('should return empty array for invalid JSON response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: 'Invalid JSON response',
      });

      const suggestions = await service.generateContextualSuggestions(sampleContext);

      expect(suggestions).toHaveLength(0);
    });

    it('should limit suggestions to MAX_SUGGESTIONS_PER_CONTEXT (5)', async () => {
      const manyResponse = {
        ...sampleAIResponse,
        content: JSON.stringify(
          Array(10).fill(null).map((_, i) => ({
            type: 'TaskSuggestion',
            category: 'Task',
            title: `Suggestion ${i}`,
            description: 'Test',
            suggestedAction: 'test',
            actionPayload: {},
            confidence: 0.9,
            priority: 'Normal',
          }))
        ),
      };
      (providerManager.execute as jest.Mock).mockResolvedValue(manyResponse);

      const suggestions = await service.generateContextualSuggestions(sampleContext);

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('storeSuggestion', () => {
    it('should store suggestion in database', async () => {
      const suggestion = {
        type: 'TaskSuggestion' as SuggestionType,
        category: 'Task' as SuggestionCategory,
        title: 'Test suggestion',
        description: 'Test description',
        suggestedAction: 'test_action',
        actionPayload: { test: 'data' },
        confidence: 0.85,
        priority: 'High' as SuggestionPriority,
      };

      (prisma.aISuggestion.create as jest.Mock).mockResolvedValue({
        id: 'suggestion-123',
        ...suggestion,
      });

      const id = await service.storeSuggestion('firm-456', 'user-123', suggestion, 'case-789');

      expect(id).toBe('suggestion-123');
      expect(prisma.aISuggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firmId: 'firm-456',
          userId: 'user-123',
          caseId: 'case-789',
          type: 'TaskSuggestion',
          title: 'Test suggestion',
          status: 'Pending',
        }),
      });
    });
  });

  describe('getPendingSuggestions', () => {
    it('should fetch pending suggestions ordered by priority and date', async () => {
      const mockSuggestions = [
        { id: 'sug-1', priority: 'Urgent', createdAt: new Date() },
        { id: 'sug-2', priority: 'High', createdAt: new Date() },
      ];
      (prisma.aISuggestion.findMany as jest.Mock).mockResolvedValue(mockSuggestions);

      const suggestions = await service.getPendingSuggestions('user-123', 'firm-456', 10, 0);

      expect(prisma.aISuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            firmId: 'firm-456',
            status: 'Pending',
          }),
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        })
      );
      expect(suggestions).toHaveLength(2);
    });

    it('should exclude expired suggestions', async () => {
      await service.getPendingSuggestions('user-123', 'firm-456');

      expect(prisma.aISuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: expect.any(Date) } },
            ],
          }),
        })
      );
    });
  });

  describe('acceptSuggestion', () => {
    it('should update suggestion status to Accepted', async () => {
      const mockUpdated = {
        id: 'sug-123',
        status: 'Accepted',
        type: 'TaskSuggestion',
        acceptedAt: new Date(),
      };
      (prisma.aISuggestion.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await service.acceptSuggestion('sug-123', 'user-123', 'firm-456');

      expect(prisma.aISuggestion.update).toHaveBeenCalledWith({
        where: {
          id: 'sug-123',
          userId: 'user-123',
          firmId: 'firm-456',
        },
        data: {
          status: 'Accepted',
          acceptedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('Accepted');
    });
  });

  describe('dismissSuggestion', () => {
    it('should update suggestion status to Dismissed with reason', async () => {
      const mockUpdated = {
        id: 'sug-123',
        status: 'Dismissed',
        type: 'TaskSuggestion',
        dismissedAt: new Date(),
        dismissReason: 'Not relevant',
      };
      (prisma.aISuggestion.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await service.dismissSuggestion('sug-123', 'user-123', 'firm-456', 'Not relevant');

      expect(prisma.aISuggestion.update).toHaveBeenCalledWith({
        where: {
          id: 'sug-123',
          userId: 'user-123',
          firmId: 'firm-456',
        },
        data: {
          status: 'Dismissed',
          dismissedAt: expect.any(Date),
          dismissReason: 'Not relevant',
        },
      });
      expect(result.dismissReason).toBe('Not relevant');
    });
  });

  describe('markExpiredSuggestions', () => {
    it('should mark all expired suggestions as Expired', async () => {
      (prisma.aISuggestion.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      const count = await service.markExpiredSuggestions();

      expect(prisma.aISuggestion.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'Pending',
          expiresAt: { lte: expect.any(Date) },
        },
        data: { status: 'Expired' },
      });
      expect(count).toBe(5);
    });
  });

  describe('invalidateCache', () => {
    it('should delete all cached suggestions for user', async () => {
      (mockRedis.keys as jest.Mock).mockResolvedValue([
        'suggestions:firm-456:user-123:dashboard:none',
        'suggestions:firm-456:user-123:case_detail:case-789',
      ]);

      await service.invalidateCache('user-123', 'firm-456');

      expect(mockRedis.keys).toHaveBeenCalledWith('suggestions:firm-456:user-123:*');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
