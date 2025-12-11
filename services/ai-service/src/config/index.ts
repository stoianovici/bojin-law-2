/**
 * AI Service Configuration
 * Centralizes all environment variable access through config objects
 */

export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || process.env.AI_SERVICE_PORT || '3002', 10),
    host: process.env.AI_SERVICE_HOST || '0.0.0.0',
  },

  // Claude API configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    models: {
      haiku: process.env.CLAUDE_HAIKU_MODEL || 'claude-3-5-haiku-latest',
      sonnet: process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-20250514',
      opus: process.env.CLAUDE_OPUS_MODEL || 'claude-3-opus-latest',
    },
    rateLimits: {
      haiku: { requestsPerMin: 1000, tokensPerMin: 100000 },
      sonnet: { requestsPerMin: 200, tokensPerMin: 40000 },
      opus: { requestsPerMin: 50, tokensPerMin: 10000 },
    },
  },

  // Grok API configuration (fallback)
  grok: {
    apiKey: process.env.GROK_API_KEY || '',
    apiUrl: process.env.GROK_API_URL || 'https://api.x.ai/v1',
    rateLimit: { requestsPerMin: 100, tokensPerMin: 20000 },
  },

  // Voyage AI configuration (embeddings)
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY || '',
    model: process.env.VOYAGE_MODEL || 'voyage-large-2',
    rateLimit: { requestsPerMin: 300 },
  },

  // Cache configuration
  cache: {
    ttlHours: parseInt(process.env.AI_CACHE_TTL_HOURS || '24', 10),
    similarityThreshold: parseFloat(process.env.AI_CACHE_SIMILARITY_THRESHOLD || '0.95'),
  },

  // Circuit breaker configuration
  circuitBreaker: {
    failureThreshold: parseInt(process.env.AI_CIRCUIT_FAILURE_THRESHOLD || '5', 10),
    resetTimeoutMs: parseInt(process.env.AI_CIRCUIT_RESET_TIMEOUT_MS || '30000', 10),
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Model pricing (per 1M tokens in cents)
  pricing: {
    haiku: { input: 25, output: 125 }, // $0.25/$1.25
    sonnet: { input: 300, output: 1500 }, // $3/$15
    opus: { input: 1500, output: 7500 }, // $15/$75
  },
};

export type Config = typeof config;
