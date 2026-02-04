/**
 * Firm Operations Tools Handlers Tests
 *
 * Tests the 6 tool handlers for the Firm Operations agent.
 * Handlers return formatted markdown strings for LLM consumption.
 */

import { FirmOperationsToolContext } from './firm-operations.types';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
    },
    email: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    threadSummary: {
      findMany: jest.fn(),
    },
    document: {
      count: jest.fn(),
    },
    caseComprehension: {
      count: jest.fn(),
    },
  },
  Prisma: {
    DbNull: Symbol('DbNull'),
  },
}));

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

jest.mock('../utils/logger', () => mockLogger);

import { prisma } from '@legal-platform/database';
import {
  handleReadActiveCasesSummary,
  handleReadDeadlinesOverview,
  handleReadTeamWorkload,
  handleReadClientPortfolio,
  handleReadEmailStatus,
  handleReadPlatformMetrics,
  createFirmOperationsToolHandlers,
} from './firm-operations-tools.handlers';

// ============================================================================
// Test Context
// ============================================================================

const partnerContext: FirmOperationsToolContext = {
  firmId: 'firm-123',
  userId: 'user-partner',
  userRole: 'Partner',
  isPartner: true,
  correlationId: 'corr-123',
};

const associateContext: FirmOperationsToolContext = {
  firmId: 'firm-123',
  userId: 'user-associate',
  userRole: 'Associate',
  isPartner: false,
  correlationId: 'corr-456',
};

// ============================================================================
// handleReadActiveCasesSummary
// ============================================================================

describe('handleReadActiveCasesSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockCases = [
    {
      id: 'case-1',
      caseNumber: 'C-001/2026',
      title: 'Test Case 1',
      status: 'Active',
      client: { name: 'Client A' },
      teamMembers: [{ user: { firstName: 'Ion', lastName: 'Popescu' } }],
      tasks: [{ dueDate: new Date('2026-02-10') }],
      comprehension: { isStale: false },
      healthScores: [{ score: 75 }],
    },
    {
      id: 'case-2',
      caseNumber: 'C-002/2026',
      title: 'Test Case 2',
      status: 'Active',
      client: { name: 'Client B' },
      teamMembers: [{ user: { firstName: 'Maria', lastName: 'Ionescu' } }],
      tasks: [],
      comprehension: { isStale: true },
      healthScores: [{ score: 40 }],
    },
  ];

  it('should return all firm cases for partners', async () => {
    (prisma.case.count as jest.Mock).mockResolvedValueOnce(10);
    (prisma.case.findMany as jest.Mock).mockResolvedValueOnce(mockCases);

    const result = await handleReadActiveCasesSummary({}, partnerContext);

    expect(result).toContain('Rezumat Dosare Active');
    expect(result).toContain('Total dosare active:** 10');
    expect(result).toContain('C-001/2026');
    expect(result).toContain('C-002/2026');

    // Partner query should NOT filter by team membership
    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          firmId: 'firm-123',
          status: 'Active',
        }),
      })
    );
    expect(prisma.case.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamMembers: expect.anything(),
        }),
      })
    );
  });

  it('should filter cases by team membership for non-partners', async () => {
    (prisma.case.count as jest.Mock).mockResolvedValueOnce(5);
    (prisma.case.findMany as jest.Mock).mockResolvedValueOnce([mockCases[0]]);

    const result = await handleReadActiveCasesSummary({}, associateContext);

    expect(result).toContain('Total dosare active:** 5');

    // Associate query SHOULD filter by team membership
    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          firmId: 'firm-123',
          status: 'Active',
          teamMembers: { some: { userId: 'user-associate' } },
        }),
      })
    );
  });

  it('should include risk alerts for low health scores', async () => {
    (prisma.case.count as jest.Mock).mockResolvedValueOnce(2);
    (prisma.case.findMany as jest.Mock).mockResolvedValueOnce(mockCases);

    const result = await handleReadActiveCasesSummary({ includeRiskAlerts: true }, partnerContext);

    expect(result).toContain('Alerte de Risc');
    expect(result).toContain('C-002/2026'); // Low health score case
    expect(result).toContain('Scor sănătate 40%');
  });

  it('should include stale comprehension alerts', async () => {
    (prisma.case.count as jest.Mock).mockResolvedValueOnce(2);
    (prisma.case.findMany as jest.Mock).mockResolvedValueOnce(mockCases);

    const result = await handleReadActiveCasesSummary({}, partnerContext);

    expect(result).toContain('Comprehensiunea dosarului este învechită');
  });

  it('should respect limit parameter', async () => {
    (prisma.case.count as jest.Mock).mockResolvedValueOnce(100);
    (prisma.case.findMany as jest.Mock).mockResolvedValueOnce([]);

    await handleReadActiveCasesSummary({ limit: 5 }, partnerContext);

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
      })
    );
  });

  it('should cap limit at 50', async () => {
    (prisma.case.count as jest.Mock).mockResolvedValueOnce(100);
    (prisma.case.findMany as jest.Mock).mockResolvedValueOnce([]);

    await handleReadActiveCasesSummary({ limit: 100 }, partnerContext);

    expect(prisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it('should return gracefully when no cases exist', async () => {
    (prisma.case.count as jest.Mock).mockResolvedValueOnce(0);
    (prisma.case.findMany as jest.Mock).mockResolvedValueOnce([]);

    const result = await handleReadActiveCasesSummary({}, partnerContext);

    expect(result).toContain('Total dosare active:** 0');
  });
});

// ============================================================================
// handleReadDeadlinesOverview
// ============================================================================

describe('handleReadDeadlinesOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 5);

  const mockTasks = [
    {
      id: 'task-1',
      title: 'Depunere întâmpinare',
      type: 'Filing',
      dueDate: today,
      dueTime: '10:00',
      priority: 'Urgent',
      status: 'Pending',
      assignedTo: 'user-1',
      case: { id: 'case-1', caseNumber: 'C-001/2026' },
    },
    {
      id: 'task-2',
      title: 'Termen judecată',
      type: 'Hearing',
      dueDate: nextWeek,
      dueTime: null,
      priority: 'High',
      status: 'Pending',
      assignedTo: 'user-2',
      case: { id: 'case-2', caseNumber: 'C-002/2026' },
    },
  ];

  const mockUsers = [
    { id: 'user-1', firstName: 'Ion', lastName: 'Popescu' },
    { id: 'user-2', firstName: 'Maria', lastName: 'Ionescu' },
  ];

  it('should group deadlines by time period', async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValueOnce(mockTasks);
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce(mockUsers);

    const result = await handleReadDeadlinesOverview({}, partnerContext);

    expect(result).toContain('Termene Viitoare');
    expect(result).toContain('Astăzi');
    expect(result).toContain('C-001/2026');
  });

  it('should identify deadline conflicts', async () => {
    const conflictingTasks = [
      { ...mockTasks[0], dueDate: today },
      { ...mockTasks[1], dueDate: today, case: { id: 'case-3', caseNumber: 'C-003/2026' } },
    ];
    (prisma.task.findMany as jest.Mock).mockResolvedValueOnce(conflictingTasks);
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce(mockUsers);

    const result = await handleReadDeadlinesOverview({ includeConflicts: true }, partnerContext);

    expect(result).toContain('Conflicte de termene');
    expect(result).toContain('2 termene');
  });

  it('should filter by case assignment for non-partners', async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([]);

    await handleReadDeadlinesOverview({}, associateContext);

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          case: expect.objectContaining({
            teamMembers: { some: { userId: 'user-associate' } },
          }),
        }),
      })
    );
  });
});

// ============================================================================
// handleReadTeamWorkload
// ============================================================================

describe('handleReadTeamWorkload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTeamMembers = [
    { id: 'user-1', firstName: 'Ion', lastName: 'Popescu', role: 'Associate' },
    { id: 'user-2', firstName: 'Maria', lastName: 'Ionescu', role: 'Partner' },
  ];

  it('should return team workload for partners', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce(mockTeamMembers);
    (prisma.task.count as jest.Mock)
      .mockResolvedValueOnce(8) // user-1 active
      .mockResolvedValueOnce(2) // user-1 overdue
      .mockResolvedValueOnce(3) // user-1 upcoming
      .mockResolvedValueOnce(5) // user-2 active
      .mockResolvedValueOnce(0) // user-2 overdue
      .mockResolvedValueOnce(2); // user-2 upcoming

    const result = await handleReadTeamWorkload({}, partnerContext);

    expect(result).toContain('Încărcare Echipă');
    expect(result).toContain('Ion Popescu');
    expect(result).toContain('Maria Ionescu');
    expect(result).toContain('Sarcini active');
  });

  it('should identify overloaded team members', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockTeamMembers[0]]);
    (prisma.task.count as jest.Mock)
      .mockResolvedValueOnce(20) // active - overloaded
      .mockResolvedValueOnce(5) // overdue
      .mockResolvedValueOnce(8); // upcoming

    const result = await handleReadTeamWorkload({}, partnerContext);

    expect(result).toContain('Suprasarcină');
    expect(result).toContain('🔴');
  });

  it('should only show own workload for non-partners', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([mockTeamMembers[0]]);
    (prisma.task.count as jest.Mock)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    await handleReadTeamWorkload({}, associateContext);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'user-associate',
        }),
      })
    );
  });
});

// ============================================================================
// handleReadClientPortfolio
// ============================================================================

describe('handleReadClientPortfolio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const thirtyOneDaysAgo = new Date();
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

  const mockClients = [
    {
      id: 'client-1',
      name: 'Active Client',
      updatedAt: new Date(),
      _count: { cases: 3 },
      cases: [{ id: 'case-1', value: 10000, updatedAt: new Date() }],
    },
    {
      id: 'client-2',
      name: 'Inactive Client',
      updatedAt: thirtyOneDaysAgo,
      _count: { cases: 1 },
      cases: [{ id: 'case-2', value: 5000, updatedAt: thirtyOneDaysAgo }],
    },
  ];

  it('should identify clients needing attention', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValueOnce(mockClients);

    const result = await handleReadClientPortfolio({}, partnerContext);

    expect(result).toContain('Portofoliu Clienți');
    expect(result).toContain('Clienți care necesită atenție');
    expect(result).toContain('Inactive Client');
    expect(result).toContain('Fără activitate');
  });

  it('should respect inactiveDaysThreshold parameter', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValueOnce(mockClients);

    const result = await handleReadClientPortfolio({ inactiveDaysThreshold: 60 }, partnerContext);

    // With 60-day threshold, the 31-day inactive client should not be flagged
    expect(result).not.toContain('Clienți care necesită atenție');
  });

  it('should filter by case assignment for non-partners', async () => {
    (prisma.client.findMany as jest.Mock).mockResolvedValueOnce([]);

    await handleReadClientPortfolio({}, associateContext);

    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cases: expect.objectContaining({
            some: expect.objectContaining({
              teamMembers: { some: { userId: 'user-associate' } },
            }),
          }),
        }),
      })
    );
  });
});

// ============================================================================
// handleReadEmailStatus
// ============================================================================

describe('handleReadEmailStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return email status summary', async () => {
    (prisma.email.count as jest.Mock).mockResolvedValueOnce(5); // unread
    (prisma.email.findMany as jest.Mock).mockResolvedValueOnce([]); // sent emails
    (prisma.email.groupBy as jest.Mock).mockResolvedValueOnce([]); // conversations with replies
    (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce([]);

    const result = await handleReadEmailStatus({}, partnerContext);

    expect(result).toContain('Stare Emailuri');
    expect(result).toContain('Necitite:** 5');
  });

  it('should identify emails awaiting response', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    (prisma.email.count as jest.Mock).mockResolvedValueOnce(0);
    (prisma.email.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'email-1',
        conversationId: 'conv-1',
        subject: 'Important Contract',
        sentDateTime: threeDaysAgo,
        caseId: 'case-1',
        case: { caseNumber: 'C-001/2026' },
        user: { firstName: 'Ion', lastName: 'Popescu' },
      },
    ]);
    (prisma.email.groupBy as jest.Mock).mockResolvedValueOnce([]); // No replies
    (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce([]);

    const result = await handleReadEmailStatus({}, partnerContext);

    expect(result).toContain('Așteaptă răspuns');
    expect(result).toContain('Important Contract');
  });
});

// ============================================================================
// handleReadPlatformMetrics
// ============================================================================

describe('handleReadPlatformMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return platform metrics', async () => {
    (prisma.task.count as jest.Mock)
      .mockResolvedValueOnce(25) // completed this week
      .mockResolvedValueOnce(20) // completed last week
      .mockResolvedValueOnce(30) // total active
      .mockResolvedValueOnce(3); // overdue
    (prisma.document.count as jest.Mock).mockResolvedValueOnce(10);
    (prisma.caseComprehension.count as jest.Mock).mockResolvedValueOnce(8);
    (prisma.email.count as jest.Mock).mockResolvedValueOnce(50);

    const result = await handleReadPlatformMetrics({}, partnerContext);

    expect(result).toContain('Metrici Platformă');
    expect(result).toContain('Scor sănătate');
    expect(result).toContain('Rata completare sarcini');
    expect(result).toContain('Sarcini completate:** 25');
  });

  it('should include trends when requested', async () => {
    (prisma.task.count as jest.Mock)
      .mockResolvedValueOnce(30) // completed this week
      .mockResolvedValueOnce(20) // completed last week (50% increase)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(2);
    (prisma.document.count as jest.Mock).mockResolvedValueOnce(5);
    (prisma.caseComprehension.count as jest.Mock).mockResolvedValueOnce(4);
    (prisma.email.count as jest.Mock).mockResolvedValueOnce(30);

    const result = await handleReadPlatformMetrics({ includeTrends: true }, partnerContext);

    expect(result).toContain('Tendințe');
    expect(result).toContain('+50%');
  });

  it('should handle zero values gracefully', async () => {
    (prisma.task.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (prisma.document.count as jest.Mock).mockResolvedValueOnce(0);
    (prisma.caseComprehension.count as jest.Mock).mockResolvedValueOnce(0);
    (prisma.email.count as jest.Mock).mockResolvedValueOnce(0);

    const result = await handleReadPlatformMetrics({}, partnerContext);

    expect(result).toContain('Scor sănătate:** 100%');
    expect(result).toContain('Sarcini completate:** 0');
  });
});

// ============================================================================
// createFirmOperationsToolHandlers
// ============================================================================

describe('createFirmOperationsToolHandlers', () => {
  it('should create handlers for all 6 tools', () => {
    const handlers = createFirmOperationsToolHandlers(partnerContext);

    expect(handlers).toHaveProperty('read_active_cases_summary');
    expect(handlers).toHaveProperty('read_deadlines_overview');
    expect(handlers).toHaveProperty('read_team_workload');
    expect(handlers).toHaveProperty('read_client_portfolio');
    expect(handlers).toHaveProperty('read_email_status');
    expect(handlers).toHaveProperty('read_platform_metrics');
  });

  it('should wrap handlers with error handling', async () => {
    (prisma.case.count as jest.Mock).mockRejectedValueOnce(new Error('DB connection failed'));
    (prisma.case.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB connection failed'));

    const handlers = createFirmOperationsToolHandlers(partnerContext);
    const result = await handlers.read_active_cases_summary({});

    // Should return structured error instead of throwing
    expect(result).toContain('[TOOL_ERROR]');
    expect(result).toContain('code: QUERY_FAILED');
    expect(result).toContain('DB connection failed');
    expect(result).toContain('[/TOOL_ERROR]');
  });
});
