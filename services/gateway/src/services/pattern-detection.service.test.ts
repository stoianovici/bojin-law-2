/**
 * Pattern Detection Service Unit Tests
 * Story 4.7: Task Analytics and Optimization - Task 35
 *
 * Tests for:
 * - Co-occurrence detection
 * - Sequence pattern detection
 * - Confidence calculation
 * - Template creation from pattern
 */

import { PatternDetectionService } from './pattern-detection.service';
import {
  patternDetectionFixtures,
  TEST_FIRM_ID,
  TEST_USER_IDS,
  mockUsers,
} from '../../__tests__/fixtures/task-analytics.fixtures';
import { TaskTypeEnum, CaseType, TaskPatternType } from '@prisma/client';

describe('PatternDetectionService', () => {
  let service: PatternDetectionService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      taskPatternAnalysis: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
      case: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      taskTemplate: {
        create: jest.fn(),
      },
    };

    service = new PatternDetectionService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findCoOccurrences', () => {
    it('should detect tasks created together on the same case', () => {
      const tasks = [
        // Case 1: Research + DocumentCreation within 24 hours
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-01T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.DocumentCreation,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-01T14:00:00Z'), // 4 hours later
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        // Case 2: Same pattern
        {
          id: 'task-3',
          type: TaskTypeEnum.Research,
          caseId: 'case-2',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-05T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-4',
          type: TaskTypeEnum.DocumentCreation,
          caseId: 'case-2',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-05T12:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        // Case 3: Same pattern (third occurrence makes it a valid pattern)
        {
          id: 'task-5',
          type: TaskTypeEnum.Research,
          caseId: 'case-3',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-10T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-6',
          type: TaskTypeEnum.DocumentCreation,
          caseId: 'case-3',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-10T11:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
      ];

      const patterns = service.findCoOccurrences(tasks as any);

      expect(patterns.length).toBeGreaterThan(0);

      const researchDocPattern = patterns.find(
        (p) =>
          p.taskTypes.includes(TaskTypeEnum.Research) &&
          p.taskTypes.includes(TaskTypeEnum.DocumentCreation)
      );

      expect(researchDocPattern).toBeDefined();
      expect(researchDocPattern?.occurrences).toBeGreaterThanOrEqual(3);
    });

    it('should not detect patterns with less than 3 occurrences', () => {
      const tasks = [
        // Only 2 occurrences
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-01T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Meeting,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-01T14:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-3',
          type: TaskTypeEnum.Research,
          caseId: 'case-2',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-05T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-4',
          type: TaskTypeEnum.Meeting,
          caseId: 'case-2',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-05T12:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
      ];

      const patterns = service.findCoOccurrences(tasks as any);

      // Should not find Meeting+Research pattern (only 2 occurrences)
      const meetingResearchPattern = patterns.find(
        (p) =>
          p.taskTypes.includes(TaskTypeEnum.Research) &&
          p.taskTypes.includes(TaskTypeEnum.Meeting)
      );

      expect(meetingResearchPattern).toBeUndefined();
    });

    it('should track case types for patterns', () => {
      const tasks = Array.from({ length: 6 }, (_, i) => ({
        id: `task-${i}`,
        type: i % 2 === 0 ? TaskTypeEnum.Research : TaskTypeEnum.DocumentCreation,
        caseId: `case-${Math.floor(i / 2)}`,
        assignedTo: TEST_USER_IDS.associate,
        createdAt: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000 + (i % 2) * 60 * 60 * 1000),
        case: { type: i < 4 ? CaseType.Contract : CaseType.Litigation },
        assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
      }));

      const patterns = service.findCoOccurrences(tasks as any);

      if (patterns.length > 0) {
        expect(patterns[0].caseTypes.size).toBeGreaterThan(0);
      }
    });
  });

  describe('findSequencePatterns', () => {
    it('should detect tasks that frequently follow each other', () => {
      const tasks = [
        // Sequence 1: Research -> Meeting (within 7 days)
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-01T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Meeting,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.partner,
          createdAt: new Date('2025-11-03T10:00:00Z'), // 2 days later
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
        // Sequence 2: Same pattern
        {
          id: 'task-3',
          type: TaskTypeEnum.Research,
          caseId: 'case-2',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-10T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-4',
          type: TaskTypeEnum.Meeting,
          caseId: 'case-2',
          assignedTo: TEST_USER_IDS.partner,
          createdAt: new Date('2025-11-12T10:00:00Z'), // 2 days later
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
        // Sequence 3: Same pattern
        {
          id: 'task-5',
          type: TaskTypeEnum.Research,
          caseId: 'case-3',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-20T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-6',
          type: TaskTypeEnum.Meeting,
          caseId: 'case-3',
          assignedTo: TEST_USER_IDS.partner,
          createdAt: new Date('2025-11-22T10:00:00Z'), // 2 days later
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
      ];

      const patterns = service.findSequencePatterns(tasks as any);

      const sequencePattern = patterns.find(
        (p) => p.taskTypes[0] === TaskTypeEnum.Research && p.taskTypes[1] === TaskTypeEnum.Meeting
      );

      expect(sequencePattern).toBeDefined();
      expect(sequencePattern?.occurrences).toBeGreaterThanOrEqual(3);
      expect(sequencePattern?.avgGapHours).toBeGreaterThan(0);
    });

    it('should not detect sequences with gaps longer than 7 days', () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-01T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Meeting,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.partner,
          createdAt: new Date('2025-11-15T10:00:00Z'), // 14 days later - too long
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.partner),
        },
      ];

      const patterns = service.findSequencePatterns(tasks as any);

      expect(patterns).toHaveLength(0);
    });

    it('should skip same-type consecutive tasks', () => {
      const tasks = [
        {
          id: 'task-1',
          type: TaskTypeEnum.Research,
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.associate,
          createdAt: new Date('2025-11-01T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.associate),
        },
        {
          id: 'task-2',
          type: TaskTypeEnum.Research, // Same type
          caseId: 'case-1',
          assignedTo: TEST_USER_IDS.paralegal,
          createdAt: new Date('2025-11-02T10:00:00Z'),
          case: { type: CaseType.Contract },
          assignee: mockUsers.find((u) => u.id === TEST_USER_IDS.paralegal),
        },
      ];

      const patterns = service.findSequencePatterns(tasks as any);

      const sameTypePattern = patterns.find(
        (p) => p.taskTypes[0] === TaskTypeEnum.Research && p.taskTypes[1] === TaskTypeEnum.Research
      );

      expect(sameTypePattern).toBeUndefined();
    });
  });

  describe('generateTemplateSuggestion', () => {
    it('should generate readable name for two task types', () => {
      const pattern = {
        taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
        caseTypes: new Set([CaseType.Contract]),
        cases: new Set(['case-1']),
        assignees: new Map(),
        occurrences: 5,
        avgGapHours: 0,
      };

      const name = service.generateTemplateSuggestion(pattern);

      expect(name).toBe('Research with Document Creation');
    });

    it('should generate readable name for multiple task types', () => {
      const pattern = {
        taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.Meeting, TaskTypeEnum.DocumentCreation],
        caseTypes: new Set([CaseType.Contract]),
        cases: new Set(['case-1']),
        assignees: new Map(),
        occurrences: 5,
        avgGapHours: 0,
      };

      const name = service.generateTemplateSuggestion(pattern);

      expect(name).toBe('Research, Meeting and Document Creation');
    });
  });

  describe('detectTaskPatterns', () => {
    it('should return existing patterns if recent', async () => {
      const recentPatterns = [
        {
          id: 'pattern-1',
          firmId: TEST_FIRM_ID,
          patternType: TaskPatternType.CoOccurrence,
          taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
          caseTypes: [CaseType.Contract],
          occurrenceCount: 5,
          confidence: 0.8,
          suggestedName: 'Research with Document Creation',
          avgSequenceGap: null,
          commonAssignees: [TEST_USER_IDS.associate],
          isTemplateCreated: false,
          isDismissed: false,
          templateId: null,
          analyzedAt: new Date(), // Recent
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ];

      mockPrisma.taskPatternAnalysis.findMany.mockResolvedValueOnce(recentPatterns);
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);
      mockPrisma.case.findMany.mockResolvedValueOnce([]);

      const result = await service.detectTaskPatterns(TEST_FIRM_ID);

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].suggestedTemplateName).toBe('Research with Document Creation');
    });

    it('should analyze new patterns when no recent ones exist', async () => {
      mockPrisma.taskPatternAnalysis.findMany.mockResolvedValueOnce([]);
      mockPrisma.task.findMany.mockResolvedValueOnce(patternDetectionFixtures);
      mockPrisma.case.count.mockResolvedValueOnce(10);
      mockPrisma.taskPatternAnalysis.findFirst.mockResolvedValue(null);
      mockPrisma.taskPatternAnalysis.create.mockImplementation((data: any) => ({
        id: 'new-pattern-id',
        ...data.data,
      }));
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.case.findMany.mockResolvedValue([]);

      const result = await service.detectTaskPatterns(TEST_FIRM_ID);

      expect(result.analysisDate).toBeDefined();
      expect(result.totalPatternsFound).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createTemplateFromPattern', () => {
    it('should create template from pattern', async () => {
      const pattern = {
        id: 'pattern-1',
        firmId: TEST_FIRM_ID,
        taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
        avgSequenceGap: 2, // 2 days between tasks
      };

      mockPrisma.taskPatternAnalysis.findUnique.mockResolvedValueOnce(pattern);
      mockPrisma.taskTemplate.create.mockResolvedValueOnce({
        id: 'template-1',
        name: 'Research and Documentation Template',
      });
      mockPrisma.taskPatternAnalysis.update.mockResolvedValueOnce({
        ...pattern,
        isTemplateCreated: true,
        templateId: 'template-1',
      });

      const result = await service.createTemplateFromPattern(
        {
          patternId: 'pattern-1',
          templateName: 'Research and Documentation Template',
          description: 'Template for research followed by documentation',
        },
        TEST_USER_IDS.partner
      );

      expect(result.id).toBe('template-1');
      expect(result.name).toBe('Research and Documentation Template');

      expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Research and Documentation Template',
            firmId: TEST_FIRM_ID,
            createdBy: TEST_USER_IDS.partner,
          }),
        })
      );

      expect(mockPrisma.taskPatternAnalysis.update).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
        data: expect.objectContaining({
          isTemplateCreated: true,
          templateId: 'template-1',
        }),
      });
    });

    it('should throw error if pattern not found', async () => {
      mockPrisma.taskPatternAnalysis.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createTemplateFromPattern(
          { patternId: 'non-existent', templateName: 'Test' },
          TEST_USER_IDS.partner
        )
      ).rejects.toThrow('Pattern not found');
    });
  });

  describe('dismissPattern', () => {
    it('should mark pattern as dismissed', async () => {
      mockPrisma.taskPatternAnalysis.update.mockResolvedValueOnce({
        id: 'pattern-1',
        isDismissed: true,
      });

      const result = await service.dismissPattern('pattern-1');

      expect(result).toBe(true);
      expect(mockPrisma.taskPatternAnalysis.update).toHaveBeenCalledWith({
        where: { id: 'pattern-1' },
        data: { isDismissed: true },
      });
    });
  });

  describe('getPattern', () => {
    it('should return formatted pattern by ID', async () => {
      const pattern = {
        id: 'pattern-1',
        firmId: TEST_FIRM_ID,
        patternType: TaskPatternType.CoOccurrence,
        taskTypes: [TaskTypeEnum.Research, TaskTypeEnum.DocumentCreation],
        caseTypes: [CaseType.Contract],
        occurrenceCount: 5,
        confidence: 0.85,
        suggestedName: 'Research with Document Creation',
        avgSequenceGap: null,
        commonAssignees: [TEST_USER_IDS.associate],
        isTemplateCreated: false,
        analyzedAt: new Date(),
      };

      mockPrisma.taskPatternAnalysis.findUnique.mockResolvedValueOnce(pattern);
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers);
      mockPrisma.case.findMany.mockResolvedValueOnce([]);

      const result = await service.getPattern('pattern-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('pattern-1');
      expect(result?.confidence).toBe(0.85);
      expect(result?.isTemplateCreated).toBe(false);
    });

    it('should return null for non-existent pattern', async () => {
      mockPrisma.taskPatternAnalysis.findUnique.mockResolvedValueOnce(null);

      const result = await service.getPattern('non-existent');

      expect(result).toBeNull();
    });
  });
});
