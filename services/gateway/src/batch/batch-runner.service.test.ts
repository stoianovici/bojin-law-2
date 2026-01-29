/**
 * Batch Runner Service Tests
 * OPS-236: Batch Job Runner Framework
 */

import { BatchRunnerService } from './batch-runner.service';
import type {
  BatchProcessor,
  BatchProcessorResult,
  BatchProcessorContext,
} from './batch-processor.interface';

// Mock dependencies
jest.mock('@legal-platform/database', () => ({
  prisma: {
    firm: {
      findMany: jest.fn(),
    },
    aIBatchJobRun: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../services/ai-client.service', () => ({
  aiClient: {
    startBatchJob: jest.fn(),
    completeBatchJob: jest.fn(),
  },
  getModelForFeature: jest.fn().mockResolvedValue('claude-3-haiku-20240307'),
}));

jest.mock('../services/anthropic-batch.service', () => ({
  anthropicBatchService: {
    submitBatch: jest.fn(),
    waitForCompletion: jest.fn(),
    retrieveResults: jest.fn(),
    cancelBatch: jest.fn(),
  },
}));

jest.mock('./batch-metrics', () => ({
  batchMetrics: {
    recordJobStart: jest.fn(),
    recordJobEnd: jest.fn(),
    recordJobCompletion: jest.fn(),
  },
}));

jest.mock('./batch-utils', () => ({
  formatBatchErrors: (errors: string[]) => (errors.length > 0 ? errors.join('; ') : undefined),
}));

jest.mock('../services/ai-feature-config.service', () => ({
  aiFeatureConfigService: {
    isFeatureEnabled: jest.fn(),
    getBatchFeatures: jest.fn(),
  },
}));

// Import mocked modules
import { prisma } from '@legal-platform/database';
import { aiClient } from '../services/ai-client.service';
import { aiFeatureConfigService } from '../services/ai-feature-config.service';

// ============================================================================
// Mock Processor
// ============================================================================

class MockProcessor implements BatchProcessor {
  readonly name = 'Mock Processor';
  readonly feature = 'mock_feature';

  processResult: BatchProcessorResult = {
    itemsProcessed: 5,
    itemsFailed: 0,
    totalTokens: 1000,
    totalCost: 0.01,
  };

  shouldThrow = false;

  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    if (this.shouldThrow) {
      throw new Error('Mock processor error');
    }

    // Simulate progress
    if (ctx.onProgress) {
      ctx.onProgress(0, 5);
      ctx.onProgress(5, 5);
    }

    return this.processResult;
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('BatchRunnerService', () => {
  let runner: BatchRunnerService;
  let mockProcessor: MockProcessor;

  const testFirmId = 'firm-123';
  const testJobId = 'job-456';

  beforeEach(() => {
    jest.clearAllMocks();
    runner = new BatchRunnerService();
    mockProcessor = new MockProcessor();

    // Default mock implementations
    (aiFeatureConfigService.isFeatureEnabled as jest.Mock).mockResolvedValue(true);
    (aiClient.startBatchJob as jest.Mock).mockResolvedValue(testJobId);
    (aiClient.completeBatchJob as jest.Mock).mockResolvedValue(undefined);
    (prisma.aIBatchJobRun.findUnique as jest.Mock).mockResolvedValue({
      id: testJobId,
      firmId: testFirmId,
      feature: 'mock_feature',
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      itemsProcessed: 5,
      itemsFailed: 0,
      totalTokens: 1000,
      totalCostEur: 0.01 as any,
      errorMessage: null,
    } as any);
  });

  afterEach(() => {
    runner.stopScheduler();
  });

  // ============================================================================
  // Processor Registration
  // ============================================================================

  describe('registerProcessor', () => {
    it('should register a processor', () => {
      runner.registerProcessor(mockProcessor);

      const registered = runner.getProcessor('mock_feature');
      expect(registered).toBe(mockProcessor);
    });

    it('should replace existing processor with same feature', () => {
      const processor1 = new MockProcessor();
      const processor2 = new MockProcessor();
      processor2.processResult.itemsProcessed = 10;

      runner.registerProcessor(processor1);
      runner.registerProcessor(processor2);

      const registered = runner.getProcessor('mock_feature');
      expect(registered).toBe(processor2);
    });

    it('should list all registered processors', () => {
      const processor1 = new MockProcessor();
      const processor2 = new MockProcessor();
      (processor2 as any).feature = 'another_feature';

      runner.registerProcessor(processor1);
      runner.registerProcessor(processor2);

      const all = runner.getAllProcessors();
      expect(all).toHaveLength(2);
    });
  });

  // ============================================================================
  // Processor Execution
  // ============================================================================

  describe('runProcessor', () => {
    beforeEach(() => {
      runner.registerProcessor(mockProcessor);
    });

    it('should run processor and return result', async () => {
      const result = await runner.runProcessor(testFirmId, 'mock_feature');

      expect(aiClient.startBatchJob).toHaveBeenCalledWith(testFirmId, 'mock_feature');
      expect(aiClient.completeBatchJob).toHaveBeenCalledWith(testJobId, {
        status: 'completed',
        itemsProcessed: 5,
        itemsFailed: 0,
        totalTokens: 1000,
        totalCostEur: 0.01,
        errorMessage: undefined,
      });
      expect(result.result?.itemsProcessed).toBe(5);
    });

    it('should skip disabled features', async () => {
      (aiFeatureConfigService.isFeatureEnabled as jest.Mock).mockResolvedValue(false);
      (prisma.aIBatchJobRun.create as jest.Mock).mockResolvedValue({
        id: 'skipped-job',
        status: 'skipped',
      } as any);

      const result = await runner.runProcessor(testFirmId, 'mock_feature');

      expect(aiClient.startBatchJob).not.toHaveBeenCalled();
      expect(result.job.status).toBe('skipped');
    });

    it('should throw for unregistered processor', async () => {
      await expect(runner.runProcessor(testFirmId, 'unknown_feature')).rejects.toThrow(
        'No processor registered for feature: unknown_feature'
      );
    });

    it('should handle processor errors', async () => {
      mockProcessor.shouldThrow = true;
      (prisma.aIBatchJobRun.findUnique as jest.Mock).mockResolvedValue({
        id: testJobId,
        status: 'failed',
        errorMessage: 'Mock processor error',
      } as any);

      const result = await runner.runProcessor(testFirmId, 'mock_feature');

      expect(aiClient.completeBatchJob).toHaveBeenCalledWith(testJobId, {
        status: 'failed',
        itemsProcessed: 0,
        itemsFailed: 0,
        totalTokens: 0,
        totalCostEur: 0,
        errorMessage: 'Mock processor error',
      });
      expect(result.error).toBe('Mock processor error');
    });

    it('should call progress callback', async () => {
      const progressCalls: [number, number][] = [];
      const onProgress = (processed: number, total: number) => {
        progressCalls.push([processed, total]);
      };

      await runner.runProcessor(testFirmId, 'mock_feature', onProgress);

      expect(progressCalls).toContainEqual([0, 5]);
      expect(progressCalls).toContainEqual([5, 5]);
    });

    it('should determine partial status for mixed results', async () => {
      mockProcessor.processResult = {
        itemsProcessed: 3,
        itemsFailed: 2,
        totalTokens: 600,
        totalCost: 0.006,
        errors: ['Item 1 failed', 'Item 2 failed'],
      };

      await runner.runProcessor(testFirmId, 'mock_feature');

      expect(aiClient.completeBatchJob).toHaveBeenCalledWith(
        testJobId,
        expect.objectContaining({
          status: 'partial',
          itemsProcessed: 3,
          itemsFailed: 2,
          errorMessage: 'Item 1 failed; Item 2 failed',
        })
      );
    });
  });

  // ============================================================================
  // Run All for Firm
  // ============================================================================

  describe('runAllForFirm', () => {
    it('should run all registered processors', async () => {
      const processor1 = new MockProcessor();
      const processor2 = new MockProcessor();
      (processor2 as any).feature = 'another_feature';

      runner.registerProcessor(processor1);
      runner.registerProcessor(processor2);

      const results = await runner.runAllForFirm(testFirmId);

      expect(results).toHaveLength(2);
      expect(aiClient.startBatchJob).toHaveBeenCalledTimes(2);
    });

    it('should continue on processor error', async () => {
      const processor1 = new MockProcessor();
      processor1.shouldThrow = true;
      const processor2 = new MockProcessor();
      (processor2 as any).feature = 'another_feature';

      runner.registerProcessor(processor1);
      runner.registerProcessor(processor2);

      const results = await runner.runAllForFirm(testFirmId);

      // Should have result for both (one failed, one succeeded)
      expect(results).toHaveLength(2);
    });
  });

  // ============================================================================
  // Status Determination
  // ============================================================================

  describe('status determination', () => {
    beforeEach(() => {
      runner.registerProcessor(mockProcessor);
    });

    it('should mark as completed when all succeed', async () => {
      mockProcessor.processResult = {
        itemsProcessed: 10,
        itemsFailed: 0,
        totalTokens: 2000,
        totalCost: 0.02,
      };

      await runner.runProcessor(testFirmId, 'mock_feature');

      expect(aiClient.completeBatchJob).toHaveBeenCalledWith(
        testJobId,
        expect.objectContaining({ status: 'completed' })
      );
    });

    it('should mark as failed when all fail', async () => {
      mockProcessor.processResult = {
        itemsProcessed: 0,
        itemsFailed: 5,
        totalTokens: 500,
        totalCost: 0.005,
        errors: ['All failed'],
      };

      await runner.runProcessor(testFirmId, 'mock_feature');

      expect(aiClient.completeBatchJob).toHaveBeenCalledWith(
        testJobId,
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('should mark as completed when no items to process', async () => {
      mockProcessor.processResult = {
        itemsProcessed: 0,
        itemsFailed: 0,
        totalTokens: 0,
        totalCost: 0,
      };

      await runner.runProcessor(testFirmId, 'mock_feature');

      expect(aiClient.completeBatchJob).toHaveBeenCalledWith(
        testJobId,
        expect.objectContaining({ status: 'completed' })
      );
    });
  });
});
