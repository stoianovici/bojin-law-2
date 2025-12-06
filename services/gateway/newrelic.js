/**
 * New Relic APM Configuration - Gateway Service
 * Story 3.8: Document System Testing and Performance - Task 19
 *
 * This file configures New Relic APM for the gateway service.
 * It must be required first, before any other modules.
 *
 * Environment Variables Required:
 * - NEW_RELIC_LICENSE_KEY: Your New Relic license key
 * - NEW_RELIC_APP_NAME: Application name in New Relic (defaults to 'legal-platform-gateway')
 * - NODE_ENV: Environment (development, staging, production)
 */

'use strict';

exports.config = {
  /**
   * Application name in New Relic dashboard
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'legal-platform-gateway'],

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
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout', // Log to stdout for Docker/Kubernetes
  },

  /**
   * Distributed tracing
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
    record_sql: 'obfuscated', // Obfuscate SQL queries
    explain_threshold: 500, // Explain queries taking > 500ms
  },

  /**
   * Error collector configuration
   */
  error_collector: {
    enabled: true,
    ignore_status_codes: [404], // Don't report 404s as errors
    ignore_classes: [],
    ignore_messages: [],
  },

  /**
   * Browser monitoring (for frontend apps)
   */
  browser_monitoring: {
    enable: false, // Gateway is backend only
  },

  /**
   * Slow SQL tracking
   */
  slow_sql: {
    enabled: true,
    max_samples: 10,
  },

  /**
   * Custom attributes
   */
  attributes: {
    enabled: true,
    include: [
      'request.headers.host',
      'request.headers.user-agent',
      'request.method',
      'request.uri',
      'response.status',
    ],
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.x-api-key',
    ],
  },

  /**
   * Transaction events
   */
  transaction_events: {
    enabled: true,
    max_samples_stored: 10000,
  },

  /**
   * Custom events (for business metrics)
   */
  custom_insights_events: {
    enabled: true,
    max_samples_stored: 30000,
  },

  /**
   * Allow all headers except sensitive ones
   */
  allow_all_headers: true,

  /**
   * Rules for naming transactions
   */
  rules: {
    name: [
      // GraphQL operations
      { pattern: '/graphql', name: 'GraphQL' },
      // REST API patterns
      { pattern: '/api/documents/:id/*', name: '/api/documents/:id/*' },
      { pattern: '/api/cases/:id/*', name: '/api/cases/:id/*' },
      { pattern: '/api/search/*', name: '/api/search/*' },
    ],
    ignore: [
      // Health check endpoints shouldn't create transactions
      '^/health',
      '^/ready',
      '^/live',
    ],
  },

  /**
   * Labels for filtering in New Relic
   */
  labels: {
    service: 'gateway',
    team: 'platform',
    environment: process.env.NODE_ENV || 'development',
  },

  /**
   * Security agent settings
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
};
