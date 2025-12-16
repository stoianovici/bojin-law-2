/**
 * Circuit Breaker and Failover Tests
 * Story 3.8: Document System Testing and Performance - Task 12
 *
 * Tests:
 * - Circuit breaker state transitions (Closed -> Open -> Half-Open)
 * - Failure threshold triggering
 * - Reset timeout behavior
 * - Successful recovery
 * - Provider failover scenarios:
 *   - Claude 429 rate limit -> Grok fallback
 *   - Claude 503 unavailable -> Grok fallback
 *   - Claude timeout -> Grok fallback
 *   - Both providers unavailable -> graceful error
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProviderManagerService, ProviderError } from './provider-manager.service';
import { CircuitState } from '@legal-platform/types';

// Mock the Claude client
jest.mock('../lib/langchain/client', () => ({
  createClaudeModel: jest.fn(),
  AICallbackHandler: jest.fn().mockImplementation(() => ({
    getMetrics: () => ({ inputTokens: 100, outputTokens: 200 }),
  })),
}));

// Mock the Grok client
jest.mock('../lib/grok/client', () => ({
  grokClient: {
    isConfigured: jest.fn().mockReturnValue(true),
    createCompletion: jest.fn(),
    mapClaudeMessages: jest.fn().mockReturnValue([]),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 50 }),
  },
}));

// Mock config
jest.mock('../config', () => ({
  config: {
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 30000, // 30 seconds
    },
  },
}));

describe('Provider Manager Circuit Breaker Tests', () => {
  let providerManager: ProviderManagerService;
  let mockClaudeModel: jest.Mock;
  let mockGrokClient: {
    createCompletion: jest.Mock;
    isConfigured: jest.Mock;
    mapClaudeMessages: jest.Mock;
    healthCheck: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Get mocked modules
    const langchainModule = jest.requireMock('../lib/langchain/client') as {
      createClaudeModel: jest.Mock;
    };
    const grokModule = jest.requireMock('../lib/grok/client') as {
      grokClient: typeof mockGrokClient;
    };

    mockClaudeModel = langchainModule.createClaudeModel;
    mockGrokClient = grokModule.grokClient;

    // Create fresh instance
    providerManager = new ProviderManagerService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Circuit Breaker State Transitions', () => {
    it('should start with Closed state', () => {
      expect(providerManager.isClaudeAvailable()).toBe(true);
    });

    it('should remain Closed when requests succeed', async () => {
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: 'Success response',
        }),
      });

      const result = await providerManager.execute({
        prompt: 'Test prompt',
      });

      expect(result.provider).toBe('claude');
      expect(providerManager.isClaudeAvailable()).toBe(true);
    });

    it('should transition to Open after reaching failure threshold', async () => {
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });

      // Grok fallback succeeds
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      // Trigger failures (5 to hit threshold)
      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Circuit should now be Open
      expect(providerManager.isClaudeAvailable()).toBe(false);
    });

    it('should transition from Open to Half-Open after reset timeout', async () => {
      // First, open the circuit
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      expect(providerManager.isClaudeAvailable()).toBe(false);

      // Advance time past reset timeout (30 seconds)
      jest.advanceTimersByTime(31000);

      // Circuit should now be Half-Open (allows a test request)
      expect(providerManager.isClaudeAvailable()).toBe(true);
    });

    it('should transition from Half-Open to Closed on success', async () => {
      // Open the circuit
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Advance to Half-Open
      jest.advanceTimersByTime(31000);

      // Now make successful request
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: 'Success after recovery',
        }),
      });

      const result = await providerManager.execute({ prompt: 'Recovery test' });

      expect(result.provider).toBe('claude');
      expect(providerManager.isClaudeAvailable()).toBe(true);
    });

    it('should transition from Half-Open back to Open on failure', async () => {
      // Open the circuit
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Advance to Half-Open
      jest.advanceTimersByTime(31000);

      // Make failing request in Half-Open state
      await providerManager.execute({ prompt: 'Still failing' });

      // Should be back to Open
      expect(providerManager.isClaudeAvailable()).toBe(false);
    });
  });

  describe('Failure Threshold Triggering', () => {
    it('should not open circuit before threshold is reached', async () => {
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      // Only 4 failures (below threshold of 5)
      for (let i = 0; i < 4; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Circuit should still be Closed (available)
      expect(providerManager.isClaudeAvailable()).toBe(true);
    });

    it('should open circuit exactly at threshold', async () => {
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      // Exactly 5 failures (at threshold)
      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      expect(providerManager.isClaudeAvailable()).toBe(false);
    });

    it('should reset failure count after successful request', async () => {
      // 3 failures
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 3; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Then a success
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: 'Success',
        }),
      });
      await providerManager.execute({ prompt: 'Success' });

      // Then 3 more failures - should not hit threshold
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });

      for (let i = 0; i < 3; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Circuit should still be available (failures reset to 0 after success)
      expect(providerManager.isClaudeAvailable()).toBe(true);
    });
  });

  describe('Provider Failover Scenarios', () => {
    it('should failover to Grok on Claude 429 rate limit', async () => {
      const rateLimitError = new Error('429 rate limit exceeded');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(rateLimitError),
      });

      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok fallback response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      const result = await providerManager.execute({
        prompt: 'Test prompt',
      });

      expect(result.provider).toBe('grok');
      expect(result.content).toBe('Grok fallback response');
      expect(mockGrokClient.createCompletion).toHaveBeenCalled();
    });

    it('should failover to Grok on Claude 503 unavailable', async () => {
      const unavailableError = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(unavailableError),
      });

      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok fallback response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      const result = await providerManager.execute({
        prompt: 'Test prompt',
      });

      expect(result.provider).toBe('grok');
    });

    it('should failover to Grok on Claude timeout', async () => {
      const timeoutError = new Error('Request timeout');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(timeoutError),
      });

      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok fallback response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      const result = await providerManager.execute({
        prompt: 'Test prompt',
      });

      expect(result.provider).toBe('grok');
    });

    it('should failover to Grok on Claude overloaded error', async () => {
      const overloadedError = new Error('overloaded_error');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(overloadedError),
      });

      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok fallback response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      const result = await providerManager.execute({
        prompt: 'Test prompt',
      });

      expect(result.provider).toBe('grok');
    });

    it('should return graceful error when both providers unavailable', async () => {
      // Claude fails
      const claudeError = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(claudeError),
      });

      // Grok also fails
      const grokError = new Error('Grok service unavailable');
      mockGrokClient.createCompletion.mockRejectedValue(grokError);

      await expect(providerManager.execute({ prompt: 'Test' })).rejects.toThrow(ProviderError);

      try {
        await providerManager.execute({ prompt: 'Test' });
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).provider).toBe('all');
      }
    });

    it('should go directly to Grok when Claude circuit is open', async () => {
      // Open Claude circuit
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Clear mock call count
      mockClaudeModel.mockClear();
      mockGrokClient.createCompletion.mockClear();

      // Next request should go directly to Grok
      await providerManager.execute({ prompt: 'Direct to Grok' });

      // Claude should not have been called
      expect(mockClaudeModel).not.toHaveBeenCalled();
      expect(mockGrokClient.createCompletion).toHaveBeenCalled();
    });

    it('should not failover on non-retriable errors', async () => {
      // Non-retriable error (e.g., invalid API key)
      const authError = new Error('401 Unauthorized');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(authError),
      });

      await expect(providerManager.execute({ prompt: 'Test' })).rejects.toThrow('401 Unauthorized');

      // Grok should not have been called for auth error
      expect(mockGrokClient.createCompletion).not.toHaveBeenCalled();
    });
  });

  describe('Reset Timeout Behavior', () => {
    it('should not allow requests before reset timeout', async () => {
      // Open the circuit
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Advance only 15 seconds (less than 30 second timeout)
      jest.advanceTimersByTime(15000);

      // Circuit should still be Open
      expect(providerManager.isClaudeAvailable()).toBe(false);
    });

    it('should allow test request after reset timeout', async () => {
      // Open the circuit
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      // Advance past reset timeout
      jest.advanceTimersByTime(31000);

      // Circuit should now be Half-Open
      expect(providerManager.isClaudeAvailable()).toBe(true);
    });
  });

  describe('Health Status', () => {
    it('should report healthy status when circuits are closed', async () => {
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockResolvedValue({
          content: 'Success',
        }),
      });

      const health = await providerManager.getHealthStatus();

      const claudeHealth = health.find((h) => h.provider === 'claude');
      expect(claudeHealth?.status).toBe('healthy');
      expect(claudeHealth?.consecutiveFailures).toBe(0);
    });

    it('should report degraded status when circuit is half-open', async () => {
      // Open then wait for half-open
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      jest.advanceTimersByTime(31000);

      const health = await providerManager.getHealthStatus();
      const claudeHealth = health.find((h) => h.provider === 'claude');

      expect(claudeHealth?.status).toBe('degraded');
    });

    it('should report unavailable status when circuit is open', async () => {
      const error = new Error('503 Service Unavailable');
      mockClaudeModel.mockReturnValue({
        invoke: jest.fn().mockRejectedValue(error),
      });
      mockGrokClient.createCompletion.mockResolvedValue({
        content: 'Grok response',
        model: 'grok-1',
        inputTokens: 50,
        outputTokens: 100,
        latencyMs: 500,
      });

      for (let i = 0; i < 5; i++) {
        await providerManager.execute({ prompt: 'Test' });
      }

      const health = await providerManager.getHealthStatus();
      const claudeHealth = health.find((h) => h.provider === 'claude');

      expect(claudeHealth?.status).toBe('unavailable');
      expect(claudeHealth?.consecutiveFailures).toBe(5);
    });
  });

  describe('Circuit Reset', () => {
    it('should allow manual circuit reset', () => {
      providerManager.resetCircuits();

      expect(providerManager.isClaudeAvailable()).toBe(true);
      expect(providerManager.isGrokAvailable()).toBe(true);
    });
  });
});
