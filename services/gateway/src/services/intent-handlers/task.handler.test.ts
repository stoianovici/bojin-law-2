/**
 * Task Intent Handler Tests
 * OPS-072: Task & Calendar Intent Handler
 */

import { TaskIntentHandler } from './task.handler';
import type { AssistantContext, UserContext } from './types';
import { TaskStatus } from '@prisma/client';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockGetTasksByAssignee = jest.fn();

jest.mock('../task.service', () => ({
  TaskService: jest.fn().mockImplementation(() => ({
    createTask: jest.fn().mockResolvedValue({
      id: 'task-123',
      title: 'Test Task',
      dueDate: new Date('2025-12-21'),
      priority: 'Medium',
      status: 'Pending',
      caseId: 'case-123',
    }),
    getTasksByAssignee: mockGetTasksByAssignee,
  })),
}));

jest.mock('../natural-language-command.service', () => ({
  NaturalLanguageCommandService: jest.fn().mockImplementation(() => ({
    processCommand: jest.fn().mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      intent: 'CREATE_TASK',
      confidence: 0.9,
      message: 'Sarcină creată',
      extractedParams: {
        title: 'Pregătire documente pentru termen',
        dueDate: new Date('2025-12-21'),
        priority: 'High',
        taskType: 'DocumentCreation',
      },
    }),
  })),
  CommandIntent: {
    CREATE_TASK: 'CREATE_TASK',
    ADD_DOCUMENT: 'ADD_DOCUMENT',
    SCHEDULE_DEADLINE: 'SCHEDULE_DEADLINE',
    EMAIL_CLIENT: 'EMAIL_CLIENT',
    LOG_TIME: 'LOG_TIME',
    UNKNOWN: 'UNKNOWN',
  },
}));

jest.mock('../calendar-suggestion.service', () => ({
  createCalendarSuggestionService: jest.fn().mockReturnValue({
    suggestFromDeadline: jest.fn(),
    createCalendarEvent: jest.fn(),
  }),
}));

const { prisma } = jest.requireMock('@legal-platform/database');

// ============================================================================
// Test Fixtures
// ============================================================================

const mockUserContext: UserContext = {
  userId: 'user-123',
  firmId: 'firm-123',
  role: 'associate',
  email: 'user@firm.com',
};

const mockAssistantContext: AssistantContext = {
  currentScreen: '/cases/case-123',
  currentCaseId: 'case-123',
};

// ============================================================================
// Tests
// ============================================================================

describe('TaskIntentHandler', () => {
  let handler: TaskIntentHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new TaskIntentHandler();

    // Set up default mock returns
    prisma.case.findUnique.mockResolvedValue({
      id: 'case-123',
      title: 'Ionescu vs. ABC SRL',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      firstName: 'Ion',
      lastName: 'Popescu',
    });
    mockGetTasksByAssignee.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Pregătire dosar Ionescu',
        dueDate: new Date(),
        priority: 'High',
        status: TaskStatus.Pending,
        caseId: 'case-1',
      },
      {
        id: 'task-2',
        title: 'Revizuire contract',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority: 'Medium',
        status: TaskStatus.Pending,
        caseId: 'case-2',
      },
    ]);
  });

  describe('handleCreateTask', () => {
    it('should parse raw text and return proposed action', async () => {
      const result = await handler.handleCreateTask(
        { rawText: 'Creează o sarcină pentru mâine să pregătesc documentele' },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.proposedAction).toBeDefined();
      expect(result.proposedAction?.type).toBe('CreateTask');
      expect(result.proposedAction?.requiresConfirmation).toBe(true);
      expect(result.proposedAction?.entityPreview).toBeDefined();
    });

    it('should fail when no case context is available', async () => {
      const result = await handler.handleCreateTask(
        { rawText: 'Creează o sarcină' },
        { currentScreen: '/dashboard' }, // No currentCaseId
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('dosar');
    });

    it('should handle direct params without raw text', async () => {
      const result = await handler.handleCreateTask(
        {
          title: 'Test Task',
          dueDate: '2025-12-21',
          priority: 'High',
          caseId: 'case-123',
        },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.proposedAction?.type).toBe('CreateTask');
      expect(result.proposedAction?.payload).toMatchObject({
        title: 'Test Task',
        priority: 'High',
        caseId: 'case-123',
      });
    });

    it('should use case ID from context when not in params', async () => {
      const result = await handler.handleCreateTask(
        { title: 'Test Task' },
        { currentCaseId: 'case-456' },
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.proposedAction?.payload).toMatchObject({
        caseId: 'case-456',
      });
    });
  });

  describe('handleQueryTasks', () => {
    it('should return tasks for the week', async () => {
      const result = await handler.handleQueryTasks({ timeRange: 'week' }, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as { count: number }).count).toBe(2);
      expect(result.message).toContain('sarcini');
    });

    it('should return empty message when no tasks', async () => {
      mockGetTasksByAssignee.mockResolvedValue([]);

      const result = await handler.handleQueryTasks({ timeRange: 'today' }, mockUserContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu ai sarcini');
    });

    it('should filter by status', async () => {
      const result = await handler.handleQueryTasks(
        { timeRange: 'week', status: 'pending' },
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle overdue filter', async () => {
      mockGetTasksByAssignee.mockResolvedValue([
        {
          id: 'task-overdue',
          title: 'Overdue Task',
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          priority: 'High',
          status: TaskStatus.Pending,
          caseId: 'case-1',
        },
      ]);

      const result = await handler.handleQueryTasks({ status: 'overdue' }, mockUserContext);

      expect(result.success).toBe(true);
      expect((result.data as { count: number }).count).toBe(1);
    });
  });

  describe('handleScheduleEvent', () => {
    it('should return proposed calendar event', async () => {
      const result = await handler.handleScheduleEvent(
        {
          eventTitle: 'Întâlnire cu clientul',
          eventDate: '2025-12-21',
          eventTime: '10:00',
        },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.proposedAction).toBeDefined();
      expect(result.proposedAction?.type).toBe('ScheduleEvent');
      expect(result.proposedAction?.requiresConfirmation).toBe(true);
      expect(result.proposedAction?.payload).toMatchObject({
        title: 'Întâlnire cu clientul',
        isAllDay: false,
      });
    });

    it('should handle all-day events when no time specified', async () => {
      const result = await handler.handleScheduleEvent(
        {
          eventTitle: 'Termen instanță',
          eventDate: '2025-12-21',
          // No eventTime
        },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.proposedAction?.payload).toMatchObject({
        isAllDay: true,
      });
    });

    it('should fail when title is missing', async () => {
      const result = await handler.handleScheduleEvent(
        {
          eventDate: '2025-12-21',
        },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('titlul');
    });

    it('should fail when date is missing', async () => {
      const result = await handler.handleScheduleEvent(
        {
          eventTitle: 'Întâlnire',
        },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('data');
    });
  });

  describe('formatDate helper', () => {
    it('should format today as "Astăzi"', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);

      mockGetTasksByAssignee.mockResolvedValue([
        {
          id: 'task-today',
          title: 'Today Task',
          dueDate: today,
          priority: 'Medium',
          status: TaskStatus.Pending,
          caseId: 'case-1',
        },
      ]);

      const result = await handler.handleQueryTasks({ timeRange: 'today' }, mockUserContext);

      expect(result.message).toContain('Astăzi');
    });
  });

  describe('priority translation', () => {
    it('should translate priorities to Romanian', async () => {
      const result = await handler.handleCreateTask(
        {
          title: 'Urgent Task',
          priority: 'High',
          caseId: 'case-123',
        },
        mockAssistantContext,
        mockUserContext
      );

      expect(result.proposedAction?.entityPreview).toMatchObject({
        prioritate: 'Înaltă',
      });
    });
  });
});
