/**
 * AI Feature Config Service Tests
 * OPS-234: Feature Configuration Data Model & Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AIFeatureConfigService,
  AI_FEATURES,
  type AIFeatureKey,
} from './ai-feature-config.service';

// Mock dependencies
vi.mock('@legal-platform/database', () => ({
  prisma: {
    aIFeatureConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    aITokenUsage: {
      aggregate: vi.fn(),
    },
  },
  cacheManager: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    invalidate: vi.fn(),
  },
}));

import { prisma, cacheManager } from '@legal-platform/database';

const mockPrisma = prisma as any;
const mockCacheManager = cacheManager as any;

describe('AIFeatureConfigService', () => {
  let service: AIFeatureConfigService;
  const testFirmId = 'firm-123';
  const testUserId = 'user-456';

  beforeEach(() => {
    service = new AIFeatureConfigService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('AI_FEATURES constant', () => {
    it('should have all expected features defined', () => {
      // Request-time features
      expect(AI_FEATURES.assistant_chat).toBeDefined();
      expect(AI_FEATURES.email_classification).toBeDefined();
      expect(AI_FEATURES.email_drafting).toBeDefined();
      expect(AI_FEATURES.document_extraction).toBeDefined();

      // Batch features
      expect(AI_FEATURES.search_index).toBeDefined();
      expect(AI_FEATURES.morning_briefings).toBeDefined();
      expect(AI_FEATURES.case_health).toBeDefined();
      expect(AI_FEATURES.thread_summaries).toBeDefined();
    });

    it('should have correct types for features', () => {
      expect(AI_FEATURES.assistant_chat.type).toBe('request');
      expect(AI_FEATURES.search_index.type).toBe('batch');
    });

    it('should have default schedules for batch features', () => {
      expect((AI_FEATURES.search_index as any).defaultSchedule).toBe('0 3,11,13,15 * * *');
      expect((AI_FEATURES.morning_briefings as any).defaultSchedule).toBe('0 5,11,13,15 * * *');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return cached value if exists', async () => {
      mockCacheManager.get.mockResolvedValueOnce(true);

      const result = await service.isFeatureEnabled(testFirmId, 'assistant_chat');

      expect(result).toBe(true);
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        `ai-feature-config:${testFirmId}:assistant_chat:enabled`
      );
      expect(mockPrisma.aIFeatureConfig.findUnique).not.toHaveBeenCalled();
    });

    it('should query DB and cache result if not cached', async () => {
      mockCacheManager.get.mockResolvedValueOnce(null);
      mockPrisma.aIFeatureConfig.findUnique.mockResolvedValueOnce({
        id: 'config-1',
        firmId: testFirmId,
        feature: 'assistant_chat',
        enabled: true,
        monthlyBudgetEur: null,
        dailyLimitEur: null,
        schedule: null,
        updatedAt: new Date(),
        updatedBy: 'system',
      });

      const result = await service.isFeatureEnabled(testFirmId, 'assistant_chat');

      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `ai-feature-config:${testFirmId}:assistant_chat:enabled`,
        true,
        300
      );
    });

    it('should seed default config if not exists', async () => {
      mockCacheManager.get.mockResolvedValueOnce(null);
      mockPrisma.aIFeatureConfig.findUnique.mockResolvedValueOnce(null);
      mockPrisma.aIFeatureConfig.create.mockResolvedValueOnce({
        id: 'config-1',
        firmId: testFirmId,
        feature: 'assistant_chat',
        enabled: true,
        monthlyBudgetEur: null,
        dailyLimitEur: null,
        schedule: null,
        updatedAt: new Date(),
        updatedBy: 'system',
      });

      const result = await service.isFeatureEnabled(testFirmId, 'assistant_chat');

      expect(result).toBe(true);
      expect(mockPrisma.aIFeatureConfig.create).toHaveBeenCalled();
    });
  });

  describe('getFeatureConfig', () => {
    it('should return existing config', async () => {
      const mockConfig = {
        id: 'config-1',
        firmId: testFirmId,
        feature: 'search_index',
        enabled: true,
        monthlyBudgetEur: { toNumber: () => 50 },
        dailyLimitEur: { toNumber: () => 5 },
        schedule: '0 3,11,13,15 * * *',
        updatedAt: new Date(),
        updatedBy: testUserId,
      };

      mockPrisma.aIFeatureConfig.findUnique.mockResolvedValueOnce(mockConfig);

      const result = await service.getFeatureConfig(testFirmId, 'search_index');

      expect(result.feature).toBe('search_index');
      expect(result.enabled).toBe(true);
      expect(result.schedule).toBe('0 3,11,13,15 * * *');
    });

    it('should seed default for batch feature with schedule', async () => {
      mockPrisma.aIFeatureConfig.findUnique.mockResolvedValueOnce(null);
      mockPrisma.aIFeatureConfig.create.mockResolvedValueOnce({
        id: 'config-1',
        firmId: testFirmId,
        feature: 'search_index',
        enabled: true,
        monthlyBudgetEur: null,
        dailyLimitEur: null,
        schedule: '0 3,11,13,15 * * *',
        updatedAt: new Date(),
        updatedBy: 'system',
      });

      const result = await service.getFeatureConfig(testFirmId, 'search_index');

      expect(mockPrisma.aIFeatureConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firmId: testFirmId,
          feature: 'search_index',
          enabled: true,
          schedule: '0 3,11,13,15 * * *',
          updatedBy: 'system',
        }),
      });
      expect(result.schedule).toBe('0 3,11,13,15 * * *');
    });
  });

  describe('updateFeatureConfig', () => {
    it('should update existing config', async () => {
      const mockUpdated = {
        id: 'config-1',
        firmId: testFirmId,
        feature: 'assistant_chat',
        enabled: false,
        monthlyBudgetEur: { toNumber: () => 100 },
        dailyLimitEur: null,
        schedule: null,
        updatedAt: new Date(),
        updatedBy: testUserId,
      };

      mockPrisma.aIFeatureConfig.upsert.mockResolvedValueOnce(mockUpdated);
      mockCacheManager.delete.mockResolvedValueOnce(undefined);

      const result = await service.updateFeatureConfig(
        testFirmId,
        'assistant_chat',
        { enabled: false, monthlyBudgetEur: 100 },
        testUserId
      );

      expect(result.enabled).toBe(false);
      expect(mockPrisma.aIFeatureConfig.upsert).toHaveBeenCalled();
      expect(mockCacheManager.delete).toHaveBeenCalled();
    });

    it('should throw for invalid feature', async () => {
      await expect(
        service.updateFeatureConfig(testFirmId, 'invalid_feature' as AIFeatureKey, {}, testUserId)
      ).rejects.toThrow('Invalid feature');
    });
  });

  describe('toggleFeature', () => {
    it('should toggle feature enabled state', async () => {
      const mockToggled = {
        id: 'config-1',
        firmId: testFirmId,
        feature: 'email_classification',
        enabled: false,
        monthlyBudgetEur: null,
        dailyLimitEur: null,
        schedule: null,
        updatedAt: new Date(),
        updatedBy: testUserId,
      };

      mockPrisma.aIFeatureConfig.upsert.mockResolvedValueOnce(mockToggled);
      mockCacheManager.delete.mockResolvedValueOnce(undefined);

      const result = await service.toggleFeature(
        testFirmId,
        'email_classification',
        false,
        testUserId
      );

      expect(result.enabled).toBe(false);
    });
  });

  describe('getFeatureBudgetStatus', () => {
    it('should calculate budget status correctly', async () => {
      // Use a real number-like object that works with Number()
      const mockConfig = {
        id: 'config-1',
        firmId: testFirmId,
        feature: 'assistant_chat',
        enabled: true,
        monthlyBudgetEur: 50, // Prisma Decimal converts to number
        dailyLimitEur: 5,
        schedule: null,
        updatedAt: new Date(),
        updatedBy: testUserId,
      };

      mockPrisma.aIFeatureConfig.findUnique.mockResolvedValueOnce(mockConfig);

      // Monthly spending: 2500 cents = 25 EUR
      mockPrisma.aITokenUsage.aggregate.mockResolvedValueOnce({
        _sum: { costCents: 2500 },
      });
      // Daily spending: 200 cents = 2 EUR
      mockPrisma.aITokenUsage.aggregate.mockResolvedValueOnce({
        _sum: { costCents: 200 },
      });

      const result = await service.getFeatureBudgetStatus(testFirmId, 'assistant_chat');

      expect(result.feature).toBe('assistant_chat');
      expect(result.enabled).toBe(true);
      expect(result.monthlyBudgetEur).toBe(50);
      expect(result.dailyLimitEur).toBe(5);
      expect(result.spentThisMonthEur).toBe(25);
      expect(result.spentTodayEur).toBe(2);
      expect(result.remainingMonthlyEur).toBe(25);
      expect(result.remainingDailyEur).toBe(3);
      expect(result.isOverMonthlyBudget).toBe(false);
      expect(result.isOverDailyLimit).toBe(false);
    });

    it('should detect over-budget correctly', async () => {
      const mockConfig = {
        id: 'config-1',
        firmId: testFirmId,
        feature: 'assistant_chat',
        enabled: true,
        monthlyBudgetEur: 10,
        dailyLimitEur: 1,
        schedule: null,
        updatedAt: new Date(),
        updatedBy: testUserId,
      };

      mockPrisma.aIFeatureConfig.findUnique.mockResolvedValueOnce(mockConfig);

      // Over monthly budget: 1500 cents = 15 EUR (budget is 10)
      mockPrisma.aITokenUsage.aggregate.mockResolvedValueOnce({
        _sum: { costCents: 1500 },
      });
      // Over daily limit: 200 cents = 2 EUR (limit is 1)
      mockPrisma.aITokenUsage.aggregate.mockResolvedValueOnce({
        _sum: { costCents: 200 },
      });

      const result = await service.getFeatureBudgetStatus(testFirmId, 'assistant_chat');

      expect(result.isOverMonthlyBudget).toBe(true);
      expect(result.isOverDailyLimit).toBe(true);
    });
  });

  describe('getAllFeatures', () => {
    it('should return all features for firm', async () => {
      const mockConfigs = Object.keys(AI_FEATURES).map((feature) => ({
        id: `config-${feature}`,
        firmId: testFirmId,
        feature,
        enabled: true,
        monthlyBudgetEur: null,
        dailyLimitEur: null,
        schedule: null,
        updatedAt: new Date(),
        updatedBy: 'system',
      }));

      mockPrisma.aIFeatureConfig.findMany.mockResolvedValueOnce(
        mockConfigs.map((c) => ({ feature: c.feature }))
      );
      mockPrisma.aIFeatureConfig.findMany.mockResolvedValueOnce(mockConfigs);

      const result = await service.getAllFeatures(testFirmId);

      expect(result.length).toBe(Object.keys(AI_FEATURES).length);
    });
  });

  describe('getBatchFeatures', () => {
    it('should return only batch features', async () => {
      const batchFeatures = [
        'search_index',
        'morning_briefings',
        'case_health',
        'thread_summaries',
      ];
      const mockConfigs = Object.keys(AI_FEATURES).map((feature) => ({
        id: `config-${feature}`,
        firmId: testFirmId,
        feature,
        enabled: true,
        monthlyBudgetEur: null,
        dailyLimitEur: null,
        schedule:
          AI_FEATURES[feature as AIFeatureKey].type === 'batch'
            ? (AI_FEATURES[feature as AIFeatureKey] as any).defaultSchedule
            : null,
        updatedAt: new Date(),
        updatedBy: 'system',
      }));

      mockPrisma.aIFeatureConfig.findMany.mockResolvedValueOnce(
        mockConfigs.map((c) => ({ feature: c.feature }))
      );
      mockPrisma.aIFeatureConfig.findMany.mockResolvedValueOnce(mockConfigs);

      const result = await service.getBatchFeatures(testFirmId);

      expect(result.length).toBe(4);
      result.forEach((config) => {
        expect(batchFeatures).toContain(config.feature);
        expect(AI_FEATURES[config.feature].type).toBe('batch');
      });
    });
  });
});
