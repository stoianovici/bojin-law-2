const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '@legal-platform/types': '<rootDir>/../../packages/shared/types/src',
    '@legal-platform/ui': '<rootDir>/../../packages/ui/src',
    '@legal-platform/romanian-templates': '<rootDir>/../../packages/romanian-templates/src',
    '@legal-platform/test-utils': '<rootDir>/../../packages/shared/test-utils/dist/index.js',
    // Force rxjs to use CommonJS build instead of ESM
    '^rxjs(/.*)?$': '<rootDir>/../../node_modules/rxjs/dist/cjs$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transform: {
    // Use SWC for TypeScript/JavaScript with ES6 modules
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            dynamicImport: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
        module: {
          type: 'es6',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    // Transform ESM modules including MSW, rxjs, and Apollo Client dependencies
    'node_modules/(?!(msw|@mswjs|@bundled-es-modules|@open-draft|is-node-process|outvariant|strict-event-emitter|rxjs|@apollo|graphql-tag|ts-invariant|optimism|@wry|zen-observable-ts)/)',
  ],
};

// Export async config
module.exports = async () => {
  const nextJestConfig = await createJestConfig(customJestConfig)();

  return {
    ...nextJestConfig,
    // Preserve our custom transform and transformIgnorePatterns
    transform: customJestConfig.transform,
    transformIgnorePatterns: customJestConfig.transformIgnorePatterns,
  };
};
