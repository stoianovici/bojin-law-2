/**
 * LangChain Client for Claude API
 * Story 3.1: AI Service Infrastructure
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { config } from '../../config';
import { ClaudeModel } from '@legal-platform/types';

// Callback handler options
export interface AICallbackHandlerOptions {
  userId?: string;
  firmId?: string;
  operationType?: string;
  operationId?: string;
}

// Token usage input for tracking
export interface TokenUsageInput {
  userId: string;
  firmId: string;
  operationType: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  cost: number;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

// Callback handler for logging and monitoring
export class AICallbackHandler extends BaseCallbackHandler {
  name = 'AICallbackHandler';

  private startTime: number = 0;
  private inputTokens: number = 0;
  private outputTokens: number = 0;
  private options: AICallbackHandlerOptions;

  constructor(options?: AICallbackHandlerOptions) {
    super();
    this.options = options || {};
  }

  handleLLMStart(): void {
    this.startTime = Date.now();
  }

  handleLLMEnd(output: {
    llmOutput?: { tokenUsage?: { promptTokens?: number; completionTokens?: number } };
  }): void {
    const latencyMs = Date.now() - this.startTime;
    const tokenUsage = output?.llmOutput?.tokenUsage;

    if (tokenUsage) {
      this.inputTokens = tokenUsage.promptTokens || 0;
      this.outputTokens = tokenUsage.completionTokens || 0;
    }

    console.log(`LLM call completed in ${latencyMs}ms`, {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      ...this.options,
    });
  }

  handleLLMError(err: Error): void {
    console.error('LLM error:', err.message);
  }

  getMetrics() {
    return {
      latencyMs: Date.now() - this.startTime,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
    };
  }

  // Method to get token info for services
  async getTokenInfo(): Promise<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  }> {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.inputTokens + this.outputTokens,
      cost: 0, // Cost calculation would need model-specific pricing
    };
  }
}

// Model configurations
const modelConfigs = {
  [ClaudeModel.Haiku]: {
    modelName: config.claude.models.haiku,
    maxTokens: 4096,
    temperature: 0,
  },
  [ClaudeModel.Sonnet]: {
    modelName: config.claude.models.sonnet,
    maxTokens: 8192,
    temperature: 0.1,
  },
  [ClaudeModel.Opus]: {
    modelName: config.claude.models.opus,
    maxTokens: 4096,
    temperature: 0.2,
  },
};

// Create LangChain Claude model instance
export function createClaudeModel(
  model: ClaudeModel = ClaudeModel.Sonnet,
  options?: {
    maxTokens?: number;
    temperature?: number;
    callbacks?: BaseCallbackHandler[];
  }
): ChatAnthropic {
  const modelConfig = modelConfigs[model] || modelConfigs[ClaudeModel.Sonnet];

  return new ChatAnthropic({
    anthropicApiKey: config.claude.apiKey,
    modelName: modelConfig.modelName,
    maxTokens: options?.maxTokens || modelConfig.maxTokens,
    temperature: options?.temperature ?? modelConfig.temperature,
    callbacks: options?.callbacks,
  });
}

// Get all available models
export function getAvailableModels(): ClaudeModel[] {
  return [ClaudeModel.Haiku, ClaudeModel.Sonnet, ClaudeModel.Opus];
}

// Check if API key is configured
export function isConfigured(): boolean {
  return Boolean(config.claude.apiKey);
}
