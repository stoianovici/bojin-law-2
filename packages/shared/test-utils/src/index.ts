/**
 * @legal-platform/test-utils
 * Shared testing utilities for the Legal Platform
 */

// Custom renders with providers
export * from './renders';

// Test helpers
export * from './helpers';

// Mock factories
export * from './mocks';

// Database utilities
export * from './database';

// Test data factories
export * from './factories';

// Accessibility testing utilities
export * from './a11y';

// Re-export user event for convenience
export { default as userEvent } from '@testing-library/user-event';

// Re-export jest-dom matchers types
import '@testing-library/jest-dom';
