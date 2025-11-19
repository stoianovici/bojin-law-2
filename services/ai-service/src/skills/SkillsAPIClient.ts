/**
 * Skills API Client
 *
 * Client for interacting with Anthropic Claude Skills API.
 * Handles skill upload, management, and retrieval with:
 * - Retry logic with exponential backoff
 * - Request/response logging
 * - Beta API error handling
 */

import type {
  SkillMetadata,
  Skill,
  UploadSkillPayload,
  SkillFilters,
  SkillUpdatePayload,
  SkillsClientConfig,
  APIResponse,
  PaginatedResponse,
  SkillAPIError,
} from '../types/skills';
import { SkillUploadError } from '../types/skills';

export class SkillsAPIClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly betaVersion: string;

  constructor(config: SkillsClientConfig) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
    this.timeout = config.timeout || 30000; // 30 seconds
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // 1 second base delay
    this.betaVersion = config.betaVersion || 'skills-2025-10-02';

    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Upload a new skill to Anthropic Skills API
   */
  async uploadSkill(payload: UploadSkillPayload): Promise<SkillMetadata> {
    this.logRequest('uploadSkill', payload);

    try {
      // Prepare FormData for file upload
      const formData = new FormData();
      formData.append('display_name', payload.display_name);
      formData.append('description', payload.description);
      formData.append('type', payload.type);
      formData.append('category', payload.category);
      formData.append('content', payload.content);

      if (payload.version) {
        formData.append('version', payload.version);
      }

      if (payload.config) {
        formData.append('config', JSON.stringify(payload.config));
      }

      const response = await this.makeRequest<SkillMetadata>({
        method: 'POST',
        path: '/skills',
        body: formData,
        isFormData: true,
      });

      this.logResponse('uploadSkill', response);
      return response.data;
    } catch (error) {
      const apiError = this.handleError(error);
      throw new SkillUploadError(
        `Failed to upload skill: ${apiError.message}`,
        apiError.statusCode,
        { payload }
      );
    }
  }

  /**
   * List skills with optional filters
   */
  async listSkills(filters?: SkillFilters): Promise<PaginatedResponse<SkillMetadata>> {
    this.logRequest('listSkills', filters);

    try {
      const queryParams = this.buildQueryParams(filters);
      const response = await this.makeRequest<PaginatedResponse<SkillMetadata>>({
        method: 'GET',
        path: `/skills${queryParams}`,
      });

      this.logResponse('listSkills', response);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a specific skill by ID
   */
  async getSkill(skillId: string): Promise<Skill> {
    this.logRequest('getSkill', { skillId });

    if (!skillId) {
      throw new Error('Skill ID is required');
    }

    try {
      const response = await this.makeRequest<Skill>({
        method: 'GET',
        path: `/skills/${skillId}`,
      });

      this.logResponse('getSkill', response);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete a skill by ID
   */
  async deleteSkill(skillId: string): Promise<void> {
    this.logRequest('deleteSkill', { skillId });

    if (!skillId) {
      throw new Error('Skill ID is required');
    }

    try {
      await this.makeRequest<void>({
        method: 'DELETE',
        path: `/skills/${skillId}`,
      });

      this.logResponse('deleteSkill', { skillId, status: 'deleted' });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing skill
   */
  async updateSkill(skillId: string, updates: SkillUpdatePayload): Promise<Skill> {
    this.logRequest('updateSkill', { skillId, updates });

    if (!skillId) {
      throw new Error('Skill ID is required');
    }

    try {
      const response = await this.makeRequest<Skill>({
        method: 'PATCH',
        path: `/skills/${skillId}`,
        body: updates,
      });

      this.logResponse('updateSkill', response);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(options: {
    method: string;
    path: string;
    body?: unknown;
    isFormData?: boolean;
  }): Promise<APIResponse<T>> {
    const { method, path, body, isFormData = false } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = `${this.baseURL}${path}`;
        const headers: Record<string, string> = {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': this.betaVersion,
        };

        if (!isFormData) {
          headers['Content-Type'] = 'application/json';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-2xx responses
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw this.createAPIError(response.status, errorBody);
        }

        // Parse response for non-DELETE requests
        const data = method === 'DELETE' ? (null as T) : ((await response.json()) as T);

        return {
          data,
          status: response.status,
          headers: this.extractHeaders(response.headers),
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        // Calculate exponential backoff delay
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          this.logRetry(attempt + 1, delay);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Build query parameters from filters
   */
  private buildQueryParams(filters?: SkillFilters): string {
    if (!filters) return '';

    const params = new URLSearchParams();

    if (filters.type) params.append('type', filters.type);
    if (filters.category) params.append('category', filters.category);
    if (filters.min_effectiveness_score !== undefined) {
      params.append('min_effectiveness_score', filters.min_effectiveness_score.toString());
    }
    if (filters.search_query) params.append('search', filters.search_query);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Extract relevant headers from Response
   */
  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Create typed API error from response
   */
  private createAPIError(status: number, errorBody: any): SkillAPIError {
    const message = errorBody.error?.message || errorBody.message || 'API request failed';
    const code = errorBody.error?.code || 'UNKNOWN_ERROR';
    const details = errorBody.error?.details || errorBody;

    return {
      name: 'SkillAPIError',
      message,
      statusCode: status,
      code,
      details,
    } as SkillAPIError;
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: unknown): SkillAPIError {
    if ((error as any).name === 'SkillAPIError') {
      return error as SkillAPIError;
    }

    if (error instanceof Error) {
      return {
        name: 'SkillAPIError',
        message: error.message,
        statusCode: 500,
        code: 'INTERNAL_ERROR',
      } as SkillAPIError;
    }

    return {
      name: 'SkillAPIError',
      message: 'Unknown error occurred',
      statusCode: 500,
      code: 'UNKNOWN_ERROR',
    } as SkillAPIError;
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: unknown): boolean {
    if ((error as any).name === 'AbortError') {
      return true; // Timeout - don't retry
    }

    const statusCode = (error as any).statusCode;
    if (statusCode) {
      // Don't retry client errors (4xx) except 429 (rate limit)
      return statusCode >= 400 && statusCode < 500 && statusCode !== 429;
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Logging Methods
  // ============================================================================

  private logRequest(method: string, params?: unknown): void {
    console.log(`[SkillsAPIClient] ${method} request:`, {
      timestamp: new Date().toISOString(),
      params,
    });
  }

  private logResponse(method: string, response: unknown): void {
    console.log(`[SkillsAPIClient] ${method} response:`, {
      timestamp: new Date().toISOString(),
      response,
    });
  }

  private logRetry(attempt: number, delay: number): void {
    console.warn(`[SkillsAPIClient] Retrying request (attempt ${attempt}) after ${delay}ms`);
  }
}
