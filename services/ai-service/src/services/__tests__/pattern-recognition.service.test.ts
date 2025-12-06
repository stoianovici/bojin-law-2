/**
 * Pattern Recognition Service Tests
 * Story 5.4: Proactive AI Suggestions System - Task 35
 *
 * Tests for user behavior pattern detection and suggestion generation.
 */

import {
  PatternRecognitionService,
  PATTERN_TYPES,
} from '../pattern-recognition.service';
import { providerManager } from '../provider-manager.service';
import { prisma } from '@legal-platform/database';
import { ClaudeModel } from '@legal-platform/types';

// Mock dependencies
jest.mock('../provider-manager.service');
jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: { findMany: jest.fn() },
    email: { findMany: jest.fn() },
    document: { findMany: jest.fn() },
    userActionPattern: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('PatternRecognitionService', () => {
  let service: PatternRecognitionService;

  const sampleTaskHistory = [
    {
      id: 'task-1',
      type: 'CourtFiling',
      title: 'File motion',
      completedAt: new Date('2024-12-01T10:00:00Z'),
      caseId: 'case-1',
    },
    {
      id: 'task-2',
      type: 'ClientUpdate',
      title: 'Send client update',
      completedAt: new Date('2024-12-01T10:30:00Z'),
      caseId: 'case-1',
    },
    {
      id: 'task-3',
      type: 'CourtFiling',
      title: 'File another motion',
      completedAt: new Date('2024-12-08T10:00:00Z'),
      caseId: 'case-2',
    },
    {
      id: 'task-4',
      type: 'ClientUpdate',
      title: 'Send client update 2',
      completedAt: new Date('2024-12-08T10:25:00Z'),
      caseId: 'case-2',
    },
    {
      id: 'task-5',
      type: 'CourtFiling',
      title: 'File third motion',
      completedAt: new Date('2024-12-15T10:00:00Z'),
      caseId: 'case-3',
    },
    {
      id: 'task-6',
      type: 'ClientUpdate',
      title: 'Send client update 3',
      completedAt: new Date('2024-12-15T10:20:00Z'),
      caseId: 'case-3',
    },
  ];

  const sampleEmailHistory = [
    {
      id: 'email-1',
      subject: 'Morning check',
      sentDateTime: new Date('2024-12-01T09:00:00Z'),
    },
    {
      id: 'email-2',
      subject: 'Morning check',
      sentDateTime: new Date('2024-12-02T09:05:00Z'),
    },
    {
      id: 'email-3',
      subject: 'Morning check',
      sentDateTime: new Date('2024-12-03T09:00:00Z'),
    },
  ];

  const sampleAIResponse = {
    content: JSON.stringify({
      patterns: [
        {
          patternType: PATTERN_TYPES.POST_FILING_CLIENT_UPDATE,
          description: 'User sends client update within 30 minutes after filing a motion',
          triggerContext: { taskType: 'CourtFiling' },
          actionSequence: [
            { action: 'complete_filing', delay: 0 },
            { action: 'send_client_update', delay: 1800 },
          ],
          occurrenceCount: 3,
          confidence: 0.85,
          suggestable: true,
        },
        {
          patternType: PATTERN_TYPES.MORNING_EMAIL_CHECK,
          description: 'User checks emails around 9 AM daily',
          triggerContext: { timeOfDay: '09:00' },
          actionSequence: [
            { action: 'open_email_client', delay: 0 },
          ],
          occurrenceCount: 3,
          confidence: 0.75,
          suggestable: false,
        },
      ],
    }),
    model: ClaudeModel.Sonnet,
    inputTokens: 500,
    outputTokens: 300,
    latencyMs: 2000,
  };

  const existingPatterns = [
    {
      id: 'pattern-1',
      userId: 'user-123',
      patternType: PATTERN_TYPES.WEEKLY_STATUS_UPDATE,
      triggerContext: { dayOfWeek: 'Friday' },
      actionSequence: [{ action: 'send_status_email' }],
      occurrenceCount: 5,
      confidence: 0.7,
      isActive: true,
    },
  ];

  beforeEach(() => {
    service = new PatternRecognitionService();
    jest.clearAllMocks();

    // Setup default mock implementations
    (prisma.task.findMany as jest.Mock).mockResolvedValue(sampleTaskHistory);
    (prisma.email.findMany as jest.Mock).mockResolvedValue(sampleEmailHistory);
    (prisma.document.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.userActionPattern.findMany as jest.Mock).mockResolvedValue(existingPatterns);
    (prisma.userActionPattern.create as jest.Mock).mockResolvedValue({ id: 'new-pattern' });
    (prisma.userActionPattern.update as jest.Mock).mockResolvedValue({ id: 'updated-pattern' });

    (providerManager.execute as jest.Mock).mockResolvedValue(sampleAIResponse);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('analyzeUserPatterns', () => {
    it('should detect patterns from user history', async () => {
      const result = await service.analyzeUserPatterns('user-123', 90);

      expect(result.patterns).toBeDefined();
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should identify new patterns not in existing records', async () => {
      const result = await service.analyzeUserPatterns('user-123', 90);

      expect(result.newPatterns).toBeDefined();
      // POST_FILING_CLIENT_UPDATE and MORNING_EMAIL_CHECK are new
      expect(result.newPatterns.length).toBeGreaterThan(0);
    });

    it('should identify updated patterns', async () => {
      // Add existing pattern that matches detected
      (prisma.userActionPattern.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pattern-existing',
          userId: 'user-123',
          patternType: PATTERN_TYPES.POST_FILING_CLIENT_UPDATE,
          triggerContext: { taskType: 'CourtFiling' },
          actionSequence: [],
          occurrenceCount: 2,
          confidence: 0.6,
          isActive: true,
        },
      ]);

      const result = await service.analyzeUserPatterns('user-123', 90);

      expect(result.updatedPatterns).toBeDefined();
    });

    it('should use specified lookback period', async () => {
      await service.analyzeUserPatterns('user-123', 30);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            completedAt: {
              gte: expect.any(Date),
            },
          }),
        })
      );
    });

    it('should require minimum 3 occurrences for pattern detection', async () => {
      // AI returns pattern with only 2 occurrences
      const lowOccurrenceResponse = {
        ...sampleAIResponse,
        content: JSON.stringify({
          patterns: [
            {
              patternType: PATTERN_TYPES.POST_FILING_CLIENT_UPDATE,
              description: 'User sends client update',
              triggerContext: { taskType: 'CourtFiling' },
              actionSequence: [],
              occurrenceCount: 2, // Below minimum
              confidence: 0.9,
              suggestable: true,
            },
          ],
        }),
      };
      (providerManager.execute as jest.Mock).mockResolvedValue(lowOccurrenceResponse);

      const result = await service.analyzeUserPatterns('user-123', 90);

      // Patterns with less than 3 occurrences should be filtered out or marked as not suggestable
      expect(result.patterns.every(p => p.occurrenceCount >= 3 || !p.suggestable)).toBe(true);
    });

    it('should store new patterns in database', async () => {
      await service.analyzeUserPatterns('user-123', 90);

      expect(prisma.userActionPattern.create).toHaveBeenCalled();
    });

    it('should update existing patterns with new data', async () => {
      (prisma.userActionPattern.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pattern-existing',
          userId: 'user-123',
          patternType: PATTERN_TYPES.POST_FILING_CLIENT_UPDATE,
          triggerContext: { taskType: 'CourtFiling' },
          actionSequence: [],
          occurrenceCount: 2,
          confidence: 0.6,
          isActive: true,
        },
      ]);

      await service.analyzeUserPatterns('user-123', 90);

      expect(prisma.userActionPattern.update).toHaveBeenCalled();
    });

    it('should handle AI API errors gracefully', async () => {
      (providerManager.execute as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(service.analyzeUserPatterns('user-123', 90)).rejects.toThrow('API Error');
    });

    it('should handle invalid JSON response', async () => {
      (providerManager.execute as jest.Mock).mockResolvedValue({
        ...sampleAIResponse,
        content: 'Invalid JSON',
      });

      await expect(service.analyzeUserPatterns('user-123', 90)).rejects.toThrow();
    });
  });

  describe('getPatternBasedSuggestions', () => {
    it('should return patterns matching current context', async () => {
      const patterns = await service.getPatternBasedSuggestions('user-123', {
        currentScreen: 'case_detail',
        currentCaseId: 'case-1',
        recentAction: 'completed_filing',
      });

      expect(patterns).toBeDefined();
    });

    it('should filter by minimum confidence threshold (0.6)', async () => {
      (prisma.userActionPattern.findMany as jest.Mock).mockResolvedValue([
        {
          ...existingPatterns[0],
          confidence: 0.5, // Below threshold
        },
      ]);

      const patterns = await service.getPatternBasedSuggestions('user-123', {
        currentScreen: 'dashboard',
      });

      expect(patterns).toHaveLength(0);
    });

    it('should only return active patterns', async () => {
      (prisma.userActionPattern.findMany as jest.Mock).mockResolvedValue([
        {
          ...existingPatterns[0],
          isActive: false,
        },
      ]);

      const patterns = await service.getPatternBasedSuggestions('user-123', {
        currentScreen: 'dashboard',
      });

      expect(patterns).toHaveLength(0);
    });

    it('should order patterns by confidence', async () => {
      (prisma.userActionPattern.findMany as jest.Mock).mockResolvedValue([
        { ...existingPatterns[0], confidence: 0.7 },
        { ...existingPatterns[0], id: 'p2', confidence: 0.9 },
        { ...existingPatterns[0], id: 'p3', confidence: 0.8 },
      ]);

      await service.getPatternBasedSuggestions('user-123', {
        currentScreen: 'dashboard',
      });

      expect(prisma.userActionPattern.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { confidence: 'desc' },
        })
      );
    });
  });

  describe('pattern types', () => {
    it('should detect POST_FILING_CLIENT_UPDATE pattern', async () => {
      const result = await service.analyzeUserPatterns('user-123', 90);

      const filingPattern = result.patterns.find(
        p => p.patternType === PATTERN_TYPES.POST_FILING_CLIENT_UPDATE
      );

      expect(filingPattern).toBeDefined();
      expect(filingPattern?.suggestable).toBe(true);
    });

    it('should detect MORNING_EMAIL_CHECK pattern', async () => {
      const result = await service.analyzeUserPatterns('user-123', 90);

      const emailPattern = result.patterns.find(
        p => p.patternType === PATTERN_TYPES.MORNING_EMAIL_CHECK
      );

      expect(emailPattern).toBeDefined();
    });

    it('should categorize patterns as suggestable or not', async () => {
      const result = await service.analyzeUserPatterns('user-123', 90);

      // POST_FILING_CLIENT_UPDATE should be suggestable (actionable)
      // MORNING_EMAIL_CHECK should not be suggestable (just informational)
      const filingPattern = result.patterns.find(
        p => p.patternType === PATTERN_TYPES.POST_FILING_CLIENT_UPDATE
      );
      const emailPattern = result.patterns.find(
        p => p.patternType === PATTERN_TYPES.MORNING_EMAIL_CHECK
      );

      expect(filingPattern?.suggestable).toBe(true);
      expect(emailPattern?.suggestable).toBe(false);
    });
  });

  describe('context matching', () => {
    it('should match time-based triggers', async () => {
      const morningContext = {
        currentScreen: 'dashboard',
        timeOfDay: '09:00',
      };

      await service.getPatternBasedSuggestions('user-123', morningContext);

      expect(prisma.userActionPattern.findMany).toHaveBeenCalled();
    });

    it('should match task type triggers', async () => {
      const taskContext = {
        currentScreen: 'case_detail',
        recentAction: 'completed_filing',
        taskType: 'CourtFiling',
      };

      await service.getPatternBasedSuggestions('user-123', taskContext);

      expect(prisma.userActionPattern.findMany).toHaveBeenCalled();
    });
  });
});
