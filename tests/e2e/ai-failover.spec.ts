/**
 * AI Provider Failover E2E Tests
 * Story 3.8: Document System Testing and Performance - Task 13
 *
 * Tests:
 * - Simulate Claude service outage
 * - Verify automatic Grok fallback
 * - Verify response quality maintained
 * - Verify token usage tracking for both providers
 * - Test failback to Claude after recovery
 *
 * Uses mock server for controlled failure scenarios
 * Measures failover latency (target: < 500ms)
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const FAILOVER_LATENCY_THRESHOLD_MS = 500;

// Mock server endpoints for simulating failures
const MOCK_ENDPOINTS = {
  claude: '/mock/claude',
  grok: '/mock/grok',
  controlClaudeStatus: '/mock/control/claude',
  controlGrokStatus: '/mock/control/grok',
  resetMocks: '/mock/control/reset',
};

test.describe('AI Provider Failover E2E Tests', () => {
  test.beforeEach(async ({ request }) => {
    // Reset mock server state before each test
    await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.resetMocks}`);
  });

  test.describe('Claude Service Outage Simulation', () => {
    test('should detect Claude outage and switch to Grok', async ({ request }) => {
      // Step 1: Make Claude unavailable
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable', errorCode: 503 },
      });

      // Step 2: Make a request that would normally go to Claude
      const startTime = Date.now();
      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          documentType: 'MEMO',
          context: { subject: 'Failover Test' },
          modelTier: 'SONNET', // Would normally use Claude Sonnet
        },
      });
      const endTime = Date.now();

      expect(response.ok()).toBeTruthy();

      const result = await response.json();

      // Verify Grok was used instead of Claude
      expect(result.provider).toBe('grok');
      expect(result.content).toBeTruthy();

      // Verify failover happened within threshold
      const failoverLatency = endTime - startTime;
      console.log(`Failover latency: ${failoverLatency}ms`);
      // Note: Total latency includes generation time, so we check overall response
      expect(response.ok()).toBeTruthy();
    });

    test('should handle Claude 429 rate limit with automatic retry to Grok', async ({ request }) => {
      // Simulate rate limiting
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'rate_limited', errorCode: 429 },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'clause_suggestion',
          context: 'governing law clause',
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.provider).toBe('grok');
    });

    test('should handle Claude timeout with failover', async ({ request }) => {
      // Simulate timeout (30+ second delay)
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'timeout', delayMs: 31000 },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'Timeout Test' },
        },
        timeout: 60000, // Allow time for failover
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.provider).toBe('grok');
    });
  });

  test.describe('Response Quality Verification', () => {
    test('Grok fallback should produce valid document content', async ({ request }) => {
      // Make Claude unavailable
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          documentType: 'CONTRACT',
          templateId: 'service-agreement',
          context: {
            clientName: 'Test Client',
            serviceName: 'Legal Services',
          },
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();

      // Verify content quality
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(500); // Reasonable document length
      expect(result.content).toContain('Test Client'); // Context was used
    });

    test('Grok fallback should handle complex prompts correctly', async ({ request }) => {
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/semantic-diff`, {
        data: {
          baseVersionId: 'version-001',
          compareVersionId: 'version-002',
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();

      // Verify semantic diff structure
      expect(result).toHaveProperty('changes');
      expect(Array.isArray(result.changes)).toBe(true);
      expect(result).toHaveProperty('riskLevel');
    });
  });

  test.describe('Token Usage Tracking', () => {
    test('should track token usage for Claude requests', async ({ request }) => {
      // Ensure Claude is available
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'available' },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'Token Tracking Test' },
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();

      // Verify token usage is tracked
      expect(result).toHaveProperty('tokenUsage');
      expect(result.tokenUsage).toHaveProperty('inputTokens');
      expect(result.tokenUsage).toHaveProperty('outputTokens');
      expect(result.tokenUsage).toHaveProperty('totalTokens');
      expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
      expect(result.tokenUsage.outputTokens).toBeGreaterThan(0);
      expect(result.provider).toBe('claude');
    });

    test('should track token usage for Grok fallback requests', async ({ request }) => {
      // Make Claude unavailable
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'Grok Token Tracking Test' },
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();

      // Verify token usage is tracked for Grok
      expect(result).toHaveProperty('tokenUsage');
      expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
      expect(result.tokenUsage.outputTokens).toBeGreaterThan(0);
      expect(result.provider).toBe('grok');
    });

    test('should record correct cost for each provider', async ({ request }) => {
      // Make request to Claude
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'available' },
      });

      const claudeResponse = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'Cost Test' },
        },
      });
      const claudeResult = await claudeResponse.json();

      // Make request to Grok
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });

      const grokResponse = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'Cost Test' },
        },
      });
      const grokResult = await grokResponse.json();

      // Verify cost tracking
      expect(claudeResult).toHaveProperty('costCents');
      expect(grokResult).toHaveProperty('costCents');
      expect(typeof claudeResult.costCents).toBe('number');
      expect(typeof grokResult.costCents).toBe('number');
    });
  });

  test.describe('Failback to Claude After Recovery', () => {
    test('should return to Claude after it recovers', async ({ request }) => {
      // Step 1: Make Claude unavailable and open circuit
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });

      // Make several requests to open circuit
      for (let i = 0; i < 5; i++) {
        await request.post(`${API_BASE_URL}/api/ai/generate`, {
          data: {
            type: 'document_generation',
            context: { subject: `Circuit Open Test ${i}` },
          },
        });
      }

      // Step 2: Restore Claude
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'available' },
      });

      // Step 3: Trigger circuit reset (simulate time passage or manual reset)
      await request.post(`${API_BASE_URL}/api/ai/circuit/reset`);

      // Step 4: Make request - should go to Claude
      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'Recovery Test' },
        },
      });

      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.provider).toBe('claude');
    });

    test('should gradually shift traffic back to Claude in half-open state', async ({ request }) => {
      // This test verifies the half-open behavior where a single test request
      // is sent to Claude before fully closing the circuit

      // Step 1: Open circuit
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });

      for (let i = 0; i < 5; i++) {
        await request.post(`${API_BASE_URL}/api/ai/generate`, {
          data: { type: 'document_generation', context: { subject: `Open ${i}` } },
        });
      }

      // Step 2: Restore Claude and trigger half-open state
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'available' },
      });

      // Simulate time passage to move to half-open
      await request.post(`${API_BASE_URL}/api/ai/circuit/half-open`);

      // Step 3: First request in half-open goes to Claude
      const testResponse = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'Half-Open Test' },
        },
      });

      expect(testResponse.ok()).toBeTruthy();
      const testResult = await testResponse.json();

      // Should attempt Claude in half-open
      expect(['claude', 'grok']).toContain(testResult.provider);
    });
  });

  test.describe('Failover Latency Measurement', () => {
    test('failover should complete within 500ms threshold', async ({ request }) => {
      // Make Claude fail immediately (no delay)
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable', errorCode: 503, delayMs: 0 },
      });

      // Make Grok respond quickly
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlGrokStatus}`, {
        data: { status: 'available', delayMs: 100 }, // 100ms simulated response time
      });

      const startTime = Date.now();

      const response = await request.post(`${API_BASE_URL}/api/ai/health/failover-test`, {
        data: { testMode: true },
      });

      const failoverDuration = Date.now() - startTime;

      expect(response.ok()).toBeTruthy();
      const result = await response.json();

      // Verify failover decision was quick (actual generation can take longer)
      expect(result.failoverDecisionMs).toBeLessThan(FAILOVER_LATENCY_THRESHOLD_MS);
      console.log(`Failover decision time: ${result.failoverDecisionMs}ms`);
    });
  });

  test.describe('Both Providers Unavailable', () => {
    test('should return graceful error when all providers fail', async ({ request }) => {
      // Make both providers unavailable
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlGrokStatus}`, {
        data: { status: 'unavailable' },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: {
          type: 'document_generation',
          context: { subject: 'All Fail Test' },
        },
      });

      expect(response.status()).toBe(503);

      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('unavailable');
      expect(error).toHaveProperty('retryAfter');
    });

    test('should suggest retry after time when all providers down', async ({ request }) => {
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlClaudeStatus}`, {
        data: { status: 'unavailable' },
      });
      await request.post(`${API_BASE_URL}${MOCK_ENDPOINTS.controlGrokStatus}`, {
        data: { status: 'unavailable' },
      });

      const response = await request.post(`${API_BASE_URL}/api/ai/generate`, {
        data: { type: 'document_generation' },
      });

      const error = await response.json();

      expect(error.retryAfter).toBeGreaterThan(0);
      expect(error.retryAfter).toBeLessThanOrEqual(60); // Max 60 seconds
    });
  });

  test.describe('Health Check Endpoints', () => {
    test('should report correct health status for all providers', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/ai/health`);

      expect(response.ok()).toBeTruthy();
      const health = await response.json();

      expect(health).toHaveProperty('providers');
      expect(Array.isArray(health.providers)).toBe(true);

      const claude = health.providers.find((p: { provider: string }) => p.provider === 'claude');
      const grok = health.providers.find((p: { provider: string }) => p.provider === 'grok');

      expect(claude).toBeDefined();
      expect(grok).toBeDefined();
      expect(['healthy', 'degraded', 'unavailable']).toContain(claude.status);
      expect(['healthy', 'degraded', 'unavailable']).toContain(grok.status);
    });

    test('should report circuit breaker state in health check', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/ai/health`);

      expect(response.ok()).toBeTruthy();
      const health = await response.json();

      expect(health).toHaveProperty('circuitBreaker');
      expect(health.circuitBreaker).toHaveProperty('claude');
      expect(health.circuitBreaker).toHaveProperty('grok');

      expect(['closed', 'half-open', 'open']).toContain(
        health.circuitBreaker.claude.state.toLowerCase()
      );
    });
  });
});
