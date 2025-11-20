/**
 * FallbackHandler Tests
 *
 * Comprehensive test suite for fallback mechanisms:
 * - Circuit breaker pattern
 * - Timeout handling
 * - Retry logic with exponential backoff
 * - Graceful degradation
 * - Event logging
 */

import { FallbackHandler } from '../../src/routing/FallbackHandler';
import type { AIRequest } from '../../src/routing/SkillSelector';
import type { RoutingDecision } from '../../src/routing/RequestRouter';

// ============================================================================
// Test Utilities
// ============================================================================

const createMockRequest = (): AIRequest => ({
  task: 'Review contract for compliance issues',
  context: {},
});

const createMockRoutingDecision = (): RoutingDecision => ({
  model: 'claude-3-5-haiku-20241022',
  skills: [
    {
      id: 'skill-1',
      skill_id: 'skill-1',
      display_name: 'Contract Analysis',
      description: 'Analyzes legal contracts',
      version: '1.0.0',
      type: 'analysis',
      category: 'legal-analysis',
      effectiveness_score: 0.85,
      token_savings_avg: 0.7,
      usage_count: 100,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'skill-2',
      skill_id: 'skill-2',
      display_name: 'Compliance Check',
      description: 'Checks compliance requirements',
      version: '1.0.0',
      type: 'validation',
      category: 'compliance',
      effectiveness_score: 0.8,
      token_savings_avg: 0.65,
      usage_count: 80,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ],
  strategy: 'skill-enhanced',
  confidence: 0.9,
  reasoning: 'Test routing decision',
  estimatedCost: 0.001,
  estimatedTokens: 500,
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// Circuit Breaker Tests
// ============================================================================

describe('FallbackHandler - Circuit Breaker', () => {
  let handler: FallbackHandler;

  beforeEach(() => {
    handler = new FallbackHandler({
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 100, // 100ms for faster tests
        halfOpenMaxAttempts: 2,
      },
      enableLogging: false,
    });
  });

  it('should allow execution when circuit is closed', async () => {
    const request = createMockRequest();
    let executeCalled = false;

    await handler.executeWithFallback(
      ['skill-1'],
      request,
      async () => {
        executeCalled = true;
        return 'success';
      },
      async () => 'fallback'
    );

    expect(executeCalled).toBe(true);
  });

  it('should open circuit after failure threshold', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Skill execution failed');
    };

    // Execute 3 times to reach threshold
    for (let i = 0; i < 3; i++) {
      await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
        'fallback'
      );
    }

    // Check circuit state
    const state = handler.getCircuitBreakerState('skill-1');
    expect(state?.state).toBe('open');
  });

  it('should use fallback when circuit is open', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Skill execution failed');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
        'fallback'
      );
    }

    // Next execution should use fallback immediately
    let executeCalled = false;
    const result = await handler.executeWithFallback(
      ['skill-1'],
      request,
      async () => {
        executeCalled = true;
        return 'success';
      },
      async () => 'fallback'
    );

    expect(executeCalled).toBe(false);
    expect(result).toBe('fallback');
  });

  it('should transition to half-open after reset timeout', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Skill execution failed');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
        'fallback'
      );
    }

    // Wait for reset timeout
    await sleep(150);

    // Next execution should transition to half-open
    let executeCalled = false;
    await handler.executeWithFallback(
      ['skill-1'],
      request,
      async () => {
        executeCalled = true;
        throw new Error('Still failing');
      },
      async () => 'fallback'
    );

    expect(executeCalled).toBe(true);
  });

  it('should close circuit after successful execution in half-open state', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Skill execution failed');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
        'fallback'
      );
    }

    // Wait for reset timeout
    await sleep(150);

    // Successful execution in half-open state
    await handler.executeWithFallback(
      ['skill-1'],
      request,
      async () => 'success',
      async () => 'fallback'
    );

    // Circuit should be closed
    const state = handler.getCircuitBreakerState('skill-1');
    expect(state?.state).toBe('closed');
  });

  it('should reset circuit breaker manually', () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Skill execution failed');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      handler.executeWithFallback(['skill-1'], request, failingFn, async () => 'fallback');
    }

    // Reset circuit breaker
    handler.resetCircuitBreaker('skill-1');

    // Circuit should be closed (new state)
    const state = handler.getCircuitBreakerState('skill-1');
    expect(state).toBeUndefined(); // No state = closed
  });

  it('should track circuit breaker states for multiple skills', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Skill execution failed');
    };

    // Open circuit for skill-1
    for (let i = 0; i < 3; i++) {
      await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
        'fallback'
      );
    }

    // skill-2 remains healthy
    await handler.executeWithFallback(
      ['skill-2'],
      request,
      async () => 'success',
      async () => 'fallback'
    );

    const states = handler.getCircuitBreakerStates();
    expect(states.get('skill-1')?.state).toBe('open');
    expect(states.get('skill-2')?.state).toBe('closed');
  });
});

// ============================================================================
// Timeout Handling Tests
// ============================================================================

describe('FallbackHandler - Timeout Handling', () => {
  let handler: FallbackHandler;

  beforeEach(() => {
    handler = new FallbackHandler({
      timeout: {
        skillExecutionTimeout: 100, // 100ms for faster tests
        routingTimeout: 50,
      },
      retry: {
        maxRetries: 0, // Disable retries for timeout tests
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
      enableLogging: false,
    });
  });

  it('should timeout long-running executions', async () => {
    const request = createMockRequest();
    const slowFn = async () => {
      await sleep(200); // Longer than timeout
      return 'success';
    };

    const result = await handler.executeWithFallback(
      ['skill-1'],
      request,
      slowFn,
      async () => 'fallback'
    );

    expect(result).toBe('fallback');
  });

  it('should complete fast executions within timeout', async () => {
    const request = createMockRequest();
    const fastFn = async () => {
      await sleep(50); // Shorter than timeout
      return 'success';
    };

    const result = await handler.executeWithFallback(
      ['skill-1'],
      request,
      fastFn,
      async () => 'fallback'
    );

    expect(result).toBe('success');
  });

  it('should log timeout events', async () => {
    const request = createMockRequest();
    const slowFn = async () => {
      await sleep(200);
      return 'success';
    };

    await handler.executeWithFallback(['skill-1'], request, slowFn, async () => 'fallback');

    const timeoutEvents = handler.getFallbackEventsByReason('timeout');
    expect(timeoutEvents.length).toBeGreaterThan(0);
  });

  it('should use custom timeout with executeWithTimeout', async () => {
    const slowFn = async () => {
      await sleep(100);
      return 'success';
    };

    await expect(
      handler.executeWithTimeout(slowFn, 50, new Error('Custom timeout'))
    ).rejects.toThrow('Custom timeout');
  });
});

// ============================================================================
// Retry Logic Tests
// ============================================================================

describe('FallbackHandler - Retry Logic', () => {
  let handler: FallbackHandler;

  beforeEach(() => {
    handler = new FallbackHandler({
      retry: {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
      timeout: {
        skillExecutionTimeout: 5000,
        routingTimeout: 100,
      },
      enableLogging: false,
    });
  });

  it('should retry failed executions', async () => {
    const request = createMockRequest();
    let attempts = 0;

    const flakyFn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };

    const result = await handler.executeWithFallback(
      ['skill-1'],
      request,
      flakyFn,
      async () => 'fallback'
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should use fallback after max retries exceeded', async () => {
    const request = createMockRequest();
    let attempts = 0;

    const alwaysFailingFn = async () => {
      attempts++;
      throw new Error('Always fails');
    };

    const result = await handler.executeWithFallback(
      ['skill-1'],
      request,
      alwaysFailingFn,
      async () => 'fallback'
    );

    expect(result).toBe('fallback');
    expect(attempts).toBe(4); // Initial + 3 retries
  });

  it('should apply exponential backoff', async () => {
    const request = createMockRequest();
    const startTime = Date.now();
    let attempts = 0;

    const alwaysFailingFn = async () => {
      attempts++;
      throw new Error('Always fails');
    };

    await handler.executeWithFallback(
      ['skill-1'],
      request,
      alwaysFailingFn,
      async () => 'fallback'
    );

    const duration = Date.now() - startTime;

    // With initial 10ms and multiplier 2, delays should be: 10ms, 20ms, 40ms
    // Total: ~70ms minimum (with jitter could be slightly different)
    expect(duration).toBeGreaterThanOrEqual(50);
    expect(attempts).toBe(4);
  });

  it('should not exceed max delay', async () => {
    const handlerWithLowMax = new FallbackHandler({
      retry: {
        maxRetries: 5,
        initialDelayMs: 10,
        maxDelayMs: 30, // Cap at 30ms
        backoffMultiplier: 10, // High multiplier
      },
      timeout: {
        skillExecutionTimeout: 5000,
        routingTimeout: 100,
      },
      enableLogging: false,
    });

    const request = createMockRequest();
    const delays: number[] = [];
    let lastTime = Date.now();

    const alwaysFailingFn = async () => {
      const now = Date.now();
      if (delays.length > 0) {
        delays.push(now - lastTime);
      }
      lastTime = now;
      throw new Error('Always fails');
    };

    await handlerWithLowMax.executeWithFallback(
      ['skill-1'],
      request,
      alwaysFailingFn,
      async () => 'fallback'
    );

    // All delays should be ≤ maxDelay (30ms) + jitter (±20% = 6ms) = ~36ms
    for (const delay of delays) {
      expect(delay).toBeLessThan(50);
    }
  });

  it('should log retry attempts', async () => {
    const request = createMockRequest();
    const alwaysFailingFn = async () => {
      throw new Error('Always fails');
    };

    await handler.executeWithFallback(
      ['skill-1'],
      request,
      alwaysFailingFn,
      async () => 'fallback'
    );

    const events = handler.getFallbackEvents();
    const retryEvents = events.filter((e) => e.retryAttempt !== undefined);

    expect(retryEvents.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Graceful Degradation Tests
// ============================================================================

describe('FallbackHandler - Graceful Degradation', () => {
  let handler: FallbackHandler;

  beforeEach(() => {
    handler = new FallbackHandler({
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 10000, // Long timeout to keep circuit open during test
        halfOpenMaxAttempts: 2,
      },
      enableLogging: false,
    });
  });

  it('should degrade to fallback when all skills are unhealthy', async () => {
    const request = createMockRequest();
    const decision = createMockRoutingDecision();

    // Open circuits for all skills
    for (const skill of decision.skills) {
      for (let i = 0; i < 2; i++) {
        await handler.executeWithFallback(
          [skill.skill_id],
          request,
          async () => {
            throw new Error('Skill failed');
          },
          async () => 'fallback'
        );
      }
    }

    // Degrade decision
    const degraded = await handler.degradeRoutingDecision(decision, request);

    expect(degraded.skills).toHaveLength(0);
    expect(degraded.strategy).toBe('fallback');
    expect(degraded.confidence).toBeLessThan(decision.confidence);
  });

  it('should remove unhealthy skills but keep healthy ones', async () => {
    const request = createMockRequest();
    const decision = createMockRoutingDecision();

    // Open circuit for skill-1 only
    for (let i = 0; i < 2; i++) {
      await handler.executeWithFallback(
        ['skill-1'],
        request,
        async () => {
          throw new Error('Skill failed');
        },
        async () => 'fallback'
      );
    }

    // Keep skill-2 healthy
    await handler.executeWithFallback(
      ['skill-2'],
      request,
      async () => 'success',
      async () => 'fallback'
    );

    // Degrade decision
    const degraded = await handler.degradeRoutingDecision(decision, request);

    expect(degraded.skills).toHaveLength(1);
    expect(degraded.skills[0].skill_id).toBe('skill-2');
    expect(degraded.confidence).toBeLessThan(decision.confidence);
  });

  it('should not degrade when all skills are healthy', async () => {
    const request = createMockRequest();
    const decision = createMockRoutingDecision();

    // Keep all skills healthy
    for (const skill of decision.skills) {
      await handler.executeWithFallback(
        [skill.skill_id],
        request,
        async () => 'success',
        async () => 'fallback'
      );
    }

    // Degrade decision (should not change)
    const degraded = await handler.degradeRoutingDecision(decision, request);

    expect(degraded.skills).toHaveLength(decision.skills.length);
    expect(degraded.strategy).toBe(decision.strategy);
    expect(degraded.confidence).toBe(decision.confidence);
  });
});

// ============================================================================
// Event Logging Tests
// ============================================================================

describe('FallbackHandler - Event Logging', () => {
  let handler: FallbackHandler;

  beforeEach(() => {
    handler = new FallbackHandler({
      enableLogging: false,
    });
  });

  it('should log fallback events', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Test error');
    };

    await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
      'fallback'
    );

    const events = handler.getFallbackEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  it('should filter events by reason', async () => {
    const handlerWithTimeout = new FallbackHandler({
      timeout: {
        skillExecutionTimeout: 50,
        routingTimeout: 50,
      },
      retry: {
        maxRetries: 0,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
      enableLogging: false,
    });

    const request = createMockRequest();
    const slowFn = async () => {
      await sleep(100);
      return 'success';
    };

    await handlerWithTimeout.executeWithFallback(
      ['skill-1'],
      request,
      slowFn,
      async () => 'fallback'
    );

    const timeoutEvents = handlerWithTimeout.getFallbackEventsByReason('timeout');
    expect(timeoutEvents.length).toBeGreaterThan(0);
    expect(timeoutEvents[0].reason).toBe('timeout');
  });

  it('should include error details in events', async () => {
    const request = createMockRequest();
    const testError = new Error('Test error message');
    const failingFn = async () => {
      throw testError;
    };

    await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
      'fallback'
    );

    const events = handler.getFallbackEvents();
    const errorEvent = events.find((e) => e.error?.message === 'Test error message');

    expect(errorEvent).toBeDefined();
    expect(errorEvent?.skillIds).toContain('skill-1');
  });

  it('should limit event history to 1000 events', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Test error');
    };

    // Generate 1500 events
    for (let i = 0; i < 1500; i++) {
      await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
        'fallback'
      );
    }

    const events = handler.getFallbackEvents();
    expect(events.length).toBeLessThanOrEqual(1000);
  }, 30000); // 30 second timeout for this long-running test

  it('should clear event history', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Test error');
    };

    await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
      'fallback'
    );

    handler.clearFallbackEvents();

    const events = handler.getFallbackEvents();
    expect(events).toHaveLength(0);
  });
});

// ============================================================================
// Statistics and Monitoring Tests
// ============================================================================

describe('FallbackHandler - Statistics', () => {
  let handler: FallbackHandler;

  beforeEach(() => {
    handler = new FallbackHandler({
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 100,
        halfOpenMaxAttempts: 2,
      },
      enableLogging: false,
    });
  });

  it('should calculate fallback statistics', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Test error');
    };

    // Generate some events
    await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
      'fallback'
    );

    const stats = handler.getFallbackStats();

    expect(stats.totalEvents).toBeGreaterThan(0);
    expect(stats.eventsByReason).toBeDefined();
  });

  it('should track circuit breaker state counts', async () => {
    const request = createMockRequest();
    const failingFn = async () => {
      throw new Error('Test error');
    };

    // Open circuit for skill-1
    for (let i = 0; i < 2; i++) {
      await handler.executeWithFallback(['skill-1'], request, failingFn, async () =>
        'fallback'
      );
    }

    // Keep skill-2 healthy
    await handler.executeWithFallback(
      ['skill-2'],
      request,
      async () => 'success',
      async () => 'fallback'
    );

    const stats = handler.getFallbackStats();

    expect(stats.circuitBreakerStates.open).toBe(1);
    expect(stats.circuitBreakerStates.closed).toBe(1);
  });

  it('should provide event counts by reason', async () => {
    const handlerWithTimeout = new FallbackHandler({
      timeout: {
        skillExecutionTimeout: 50,
        routingTimeout: 50,
      },
      retry: {
        maxRetries: 0,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeout: 1000,
        halfOpenMaxAttempts: 2,
      },
      enableLogging: false,
    });

    const request = createMockRequest();

    // Create timeout event
    await handlerWithTimeout.executeWithFallback(
      ['skill-1'],
      request,
      async () => {
        await sleep(100);
        return 'success';
      },
      async () => 'fallback'
    );

    // Create skill error event
    await handlerWithTimeout.executeWithFallback(
      ['skill-2'],
      request,
      async () => {
        throw new Error('Skill error');
      },
      async () => 'fallback'
    );

    const stats = handlerWithTimeout.getFallbackStats();

    expect(stats.eventsByReason.timeout).toBeGreaterThan(0);
    expect(stats.eventsByReason.skill_error).toBeGreaterThan(0);
  });
});

// ============================================================================
// Configuration Tests
// ============================================================================

describe('FallbackHandler - Configuration', () => {
  it('should use default configuration', () => {
    const handler = new FallbackHandler();
    const config = handler.getConfig();

    expect(config.circuitBreaker.failureThreshold).toBe(5);
    expect(config.timeout.skillExecutionTimeout).toBe(5000);
    expect(config.retry.maxRetries).toBe(3);
  });

  it('should accept custom configuration', () => {
    const handler = new FallbackHandler({
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeout: 30000,
        halfOpenMaxAttempts: 5,
      },
      timeout: {
        skillExecutionTimeout: 10000,
        routingTimeout: 200,
      },
    });

    const config = handler.getConfig();

    expect(config.circuitBreaker.failureThreshold).toBe(10);
    expect(config.timeout.skillExecutionTimeout).toBe(10000);
  });

  it('should merge custom config with defaults', () => {
    const handler = new FallbackHandler({
      circuitBreaker: {
        failureThreshold: 10,
        resetTimeout: 30000,
        halfOpenMaxAttempts: 5,
      },
      // timeout not provided - should use defaults
    });

    const config = handler.getConfig();

    expect(config.circuitBreaker.failureThreshold).toBe(10);
    expect(config.timeout.skillExecutionTimeout).toBe(5000); // Default
  });

  it('should update configuration dynamically', () => {
    const handler = new FallbackHandler();

    handler.updateConfig({
      circuitBreaker: {
        failureThreshold: 20,
        resetTimeout: 60000,
        halfOpenMaxAttempts: 10,
      },
    });

    const config = handler.getConfig();
    expect(config.circuitBreaker.failureThreshold).toBe(20);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('FallbackHandler - Integration', () => {
  it('should handle complete fallback flow: timeout → retry → circuit breaker → fallback', async () => {
    const handler = new FallbackHandler({
      timeout: {
        skillExecutionTimeout: 50,
        routingTimeout: 50,
      },
      retry: {
        maxRetries: 2,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
      circuitBreaker: {
        failureThreshold: 1, // Open after first failure
        resetTimeout: 1000,
        halfOpenMaxAttempts: 2,
      },
      enableLogging: false,
    });

    const request = createMockRequest();

    // First execution: timeout → retry → fail → open circuit
    const result1 = await handler.executeWithFallback(
      ['skill-1'],
      request,
      async () => {
        await sleep(100); // Timeout
        return 'success';
      },
      async () => 'fallback'
    );

    expect(result1).toBe('fallback');

    // Second execution: circuit open → immediate fallback
    let executeCalled = false;
    const result2 = await handler.executeWithFallback(
      ['skill-1'],
      request,
      async () => {
        executeCalled = true;
        return 'success';
      },
      async () => 'fallback'
    );

    expect(result2).toBe('fallback');
    expect(executeCalled).toBe(false);

    // Check events
    const events = handler.getFallbackEvents();
    const timeoutEvents = events.filter((e) => e.reason === 'timeout');
    const circuitEvents = events.filter((e) => e.reason === 'circuit_open');

    expect(timeoutEvents.length).toBeGreaterThan(0);
    expect(circuitEvents.length).toBeGreaterThan(0);
  });

  it('should handle recovery flow: failure → circuit open → wait → half-open → success → circuit closed', async () => {
    const handler = new FallbackHandler({
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 100,
        halfOpenMaxAttempts: 2,
      },
      retry: {
        maxRetries: 0,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      },
      enableLogging: false,
    });

    const request = createMockRequest();

    // 1. Open circuit
    for (let i = 0; i < 2; i++) {
      await handler.executeWithFallback(
        ['skill-1'],
        request,
        async () => {
          throw new Error('Failure');
        },
        async () => 'fallback'
      );
    }

    let state = handler.getCircuitBreakerState('skill-1');
    expect(state?.state).toBe('open');

    // 2. Wait for reset timeout
    await sleep(150);

    // 3. Successful execution → circuit closed
    await handler.executeWithFallback(
      ['skill-1'],
      request,
      async () => 'success',
      async () => 'fallback'
    );

    state = handler.getCircuitBreakerState('skill-1');
    expect(state?.state).toBe('closed');
  });
});
