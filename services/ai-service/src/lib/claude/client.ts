/**
 * Claude API Client
 * Direct Anthropic SDK wrapper - replaces LangChain abstraction
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudeModel } from '@legal-platform/types';
import { config } from '../../config';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequestOptions {
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
}

export interface AIMetrics {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

// ============================================================================
// Model Configuration
// ============================================================================

const MODEL_CONFIGS: Record<
  ClaudeModel,
  { modelId: string; maxTokens: number; temperature: number }
> = {
  [ClaudeModel.Haiku]: {
    modelId: config.claude.models.haiku,
    maxTokens: 4096,
    temperature: 0,
  },
  [ClaudeModel.Sonnet]: {
    modelId: config.claude.models.sonnet,
    maxTokens: 8192,
    temperature: 0.1,
  },
  [ClaudeModel.Opus]: {
    modelId: config.claude.models.opus,
    maxTokens: 4096,
    temperature: 0.2,
  },
};

// ============================================================================
// Client
// ============================================================================

let clientInstance: Anthropic | null = null;

function getClient(): Anthropic {
  if (!clientInstance) {
    clientInstance = new Anthropic({
      apiKey: config.claude.apiKey,
    });
  }
  return clientInstance;
}

/**
 * Send a message to Claude and get a response
 */
export async function sendMessage(
  messages: ClaudeMessage[],
  options: ClaudeRequestOptions = {}
): Promise<ClaudeResponse> {
  const client = getClient();
  const modelConfig = MODEL_CONFIGS[options.model || ClaudeModel.Sonnet];

  const response = await client.messages.create({
    model: modelConfig.modelId,
    max_tokens: options.maxTokens ?? modelConfig.maxTokens,
    temperature: options.temperature ?? modelConfig.temperature,
    system: options.system,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Extract text content from response
  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return {
    content: textContent,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason,
  };
}

/**
 * Simple prompt completion - single user message with optional system prompt
 */
export async function complete(
  prompt: string,
  options: ClaudeRequestOptions = {}
): Promise<ClaudeResponse> {
  return sendMessage([{ role: 'user', content: prompt }], options);
}

/**
 * Chat completion with system and user messages
 */
export async function chat(
  systemPrompt: string,
  userMessage: string,
  options: Omit<ClaudeRequestOptions, 'system'> = {}
): Promise<ClaudeResponse> {
  return sendMessage([{ role: 'user', content: userMessage }], {
    ...options,
    system: systemPrompt,
  });
}

/**
 * Get all available models
 */
export function getAvailableModels(): ClaudeModel[] {
  return [ClaudeModel.Haiku, ClaudeModel.Sonnet, ClaudeModel.Opus];
}

/**
 * Check if API key is configured
 */
export function isConfigured(): boolean {
  return Boolean(config.claude.apiKey);
}

/**
 * Get model ID for a given ClaudeModel enum
 */
export function getModelId(model: ClaudeModel): string {
  return MODEL_CONFIGS[model].modelId;
}
