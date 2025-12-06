/**
 * Bulk Communication Service Unit Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 37 (AC: 3)
 *
 * Tests for bulk communication and recipient resolution
 */

// Mock GraphService before importing the service (prevents Azure AD config loading)
jest.mock('./graph.service', () => ({
  GraphService: jest.fn().mockImplementation(() => ({
    getAppClient: jest.fn().mockResolvedValue({
      api: jest.fn().mockReturnThis(),
      post: jest.fn().mockResolvedValue({}),
    }),
    sendMail: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { BulkCommunicationService } from './bulk-communication.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    bulkCommunication: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    bulkCommunicationLog: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    caseTeam: {
      findMany: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
    },
  },
  BulkCommunicationStatus: {
    Draft: 'Draft',
    Scheduled: 'Scheduled',
    InProgress: 'InProgress',
    Completed: 'Completed',
    PartiallyFailed: 'PartiallyFailed',
    Cancelled: 'Cancelled',
  },
  BulkRecipientType: {
    CaseClients: 'CaseClients',
    CaseTeam: 'CaseTeam',
    AllClients: 'AllClients',
    CustomList: 'CustomList',
    CaseTypeClients: 'CaseTypeClients',
  },
  CommunicationChannel: {
    Email: 'Email',
  },
}));

// Mock template service
jest.mock('./communication-template.service', () => ({
  communicationTemplateService: {
    incrementUsageCount: jest.fn(),
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('BulkCommunicationService', () => {
  let service: BulkCommunicationService;

  const mockFirmId = 'firm-123';
  const mockUserId = 'user-789';
  const mockCaseId = 'case-456';

  const mockUserContext = {
    userId: mockUserId,
    firmId: mockFirmId,
  };

  const mockBulkComm = {
    id: 'bulk-1',
    firmId: mockFirmId,
    caseId: mockCaseId,
    templateId: null,
    subject: 'Case Update',
    body: 'This is a case update message',
    htmlBody: null,
    channelType: 'Email',
    recipientType: 'CaseClients',
    recipientFilter: {},
    recipients: [],
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    status: 'Draft',
    scheduledFor: null,
    startedAt: null,
    completedAt: null,
    createdBy: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BulkCommunicationService();
  });

  // ============================================================================
  // createBulkCommunication Tests
  // ============================================================================

  describe('createBulkCommunication', () => {
    it('should create a new bulk communication in draft status', async () => {
      prisma.bulkCommunication.create.mockResolvedValue(mockBulkComm);

      const result = await service.createBulkCommunication(
        {
          caseId: mockCaseId,
          subject: 'Case Update',
          body: 'Update message',
          channelType: 'Email' as any,
          recipientType: 'CaseClients' as any,
          recipientFilter: {},
        },
        mockUserContext
      );

      expect(result.id).toBe('bulk-1');
      expect(result.status).toBe('Draft');
      expect(prisma.bulkCommunication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firmId: mockFirmId,
            status: 'Draft',
            createdBy: mockUserId,
          }),
        })
      );
    });

    it('should increment template usage when template ID provided', async () => {
      const { communicationTemplateService } = jest.requireMock(
        './communication-template.service'
      );
      prisma.bulkCommunication.create.mockResolvedValue({
        ...mockBulkComm,
        templateId: 'template-1',
      });

      await service.createBulkCommunication(
        {
          templateId: 'template-1',
          subject: 'From template',
          body: 'Template body',
          channelType: 'Email' as any,
          recipientType: 'CaseClients' as any,
          recipientFilter: {},
        },
        mockUserContext
      );

      expect(communicationTemplateService.incrementUsageCount).toHaveBeenCalledWith(
        'template-1'
      );
    });
  });

  // ============================================================================
  // resolveRecipients Tests
  // ============================================================================

  describe('resolveRecipients', () => {
    it('should throw error when bulk communication not found', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue(null);

      await expect(
        service.resolveRecipients('nonexistent', mockUserContext)
      ).rejects.toThrow('Bulk communication not found');
    });

    it('should resolve CaseClients recipients', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        recipientType: 'CaseClients',
      });
      prisma.case.findUnique.mockResolvedValue({
        id: mockCaseId,
        client: {
          id: 'client-1',
          name: 'John Client',
          contactInfo: { email: 'client@example.com' },
        },
      });
      prisma.bulkCommunication.update.mockResolvedValue({});
      prisma.bulkCommunicationLog.createMany.mockResolvedValue({});

      const result = await service.resolveRecipients('bulk-1', mockUserContext);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John Client');
      expect(result[0].source).toBe('case_client');
    });

    it('should resolve CaseTeam recipients', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        recipientType: 'CaseTeam',
      });
      prisma.caseTeam.findMany.mockResolvedValue([
        {
          user: {
            id: 'user-1',
            firstName: 'Jane',
            lastName: 'Attorney',
            email: 'jane@firm.com',
          },
        },
        {
          user: {
            id: 'user-2',
            firstName: 'Bob',
            lastName: 'Paralegal',
            email: 'bob@firm.com',
          },
        },
      ]);
      prisma.bulkCommunication.update.mockResolvedValue({});
      prisma.bulkCommunicationLog.createMany.mockResolvedValue({});

      const result = await service.resolveRecipients('bulk-1', mockUserContext);

      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('case_team');
    });

    it('should resolve CustomList recipients', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        recipientType: 'CustomList',
        recipientFilter: {
          customRecipients: [
            { id: 'r1', name: 'Custom User 1', email: 'user1@example.com' },
            { id: 'r2', name: 'Custom User 2', email: 'user2@example.com' },
          ],
        },
      });
      prisma.bulkCommunication.update.mockResolvedValue({});
      prisma.bulkCommunicationLog.createMany.mockResolvedValue({});

      const result = await service.resolveRecipients('bulk-1', mockUserContext);

      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('custom');
    });

    it('should resolve AllClients recipients', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        recipientType: 'AllClients',
      });
      prisma.client.findMany.mockResolvedValue([
        { id: 'c1', name: 'Client 1', contactInfo: { email: 'c1@example.com' } },
        { id: 'c2', name: 'Client 2', contactInfo: { email: 'c2@example.com' } },
      ]);
      prisma.bulkCommunication.update.mockResolvedValue({});
      prisma.bulkCommunicationLog.createMany.mockResolvedValue({});

      const result = await service.resolveRecipients('bulk-1', mockUserContext);

      expect(result).toHaveLength(2);
    });

    it('should resolve CaseTypeClients recipients', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        recipientType: 'CaseTypeClients',
        recipientFilter: { caseTypes: ['Litigation'] },
      });
      prisma.case.findMany.mockResolvedValue([
        {
          id: 'case-1',
          client: { id: 'c1', name: 'Lit Client', contactInfo: { email: 'lit@example.com' } },
        },
      ]);
      prisma.bulkCommunication.update.mockResolvedValue({});
      prisma.bulkCommunicationLog.createMany.mockResolvedValue({});

      const result = await service.resolveRecipients('bulk-1', mockUserContext);

      expect(result).toHaveLength(1);
    });

    it('should deduplicate recipients by email', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        recipientType: 'CustomList',
        recipientFilter: {
          customRecipients: [
            { id: 'r1', name: 'User 1', email: 'same@example.com' },
            { id: 'r2', name: 'User 2', email: 'SAME@example.com' },
          ],
        },
      });
      prisma.bulkCommunication.update.mockResolvedValue({});
      prisma.bulkCommunicationLog.createMany.mockResolvedValue({});

      const result = await service.resolveRecipients('bulk-1', mockUserContext);

      expect(result).toHaveLength(1);
    });

    it('should create log entries for each recipient', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        recipientType: 'CustomList',
        recipientFilter: {
          customRecipients: [
            { id: 'r1', name: 'User 1', email: 'user1@example.com' },
          ],
        },
      });
      prisma.bulkCommunication.update.mockResolvedValue({});
      prisma.bulkCommunicationLog.createMany.mockResolvedValue({});

      await service.resolveRecipients('bulk-1', mockUserContext);

      expect(prisma.bulkCommunicationLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            bulkCommunicationId: 'bulk-1',
            recipientEmail: 'user1@example.com',
            status: 'pending',
          }),
        ]),
      });
    });
  });

  // ============================================================================
  // sendBulkCommunication Tests
  // ============================================================================

  describe('sendBulkCommunication', () => {
    it('should throw error when bulk communication not found', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue(null);

      await expect(
        service.sendBulkCommunication('nonexistent', mockUserContext)
      ).rejects.toThrow('Bulk communication not found');
    });

    it('should throw error when not in draft status', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        status: 'InProgress',
      });

      await expect(
        service.sendBulkCommunication('bulk-1', mockUserContext)
      ).rejects.toThrow('Bulk communication is not in draft status');
    });

    it('should throw error when no recipients resolved', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        status: 'Draft',
        recipients: [],
      });

      await expect(
        service.sendBulkCommunication('bulk-1', mockUserContext)
      ).rejects.toThrow('No recipients resolved');
    });

    it('should update status to InProgress and start sending', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        status: 'Draft',
        recipients: [{ id: 'r1', name: 'User', email: 'user@example.com', source: 'custom' }],
      });
      prisma.bulkCommunication.update.mockResolvedValue({
        ...mockBulkComm,
        status: 'InProgress',
      });
      prisma.bulkCommunicationLog.findMany.mockResolvedValue([]);

      await service.sendBulkCommunication('bulk-1', mockUserContext);

      expect(prisma.bulkCommunication.update).toHaveBeenCalledWith({
        where: { id: 'bulk-1' },
        data: expect.objectContaining({
          status: 'InProgress',
          startedAt: expect.any(Date),
        }),
      });
    });
  });

  // ============================================================================
  // scheduleBulkCommunication Tests
  // ============================================================================

  describe('scheduleBulkCommunication', () => {
    it('should schedule a draft communication', async () => {
      const scheduledFor = new Date('2024-12-01T10:00:00Z');
      prisma.bulkCommunication.findFirst.mockResolvedValue(mockBulkComm);
      prisma.bulkCommunication.update.mockResolvedValue({
        ...mockBulkComm,
        status: 'Scheduled',
        scheduledFor,
      });

      const result = await service.scheduleBulkCommunication(
        'bulk-1',
        scheduledFor,
        mockUserContext
      );

      expect(result.status).toBe('Scheduled');
      expect(prisma.bulkCommunication.update).toHaveBeenCalledWith({
        where: { id: 'bulk-1' },
        data: {
          status: 'Scheduled',
          scheduledFor,
        },
      });
    });

    it('should throw error when not in draft status', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        status: 'InProgress',
      });

      await expect(
        service.scheduleBulkCommunication('bulk-1', new Date(), mockUserContext)
      ).rejects.toThrow('Only draft communications can be scheduled');
    });
  });

  // ============================================================================
  // cancelBulkCommunication Tests
  // ============================================================================

  describe('cancelBulkCommunication', () => {
    it('should cancel a draft communication', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue(mockBulkComm);
      prisma.bulkCommunication.update.mockResolvedValue({
        ...mockBulkComm,
        status: 'Cancelled',
      });

      const result = await service.cancelBulkCommunication('bulk-1', mockUserContext);

      expect(result.status).toBe('Cancelled');
    });

    it('should cancel a scheduled communication', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        status: 'Scheduled',
      });
      prisma.bulkCommunication.update.mockResolvedValue({
        ...mockBulkComm,
        status: 'Cancelled',
      });

      const result = await service.cancelBulkCommunication('bulk-1', mockUserContext);

      expect(result.status).toBe('Cancelled');
    });

    it('should throw error when cancelling completed communication', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue({
        ...mockBulkComm,
        status: 'Completed',
      });

      await expect(
        service.cancelBulkCommunication('bulk-1', mockUserContext)
      ).rejects.toThrow('Cannot cancel a completed communication');
    });
  });

  // ============================================================================
  // getBulkCommunicationLogs Tests
  // ============================================================================

  describe('getBulkCommunicationLogs', () => {
    it('should return logs for a bulk communication', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue(mockBulkComm);
      prisma.bulkCommunicationLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          bulkCommunicationId: 'bulk-1',
          recipientId: 'r1',
          recipientEmail: 'user@example.com',
          recipientName: 'User',
          status: 'sent',
          sentAt: new Date(),
        },
      ]);
      prisma.bulkCommunicationLog.count.mockResolvedValue(1);

      const result = await service.getBulkCommunicationLogs('bulk-1', mockUserContext);

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter logs by status', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue(mockBulkComm);
      prisma.bulkCommunicationLog.findMany.mockResolvedValue([]);
      prisma.bulkCommunicationLog.count.mockResolvedValue(0);

      await service.getBulkCommunicationLogs('bulk-1', mockUserContext, {
        status: 'failed',
      });

      const findManyCall = prisma.bulkCommunicationLog.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('failed');
    });

    it('should throw error when bulk communication not found', async () => {
      prisma.bulkCommunication.findFirst.mockResolvedValue(null);

      await expect(
        service.getBulkCommunicationLogs('nonexistent', mockUserContext)
      ).rejects.toThrow('Bulk communication not found');
    });
  });

  // ============================================================================
  // listBulkCommunications Tests
  // ============================================================================

  describe('listBulkCommunications', () => {
    it('should return list of bulk communications for firm', async () => {
      prisma.bulkCommunication.findMany.mockResolvedValue([mockBulkComm]);
      prisma.bulkCommunication.count.mockResolvedValue(1);

      const result = await service.listBulkCommunications(mockUserContext);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.bulkCommunication.findMany.mockResolvedValue([]);
      prisma.bulkCommunication.count.mockResolvedValue(0);

      await service.listBulkCommunications(mockUserContext, { status: 'Draft' as any });

      const findManyCall = prisma.bulkCommunication.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('Draft');
    });

    it('should support pagination', async () => {
      prisma.bulkCommunication.findMany.mockResolvedValue([]);
      prisma.bulkCommunication.count.mockResolvedValue(50);

      await service.listBulkCommunications(mockUserContext, {
        limit: 10,
        offset: 20,
      });

      const findManyCall = prisma.bulkCommunication.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(10);
      expect(findManyCall.skip).toBe(20);
    });
  });
});
