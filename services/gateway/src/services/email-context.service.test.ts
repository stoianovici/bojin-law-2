/**
 * Email Context Service Tests
 * OPS-259: Email Thread Summary Aggregation Service
 */

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    threadSummary: {
      findMany: jest.fn(),
    },
    email: {
      findMany: jest.fn(),
    },
  },
}));

import { EmailContextService } from './email-context.service';
import { prisma } from '@legal-platform/database';
import { subDays } from 'date-fns';

describe('EmailContextService', () => {
  // Use relative dates to ensure tests work regardless of current date
  const recentDate1 = subDays(new Date(), 5);
  const recentDate2 = subDays(new Date(), 3);
  let service: EmailContextService;
  const testCaseId = 'case-123';
  const testFirmId = 'firm-456';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailContextService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getForCase', () => {
    it('should return empty context when no thread summaries exist', async () => {
      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result.threads).toEqual([]);
      expect(result.pendingActionItems).toEqual([]);
      expect(result.unreadCount).toBe(0);
      expect(result.urgentCount).toBe(0);
    });

    it('should return formatted thread summaries with email metadata', async () => {
      const mockThreadSummaries = [
        {
          id: 'ts-1',
          conversationId: 'conv-1',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Discuție despre termen amânat',
          keyPoints: ['Termenul a fost amânat cu 2 săptămâni'],
          actionItems: ['Depune cerere nouă', 'Anunță clientul'],
          sentiment: 'neutral',
          participants: ['avocat@firma.ro', 'client@example.com'],
          messageCount: 5,
          lastAnalyzedAt: recentDate1,
        },
        {
          id: 'ts-2',
          conversationId: 'conv-2',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Notificare urgentă de la instanță',
          keyPoints: ['Termen de 3 zile pentru răspuns'],
          actionItems: ['Pregătește răspuns urgent'],
          sentiment: 'urgent',
          participants: ['instanta@just.ro'],
          messageCount: 2,
          lastAnalyzedAt: recentDate2,
        },
      ];

      const mockEmails = [
        {
          conversationId: 'conv-1',
          subject: 'Re: Amânare termen',
          isRead: true,
          receivedDateTime: recentDate1,
        },
        {
          conversationId: 'conv-2',
          subject: 'Citație urgentă',
          isRead: false,
          receivedDateTime: recentDate2,
        },
      ];

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce(mockEmails);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result.threads).toHaveLength(2);
      expect(result.threads[0].subject).toBe('Re: Amânare termen');
      expect(result.threads[0].summary).toBe('Discuție despre termen amânat');
      expect(result.threads[0].isUrgent).toBe(false);
      expect(result.threads[0].isUnread).toBe(false);
      expect(result.threads[1].subject).toBe('Citație urgentă');
      expect(result.threads[1].isUrgent).toBe(true);
      expect(result.threads[1].isUnread).toBe(true);
    });

    it('should aggregate action items across threads', async () => {
      const mockThreadSummaries = [
        {
          id: 'ts-1',
          conversationId: 'conv-1',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Thread 1',
          actionItems: ['Item 1', 'Item 2'],
          sentiment: 'neutral',
          participants: [],
          lastAnalyzedAt: new Date(),
        },
        {
          id: 'ts-2',
          conversationId: 'conv-2',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Thread 2',
          actionItems: ['Item 3', 'Item 4', 'Item 5', 'Item 6'],
          sentiment: 'neutral',
          participants: [],
          lastAnalyzedAt: new Date(),
        },
      ];

      const mockEmails = [
        { conversationId: 'conv-1', subject: 'S1', isRead: true, receivedDateTime: new Date() },
        { conversationId: 'conv-2', subject: 'S2', isRead: true, receivedDateTime: new Date() },
      ];

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce(mockEmails);

      const result = await service.getForCase(testCaseId, testFirmId);

      // Should aggregate and limit to 5 action items max
      expect(result.pendingActionItems).toHaveLength(5);
      expect(result.pendingActionItems).toContain('Item 1');
      expect(result.pendingActionItems).toContain('Item 5');
    });

    it('should count unread and urgent threads correctly', async () => {
      const mockThreadSummaries = [
        {
          id: 'ts-1',
          conversationId: 'conv-1',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'O1',
          actionItems: [],
          sentiment: 'urgent',
          participants: [],
          lastAnalyzedAt: new Date(),
        },
        {
          id: 'ts-2',
          conversationId: 'conv-2',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'O2',
          actionItems: [],
          sentiment: 'urgent',
          participants: [],
          lastAnalyzedAt: new Date(),
        },
        {
          id: 'ts-3',
          conversationId: 'conv-3',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'O3',
          actionItems: [],
          sentiment: 'neutral',
          participants: [],
          lastAnalyzedAt: new Date(),
        },
      ];

      const mockEmails = [
        { conversationId: 'conv-1', subject: 'S1', isRead: false, receivedDateTime: new Date() },
        { conversationId: 'conv-2', subject: 'S2', isRead: false, receivedDateTime: new Date() },
        { conversationId: 'conv-3', subject: 'S3', isRead: true, receivedDateTime: new Date() },
      ];

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce(mockEmails);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result.unreadCount).toBe(2);
      expect(result.urgentCount).toBe(2);
    });

    it('should limit threads to maximum of 8', async () => {
      const mockThreadSummaries = Array.from({ length: 15 }, (_, i) => ({
        id: `ts-${i}`,
        conversationId: `conv-${i}`,
        caseId: testCaseId,
        firmId: testFirmId,
        overview: `Overview ${i}`,
        actionItems: [],
        sentiment: 'neutral',
        participants: [],
        lastAnalyzedAt: new Date(),
      }));

      const mockEmails = Array.from({ length: 15 }, (_, i) => ({
        conversationId: `conv-${i}`,
        subject: `Subject ${i}`,
        isRead: true,
        receivedDateTime: new Date(),
      }));

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce(mockEmails);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result.threads).toHaveLength(8);
    });

    it('should handle threads without matching emails gracefully', async () => {
      const mockThreadSummaries = [
        {
          id: 'ts-1',
          conversationId: 'conv-orphan',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Orphan thread',
          actionItems: [],
          sentiment: 'neutral',
          participants: [],
          lastAnalyzedAt: new Date('2024-10-01'), // Older than 30 days
        },
      ];

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce([]); // No emails

      const result = await service.getForCase(testCaseId, testFirmId);

      // Thread should be filtered out due to no recent email
      expect(result.threads).toHaveLength(0);
    });

    it('should parse JSON action items stored as strings', async () => {
      const mockThreadSummaries = [
        {
          id: 'ts-1',
          conversationId: 'conv-1',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Test',
          actionItems: '["Action 1", "Action 2"]', // JSON string
          sentiment: 'neutral',
          participants: '["user@example.com"]', // JSON string
          lastAnalyzedAt: new Date(),
        },
      ];

      const mockEmails = [
        { conversationId: 'conv-1', subject: 'S1', isRead: true, receivedDateTime: new Date() },
      ];

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce(mockEmails);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result.threads[0].actionItems).toEqual(['Action 1', 'Action 2']);
      expect(result.threads[0].participants).toEqual(['user@example.com']);
    });

    it('should handle null/undefined JSON fields gracefully', async () => {
      const mockThreadSummaries = [
        {
          id: 'ts-1',
          conversationId: 'conv-1',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Test',
          actionItems: null,
          sentiment: 'neutral',
          participants: undefined,
          lastAnalyzedAt: new Date(),
        },
      ];

      const mockEmails = [
        { conversationId: 'conv-1', subject: 'S1', isRead: true, receivedDateTime: new Date() },
      ];

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce(mockEmails);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result.threads[0].actionItems).toEqual([]);
      expect(result.threads[0].participants).toEqual([]);
    });

    it('should limit participants to 3 per thread', async () => {
      const mockThreadSummaries = [
        {
          id: 'ts-1',
          conversationId: 'conv-1',
          caseId: testCaseId,
          firmId: testFirmId,
          overview: 'Test',
          actionItems: [],
          sentiment: 'neutral',
          participants: ['a@a.com', 'b@b.com', 'c@c.com', 'd@d.com', 'e@e.com'],
          lastAnalyzedAt: new Date(),
        },
      ];

      const mockEmails = [
        { conversationId: 'conv-1', subject: 'S1', isRead: true, receivedDateTime: new Date() },
      ];

      (prisma.threadSummary.findMany as jest.Mock).mockResolvedValueOnce(mockThreadSummaries);
      (prisma.email.findMany as jest.Mock).mockResolvedValueOnce(mockEmails);

      const result = await service.getForCase(testCaseId, testFirmId);

      expect(result.threads[0].participants).toHaveLength(3);
      expect(result.threads[0].participants).toEqual(['a@a.com', 'b@b.com', 'c@c.com']);
    });
  });

  describe('formatForPrompt', () => {
    it('should format context with threads and action items', () => {
      const context = {
        threads: [
          {
            threadId: 'conv-1',
            subject: 'Urgent: Court Notice',
            participants: ['instanta@just.ro'],
            summary: 'Notificare privind termen de 3 zile',
            actionItems: ['Răspunde urgent'],
            lastMessageAt: '2024-12-21T09:00:00Z',
            isUrgent: true,
            isUnread: true,
          },
          {
            threadId: 'conv-2',
            subject: 'Re: Contract review',
            participants: ['client@example.com', 'avocat@firma.ro'],
            summary: 'Client a acceptat modificările propuse',
            actionItems: [],
            lastMessageAt: '2024-12-20T15:00:00Z',
            isUrgent: false,
            isUnread: false,
          },
        ],
        pendingActionItems: ['Răspunde urgent', 'Finalizează documentația'],
        unreadCount: 1,
        urgentCount: 1,
      };

      const result = service.formatForPrompt(context);

      expect(result).toContain('Corespondență (2 fire recente)');
      expect(result).toContain('1 necitite');
      expect(result).toContain('1 urgente');
      expect(result).toContain('Urgent: Court Notice');
      expect(result).toContain('Notificare privind termen de 3 zile');
      expect(result).toContain('Acțiuni din emailuri');
      expect(result).toContain('Răspunde urgent');
    });

    it('should show unread and urgent indicators', () => {
      const context = {
        threads: [
          {
            threadId: 'conv-1',
            subject: 'Urgent Notice',
            participants: [],
            summary: 'Important message',
            actionItems: [],
            lastMessageAt: '2024-12-21T09:00:00Z',
            isUrgent: true,
            isUnread: true,
          },
        ],
        pendingActionItems: [],
        unreadCount: 1,
        urgentCount: 1,
      };

      const result = service.formatForPrompt(context);

      expect(result).toContain('●'); // unread indicator
      expect(result).toContain('⚠️'); // urgent indicator
    });

    it('should limit formatted threads to 6', () => {
      const context = {
        threads: Array.from({ length: 8 }, (_, i) => ({
          threadId: `conv-${i}`,
          subject: `Subject ${i}`,
          participants: [],
          summary: `Summary ${i}`,
          actionItems: [],
          lastMessageAt: '2024-12-21T09:00:00Z',
          isUrgent: false,
          isUnread: false,
        })),
        pendingActionItems: [],
        unreadCount: 0,
        urgentCount: 0,
      };

      const result = service.formatForPrompt(context);

      // Should only include 6 subjects in output (token budget)
      expect((result.match(/Subject \d/g) || []).length).toBe(6);
    });

    it('should handle empty context gracefully', () => {
      const context = {
        threads: [],
        pendingActionItems: [],
        unreadCount: 0,
        urgentCount: 0,
      };

      const result = service.formatForPrompt(context);

      expect(result).toContain('Corespondență (0 fire recente)');
      expect(result).not.toContain('necitite');
      expect(result).not.toContain('urgente');
      expect(result).not.toContain('Acțiuni din emailuri');
    });
  });
});
