/**
 * Fallback Handler
 *
 * Provides robust fallback mechanisms for skill execution:
 * - Circuit breaker pattern for skill failures
 * - Timeout handling with configurable limits
 * - Retry logic with exponential backoff
 * - Graceful degradation to non-skill routing
 * - Comprehensive event logging
 */

import type { AIRequest } from './SkillSelector';
import type { RoutingDecision } from './RequestRouter';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface FallbackEvent {
  timestamp: Date;
  reason: FallbackReason;
  skillIds: string[];
  request: AIRequest;
  error?: Error;
  retryAttempt?: number;
  circuitState?: CircuitState;
}

export type FallbackReason =
  | 'timeout'
  | 'circuit_open'
  | 'max_retries_exceeded'
  | 'skill_error'
  | 'unknown_error';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Milliseconds before attempting reset
  halfOpenMaxAttempts: number; // Max attempts in half-open state
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface TimeoutConfig {
  skillExecutionTimeout: number; // Milliseconds
  routingTimeout: number; // Milliseconds
}

export interface FallbackHandlerConfig {
  circuitBreaker: CircuitBreakerConfig;
  retry: RetryConfig;
  timeout: TimeoutConfig;
  enableLogging: boolean;
}

// Circuit breaker state per skill
interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  halfOpenAttempts: number;
}

// ============================================================================
// FallbackHandler Class
// ============================================================================

export class FallbackHandler {
  private readonly config: FallbackHandlerConfig;
  private readonly circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly fallbackEvents: FallbackEvent[] = [];

  // Default configuration
  private static readonly DEFAULT_CONFIG: FallbackHandlerConfig = {
    circuitBreaker: {
      failureThreshold: 5, // Open after 5 failures
      resetTimeout: 60000, // Try again after 1 minute
      halfOpenMaxAttempts: 3, // Allow 3 attempts when half-open
    },
    retry: {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    },
    timeout: {
      skillExecutionTimeout: 5000, // 5 second default (from AC#6)
      routingTimeout: 100, // 100ms routing overhead (from AC#8)
    },
    enableLogging: true,
  };

  constructor(config?: Partial<FallbackHandlerConfig>) {
    this.config = {
      ...FallbackHandler.DEFAULT_CONFIG,
      ...config,
      circuitBreaker: {
        ...FallbackHandler.DEFAULT_CONFIG.circuitBreaker,
        ...config?.circuitBreaker,
      },
      retry: {
        ...FallbackHandler.DEFAULT_CONFIG.retry,
        ...config?.retry,
      },
      timeout: {
        ...FallbackHandler.DEFAULT_CONFIG.timeout,
        ...config?.timeout,
      },
    };
  }

  // ============================================================================
  // Public Methods - Execution with Fallback
  // ============================================================================

  /**
   * Execute a function with fallback protection
   */
  async executeWithFallback<T>(
    skillIds: string[],
    request: AIRequest,
    executeFn: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    // Check circuit breakers before attempting execution
    for (const skillId of skillIds) {
      const canExecute = await this.canExecute(skillId);
      if (!canExecute) {
        this.logFallback({
          timestamp: new Date(),
          reason: 'circuit_open',
          skillIds,
          request,
          circuitState: this.getCircuitState(skillId),
        });

        console.warn(
          `[FallbackHandler] Circuit breaker open for skill ${skillId}, using fallback`
        );

        return fallbackFn();
      }
    }

    // Execute with timeout and retry
    try {
      const result = await this.executeWithRetry(
        skillIds,
        request,
        executeFn,
        fallbackFn
      );

      // Record success for circuit breakers
      for (const skillId of skillIds) {
        this.recordSuccess(skillId);
      }

      return result;
    } catch {
      // Record failure for circuit breakers
      for (const skillId of skillIds) {
        this.recordFailure(skillId);
      }

      // Use fallback
      return fallbackFn();
    }
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutError: Error = new Error('Execution timeout')
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(timeoutError), timeoutMs);
      }),
    ]);
  }

  // ============================================================================
  // Private Methods - Circuit Breaker
  // ============================================================================

  /**
   * Check if skill execution is allowed (circuit breaker check)
   */
  private async canExecute(skillId: string): Promise<boolean> {
    const state = this.getOrCreateCircuitState(skillId);

    switch (state.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if enough time has passed to try half-open
        if (
          state.lastFailureTime &&
          Date.now() - state.lastFailureTime.getTime() >=
            this.config.circuitBreaker.resetTimeout
        ) {
          // Transition to half-open
          state.state = 'half_open';
          state.halfOpenAttempts = 0;
          this.circuitBreakers.set(skillId, state);
          return true;
        }
        return false;

      case 'half_open':
        // Allow limited attempts in half-open state
        if (
          state.halfOpenAttempts < this.config.circuitBreaker.halfOpenMaxAttempts
        ) {
          state.halfOpenAttempts++;
          this.circuitBreakers.set(skillId, state);
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * Record successful execution
   */
  private recordSuccess(skillId: string): void {
    const state = this.getOrCreateCircuitState(skillId);

    if (state.state === 'half_open') {
      // Successful execution in half-open state - close the circuit
      state.state = 'closed';
      state.failureCount = 0;
      state.halfOpenAttempts = 0;
    }

    state.lastSuccessTime = new Date();
    this.circuitBreakers.set(skillId, state);

    if (this.config.enableLogging) {
      console.log(`[FallbackHandler] Recorded success for skill ${skillId}`);
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(skillId: string): void {
    const state = this.getOrCreateCircuitState(skillId);

    state.failureCount++;
    state.lastFailureTime = new Date();

    // Check if should open circuit
    if (state.failureCount >= this.config.circuitBreaker.failureThreshold) {
      state.state = 'open';
      state.halfOpenAttempts = 0;

      if (this.config.enableLogging) {
        console.warn(
          `[FallbackHandler] Circuit breaker opened for skill ${skillId} after ${state.failureCount} failures`
        );
      }
    }

    this.circuitBreakers.set(skillId, state);
  }

  /**
   * Get or create circuit breaker state
   */
  private getOrCreateCircuitState(skillId: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(skillId)) {
      this.circuitBreakers.set(skillId, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        halfOpenAttempts: 0,
      });
    }

    return this.circuitBreakers.get(skillId)!;
  }

  /**
   * Get current circuit state for a skill
   */
  private getCircuitState(skillId: string): CircuitState {
    return this.getOrCreateCircuitState(skillId).state;
  }

  // ============================================================================
  // Private Methods - Retry Logic
  // ============================================================================

  /**
   * Execute with retry and exponential backoff
   */
  private async executeWithRetry<T>(
    skillIds: string[],
    request: AIRequest,
    executeFn: () => Promise<T>,
    _fallbackFn: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retry.maxRetries; attempt++) {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(
          executeFn,
          this.config.timeout.skillExecutionTimeout,
          new Error('Skill execution timeout')
        );

        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is timeout
        if (lastError.message === 'Skill execution timeout') {
          this.logFallback({
            timestamp: new Date(),
            reason: 'timeout',
            skillIds,
            request,
            error: lastError,
            retryAttempt: attempt,
          });
        } else {
          this.logFallback({
            timestamp: new Date(),
            reason: 'skill_error',
            skillIds,
            request,
            error: lastError,
            retryAttempt: attempt,
          });
        }

        // Don't retry on last attempt
        if (attempt === this.config.retry.maxRetries) {
          break;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(attempt);

        if (this.config.enableLogging) {
          console.warn(
            `[FallbackHandler] Attempt ${attempt + 1} failed for skills ${skillIds.join(', ')}, retrying in ${delay}ms`
          );
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // Max retries exceeded - log and throw error
    this.logFallback({
      timestamp: new Date(),
      reason: 'max_retries_exceeded',
      skillIds,
      request,
      error: lastError,
      retryAttempt: this.config.retry.maxRetries,
    });

    if (this.config.enableLogging) {
      console.error(
        `[FallbackHandler] Max retries (${this.config.retry.maxRetries}) exceeded for skills ${skillIds.join(', ')}, using fallback`
      );
    }

    // Throw error so circuit breaker can track failure
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      this.config.retry.initialDelayMs *
        Math.pow(this.config.retry.backoffMultiplier, attempt),
      this.config.retry.maxDelayMs
    );

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5);

    return Math.floor(delay + jitter);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Private Methods - Event Logging
  // ============================================================================

  /**
   * Log a fallback event
   */
  private logFallback(event: FallbackEvent): FallbackEvent {
    // Add to in-memory log
    this.fallbackEvents.push(event);

    // Keep only last 1000 events
    if (this.fallbackEvents.length > 1000) {
      this.fallbackEvents.shift();
    }

    // Console logging
    if (this.config.enableLogging) {
      const errorMsg = event.error ? ` - ${event.error.message}` : '';
      const retryMsg = event.retryAttempt !== undefined ? ` (attempt ${event.retryAttempt + 1})` : '';
      const circuitMsg = event.circuitState ? ` [circuit: ${event.circuitState}]` : '';

      console.warn(
        `[FallbackHandler] Fallback triggered: ${event.reason}${retryMsg}${circuitMsg} for skills ${event.skillIds.join(', ')}${errorMsg}`
      );
    }

    return event;
  }

  // ============================================================================
  // Public Methods - Graceful Degradation
  // ============================================================================

  /**
   * Gracefully degrade routing decision based on skill health
   */
  async degradeRoutingDecision(
    decision: RoutingDecision,
    request: AIRequest
  ): Promise<RoutingDecision> {
    // Check if any skills have open circuit breakers
    const unhealthySkills: string[] = [];

    for (const skill of decision.skills) {
      const canExecute = await this.canExecute(skill.skill_id);
      if (!canExecute) {
        unhealthySkills.push(skill.skill_id);
      }
    }

    // If all skills are unhealthy, return fallback decision
    if (unhealthySkills.length === decision.skills.length) {
      this.logFallback({
        timestamp: new Date(),
        reason: 'circuit_open',
        skillIds: unhealthySkills,
        request,
      });

      return {
        ...decision,
        skills: [],
        strategy: 'fallback',
        reasoning: `All skills unhealthy (circuit breakers open), degraded to fallback routing`,
        confidence: 0.3,
      };
    }

    // If some skills are unhealthy, remove them
    if (unhealthySkills.length > 0) {
      const healthySkills = decision.skills.filter(
        (skill) => !unhealthySkills.includes(skill.skill_id)
      );

      this.logFallback({
        timestamp: new Date(),
        reason: 'circuit_open',
        skillIds: unhealthySkills,
        request,
      });

      return {
        ...decision,
        skills: healthySkills,
        reasoning: `Removed ${unhealthySkills.length} unhealthy skills, using ${healthySkills.length} healthy skills`,
        confidence: decision.confidence * 0.8, // Reduce confidence
      };
    }

    // All skills healthy - no degradation needed
    return decision;
  }

  // ============================================================================
  // Public Methods - Monitoring and Diagnostics
  // ============================================================================

  /**
   * Get all fallback events
   */
  getFallbackEvents(limit?: number): FallbackEvent[] {
    if (limit) {
      return this.fallbackEvents.slice(-limit);
    }
    return [...this.fallbackEvents];
  }

  /**
   * Get fallback events by reason
   */
  getFallbackEventsByReason(reason: FallbackReason): FallbackEvent[] {
    return this.fallbackEvents.filter((event) => event.reason === reason);
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get circuit breaker state for specific skill
   */
  getCircuitBreakerState(skillId: string): CircuitBreakerState | undefined {
    return this.circuitBreakers.get(skillId);
  }

  /**
   * Reset circuit breaker for a skill
   */
  resetCircuitBreaker(skillId: string): void {
    this.circuitBreakers.delete(skillId);
    if (this.config.enableLogging) {
      console.log(`[FallbackHandler] Reset circuit breaker for skill ${skillId}`);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.clear();
    if (this.config.enableLogging) {
      console.log(`[FallbackHandler] Reset all circuit breakers`);
    }
  }

  /**
   * Get fallback statistics
   */
  getFallbackStats(): {
    totalEvents: number;
    eventsByReason: Record<FallbackReason, number>;
    circuitBreakerStates: {
      open: number;
      closed: number;
      halfOpen: number;
    };
  } {
    const eventsByReason: Record<FallbackReason, number> = {
      timeout: 0,
      circuit_open: 0,
      max_retries_exceeded: 0,
      skill_error: 0,
      unknown_error: 0,
    };

    for (const event of this.fallbackEvents) {
      eventsByReason[event.reason]++;
    }

    const circuitBreakerStates = {
      open: 0,
      closed: 0,
      halfOpen: 0,
    };

    for (const state of this.circuitBreakers.values()) {
      if (state.state === 'open') {
        circuitBreakerStates.open++;
      } else if (state.state === 'closed') {
        circuitBreakerStates.closed++;
      } else if (state.state === 'half_open') {
        circuitBreakerStates.halfOpen++;
      }
    }

    return {
      totalEvents: this.fallbackEvents.length,
      eventsByReason,
      circuitBreakerStates,
    };
  }

  /**
   * Clear fallback event history
   */
  clearFallbackEvents(): void {
    this.fallbackEvents.length = 0;
    if (this.config.enableLogging) {
      console.log(`[FallbackHandler] Cleared fallback event history`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): FallbackHandlerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FallbackHandlerConfig>): void {
    this.config.circuitBreaker = {
      ...this.config.circuitBreaker,
      ...config.circuitBreaker,
    };
    this.config.retry = {
      ...this.config.retry,
      ...config.retry,
    };
    this.config.timeout = {
      ...this.config.timeout,
      ...config.timeout,
    };
    if (config.enableLogging !== undefined) {
      this.config.enableLogging = config.enableLogging;
    }

    if (this.config.enableLogging) {
      console.log(`[FallbackHandler] Updated configuration:`, this.config);
    }
  }
}
