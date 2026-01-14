/**
 * Anthropic Admin API Service
 * Fetches usage and cost data from Anthropic's Admin API
 *
 * API Docs: https://docs.anthropic.com/en/api/usage-cost-api
 */

// ============================================================================
// Types
// ============================================================================

export interface UsageBucket {
  starting_at: string;
  ending_at: string;
  results: UsageResult[];
}

export interface UsageResult {
  uncached_input_tokens: number;
  cache_creation: {
    ephemeral_1h_input_tokens: number;
    ephemeral_5m_input_tokens: number;
  };
  cache_read_input_tokens: number;
  output_tokens: number;
  server_tool_use: {
    web_search_requests: number;
  };
  api_key_id: string | null;
  workspace_id: string | null;
  model: string;
  service_tier: string | null;
  context_window: string | null;
}

export interface CostBucket {
  starting_at: string;
  ending_at: string;
  results: CostResult[];
}

export interface CostResult {
  currency: string;
  amount: string; // USD cents as string
  workspace_id: string | null;
  description: string | null;
  cost_type: string | null;
  context_window: string | null;
  model: string | null;
  service_tier: string | null;
  token_type: string | null;
}

export interface UsageResponse {
  data: UsageBucket[];
  has_more: boolean;
  next_page: string | null;
}

export interface CostResponse {
  data: CostBucket[];
  has_more: boolean;
  next_page: string | null;
}

export interface AnthropicUsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number }>;
  byDay: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
  }>;
}

export interface AnthropicCostSummary {
  totalCostUsd: number;
  totalCostEur: number;
  byDay: Array<{
    date: string;
    costUsd: number;
    costEur: number;
  }>;
  byModel: Record<string, { costUsd: number; costEur: number }>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================================================
// Constants
// ============================================================================

const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1/organizations';
const ANTHROPIC_VERSION = '2023-06-01';
const USD_TO_EUR = 0.92; // Approximate conversion rate

// ============================================================================
// Service
// ============================================================================

class AnthropicAdminService {
  private adminApiKey: string | null = null;

  constructor() {
    this.adminApiKey = process.env.ANTHROPIC_ADMIN_API_KEY || null;
  }

  /**
   * Check if Admin API is configured
   */
  isConfigured(): boolean {
    return !!this.adminApiKey;
  }

  /**
   * Fetch usage data from Anthropic Admin API
   */
  async getUsage(dateRange: DateRange, groupBy: string[] = ['model']): Promise<UsageResponse> {
    if (!this.adminApiKey) {
      throw new Error('ANTHROPIC_ADMIN_API_KEY not configured');
    }

    const params = new URLSearchParams({
      starting_at: dateRange.start.toISOString(),
      ending_at: dateRange.end.toISOString(),
      bucket_width: '1d',
    });

    for (const group of groupBy) {
      params.append('group_by[]', group);
    }

    const response = await fetch(`${ANTHROPIC_API_BASE}/usage_report/messages?${params}`, {
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'x-api-key': this.adminApiKey,
      },
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ error: { message: 'Unknown error' } }))) as {
        error?: { message?: string };
      };
      throw new Error(
        `Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
      );
    }

    return response.json() as Promise<UsageResponse>;
  }

  /**
   * Fetch cost data from Anthropic Admin API
   */
  async getCosts(dateRange: DateRange, groupBy: string[] = []): Promise<CostResponse> {
    if (!this.adminApiKey) {
      throw new Error('ANTHROPIC_ADMIN_API_KEY not configured');
    }

    const params = new URLSearchParams({
      starting_at: dateRange.start.toISOString(),
      ending_at: dateRange.end.toISOString(),
      bucket_width: '1d',
    });

    for (const group of groupBy) {
      params.append('group_by[]', group);
    }

    const response = await fetch(`${ANTHROPIC_API_BASE}/cost_report?${params}`, {
      headers: {
        'anthropic-version': ANTHROPIC_VERSION,
        'x-api-key': this.adminApiKey,
      },
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ error: { message: 'Unknown error' } }))) as {
        error?: { message?: string };
      };
      throw new Error(
        `Anthropic API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
      );
    }

    return response.json() as Promise<CostResponse>;
  }

  /**
   * Get summarized usage data for a date range
   */
  async getUsageSummary(dateRange: DateRange): Promise<AnthropicUsageSummary> {
    const usage = await this.getUsage(dateRange, ['model']);

    const summary: AnthropicUsageSummary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      byModel: {},
      byDay: [],
    };

    for (const bucket of usage.data) {
      const date = bucket.starting_at.split('T')[0];
      let dayInput = 0;
      let dayOutput = 0;

      for (const result of bucket.results) {
        const inputTokens = result.uncached_input_tokens + result.cache_read_input_tokens;
        const outputTokens = result.output_tokens;
        const cacheWrite =
          result.cache_creation.ephemeral_1h_input_tokens +
          result.cache_creation.ephemeral_5m_input_tokens;

        summary.totalInputTokens += result.uncached_input_tokens;
        summary.totalOutputTokens += outputTokens;
        summary.totalCacheReadTokens += result.cache_read_input_tokens;
        summary.totalCacheWriteTokens += cacheWrite;

        dayInput += inputTokens;
        dayOutput += outputTokens;

        // By model
        const model = result.model || 'unknown';
        if (!summary.byModel[model]) {
          summary.byModel[model] = { inputTokens: 0, outputTokens: 0 };
        }
        summary.byModel[model].inputTokens += inputTokens;
        summary.byModel[model].outputTokens += outputTokens;
      }

      if (dayInput > 0 || dayOutput > 0) {
        summary.byDay.push({ date, inputTokens: dayInput, outputTokens: dayOutput });
      }
    }

    return summary;
  }

  /**
   * Get summarized cost data for a date range
   */
  async getCostSummary(dateRange: DateRange): Promise<AnthropicCostSummary> {
    // First get total costs without grouping
    const totalCosts = await this.getCosts(dateRange, []);

    // Then get costs by model for breakdown
    const costsByModel = await this.getCosts(dateRange, ['model']);

    const summary: AnthropicCostSummary = {
      totalCostUsd: 0,
      totalCostEur: 0,
      byDay: [],
      byModel: {},
    };

    // Process total costs by day
    for (const bucket of totalCosts.data) {
      const date = bucket.starting_at.split('T')[0];
      let dayCostUsd = 0;

      for (const result of bucket.results) {
        // Amount is in USD cents
        const costUsd = parseFloat(result.amount) / 100;
        dayCostUsd += costUsd;
      }

      if (dayCostUsd > 0) {
        summary.byDay.push({
          date,
          costUsd: dayCostUsd,
          costEur: dayCostUsd * USD_TO_EUR,
        });
        summary.totalCostUsd += dayCostUsd;
      }
    }

    summary.totalCostEur = summary.totalCostUsd * USD_TO_EUR;

    // Process costs by model
    for (const bucket of costsByModel.data) {
      for (const result of bucket.results) {
        const model = result.model || 'unknown';
        const costUsd = parseFloat(result.amount) / 100;

        if (!summary.byModel[model]) {
          summary.byModel[model] = { costUsd: 0, costEur: 0 };
        }
        summary.byModel[model].costUsd += costUsd;
        summary.byModel[model].costEur += costUsd * USD_TO_EUR;
      }
    }

    return summary;
  }

  /**
   * Get combined usage and cost summary
   */
  async getFullSummary(dateRange: DateRange): Promise<{
    usage: AnthropicUsageSummary;
    costs: AnthropicCostSummary;
    isConfigured: boolean;
  }> {
    if (!this.isConfigured()) {
      return {
        usage: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalCacheWriteTokens: 0,
          byModel: {},
          byDay: [],
        },
        costs: {
          totalCostUsd: 0,
          totalCostEur: 0,
          byDay: [],
          byModel: {},
        },
        isConfigured: false,
      };
    }

    const [usage, costs] = await Promise.all([
      this.getUsageSummary(dateRange),
      this.getCostSummary(dateRange),
    ]);

    return { usage, costs, isConfigured: true };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const anthropicAdminService = new AnthropicAdminService();
