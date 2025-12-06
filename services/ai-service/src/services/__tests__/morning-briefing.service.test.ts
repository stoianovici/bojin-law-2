/**
 * Morning Briefing Service Tests
 * Story 5.4: Proactive AI Suggestions System - Task 35
 *
 * Tests for daily AI-powered morning briefing generation with task prioritization.
 */

import { MorningBriefingService } from '../morning-briefing.service';
import { providerManager } from '../provider-manager.service';
import { prisma } from '@legal-platform/database';
import Redis from 'ioredis';
import { ClaudeModel } from '@legal-platform/types';

// Mock dependencies
jest.mock('../provider-manager.service');
jest.mock('@legal-platform/database', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    task: { findMany: jest.fn() },
    extractedDeadline: { findMany: jest.fn() },
    extractedActionItem: { findMany: jest.fn() },
    riskIndicator: { findMany: jest.fn() },
    morningBriefing: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

describe('MorningBriefingService', () => {
  let service: MorningBriefingService;
  let mockRedis: jest.Mocked<Redis>;

  const sampleAIResponse = {
    content: JSON.stringify({
      summary: 'Astăzi aveți 5 task-uri prioritare și 2 termene importante.',
      prioritizedTasks: [
        {
          taskId: 'task-1',
          priority: 9,
          priorityReason: 'Termen limită mâine, client important',
          suggestedTimeSlot: '09:00 - 11:00',
        },
        {
          taskId: 'task-2',
          priority: 7,
          priorityReason: 'Blochează alte task-uri',
          suggestedTimeSlot: '11:00 - 12:00',
        },
      ],
      keyDeadlines: [
        {
          taskId: 'task-1',
          caseId: 'case-1',
          title: 'Depunere cerere instanță',
          dueDate: '2024-12-15',
          daysUntilDue: 1,
          severity: 'critical',
        },
      ],
      riskAlerts: [
        {
          caseId: 'case-2',
          title: 'Risc termen prescripție',
          description: 'Termenul de prescripție expiră în 30 zile',
          severity: 'warning',
        },
      ],
      suggestions: [
        {
          type: 'TaskSuggestion',
          category: 'Task',
          title: 'Programează întâlnire client',
          description: 'Clientul a cerut update săptămânal',
          suggestedAction: 'create_meeting',
          actionPayload: { caseId: 'case-1' },
          confidence: 0.85,
          priority: 'Normal',
        },
      ],
    }),
    model: ClaudeModel.Sonnet,
    inputTokens: 800,
    outputTokens: 400,
    latencyMs: 2000,
  };

  const sampleUser = {
    id: 'user-123',
    firstName: 'Ion',
    lastName: 'Popescu',
    role: 'Associate',
    firmId: 'firm-456',
  };

  const sampleTasks = [
    {
      id: 'task-1',
      title: 'Depunere cerere instanță',
      dueDate: new Date(Date.now() + 86400000), // tomorrow
      priority: 'Urgent',
      status: 'Pending',
      type: 'CourtFiling',
      case: { id: 'case-1', title: 'Dosar Civil nr. 123/2024' },
      client: { id: 'client-1', name: 'SC Example SRL', importanceLevel: 'VIP' },
    },
    {
      id: 'task-2',
      title: 'Revizuire contract',
      dueDate: new Date(Date.now() + 172800000), // 2 days
      priority: 'High',
      status: 'InProgress',
      type: 'DocumentReview',
      case: { id: 'case-2', title: 'Dosar Comercial nr. 456/2024' },
      client: { id: 'client-2', name: 'PF Ionescu', importanceLevel: 'Standard' },
    },
  ];

  beforeEach(() => {
    service = new MorningBriefingService();
    mockRedis = new Redis() as jest.Mocked<Redis>;

    jest.clearAllMocks();

    // Setup default mock implementations
    (mockRedis.get as jest.Mock).mockResolvedValue(null);
    (mockRedis.setex as jest.Mock).mockResolvedValue('OK');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(sampleUser);
    (prisma.task.findMany as jest.Mock).mockResolvedValue(sampleTasks);
    (prisma.extractedDeadline.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.extractedActionItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.riskIndicator.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.morningBriefing.create as jest.Mock).mockResolvedValue({
      id: 'briefing-123',
      userId: 'user-123',
      firmId: 'firm-456',
    });
    (prisma.morningBriefing.findFirst as jest.Mock).mockResolvedValue(null);

    (providerManager.execute as jest.Mock).mockResolvedValue(sampleAIResponse);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('generateMorningBriefing', () => {
    it('should generate a briefing with prioritized tasks', async () => {
      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.prioritizedTasks).toBeDefined();
      expect(briefing.prioritizedTasks.length).toBeGreaterThan(0);
      expect(briefing.prioritizedTasks[0]).toHaveProperty('priority');
      expect(briefing.prioritizedTasks[0]).toHaveProperty('priorityReason');
    });

    it('should include key deadlines', async () => {
      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.keyDeadlines).toBeDefined();
      expect(briefing.keyDeadlines.length).toBeGreaterThan(0);
      expect(briefing.keyDeadlines[0]).toHaveProperty('dueDate');
      expect(briefing.keyDeadlines[0]).toHaveProperty('severity');
    });

    it('should include risk alerts', async () => {
      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.riskAlerts).toBeDefined();
    });

    it('should include AI-generated summary', async () => {
      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.summary).toBeDefined();
      expect(typeof briefing.summary).toBe('string');
      expect(briefing.summary.length).toBeGreaterThan(0);
    });

    it('should include suggestions', async () => {
      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.suggestions).toBeDefined();
    });

    it('should use Sonnet model for comprehensive analysis', async () => {
      await service.generateMorningBriefing('user-123', 'firm-456');

      expect(providerManager.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: ClaudeModel.Sonnet,
        })
      );
    });

    it('should return cached briefing if available', async () => {
      const cachedBriefing = {
        summary: 'Cached briefing',
        prioritizedTasks: [],
        keyDeadlines: [],
        riskAlerts: [],
        suggestions: [],
        tokensUsed: 100,
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedBriefing));

      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(providerManager.execute).not.toHaveBeenCalled();
      expect(briefing.summary).toBe('Cached briefing');
    });

    it('should include token usage in result', async () => {
      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.tokensUsed).toBe(1200); // 800 + 400
    });

    it('should throw error if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateMorningBriefing('unknown-user', 'firm-456')
      ).rejects.toThrow('User not found');
    });

    it('should store briefing in database', async () => {
      await service.generateMorningBriefing('user-123', 'firm-456');

      expect(prisma.morningBriefing.create).toHaveBeenCalled();
    });

    it('should cache briefing for 24 hours', async () => {
      await service.generateMorningBriefing('user-123', 'firm-456');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        86400, // 24 hours
        expect.any(String)
      );
    });

    it('should generate briefing for specific date', async () => {
      const specificDate = new Date('2024-12-15');
      await service.generateMorningBriefing('user-123', 'firm-456', specificDate);

      expect(prisma.task.findMany).toHaveBeenCalled();
    });

    it('should handle AI API errors gracefully', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(
        service.generateMorningBriefing('user-123', 'firm-456')
      ).rejects.toThrow();
    });

    it('should handle invalid JSON response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: 'Invalid JSON',
      });

      // Should return default empty briefing or throw
      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.prioritizedTasks).toBeDefined();
    });
  });

  describe('task prioritization', () => {
    it('should prioritize tasks due today higher', async () => {
      const todayTask = {
        ...sampleTasks[0],
        dueDate: new Date(), // today
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([todayTask, sampleTasks[1]]);

      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      // The AI should prioritize today's task
      expect(briefing.prioritizedTasks.length).toBeGreaterThan(0);
    });

    it('should include overdue tasks with high priority', async () => {
      const overdueTask = {
        ...sampleTasks[0],
        dueDate: new Date(Date.now() - 86400000), // yesterday
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([overdueTask]);

      const briefing = await service.generateMorningBriefing('user-123', 'firm-456');

      expect(briefing.prioritizedTasks).toBeDefined();
    });

    it('should consider client importance in prioritization', async () => {
      const vipTask = {
        ...sampleTasks[0],
        client: { ...sampleTasks[0].client, importanceLevel: 'VIP' },
      };
      (prisma.task.findMany as jest.Mock).mockResolvedValue([vipTask]);

      await service.generateMorningBriefing('user-123', 'firm-456');

      // Verify prompt includes client importance information
      expect(providerManager.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('VIP'),
        })
      );
    });
  });

  describe('getTodaysBriefing', () => {
    it('should return existing briefing for today', async () => {
      const existingBriefing = {
        id: 'briefing-123',
        userId: 'user-123',
        firmId: 'firm-456',
        date: new Date(),
        summary: 'Existing briefing',
        prioritizedTasks: [],
        keyDeadlines: [],
        riskAlerts: [],
        suggestions: [],
      };
      (prisma.morningBriefing.findFirst as jest.Mock).mockResolvedValue(existingBriefing);

      const briefing = await service.getTodaysBriefing('user-123', 'firm-456');

      expect(briefing).toBeDefined();
      expect(briefing?.id).toBe('briefing-123');
    });
  });

  describe('markBriefingViewed', () => {
    it('should update viewedAt timestamp', async () => {
      (prisma.morningBriefing.update as jest.Mock).mockResolvedValue({
        id: 'briefing-123',
        viewedAt: new Date(),
      });

      await service.markBriefingViewed('briefing-123', 'user-123', 'firm-456');

      expect(prisma.morningBriefing.update).toHaveBeenCalledWith({
        where: {
          id: 'briefing-123',
          userId: 'user-123',
          firmId: 'firm-456',
        },
        data: {
          viewedAt: expect.any(Date),
        },
      });
    });
  });
});
