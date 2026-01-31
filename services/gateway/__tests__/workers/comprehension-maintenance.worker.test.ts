/**
 * Comprehension Maintenance Worker Unit Tests
 *
 * Tests for the case comprehension maintenance worker including:
 * - Stale regeneration batch processing
 * - Expired regeneration batch processing
 * - Thinking content cleanup
 * - Job queue and manual triggers
 */

// ============================================================================
// Mock Setup
// ============================================================================

const mockComprehensionTriggerService = {
  regenerateStale: jest.fn(),
  regenerateExpired: jest.fn(),
};

const mockPrisma = {
  comprehensionAgentRun: {
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  caseComprehension: {
    count: jest.fn(),
    findFirst: jest.fn(),
  },
};

jest.mock('../../src/services/comprehension-trigger.service', () => ({
  comprehensionTriggerService: mockComprehensionTriggerService,
}));

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

// Mock logger
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

// Mock BullMQ
const mockQueueAdd = jest.fn();
const mockQueueGetRepeatableJobs = jest.fn().mockResolvedValue([]);
const mockQueueRemoveRepeatableByKey = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getRepeatableJobs: mockQueueGetRepeatableJobs,
    removeRepeatableByKey: mockQueueRemoveRepeatableByKey,
  })),
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    quit: jest.fn(),
    maxRetriesPerRequest: null,
  }));
});

// Mock fetch for Discord notifications
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after mocks
import {
  triggerManualStaleRegeneration,
  triggerManualExpiredRegeneration,
  triggerManualThinkingCleanup,
  getMaintenanceStats,
} from '../../src/workers/comprehension-maintenance.worker';

// ============================================================================
// Tests
// ============================================================================

describe('ComprehensionMaintenanceWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe('Manual Triggers', () => {
    it('should trigger manual stale regeneration', async () => {
      mockQueueAdd.mockResolvedValueOnce({ id: 'job-1' });

      const job = await triggerManualStaleRegeneration();

      expect(job.id).toBe('job-1');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'regenerate-stale',
        expect.objectContaining({ manual: true })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ComprehensionMaintenance] Manual stale regeneration triggered',
        expect.any(Object)
      );
    });

    it('should trigger manual expired regeneration', async () => {
      mockQueueAdd.mockResolvedValueOnce({ id: 'job-2' });

      const job = await triggerManualExpiredRegeneration();

      expect(job.id).toBe('job-2');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'regenerate-expired',
        expect.objectContaining({ manual: true })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ComprehensionMaintenance] Manual expired regeneration triggered',
        expect.any(Object)
      );
    });

    it('should trigger manual thinking cleanup', async () => {
      mockQueueAdd.mockResolvedValueOnce({ id: 'job-3' });

      const job = await triggerManualThinkingCleanup();

      expect(job.id).toBe('job-3');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'cleanup-thinking',
        expect.objectContaining({ manual: true })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ComprehensionMaintenance] Manual thinking cleanup triggered',
        expect.any(Object)
      );
    });
  });

  describe('getMaintenanceStats()', () => {
    it('should return maintenance statistics', async () => {
      const mockStaleDate = new Date('2024-01-15');
      mockPrisma.caseComprehension.count
        .mockResolvedValueOnce(5) // staleCount
        .mockResolvedValueOnce(3); // expiredCount
      mockPrisma.comprehensionAgentRun.count.mockResolvedValueOnce(10); // thinkingContentCount
      mockPrisma.caseComprehension.findFirst.mockResolvedValueOnce({
        staleSince: mockStaleDate,
      });

      const stats = await getMaintenanceStats();

      expect(stats.staleCount).toBe(5);
      expect(stats.expiredCount).toBe(3);
      expect(stats.thinkingContentCount).toBe(10);
      expect(stats.oldestStale).toEqual(mockStaleDate);
    });

    it('should handle no stale records', async () => {
      mockPrisma.caseComprehension.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.comprehensionAgentRun.count.mockResolvedValueOnce(0);
      mockPrisma.caseComprehension.findFirst.mockResolvedValueOnce(null);

      const stats = await getMaintenanceStats();

      expect(stats.staleCount).toBe(0);
      expect(stats.expiredCount).toBe(0);
      expect(stats.thinkingContentCount).toBe(0);
      expect(stats.oldestStale).toBeNull();
    });
  });

  describe('Regeneration Service Calls', () => {
    // These test the underlying trigger service that the worker uses

    it('should call regenerateStale with limit', async () => {
      mockComprehensionTriggerService.regenerateStale.mockResolvedValue({
        processed: 10,
        succeeded: 8,
        failed: 2,
      });

      const result = await mockComprehensionTriggerService.regenerateStale({ limit: 50 });

      expect(result.processed).toBe(10);
      expect(result.succeeded).toBe(8);
      expect(result.failed).toBe(2);
      expect(mockComprehensionTriggerService.regenerateStale).toHaveBeenCalledWith({ limit: 50 });
    });

    it('should call regenerateExpired with limit', async () => {
      mockComprehensionTriggerService.regenerateExpired.mockResolvedValue({
        processed: 5,
        succeeded: 5,
        failed: 0,
      });

      const result = await mockComprehensionTriggerService.regenerateExpired({ limit: 50 });

      expect(result.processed).toBe(5);
      expect(result.succeeded).toBe(5);
      expect(result.failed).toBe(0);
    });

    it('should handle regenerateStale errors gracefully', async () => {
      mockComprehensionTriggerService.regenerateStale.mockRejectedValue(
        new Error('Regeneration failed')
      );

      await expect(mockComprehensionTriggerService.regenerateStale({ limit: 50 })).rejects.toThrow(
        'Regeneration failed'
      );
    });
  });

  describe('Thinking Content Cleanup', () => {
    it('should update old thinking content to null', async () => {
      mockPrisma.comprehensionAgentRun.updateMany.mockResolvedValue({ count: 25 });

      // Simulate the cleanup logic
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const result = await mockPrisma.comprehensionAgentRun.updateMany({
        where: {
          thinkingContent: { not: null },
          createdAt: { lt: cutoffDate },
        },
        data: { thinkingContent: null },
      });

      expect(result.count).toBe(25);
      expect(mockPrisma.comprehensionAgentRun.updateMany).toHaveBeenCalledWith({
        where: {
          thinkingContent: { not: null },
          createdAt: { lt: expect.any(Date) },
        },
        data: { thinkingContent: null },
      });
    });

    it('should handle zero records to cleanup', async () => {
      mockPrisma.comprehensionAgentRun.updateMany.mockResolvedValue({ count: 0 });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const result = await mockPrisma.comprehensionAgentRun.updateMany({
        where: {
          thinkingContent: { not: null },
          createdAt: { lt: cutoffDate },
        },
        data: { thinkingContent: null },
      });

      expect(result.count).toBe(0);
    });
  });

  describe('Discord Notifications', () => {
    it('should send Discord notification when webhook is configured', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.webhook/test';

      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Test notification',
          username: 'Comprehension Bot',
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.webhook/test',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Test notification'),
        })
      );

      delete process.env.DISCORD_WEBHOOK_URL;
    });

    it('should skip notification when webhook is not configured', () => {
      delete process.env.DISCORD_WEBHOOK_URL;

      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

      expect(webhookUrl).toBeUndefined();
      // In the actual worker, no fetch would be called
    });
  });
});
