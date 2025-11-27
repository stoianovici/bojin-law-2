/**
 * Grok API Client (Fallback Provider)
 * Story 3.1: AI Service Infrastructure
 *
 * Implements OpenAI-compatible interface for Grok API
 */

import OpenAI from 'openai';
import { config } from '../../config';

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokCompletionRequest {
  messages: GrokMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface GrokCompletionResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
}

export class GrokClient {
  private client: OpenAI;
  private readonly model: string;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly rateLimit: number;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.grok.apiKey,
      baseURL: config.grok.apiUrl,
    });
    this.model = 'grok-beta';
    this.rateLimit = config.grok.rateLimit.requestsPerMin;
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return Boolean(config.grok.apiKey);
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute

    // Reset window if needed
    if (now - this.requestWindowStart > windowMs) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    // Check if at limit
    if (this.requestCount >= this.rateLimit) {
      const waitMs = windowMs - (now - this.requestWindowStart);
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
        this.requestCount = 0;
        this.requestWindowStart = Date.now();
      }
    }

    this.requestCount++;
  }

  /**
   * Map Claude system/user messages to Grok format
   */
  mapClaudeMessages(systemPrompt: string, userPrompt: string): GrokMessage[] {
    const messages: GrokMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userPrompt,
    });

    return messages;
  }

  /**
   * Create a chat completion
   */
  async createCompletion(request: GrokCompletionRequest): Promise<GrokCompletionResponse> {
    await this.checkRateLimit();

    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: request.model || this.model,
        messages: request.messages,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      });

      const latencyMs = Date.now() - startTime;
      const choice = response.choices[0];

      return {
        content: choice.message?.content || '',
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        model: response.model,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.error('Grok API error:', error);
      throw new GrokApiError(
        error instanceof Error ? error.message : 'Unknown Grok API error',
        latencyMs
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const startTime = Date.now();

    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });

      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

export class GrokApiError extends Error {
  constructor(
    message: string,
    public readonly latencyMs: number
  ) {
    super(message);
    this.name = 'GrokApiError';
  }
}

// Singleton instance
export const grokClient = new GrokClient();
