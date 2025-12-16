/**
 * AI Service Client for Gateway
 * Story 3.1: AI Service Infrastructure
 *
 * Provides interface to AI Service with retry logic and error handling
 */

import {
  AIOperationType,
  TaskComplexity,
  ClaudeModel,
  AIGenerateResponse,
  AIUsageStats,
} from '@legal-platform/types';

// Configuration
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_API_KEY = process.env.AI_SERVICE_API_KEY || '';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface GenerateRequest {
  prompt: string;
  systemPrompt?: string;
  operationType: AIOperationType;
  complexity?: TaskComplexity;
  modelOverride?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  caseId?: string;
  firmId: string;
  useCache?: boolean;
}

export interface EmbedRequest {
  text: string;
  firmId: string;
}

export interface EmbedResponse {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  providers: Array<{
    provider: string;
    status: string;
    latencyMs: number;
    lastChecked: Date;
  }>;
}

class AIServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make request to AI service with retry logic
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  const url = `${AI_SERVICE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AI_SERVICE_API_KEY}`,
    ...options.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorBody);
        } catch {
          errorDetails = errorBody;
        }

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new AIServiceError(
            `AI Service error: ${response.statusText}`,
            response.status,
            errorDetails
          );
        }

        // Retry server errors (5xx)
        if (attempt < retries) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`AI Service request failed (attempt ${attempt}), retrying in ${delay}ms`);
          await sleep(delay);
          continue;
        }

        throw new AIServiceError(
          `AI Service error after ${retries} attempts: ${response.statusText}`,
          response.status,
          errorDetails
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      // Network errors - retry
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `AI Service network error (attempt ${attempt}), retrying in ${delay}ms:`,
          error
        );
        await sleep(delay);
        continue;
      }

      throw new AIServiceError(
        `AI Service network error after ${retries} attempts`,
        503,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  throw new AIServiceError('AI Service request failed', 503);
}

/**
 * AI Service Client
 */
export const aiService = {
  /**
   * Generate text using AI
   */
  async generate(request: GenerateRequest): Promise<AIGenerateResponse> {
    return makeRequest<AIGenerateResponse>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Generate embeddings for text
   */
  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    return makeRequest<EmbedResponse>('/api/ai/embed', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get health status
   */
  async health(): Promise<HealthCheckResponse> {
    return makeRequest<HealthCheckResponse>(
      '/api/ai/health',
      {
        method: 'GET',
      },
      1
    ); // No retries for health check
  },

  /**
   * Get usage statistics
   */
  async getUsage(firmId: string, startDate: Date, endDate: Date): Promise<AIUsageStats> {
    const params = new URLSearchParams({
      firmId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return makeRequest<AIUsageStats>(`/api/ai/usage?${params}`, {
      method: 'GET',
    });
  },

  /**
   * Invalidate cache entries
   */
  async invalidateCache(
    firmId: string,
    operationType?: AIOperationType
  ): Promise<{ invalidated: number }> {
    return makeRequest<{ invalidated: number }>('/api/ai/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify({ firmId, operationType }),
    });
  },
};

export { AIServiceError };
