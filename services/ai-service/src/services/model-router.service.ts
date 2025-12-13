/**
 * Model Router Service
 * Story 3.1: AI Service Infrastructure
 *
 * Routes AI requests to appropriate Claude models based on task complexity
 * - Haiku: Simple tasks (< 1000 tokens, classification, extraction)
 * - Sonnet: Standard tasks (general document work)
 * - Opus: Complex tasks (legal analysis, multi-document reasoning)
 */

import { TaskComplexity, ClaudeModel, AIOperationType } from '@legal-platform/types';
import { config } from '../config';

// Token threshold for simple tasks
const SIMPLE_TOKEN_THRESHOLD = 1000;

// Operation type to complexity mapping
const operationComplexityMap: Record<AIOperationType, TaskComplexity> = {
  [AIOperationType.Classification]: TaskComplexity.Simple,
  [AIOperationType.Extraction]: TaskComplexity.Simple,
  [AIOperationType.Embedding]: TaskComplexity.Simple,
  [AIOperationType.TextGeneration]: TaskComplexity.Standard,
  [AIOperationType.DocumentSummary]: TaskComplexity.Standard,
  [AIOperationType.Chat]: TaskComplexity.Standard,
  [AIOperationType.LegalAnalysis]: TaskComplexity.Complex,
  [AIOperationType.DocumentReviewAnalysis]: TaskComplexity.Complex,
  // Story 4.1: Natural Language Task Parser - simple extraction task
  [AIOperationType.TaskParsing]: TaskComplexity.Simple,
  // Story 5.2: Communication Intelligence
  [AIOperationType.CommunicationIntelligence]: TaskComplexity.Standard,
  [AIOperationType.RiskAnalysis]: TaskComplexity.Complex,
  [AIOperationType.ThreadAnalysis]: TaskComplexity.Standard,
  // Story 5.4: Proactive AI Suggestions
  [AIOperationType.ProactiveSuggestion]: TaskComplexity.Standard,
  [AIOperationType.MorningBriefing]: TaskComplexity.Standard,
  [AIOperationType.PatternRecognition]: TaskComplexity.Standard,
  [AIOperationType.DocumentCompleteness]: TaskComplexity.Simple,
  // Snippet and style operations
  [AIOperationType.SnippetDetection]: TaskComplexity.Simple,
  [AIOperationType.SnippetShortcut]: TaskComplexity.Simple,
  [AIOperationType.StyleAnalysis]: TaskComplexity.Standard,
  [AIOperationType.StyleApplication]: TaskComplexity.Standard,
};

// Complexity to model mapping
const complexityModelMap: Record<TaskComplexity, ClaudeModel> = {
  [TaskComplexity.Simple]: ClaudeModel.Haiku,
  [TaskComplexity.Standard]: ClaudeModel.Sonnet,
  [TaskComplexity.Complex]: ClaudeModel.Opus,
};

export interface ModelRoutingInput {
  operationType: AIOperationType;
  promptLength?: number;
  complexity?: TaskComplexity;
  modelOverride?: ClaudeModel;
  hasMultipleDocuments?: boolean;
  requiresLegalReasoning?: boolean;
}

export interface ModelRoutingResult {
  model: ClaudeModel;
  modelName: string;
  complexity: TaskComplexity;
  reason: string;
}

export class ModelRouterService {
  /**
   * Classify task complexity based on input characteristics
   */
  classifyComplexity(input: ModelRoutingInput): TaskComplexity {
    // If complexity is explicitly provided, use it
    if (input.complexity) {
      return input.complexity;
    }

    // Check for complex task indicators
    if (input.requiresLegalReasoning || input.hasMultipleDocuments) {
      return TaskComplexity.Complex;
    }

    // Check for simple task indicators
    if (
      input.promptLength !== undefined &&
      input.promptLength < SIMPLE_TOKEN_THRESHOLD &&
      (input.operationType === AIOperationType.Classification ||
        input.operationType === AIOperationType.Extraction)
    ) {
      return TaskComplexity.Simple;
    }

    // Use operation type mapping as default
    return operationComplexityMap[input.operationType] || TaskComplexity.Standard;
  }

  /**
   * Select the appropriate model for the task
   */
  selectModel(input: ModelRoutingInput): ModelRoutingResult {
    // Check for environment variable overrides
    const envOverride = this.getEnvironmentOverride(input.operationType);
    if (envOverride) {
      return {
        model: envOverride,
        modelName: this.getModelName(envOverride),
        complexity: this.classifyComplexity(input),
        reason: 'Environment variable override',
      };
    }

    // Check for explicit model override in request
    if (input.modelOverride) {
      return {
        model: input.modelOverride,
        modelName: this.getModelName(input.modelOverride),
        complexity: this.classifyComplexity(input),
        reason: 'Request model override',
      };
    }

    // Classify complexity and select model
    const complexity = this.classifyComplexity(input);
    const model = complexityModelMap[complexity];

    return {
      model,
      modelName: this.getModelName(model),
      complexity,
      reason: this.getRoutingReason(input, complexity),
    };
  }

  /**
   * Get the actual model name string for API calls
   */
  private getModelName(model: ClaudeModel): string {
    switch (model) {
      case ClaudeModel.Haiku:
        return config.claude.models.haiku;
      case ClaudeModel.Sonnet:
        return config.claude.models.sonnet;
      case ClaudeModel.Opus:
        return config.claude.models.opus;
      default:
        return config.claude.models.sonnet;
    }
  }

  /**
   * Check for environment variable model overrides
   */
  private getEnvironmentOverride(operationType: AIOperationType): ClaudeModel | null {
    const overrideEnvVar = `AI_MODEL_OVERRIDE_${operationType.toUpperCase()}`;
    const override = process.env[overrideEnvVar];

    if (override) {
      switch (override.toLowerCase()) {
        case 'haiku':
          return ClaudeModel.Haiku;
        case 'sonnet':
          return ClaudeModel.Sonnet;
        case 'opus':
          return ClaudeModel.Opus;
      }
    }

    // Check for global override
    const globalOverride = process.env.AI_MODEL_OVERRIDE;
    if (globalOverride) {
      switch (globalOverride.toLowerCase()) {
        case 'haiku':
          return ClaudeModel.Haiku;
        case 'sonnet':
          return ClaudeModel.Sonnet;
        case 'opus':
          return ClaudeModel.Opus;
      }
    }

    return null;
  }

  /**
   * Generate human-readable routing reason
   */
  private getRoutingReason(input: ModelRoutingInput, complexity: TaskComplexity): string {
    if (input.requiresLegalReasoning) {
      return 'Complex legal reasoning required';
    }
    if (input.hasMultipleDocuments) {
      return 'Multi-document analysis';
    }
    if (input.promptLength !== undefined && input.promptLength < SIMPLE_TOKEN_THRESHOLD) {
      return `Short prompt (${input.promptLength} tokens)`;
    }

    switch (complexity) {
      case TaskComplexity.Simple:
        return `Simple task: ${input.operationType}`;
      case TaskComplexity.Complex:
        return `Complex task: ${input.operationType}`;
      default:
        return `Standard task: ${input.operationType}`;
    }
  }

  /**
   * Get model rate limits
   */
  getModelRateLimits(model: ClaudeModel): { requestsPerMin: number; tokensPerMin: number } {
    switch (model) {
      case ClaudeModel.Haiku:
        return config.claude.rateLimits.haiku;
      case ClaudeModel.Sonnet:
        return config.claude.rateLimits.sonnet;
      case ClaudeModel.Opus:
        return config.claude.rateLimits.opus;
      default:
        return config.claude.rateLimits.sonnet;
    }
  }
}

// Singleton instance
export const modelRouter = new ModelRouterService();
