/**
 * Claude Skills API Types
 *
 * Type definitions for Claude Skills infrastructure including:
 * - Skill metadata and configuration
 * - API request/response interfaces
 * - Usage metrics and tracking
 * - Error handling
 */

// ============================================================================
// Core Skill Types
// ============================================================================

export type SkillType = 'analysis' | 'generation' | 'extraction' | 'transformation' | 'validation';

export type SkillCategory =
  | 'legal-analysis'
  | 'document-processing'
  | 'research'
  | 'compliance'
  | 'drafting'
  | 'review'
  | 'general';

export interface SkillMetadata {
  id: string;
  skill_id: string;
  display_name: string;
  description: string;
  version: string;
  type: SkillType;
  category: SkillCategory;
  effectiveness_score: number;
  token_savings_avg: number;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface Skill extends SkillMetadata {
  content?: string; // The actual skill implementation/prompt
  config?: SkillConfig;
  metadata_extra?: Record<string, unknown>;
}

export interface SkillConfig {
  max_tokens?: number;
  temperature?: number;
  stop_sequences?: string[];
  thinking_mode?: 'enabled' | 'disabled' | 'auto';
  progressive_disclosure?: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface UploadSkillPayload {
  display_name: string;
  description: string;
  type: SkillType;
  category: SkillCategory;
  content: string; // File content or skill definition
  version?: string;
  config?: SkillConfig;
}

export interface SkillFilters {
  type?: SkillType;
  category?: SkillCategory;
  min_effectiveness_score?: number;
  search_query?: string;
  limit?: number;
  offset?: number;
}

export interface SkillUpdatePayload {
  display_name?: string;
  description?: string;
  content?: string;
  config?: SkillConfig;
  version?: string;
}

// ============================================================================
// Skills Container (for Messages API)
// ============================================================================

export interface SkillsContainer {
  skill_ids: string[];
  progressive_disclosure?: boolean;
  fallback_to_non_skills?: boolean;
}

// ============================================================================
// Usage Tracking Types
// ============================================================================

export interface SkillUsageLog {
  id: string;
  skill_id: string;
  task_type: string;
  tokens_used: number;
  tokens_saved_estimate: number;
  success: boolean;
  error_message?: string;
  execution_time_ms: number;
  created_at: Date;
}

export interface SkillVersion {
  id: string;
  skill_id: string;
  version: string;
  content: string;
  config?: SkillConfig;
  changelog?: string;
  is_active: boolean;
  created_at: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export class SkillAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SkillAPIError';
  }
}

export class SkillValidationError extends Error {
  constructor(
    message: string,
    public validationErrors: string[]
  ) {
    super(message);
    this.name = 'SkillValidationError';
  }
}

export class SkillUploadError extends SkillAPIError {
  constructor(message: string, statusCode: number, details?: Record<string, unknown>) {
    super(message, statusCode, 'SKILL_UPLOAD_ERROR', details);
    this.name = 'SkillUploadError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SkillsClientConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  betaVersion?: string;
  codeExecutionBetaVersion?: string;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ============================================================================
// Anthropic Messages API Extensions
// ============================================================================

export interface MessageWithSkillsParams {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  max_tokens: number;
  skills?: SkillsContainer;
  tools?: unknown[]; // Code execution tool
  temperature?: number;
  system?: string;
  metadata?: Record<string, unknown>;
}

export interface BetaFlags {
  skills?: string; // e.g., 'skills-2025-10-02'
  'code-execution'?: string; // e.g., 'code-execution-2025-08-25'
}
