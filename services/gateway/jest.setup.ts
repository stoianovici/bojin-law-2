/**
 * Jest Setup File
 *
 * Configures the test environment BEFORE any test files are loaded.
 * This ensures environment variables and mocks are in place before
 * modules perform validation at import time.
 */

// ============================================================================
// Environment Variables
// ============================================================================
// Set environment variables before any imports to avoid validation errors
// in config modules that validate at import time.

// Azure AD config (valid GUID format required)
process.env.AZURE_AD_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
process.env.AZURE_AD_TENANT_ID = '00000000-0000-0000-0000-000000000000';
process.env.AZURE_AD_CLIENT_SECRET = 'test-client-secret-at-least-32-chars';
process.env.AZURE_AD_REDIRECT_URI = 'http://localhost:3000/auth/callback';

// Session config
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';

// Skip validation flags for tests
process.env.SKIP_AUTH_VALIDATION = 'true';
process.env.SKIP_GRAPH_VALIDATION = 'true';
process.env.NODE_ENV = 'test';

// Minimize retry delays in tests (but allow circuit breaker tests to work)
process.env.GRAPH_RETRY_MAX_ATTEMPTS = '0'; // No retries in tests
process.env.GRAPH_RETRY_INITIAL_DELAY = '1';
process.env.GRAPH_RETRY_MAX_DELAY = '1';
// Circuit breaker uses default threshold (10) so circuit breaker tests work
// Reset timeout is short to speed up tests
process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '1';

// Database URL (mocked, but some code checks for presence)
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Redis config
process.env.REDIS_URL = 'redis://localhost:6379';

// Anthropic (for AI services)
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

// Voyage AI (for embedding services)
process.env.VOYAGE_API_KEY = 'pa-test-voyage-key';

// Email send mode (original tests expect 'send' behavior)
process.env.EMAIL_SEND_MODE = 'send';

// ============================================================================
// Console Suppression (optional - reduce noise)
// ============================================================================
// Suppress console output in tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  // Suppress retry/circuit breaker noise
  console.warn = (...args: unknown[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('[Retry') ||
        message.includes('[Circuit Breaker') ||
        message.includes('[Graph API'))
    ) {
      return; // Suppress retry noise
    }
    originalConsoleWarn.apply(console, args);
  };

  // Keep error logging but filter out expected test errors
  console.error = (...args: unknown[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('[Orchestrator]') || message.includes('expected test error'))
    ) {
      return; // Suppress expected errors
    }
    originalConsoleError.apply(console, args);
  };
}

// ============================================================================
// Global Test Timeout
// ============================================================================
// Increase timeout for slower tests (default is 5000ms)
jest.setTimeout(10000);

// ============================================================================
// Exports (for Jest's setupFilesAfterEnv)
// ============================================================================
export {};
