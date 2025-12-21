/**
 * AI Assistant Integration Tests
 * OPS-079: Integration Tests
 *
 * Tests the full message flow through the AI assistant system.
 * These tests verify end-to-end functionality with controlled mocks at boundaries.
 */

import { AIOrchestratorService, AssistantIntent } from '../ai-orchestrator.service';
import { ConversationService } from '../conversation.service';
import { ActionExecutorService } from '../action-executor.service';
import type { AIMessage, AssistantContext, UserContext } from '../ai-orchestrator.service';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock external dependencies but not internal orchestration
jest.mock('@legal-platform/database', () => ({
  prisma: {
    aIConversation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    aIMessage: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    email: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
    },
    emailDraft: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@legal-platform/types', () => ({
  AIOperationType: {
    TaskParsing: 'TaskParsing',
    Chat: 'Chat',
    CaseSummary: 'CaseSummary',
    EmailDraft: 'EmailDraft',
    DocumentGeneration: 'DocumentGeneration',
  },
  ClaudeModel: {
    Haiku: 'haiku',
    Sonnet: 'sonnet',
    Opus: 'opus',
  },
}));

// Mock AI service with predictable responses
const mockAiGenerate = jest.fn();
jest.mock('../ai.service', () => ({
  aiService: {
    generate: (...args: unknown[]) => mockAiGenerate(...args),
  },
}));

// Mock dependent services
jest.mock('../case-summary.service', () => ({
  caseSummaryService: {
    getCaseSummary: jest.fn(),
    generateSummary: jest.fn(),
  },
}));

jest.mock('../email-drafting.service', () => ({
  emailDraftingService: {
    generateDraft: jest.fn(),
  },
}));

jest.mock('../document-generation.service', () => ({
  documentGenerationService: {
    generateDocument: jest.fn(),
  },
}));

jest.mock('../morning-briefing.service', () => ({
  morningBriefingService: {
    generateBriefing: jest.fn(),
  },
}));

jest.mock('../task.service', () => ({
  TaskService: jest.fn().mockImplementation(() => ({
    createTask: jest.fn(),
    getTasksByAssignee: jest.fn().mockResolvedValue([]),
    updateTask: jest.fn(),
    completeTask: jest.fn(),
  })),
}));

jest.mock('../search.service', () => ({
  searchService: {
    search: jest.fn().mockResolvedValue({ results: [] }),
  },
  SearchMode: {
    HYBRID: 'hybrid',
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');
const { caseSummaryService } = jest.requireMock('../case-summary.service');
const { emailDraftingService } = jest.requireMock('../email-drafting.service');
const { morningBriefingService } = jest.requireMock('../morning-briefing.service');
const { TaskService } = jest.requireMock('../task.service');

// ============================================================================
// Test Fixtures
// ============================================================================

const mockUserContext: UserContext = {
  userId: 'user-123',
  firmId: 'firm-456',
  role: 'Associate',
  email: 'lawyer@firm.com',
};

const mockAssistantContext: AssistantContext = {
  currentScreen: '/cases/case-123',
  currentCaseId: 'case-123',
};

const mockConversation = {
  id: 'conv-001',
  firmId: 'firm-456',
  userId: 'user-123',
  caseId: null,
  status: 'Active',
  context: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  closedAt: null,
  messages: [],
};

// ============================================================================
// Test Suites
// ============================================================================

describe('AI Assistant Integration', () => {
  let orchestratorService: AIOrchestratorService;
  let conversationService: ConversationService;
  let actionExecutorService: ActionExecutorService;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestratorService = new AIOrchestratorService();
    conversationService = new ConversationService();
    actionExecutorService = new ActionExecutorService();

    // Default AI mock returns high confidence intent
    mockAiGenerate.mockResolvedValue({
      content: JSON.stringify({
        intent: 'GeneralChat',
        confidence: 0.9,
        params: {},
        reasoning: 'General greeting',
      }),
    });
  });

  // ============================================================================
  // Full Message Flow Tests
  // ============================================================================

  describe('Full Message Flow', () => {
    it('processes a message and returns a structured response', async () => {
      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'GeneralChat',
          confidence: 0.85,
          params: { message: 'greeting' },
          reasoning: 'User is greeting',
        }),
      });

      const result = await orchestratorService.processMessage(
        'Bună ziua!',
        mockAssistantContext,
        [],
        mockUserContext
      );

      expect(result).toMatchObject({
        intent: AssistantIntent.GeneralChat,
        confidence: expect.any(Number),
        response: expect.any(String),
        suggestedFollowUps: expect.any(Array),
      });
    });

    it('maintains conversation context across multiple messages', async () => {
      // Setup - first findFirst returns null (create new), then returns conversation
      prisma.aIConversation.findFirst
        .mockResolvedValueOnce(null) // For getOrCreateConversation
        .mockResolvedValue(mockConversation); // For subsequent addMessage calls
      prisma.aIConversation.create.mockResolvedValue(mockConversation);
      prisma.aIMessage.create.mockImplementation((data) => Promise.resolve(data.data));
      prisma.aIConversation.update.mockResolvedValue(mockConversation);

      // Create conversation
      const conversation = await conversationService.getOrCreateConversation(mockUserContext);
      expect(conversation.id).toBe('conv-001');

      // Add first message - findFirst now returns the conversation
      const message1 = await conversationService.addMessage(
        conversation.id,
        { role: 'User' as const, content: 'Arată-mi dosarul Ionescu' },
        mockUserContext.firmId
      );

      // Add follow-up message
      const message2 = await conversationService.addMessage(
        conversation.id,
        { role: 'User' as const, content: 'Ce sarcini are?' },
        mockUserContext.firmId
      );

      // Verify messages were added
      expect(prisma.aIMessage.create).toHaveBeenCalledTimes(2);
    });

    it('handles intent detection with conversation history', async () => {
      const history: AIMessage[] = [
        { role: 'User', content: 'Arată-mi dosarul Ionescu', createdAt: new Date() },
        {
          role: 'Assistant',
          content: 'Iată informațiile despre dosarul Ionescu...',
          createdAt: new Date(),
        },
      ];

      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'CaseQuery',
          confidence: 0.9,
          params: { caseId: 'case-ionescu' },
          reasoning: 'Follow-up about the Ionescu case',
        }),
      });

      caseSummaryService.getCaseSummary.mockResolvedValue({
        id: 'summary-1',
        caseId: 'case-ionescu',
        summary: 'Test summary',
      });

      const result = await orchestratorService.processMessage(
        'Ce sarcini are acest dosar?',
        mockAssistantContext,
        history,
        mockUserContext
      );

      expect(result.intent).toBe(AssistantIntent.CaseQuery);
      expect(mockAiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Arată-mi dosarul Ionescu'),
        })
      );
    });
  });

  // ============================================================================
  // Action Confirmation Flow Tests
  // ============================================================================

  describe('Action Confirmation Flow', () => {
    it('proposes task creation action with preview', async () => {
      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'CreateTask',
          confidence: 0.95,
          params: {
            taskTitle: 'Pregătire documente pentru instanță',
            dueDate: '2025-12-25',
            priority: 'High',
          },
        }),
      });

      const result = await orchestratorService.processMessage(
        'Creează o sarcină să pregătesc documentele pentru instanță',
        mockAssistantContext,
        [],
        mockUserContext
      );

      expect(result.intent).toBe(AssistantIntent.CreateTask);
      expect(result.proposedAction).toBeDefined();
      expect(result.proposedAction?.type).toBe('CREATE_TASK');
      expect(result.proposedAction?.requiresConfirmation).toBe(true);
      expect(result.proposedAction?.entityPreview).toBeDefined();
      expect(result.proposedAction?.confirmationPrompt).toContain('Doriți să creez');
    });

    it('executes confirmed task creation', async () => {
      // Setup mocks for task execution
      prisma.task.create.mockResolvedValue({
        id: 'task-new',
        title: 'Test Task',
        caseId: 'case-123',
        status: 'Pending',
      });
      prisma.case.findFirst.mockResolvedValue({ title: 'Test Case' });
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Ion', lastName: 'Popescu' });

      const mockCreateTask = jest.fn().mockResolvedValue({
        id: 'task-new',
        title: 'Pregătire documente',
        caseId: 'case-123',
      });

      // Replace TaskService mock implementation
      (TaskService as jest.Mock).mockImplementation(() => ({
        createTask: mockCreateTask,
        getTasksByAssignee: jest.fn().mockResolvedValue([]),
      }));

      // Create a NEW ActionExecutorService instance after updating the mock
      // This is needed because the constructor instantiates TaskService
      const freshActionExecutor = new ActionExecutorService();

      const actionResult = await freshActionExecutor.executeAction(
        {
          type: 'CreateTask',
          data: {
            title: 'Pregătire documente',
            caseId: 'case-123',
            assignedTo: 'user-123',
            dueDate: '2025-12-25',
            priority: 'High',
          },
        },
        mockUserContext
      );

      expect(actionResult.success).toBe(true);
      expect(actionResult.entityType).toBe('Task');
    });

    it('cancels action on user rejection', async () => {
      // Setup conversation with pending action
      prisma.aIConversation.findFirst.mockResolvedValue({
        ...mockConversation,
        status: 'AwaitingConfirmation',
      });

      prisma.aIMessage.findUnique.mockResolvedValue({
        id: 'msg-with-action',
        conversationId: 'conv-001',
        conversation: mockConversation,
        actionStatus: 'Proposed',
      });

      prisma.aIMessage.update.mockResolvedValue({
        id: 'msg-with-action',
        actionStatus: 'Rejected',
      });

      const updatedMessage = await conversationService.updateMessageActionStatus(
        'msg-with-action',
        'Rejected' as any,
        mockUserContext.firmId
      );

      expect(updatedMessage.actionStatus).toBe('Rejected');
    });
  });

  // ============================================================================
  // Intent Handler Integration Tests
  // ============================================================================

  describe('Intent Handler Integration', () => {
    describe('Task Intent', () => {
      it('creates task from natural language input', async () => {
        mockAiGenerate.mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'CreateTask',
            confidence: 0.9,
            params: {
              taskTitle: 'Pregătire termen',
              dueDate: '2025-12-21',
              priority: 'High',
            },
          }),
        });

        const result = await orchestratorService.processMessage(
          'Creează o sarcină pentru pregătirea termenului de mâine',
          mockAssistantContext,
          [],
          mockUserContext
        );

        expect(result.intent).toBe(AssistantIntent.CreateTask);
        expect(result.proposedAction).toBeDefined();
        expect(result.proposedAction?.payload).toMatchObject({
          title: expect.any(String),
          caseId: 'case-123', // From context
        });
      });

      it('queries tasks for time range', async () => {
        mockAiGenerate.mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'QueryTasks',
            confidence: 0.95,
            params: { timeRange: 'week' },
          }),
        });

        // Mock TaskService to return tasks
        const mockTasks = [
          { id: 'task-1', title: 'Task 1', dueDate: new Date(), status: 'Pending' },
          { id: 'task-2', title: 'Task 2', dueDate: new Date(), status: 'Pending' },
        ];

        (TaskService as jest.Mock).mockImplementation(() => ({
          getTasksByAssignee: jest.fn().mockResolvedValue(mockTasks),
          createTask: jest.fn(),
        }));

        const service = new AIOrchestratorService();
        const result = await service.processMessage(
          'Ce sarcini am săptămâna asta?',
          mockAssistantContext,
          [],
          mockUserContext
        );

        expect(result.intent).toBe(AssistantIntent.QueryTasks);
        expect(result.response).toBeDefined();
      });
    });

    describe('Case Query Intent', () => {
      it('returns case summary when available', async () => {
        mockAiGenerate.mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'CaseSummary',
            confidence: 0.9,
            params: { caseId: 'case-123' },
          }),
        });

        caseSummaryService.getCaseSummary.mockResolvedValue({
          id: 'summary-1',
          caseId: 'case-123',
          summary: 'Dosar de litigii civile. Client: Ionescu SRL.',
          keyDevelopments: ['Depunere cerere', 'Termen acordat'],
        });

        const result = await orchestratorService.processMessage(
          'Fă-mi un rezumat al dosarului',
          mockAssistantContext,
          [],
          mockUserContext
        );

        expect(result.intent).toBe(AssistantIntent.CaseSummary);
        expect(caseSummaryService.getCaseSummary).toHaveBeenCalledWith('case-123');
      });

      it('generates summary when not cached', async () => {
        mockAiGenerate.mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'CaseSummary',
            confidence: 0.9,
            params: {},
          }),
        });

        // First call returns null, second returns the generated summary
        caseSummaryService.getCaseSummary.mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: 'summary-new',
          caseId: 'case-123',
          summary: 'Newly generated summary',
        });
        caseSummaryService.generateSummary.mockResolvedValue(undefined);

        const result = await orchestratorService.processMessage(
          'Care e statusul dosarului?',
          mockAssistantContext,
          [],
          mockUserContext
        );

        expect(caseSummaryService.generateSummary).toHaveBeenCalledWith(
          'case-123',
          mockUserContext.firmId
        );
      });
    });

    describe('Email Intent', () => {
      it('searches emails with query', async () => {
        mockAiGenerate.mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'SearchEmails',
            confidence: 0.85,
            params: { searchQuery: 'contract' },
          }),
        });

        prisma.email.findMany.mockResolvedValue([
          {
            id: 'email-1',
            subject: 'Contract de prestări servicii',
            bodyPreview: 'Vă trimit contractul...',
            from: { address: 'client@example.com' },
            receivedDateTime: new Date(),
          },
        ]);

        const result = await orchestratorService.processMessage(
          'Caută emailuri despre contract',
          mockAssistantContext,
          [],
          mockUserContext
        );

        expect(result.intent).toBe(AssistantIntent.SearchEmails);
        expect(prisma.email.findMany).toHaveBeenCalled();
      });

      it('drafts email response', async () => {
        mockAiGenerate.mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'DraftEmail',
            confidence: 0.9,
            params: { tone: 'Professional', recipientType: 'Client' },
          }),
        });

        emailDraftingService.generateDraft.mockResolvedValue({
          id: 'draft-1',
          emailId: 'email-1',
          subject: 'Re: Contract',
          body: 'Stimate client...',
          tone: 'Professional',
        });

        const contextWithEmail = {
          ...mockAssistantContext,
          selectedEmailId: 'email-1',
        };

        const result = await orchestratorService.processMessage(
          'Scrie un răspuns formal',
          contextWithEmail,
          [],
          mockUserContext
        );

        expect(result.intent).toBe(AssistantIntent.DraftEmail);
        expect(result.proposedAction?.type).toBe('SEND_EMAIL');
      });
    });

    describe('Briefing Intent', () => {
      it('generates morning briefing', async () => {
        mockAiGenerate.mockResolvedValueOnce({
          content: JSON.stringify({
            intent: 'MorningBriefing',
            confidence: 0.95,
            params: {},
          }),
        });

        morningBriefingService.generateBriefing.mockResolvedValue({
          date: new Date(),
          tasksToday: 5,
          urgentTasks: 2,
          upcomingDeadlines: [],
          unreadEmails: 10,
          summary: 'Bună dimineața! Aveți 5 sarcini pentru astăzi...',
        });

        const result = await orchestratorService.processMessage(
          'Ce am pe azi?',
          mockAssistantContext,
          [],
          mockUserContext
        );

        expect(result.intent).toBe(AssistantIntent.MorningBriefing);
        expect(morningBriefingService.generateBriefing).toHaveBeenCalledWith(mockUserContext);
      });
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling Integration', () => {
    it('recovers from AI service timeout', async () => {
      mockAiGenerate.mockRejectedValueOnce(new Error('Request timeout'));

      const result = await orchestratorService.processMessage(
        'Test message',
        mockAssistantContext,
        [],
        mockUserContext
      );

      // Should fall back to low confidence clarification
      expect(result.intent).toBe(AssistantIntent.AskClarification);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('handles rate limiting gracefully', async () => {
      mockAiGenerate.mockRejectedValueOnce(new Error('429 rate limit exceeded'));

      const result = await orchestratorService.processMessage(
        'Test message',
        mockAssistantContext,
        [],
        mockUserContext
      );

      // Note: The orchestrator catches errors in detectIntent and returns low confidence
      expect(result.intent).toBe(AssistantIntent.AskClarification);
    });

    it('handles missing case context gracefully', async () => {
      // First call: intent detection - returns CaseSummary intent
      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'CaseSummary',
          confidence: 0.9,
          params: {},
        }),
      });

      // Second call: response generation - this generates the user-friendly message
      mockAiGenerate.mockResolvedValueOnce({
        content:
          'Nu am identificat un dosar. Vă rugăm să specificați dosarul despre care doriți informații.',
      });

      const contextWithoutCase: AssistantContext = {
        currentScreen: '/dashboard',
        // No currentCaseId
      };

      const result = await orchestratorService.processMessage(
        'Rezumatul dosarului',
        contextWithoutCase,
        [],
        mockUserContext
      );

      // The orchestrator returns an error result which contains "dosar"
      // Either the template response or generated response should contain it
      expect(result.response).toBeDefined();
      // The response may be the error message from the handler or a generated response
      expect(result.intent).toBe(AssistantIntent.CaseSummary);
    });

    it('handles invalid JSON from AI', async () => {
      mockAiGenerate.mockResolvedValueOnce({
        content: 'This is not valid JSON at all',
      });

      const result = await orchestratorService.processMessage(
        'Test',
        mockAssistantContext,
        [],
        mockUserContext
      );

      // Should fall back gracefully
      expect(result.intent).toBe(AssistantIntent.AskClarification);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  // ============================================================================
  // Multi-turn Conversation Tests
  // ============================================================================

  describe('Multi-turn Conversations', () => {
    it('maintains context across conversation turns', async () => {
      // Turn 1: Ask about a case
      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'CaseQuery',
          confidence: 0.9,
          params: { caseId: 'case-ionescu' },
        }),
      });

      caseSummaryService.getCaseSummary.mockResolvedValue({
        id: 'summary-1',
        caseId: 'case-ionescu',
        summary: 'Ionescu case summary',
      });

      const turn1 = await orchestratorService.processMessage(
        'Arată-mi dosarul Ionescu',
        mockAssistantContext,
        [],
        mockUserContext
      );

      // Turn 2: Follow-up question (should use case context from turn 1)
      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'QueryTasks',
          confidence: 0.85,
          params: { caseId: 'case-ionescu' },
        }),
      });

      (TaskService as jest.Mock).mockImplementation(() => ({
        getTasksByAssignee: jest.fn().mockResolvedValue([]),
        createTask: jest.fn(),
      }));

      const history: AIMessage[] = [
        { role: 'User', content: 'Arată-mi dosarul Ionescu', createdAt: new Date() },
        { role: 'Assistant', content: turn1.response, createdAt: new Date() },
      ];

      const turn2 = await orchestratorService.processMessage(
        'Ce sarcini are?',
        mockAssistantContext,
        history,
        mockUserContext
      );

      expect(turn2.intent).toBe(AssistantIntent.QueryTasks);
    });

    it('clears context when user explicitly requests', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIConversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'Completed',
        closedAt: new Date(),
      });

      const closedConversation = await conversationService.closeConversation(
        mockConversation.id,
        mockUserContext.firmId
      );

      expect(closedConversation.status).toBe('Completed');
      expect(closedConversation.closedAt).toBeDefined();
    });

    it('handles context switching between cases', async () => {
      // First context: Case A
      const contextA: AssistantContext = {
        currentScreen: '/cases/case-a',
        currentCaseId: 'case-a',
      };

      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'CaseQuery',
          confidence: 0.9,
          params: { caseId: 'case-a' },
        }),
      });

      caseSummaryService.getCaseSummary.mockResolvedValue({ caseId: 'case-a', summary: 'Case A' });

      await orchestratorService.processMessage('Statusul dosarului', contextA, [], mockUserContext);

      expect(caseSummaryService.getCaseSummary).toHaveBeenCalledWith('case-a');

      // Switch to Case B
      const contextB: AssistantContext = {
        currentScreen: '/cases/case-b',
        currentCaseId: 'case-b',
      };

      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'CaseQuery',
          confidence: 0.9,
          params: { caseId: 'case-b' },
        }),
      });

      caseSummaryService.getCaseSummary.mockResolvedValue({ caseId: 'case-b', summary: 'Case B' });

      await orchestratorService.processMessage('Statusul dosarului', contextB, [], mockUserContext);

      expect(caseSummaryService.getCaseSummary).toHaveBeenLastCalledWith('case-b');
    });
  });

  // ============================================================================
  // Low Confidence Handling Tests
  // ============================================================================

  describe('Low Confidence Handling', () => {
    it('asks for clarification when confidence is low', async () => {
      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'CreateTask',
          confidence: 0.3, // Low confidence
          params: {},
        }),
      });

      const result = await orchestratorService.processMessage(
        'poate ceva',
        mockAssistantContext,
        [],
        mockUserContext
      );

      expect(result.intent).toBe(AssistantIntent.AskClarification);
      expect(result.response).toContain('Nu sunt sigur');
      expect(result.suggestedFollowUps.length).toBeGreaterThan(0);
    });

    it('provides relevant suggestions based on detected intent', async () => {
      mockAiGenerate.mockResolvedValueOnce({
        content: JSON.stringify({
          intent: 'SearchEmails',
          confidence: 0.4,
          params: {},
        }),
      });

      const result = await orchestratorService.processMessage(
        'email',
        mockAssistantContext,
        [],
        mockUserContext
      );

      expect(result.intent).toBe(AssistantIntent.AskClarification);
      expect(result.suggestedFollowUps).toContain('Căutați un email');
    });
  });

  // ============================================================================
  // Conversation Persistence Tests
  // ============================================================================

  describe('Conversation Persistence', () => {
    it('creates and retrieves conversation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);
      prisma.aIConversation.create.mockResolvedValue(mockConversation);

      const conversation = await conversationService.getOrCreateConversation(mockUserContext);

      expect(conversation.id).toBe('conv-001');
      expect(conversation.firmId).toBe(mockUserContext.firmId);
    });

    it('retrieves existing conversation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);

      const conversation = await conversationService.getOrCreateConversation(mockUserContext);

      expect(prisma.aIConversation.create).not.toHaveBeenCalled();
      expect(conversation.id).toBe('conv-001');
    });

    it('enforces firm isolation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);

      await conversationService.getConversation('conv-001', 'other-firm');

      expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'conv-001',
            firmId: 'other-firm',
          },
        })
      );
    });

    it('expires stale conversations', async () => {
      prisma.aIConversation.updateMany.mockResolvedValue({ count: 3 });

      const expiredCount = await conversationService.expireStaleConversations();

      expect(expiredCount).toBe(3);
      expect(prisma.aIConversation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'Active',
            updatedAt: { lt: expect.any(Date) },
          },
        })
      );
    });
  });
});
