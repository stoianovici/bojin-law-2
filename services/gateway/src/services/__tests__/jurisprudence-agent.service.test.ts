/**
 * Jurisprudence Agent Service Tests
 *
 * Tests the main service that orchestrates jurisprudence research.
 */

import { JurisprudenceAgentContext } from '../jurisprudence-agent.types';

// ============================================================================
// Mocks - Must be declared before any imports
// ============================================================================

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

jest.mock('../../utils/logger', () => mockLogger);

const mockChatWithTools = jest.fn();
const mockCalculateCostEur = jest.fn();

jest.mock('../ai-client.service', () => {
  const original = jest.requireActual('../ai-client.service');
  return {
    ...original,
    aiClient: {
      chatWithTools: mockChatWithTools,
    },
    calculateCostEur: mockCalculateCostEur,
  };
});

jest.mock('../web-search.service', () => ({
  webSearchService: {
    search: jest.fn(),
  },
}));

// Mock Redis for rate limiting and caching
const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  setex: jest.fn().mockResolvedValue('OK'),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(3600),
};

jest.mock('@legal-platform/database', () => ({
  redis: mockRedis,
}));

// Import after mocks are set up
import {
  runJurisprudenceResearch,
  jurisprudenceAgentService,
} from '../jurisprudence-agent.service';

// ============================================================================
// Test Context
// ============================================================================

const testContext: JurisprudenceAgentContext = {
  firmId: 'firm-123',
  userId: 'user-456',
  correlationId: 'corr-789',
  caseId: 'case-abc',
};

// ============================================================================
// Service Tests
// ============================================================================

describe('runJurisprudenceResearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mock implementation for calculateCostEur
    mockCalculateCostEur.mockImplementation((model: string, input: number, output: number) => {
      return (input * 2.76 + output * 13.8) / 1_000_000;
    });
  });

  it('should return success: false when agent does not call submit tool', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Some response without calling submit tool',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const result = await runJurisprudenceResearch('Test topic', undefined, testContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('nu a trimis nota');
    expect(result.output).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[JurisprudenceAgent] submit_jurisprudence_notes not called',
      expect.any(Object)
    );
  });

  it('should calculate cost using centralized calculateCostEur function', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      inputTokens: 10000,
      outputTokens: 2000,
    });

    const result = await runJurisprudenceResearch('Test topic', undefined, testContext);

    // Verify calculateCostEur was called with correct model
    expect(mockCalculateCostEur).toHaveBeenCalledWith(
      expect.stringContaining('sonnet'),
      10000,
      2000
    );

    // Cost should be calculated
    expect(typeof result.costEur).toBe('number');
    expect(result.costEur).toBeGreaterThan(0);
  });

  it('should track token usage', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      inputTokens: 5000,
      outputTokens: 1000,
    });

    const result = await runJurisprudenceResearch('Test topic', undefined, testContext);

    expect(result.tokenUsage).toEqual({
      input: 5000,
      output: 1000,
      total: 6000,
    });
  });

  it('should return error result when agent throws', async () => {
    mockChatWithTools.mockRejectedValueOnce(new Error('API error'));

    const result = await runJurisprudenceResearch('Test topic', undefined, testContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
    expect(result.tokenUsage).toEqual({ input: 0, output: 0, total: 0 });
    expect(result.costEur).toBe(0);

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Research failed',
      expect.objectContaining({
        error: 'API error',
      })
    );
  });

  it('should measure duration correctly', async () => {
    // Add a small delay in the mock
    mockChatWithTools.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: 'Response',
              inputTokens: 1000,
              outputTokens: 500,
            });
          }, 50); // 50ms delay
        })
    );

    const result = await runJurisprudenceResearch('Test topic', undefined, testContext);

    expect(result.durationMs).toBeGreaterThanOrEqual(50);
  });

  it('should log research start and completion', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      inputTokens: 1000,
      outputTokens: 500,
    });

    await runJurisprudenceResearch('Test topic', undefined, testContext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      '[JurisprudenceAgent] Starting research',
      expect.objectContaining({
        correlationId: 'corr-789',
        userId: 'user-456',
      })
    );
  });

  it('should pass context to chat', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      inputTokens: 1000,
      outputTokens: 500,
    });

    await runJurisprudenceResearch('Test topic', 'Additional context', testContext);

    expect(mockChatWithTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        feature: 'jurisprudence-research',
        userId: 'user-456',
        firmId: 'firm-123',
      }),
      expect.any(Object)
    );
  });

  it('should use correct model from environment or default', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      inputTokens: 1000,
      outputTokens: 500,
    });

    await runJurisprudenceResearch('Test topic', undefined, testContext);

    expect(mockChatWithTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      expect.objectContaining({
        model: expect.stringContaining('sonnet'),
      })
    );
  });

  it('should emit progress events when callback is provided', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const progressEvents: Array<{ type: string; message: string }> = [];

    await runJurisprudenceResearch('Test topic', undefined, testContext, {
      onProgress: (event) => progressEvents.push(event),
    });

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0].type).toBe('search_start');
  });

  it('should handle zero tokens gracefully', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      // No token counts provided
    });

    const result = await runJurisprudenceResearch('Test topic', undefined, testContext);

    expect(result.tokenUsage).toEqual({
      input: 0,
      output: 0,
      total: 0,
    });
    // Cost calculation is called with 0 tokens
    expect(mockCalculateCostEur).toHaveBeenCalledWith(expect.any(String), 0, 0);
  });
});

// ============================================================================
// Exported Service Object Tests
// ============================================================================

describe('jurisprudenceAgentService', () => {
  it('should export runResearch function', () => {
    expect(jurisprudenceAgentService).toHaveProperty('runResearch');
    expect(typeof jurisprudenceAgentService.runResearch).toBe('function');
  });

  it('runResearch should be alias to runJurisprudenceResearch', () => {
    expect(jurisprudenceAgentService.runResearch).toBe(runJurisprudenceResearch);
  });
});

// ============================================================================
// Cost Calculation Integration Tests
// ============================================================================

describe('cost calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalculateCostEur.mockImplementation((model: string, input: number, output: number) => {
      return (input * 2.76 + output * 13.8) / 1_000_000;
    });
  });

  it('should use calculateCostEur from ai-client for consistent pricing', async () => {
    mockChatWithTools.mockResolvedValueOnce({
      content: 'Response',
      inputTokens: 100000,
      outputTokens: 20000,
    });

    const result = await runJurisprudenceResearch('Test topic', undefined, testContext);

    // Verify calculateCostEur was called
    expect(mockCalculateCostEur).toHaveBeenCalled();

    // Cost should match the mocked calculation
    const expectedCost = (100000 * 2.76 + 20000 * 13.8) / 1_000_000;
    expect(result.costEur).toBeCloseTo(expectedCost, 6);
  });
});
