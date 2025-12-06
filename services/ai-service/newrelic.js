/**
 * New Relic APM Configuration - AI Service
 * Story 3.8: Document System Testing and Performance - Task 19
 *
 * This file configures New Relic APM for the AI service.
 * It must be required first, before any other modules.
 *
 * Environment Variables Required:
 * - NEW_RELIC_LICENSE_KEY: Your New Relic license key
 * - NEW_RELIC_APP_NAME: Application name in New Relic (defaults to 'legal-platform-ai-service')
 * - NODE_ENV: Environment (development, staging, production)
 */

'use strict';

exports.config = {
  /**
   * Application name in New Relic dashboard
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'legal-platform-ai-service'],

  /**
   * License key from New Relic
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY || 'your-license-key-here',

  /**
   * Enable/disable agent based on environment
   */
  agent_enabled: process.env.NODE_ENV === 'production' || process.env.NEW_RELIC_ENABLED === 'true',

  /**
   * Logging configuration
   */
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout',
  },

  /**
   * Distributed tracing for microservices
   */
  distributed_tracing: {
    enabled: true,
  },

  /**
   * Transaction tracer configuration
   */
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated',
    explain_threshold: 500,
  },

  /**
   * Error collector configuration
   */
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
    // Capture AI provider errors
    capture_events: true,
    expected_classes: ['AIProviderError', 'RateLimitError'],
  },

  /**
   * Browser monitoring disabled for backend
   */
  browser_monitoring: {
    enable: false,
  },

  /**
   * Slow SQL tracking
   */
  slow_sql: {
    enabled: true,
    max_samples: 10,
  },

  /**
   * Custom attributes for AI-specific metrics
   */
  attributes: {
    enabled: true,
    include: [
      'request.headers.host',
      'request.method',
      'request.uri',
      'response.status',
      // AI-specific attributes
      'ai.model',
      'ai.provider',
      'ai.operation',
      'ai.tokens.input',
      'ai.tokens.output',
      'ai.latency.ttft',
      'ai.latency.total',
      'ai.cached',
    ],
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.x-api-key',
      // Exclude sensitive AI data
      'ai.prompt',
      'ai.response',
    ],
  },

  /**
   * Transaction events with higher sample rate for AI ops
   */
  transaction_events: {
    enabled: true,
    max_samples_stored: 20000,
  },

  /**
   * Custom events for AI metrics
   */
  custom_insights_events: {
    enabled: true,
    max_samples_stored: 50000, // Higher for AI operations
  },

  /**
   * Transaction naming rules
   */
  rules: {
    name: [
      // AI operation endpoints
      { pattern: '/api/ai/generate', name: 'AI/Generate' },
      { pattern: '/api/ai/semantic-diff', name: 'AI/SemanticDiff' },
      { pattern: '/api/ai/clause-suggestion', name: 'AI/ClauseSuggestion' },
      { pattern: '/api/ai/risk-assessment', name: 'AI/RiskAssessment' },
      { pattern: '/api/ai/quality-metrics', name: 'AI/QualityMetrics' },
      { pattern: '/api/ai/health/*', name: 'AI/Health' },
    ],
    ignore: [
      '^/health',
      '^/ready',
      '^/live',
      '^/metrics', // Prometheus metrics
    ],
  },

  /**
   * Labels for filtering
   */
  labels: {
    service: 'ai-service',
    team: 'platform',
    environment: process.env.NODE_ENV || 'development',
  },

  /**
   * Security settings
   */
  security: {
    enabled: process.env.NODE_ENV === 'production',
    agent: {
      enabled: process.env.NODE_ENV === 'production',
    },
  },

  /**
   * Application logging
   */
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000,
    },
    metrics: {
      enabled: true,
    },
    local_decorating: {
      enabled: true,
    },
  },

  /**
   * Infinite tracing (for detailed traces)
   */
  infinite_tracing: {
    trace_observer: {
      host: process.env.NEW_RELIC_TRACE_OBSERVER_HOST || '',
      port: process.env.NEW_RELIC_TRACE_OBSERVER_PORT || 443,
    },
  },
};
