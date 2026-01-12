/**
 * Briefing Intent Handler Tests
 * OPS-076: Proactive Briefings Integration
 */

import { BriefingHandler } from './briefing.handler';
import type { AssistantContext, UserContext } from './types';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@legal-platform/database', () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    email: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../morning-briefing.service', () => ({
  morningBriefingService: {
    generateBriefing: jest.fn(),
  },
}));

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

const mockBriefingData = {
  urgentTasks: [
    {
      id: 'task-1',
      title: 'Pregătire termen',
      priority: 'Urgent',
      dueDate: new Date(),
      caseTitle: 'Ionescu vs ABC',
      caseNumber: 'C-2024-001',
      isOverdue: false,
    },
  ],
  todayTasks: [
    {
      id: 'task-2',
      title: 'Revizuire contract',
      priority: 'Medium',
      dueDate: new Date(),
      caseTitle: null,
      caseNumber: null,
      isOverdue: false,
    },
  ],
  upcomingDeadlines: [
    {
      id: 'task-3',
      title: 'Depunere dosar',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      caseTitle: 'Popescu SRL',
      caseNumber: 'C-2024-002',
      daysUntilDue: 2,
    },
  ],
  unreadEmailsCount: 5,
  importantEmails: [],
  generatedAt: new Date(),
  aiSummary: undefined,
};

// ============================================================================
// Tests
// ============================================================================

describe('BriefingHandler', () => {
  let handler: BriefingHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new BriefingHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMorningBriefing', () => {
    it('should return formatted morning briefing', async () => {
      const { morningBriefingService } = require('../morning-briefing.service');
      morningBriefingService.generateBriefing.mockResolvedValue(mockBriefingData);

      const result = await handler.getMorningBriefing(mockUserContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Bună dimineața');
      expect(result.message).toContain('Urgente azi');
      expect(result.message).toContain('Pregătire termen');
      expect(result.message).toContain('De făcut azi');
      expect(result.message).toContain('Termene apropiate');
      expect(result.message).toContain('Emailuri noi');
      expect(result.data).toBeDefined();
    });

    it('should return friendly message when no items', async () => {
      const { morningBriefingService } = require('../morning-briefing.service');
      morningBriefingService.generateBriefing.mockResolvedValue({
        urgentTasks: [],
        todayTasks: [],
        upcomingDeadlines: [],
        unreadEmailsCount: 0,
        importantEmails: [],
        generatedAt: new Date(),
      });

      const result = await handler.getMorningBriefing(mockUserContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu aveți sarcini urgente');
      expect(result.data).toBeUndefined();
    });

    it('should include case titles in urgent tasks', async () => {
      const { morningBriefingService } = require('../morning-briefing.service');
      morningBriefingService.generateBriefing.mockResolvedValue({
        ...mockBriefingData,
        todayTasks: [],
        upcomingDeadlines: [],
        unreadEmailsCount: 0,
      });

      const result = await handler.getMorningBriefing(mockUserContext);

      expect(result.message).toContain('Ionescu vs ABC');
    });

    it('should show deadline days until due', async () => {
      const { morningBriefingService } = require('../morning-briefing.service');
      morningBriefingService.generateBriefing.mockResolvedValue({
        ...mockBriefingData,
        urgentTasks: [],
        todayTasks: [],
        unreadEmailsCount: 0,
      });

      const result = await handler.getMorningBriefing(mockUserContext);

      expect(result.message).toContain('În 2 zile');
    });
  });

  describe('getProactiveAlerts', () => {
    it('should return deadline alerts', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Urgent deadline',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
          case: { title: 'Test Case' },
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      const alerts = await handler.getProactiveAlerts(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      const deadlineAlerts = alerts.filter((a) => a.type === 'deadline');
      expect(deadlineAlerts.length).toBe(1);
      expect(deadlineAlerts[0].content).toContain('Termen apropiat');
      expect(deadlineAlerts[0].urgency).toBe('medium');
    });

    it('should return unanswered email alerts', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([
        {
          id: 'email-1',
          subject: 'Important question',
          from: { name: 'Client', address: 'client@example.com' },
          receivedDateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          conversationId: 'conv-1',
        },
      ]);

      const alerts = await handler.getProactiveAlerts(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      const emailAlerts = alerts.filter((a) => a.type === 'email');
      expect(emailAlerts.length).toBe(1);
      expect(emailAlerts[0].content).toContain('Email fără răspuns');
      expect(emailAlerts[0].content).toContain('Client');
    });

    it('should return case-specific alerts when in case context', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(3); // 3 overdue tasks

      const alerts = await handler.getProactiveAlerts(mockAssistantContext, mockUserContext);

      const caseAlerts = alerts.filter((a) => a.relatedEntityType === 'Case');
      expect(caseAlerts.length).toBe(1);
      expect(caseAlerts[0].content).toContain('sarcini întârziate');
      expect(caseAlerts[0].urgency).toBe('high');
    });

    it('should not include emails sent by user', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      // Email FROM the user (should be filtered out)
      prisma.email.findMany.mockResolvedValue([
        {
          id: 'email-1',
          subject: 'My sent email',
          from: { name: 'Me', address: 'user@firm.com' },
          receivedDateTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          conversationId: 'conv-1',
        },
      ]);

      const alerts = await handler.getProactiveAlerts(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      const emailAlerts = alerts.filter((a) => a.type === 'email');
      expect(emailAlerts.length).toBe(0);
    });
  });

  describe('getProactiveMessages', () => {
    it('should convert alerts to AIMessage format', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Important deadline',
          dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
          case: { title: 'Test Case' },
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      const messages = await handler.getProactiveMessages(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('Assistant');
      expect(messages[0].intent).toBe('QueryTasks');
      expect(messages[0].id).toMatch(/^proactive-/);
      expect(messages[0].createdAt).toBeDefined();
    });

    it('should include action suggestion in proposed action', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Deadline soon',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          case: { title: 'Test' },
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      const messages = await handler.getProactiveMessages(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      expect(messages[0].proposedAction).toBeDefined();
      expect(messages[0].proposedAction?.displayText).toBe('Vezi detalii');
      expect(messages[0].proposedAction?.requiresConfirmation).toBe(false);
    });
  });

  describe('urgency calculation', () => {
    it('should return high urgency for tasks due within 1 day', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Due today',
          dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
          case: { title: 'Test' },
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      const alerts = await handler.getProactiveAlerts(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      expect(alerts[0].urgency).toBe('high');
    });

    it('should return medium urgency for tasks due within 3 days', async () => {
      const { prisma } = require('@legal-platform/database');
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Due in 2 days',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          case: { title: 'Test' },
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      const alerts = await handler.getProactiveAlerts(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      expect(alerts[0].urgency).toBe('medium');
    });
  });

  describe('date formatting', () => {
    it('should format dates in Romanian', async () => {
      const { prisma } = require('@legal-platform/database');
      const specificDate = new Date('2025-12-25');
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Christmas task',
          dueDate: specificDate,
          case: { title: 'Test' },
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({ email: 'user@firm.com' });
      prisma.email.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);

      const alerts = await handler.getProactiveAlerts(
        { currentScreen: '/dashboard' },
        mockUserContext
      );

      // Romanian date format should include day and month
      expect(alerts[0].content).toMatch(/dec\./i);
    });
  });

  describe('handler interface', () => {
    it('should have correct name property', () => {
      expect(handler.name).toBe('BriefingHandler');
    });
  });
});
