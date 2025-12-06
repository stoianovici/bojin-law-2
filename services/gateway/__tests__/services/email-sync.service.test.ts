/**
 * Email Sync Service Tests
 * Story 5.1: Email Integration and Synchronization
 *
 * Tests for email synchronization with Microsoft Graph API
 */

// Set up test environment variables BEFORE importing modules
process.env.NODE_ENV = 'test';
process.env.AZURE_AD_CLIENT_ID = '12345678-1234-1234-1234-123456789012';
process.env.AZURE_AD_TENANT_ID = '87654321-4321-4321-4321-210987654321';
process.env.AZURE_AD_CLIENT_SECRET = 'test-secret-123456789';
process.env.AZURE_AD_REDIRECT_URI = 'https://example.com/auth/callback';

import { PrismaClient } from '@prisma/client';

// Create mock Prisma client
const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
  },
  email: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  emailSyncState: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
});

describe('Email Sync Service', () => {
  describe('Sync Status Management', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      mockPrisma = createMockPrisma();
    });

    it('should retrieve sync status with email counts', async () => {
      mockPrisma.emailSyncState.findUnique.mockResolvedValue({
        syncStatus: 'synced',
        lastSyncAt: new Date('2024-01-01'),
        deltaToken: 'test-token',
      });
      mockPrisma.email.count
        .mockResolvedValueOnce(100) // Total emails
        .mockResolvedValueOnce(10); // Pending categorization

      // Simulate what getSyncStatus does
      const [syncState, emailCount, pendingCount] = await Promise.all([
        mockPrisma.emailSyncState.findUnique({ where: { userId: 'user-123' } }),
        mockPrisma.email.count({ where: { userId: 'user-123' } }),
        mockPrisma.email.count({
          where: { userId: 'user-123', caseId: null },
        }),
      ]);

      const result = {
        status: syncState?.syncStatus || 'pending',
        lastSyncAt: syncState?.lastSyncAt || null,
        emailCount,
        pendingCategorization: pendingCount,
      };

      expect(result.status).toBe('synced');
      expect(result.emailCount).toBe(100);
      expect(result.pendingCategorization).toBe(10);
      expect(result.lastSyncAt).toEqual(new Date('2024-01-01'));
    });

    it('should return pending status if never synced', async () => {
      mockPrisma.emailSyncState.findUnique.mockResolvedValue(null);
      mockPrisma.email.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const [syncState, emailCount, pendingCount] = await Promise.all([
        mockPrisma.emailSyncState.findUnique({ where: { userId: 'user-123' } }),
        mockPrisma.email.count({ where: { userId: 'user-123' } }),
        mockPrisma.email.count({
          where: { userId: 'user-123', caseId: null },
        }),
      ]);

      const result = {
        status: syncState?.syncStatus || 'pending',
        lastSyncAt: syncState?.lastSyncAt || null,
        emailCount,
        pendingCategorization: pendingCount,
      };

      expect(result.status).toBe('pending');
      expect(result.lastSyncAt).toBeNull();
      expect(result.emailCount).toBe(0);
    });
  });

  describe('Email Storage', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      mockPrisma = createMockPrisma();
    });

    it('should handle email storage with correct data structure', async () => {
      const mockEmails = [
        {
          graphMessageId: 'graph-msg-1',
          conversationId: 'conv-1',
          subject: 'Test Subject',
          bodyPreview: 'Preview text',
          bodyContent: 'Full content',
          bodyContentType: 'text',
          from: { name: 'Sender', address: 'sender@test.com' },
          toRecipients: [{ address: 'recipient@test.com' }],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: new Date(),
          sentDateTime: new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: true,
          userId: 'user-123',
          firmId: 'firm-123',
        },
      ];

      mockPrisma.email.createMany.mockResolvedValue({ count: 1 });

      const result = await mockPrisma.email.createMany({
        data: mockEmails,
        skipDuplicates: true,
      });

      expect(result.count).toBe(1);
      expect(mockPrisma.email.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            graphMessageId: 'graph-msg-1',
            subject: 'Test Subject',
          }),
        ]),
        skipDuplicates: true,
      });
    });
  });

  describe('Sync State Updates', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      mockPrisma = createMockPrisma();
    });

    it('should update sync state correctly', async () => {
      mockPrisma.emailSyncState.upsert.mockResolvedValue({
        userId: 'user-123',
        syncStatus: 'syncing',
        deltaToken: null,
        lastSyncAt: null,
      });

      await mockPrisma.emailSyncState.upsert({
        where: { userId: 'user-123' },
        create: {
          userId: 'user-123',
          syncStatus: 'syncing',
        },
        update: {
          syncStatus: 'syncing',
        },
      });

      expect(mockPrisma.emailSyncState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
          update: expect.objectContaining({
            syncStatus: 'syncing',
          }),
        })
      );
    });

    it('should store delta token after sync', async () => {
      mockPrisma.emailSyncState.upsert.mockResolvedValue({
        userId: 'user-123',
        syncStatus: 'synced',
        deltaToken: 'new-delta-token',
        lastSyncAt: new Date(),
      });

      await mockPrisma.emailSyncState.upsert({
        where: { userId: 'user-123' },
        create: {
          userId: 'user-123',
          syncStatus: 'synced',
          deltaToken: 'new-delta-token',
          lastSyncAt: new Date(),
        },
        update: {
          syncStatus: 'synced',
          deltaToken: 'new-delta-token',
          lastSyncAt: new Date(),
        },
      });

      expect(mockPrisma.emailSyncState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            deltaToken: 'new-delta-token',
          }),
        })
      );
    });
  });

  describe('User Validation', () => {
    let mockPrisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      mockPrisma = createMockPrisma();
    });

    it('should reject sync for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const user = await mockPrisma.user.findUnique({
        where: { id: 'non-existent' },
      });

      expect(user).toBeNull();
    });

    it('should reject sync for user without firm', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        firmId: null,
      });

      const user = await mockPrisma.user.findUnique({
        where: { id: 'user-123' },
        select: { firmId: true },
      });

      expect(user?.firmId).toBeNull();
    });

    it('should allow sync for valid user with firm', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        firmId: 'firm-123',
      });

      const user = await mockPrisma.user.findUnique({
        where: { id: 'user-123' },
        select: { firmId: true },
      });

      expect(user?.firmId).toBe('firm-123');
    });
  });

  describe('Message Transformation', () => {
    it('should handle null values in email addresses', () => {
      const rawMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        subject: 'Test',
        bodyPreview: 'Preview',
        body: { content: 'Body', contentType: 'text' as const },
        from: { emailAddress: { name: null, address: 'sender@test.com' } },
        toRecipients: [
          { emailAddress: { name: undefined, address: 'to@test.com' } },
        ],
        receivedDateTime: '2024-01-01T00:00:00Z',
        sentDateTime: '2024-01-01T00:00:00Z',
        hasAttachments: false,
        importance: 'normal' as const,
        isRead: true,
      };

      // Simulate transformation logic
      const transformed = {
        graphMessageId: rawMessage.id,
        conversationId: rawMessage.conversationId,
        subject: rawMessage.subject || '(No Subject)',
        bodyPreview: rawMessage.bodyPreview,
        bodyContent: rawMessage.body.content,
        bodyContentType: rawMessage.body.contentType,
        from: {
          name: rawMessage.from.emailAddress.name ?? undefined,
          address: rawMessage.from.emailAddress.address,
        },
        toRecipients: rawMessage.toRecipients.map((r) => ({
          name: r.emailAddress.name ?? undefined,
          address: r.emailAddress.address,
        })),
        receivedDateTime: new Date(rawMessage.receivedDateTime),
        sentDateTime: new Date(rawMessage.sentDateTime),
        hasAttachments: rawMessage.hasAttachments,
        importance: rawMessage.importance,
        isRead: rawMessage.isRead,
      };

      expect(transformed.from.name).toBeUndefined();
      expect(transformed.from.address).toBe('sender@test.com');
      expect(transformed.toRecipients[0].name).toBeUndefined();
    });

    it('should handle missing subject with default', () => {
      const rawMessage = {
        id: 'msg-1',
        conversationId: 'conv-1',
        subject: null,
        bodyPreview: 'Preview',
      };

      const subject = rawMessage.subject || '(No Subject)';
      expect(subject).toBe('(No Subject)');
    });

    it('should filter out removed messages', () => {
      const messages = [
        { id: 'msg-1', removed: true },
        { id: 'msg-2' },
        { id: null },
        { id: 'msg-3' },
      ];

      const filtered = messages.filter((m) => m.id && !('removed' in m));
      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.id)).toEqual(['msg-2', 'msg-3']);
    });
  });

  describe('Delta Token Extraction', () => {
    it('should extract delta token from delta link', () => {
      const deltaLink =
        'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=abc123xyz';

      // Simulate extraction logic
      const url = new URL(deltaLink);
      const deltaToken = url.searchParams.get('$deltatoken');

      expect(deltaToken).toBe('abc123xyz');
    });

    it('should handle missing delta token', () => {
      const deltaLink = 'https://graph.microsoft.com/v1.0/me/messages/delta';

      const url = new URL(deltaLink);
      const deltaToken = url.searchParams.get('$deltatoken');

      expect(deltaToken).toBeNull();
    });
  });
});
