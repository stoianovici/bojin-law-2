/**
 * Unified Timeline Service Unit Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 37 (AC: 1, 4)
 *
 * Tests for unified timeline queries and privacy filtering
 */

import { UnifiedTimelineService } from './unified-timeline.service';

// Mock Prisma client
jest.mock('@legal-platform/database', () => ({
  prisma: {
    communicationEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    communicationAttachment: {
      createMany: jest.fn(),
    },
    email: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
  CommunicationChannel: {
    Email: 'Email',
    InternalNote: 'InternalNote',
    WhatsApp: 'WhatsApp',
    Phone: 'Phone',
    Meeting: 'Meeting',
    SMS: 'SMS',
  },
  CommunicationDirection: {
    Inbound: 'Inbound',
    Outbound: 'Outbound',
    Internal: 'Internal',
  },
  PrivacyLevel: {
    Normal: 'Normal',
    Confidential: 'Confidential',
    AttorneyOnly: 'AttorneyOnly',
    PartnerOnly: 'PartnerOnly',
  },
  UserRole: {
    Partner: 'Partner',
    Associate: 'Associate',
    Paralegal: 'Paralegal',
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('UnifiedTimelineService', () => {
  let service: UnifiedTimelineService;

  const mockFirmId = 'firm-123';
  const mockCaseId = 'case-456';
  const mockUserId = 'user-789';

  const mockUserContext = {
    userId: mockUserId,
    role: 'Partner' as any,
    firmId: mockFirmId,
  };

  const mockCommunicationEntry = {
    id: 'entry-1',
    firmId: mockFirmId,
    caseId: mockCaseId,
    channelType: 'Email',
    direction: 'Inbound',
    subject: 'Test Subject',
    body: 'Test body content for the email message',
    senderName: 'John Doe',
    senderEmail: 'john@example.com',
    recipients: [{ name: 'Jane Doe', email: 'jane@example.com', type: 'to' }],
    hasAttachments: false,
    isPrivate: false,
    privacyLevel: 'Normal',
    allowedViewers: [],
    sentAt: new Date('2024-01-15T10:00:00Z'),
    createdAt: new Date('2024-01-15T10:00:00Z'),
    attachments: [],
    sender: {
      id: 'sender-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UnifiedTimelineService();
  });

  // ============================================================================
  // getUnifiedTimeline Tests
  // ============================================================================

  describe('getUnifiedTimeline', () => {
    it('should return paginated timeline entries', async () => {
      const mockEntries = [mockCommunicationEntry];
      prisma.communicationEntry.findMany.mockResolvedValue(mockEntries);
      prisma.communicationEntry.count.mockResolvedValue(1);

      const result = await service.getUnifiedTimeline(
        { caseId: mockCaseId },
        { limit: 20 },
        mockUserContext
      );

      expect(result.entries).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(prisma.communicationEntry.findMany).toHaveBeenCalled();
    });

    it('should indicate hasMore when more entries exist', async () => {
      const mockEntries = Array(21)
        .fill(mockCommunicationEntry)
        .map((e, i) => ({ ...e, id: `entry-${i}` }));
      prisma.communicationEntry.findMany.mockResolvedValue(mockEntries);
      prisma.communicationEntry.count.mockResolvedValue(50);

      const result = await service.getUnifiedTimeline(
        { caseId: mockCaseId },
        { limit: 20 },
        mockUserContext
      );

      expect(result.hasMore).toBe(true);
      expect(result.entries).toHaveLength(20);
      expect(result.cursor).toBeDefined();
    });

    it('should filter by channel types', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      await service.getUnifiedTimeline(
        { caseId: mockCaseId, channelTypes: ['Email' as any, 'InternalNote' as any] },
        {},
        mockUserContext
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.channelType).toEqual({ in: ['Email', 'InternalNote'] });
    });

    it('should filter by direction', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      await service.getUnifiedTimeline(
        { caseId: mockCaseId, direction: 'Inbound' as any },
        {},
        mockUserContext
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.direction).toBe('Inbound');
    });

    it('should filter by date range', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await service.getUnifiedTimeline(
        { caseId: mockCaseId, dateFrom, dateTo },
        {},
        mockUserContext
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.sentAt).toEqual({ gte: dateFrom, lte: dateTo });
    });

    it('should filter by search term', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      await service.getUnifiedTimeline(
        { caseId: mockCaseId, searchTerm: 'contract' },
        {},
        mockUserContext
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toContainEqual(
        expect.objectContaining({ subject: { contains: 'contract', mode: 'insensitive' } })
      );
    });

    it('should apply privacy filter for Associates (exclude PartnerOnly)', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      await service.getUnifiedTimeline(
        { caseId: mockCaseId },
        {},
        { ...mockUserContext, role: 'Associate' as any }
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toBeDefined();
    });

    it('should apply privacy filter for Paralegals (exclude AttorneyOnly and PartnerOnly)', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      await service.getUnifiedTimeline(
        { caseId: mockCaseId },
        {},
        { ...mockUserContext, role: 'Paralegal' as any }
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toBeDefined();
    });

    it('should not apply privacy filter for Partners', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      await service.getUnifiedTimeline(
        { caseId: mockCaseId },
        {},
        { ...mockUserContext, role: 'Partner' as any }
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.AND).toBeUndefined();
    });

    it('should use cursor for pagination', async () => {
      prisma.communicationEntry.findMany.mockResolvedValue([]);
      prisma.communicationEntry.count.mockResolvedValue(0);

      await service.getUnifiedTimeline(
        { caseId: mockCaseId },
        { cursor: 'entry-10' },
        mockUserContext
      );

      const findManyCall = prisma.communicationEntry.findMany.mock.calls[0][0];
      expect(findManyCall.where.id).toEqual({ lt: 'entry-10' });
    });
  });

  // ============================================================================
  // canViewCommunication Tests
  // ============================================================================

  describe('canViewCommunication', () => {
    it('should return false when entry not found', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ role: 'Partner', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when user is from different firm', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        firmId: mockFirmId,
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Partner', firmId: 'other-firm' });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(false);
    });

    it('should return true when user is the sender', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        senderId: mockUserId,
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Paralegal', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(true);
    });

    it('should return true for Partner on any entry', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'PartnerOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Partner', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(true);
    });

    it('should return true for Normal privacy level', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'Normal',
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Paralegal', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(true);
    });

    it('should return true for Confidential when user is in allowedViewers', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'Confidential',
        allowedViewers: [mockUserId],
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Paralegal', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(true);
    });

    it('should return false for Confidential when user is not in allowedViewers', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'Confidential',
        allowedViewers: ['other-user'],
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Paralegal', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(false);
    });

    it('should return true for AttorneyOnly when user is Associate', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'AttorneyOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Associate', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(true);
    });

    it('should return false for AttorneyOnly when user is Paralegal', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'AttorneyOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Paralegal', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(false);
    });

    it('should return false for PartnerOnly when user is Associate', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'PartnerOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Associate', firmId: mockFirmId });

      const result = await service.canViewCommunication(mockUserId, 'entry-1');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // syncEmailToCommunicationEntry Tests
  // ============================================================================

  describe('syncEmailToCommunicationEntry', () => {
    const mockEmail = {
      id: 'email-1',
      firmId: mockFirmId,
      caseId: mockCaseId,
      userId: mockUserId,
      graphMessageId: 'graph-msg-123',
      subject: 'Email Subject',
      bodyContent: 'Email body',
      bodyContentType: 'text',
      from: { name: 'John Doe', address: 'john@example.com' },
      toRecipients: [{ name: 'Jane', address: 'jane@example.com' }],
      ccRecipients: [],
      bccRecipients: [],
      hasAttachments: false,
      importance: 'Normal',
      isRead: true,
      conversationId: 'conv-1',
      internetMessageId: 'msg-1',
      sentDateTime: new Date(),
      attachments: [],
      user: { email: 'user@example.com' },
    };

    it('should return null when email not found', async () => {
      prisma.email.findUnique.mockResolvedValue(null);

      const result = await service.syncEmailToCommunicationEntry('nonexistent');

      expect(result).toBeNull();
    });

    it('should return existing entry if already synced', async () => {
      prisma.email.findUnique.mockResolvedValue(mockEmail);
      prisma.communicationEntry.findFirst.mockResolvedValue(mockCommunicationEntry);

      const result = await service.syncEmailToCommunicationEntry('email-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('entry-1');
      expect(prisma.communicationEntry.create).not.toHaveBeenCalled();
    });

    it('should create new entry when not already synced', async () => {
      prisma.email.findUnique.mockResolvedValue(mockEmail);
      prisma.communicationEntry.findFirst.mockResolvedValue(null);
      prisma.communicationEntry.create.mockResolvedValue({
        ...mockCommunicationEntry,
        externalId: mockEmail.graphMessageId,
      });

      const result = await service.syncEmailToCommunicationEntry('email-1');

      expect(result).toBeDefined();
      expect(prisma.communicationEntry.create).toHaveBeenCalled();
    });

    it('should set direction as Outbound when email is from user', async () => {
      const outboundEmail = {
        ...mockEmail,
        from: { name: 'User', address: 'user@example.com' },
        user: { email: 'user@example.com' },
      };
      prisma.email.findUnique.mockResolvedValue(outboundEmail);
      prisma.communicationEntry.findFirst.mockResolvedValue(null);
      prisma.communicationEntry.create.mockResolvedValue(mockCommunicationEntry);

      await service.syncEmailToCommunicationEntry('email-1');

      const createCall = prisma.communicationEntry.create.mock.calls[0][0];
      expect(createCall.data.direction).toBe('Outbound');
    });

    it('should set direction as Inbound when email is from external', async () => {
      prisma.email.findUnique.mockResolvedValue(mockEmail);
      prisma.communicationEntry.findFirst.mockResolvedValue(null);
      prisma.communicationEntry.create.mockResolvedValue(mockCommunicationEntry);

      await service.syncEmailToCommunicationEntry('email-1');

      const createCall = prisma.communicationEntry.create.mock.calls[0][0];
      expect(createCall.data.direction).toBe('Inbound');
    });
  });

  // ============================================================================
  // getCommunicationEntry Tests
  // ============================================================================

  describe('getCommunicationEntry', () => {
    it('should return null when user cannot view entry', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        privacyLevel: 'PartnerOnly',
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Paralegal', firmId: mockFirmId });

      const result = await service.getCommunicationEntry('entry-1', {
        ...mockUserContext,
        role: 'Paralegal' as any,
      });

      expect(result).toBeNull();
    });

    it('should return entry when user can view', async () => {
      prisma.communicationEntry.findUnique.mockResolvedValue({
        ...mockCommunicationEntry,
        children: [],
      });
      prisma.user.findUnique.mockResolvedValue({ role: 'Partner', firmId: mockFirmId });

      const result = await service.getCommunicationEntry('entry-1', mockUserContext);

      expect(result).toBeDefined();
      expect(result?.id).toBe('entry-1');
    });
  });
});
