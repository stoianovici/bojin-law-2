/**
 * Comprehension Tools Handler Unit Tests
 *
 * Tests for the 8 read-only tools used by the Case Comprehension agent.
 * Focuses on:
 * - Multi-tenancy validation (access control)
 * - Correct data formatting
 * - Parameter handling
 */

// ============================================================================
// Mock Setup
// ============================================================================

const mockPrisma = {
  case: {
    findUnique: jest.fn(),
  },
  client: {
    findUnique: jest.fn(),
  },
  caseTeam: {
    findMany: jest.fn(),
  },
  caseActor: {
    findMany: jest.fn(),
  },
  caseDocument: {
    findMany: jest.fn(),
  },
  threadSummary: {
    findMany: jest.fn(),
  },
  email: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  caseComprehension: {
    findUnique: jest.fn(),
  },
  caseActivityEntry: {
    findMany: jest.fn(),
  },
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Import after mocks
import {
  handleReadCaseIdentity,
  handleReadCaseActors,
  handleReadCaseDocuments,
  handleReadCaseEmails,
  handleReadCaseTimeline,
  handleReadCaseContext,
  handleReadClientContext,
  handleReadCaseActivities,
  createComprehensionToolHandlers,
} from '../../src/services/comprehension-tools.handlers';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_FIRM_ID = 'firm-123';
const OTHER_FIRM_ID = 'firm-other';
const TEST_CASE_ID = 'case-456';
const TEST_CLIENT_ID = 'client-789';

// ============================================================================
// Tests
// ============================================================================

describe('Comprehension Tools Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Tool 1: read_case_identity
  // ==========================================================================

  describe('handleReadCaseIdentity', () => {
    it('should validate case access and return formatted identity', async () => {
      mockPrisma.case.findUnique
        .mockResolvedValueOnce({ firmId: TEST_FIRM_ID }) // Access check
        .mockResolvedValueOnce({
          id: TEST_CASE_ID,
          caseNumber: 'DOS-001',
          title: 'Test Case',
          status: 'Active',
          type: 'Litigation',
          description: 'A test case description',
          value: 50000,
          openedDate: new Date('2024-01-15'),
          closedDate: null,
          billingType: 'HOURLY',
          keywords: ['contract', 'dispute'],
          referenceNumbers: ['REF-001'],
          client: {
            id: TEST_CLIENT_ID,
            name: 'Test Client',
            clientType: 'legal_entity',
            cui: '12345678',
          },
        });

      const result = await handleReadCaseIdentity({ caseId: TEST_CASE_ID }, TEST_FIRM_ID);

      expect(result).toContain('# Identitate Dosar');
      expect(result).toContain('DOS-001');
      expect(result).toContain('Test Case');
      expect(result).toContain('Active');
      expect(result).toContain('50.000 RON');
      expect(result).toContain('Test Client');
      expect(result).toContain('contract, dispute');
    });

    it('should deny access to cases from other firms', async () => {
      mockPrisma.case.findUnique.mockResolvedValueOnce({ firmId: OTHER_FIRM_ID });

      await expect(handleReadCaseIdentity({ caseId: TEST_CASE_ID }, TEST_FIRM_ID)).rejects.toThrow(
        'Access denied'
      );
    });

    it('should deny access to non-existent cases', async () => {
      mockPrisma.case.findUnique.mockResolvedValueOnce(null);

      await expect(
        handleReadCaseIdentity({ caseId: 'non-existent' }, TEST_FIRM_ID)
      ).rejects.toThrow('Access denied');
    });

    it('should handle case without client gracefully', async () => {
      mockPrisma.case.findUnique
        .mockResolvedValueOnce({ firmId: TEST_FIRM_ID }) // Access check
        .mockResolvedValueOnce({
          id: TEST_CASE_ID,
          caseNumber: 'DOS-002',
          title: 'Case Without Client',
          status: 'Active',
          type: 'Litigation',
          description: 'A case without an associated client',
          value: null,
          openedDate: new Date('2024-01-15'),
          closedDate: null,
          billingType: 'FIXED',
          keywords: [],
          referenceNumbers: [],
          client: null, // No client associated
        });

      const result = await handleReadCaseIdentity({ caseId: TEST_CASE_ID }, TEST_FIRM_ID);

      expect(result).toContain('# Identitate Dosar');
      expect(result).toContain('DOS-002');
      expect(result).toContain('Case Without Client');
      expect(result).toContain('Niciun client asociat');
      // Should NOT contain client-specific fields
      expect(result).not.toContain('**ID Client:**');
      expect(result).not.toContain('**CUI:**');
    });
  });

  // ==========================================================================
  // Tool 2: read_case_actors
  // ==========================================================================

  describe('handleReadCaseActors', () => {
    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValueOnce({ firmId: TEST_FIRM_ID });
    });

    it('should return formatted actors list', async () => {
      mockPrisma.caseTeam.findMany.mockResolvedValue([
        {
          role: 'Lead',
          assignedAt: new Date(),
          user: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      ]);
      mockPrisma.caseActor.findMany.mockResolvedValue([
        {
          id: 'actor-1',
          role: 'OPPOSING_PARTY',
          customRoleCode: null,
          name: 'Opposing Corp',
          organization: 'Corp Inc',
          email: 'opposing@corp.com',
          phone: null,
          address: null,
          notes: 'Difficult negotiations',
          communicationNotes: null,
          preferredTone: null,
        },
      ]);
      mockPrisma.case.findUnique.mockResolvedValueOnce({
        client: {
          name: 'Test Client',
          contacts: [{ name: 'Contact Person', email: 'contact@client.com' }],
          administrators: [],
        },
      });

      const result = await handleReadCaseActors({ caseId: TEST_CASE_ID }, TEST_FIRM_ID);

      expect(result).toContain('# Actori în Dosar');
      expect(result).toContain('John Doe');
      expect(result).toContain('Lead');
      expect(result).toContain('Opposing Corp');
      expect(result).toContain('Difficult negotiations');
      expect(result).toContain('Contact Person');
    });
  });

  // ==========================================================================
  // Tool 3: read_case_documents
  // ==========================================================================

  describe('handleReadCaseDocuments', () => {
    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValueOnce({ firmId: TEST_FIRM_ID });
    });

    it('should return formatted documents with content', async () => {
      mockPrisma.caseDocument.findMany.mockResolvedValue([
        {
          id: 'casedoc-1',
          linkedAt: new Date(),
          document: {
            id: 'doc-1',
            fileName: 'contract.pdf',
            fileType: 'application/pdf',
            fileSize: 102400,
            status: 'FINAL',
            extractedContent: 'This is the contract content...',
            userDescription: 'Main contract',
            updatedAt: new Date(),
          },
        },
      ]);

      const result = await handleReadCaseDocuments(
        { caseId: TEST_CASE_ID, includeContent: true, maxContentLength: 1000 },
        TEST_FIRM_ID
      );

      expect(result).toContain('# Documente Dosar');
      expect(result).toContain('contract.pdf');
      expect(result).toContain('Main contract');
      expect(result).toContain('This is the contract content');
    });

    it('should respect maxContentLength parameter', async () => {
      const longContent = 'A'.repeat(5000);
      mockPrisma.caseDocument.findMany.mockResolvedValue([
        {
          id: 'casedoc-1',
          linkedAt: new Date(),
          document: {
            id: 'doc-1',
            fileName: 'document.pdf',
            fileType: 'application/pdf',
            fileSize: 102400,
            status: 'FINAL',
            extractedContent: longContent,
            userDescription: null,
            updatedAt: new Date(),
          },
        },
      ]);

      const result = await handleReadCaseDocuments(
        { caseId: TEST_CASE_ID, includeContent: true, maxContentLength: 100 },
        TEST_FIRM_ID
      );

      expect(result).toContain('...[truncat]');
      // Should not contain full content
      expect(result.includes(longContent)).toBe(false);
    });
  });

  // ==========================================================================
  // Tool 4: read_case_emails
  // ==========================================================================

  describe('handleReadCaseEmails', () => {
    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValueOnce({ firmId: TEST_FIRM_ID });
    });

    it('should return thread summaries and recent emails', async () => {
      mockPrisma.threadSummary.findMany.mockResolvedValue([
        {
          conversationId: 'thread-1',
          overview: 'Discussion about contract terms',
          keyPoints: ['Point 1', 'Point 2'],
          actionItems: ['Follow up on pricing'],
          sentiment: 'NEUTRAL',
          participants: [],
          opposingCounselPosition: 'They want lower price',
          keyArguments: ['Market rates', 'Volume discount'],
          messageCount: 5,
          lastAnalyzedAt: new Date(),
        },
      ]);
      mockPrisma.email.findMany.mockResolvedValue([
        {
          conversationId: 'thread-2',
          subject: 'New inquiry',
          bodyPreview: 'Hello, I would like to ask about...',
          bodyContentClean: null,
          from: { emailAddress: { name: 'Jane Doe', address: 'jane@example.com' } },
          receivedDateTime: new Date(),
          hasAttachments: false,
        },
      ]);

      const result = await handleReadCaseEmails({ caseId: TEST_CASE_ID }, TEST_FIRM_ID);

      expect(result).toContain('# Comunicări Email');
      expect(result).toContain('Discussion about contract terms');
      expect(result).toContain('Point 1');
      expect(result).toContain('Follow up on pricing');
      expect(result).toContain('New inquiry');
      expect(result).toContain('Jane Doe');
    });
  });

  // ==========================================================================
  // Tool 5: read_case_timeline
  // ==========================================================================

  describe('handleReadCaseTimeline', () => {
    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValueOnce({ firmId: TEST_FIRM_ID });
    });

    it('should return formatted timeline with future and past events', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      mockPrisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Court hearing',
          description: 'Main hearing',
          type: 'HEARING',
          status: 'Pending',
          priority: 'High',
          dueDate: futureDate,
          dueTime: '10:00',
          completedAt: null,
          assignedTo: 'user-1',
        },
        {
          id: 'task-2',
          title: 'File submission',
          description: null,
          type: 'DEADLINE',
          status: 'Completed',
          priority: 'Medium',
          dueDate: pastDate,
          dueTime: null,
          completedAt: pastDate,
          assignedTo: 'user-1',
        },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe' },
      ]);

      const result = await handleReadCaseTimeline(
        { caseId: TEST_CASE_ID, includePast: true, includeFuture: true },
        TEST_FIRM_ID
      );

      expect(result).toContain('# Cronologie Dosar');
      expect(result).toContain('Court hearing');
      expect(result).toContain('Evenimente Viitoare');
      expect(result).toContain('File submission');
      expect(result).toContain('Evenimente Trecute');
    });
  });

  // ==========================================================================
  // Tool 6: read_case_context
  // ==========================================================================

  describe('handleReadCaseContext', () => {
    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValueOnce({ firmId: TEST_FIRM_ID });
    });

    it('should return existing comprehension with corrections', async () => {
      mockPrisma.caseComprehension.findUnique.mockResolvedValue({
        id: 'comp-1',
        currentPicture: 'This is the current picture of the case...',
        dataMap: { sources: [] },
        version: 3,
        generatedAt: new Date(),
        validUntil: new Date(),
        isStale: false,
        corrections: [
          {
            anchorText: 'wrong text',
            correctionType: 'OVERRIDE',
            correctedValue: 'correct text',
            reason: 'User correction',
          },
        ],
      });

      const result = await handleReadCaseContext({ caseId: TEST_CASE_ID }, TEST_FIRM_ID);

      expect(result).toContain('# Comprehensiune Existentă');
      expect(result).toContain('Versiune:** 3');
      expect(result).toContain('This is the current picture');
      expect(result).toContain('Corecturi Active');
      expect(result).toContain('wrong text');
      expect(result).toContain('correct text');
    });

    it('should indicate first generation when no comprehension exists', async () => {
      mockPrisma.caseComprehension.findUnique.mockResolvedValue(null);

      const result = await handleReadCaseContext({ caseId: TEST_CASE_ID }, TEST_FIRM_ID);

      expect(result).toContain('Nu există comprehensiune');
      expect(result).toContain('prima generare');
    });
  });

  // ==========================================================================
  // Tool 7: read_client_context
  // ==========================================================================

  describe('handleReadClientContext', () => {
    it('should validate client access and return context', async () => {
      mockPrisma.client.findUnique
        .mockResolvedValueOnce({ firmId: TEST_FIRM_ID }) // Access check
        .mockResolvedValueOnce({
          id: TEST_CLIENT_ID,
          name: 'Acme Corp',
          clientType: 'legal_entity',
          companyType: 'SRL',
          cui: '12345678',
          registrationNumber: 'J12/1234/2020',
          address: 'Str. Test 123',
          contactInfo: { email: 'contact@acme.com', phone: '+40 123 456 789' },
          contacts: [],
          administrators: [],
          billingType: 'HOURLY',
          cases: [
            {
              id: 'case-1',
              caseNumber: 'DOS-001',
              title: 'Active Case',
              type: 'Contract',
              openedDate: new Date(),
            },
          ],
          _count: { cases: 5, invoices: 10 },
        });

      const result = await handleReadClientContext({ clientId: TEST_CLIENT_ID }, TEST_FIRM_ID);

      expect(result).toContain('# Context Client');
      expect(result).toContain('Acme Corp');
      expect(result).toContain('12345678');
      expect(result).toContain('Total dosare:** 5');
      expect(result).toContain('DOS-001');
    });

    it('should deny access to clients from other firms', async () => {
      mockPrisma.client.findUnique.mockResolvedValueOnce({ firmId: OTHER_FIRM_ID });

      await expect(
        handleReadClientContext({ clientId: TEST_CLIENT_ID }, TEST_FIRM_ID)
      ).rejects.toThrow('Access denied');
    });
  });

  // ==========================================================================
  // Tool 8: read_case_activities
  // ==========================================================================

  describe('handleReadCaseActivities', () => {
    beforeEach(() => {
      mockPrisma.case.findUnique.mockResolvedValueOnce({ firmId: TEST_FIRM_ID });
    });

    it('should return recent activities', async () => {
      mockPrisma.caseActivityEntry.findMany.mockResolvedValue([
        {
          activityType: 'DOCUMENT_UPLOADED',
          entityType: 'document',
          title: 'Contract uploaded',
          summary: 'New contract document added',
          createdAt: new Date(),
          actor: { firstName: 'John', lastName: 'Doe' },
        },
        {
          activityType: 'TASK_COMPLETED',
          entityType: 'task',
          title: 'Review completed',
          summary: null,
          createdAt: new Date(),
          actor: { firstName: 'Jane', lastName: 'Smith' },
        },
      ]);

      const result = await handleReadCaseActivities(
        { caseId: TEST_CASE_ID, limit: 20 },
        TEST_FIRM_ID
      );

      expect(result).toContain('# Activitate Recentă');
      expect(result).toContain('Contract uploaded');
      expect(result).toContain('DOCUMENT_UPLOADED');
      expect(result).toContain('John Doe');
      expect(result).toContain('Review completed');
    });

    it('should handle empty activities', async () => {
      mockPrisma.caseActivityEntry.findMany.mockResolvedValue([]);

      const result = await handleReadCaseActivities({ caseId: TEST_CASE_ID }, TEST_FIRM_ID);

      expect(result).toContain('Nu există activități');
    });
  });

  // ==========================================================================
  // Handler Factory
  // ==========================================================================

  describe('createComprehensionToolHandlers', () => {
    it('should create handlers for all 8 tools', () => {
      const handlers = createComprehensionToolHandlers(TEST_FIRM_ID);

      expect(handlers).toHaveProperty('read_case_identity');
      expect(handlers).toHaveProperty('read_case_actors');
      expect(handlers).toHaveProperty('read_case_documents');
      expect(handlers).toHaveProperty('read_case_emails');
      expect(handlers).toHaveProperty('read_case_timeline');
      expect(handlers).toHaveProperty('read_case_context');
      expect(handlers).toHaveProperty('read_client_context');
      expect(handlers).toHaveProperty('read_case_activities');
    });

    it('should bind firmId to handlers', async () => {
      mockPrisma.case.findUnique
        .mockResolvedValueOnce({ firmId: TEST_FIRM_ID })
        .mockResolvedValueOnce({
          id: TEST_CASE_ID,
          caseNumber: 'DOS-001',
          title: 'Test',
          status: 'Active',
          type: 'Litigation',
          description: null,
          value: null,
          openedDate: new Date(),
          closedDate: null,
          billingType: 'HOURLY',
          keywords: [],
          referenceNumbers: [],
          client: { id: 'client-1', name: 'Client', clientType: 'individual', cui: null },
        });

      const handlers = createComprehensionToolHandlers(TEST_FIRM_ID);
      const result = await handlers.read_case_identity({ caseId: TEST_CASE_ID });

      expect(result).toContain('DOS-001');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Comprehension tool called',
        expect.objectContaining({ tool: 'read_case_identity', firmId: TEST_FIRM_ID })
      );
    });
  });
});
