/**
 * Task Parser Integration Tests
 * Story 4.1: Natural Language Task Parser - Task 16
 */

// Set environment variables before imports
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';
process.env.AI_SERVICE_URL = 'http://localhost:3002';

// Mock fetch for AI service calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Prisma
// Note: Task model doesn't exist yet (will be added in Story 2.8)
// confirmTaskCreation tests are skipped until Task model is available
jest.mock('@legal-platform/database', () => {
  const mockPrisma: any = {
    taskParsePattern: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    taskParseHistory: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@legal-platform/database';
import { taskParserResolvers, Context } from '../../src/graphql/resolvers/task-parser.resolvers';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Test data
const testFirm = {
  id: 'firm-test-123',
  name: 'Test Law Firm',
};

const testUser = {
  id: 'user-test-123',
  email: 'user@testfirm.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'Partner' as const,
  firmId: testFirm.id,
};

const testCase = {
  id: 'case-test-123',
  caseNumber: '123/2024',
  title: 'Contract Dispute',
  client: { name: 'ABC Corp' },
  firmId: testFirm.id,
  status: 'Active',
};

const testTeamMember = {
  id: 'team-member-123',
  firstName: 'Ion',
  lastName: 'Popescu',
  role: 'Associate',
  firmId: testFirm.id,
};

const testPattern = {
  id: 'pattern-123',
  firmId: testFirm.id,
  inputPattern: 'pregătește contract pentru {date}',
  taskType: 'DocumentCreation',
  frequency: 5,
  lastUsed: new Date(),
};

const mockParsedResponse = {
  parseId: 'parse-123',
  originalText: 'Pregătește contract pentru client',
  detectedLanguage: 'ro',
  parsedTask: {
    taskType: { value: 'DocumentCreation', confidence: 0.9 },
    title: { value: 'Pregătește contract', confidence: 0.85 },
    description: { value: null, confidence: 0 },
    dueDate: { value: '2024-12-15', confidence: 0.8 },
    dueTime: { value: null, confidence: 0 },
    priority: { value: 'Medium', confidence: 0.7 },
    assigneeName: { value: null, confidence: 0 },
    assigneeId: { value: null, confidence: 0 },
    caseReference: { value: null, confidence: 0 },
    caseId: { value: null, confidence: 0 },
  },
  entities: [],
  overallConfidence: 0.8,
  clarificationsNeeded: [],
  isComplete: true,
};

describe('Task Parser GraphQL Resolvers Integration', () => {
  const authenticatedContext: Context = {
    user: testUser,
  };

  const unauthenticatedContext: Context = {};

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Query: taskPatternSuggestions', () => {
    it('should return pattern suggestions for authenticated user', async () => {
      (mockPrisma.taskParsePattern.findMany as jest.Mock).mockResolvedValue([testPattern]);

      const result = await taskParserResolvers.Query.taskPatternSuggestions(
        {},
        { partialInput: 'pregătește' },
        authenticatedContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].pattern).toContain('[data]');
      expect(result[0].taskType).toBe('DocumentCreation');
      expect(mockPrisma.taskParsePattern.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            firmId: testFirm.id,
            inputPattern: { contains: 'pregătește' },
          },
        })
      );
    });

    it('should return empty array for short input', async () => {
      const result = await taskParserResolvers.Query.taskPatternSuggestions(
        {},
        { partialInput: 'ab' },
        authenticatedContext
      );

      expect(result).toEqual([]);
      expect(mockPrisma.taskParsePattern.findMany).not.toHaveBeenCalled();
    });

    it('should throw for unauthenticated request', async () => {
      await expect(
        taskParserResolvers.Query.taskPatternSuggestions(
          {},
          { partialInput: 'pregătește' },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should return empty array on database error', async () => {
      (mockPrisma.taskParsePattern.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await taskParserResolvers.Query.taskPatternSuggestions(
        {},
        { partialInput: 'pregătește' },
        authenticatedContext
      );

      expect(result).toEqual([]);
    });

    it('should respect firm isolation', async () => {
      (mockPrisma.taskParsePattern.findMany as jest.Mock).mockResolvedValue([]);

      await taskParserResolvers.Query.taskPatternSuggestions(
        {},
        { partialInput: 'pregătește' },
        authenticatedContext
      );

      expect(mockPrisma.taskParsePattern.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirm.id,
          }),
        })
      );
    });
  });

  describe('Mutation: parseTask', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockParsedResponse),
      });
    });

    it('should parse task input for authenticated user', async () => {
      const result = await taskParserResolvers.Mutation.parseTask(
        {},
        { input: 'Pregătește contract pentru client' },
        authenticatedContext
      );

      expect(result.parseId).toBe('parse-123');
      expect(result.detectedLanguage).toBe('ro');
      expect(result.parsedTask.taskType.value).toBe('DocumentCreation');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/ai/parse-task',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Pregătește contract'),
        })
      );
    });

    it('should include context in AI service call', async () => {
      await taskParserResolvers.Mutation.parseTask(
        {},
        {
          input: 'Pregătește contract',
          context: {
            activeCaseIds: ['case-1', 'case-2'],
            teamMemberNames: ['Ion Popescu'],
          },
        },
        authenticatedContext
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('activeCaseIds'),
        })
      );
    });

    it('should throw for empty input', async () => {
      await expect(
        taskParserResolvers.Mutation.parseTask({}, { input: '' }, authenticatedContext)
      ).rejects.toThrow('Input text is required');
    });

    it('should throw for input exceeding max length', async () => {
      const longInput = 'a'.repeat(2001);

      await expect(
        taskParserResolvers.Mutation.parseTask({}, { input: longInput }, authenticatedContext)
      ).rejects.toThrow('exceeds maximum length');
    });

    it('should throw for unauthenticated request', async () => {
      await expect(
        taskParserResolvers.Mutation.parseTask(
          {},
          { input: 'Pregătește contract' },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should handle AI service error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('AI Service Error'),
      });

      await expect(
        taskParserResolvers.Mutation.parseTask(
          {},
          { input: 'Pregătește contract' },
          authenticatedContext
        )
      ).rejects.toThrow('AI service unavailable');
    });
  });

  describe('Mutation: resolveClarification', () => {
    beforeEach(() => {
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue([testCase]);
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([testTeamMember]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockParsedResponse,
            clarificationsNeeded: [],
            isComplete: true,
          }),
      });
    });

    it('should resolve clarification for authenticated user', async () => {
      const result = await taskParserResolvers.Mutation.resolveClarification(
        {},
        {
          parseId: 'parse-123',
          questionId: 'q-123',
          answer: 'case-123',
        },
        authenticatedContext
      );

      expect(result.isComplete).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/ai/parse-task/clarify',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('case-123'),
        })
      );
    });

    it('should include cases and team members in context', async () => {
      await taskParserResolvers.Mutation.resolveClarification(
        {},
        {
          parseId: 'parse-123',
          questionId: 'q-123',
          answer: 'case-123',
        },
        authenticatedContext
      );

      expect(mockPrisma.case.findMany).toHaveBeenCalled();
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });

    it('should throw for empty answer', async () => {
      await expect(
        taskParserResolvers.Mutation.resolveClarification(
          {},
          {
            parseId: 'parse-123',
            questionId: 'q-123',
            answer: '',
          },
          authenticatedContext
        )
      ).rejects.toThrow('Answer is required');
    });

    it('should throw for unauthenticated request', async () => {
      await expect(
        taskParserResolvers.Mutation.resolveClarification(
          {},
          {
            parseId: 'parse-123',
            questionId: 'q-123',
            answer: 'case-123',
          },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });
  });

  // Note: Using stub task implementation until Story 2.8 adds the Task model
  describe('Mutation: confirmTaskCreation', () => {
    const testParseHistory = {
      id: 'parse-123',
      firmId: testFirm.id,
      userId: testUser.id,
      inputText: 'Pregătește contract',
      detectedLanguage: 'ro',
      parsedResult: mockParsedResponse,
      wasAccepted: false,
      userCorrections: null,
      finalTaskId: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      (mockPrisma.taskParseHistory.findFirst as jest.Mock).mockResolvedValue(testParseHistory);
      (mockPrisma.taskParseHistory.update as jest.Mock).mockResolvedValue({
        ...testParseHistory,
        wasAccepted: true,
        finalTaskId: 'stub-task-123',
      });
    });

    it('should create stub task from parsed input', async () => {
      const result = await taskParserResolvers.Mutation.confirmTaskCreation(
        {},
        { parseId: 'parse-123' },
        authenticatedContext
      );

      // Stub tasks have 'stub-task-' prefix
      expect(result.id).toMatch(/^stub-task-/);
      expect(result.title).toBe('Pregătește contract');
      expect(result.status).toBe('Pending');
      expect(mockPrisma.taskParseHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            wasAccepted: true,
          }),
        })
      );
    });

    it('should apply corrections when provided', async () => {
      const result = await taskParserResolvers.Mutation.confirmTaskCreation(
        {},
        {
          parseId: 'parse-123',
          corrections: {
            title: 'Corrected Title',
            priority: 'High',
          },
        },
        authenticatedContext
      );

      expect(result.title).toBe('Corrected Title');
      expect(result.priority).toBe('High');
    });

    it('should verify case access before creation', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(testCase);

      await taskParserResolvers.Mutation.confirmTaskCreation(
        {},
        {
          parseId: 'parse-123',
          corrections: { caseId: 'case-test-123' },
        },
        authenticatedContext
      );

      expect(mockPrisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: 'case-test-123' },
        select: { firmId: true },
      });
    });

    it('should reject access to case from different firm', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        ...testCase,
        firmId: 'different-firm',
      });

      await expect(
        taskParserResolvers.Mutation.confirmTaskCreation(
          {},
          {
            parseId: 'parse-123',
            corrections: { caseId: 'case-test-123' },
          },
          authenticatedContext
        )
      ).rejects.toThrow('Case not found or access denied');
    });

    it('should verify assignee is from same firm', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...testTeamMember,
        firmId: testFirm.id,
      });

      await taskParserResolvers.Mutation.confirmTaskCreation(
        {},
        {
          parseId: 'parse-123',
          corrections: { assigneeId: 'team-member-123' },
        },
        authenticatedContext
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-member-123' },
        select: { firmId: true },
      });
    });

    it('should reject assignee from different firm', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...testTeamMember,
        firmId: 'different-firm',
      });

      await expect(
        taskParserResolvers.Mutation.confirmTaskCreation(
          {},
          {
            parseId: 'parse-123',
            corrections: { assigneeId: 'team-member-123' },
          },
          authenticatedContext
        )
      ).rejects.toThrow('Assignee not found or access denied');
    });

    it('should throw for unauthenticated request', async () => {
      await expect(
        taskParserResolvers.Mutation.confirmTaskCreation(
          {},
          { parseId: 'parse-123' },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Mutation: recordParsedTask', () => {
    const testParseHistory = {
      id: 'parse-123',
      firmId: testFirm.id,
      userId: testUser.id,
      inputText: 'pregătește contract pentru 15 decembrie',
      detectedLanguage: 'ro',
      parsedResult: mockParsedResponse,
      wasAccepted: false,
      userCorrections: null,
      finalTaskId: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      (mockPrisma.taskParseHistory.findFirst as jest.Mock).mockResolvedValue(testParseHistory);
      (mockPrisma.taskParseHistory.update as jest.Mock).mockResolvedValue({
        ...testParseHistory,
        wasAccepted: true,
      });
      (mockPrisma.taskParsePattern.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.taskParsePattern.create as jest.Mock).mockResolvedValue(testPattern);
    });

    it('should record accepted parse result', async () => {
      const result = await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'parse-123',
          wasAccepted: true,
          finalTaskId: 'task-123',
        },
        authenticatedContext
      );

      expect(result).toBe(true);
      expect(mockPrisma.taskParseHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            wasAccepted: true,
            finalTaskId: 'task-123',
          }),
        })
      );
    });

    it('should create pattern when task accepted', async () => {
      await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'parse-123',
          wasAccepted: true,
        },
        authenticatedContext
      );

      expect(mockPrisma.taskParsePattern.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firmId: testFirm.id,
            taskType: 'DocumentCreation',
          }),
        })
      );
    });

    it('should update existing pattern frequency', async () => {
      (mockPrisma.taskParsePattern.findFirst as jest.Mock).mockResolvedValue(testPattern);

      await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'parse-123',
          wasAccepted: true,
        },
        authenticatedContext
      );

      expect(mockPrisma.taskParsePattern.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testPattern.id },
          data: expect.objectContaining({
            frequency: testPattern.frequency + 1,
          }),
        })
      );
    });

    it('should record corrections', async () => {
      await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'parse-123',
          wasAccepted: true,
          corrections: {
            title: 'Corrected Title',
            priority: 'High',
          },
        },
        authenticatedContext
      );

      expect(mockPrisma.taskParseHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userCorrections: {
              title: 'Corrected Title',
              priority: 'High',
            },
          }),
        })
      );
    });

    it('should return true even if parse history not found', async () => {
      (mockPrisma.taskParseHistory.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'unknown-parse',
          wasAccepted: false,
        },
        authenticatedContext
      );

      expect(result).toBe(true);
    });

    it('should throw for unauthenticated request', async () => {
      await expect(
        taskParserResolvers.Mutation.recordParsedTask(
          {},
          {
            parseId: 'parse-123',
            wasAccepted: true,
          },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should respect firm isolation', async () => {
      await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'parse-123',
          wasAccepted: true,
        },
        authenticatedContext
      );

      expect(mockPrisma.taskParseHistory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firmId: testFirm.id,
          }),
        })
      );
    });
  });

  describe('Pattern normalization', () => {
    const testParseHistoryWithDates = {
      id: 'parse-date-123',
      firmId: testFirm.id,
      userId: testUser.id,
      inputText: 'întâlnire pe 15 decembrie la ora 14:00',
      detectedLanguage: 'ro',
      parsedResult: mockParsedResponse,
      wasAccepted: false,
      userCorrections: null,
      finalTaskId: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      (mockPrisma.taskParseHistory.findFirst as jest.Mock).mockResolvedValue(
        testParseHistoryWithDates
      );
      (mockPrisma.taskParseHistory.update as jest.Mock).mockResolvedValue({
        ...testParseHistoryWithDates,
        wasAccepted: true,
      });
      (mockPrisma.taskParsePattern.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.taskParsePattern.create as jest.Mock).mockResolvedValue(testPattern);
    });

    it('should normalize Romanian dates in patterns', async () => {
      await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'parse-date-123',
          wasAccepted: true,
        },
        authenticatedContext
      );

      expect(mockPrisma.taskParsePattern.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inputPattern: expect.stringContaining('{date}'),
          }),
        })
      );
    });

    it('should normalize times in patterns', async () => {
      await taskParserResolvers.Mutation.recordParsedTask(
        {},
        {
          parseId: 'parse-date-123',
          wasAccepted: true,
        },
        authenticatedContext
      );

      expect(mockPrisma.taskParsePattern.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inputPattern: expect.stringContaining('{time}'),
          }),
        })
      );
    });
  });
});
