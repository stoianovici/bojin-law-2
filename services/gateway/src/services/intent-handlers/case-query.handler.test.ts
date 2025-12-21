/**
 * Case Query Handler Unit Tests
 * OPS-073: Case Query Intent Handler
 *
 * Tests for case information queries: status, deadlines, summaries, actors, documents.
 */

import { CaseQueryHandler } from './case-query.handler';
import type { AssistantContext, UserContext } from './types';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
    caseSummary: {
      findUnique: jest.fn(),
    },
    caseDocument: {
      findMany: jest.fn(),
    },
  },
}));

// Mock CaseSummaryService
jest.mock('../case-summary.service', () => ({
  caseSummaryService: {
    generateSummary: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');
const { caseSummaryService } = jest.requireMock('../case-summary.service');

describe('CaseQueryHandler', () => {
  let handler: CaseQueryHandler;

  const mockFirmId = 'firm-123';
  const mockUserId = 'user-456';
  const mockCaseId = 'case-789';

  const mockUserContext: UserContext = {
    userId: mockUserId,
    firmId: mockFirmId,
  };

  const mockAssistantContext: AssistantContext = {
    currentCaseId: mockCaseId,
  };

  const mockCase = {
    id: mockCaseId,
    title: 'Ionescu vs. ABC SRL',
    caseNumber: '2024-1234',
    status: 'Active',
    firmId: mockFirmId,
    client: {
      name: 'Ion Ionescu',
      contactInfo: { email: 'ion@example.com', phone: '0721123456' },
    },
    actors: [{ name: 'ABC SRL', role: 'Defendant', email: 'abc@example.com', phone: '0721123456' }],
    teamMembers: [
      {
        role: 'Lead',
        user: { firstName: 'Maria', lastName: 'Popescu', email: 'maria@firm.com' },
      },
    ],
    tasks: [
      { id: 'task-1', title: 'Pregătire acte', dueDate: new Date('2025-01-15'), priority: 'High' },
      {
        id: 'task-2',
        title: 'Depunere cerere',
        dueDate: new Date('2025-01-20'),
        priority: 'Medium',
      },
    ],
  };

  const mockSummary = {
    id: 'summary-1',
    caseId: mockCaseId,
    executiveSummary: 'Dosar în curs de soluționare.',
    currentStatus: 'Așteptăm răspunsul instanței.',
    keyDevelopments: ['Depusă cerere de chemare în judecată', 'Programat primul termen'],
    openIssues: ['Obținere probatorii suplimentare'],
    isStale: false,
    case: { firmId: mockFirmId },
  };

  const mockDocuments = [
    {
      document: {
        id: 'doc-1',
        fileName: 'cerere.pdf',
        fileType: 'application/pdf',
        createdAt: new Date('2025-01-10'),
      },
    },
    {
      document: {
        id: 'doc-2',
        fileName: 'dovada.pdf',
        fileType: 'application/pdf',
        createdAt: new Date('2025-01-05'),
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new CaseQueryHandler();
  });

  // ============================================================================
  // handle() - Case Resolution Tests
  // ============================================================================

  describe('handle() - Case Resolution', () => {
    it('should use params.caseId when provided', async () => {
      prisma.case.findUnique.mockResolvedValue(mockCase);

      await handler.handle(
        { queryType: 'status', caseId: 'explicit-case-id' },
        {},
        mockUserContext
      );

      expect(prisma.case.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'explicit-case-id', firmId: mockFirmId },
        })
      );
    });

    it('should use context.currentCaseId when params.caseId not provided', async () => {
      prisma.case.findUnique.mockResolvedValue(mockCase);

      await handler.handle({ queryType: 'status' }, mockAssistantContext, mockUserContext);

      expect(prisma.case.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockCaseId, firmId: mockFirmId },
        })
      );
    });

    it('should search by reference when no caseId available', async () => {
      prisma.case.findFirst.mockResolvedValue({ id: 'found-case-id' });
      prisma.case.findUnique.mockResolvedValue(mockCase);

      await handler.handle({ queryType: 'status', caseReference: 'Ionescu' }, {}, mockUserContext);

      expect(prisma.case.findFirst).toHaveBeenCalledWith({
        where: {
          firmId: mockFirmId,
          OR: [
            { caseNumber: { contains: 'Ionescu', mode: 'insensitive' } },
            { title: { contains: 'Ionescu', mode: 'insensitive' } },
            { client: { name: { contains: 'Ionescu', mode: 'insensitive' } } },
          ],
        },
        select: { id: true },
      });
    });

    it('should return error when case cannot be identified', async () => {
      prisma.case.findFirst.mockResolvedValue(null);

      const result = await handler.handle({ queryType: 'status' }, {}, mockUserContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Nu am putut identifica dosarul');
    });
  });

  // ============================================================================
  // handleStatusQuery Tests
  // ============================================================================

  describe('handleStatusQuery', () => {
    it('should return formatted case status with pending tasks', async () => {
      prisma.case.findUnique.mockResolvedValue(mockCase);

      const result = await handler.handle(
        { queryType: 'status', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Ionescu vs. ABC SRL');
      expect(result.message).toContain('2024-1234');
      expect(result.message).toContain('Ion Ionescu');
      expect(result.message).toContain('Activ');
      expect(result.message).toContain('Sarcini în așteptare');
      expect(result.message).toContain('Pregătire acte');
    });

    it('should show no tasks message when case has no pending tasks', async () => {
      prisma.case.findUnique.mockResolvedValue({ ...mockCase, tasks: [] });

      const result = await handler.handle(
        { queryType: 'status', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu există sarcini în așteptare');
    });

    it('should return error when case not found', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      const result = await handler.handle(
        { queryType: 'status', caseId: 'nonexistent' },
        {},
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Dosarul nu a fost găsit.');
    });

    it('should translate case status to Romanian', async () => {
      const statuses = [
        { status: 'Active', expected: 'Activ' },
        { status: 'Pending', expected: 'În așteptare' },
        { status: 'Closed', expected: 'Închis' },
        { status: 'OnHold', expected: 'Suspendat' },
      ];

      for (const { status, expected } of statuses) {
        prisma.case.findUnique.mockResolvedValue({ ...mockCase, status, tasks: [] });

        const result = await handler.handle(
          { queryType: 'status', caseId: mockCaseId },
          {},
          mockUserContext
        );

        expect(result.message).toContain(expected);
      }
    });
  });

  // ============================================================================
  // handleDeadlineQuery Tests
  // ============================================================================

  describe('handleDeadlineQuery', () => {
    it('should return formatted deadline list', async () => {
      const futureTasks = [
        {
          id: 'task-1',
          title: 'Termen instanță',
          dueDate: new Date('2025-01-25'),
          priority: 'High',
          type: 'Court',
        },
        {
          id: 'task-2',
          title: 'Depunere acte',
          dueDate: new Date('2025-01-30'),
          priority: 'Medium',
          type: 'Filing',
        },
      ];
      prisma.task.findMany.mockResolvedValue(futureTasks);

      const result = await handler.handle(
        { queryType: 'deadline', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Următoarele termene');
      expect(result.message).toContain('Termen instanță');
      expect(result.message).toContain('Depunere acte');
      expect(result.data).toEqual({ tasks: futureTasks });
    });

    it('should return no deadlines message when none exist', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      const result = await handler.handle(
        { queryType: 'deadline', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Nu există termene viitoare în acest dosar.');
    });

    it('should only fetch pending tasks with future due dates', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await handler.handle({ queryType: 'deadline', caseId: mockCaseId }, {}, mockUserContext);

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: {
          caseId: mockCaseId,
          case: { firmId: mockFirmId },
          status: 'Pending',
          dueDate: { gte: expect.any(Date) },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: expect.any(Object),
      });
    });
  });

  // ============================================================================
  // handleSummaryQuery Tests
  // ============================================================================

  describe('handleSummaryQuery', () => {
    it('should return cached summary when not stale', async () => {
      prisma.caseSummary.findUnique.mockResolvedValue(mockSummary);

      const result = await handler.handle(
        { queryType: 'summary', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Rezumat dosar');
      expect(result.message).toContain('Dosar în curs de soluționare');
      expect(result.message).toContain('Așteptăm răspunsul instanței');
      expect(result.message).toContain('Dezvoltări cheie');
      expect(result.message).toContain('Probleme deschise');
      expect(caseSummaryService.generateSummary).not.toHaveBeenCalled();
    });

    it('should regenerate summary when stale', async () => {
      prisma.caseSummary.findUnique
        .mockResolvedValueOnce({ ...mockSummary, isStale: true })
        .mockResolvedValueOnce(mockSummary);
      caseSummaryService.generateSummary.mockResolvedValue(undefined);

      const result = await handler.handle(
        { queryType: 'summary', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(caseSummaryService.generateSummary).toHaveBeenCalledWith(mockCaseId, mockFirmId);
    });

    it('should generate summary when none exists', async () => {
      prisma.caseSummary.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(mockSummary);
      caseSummaryService.generateSummary.mockResolvedValue(undefined);

      const result = await handler.handle(
        { queryType: 'summary', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(caseSummaryService.generateSummary).toHaveBeenCalledWith(mockCaseId, mockFirmId);
    });

    it('should return error when summary generation fails', async () => {
      prisma.caseSummary.findUnique.mockResolvedValue(null);
      caseSummaryService.generateSummary.mockRejectedValue(new Error('AI error'));

      const result = await handler.handle(
        { queryType: 'summary', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('eroare la generarea rezumatului');
    });

    it('should enforce firm isolation for summaries', async () => {
      prisma.caseSummary.findUnique.mockResolvedValue({
        ...mockSummary,
        case: { firmId: 'other-firm' },
      });

      const result = await handler.handle(
        { queryType: 'summary', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Dosarul nu a fost găsit.');
    });
  });

  // ============================================================================
  // handleActorsQuery Tests
  // ============================================================================

  describe('handleActorsQuery', () => {
    it('should return formatted actors list', async () => {
      prisma.case.findUnique.mockResolvedValue(mockCase);

      const result = await handler.handle(
        { queryType: 'actors', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Client');
      expect(result.message).toContain('Ion Ionescu');
      expect(result.message).toContain('Părți');
      expect(result.message).toContain('ABC SRL');
      expect(result.message).toContain('Pârât'); // Translated 'Defendant'
      expect(result.message).toContain('Echipa firmei');
      expect(result.message).toContain('Maria Popescu');
    });

    it('should return empty message when no actors', async () => {
      prisma.case.findUnique.mockResolvedValue({
        ...mockCase,
        client: null,
        actors: [],
        teamMembers: [],
      });

      const result = await handler.handle(
        { queryType: 'actors', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Nu sunt informații');
    });

    it('should translate actor roles to Romanian', async () => {
      const roles = [
        { role: 'Plaintiff', expected: 'Reclamant' },
        { role: 'Defendant', expected: 'Pârât' },
        { role: 'Witness', expected: 'Martor' },
        { role: 'Expert', expected: 'Expert' },
      ];

      for (const { role, expected } of roles) {
        prisma.case.findUnique.mockResolvedValue({
          ...mockCase,
          client: null,
          actors: [{ name: 'Test Actor', role, email: null, phone: null }],
          teamMembers: [],
        });

        const result = await handler.handle(
          { queryType: 'actors', caseId: mockCaseId },
          {},
          mockUserContext
        );

        expect(result.message).toContain(expected);
      }
    });
  });

  // ============================================================================
  // handleDocumentsQuery Tests
  // ============================================================================

  describe('handleDocumentsQuery', () => {
    it('should return formatted documents list', async () => {
      prisma.caseDocument.findMany.mockResolvedValue(mockDocuments);

      const result = await handler.handle(
        { queryType: 'documents', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Ultimele documente');
      expect(result.message).toContain('cerere.pdf');
      expect(result.message).toContain('dovada.pdf');
    });

    it('should return no documents message when none exist', async () => {
      prisma.caseDocument.findMany.mockResolvedValue([]);

      const result = await handler.handle(
        { queryType: 'documents', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Nu există documente în acest dosar.');
    });

    it('should limit to 10 documents', async () => {
      prisma.caseDocument.findMany.mockResolvedValue([]);

      await handler.handle({ queryType: 'documents', caseId: mockCaseId }, {}, mockUserContext);

      expect(prisma.caseDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { linkedAt: 'desc' },
        })
      );
    });
  });

  // ============================================================================
  // handleGeneralQuery Tests
  // ============================================================================

  describe('handleGeneralQuery', () => {
    it('should return fallback message for general queries', async () => {
      prisma.case.findUnique.mockResolvedValue(mockCase);

      const result = await handler.handle(
        { queryType: 'general', caseId: mockCaseId, question: 'Ce se întâmplă?' },
        {},
        mockUserContext
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('întrebări complexe');
      expect(result.message).toContain('Ionescu vs. ABC SRL');
    });

    it('should return error when case not found', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      const result = await handler.handle(
        { queryType: 'general', caseId: 'nonexistent', question: 'Test?' },
        {},
        mockUserContext
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Dosarul nu a fost găsit.');
    });
  });

  // ============================================================================
  // Date Formatting Tests
  // ============================================================================

  describe('Date Formatting', () => {
    it('should format dates in Romanian', async () => {
      const testDate = new Date('2025-03-15');
      prisma.task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Test', dueDate: testDate, priority: 'High', type: 'Court' },
      ]);

      const result = await handler.handle(
        { queryType: 'deadline', caseId: mockCaseId },
        {},
        mockUserContext
      );

      expect(result.message).toContain('15 mar 2025');
    });
  });

  // ============================================================================
  // Priority Translation Tests
  // ============================================================================

  describe('Priority Translation', () => {
    it('should translate priorities to Romanian', async () => {
      const priorities = [
        { priority: 'High', expected: 'Urgentă' },
        { priority: 'Medium', expected: 'Medie' },
        { priority: 'Low', expected: 'Scăzută' },
        { priority: 'Critical', expected: 'Critică' },
      ];

      for (const { priority, expected } of priorities) {
        prisma.case.findUnique.mockResolvedValue({
          ...mockCase,
          tasks: [{ id: 'task-1', title: 'Test', dueDate: new Date(), priority }],
        });

        const result = await handler.handle(
          { queryType: 'status', caseId: mockCaseId },
          {},
          mockUserContext
        );

        expect(result.message).toContain(expected);
      }
    });
  });
});
