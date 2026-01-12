/**
 * Email Thread Service Tests
 * Story 5.2: Communication Intelligence Engine - Task 25
 *
 * Tests for email thread grouping and operations.
 */

import { EmailThreadService } from '../../src/services/email-thread.service';

// Create mock Prisma client with all methods the service uses
const createMockPrisma = () => ({
  email: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    groupBy: jest.fn(),
    updateMany: jest.fn(),
  },
  emailCaseLink: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  caseActor: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
});

// Sample email data factory
const createMockEmail = (overrides: Partial<any> = {}) => ({
  id: 'email-1',
  userId: 'user-1',
  graphMessageId: 'graph-msg-1',
  conversationId: 'conv-1',
  subject: 'Re: Contract Review',
  bodyPreview: 'Please review the attached...',
  bodyContent: '<p>Please review the attached contract.</p>',
  bodyContentType: 'html',
  from: { name: 'John Smith', address: 'john@example.com' },
  toRecipients: [{ name: 'Legal Team', address: 'legal@firm.com' }],
  ccRecipients: [],
  receivedDateTime: new Date('2024-12-10T10:00:00Z'),
  sentDateTime: new Date('2024-12-10T09:59:00Z'),
  hasAttachments: false,
  importance: 'normal',
  isRead: true,
  caseId: 'case-1',
  ...overrides,
});

describe('EmailThreadService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: EmailThreadService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new EmailThreadService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('groupEmailsIntoThreads', () => {
    it('should group emails by conversationId', () => {
      const emails = [
        createMockEmail({
          id: 'email-1',
          conversationId: 'conv-1',
          receivedDateTime: new Date('2024-12-10T10:00:00Z'),
        }),
        createMockEmail({
          id: 'email-2',
          conversationId: 'conv-1',
          receivedDateTime: new Date('2024-12-10T11:00:00Z'),
        }),
        createMockEmail({
          id: 'email-3',
          conversationId: 'conv-2',
          receivedDateTime: new Date('2024-12-10T09:00:00Z'),
        }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads).toHaveLength(2);

      const conv1Thread = threads.find((t) => t.conversationId === 'conv-1');
      const conv2Thread = threads.find((t) => t.conversationId === 'conv-2');

      expect(conv1Thread!.messageCount).toBe(2);
      expect(conv2Thread!.messageCount).toBe(1);
    });

    it('should sort emails within thread chronologically', () => {
      const emails = [
        createMockEmail({
          id: 'email-2',
          conversationId: 'conv-1',
          receivedDateTime: new Date('2024-12-10T12:00:00Z'),
        }),
        createMockEmail({
          id: 'email-1',
          conversationId: 'conv-1',
          receivedDateTime: new Date('2024-12-10T10:00:00Z'),
        }),
        createMockEmail({
          id: 'email-3',
          conversationId: 'conv-1',
          receivedDateTime: new Date('2024-12-10T14:00:00Z'),
        }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].emails).toHaveLength(3);
      expect(threads[0].emails[0].id).toBe('email-1'); // First by date
      expect(threads[0].emails[1].id).toBe('email-2');
      expect(threads[0].emails[2].id).toBe('email-3'); // Last by date
    });

    it('should sort threads by last message date (newest first)', () => {
      const emails = [
        createMockEmail({
          id: 'email-1',
          conversationId: 'conv-1',
          receivedDateTime: new Date('2024-12-09T10:00:00Z'),
        }),
        createMockEmail({
          id: 'email-2',
          conversationId: 'conv-2',
          receivedDateTime: new Date('2024-12-10T10:00:00Z'),
        }),
        createMockEmail({
          id: 'email-3',
          conversationId: 'conv-3',
          receivedDateTime: new Date('2024-12-08T10:00:00Z'),
        }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].conversationId).toBe('conv-2'); // Dec 10 - newest
      expect(threads[1].conversationId).toBe('conv-1'); // Dec 9
      expect(threads[2].conversationId).toBe('conv-3'); // Dec 8 - oldest
    });

    it('should count unique participants', () => {
      const emails = [
        createMockEmail({
          id: 'email-1',
          conversationId: 'conv-1',
          from: { name: 'Alice', address: 'alice@example.com' },
          toRecipients: [{ name: 'Bob', address: 'bob@example.com' }],
        }),
        createMockEmail({
          id: 'email-2',
          conversationId: 'conv-1',
          from: { name: 'Bob', address: 'bob@example.com' },
          toRecipients: [{ name: 'Alice', address: 'alice@example.com' }],
          ccRecipients: [{ name: 'Carol', address: 'carol@example.com' }],
        }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].participantCount).toBe(3); // Alice, Bob, Carol
    });

    it('should detect unread emails in thread', () => {
      const emails = [
        createMockEmail({ id: 'email-1', conversationId: 'conv-1', isRead: true }),
        createMockEmail({ id: 'email-2', conversationId: 'conv-1', isRead: false }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].hasUnread).toBe(true);
    });

    it('should detect attachments in thread', () => {
      const emails = [
        createMockEmail({ id: 'email-1', conversationId: 'conv-1', hasAttachments: false }),
        createMockEmail({ id: 'email-2', conversationId: 'conv-1', hasAttachments: true }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].hasAttachments).toBe(true);
    });

    it('should use first email subject (normalized) for thread', () => {
      const emails = [
        createMockEmail({
          id: 'email-1',
          conversationId: 'conv-1',
          subject: 'Contract Review',
          receivedDateTime: new Date('2024-12-10T10:00:00Z'),
        }),
        createMockEmail({
          id: 'email-2',
          conversationId: 'conv-1',
          subject: 'Re: Contract Review',
          receivedDateTime: new Date('2024-12-10T11:00:00Z'),
        }),
        createMockEmail({
          id: 'email-3',
          conversationId: 'conv-1',
          subject: 'RE: Contract Review',
          receivedDateTime: new Date('2024-12-10T12:00:00Z'),
        }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].subject).toBe('Contract Review');
    });

    it('should determine case ID from most common in thread', () => {
      const emails = [
        createMockEmail({ id: 'email-1', conversationId: 'conv-1', caseId: 'case-1' }),
        createMockEmail({ id: 'email-2', conversationId: 'conv-1', caseId: 'case-1' }),
        createMockEmail({ id: 'email-3', conversationId: 'conv-1', caseId: 'case-2' }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].caseId).toBe('case-1'); // Most common
    });
  });

  describe('getThread', () => {
    it('should retrieve single thread by conversationId', async () => {
      const emails = [
        createMockEmail({ id: 'email-1', conversationId: 'conv-1' }),
        createMockEmail({ id: 'email-2', conversationId: 'conv-1' }),
      ];

      mockPrisma.email.findMany.mockResolvedValue(emails);

      const thread = await service.getThread('conv-1', 'user-1');

      expect(thread).not.toBeNull();
      expect(thread!.conversationId).toBe('conv-1');
      expect(thread!.messageCount).toBe(2);
    });

    it('should return null for non-existent thread', async () => {
      mockPrisma.email.findMany.mockResolvedValue([]);

      const thread = await service.getThread('non-existent', 'user-1');

      expect(thread).toBeNull();
    });
  });

  describe('getThreadParticipants', () => {
    it('should extract all participants with roles', async () => {
      const emails = [
        createMockEmail({
          from: { name: 'Sender', address: 'sender@example.com' },
          toRecipients: [{ name: 'Recipient', address: 'recipient@example.com' }],
          ccRecipients: [{ name: 'CC Person', address: 'cc@example.com' }],
        }),
      ];

      mockPrisma.email.findMany.mockResolvedValue(emails);

      const participants = await service.getThreadParticipants('conv-1', 'user-1');

      expect(participants).toHaveLength(3);

      const sender = participants.find((p) => p.email === 'sender@example.com');
      expect(sender!.roles).toContain('sender');
      expect(sender!.messageCount).toBe(1);

      const recipient = participants.find((p) => p.email === 'recipient@example.com');
      expect(recipient!.roles).toContain('recipient');

      const ccPerson = participants.find((p) => p.email === 'cc@example.com');
      expect(ccPerson!.roles).toContain('cc');
    });

    it('should aggregate message counts for senders', async () => {
      const emails = [
        createMockEmail({
          id: 'email-1',
          from: { name: 'John', address: 'john@example.com' },
          toRecipients: [{ address: 'jane@example.com' }],
        }),
        createMockEmail({
          id: 'email-2',
          from: { name: 'John', address: 'john@example.com' },
          toRecipients: [{ address: 'jane@example.com' }],
        }),
        createMockEmail({
          id: 'email-3',
          from: { name: 'Jane', address: 'jane@example.com' },
          toRecipients: [{ address: 'john@example.com' }],
        }),
      ];

      mockPrisma.email.findMany.mockResolvedValue(emails);

      const participants = await service.getThreadParticipants('conv-1', 'user-1');

      const john = participants.find((p) => p.email === 'john@example.com');
      expect(john!.messageCount).toBe(2);

      const jane = participants.find((p) => p.email === 'jane@example.com');
      expect(jane!.messageCount).toBe(1);
    });
  });

  describe('assignThreadToCase', () => {
    it('should update all emails in thread to case and create links', async () => {
      // Mock getting emails in thread
      mockPrisma.email.findMany.mockResolvedValue([
        { id: 'email-1' },
        { id: 'email-2' },
      ]);
      // Mock emailCaseLink upsert
      mockPrisma.emailCaseLink.upsert.mockResolvedValue({});
      // Mock updating emails
      mockPrisma.email.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.assignThreadToCase('conv-1', 'case-1', 'user-1');

      expect(result.emailCount).toBe(2);
      expect(mockPrisma.emailCaseLink.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.email.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: 'conv-1', userId: 'user-1' },
          data: expect.objectContaining({ caseId: 'case-1' }),
        })
      );
    });
  });

  describe('markThreadAsRead', () => {
    it('should mark all emails in thread as read', async () => {
      mockPrisma.email.updateMany.mockResolvedValue({ count: 3 });

      const count = await service.markThreadAsRead('conv-1', 'user-1');

      expect(count).toBe(3);
      expect(mockPrisma.email.updateMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1', userId: 'user-1' },
        data: { isRead: true },
      });
    });
  });

  describe('getThreadStats', () => {
    it('should return thread statistics for user', async () => {
      mockPrisma.email.groupBy.mockResolvedValue([
        { conversationId: 'conv-1', caseId: 'case-1', _count: 3 },
        { conversationId: 'conv-2', caseId: 'case-1', _count: 2 },
        { conversationId: 'conv-3', caseId: null, _count: 1 },
      ]);
      mockPrisma.email.findMany.mockResolvedValue([
        { conversationId: 'conv-2' },
        { conversationId: 'conv-3' },
      ]);

      const stats = await service.getThreadStats('user-1');

      expect(stats.totalThreads).toBe(3);
      expect(stats.unreadThreads).toBe(2);
    });
  });

  describe('parseMessageHeaders', () => {
    it('should parse In-Reply-To header', () => {
      const headers = [{ name: 'In-Reply-To', value: '<original-message-id@example.com>' }];

      const result = service.parseMessageHeaders(headers);

      expect(result.inReplyTo).toBe('original-message-id@example.com');
    });

    it('should parse References header with multiple IDs', () => {
      const headers = [
        { name: 'References', value: '<msg1@example.com> <msg2@example.com> <msg3@example.com>' },
      ];

      const result = service.parseMessageHeaders(headers);

      expect(result.references).toHaveLength(3);
      expect(result.references).toContain('msg1@example.com');
      expect(result.references).toContain('msg2@example.com');
      expect(result.references).toContain('msg3@example.com');
    });

    it('should handle both headers together', () => {
      const headers = [
        { name: 'In-Reply-To', value: '<reply-to@example.com>' },
        { name: 'References', value: '<ref1@example.com> <ref2@example.com>' },
      ];

      const result = service.parseMessageHeaders(headers);

      expect(result.inReplyTo).toBe('reply-to@example.com');
      expect(result.references).toHaveLength(2);
    });

    it('should handle missing headers', () => {
      const headers: Array<{ name: string; value: string }> = [];

      const result = service.parseMessageHeaders(headers);

      expect(result.inReplyTo).toBeUndefined();
      expect(result.references).toHaveLength(0);
    });
  });

  describe('subject normalization', () => {
    it('should remove Re: prefix', () => {
      const emails = [
        createMockEmail({ subject: 'Re: Important Matter', conversationId: 'conv-1' }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].subject).toBe('Important Matter');
    });

    it('should remove Fwd: prefix', () => {
      const emails = [
        createMockEmail({ subject: 'Fwd: Important Matter', conversationId: 'conv-1' }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].subject).toBe('Important Matter');
    });

    it('should remove numbered Re prefixes', () => {
      const emails = [
        createMockEmail({ subject: 'Re[5]: Important Matter', conversationId: 'conv-1' }),
      ];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].subject).toBe('Important Matter');
    });

    it('should handle empty subject', () => {
      const emails = [createMockEmail({ subject: '', conversationId: 'conv-1' })];

      const threads = service.groupEmailsIntoThreads(emails as any);

      expect(threads[0].subject).toBe('(No Subject)');
    });

    it('should handle subject with only prefixes', () => {
      const emails = [createMockEmail({ subject: 'Re: ', conversationId: 'conv-1' })];

      const threads = service.groupEmailsIntoThreads(emails as any);

      // The regex removes one prefix at a time, so "Re: " becomes "(No Subject)"
      expect(threads[0].subject).toBe('(No Subject)');
    });
  });
});
