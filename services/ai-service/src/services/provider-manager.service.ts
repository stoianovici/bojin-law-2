/**
 * Provider Manager Service
 * Story 3.1: AI Service Infrastructure
 *
 * Manages AI providers with circuit breaker pattern and automatic failover
 */

import { CircuitState, ProviderStatus, AIProviderHealth, ClaudeModel } from '@legal-platform/types';
import { ChatAnthropic } from '@langchain/anthropic';
import { createClaudeModel, AICallbackHandler } from '../lib/langchain/client';
import { grokClient, GrokMessage } from '../lib/grok/client';
import { config } from '../config';

export interface ProviderRequest {
  systemPrompt?: string;
  prompt: string;
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
}

export interface ProviderResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  openedAt: Date | null;
}

export class ProviderManagerService {
  private claudeCircuit: CircuitBreakerState;
  private grokCircuit: CircuitBreakerState;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor() {
    this.failureThreshold = config.circuitBreaker.failureThreshold;
    this.resetTimeoutMs = config.circuitBreaker.resetTimeoutMs;

    this.claudeCircuit = this.initCircuitState();
    this.grokCircuit = this.initCircuitState();
  }

  private initCircuitState(): CircuitBreakerState {
    return {
      state: CircuitState.Closed,
      failures: 0,
      lastFailure: null,
      lastSuccess: null,
      openedAt: null,
    };
  }

  /**
   * Check if a circuit should transition from open to half-open
   */
  private checkCircuitTransition(circuit: CircuitBreakerState): void {
    if (circuit.state === CircuitState.Open && circuit.openedAt) {
      const elapsed = Date.now() - circuit.openedAt.getTime();
      if (elapsed >= this.resetTimeoutMs) {
        circuit.state = CircuitState.HalfOpen;
      }
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(circuit: CircuitBreakerState): void {
    circuit.failures = 0;
    circuit.lastSuccess = new Date();

    if (circuit.state === CircuitState.HalfOpen) {
      circuit.state = CircuitState.Closed;
      circuit.openedAt = null;
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(circuit: CircuitBreakerState): void {
    circuit.failures++;
    circuit.lastFailure = new Date();

    if (circuit.failures >= this.failureThreshold) {
      circuit.state = CircuitState.Open;
      circuit.openedAt = new Date();
    }
  }

  /**
   * Check if Claude is available
   */
  isClaudeAvailable(): boolean {
    this.checkCircuitTransition(this.claudeCircuit);
    return this.claudeCircuit.state !== CircuitState.Open;
  }

  /**
   * Check if Grok is available
   */
  isGrokAvailable(): boolean {
    if (!grokClient.isConfigured()) {
      return false;
    }
    this.checkCircuitTransition(this.grokCircuit);
    return this.grokCircuit.state !== CircuitState.Open;
  }

  /**
   * Execute request with Claude
   */
  private async executeWithClaude(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const callbackHandler = new AICallbackHandler();

    try {
      const model = createClaudeModel(request.model || ClaudeModel.Sonnet, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        callbacks: [callbackHandler],
      });

      const messages: Array<['system' | 'human', string]> = [];
      if (request.systemPrompt) {
        messages.push(['system', request.systemPrompt]);
      }
      messages.push(['human', request.prompt]);

      const response = await model.invoke(messages);
      const latencyMs = Date.now() - startTime;
      const metrics = callbackHandler.getMetrics();

      this.recordSuccess(this.claudeCircuit);

      return {
        content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
        provider: 'claude',
        model: request.model || ClaudeModel.Sonnet,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.recordFailure(this.claudeCircuit);

      // Check if error is retriable (429, 503, timeout)
      const isRetriable = this.isRetriableError(error);
      if (!isRetriable) {
        throw error;
      }

      throw new ProviderError('Claude', error instanceof Error ? error.message : 'Unknown error', latencyMs);
    }
  }

  /**
   * Execute request with Grok fallback
   */
  private async executeWithGrok(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      const messages: GrokMessage[] = grokClient.mapClaudeMessages(
        request.systemPrompt || '',
        request.prompt
      );

      const response = await grokClient.createCompletion({
        messages,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      this.recordSuccess(this.grokCircuit);

      return {
        content: response.content,
        provider: 'grok',
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.recordFailure(this.grokCircuit);

      throw new ProviderError('Grok', error instanceof Error ? error.message : 'Unknown error', latencyMs);
    }
  }

  /**
   * Check if error is retriable
   */
  private isRetriableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('429') ||
        message.includes('503') ||
        message.includes('timeout') ||
        message.includes('rate limit') ||
        message.includes('overloaded')
      );
    }
    return false;
  }

  /**
   * Execute request with automatic failover
   */
  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // Try Claude first if available
    if (this.isClaudeAvailable()) {
      try {
        return await this.executeWithClaude(request);
      } catch (error) {
        console.warn('Claude request failed, attempting fallback:', error);

        // Try Grok fallback if available
        if (this.isGrokAvailable()) {
          try {
            return await this.executeWithGrok(request);
          } catch (grokError) {
            console.error('Grok fallback also failed:', grokError);
            throw new ProviderError(
              'all',
              'All providers unavailable',
              0
            );
          }
        }

        throw error;
      }
    }

    // Claude not available, try Grok directly
    if (this.isGrokAvailable()) {
      return await this.executeWithGrok(request);
    }

    throw new ProviderError('all', 'All providers unavailable', 0);
  }

  /**
   * Get health status of all providers
   */
  async getHealthStatus(): Promise<AIProviderHealth[]> {
    const health: AIProviderHealth[] = [];

    // Check Claude health
    this.checkCircuitTransition(this.claudeCircuit);
    const claudeStatus = this.getProviderStatus(this.claudeCircuit);

    health.push({
      provider: 'claude',
      status: claudeStatus,
      latencyMs: 0, // Would need actual health check
      lastChecked: new Date(),
      consecutiveFailures: this.claudeCircuit.failures,
    });

    // Check Grok health
    if (grokClient.isConfigured()) {
      this.checkCircuitTransition(this.grokCircuit);
      const grokStatus = this.getProviderStatus(this.grokCircuit);
      const grokHealth = await grokClient.healthCheck();

      health.push({
        provider: 'grok',
        status: grokHealth.healthy ? grokStatus : ProviderStatus.Unavailable,
        latencyMs: grokHealth.latencyMs,
        lastChecked: new Date(),
        consecutiveFailures: this.grokCircuit.failures,
      });
    }

    return health;
  }

  /**
   * Get provider status from circuit state
   */
  private getProviderStatus(circuit: CircuitBreakerState): ProviderStatus {
    switch (circuit.state) {
      case CircuitState.Closed:
        return ProviderStatus.Healthy;
      case CircuitState.HalfOpen:
        return ProviderStatus.Degraded;
      case CircuitState.Open:
        return ProviderStatus.Unavailable;
      default:
        return ProviderStatus.Unavailable;
    }
  }

  /**
   * Reset circuit breakers (for testing)
   */
  resetCircuits(): void {
    this.claudeCircuit = this.initCircuitState();
    this.grokCircuit = this.initCircuitState();
  }
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly latencyMs: number
  ) {
    super(`${provider} provider error: ${message}`);
    this.name = 'ProviderError';
  }
}

// Singleton instance
export const providerManager = new ProviderManagerService();
