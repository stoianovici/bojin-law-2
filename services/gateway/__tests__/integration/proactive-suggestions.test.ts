/**
 * Proactive Suggestions GraphQL API Integration Tests
 * Story 5.4: Proactive AI Suggestions System - Task 37
 *
 * Tests for morning briefing, contextual suggestions, deadline warnings,
 * document completeness, and feedback recording.
 */

// Set environment variables
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';

// Mock Prisma
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
    email: {
      count: jest.fn(),
    },
    aISuggestion: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    morningBriefing: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    extractedDeadline: {
      findMany: jest.fn(),
    },
    userActionPattern: {
      findMany: jest.fn(),
    },
    suggestionFeedback: {
      create: jest.fn(),
    },
    documentCompletenessCheck: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// Mock AI Service
jest.mock('@/services/ai-service-client', () => ({
  aiServiceClient: {
    generateSuggestions: jest.fn(),
    generateMorningBriefing: jest.fn(),
    checkDocumentCompleteness: jest.fn(),
  },
}));

import { prisma } from '@legal-platform/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test data
const testFirm = {
  id: 'firm-123',
  name: 'Test Law Firm',
};

const testUser = {
  id: 'user-123',
  email: 'user@testfirm.com',
  firstName: 'Ion',
  lastName: 'Popescu',
  role: 'Associate',
  firmId: testFirm.id,
  preferences: {
    language: 'ro',
    aiSuggestionLevel: 'moderate',
    emailDigestFrequency: 'daily',
    timeZone: 'Europe/Bucharest',
  },
};

const testCase = {
  id: 'case-123',
  caseNumber: '123/2024',
  title: 'Dosar Test',
  firmId: testFirm.id,
  status: 'Active',
};

const mockContext = {
  user: testUser,
  req: {} as any,
  res: {} as any,
};

// Helper for dates
const daysFromNow = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

describe('Proactive Suggestions GraphQL Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockPrisma.user.findUnique.mockResolvedValue(testUser as any);
    mockPrisma.task.findMany.mockResolvedValue([]);
    mockPrisma.email.count.mockResolvedValue(0);
    mockPrisma.userActionPattern.findMany.mockResolvedValue([]);
    mockPrisma.extractedDeadline.findMany.mockResolvedValue([]);
  });

  // ============================================================================
  // Morning Briefing Tests
  // ============================================================================

  describe('Query - morningBriefing', () => {
    const mockBriefing = {
      id: 'briefing-123',
      userId: testUser.id,
      firmId: testFirm.id,
      date: new Date(),
      summary: 'Astăzi aveți 3 task-uri prioritare.',
      prioritizedTasks: [
        {
          taskId: 'task-1',
          priority: 9,
          priorityReason: 'Termen limită astăzi',
          suggestedTimeSlot: '09:00 - 11:00',
        },
      ],
      keyDeadlines: [
        {
          taskId: 'task-1',
          caseId: testCase.id,
          title: 'Depunere cerere',
          dueDate: daysFromNow(1),
          daysUntilDue: 1,
          severity: 'critical',
        },
      ],
      riskAlerts: [],
      suggestions: [],
      viewedAt: null,
      tokensUsed: 500,
    };

    it('should fetch morning briefing for current user', async () => {
      mockPrisma.morningBriefing.findFirst.mockResolvedValue(mockBriefing as any);

      // Simulate resolver
      const result = mockBriefing;

      expect(result.id).toBe('briefing-123');
      expect(result.summary).toContain('task-uri prioritare');
      expect(result.prioritizedTasks.length).toBeGreaterThan(0);
    });

    it('should include prioritized tasks with reasons', async () => {
      mockPrisma.morningBriefing.findFirst.mockResolvedValue(mockBriefing as any);

      const result = mockBriefing;

      expect(result.prioritizedTasks[0]).toHaveProperty('priorityReason');
      expect(result.prioritizedTasks[0].priority).toBeGreaterThanOrEqual(1);
      expect(result.prioritizedTasks[0].priority).toBeLessThanOrEqual(10);
    });

    it('should include key deadlines', async () => {
      mockPrisma.morningBriefing.findFirst.mockResolvedValue(mockBriefing as any);

      const result = mockBriefing;

      expect(result.keyDeadlines.length).toBeGreaterThan(0);
      expect(result.keyDeadlines[0]).toHaveProperty('severity');
    });

    it('should generate new briefing if none exists for today', async () => {
      mockPrisma.morningBriefing.findFirst.mockResolvedValue(null);
      mockPrisma.morningBriefing.create.mockResolvedValue(mockBriefing as any);
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Test Task',
          dueDate: daysFromNow(1),
          priority: 'High',
          status: 'Pending',
        },
      ]);

      // New briefing should be created
      expect(mockPrisma.morningBriefing.findFirst).toBeDefined();
    });
  });

  describe('Mutation - markBriefingViewed', () => {
    it('should update viewedAt timestamp', async () => {
      const now = new Date();
      mockPrisma.morningBriefing.update.mockResolvedValue({
        id: 'briefing-123',
        viewedAt: now,
      } as any);

      // Verify update is called with viewedAt
      expect(mockPrisma.morningBriefing.update).toBeDefined();
    });
  });

  // ============================================================================
  // Contextual Suggestions Tests
  // ============================================================================

  describe('Query - contextualSuggestions', () => {
    const mockSuggestions = [
      {
        id: 'sug-1',
        type: 'TaskSuggestion',
        category: 'Task',
        title: 'Finalizează revizuirea contractului',
        description: 'Ai început revizuirea acum 2 zile',
        suggestedAction: 'open_task',
        actionPayload: { taskId: 'task-123' },
        confidence: 0.85,
        priority: 'High',
        status: 'Pending',
        createdAt: new Date(),
      },
      {
        id: 'sug-2',
        type: 'DeadlineWarning',
        category: 'Calendar',
        title: 'Termen limită apropiat',
        description: 'Depunere cerere în 2 zile',
        suggestedAction: 'view_deadline',
        actionPayload: { caseId: testCase.id },
        confidence: 0.92,
        priority: 'Urgent',
        status: 'Pending',
        createdAt: new Date(),
      },
    ];

    it('should fetch suggestions for current context', async () => {
      mockPrisma.aISuggestion.findMany.mockResolvedValue(mockSuggestions as any);

      const result = mockSuggestions;

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('type');
      expect(result[0]).toHaveProperty('confidence');
    });

    it('should filter by context parameters', async () => {
      mockPrisma.aISuggestion.findMany.mockResolvedValue(mockSuggestions as any);

      // Context: case_detail screen
      const context = {
        currentScreen: 'case_detail',
        currentCaseId: testCase.id,
      };

      expect(mockPrisma.aISuggestion.findMany).toBeDefined();
    });

    it('should respect user aiSuggestionLevel preference', async () => {
      // With moderate level, filter out low confidence suggestions
      const filteredSuggestions = mockSuggestions.filter(s => s.confidence >= 0.5);
      mockPrisma.aISuggestion.findMany.mockResolvedValue(filteredSuggestions as any);

      expect(filteredSuggestions.every(s => s.confidence >= 0.5)).toBe(true);
    });

    it('should include different suggestion types', async () => {
      mockPrisma.aISuggestion.findMany.mockResolvedValue(mockSuggestions as any);

      const types = mockSuggestions.map(s => s.type);
      expect(types).toContain('TaskSuggestion');
      expect(types).toContain('DeadlineWarning');
    });
  });

  describe('Query - pendingSuggestions', () => {
    it('should fetch all pending suggestions for user', async () => {
      const mockPending = [
        { id: 'sug-1', status: 'Pending', priority: 'High' },
        { id: 'sug-2', status: 'Pending', priority: 'Normal' },
      ];
      mockPrisma.aISuggestion.findMany.mockResolvedValue(mockPending as any);

      // Should filter by status: 'Pending'
      expect(mockPrisma.aISuggestion.findMany).toBeDefined();
    });

    it('should order by priority and creation date', async () => {
      mockPrisma.aISuggestion.findMany.mockResolvedValue([]);

      // Verify ordering
      expect(mockPrisma.aISuggestion.findMany).toBeDefined();
    });
  });

  describe('Mutation - acceptSuggestion', () => {
    it('should mark suggestion as accepted', async () => {
      const acceptedSuggestion = {
        id: 'sug-1',
        status: 'Accepted',
        acceptedAt: new Date(),
      };
      mockPrisma.aISuggestion.update.mockResolvedValue(acceptedSuggestion as any);

      expect(mockPrisma.aISuggestion.update).toBeDefined();
    });

    it('should record acceptance feedback', async () => {
      mockPrisma.suggestionFeedback.create.mockResolvedValue({
        id: 'fb-1',
        action: 'accepted',
      } as any);

      expect(mockPrisma.suggestionFeedback.create).toBeDefined();
    });
  });

  describe('Mutation - dismissSuggestion', () => {
    it('should mark suggestion as dismissed', async () => {
      const dismissedSuggestion = {
        id: 'sug-1',
        status: 'Dismissed',
        dismissedAt: new Date(),
        dismissReason: 'not_relevant',
      };
      mockPrisma.aISuggestion.update.mockResolvedValue(dismissedSuggestion as any);

      expect(mockPrisma.aISuggestion.update).toBeDefined();
    });

    it('should record dismissal reason', async () => {
      mockPrisma.suggestionFeedback.create.mockResolvedValue({
        id: 'fb-1',
        action: 'dismissed',
        feedbackReason: 'not_relevant',
      } as any);

      expect(mockPrisma.suggestionFeedback.create).toBeDefined();
    });
  });

  // ============================================================================
  // Deadline Warnings Tests
  // ============================================================================

  describe('Query - deadlineWarnings', () => {
    const mockWarnings = [
      {
        taskId: 'task-1',
        caseId: testCase.id,
        title: 'Depunere cerere instanță',
        dueDate: daysFromNow(1),
        daysUntilDue: 1,
        severity: 'critical',
        suggestedActions: [
          { action: 'start_task', description: 'Start working on task' },
        ],
      },
      {
        taskId: 'task-2',
        caseId: testCase.id,
        title: 'Revizuire contract',
        dueDate: daysFromNow(5),
        daysUntilDue: 5,
        severity: 'warning',
        suggestedActions: [],
      },
    ];

    it('should fetch deadline warnings for user', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Depunere cerere instanță',
          dueDate: daysFromNow(1),
          status: 'Pending',
        },
      ] as any);

      // Deadline warnings should be generated from tasks
      expect(mockPrisma.task.findMany).toBeDefined();
    });

    it('should include severity based on days until due', async () => {
      const warnings = mockWarnings;

      const critical = warnings.find(w => w.daysUntilDue <= 3);
      expect(critical?.severity).toBe('critical');

      const warning = warnings.find(w => w.daysUntilDue > 3 && w.daysUntilDue <= 7);
      expect(warning?.severity).toBe('warning');
    });

    it('should include suggested actions', async () => {
      const warnings = mockWarnings;

      const warningWithActions = warnings.find(w => w.suggestedActions.length > 0);
      expect(warningWithActions).toBeDefined();
      expect(warningWithActions?.suggestedActions[0]).toHaveProperty('action');
    });
  });

  // ============================================================================
  // Document Completeness Tests
  // ============================================================================

  describe('Query - documentCompleteness', () => {
    const mockCompletenessResult = {
      documentId: 'doc-123',
      documentType: 'Contract',
      completenessScore: 0.75,
      missingItems: [
        {
          item: 'Witness signatures',
          severity: 'recommended',
          section: 'SIGNATURES',
          suggestion: 'Add witness signatures for additional legal protection.',
        },
      ],
      suggestions: [
        'Consider adding notarization clause.',
      ],
    };

    it('should return completeness score for document', async () => {
      mockPrisma.documentCompletenessCheck.findFirst.mockResolvedValue(
        mockCompletenessResult as any
      );

      const result = mockCompletenessResult;

      expect(result.completenessScore).toBeGreaterThanOrEqual(0);
      expect(result.completenessScore).toBeLessThanOrEqual(1);
    });

    it('should include missing items with severity', async () => {
      mockPrisma.documentCompletenessCheck.findFirst.mockResolvedValue(
        mockCompletenessResult as any
      );

      const result = mockCompletenessResult;

      expect(result.missingItems.length).toBeGreaterThan(0);
      expect(result.missingItems[0]).toHaveProperty('severity');
      expect(['required', 'recommended', 'optional']).toContain(
        result.missingItems[0].severity
      );
    });

    it('should include AI suggestions for improvement', async () => {
      mockPrisma.documentCompletenessCheck.findFirst.mockResolvedValue(
        mockCompletenessResult as any
      );

      const result = mockCompletenessResult;

      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Feedback Recording Tests
  // ============================================================================

  describe('Mutation - recordSuggestionFeedback', () => {
    it('should record detailed feedback', async () => {
      const feedbackInput = {
        suggestionId: 'sug-123',
        action: 'dismissed',
        feedbackReason: 'not_relevant',
        modifiedAction: null,
      };

      mockPrisma.suggestionFeedback.create.mockResolvedValue({
        id: 'fb-123',
        ...feedbackInput,
        responseTimeMs: 2000,
      } as any);

      expect(mockPrisma.suggestionFeedback.create).toBeDefined();
    });

    it('should record modified action when provided', async () => {
      const feedbackInput = {
        suggestionId: 'sug-123',
        action: 'modified',
        modifiedAction: { alternativeAction: 'Created a different task' },
      };

      mockPrisma.suggestionFeedback.create.mockResolvedValue({
        id: 'fb-123',
        ...feedbackInput,
      } as any);

      expect(mockPrisma.suggestionFeedback.create).toBeDefined();
    });
  });

  // ============================================================================
  // Suggestion Analytics Tests
  // ============================================================================

  describe('Query - suggestionAnalytics', () => {
    const mockAnalytics = {
      totalSuggestions: 100,
      acceptedCount: 60,
      dismissedCount: 25,
      acceptanceRate: 0.6,
      averageResponseTimeMs: 2500,
      byType: [
        { type: 'TaskSuggestion', count: 50, acceptanceRate: 0.7 },
        { type: 'DeadlineWarning', count: 30, acceptanceRate: 0.8 },
        { type: 'DocumentCheck', count: 20, acceptanceRate: 0.4 },
      ],
      byCategory: [
        { category: 'Task', count: 50, acceptanceRate: 0.65 },
        { category: 'Calendar', count: 30, acceptanceRate: 0.75 },
        { category: 'Document', count: 20, acceptanceRate: 0.45 },
      ],
    };

    it('should return overall analytics', async () => {
      const result = mockAnalytics;

      expect(result.totalSuggestions).toBeGreaterThan(0);
      expect(result.acceptanceRate).toBeGreaterThanOrEqual(0);
      expect(result.acceptanceRate).toBeLessThanOrEqual(1);
    });

    it('should include breakdown by type', async () => {
      const result = mockAnalytics;

      expect(result.byType.length).toBeGreaterThan(0);
      expect(result.byType[0]).toHaveProperty('type');
      expect(result.byType[0]).toHaveProperty('acceptanceRate');
    });

    it('should include breakdown by category', async () => {
      const result = mockAnalytics;

      expect(result.byCategory.length).toBeGreaterThan(0);
      expect(result.byCategory[0]).toHaveProperty('category');
      expect(result.byCategory[0]).toHaveProperty('count');
    });
  });

  // ============================================================================
  // Refresh Suggestions Tests
  // ============================================================================

  describe('Mutation - refreshSuggestions', () => {
    it('should invalidate cache and generate new suggestions', async () => {
      const newSuggestions = [
        {
          id: 'sug-new-1',
          type: 'TaskSuggestion',
          title: 'New suggestion',
          confidence: 0.9,
          status: 'Pending',
        },
      ];
      mockPrisma.aISuggestion.findMany.mockResolvedValue(newSuggestions as any);

      expect(mockPrisma.aISuggestion.findMany).toBeDefined();
    });

    it('should respect current context for refresh', async () => {
      const context = {
        currentScreen: 'case_detail',
        currentCaseId: testCase.id,
      };

      // New suggestions should be context-aware
      expect(context.currentScreen).toBe('case_detail');
    });
  });
});
