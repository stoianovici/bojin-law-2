/**
 * Provider Manager Service Unit Tests
 * Story 3.1: AI Service Infrastructure
 */

import { ProviderManagerService, ProviderError } from './provider-manager.service';
import { CircuitState, ProviderStatus, ClaudeModel } from '@legal-platform/types';

// Mock the dependencies
jest.mock('../lib/claude/client', () => ({
  sendMessage: jest.fn().mockResolvedValue({
    content: 'Test response',
    inputTokens: 50,
    outputTokens: 100,
    stopReason: 'end_turn',
  }),
}));

jest.mock('../lib/grok/client', () => ({
  grokClient: {
    isConfigured: jest.fn().mockReturnValue(true),
    mapClaudeMessages: jest.fn().mockReturnValue([]),
    createCompletion: jest.fn(),
    healthCheck: jest.fn(),
  },
}));

describe('ProviderManagerService', () => {
  let manager: ProviderManagerService;

  beforeEach(() => {
    manager = new ProviderManagerService();
    manager.resetCircuits();
    jest.clearAllMocks();
  });

  describe('isClaudeAvailable', () => {
    it('should return true when circuit is closed', () => {
      expect(manager.isClaudeAvailable()).toBe(true);
    });
  });

  describe('isGrokAvailable', () => {
    it('should return true when Grok is configured and circuit is closed', () => {
      expect(manager.isGrokAvailable()).toBe(true);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all providers', async () => {
      const { grokClient } = require('../lib/grok/client');
      grokClient.healthCheck.mockResolvedValue({ healthy: true, latencyMs: 150 });

      const health = await manager.getHealthStatus();

      expect(health).toHaveLength(2);
      expect(health[0].provider).toBe('claude');
      expect(health[0].status).toBe(ProviderStatus.Healthy);
      expect(health[1].provider).toBe('grok');
    });
  });

  describe('resetCircuits', () => {
    it('should reset all circuit breakers', () => {
      // Trigger some failures first
      manager.resetCircuits();

      expect(manager.isClaudeAvailable()).toBe(true);
      expect(manager.isGrokAvailable()).toBe(true);
    });
  });
});

describe('ProviderError', () => {
  it('should create error with provider name', () => {
    const error = new ProviderError('claude', 'Test error', 100);

    expect(error.name).toBe('ProviderError');
    expect(error.provider).toBe('claude');
    expect(error.latencyMs).toBe(100);
    expect(error.message).toContain('claude');
  });
});
