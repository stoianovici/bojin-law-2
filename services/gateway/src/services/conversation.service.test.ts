/**
 * Conversation Service Unit Tests
 * OPS-065: Conversation Service
 *
 * Tests for AI conversation CRUD operations with firm isolation
 */

import { ConversationService } from './conversation.service';

// Mock Prisma client
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
  },
}));

const { prisma } = jest.requireMock('@legal-platform/database');

describe('ConversationService', () => {
  let service: ConversationService;

  const mockFirmId = 'firm-123';
  const mockUserId = 'user-456';
  const mockCaseId = 'case-789';
  const mockConversationId = 'conv-001';
  const mockMessageId = 'msg-001';

  const mockUserContext = {
    userId: mockUserId,
    firmId: mockFirmId,
  };

  const mockConversation = {
    id: mockConversationId,
    firmId: mockFirmId,
    userId: mockUserId,
    caseId: null,
    status: 'Active',
    context: {},
    createdAt: new Date('2025-12-20T10:00:00Z'),
    updatedAt: new Date('2025-12-20T10:00:00Z'),
    closedAt: null,
  };

  const mockConversationWithCase = {
    ...mockConversation,
    caseId: mockCaseId,
  };

  const mockMessage = {
    id: mockMessageId,
    conversationId: mockConversationId,
    role: 'User',
    content: 'Test message',
    intent: null,
    confidence: null,
    actionType: null,
    actionPayload: null,
    actionStatus: null,
    tokensUsed: null,
    modelUsed: null,
    latencyMs: null,
    createdAt: new Date('2025-12-20T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationService();
  });

  // ============================================================================
  // getOrCreateConversation Tests
  // ============================================================================

  describe('getOrCreateConversation', () => {
    it('should return existing active conversation if one exists', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateConversation(mockUserContext);

      expect(result.id).toBe(mockConversationId);
      expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith({
        where: {
          firmId: mockFirmId,
          userId: mockUserId,
          caseId: null,
          status: 'Active',
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(prisma.aIConversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if none exists', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);
      prisma.aIConversation.create.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateConversation(mockUserContext);

      expect(result.id).toBe(mockConversationId);
      expect(prisma.aIConversation.create).toHaveBeenCalledWith({
        data: {
          firmId: mockFirmId,
          userId: mockUserId,
          caseId: null,
          status: 'Active',
          context: {},
        },
      });
    });

    it('should find conversation by case context', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversationWithCase);

      await service.getOrCreateConversation(mockUserContext, mockCaseId);

      expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith({
        where: {
          firmId: mockFirmId,
          userId: mockUserId,
          caseId: mockCaseId,
          status: 'Active',
        },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should create case-specific conversation when not found', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);
      prisma.aIConversation.create.mockResolvedValue(mockConversationWithCase);

      await service.getOrCreateConversation(mockUserContext, mockCaseId);

      expect(prisma.aIConversation.create).toHaveBeenCalledWith({
        data: {
          firmId: mockFirmId,
          userId: mockUserId,
          caseId: mockCaseId,
          status: 'Active',
          context: {},
        },
      });
    });
  });

  // ============================================================================
  // getConversation Tests
  // ============================================================================

  describe('getConversation', () => {
    it('should return conversation with messages', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue({
        ...mockConversation,
        messages: [mockMessage],
      });

      const result = await service.getConversation(mockConversationId, mockFirmId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockConversationId);
      expect(result!.messages).toHaveLength(1);
    });

    it('should return null for non-existent conversation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);

      const result = await service.getConversation('nonexistent', mockFirmId);

      expect(result).toBeNull();
    });

    it('should enforce firm isolation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);

      await service.getConversation(mockConversationId, 'other-firm');

      expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockConversationId,
          firmId: 'other-firm',
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    it('should order messages oldest first', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue({
        ...mockConversation,
        messages: [],
      });

      await service.getConversation(mockConversationId, mockFirmId);

      expect(prisma.aIConversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      );
    });
  });

  // ============================================================================
  // addMessage Tests
  // ============================================================================

  describe('addMessage', () => {
    it('should add message to conversation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIMessage.create.mockResolvedValue(mockMessage);
      prisma.aIConversation.update.mockResolvedValue({
        ...mockConversation,
        updatedAt: new Date(),
      });

      const result = await service.addMessage(
        mockConversationId,
        {
          role: 'User' as any,
          content: 'Test message',
        },
        mockFirmId
      );

      expect(result.content).toBe('Test message');
      expect(prisma.aIMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: mockConversationId,
          role: 'User',
          content: 'Test message',
        }),
      });
    });

    it('should update conversation timestamp', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIMessage.create.mockResolvedValue(mockMessage);
      prisma.aIConversation.update.mockResolvedValue(mockConversation);

      await service.addMessage(
        mockConversationId,
        { role: 'User' as any, content: 'Test' },
        mockFirmId
      );

      expect(prisma.aIConversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: { updatedAt: expect.any(Date) },
      });
    });

    it('should throw error for non-existent conversation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);

      await expect(
        service.addMessage('nonexistent', { role: 'User' as any, content: 'Test' }, mockFirmId)
      ).rejects.toThrow('Conversation not found');
    });

    it('should include optional fields when provided', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIMessage.create.mockResolvedValue({
        ...mockMessage,
        intent: 'CreateTask',
        confidence: 0.95,
        actionType: 'create_task',
        actionPayload: { title: 'Test task' },
        actionStatus: 'Proposed',
        tokensUsed: 150,
        modelUsed: 'haiku',
        latencyMs: 250,
      });
      prisma.aIConversation.update.mockResolvedValue(mockConversation);

      await service.addMessage(
        mockConversationId,
        {
          role: 'Assistant' as any,
          content: 'Created task',
          intent: 'CreateTask',
          confidence: 0.95,
          actionType: 'create_task',
          actionPayload: { title: 'Test task' },
          actionStatus: 'Proposed' as any,
          tokensUsed: 150,
          modelUsed: 'haiku',
          latencyMs: 250,
        },
        mockFirmId
      );

      expect(prisma.aIMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          intent: 'CreateTask',
          confidence: 0.95,
          actionType: 'create_task',
          tokensUsed: 150,
        }),
      });
    });
  });

  // ============================================================================
  // updateStatus Tests
  // ============================================================================

  describe('updateStatus', () => {
    it('should update conversation status', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIConversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'AwaitingConfirmation',
      });

      const result = await service.updateStatus(
        mockConversationId,
        'AwaitingConfirmation' as any,
        mockFirmId
      );

      expect(result.status).toBe('AwaitingConfirmation');
    });

    it('should set closedAt when status is Completed', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIConversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'Completed',
        closedAt: new Date(),
      });

      await service.updateStatus(mockConversationId, 'Completed' as any, mockFirmId);

      expect(prisma.aIConversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: {
          status: 'Completed',
          closedAt: expect.any(Date),
        },
      });
    });

    it('should set closedAt when status is Expired', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIConversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'Expired',
        closedAt: new Date(),
      });

      await service.updateStatus(mockConversationId, 'Expired' as any, mockFirmId);

      expect(prisma.aIConversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: {
          status: 'Expired',
          closedAt: expect.any(Date),
        },
      });
    });

    it('should throw error for non-existent conversation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'Completed' as any, mockFirmId)
      ).rejects.toThrow('Conversation not found');
    });
  });

  // ============================================================================
  // updateMessageActionStatus Tests
  // ============================================================================

  describe('updateMessageActionStatus', () => {
    it('should update message action status', async () => {
      prisma.aIMessage.findUnique.mockResolvedValue({
        ...mockMessage,
        conversation: mockConversation,
      });
      prisma.aIMessage.update.mockResolvedValue({
        ...mockMessage,
        actionStatus: 'Confirmed',
      });

      const result = await service.updateMessageActionStatus(
        mockMessageId,
        'Confirmed' as any,
        mockFirmId
      );

      expect(result.actionStatus).toBe('Confirmed');
    });

    it('should throw error for message in different firm', async () => {
      prisma.aIMessage.findUnique.mockResolvedValue({
        ...mockMessage,
        conversation: { ...mockConversation, firmId: 'other-firm' },
      });

      await expect(
        service.updateMessageActionStatus(mockMessageId, 'Confirmed' as any, mockFirmId)
      ).rejects.toThrow('Message not found');
    });

    it('should throw error for non-existent message', async () => {
      prisma.aIMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMessageActionStatus('nonexistent', 'Confirmed' as any, mockFirmId)
      ).rejects.toThrow('Message not found');
    });
  });

  // ============================================================================
  // closeConversation Tests
  // ============================================================================

  describe('closeConversation', () => {
    it('should close conversation and set closedAt', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(mockConversation);
      prisma.aIConversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'Completed',
        closedAt: new Date(),
      });

      const result = await service.closeConversation(mockConversationId, mockFirmId);

      expect(result.status).toBe('Completed');
      expect(result.closedAt).toBeDefined();
    });

    it('should throw error for non-existent conversation', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue(null);

      await expect(service.closeConversation('nonexistent', mockFirmId)).rejects.toThrow(
        'Conversation not found'
      );
    });
  });

  // ============================================================================
  // getHistory Tests
  // ============================================================================

  describe('getHistory', () => {
    it('should return conversation history', async () => {
      prisma.aIConversation.findMany.mockResolvedValue([mockConversation]);

      const result = await service.getHistory(mockUserContext, 10);

      expect(result).toHaveLength(1);
      expect(prisma.aIConversation.findMany).toHaveBeenCalledWith({
        where: {
          firmId: mockFirmId,
          userId: mockUserId,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
    });

    it('should filter by case when provided', async () => {
      prisma.aIConversation.findMany.mockResolvedValue([mockConversationWithCase]);

      await service.getHistory(mockUserContext, 10, mockCaseId);

      expect(prisma.aIConversation.findMany).toHaveBeenCalledWith({
        where: {
          firmId: mockFirmId,
          userId: mockUserId,
          caseId: mockCaseId,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
    });

    it('should respect limit parameter', async () => {
      prisma.aIConversation.findMany.mockResolvedValue([]);

      await service.getHistory(mockUserContext, 5);

      expect(prisma.aIConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });
  });

  // ============================================================================
  // expireStaleConversations Tests
  // ============================================================================

  describe('expireStaleConversations', () => {
    it('should expire conversations older than 24 hours', async () => {
      prisma.aIConversation.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.expireStaleConversations();

      expect(result).toBe(3);
      expect(prisma.aIConversation.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'Active',
          updatedAt: { lt: expect.any(Date) },
        },
        data: {
          status: 'Expired',
          closedAt: expect.any(Date),
        },
      });
    });

    it('should return 0 when no conversations to expire', async () => {
      prisma.aIConversation.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.expireStaleConversations();

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // getActiveConversationCount Tests
  // ============================================================================

  describe('getActiveConversationCount', () => {
    it('should return count of active conversations', async () => {
      prisma.aIConversation.count.mockResolvedValue(5);

      const result = await service.getActiveConversationCount(mockUserContext);

      expect(result).toBe(5);
      expect(prisma.aIConversation.count).toHaveBeenCalledWith({
        where: {
          firmId: mockFirmId,
          userId: mockUserId,
          status: 'Active',
        },
      });
    });
  });

  // ============================================================================
  // getConversationWithCase Tests
  // ============================================================================

  describe('getConversationWithCase', () => {
    it('should return conversation with case details', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue({
        ...mockConversationWithCase,
        messages: [mockMessage],
        case: {
          id: mockCaseId,
          caseNumber: 'CASE-001',
          title: 'Test Case',
        },
      });

      const result = await service.getConversationWithCase(mockConversationId, mockFirmId);

      expect(result).not.toBeNull();
      expect(result!.case).toBeDefined();
      expect(result!.case!.caseNumber).toBe('CASE-001');
    });

    it('should return conversation without case when not linked', async () => {
      prisma.aIConversation.findFirst.mockResolvedValue({
        ...mockConversation,
        messages: [mockMessage],
        case: null,
      });

      const result = await service.getConversationWithCase(mockConversationId, mockFirmId);

      expect(result).not.toBeNull();
      expect(result!.case).toBeNull();
    });
  });
});
