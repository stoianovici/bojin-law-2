/** @type {import('jest').Config} */
module.exports = {
  // Workspace configuration for monorepo
  projects: [
    '<rootDir>/packages/ui',
    '<rootDir>/packages/shared/test-utils',
    '<rootDir>/apps/web',
    // Additional packages will be added as they are created with test configs
    // '<rootDir>/packages/shared/types',
    // '<rootDir>/services/*',
  ],

  // Enable coverage collection for all projects
  collectCoverage: false, // Coverage is collected at project level, not root

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'clover', 'json-summary'],

  // Global coverage thresholds - 80% for all metrics
  // Note: Individual projects enforce their own thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Coverage exclusions
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.storybook/',
    '\\.stories\\.(ts|tsx|js|jsx)$',
    '\\.test\\.(ts|tsx|js|jsx)$',
    '\\.spec\\.(ts|tsx|js|jsx)$',
    '/coverage/',
    '/__tests__/',
  ],

  // Test match patterns
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)', '**/*.(test|spec).(ts|tsx|js|jsx)'],

  // Test path ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.turbo/', '/coverage/'],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Max workers for parallel execution
  maxWorkers: '50%',

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
