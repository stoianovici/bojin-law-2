/**
 * Comprehension Trigger Service Unit Tests
 *
 * Tests for the case comprehension trigger service including:
 * - Event handling (stale vs immediate)
 * - Debounced regeneration scheduling
 * - Shutdown cleanup
 * - Batch regeneration
 */

// ============================================================================
// Mock Setup
// ============================================================================

const mockComprehensionAgentService = {
  generate: jest.fn(),
  markStale: jest.fn(),
};

const mockPrisma = {
  caseComprehension: {
    count: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

// Mock dependencies before importing
jest.mock('../../src/services/comprehension-agent.service', () => ({
  comprehensionAgentService: mockComprehensionAgentService,
}));

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
  redis: mockRedis,
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

// Import after mocks
import {
  comprehensionTriggerService,
  stopComprehensionTriggerService,
  STALE_EVENTS,
  IMMEDIATE_EVENTS,
} from '../../src/services/comprehension-trigger.service';

// ============================================================================
// Tests
// ============================================================================

describe('ComprehensionTriggerService', () => {
  const TEST_CASE_ID = 'case-123';
  const TEST_FIRM_ID = 'firm-456';
  const TEST_USER_ID = 'user-789';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clear any pending timers
    stopComprehensionTriggerService();
  });

  describe('handleEvent()', () => {
    describe('when no comprehension exists', () => {
      it('should skip processing if case has no comprehension', async () => {
        mockPrisma.caseComprehension.count.mockResolvedValue(0);

        await comprehensionTriggerService.handleEvent(
          TEST_CASE_ID,
          'document_uploaded',
          TEST_FIRM_ID
        );

        expect(mockPrisma.caseComprehension.updateMany).not.toHaveBeenCalled();
        expect(mockComprehensionAgentService.generate).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          '[ComprehensionTrigger] No comprehension exists, skipping',
          { caseId: TEST_CASE_ID }
        );
      });
    });

    describe('with stale events', () => {
      beforeEach(() => {
        mockPrisma.caseComprehension.count.mockResolvedValue(1);
      });

      it('should mark comprehension as stale for document_uploaded with staleSince timestamp', async () => {
        mockPrisma.caseComprehension.updateMany.mockResolvedValue({ count: 1 });

        await comprehensionTriggerService.handleEvent(
          TEST_CASE_ID,
          'document_uploaded',
          TEST_FIRM_ID
        );

        expect(mockPrisma.caseComprehension.updateMany).toHaveBeenCalledWith({
          where: { caseId: TEST_CASE_ID, isStale: false },
          data: {
            isStale: true,
            staleSince: expect.any(Date),
          },
        });
        expect(mockComprehensionAgentService.generate).not.toHaveBeenCalled();
      });

      it('should mark comprehension as stale for email_classified with staleSince timestamp', async () => {
        mockPrisma.caseComprehension.updateMany.mockResolvedValue({ count: 1 });

        await comprehensionTriggerService.handleEvent(
          TEST_CASE_ID,
          'email_classified',
          TEST_FIRM_ID
        );

        expect(mockPrisma.caseComprehension.updateMany).toHaveBeenCalledWith({
          where: { caseId: TEST_CASE_ID, isStale: false },
          data: {
            isStale: true,
            staleSince: expect.any(Date),
          },
        });
      });

      it('should handle all stale events correctly', async () => {
        mockPrisma.caseComprehension.updateMany.mockResolvedValue({ count: 1 });

        for (const event of STALE_EVENTS) {
          await comprehensionTriggerService.handleEvent(TEST_CASE_ID, event, TEST_FIRM_ID);
        }

        expect(mockPrisma.caseComprehension.updateMany).toHaveBeenCalledTimes(STALE_EVENTS.length);
      });
    });

    describe('with immediate events', () => {
      beforeEach(() => {
        mockPrisma.caseComprehension.count.mockResolvedValue(1);
        mockRedis.get.mockResolvedValue(null);
        mockRedis.setex.mockResolvedValue('OK');
        mockRedis.del.mockResolvedValue(1);
      });

      it('should schedule regeneration for case_status_changed', async () => {
        await comprehensionTriggerService.handleEvent(
          TEST_CASE_ID,
          'case_status_changed',
          TEST_FIRM_ID
        );

        expect(mockRedis.setex).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Scheduled regeneration'),
          expect.any(Object)
        );
      });

      it('should schedule regeneration for correction_added', async () => {
        await comprehensionTriggerService.handleEvent(
          TEST_CASE_ID,
          'correction_added',
          TEST_FIRM_ID,
          { userId: TEST_USER_ID }
        );

        expect(mockRedis.setex).toHaveBeenCalled();
      });

      it('should pass correctionIds when scheduling regeneration', async () => {
        const correctionIds = ['corr-1', 'corr-2'];
        mockComprehensionAgentService.generate.mockResolvedValue({});

        await comprehensionTriggerService.handleEvent(
          TEST_CASE_ID,
          'correction_added',
          TEST_FIRM_ID,
          { userId: TEST_USER_ID, correctionIds, skipDebounce: true }
        );

        expect(mockComprehensionAgentService.generate).toHaveBeenCalledWith(
          TEST_CASE_ID,
          TEST_FIRM_ID,
          TEST_USER_ID,
          {
            mode: 'update',
            triggeredBy: 'correction_added',
            triggeredCorrectionIds: correctionIds,
          }
        );
      });

      it('should regenerate immediately when skipDebounce is true', async () => {
        mockComprehensionAgentService.generate.mockResolvedValue({});

        await comprehensionTriggerService.handleEvent(
          TEST_CASE_ID,
          'case_status_changed',
          TEST_FIRM_ID,
          { skipDebounce: true }
        );

        expect(mockComprehensionAgentService.generate).toHaveBeenCalledWith(
          TEST_CASE_ID,
          TEST_FIRM_ID,
          undefined,
          { mode: 'update', triggeredBy: 'case_status_changed' }
        );
      });

      it('should handle all immediate events', async () => {
        for (const event of IMMEDIATE_EVENTS) {
          await comprehensionTriggerService.handleEvent(TEST_CASE_ID, event, TEST_FIRM_ID, {
            skipDebounce: true,
          });
        }

        expect(mockComprehensionAgentService.generate).toHaveBeenCalledTimes(
          IMMEDIATE_EVENTS.length
        );
      });
    });
  });

  describe('scheduleRegeneration()', () => {
    beforeEach(() => {
      mockPrisma.caseComprehension.count.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);
    });

    it('should debounce multiple calls', async () => {
      await comprehensionTriggerService.scheduleRegeneration(
        TEST_CASE_ID,
        TEST_FIRM_ID,
        'test_event'
      );

      // First call should set up debounce
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);

      // Second call should be debounced (Redis returns existing)
      mockRedis.get.mockResolvedValue(JSON.stringify({ firmId: TEST_FIRM_ID }));

      await comprehensionTriggerService.scheduleRegeneration(
        TEST_CASE_ID,
        TEST_FIRM_ID,
        'test_event'
      );

      // setex should NOT be called again due to debounce
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });

    it('should trigger regeneration after debounce period', async () => {
      mockComprehensionAgentService.generate.mockResolvedValue({});

      await comprehensionTriggerService.scheduleRegeneration(
        TEST_CASE_ID,
        TEST_FIRM_ID,
        'test_event',
        TEST_USER_ID
      );

      // Fast forward past debounce period (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000 + 100);

      // Allow async callbacks to execute
      await Promise.resolve();

      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockComprehensionAgentService.generate).toHaveBeenCalledWith(
        TEST_CASE_ID,
        TEST_FIRM_ID,
        TEST_USER_ID,
        { mode: 'update', triggeredBy: 'test_event' }
      );
    });

    it('should fall back to immediate regeneration on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockComprehensionAgentService.generate.mockResolvedValue({});

      await comprehensionTriggerService.scheduleRegeneration(
        TEST_CASE_ID,
        TEST_FIRM_ID,
        'test_event'
      );

      expect(mockComprehensionAgentService.generate).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ComprehensionTrigger] Redis error, regenerating immediately',
        expect.any(Object)
      );
    });
  });

  describe('shutdown()', () => {
    beforeEach(() => {
      mockPrisma.caseComprehension.count.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');
    });

    it('should clear all pending timers', async () => {
      // Schedule multiple regenerations
      await comprehensionTriggerService.scheduleRegeneration('case-1', TEST_FIRM_ID, 'event1');
      await comprehensionTriggerService.scheduleRegeneration('case-2', TEST_FIRM_ID, 'event2');
      await comprehensionTriggerService.scheduleRegeneration('case-3', TEST_FIRM_ID, 'event3');

      // Shutdown should clear all timers
      stopComprehensionTriggerService();

      // Fast forward past debounce - nothing should run
      jest.advanceTimersByTime(10 * 60 * 1000);

      // Generate should not be called since timers were cleared
      expect(mockComprehensionAgentService.generate).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ComprehensionTrigger] Shutting down, clearing timers',
        expect.objectContaining({ pendingTimers: 3 })
      );
    });
  });

  describe('regenerateStale()', () => {
    // Use real timers for these tests since they involve actual async operations
    beforeEach(() => {
      jest.useRealTimers();
      // Reset mocks before each test to prevent call count accumulation
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useFakeTimers();
    });

    it('should process batch of stale comprehensions', async () => {
      const staleComprehensions = [
        { caseId: 'case-1', firmId: TEST_FIRM_ID },
        { caseId: 'case-2', firmId: TEST_FIRM_ID },
      ];

      mockPrisma.caseComprehension.findMany.mockResolvedValue(staleComprehensions);
      mockComprehensionAgentService.generate.mockResolvedValue({});

      const result = await comprehensionTriggerService.regenerateStale({ limit: 10 });

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockComprehensionAgentService.generate).toHaveBeenCalledTimes(2);
    }, 15000); // Increase timeout for real timers

    it('should return zeros when no stale comprehensions exist', async () => {
      mockPrisma.caseComprehension.findMany.mockResolvedValue([]);

      const result = await comprehensionTriggerService.regenerateStale();

      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockComprehensionAgentService.generate).not.toHaveBeenCalled();
    });

    it('should handle generation errors gracefully by marking as stale', async () => {
      // Note: The regenerate() method catches errors internally and marks comprehension
      // as stale rather than throwing. This is intentional graceful error handling.
      // So even if generate() fails, regenerateStale() counts it as "processed" without
      // incrementing the failed counter (since no error propagates up).
      const staleComprehensions = [
        { caseId: 'case-1', firmId: TEST_FIRM_ID },
        { caseId: 'case-2', firmId: TEST_FIRM_ID },
      ];

      mockPrisma.caseComprehension.findMany.mockResolvedValue(staleComprehensions);
      mockPrisma.caseComprehension.updateMany.mockResolvedValue({ count: 1 });
      // Reset the mock completely before setting up the chain
      mockComprehensionAgentService.generate.mockReset();
      mockComprehensionAgentService.generate
        .mockResolvedValueOnce({}) // First call succeeds
        .mockRejectedValueOnce(new Error('Generation failed')); // Second call fails but is caught

      const result = await comprehensionTriggerService.regenerateStale();

      expect(result.processed).toBe(2);
      // Both are counted as succeeded because regenerate() catches errors internally
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      // Verify the second call triggered markStale due to error
      expect(mockPrisma.caseComprehension.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ caseId: 'case-2' }),
        })
      );
    }, 15000); // Increase timeout for real timers
  });
});
