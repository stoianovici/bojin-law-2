/**
 * Firm Briefing Resolvers Tests
 * Tests authorization, rate limiting, and concurrent refresh protection.
 */

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    firmBriefing: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
  redis: {
    set: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
    zadd: jest.fn(),
    zremrangebyscore: jest.fn(),
    zcard: jest.fn(),
    expire: jest.fn(),
    multi: jest.fn(() => ({
      zremrangebyscore: jest.fn().mockReturnThis(),
      zcard: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 0],
        [null, 0],
        [null, 1],
        [null, 1],
      ]),
    })),
  },
}));

jest.mock('../../services/firm-operations-agent.service', () => ({
  firmOperationsAgentService: {
    getOrGenerate: jest.fn(),
    generate: jest.fn(),
    markViewed: jest.fn(),
  },
}));

jest.mock('../../services/firm-operations-context.service', () => ({
  isBriefingEligible: jest.fn(),
}));

jest.mock('../../services/firm-briefing-followup.service', () => ({
  firmBriefingFollowupService: {
    askFollowUp: jest.fn(),
  },
}));

import { redis } from '@legal-platform/database';
import { firmBriefingQueries, firmBriefingMutations } from './firm-briefing.resolvers';
import { firmOperationsAgentService } from '../../services/firm-operations-agent.service';
import { firmBriefingFollowupService } from '../../services/firm-briefing-followup.service';
import { isBriefingEligible } from '../../services/firm-operations-context.service';

describe('FirmBriefingResolvers', () => {
  const partnerContext = {
    user: {
      id: 'user-partner',
      firmId: 'firm-123',
      role: 'Partner' as const,
      email: 'partner@firm.com',
    },
  };

  const associateContext = {
    user: {
      id: 'user-associate',
      firmId: 'firm-123',
      role: 'Associate' as const,
      email: 'associate@firm.com',
    },
  };

  const noAuthContext = {
    user: undefined,
  };

  const mockBriefingResult = {
    id: 'briefing-123',
    edition: {
      date: new Date().toISOString().split('T')[0],
      mood: 'steady',
      editorNote: 'Test edition',
    },
    lead: [
      {
        id: 'lead-1',
        headline: 'Test headline',
        summary: 'Test summary',
        details: [],
        category: 'case',
        canAskFollowUp: true,
      },
    ],
    secondary: {
      title: 'Secondary',
      items: [],
    },
    tertiary: {
      title: 'Tertiary',
      items: [],
    },
    quickStats: {
      activeCases: 10,
      urgentTasks: 2,
      teamUtilization: 75,
      unreadEmails: 5,
      overdueItems: 1,
      upcomingDeadlines: 3,
    },
    totalTokens: 500,
    totalCostEur: 0.05,
    isStale: false,
    isViewed: false,
    generatedAt: new Date(),
    schemaVersion: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env.ENABLE_FIRM_BRIEFING = 'true';
  });

  // ============================================================================
  // Authentication Tests
  // ============================================================================

  describe('Authentication', () => {
    it('firmBriefing query should reject unauthenticated requests', async () => {
      await expect(firmBriefingQueries.firmBriefing(null, null, noAuthContext)).rejects.toThrow(
        'Authentication required'
      );
    });

    it('generateFirmBriefing mutation should reject unauthenticated requests', async () => {
      await expect(
        firmBriefingMutations.generateFirmBriefing(null, {}, noAuthContext)
      ).rejects.toThrow('Authentication required');
    });

    it('markFirmBriefingViewed mutation should reject unauthenticated requests', async () => {
      await expect(
        firmBriefingMutations.markFirmBriefingViewed(null, { briefingId: 'test' }, noAuthContext)
      ).rejects.toThrow('Authentication required');
    });
  });

  // ============================================================================
  // Feature Flag Tests
  // ============================================================================

  describe('Feature Flag', () => {
    it('firmBriefing query should return null when feature is disabled', async () => {
      process.env.ENABLE_FIRM_BRIEFING = 'false';
      // Re-import to pick up new env var
      jest.resetModules();
      const { firmBriefingQueries: reloadedQueries } = require('./firm-briefing.resolvers');

      const result = await reloadedQueries.firmBriefing(null, null, partnerContext);

      expect(result).toBeNull();
      expect(firmOperationsAgentService.getOrGenerate).not.toHaveBeenCalled();
    });

    it('firmBriefingEligibility should return not eligible when feature is disabled', async () => {
      process.env.ENABLE_FIRM_BRIEFING = 'false';
      jest.resetModules();
      const { firmBriefingQueries: reloadedQueries } = require('./firm-briefing.resolvers');

      const result = await reloadedQueries.firmBriefingEligibility(null, null, partnerContext);

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not enabled');
    });

    it('generateFirmBriefing should throw when feature is disabled', async () => {
      process.env.ENABLE_FIRM_BRIEFING = 'false';
      jest.resetModules();
      const { firmBriefingMutations: reloadedMutations } = require('./firm-briefing.resolvers');

      await expect(
        reloadedMutations.generateFirmBriefing(null, {}, partnerContext)
      ).rejects.toThrow('not enabled');
    });
  });

  // ============================================================================
  // Query Tests
  // ============================================================================

  describe('firmBriefing Query', () => {
    it('should return briefing data for authenticated partner', async () => {
      (firmOperationsAgentService.getOrGenerate as jest.Mock).mockResolvedValueOnce(
        mockBriefingResult
      );

      const result = await firmBriefingQueries.firmBriefing(null, null, partnerContext);

      expect(result).toBeDefined();
      expect(result.id).toBe('briefing-123');
      expect(firmOperationsAgentService.getOrGenerate).toHaveBeenCalledWith(
        'user-partner',
        'firm-123'
      );
    });

    it('should return null when no briefing exists', async () => {
      (firmOperationsAgentService.getOrGenerate as jest.Mock).mockResolvedValueOnce(null);

      const result = await firmBriefingQueries.firmBriefing(null, null, partnerContext);

      expect(result).toBeNull();
    });
  });

  describe('firmBriefingEligibility Query', () => {
    it('should return eligible for partners', async () => {
      (isBriefingEligible as jest.Mock).mockResolvedValueOnce({ eligible: true });

      const result = await firmBriefingQueries.firmBriefingEligibility(null, null, partnerContext);

      expect(result.eligible).toBe(true);
      expect(isBriefingEligible).toHaveBeenCalledWith('user-partner', 'firm-123');
    });

    it('should return not eligible for non-partners', async () => {
      (isBriefingEligible as jest.Mock).mockResolvedValueOnce({
        eligible: false,
        reason: 'Only for partners',
      });

      const result = await firmBriefingQueries.firmBriefingEligibility(
        null,
        null,
        associateContext
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Only for partners');
    });
  });

  // ============================================================================
  // Mutation Tests
  // ============================================================================

  describe('generateFirmBriefing Mutation', () => {
    beforeEach(() => {
      // Reset module to pick up env var
      process.env.ENABLE_FIRM_BRIEFING = 'true';
      jest.resetModules();
    });

    it('should generate briefing for authenticated partner', async () => {
      // Two-phase locking: 1) acquire short lock, 2) check in-progress flag, 3) set in-progress
      (redis.set as jest.Mock).mockResolvedValueOnce('OK'); // Short lock acquired
      (redis.get as jest.Mock).mockResolvedValueOnce(null); // No in-progress flag
      (redis.setex as jest.Mock).mockResolvedValueOnce('OK'); // Set in-progress flag
      (firmOperationsAgentService.generate as jest.Mock).mockResolvedValueOnce(mockBriefingResult);

      const result = await firmBriefingMutations.generateFirmBriefing(
        null,
        { force: false },
        partnerContext
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('briefing-123');
      expect(firmOperationsAgentService.generate).toHaveBeenCalledWith('user-partner', 'firm-123', {
        force: false,
      });
    });

    it('should release lock after generation', async () => {
      (redis.set as jest.Mock).mockResolvedValueOnce('OK');
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (redis.setex as jest.Mock).mockResolvedValueOnce('OK');
      (firmOperationsAgentService.generate as jest.Mock).mockResolvedValueOnce(mockBriefingResult);

      await firmBriefingMutations.generateFirmBriefing(null, { force: false }, partnerContext);

      // Should clear in-progress flag after generation
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('in_progress'));
    });

    it('should release lock even on error', async () => {
      (redis.set as jest.Mock).mockResolvedValueOnce('OK');
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (redis.setex as jest.Mock).mockResolvedValueOnce('OK');
      (firmOperationsAgentService.generate as jest.Mock).mockRejectedValueOnce(
        new Error('Generation failed')
      );

      await expect(
        firmBriefingMutations.generateFirmBriefing(null, { force: false }, partnerContext)
      ).rejects.toThrow('Generation failed');

      // Should clear in-progress flag even on error
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('in_progress'));
    });

    it('should reject concurrent refresh when lock not acquired', async () => {
      (redis.set as jest.Mock).mockResolvedValueOnce(null); // Lock not acquired (already held)

      await expect(
        firmBriefingMutations.generateFirmBriefing(null, { force: false }, partnerContext)
      ).rejects.toThrow('se genereaza'); // Romanian error message
    });

    it('should reject when generation already in progress', async () => {
      // Short lock acquired, but in-progress flag exists
      (redis.set as jest.Mock).mockResolvedValueOnce('OK');
      (redis.get as jest.Mock).mockResolvedValueOnce('12345'); // In-progress flag exists

      await expect(
        firmBriefingMutations.generateFirmBriefing(null, { force: false }, partnerContext)
      ).rejects.toThrow('se genereaza');
    });
  });

  describe('markFirmBriefingViewed Mutation', () => {
    it('should mark briefing as viewed', async () => {
      (firmOperationsAgentService.markViewed as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await firmBriefingMutations.markFirmBriefingViewed(
        null,
        { briefingId: 'briefing-123' },
        partnerContext
      );

      expect(result).toBe(true);
      expect(firmOperationsAgentService.markViewed).toHaveBeenCalledWith(
        'briefing-123',
        'user-partner'
      );
    });
  });

  describe('askBriefingFollowUp Mutation', () => {
    it('should call follow-up service with sanitized input', async () => {
      const mockResult = {
        answer: 'Test answer about the client',
        suggestedActions: [{ label: 'View details', href: '/clients/client-123' }],
      };
      (firmBriefingFollowupService.askFollowUp as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await firmBriefingMutations.askBriefingFollowUp(
        null,
        {
          input: {
            briefingItemId: 'item-1',
            question: 'Tell me more about this client',
            entityType: 'CLIENT',
            entityId: 'client-123',
          },
        },
        partnerContext
      );

      expect(result.answer).toBe('Test answer about the client');
      expect(result.suggestedActions).toHaveLength(1);
      expect(firmBriefingFollowupService.askFollowUp).toHaveBeenCalledWith(
        'item-1',
        'Tell me more about this client',
        'client',
        'client-123',
        'user-partner',
        'firm-123'
      );
    });

    it('should reject empty questions', async () => {
      await expect(
        firmBriefingMutations.askBriefingFollowUp(
          null,
          {
            input: {
              briefingItemId: 'item-1',
              question: '   ', // Empty after trim
              entityType: 'CLIENT',
              entityId: 'client-123',
            },
          },
          partnerContext
        )
      ).rejects.toThrow('goală');
    });

    it('should reject invalid briefing item IDs', async () => {
      await expect(
        firmBriefingMutations.askBriefingFollowUp(
          null,
          {
            input: {
              briefingItemId: 'invalid/id/with/slashes',
              question: 'Valid question',
              entityType: 'CLIENT',
              entityId: 'client-123',
            },
          },
          partnerContext
        )
      ).rejects.toThrow('invalid');
    });

    it('should sanitize questions with HTML tags', async () => {
      const mockResult = {
        answer: 'Safe answer',
        suggestedActions: [],
      };
      (firmBriefingFollowupService.askFollowUp as jest.Mock).mockResolvedValueOnce(mockResult);

      await firmBriefingMutations.askBriefingFollowUp(
        null,
        {
          input: {
            briefingItemId: 'item-1',
            question: '<script>alert("xss")</script>What about this case?',
            entityType: 'CASE',
            entityId: 'case-123',
          },
        },
        partnerContext
      );

      // Verify the sanitized question was passed (no HTML tags)
      expect(firmBriefingFollowupService.askFollowUp).toHaveBeenCalledWith(
        'item-1',
        expect.not.stringContaining('<script>'),
        'case',
        'case-123',
        'user-partner',
        'firm-123'
      );
    });
  });
});
