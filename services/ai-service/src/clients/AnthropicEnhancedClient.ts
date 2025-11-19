/**
 * AnthropicEnhancedClient
 *
 * Extended Anthropic client with Claude Skills API support including:
 * - Skills container integration
 * - Beta flags configuration (skills-2025-10-02, code-execution-2025-08-25)
 * - Code execution tool support
 * - Progressive disclosure optimization
 * - Fallback logic for non-skills routing
 * - Request/response metrics tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  MessageWithSkillsParams,
  BetaFlags,
  SkillsContainer,
  SkillAPIError,
} from '../types/skills';

export interface AnthropicEnhancedConfig {
  apiKey: string;
  skillsBetaVersion?: string; // Default: 'skills-2025-10-02'
  codeExecutionBetaVersion?: string; // Default: 'code-execution-2025-08-25'
  enableSkills?: boolean; // Feature flag
  enableCodeExecution?: boolean; // Feature flag
  timeout?: number;
  maxRetries?: number;
}

export interface MessageResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  skills_used?: string[]; // Skills that were utilized
}

export interface RequestMetrics {
  requestId: string;
  startTime: number;
  endTime?: number;
  tokensUsed?: number;
  skillsUsed?: string[];
  success?: boolean;
  error?: Error;
}

/**
 * Enhanced Anthropic client with Claude Skills support
 */
export class AnthropicEnhancedClient extends Anthropic {
  private skillsBetaVersion: string;
  private codeExecutionBetaVersion: string;
  private enableSkills: boolean;
  private enableCodeExecution: boolean;
  private requestMetrics: Map<string, RequestMetrics> = new Map();

  constructor(config: AnthropicEnhancedConfig) {
    super({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });

    this.skillsBetaVersion = config.skillsBetaVersion || 'skills-2025-10-02';
    this.codeExecutionBetaVersion = config.codeExecutionBetaVersion || 'code-execution-2025-08-25';
    this.enableSkills = config.enableSkills ?? true;
    this.enableCodeExecution = config.enableCodeExecution ?? true;
  }

  /**
   * Create a message with skills support
   */
  async createMessageWithSkills(params: MessageWithSkillsParams): Promise<MessageResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.requestMetrics.set(requestId, {
      requestId,
      startTime,
    });

    try {
      // Build request with skills enhancements
      const request = this.buildSkillsRequest(params);

      // Add beta flags if skills or code execution enabled
      const betaHeaders = this.buildBetaHeaders(params);

      // Execute request through base client with beta headers
      const response = await this.messages.create(request as any, {
        headers: betaHeaders,
      });

      // Parse and enrich response
      const enhancedResponse = this.enrichResponse(response as any, params);

      // Update metrics
      this.updateMetrics(requestId, {
        endTime: Date.now(),
        tokensUsed: enhancedResponse.usage.input_tokens + enhancedResponse.usage.output_tokens,
        skillsUsed: enhancedResponse.skills_used,
        success: true,
      });

      return enhancedResponse;
    } catch (error) {
      this.updateMetrics(requestId, {
        endTime: Date.now(),
        success: false,
        error: error as Error,
      });

      // Fallback to non-skills request if enabled
      if (params.skills?.fallback_to_non_skills && error instanceof Error) {
        console.warn(
          '[AnthropicEnhancedClient] Skills request failed, falling back to non-skills',
          error.message
        );
        return this.fallbackToNonSkills(params);
      }

      throw new SkillAPIError(
        `Failed to create message with skills: ${(error as Error).message}`,
        500,
        'MESSAGE_WITH_SKILLS_ERROR',
        { requestId, params }
      );
    }
  }

  /**
   * Build request with skills enhancements
   */
  private buildSkillsRequest(params: MessageWithSkillsParams): any {
    const request: any = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      system: params.system,
      metadata: params.metadata,
    };

    // Add code execution tool if enabled
    if (this.enableCodeExecution) {
      request.tools = this.addCodeExecutionTool(params.tools || []);
    }

    // Add skills container if skills provided
    if (this.enableSkills && params.skills) {
      request.skills = this.addSkillsContainer(params.skills);
    }

    return request;
  }

  /**
   * Build beta headers for skills and code execution
   */
  private buildBetaHeaders(params: MessageWithSkillsParams): Record<string, string> {
    const headers: Record<string, string> = {};
    const betaFlags: string[] = [];

    // Add skills beta flag if skills enabled and provided
    if (this.enableSkills && params.skills) {
      betaFlags.push(this.skillsBetaVersion);
    }

    // Add code execution beta flag if enabled
    if (this.enableCodeExecution) {
      betaFlags.push(this.codeExecutionBetaVersion);
    }

    if (betaFlags.length > 0) {
      headers['anthropic-beta'] = betaFlags.join(',');
    }

    return headers;
  }

  /**
   * Add code execution tool to request
   */
  private addCodeExecutionTool(existingTools: unknown[]): unknown[] {
    const codeExecutionTool = {
      type: 'code_execution_20250825',
      name: 'code_execution',
    };

    // Check if code execution tool already exists
    const hasCodeExecution = existingTools.some(
      (tool: any) => tool.type === 'code_execution_20250825'
    );

    if (hasCodeExecution) {
      return existingTools;
    }

    return [...existingTools, codeExecutionTool];
  }

  /**
   * Add skills container to request
   */
  private addSkillsContainer(skills: SkillsContainer): any {
    return {
      skill_ids: skills.skill_ids,
      // Progressive disclosure: send less context upfront, add more as needed
      progressive_disclosure: skills.progressive_disclosure ?? true,
    };
  }

  /**
   * Enrich response with skills metadata
   */
  private enrichResponse(response: any, params: MessageWithSkillsParams): MessageResponse {
    const enhancedResponse: MessageResponse = {
      ...response,
      skills_used: this.extractSkillsUsed(response, params),
    };

    return enhancedResponse;
  }

  /**
   * Extract which skills were actually used in the response
   */
  private extractSkillsUsed(response: any, params: MessageWithSkillsParams): string[] | undefined {
    // Check if response metadata includes skill usage
    if (response.metadata?.skills_used) {
      return response.metadata.skills_used;
    }

    // Fallback: return all provided skills if no specific usage data
    if (params.skills?.skill_ids && params.skills.skill_ids.length > 0) {
      return params.skills.skill_ids;
    }

    return undefined;
  }

  /**
   * Fallback to non-skills request
   */
  private async fallbackToNonSkills(params: MessageWithSkillsParams): Promise<MessageResponse> {
    const fallbackRequest = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
      system: params.system,
      metadata: {
        ...params.metadata,
        fallback_mode: true,
      },
    };

    const response = await this.messages.create(fallbackRequest as any);

    return {
      ...response,
      skills_used: undefined,
    } as MessageResponse;
  }

  /**
   * Get request metrics for a specific request
   */
  getRequestMetrics(requestId: string): RequestMetrics | undefined {
    return this.requestMetrics.get(requestId);
  }

  /**
   * Get all request metrics
   */
  getAllMetrics(): RequestMetrics[] {
    return Array.from(this.requestMetrics.values());
  }

  /**
   * Clear metrics (useful for memory management)
   */
  clearMetrics(): void {
    this.requestMetrics.clear();
  }

  /**
   * Update metrics for a request
   */
  private updateMetrics(requestId: string, updates: Partial<RequestMetrics>): void {
    const existing = this.requestMetrics.get(requestId);
    if (existing) {
      this.requestMetrics.set(requestId, {
        ...existing,
        ...updates,
      });
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Calculate token savings from skills usage
   */
  calculateTokenSavings(withSkills: MessageResponse, withoutSkills: MessageResponse): number {
    const skillsTokens = withSkills.usage.input_tokens + withSkills.usage.output_tokens;
    const nonSkillsTokens = withoutSkills.usage.input_tokens + withoutSkills.usage.output_tokens;

    return nonSkillsTokens - skillsTokens;
  }

  /**
   * Calculate token savings percentage
   */
  calculateSavingsPercentage(withSkills: MessageResponse, withoutSkills: MessageResponse): number {
    const skillsTokens = withSkills.usage.input_tokens + withSkills.usage.output_tokens;
    const nonSkillsTokens = withoutSkills.usage.input_tokens + withoutSkills.usage.output_tokens;

    if (nonSkillsTokens === 0) return 0;

    return ((nonSkillsTokens - skillsTokens) / nonSkillsTokens) * 100;
  }
}
